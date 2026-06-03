use axum::{
    extract::{Path, State},
    routing::get,
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiJson, ApiResult},
    modules::{
        auth::CurrentAccount,
        patients::{require_patient_read_scope, require_patient_scope},
        services,
    },
    realtime::publish_change,
    state::AppState,
    validation::require_non_empty,
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionNote {
    id: String,
    patient_id: String,
    service: String,
    visit_id: String,
    author: String,
    author_role: String,
    recorded_at: String,
    content: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddEvolutionNoteRequest {
    service: Option<String>,
    visit_id: String,
    author: String,
    recorded_at: String,
    content: String,
}

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/patients/{patient_id}/evolution-notes",
        get(list_evolution_notes).post(add_evolution_note),
    )
}

async fn list_evolution_notes(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Vec<EvolutionNote>>> {
    require_patient_read_scope(&state, &patient_id, &current_account).await?;

    let notes = sqlx::query_as::<_, EvolutionNote>(
        "SELECT * FROM evolution_notes WHERE patient_id = ? ORDER BY recorded_at DESC, created_at DESC",
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(notes))
}

async fn add_evolution_note(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
    ApiJson(payload): ApiJson<AddEvolutionNoteRequest>,
) -> ApiResult<Json<EvolutionNote>> {
    let patient = require_patient_scope(&state, &patient_id, &current_account).await?;
    payload.validate()?;
    let service = match payload.service.as_deref() {
        Some(service) if !service.trim().is_empty() => {
            services::canonical_service_name(&state, service).await?
        }
        _ => patient.current_service.clone(),
    };

    if service != patient.current_service {
        return Err(ApiError::bad_request(
            "Le service de la note d'evolution doit correspondre au service du patient",
        ));
    }

    let note = sqlx::query_as::<_, EvolutionNote>(
        r#"
        INSERT INTO evolution_notes (
          id, patient_id, service, visit_id, author, author_role, recorded_at, content
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(patient_id.clone())
    .bind(service)
    .bind(payload.visit_id.trim())
    .bind(payload.author.trim())
    .bind(current_account.role.as_str())
    .bind(payload.recorded_at.trim())
    .bind(payload.content.trim())
    .fetch_one(&state.pool)
    .await?;

    publish_change(
        &state,
        "evolutionNote",
        "created",
        note.id.clone(),
        Some(patient_id),
        ["patient", "evolution"],
        &note,
    );

    Ok(Json(note))
}

impl AddEvolutionNoteRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.visit_id, "visitId")?;
        require_non_empty(&self.author, "author")?;
        require_non_empty(&self.recorded_at, "recordedAt")?;
        require_non_empty(&self.content, "content")?;
        Ok(())
    }
}
