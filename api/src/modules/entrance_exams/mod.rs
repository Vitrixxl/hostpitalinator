use axum::{
    extract::{Path, Query, State},
    routing::get,
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, Sqlite};
use uuid::Uuid;

use crate::{
    error::{ApiJson, ApiResult},
    modules::{
        auth::CurrentAccount,
        medicines::normalize_search,
        patients::{require_patient_read_scope, require_patient_scope},
    },
    realtime::publish_change,
    state::AppState,
    validation::require_one_of,
};

const ANTECEDENT_CATEGORIES: &[&str] = &["pathology", "medical_act", "heavy_treatment"];
const CLINICAL_REFERENCE_KINDS: &[&str] = &["pathology", "medical_act"];
const DEFAULT_REFERENCE_LIMIT: i64 = 20;
const MAX_REFERENCE_LIMIT: i64 = 50;
const MIN_REFERENCE_SEARCH_LENGTH: usize = 2;
const DEFAULT_EXAM_HISTORY_LIMIT: i64 = 5;
const MAX_EXAM_HISTORY_LIMIT: i64 = 25;
const DRAFT_VISIT_ID: &str = "DRAFT";

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ClinicalReference {
    id: String,
    kind: String,
    source: String,
    code: String,
    label: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PatientAntecedent {
    id: String,
    patient_id: String,
    category: String,
    source: Option<String>,
    code: Option<String>,
    label: String,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EntranceExamRecord {
    id: String,
    patient_id: String,
    visit_id: String,
    is_draft: bool,
    service: String,
    lifestyle: Option<String>,
    disease_history: Option<String>,
    synthesis: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntranceExam {
    exam: Option<EntranceExamRecord>,
    antecedents: Vec<PatientAntecedent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveEntranceExamRequest {
    lifestyle: Option<String>,
    disease_history: Option<String>,
    synthesis: Option<String>,
    antecedents: Vec<AntecedentInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntecedentInput {
    category: String,
    source: Option<String>,
    code: Option<String>,
    label: String,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchClinicalReferencesQuery {
    kind: Option<String>,
    search: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListEntranceExamsQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/clinical-references", get(search_clinical_references))
        .route(
            "/patients/{patient_id}/entrance-exams",
            get(list_entrance_exams),
        )
        .route(
            "/patients/{patient_id}/entrance-exam",
            get(get_entrance_exam).put(save_entrance_exam),
        )
}

async fn search_clinical_references(
    State(state): State<AppState>,
    Query(params): Query<SearchClinicalReferencesQuery>,
) -> ApiResult<Json<Vec<ClinicalReference>>> {
    let kind = params.kind.unwrap_or_default();
    require_one_of(&kind, "kind", CLINICAL_REFERENCE_KINDS)?;

    let search = normalize_search(params.search.unwrap_or_default());

    if search.len() < MIN_REFERENCE_SEARCH_LENGTH {
        return Ok(Json(Vec::new()));
    }

    let limit = params
        .limit
        .unwrap_or(DEFAULT_REFERENCE_LIMIT)
        .clamp(1, MAX_REFERENCE_LIMIT);
    let search_terms = search.split_whitespace().collect::<Vec<_>>();
    let phrase_prefix_pattern = format!("{search}%");
    let first_term_prefix_pattern = format!("{}%", search_terms[0]);

    let mut query_builder = QueryBuilder::<Sqlite>::new(
        r#"
        SELECT id, kind, source, code, label, created_at, updated_at
        FROM clinical_references
        WHERE kind =
        "#,
    );

    query_builder.push_bind(kind);

    for term in search_terms {
        query_builder.push(" AND (search_text LIKE ");
        query_builder.push_bind(format!("{term}%"));
        query_builder.push(" OR search_text LIKE ");
        query_builder.push_bind(format!("% {term}%"));
        query_builder.push(")");
    }

    query_builder.push(
        r#"
        ORDER BY
          CASE
            WHEN search_text LIKE "#,
    );
    query_builder.push_bind(phrase_prefix_pattern);
    query_builder.push(" THEN 0 WHEN search_text LIKE ");
    query_builder.push_bind(first_term_prefix_pattern);
    query_builder.push(
        r#" THEN 1 ELSE 2 END,
          label COLLATE NOCASE
        LIMIT "#,
    );
    query_builder.push_bind(limit);

    let references = query_builder
        .build_query_as::<ClinicalReference>()
        .fetch_all(&state.pool)
        .await?;

    Ok(Json(references))
}

async fn list_entrance_exams(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
    Query(query): Query<ListEntranceExamsQuery>,
) -> ApiResult<Json<Vec<EntranceExamRecord>>> {
    let patient = require_patient_read_scope(&state, &patient_id, &current_account).await?;

    let limit = query
        .limit
        .unwrap_or(DEFAULT_EXAM_HISTORY_LIMIT)
        .clamp(1, MAX_EXAM_HISTORY_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);
    let exams = sqlx::query_as::<_, EntranceExamRecord>(
        r#"
        SELECT *, visit_id = ? AS is_draft
        FROM entrance_exams
        WHERE patient_id = ?
          AND visit_id <> ?
          AND visit_id <> COALESCE(?, '')
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        "#,
    )
    .bind(DRAFT_VISIT_ID)
    .bind(patient_id)
    .bind(DRAFT_VISIT_ID)
    .bind(patient.current_visit_id.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(exams))
}

async fn get_entrance_exam(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<EntranceExam>> {
    let patient = require_patient_read_scope(&state, &patient_id, &current_account).await?;
    let current_exam_visit_id = patient
        .current_visit_id
        .as_deref()
        .unwrap_or(DRAFT_VISIT_ID);
    let exam = sqlx::query_as::<_, EntranceExamRecord>(
        r#"
            SELECT *, visit_id = ? AS is_draft
            FROM entrance_exams
            WHERE patient_id = ?
              AND visit_id = ?
            LIMIT 1
            "#,
    )
    .bind(DRAFT_VISIT_ID)
    .bind(&patient_id)
    .bind(current_exam_visit_id)
    .fetch_optional(&state.pool)
    .await?;
    let antecedents = list_patient_antecedents(&state, &patient_id).await?;

    Ok(Json(EntranceExam { exam, antecedents }))
}

async fn save_entrance_exam(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
    ApiJson(payload): ApiJson<SaveEntranceExamRequest>,
) -> ApiResult<Json<EntranceExam>> {
    payload.validate()?;
    let patient = require_patient_scope(&state, &patient_id, &current_account).await?;
    let visit_id = patient
        .current_visit_id
        .as_deref()
        .unwrap_or(DRAFT_VISIT_ID);
    let service = if patient.current_visit_id.is_some() {
        patient.current_service.as_str()
    } else {
        current_account.service.as_str()
    };

    let exam_id = Uuid::new_v4().to_string();
    let lifestyle = payload.lifestyle.and_then(normalize_optional);
    let disease_history = payload.disease_history.and_then(normalize_optional);
    let synthesis = payload.synthesis.and_then(normalize_optional);
    let antecedents = payload
        .antecedents
        .into_iter()
        .filter_map(normalize_antecedent_input)
        .collect::<Vec<_>>();
    let mut transaction = state.pool.begin().await?;

    let exam = sqlx::query_as::<_, EntranceExamRecord>(
        r#"
        INSERT INTO entrance_exams (
          id, patient_id, visit_id, service, lifestyle, disease_history, synthesis
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(patient_id) DO UPDATE SET
          visit_id = excluded.visit_id,
          service = excluded.service,
          lifestyle = excluded.lifestyle,
          disease_history = excluded.disease_history,
          synthesis = excluded.synthesis,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        RETURNING *, visit_id = ? AS is_draft
        "#,
    )
    .bind(exam_id)
    .bind(&patient_id)
    .bind(visit_id)
    .bind(service)
    .bind(lifestyle)
    .bind(disease_history)
    .bind(synthesis)
    .bind(DRAFT_VISIT_ID)
    .fetch_one(&mut *transaction)
    .await?;

    sqlx::query("DELETE FROM patient_antecedents WHERE patient_id = ?")
        .bind(&patient_id)
        .execute(&mut *transaction)
        .await?;

    for antecedent in antecedents {
        sqlx::query(
            r#"
            INSERT INTO patient_antecedents (
              id, patient_id, category, source, code, label, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&patient_id)
        .bind(antecedent.category)
        .bind(antecedent.source)
        .bind(antecedent.code)
        .bind(antecedent.label)
        .bind(antecedent.notes)
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;

    let antecedents = list_patient_antecedents(&state, &patient_id).await?;
    let response = EntranceExam {
        exam: Some(exam),
        antecedents,
    };

    publish_change(
        &state,
        "entranceExam",
        "updated",
        response
            .exam
            .as_ref()
            .map(|exam| exam.id.clone())
            .unwrap_or_else(|| patient_id.clone()),
        Some(patient_id),
        ["patient", "entrance"],
        &response,
    );

    Ok(Json(response))
}

async fn list_patient_antecedents(
    state: &AppState,
    patient_id: &str,
) -> ApiResult<Vec<PatientAntecedent>> {
    let antecedents = sqlx::query_as::<_, PatientAntecedent>(
        r#"
        SELECT *
        FROM patient_antecedents
        WHERE patient_id = ?
        ORDER BY
          CASE category
            WHEN 'pathology' THEN 0
            WHEN 'medical_act' THEN 1
            ELSE 2
          END,
          created_at DESC
        "#,
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(antecedents)
}

impl SaveEntranceExamRequest {
    fn validate(&self) -> ApiResult<()> {
        for antecedent in &self.antecedents {
            require_one_of(
                &antecedent.category,
                "antecedent.category",
                ANTECEDENT_CATEGORIES,
            )?;
        }

        Ok(())
    }
}

#[derive(Debug)]
struct NormalizedAntecedentInput {
    category: String,
    source: Option<String>,
    code: Option<String>,
    label: String,
    notes: Option<String>,
}

fn normalize_antecedent_input(input: AntecedentInput) -> Option<NormalizedAntecedentInput> {
    let label = input.label.trim();

    if label.is_empty() {
        return None;
    }

    Some(NormalizedAntecedentInput {
        category: input.category,
        source: input.source.and_then(normalize_optional),
        code: input.code.and_then(normalize_optional),
        label: label.to_string(),
        notes: input.notes.and_then(normalize_optional),
    })
}

fn normalize_optional(value: String) -> Option<String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
