use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderValue},
    response::{IntoResponse, Response},
    routing::get,
    Extension, Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::path::Path as FsPath;
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiResult},
    modules::{auth::CurrentAccount, patients::require_patient_scope},
    realtime::publish_change,
    state::AppState,
    validation::{require_non_empty, require_one_of},
};

const CATEGORIES: &[&str] = &[
    "report",
    "biology",
    "imaging",
    "prescription",
    "letter",
    "administrative",
];

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MedicalDocument {
    id: String,
    patient_id: String,
    title: String,
    category: String,
    created_at: String,
    storage_path: Option<String>,
    mime_type: Option<String>,
    original_file_name: Option<String>,
    file_size_bytes: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenMedicalDocumentResponse {
    document: MedicalDocument,
    storage_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddMedicalDocumentRequest {
    title: String,
    category: String,
    storage_path: Option<String>,
    mime_type: Option<String>,
    original_file_name: Option<String>,
    content_base64: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMedicalDocumentsQuery {
    category: Option<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/patients/{patient_id}/documents",
            get(list_medical_documents).post(add_medical_document),
        )
        .route("/documents/{id}/open", get(open_medical_document))
        .route("/documents/{id}/download", get(download_medical_document))
}

async fn list_medical_documents(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
    Query(query): Query<ListMedicalDocumentsQuery>,
) -> ApiResult<Json<Vec<MedicalDocument>>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;

    let documents = if let Some(category) = query.category {
        require_one_of(&category, "category", CATEGORIES)?;
        sqlx::query_as::<_, MedicalDocument>(
            "SELECT * FROM medical_documents WHERE patient_id = ? AND category = ? ORDER BY created_at DESC",
    )
    .bind(patient_id.clone())
        .bind(category)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, MedicalDocument>(
            "SELECT * FROM medical_documents WHERE patient_id = ? ORDER BY created_at DESC",
        )
        .bind(patient_id)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(documents))
}

async fn add_medical_document(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
    Json(payload): Json<AddMedicalDocumentRequest>,
) -> ApiResult<Json<MedicalDocument>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;
    payload.validate()?;
    let id = Uuid::new_v4().to_string();
    let stored_file = store_uploaded_file(&state, &patient_id, &id, &payload).await?;

    let document = sqlx::query_as::<_, MedicalDocument>(
        r#"
        INSERT INTO medical_documents (
          id,
          patient_id,
          title,
          category,
          storage_path,
          mime_type,
          original_file_name,
          file_size_bytes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(patient_id.clone())
    .bind(payload.title.trim())
    .bind(payload.category)
    .bind(
        stored_file
            .storage_path
            .or_else(|| payload.storage_path.map(trim_optional)),
    )
    .bind(payload.mime_type.map(trim_optional))
    .bind(stored_file.original_file_name)
    .bind(stored_file.file_size_bytes)
    .fetch_one(&state.pool)
    .await?;

    publish_change(
        &state,
        "medicalDocument",
        "created",
        document.id.clone(),
        Some(patient_id),
        ["patient", "documents"],
        &document,
    );

    Ok(Json(document))
}

async fn open_medical_document(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<OpenMedicalDocumentResponse>> {
    let document =
        sqlx::query_as::<_, MedicalDocument>("SELECT * FROM medical_documents WHERE id = ?")
            .bind(id)
            .fetch_optional(&state.pool)
            .await?
            .ok_or_else(|| ApiError::not_found("Medical document not found"))?;
    require_patient_scope(&state, &document.patient_id, &current_account).await?;

    let storage_path = document.storage_path.clone();

    Ok(Json(OpenMedicalDocumentResponse {
        document,
        storage_path,
    }))
}

async fn download_medical_document(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Response> {
    let document =
        sqlx::query_as::<_, MedicalDocument>("SELECT * FROM medical_documents WHERE id = ?")
            .bind(id)
            .fetch_optional(&state.pool)
            .await?
            .ok_or_else(|| ApiError::not_found("Medical document not found"))?;
    require_patient_scope(&state, &document.patient_id, &current_account).await?;

    let storage_path = document
        .storage_path
        .as_ref()
        .ok_or_else(|| ApiError::not_found("No stored file for this document"))?;
    let storage_path = FsPath::new(storage_path);
    ensure_download_path_allowed(&state, storage_path).await?;
    let bytes = tokio::fs::read(storage_path)
        .await
        .map_err(|_| ApiError::not_found("Stored file not found"))?;

    let mut headers = HeaderMap::new();
    let content_type = document
        .mime_type
        .as_deref()
        .unwrap_or("application/octet-stream")
        .parse::<HeaderValue>()
        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));
    headers.insert(header::CONTENT_TYPE, content_type);

    let filename = document
        .original_file_name
        .as_deref()
        .unwrap_or("document.bin")
        .replace('"', "");
    let disposition = format!("attachment; filename=\"{filename}\"");
    if let Ok(value) = HeaderValue::from_str(&disposition) {
        headers.insert(header::CONTENT_DISPOSITION, value);
    }

    Ok((headers, bytes).into_response())
}

async fn ensure_download_path_allowed(state: &AppState, storage_path: &FsPath) -> ApiResult<()> {
    let storage_root = tokio::fs::canonicalize(&state.file_storage_dir)
        .await
        .map_err(|_| ApiError::not_found("Document storage directory not found"))?;
    let file_path = tokio::fs::canonicalize(storage_path)
        .await
        .map_err(|_| ApiError::not_found("Stored file not found"))?;

    if file_path.starts_with(storage_root) {
        return Ok(());
    }

    Err(ApiError::forbidden(
        "Only files managed by the document storage can be downloaded",
    ))
}

impl AddMedicalDocumentRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.title, "title")?;
        require_one_of(&self.category, "category", CATEGORIES)?;

        if let Some(content) = &self.content_base64 {
            require_non_empty(content, "contentBase64")?;
        }

        Ok(())
    }
}

fn trim_optional(value: String) -> String {
    value.trim().to_string()
}

struct StoredFile {
    storage_path: Option<String>,
    original_file_name: Option<String>,
    file_size_bytes: Option<i64>,
}

async fn store_uploaded_file(
    state: &AppState,
    patient_id: &str,
    document_id: &str,
    payload: &AddMedicalDocumentRequest,
) -> ApiResult<StoredFile> {
    let Some(content_base64) = &payload.content_base64 else {
        return Ok(StoredFile {
            storage_path: None,
            original_file_name: payload.original_file_name.clone().map(trim_optional),
            file_size_bytes: None,
        });
    };

    let encoded = content_base64
        .split_once(',')
        .map_or(content_base64.as_str(), |(_, value)| value);
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| ApiError::bad_request("contentBase64 must be valid base64"))?;

    let original_file_name = payload
        .original_file_name
        .clone()
        .or_else(|| Some(format!("{}.bin", payload.title.trim())));
    let sanitized_name =
        sanitize_file_name(original_file_name.as_deref().unwrap_or("document.bin"));
    let stored_name = format!("{document_id}-{sanitized_name}");
    let patient_dir = state.file_storage_dir.join(patient_id);
    tokio::fs::create_dir_all(&patient_dir)
        .await
        .map_err(|error| ApiError::internal(error.to_string()))?;

    let storage_path = patient_dir.join(stored_name);
    tokio::fs::write(&storage_path, &bytes)
        .await
        .map_err(|error| ApiError::internal(error.to_string()))?;

    Ok(StoredFile {
        storage_path: Some(storage_path.to_string_lossy().to_string()),
        original_file_name: original_file_name.map(trim_optional),
        file_size_bytes: Some(bytes.len() as i64),
    })
}

fn sanitize_file_name(file_name: &str) -> String {
    let sanitized = file_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if sanitized.is_empty() {
        "document.bin".to_string()
    } else {
        sanitized
    }
}
