use std::collections::HashSet;

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
        auth::{require_service_scope, CurrentAccount},
        medicines::normalize_search,
        patients::{require_patient_read_scope, PatientId},
    },
    realtime::publish_change,
    state::AppState,
    validation::require_one_of,
};

const ANTECEDENT_CATEGORIES: &[&str] = &[
    "pathology",
    "medical_history",
    "surgery",
    "medical_act",
    "heavy_treatment",
];
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
    patient_id: PatientId,
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
    patient_id: PatientId,
    visit_id: String,
    is_draft: bool,
    service: String,
    admission_reason: Option<String>,
    lifestyle: Option<String>,
    entrance_treatment: Option<String>,
    disease_history: Option<String>,
    clinical_exam: Option<String>,
    allergies: Option<String>,
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
    admission_reason: Option<String>,
    lifestyle: Option<String>,
    entrance_treatment: Option<String>,
    disease_history: Option<String>,
    clinical_exam: Option<String>,
    allergies: Option<String>,
    synthesis: Option<String>,
    antecedents: Vec<AntecedentInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntecedentInput {
    id: Option<String>,
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
    Path(patient_id): Path<PatientId>,
    Query(query): Query<ListEntranceExamsQuery>,
) -> ApiResult<Json<Vec<EntranceExamRecord>>> {
    let patient = require_patient_read_scope(&state, patient_id, &current_account).await?;

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
    Path(patient_id): Path<PatientId>,
) -> ApiResult<Json<EntranceExam>> {
    let patient = require_patient_read_scope(&state, patient_id, &current_account).await?;
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
    let antecedents = list_patient_antecedents(&state, patient_id).await?;

    Ok(Json(EntranceExam { exam, antecedents }))
}

async fn save_entrance_exam(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<PatientId>,
    ApiJson(payload): ApiJson<SaveEntranceExamRequest>,
) -> ApiResult<Json<EntranceExam>> {
    payload.validate()?;
    let patient = require_patient_read_scope(&state, patient_id, &current_account).await?;

    if patient.current_visit_id.is_some() {
        require_service_scope(&current_account, &patient.current_service)?;
    }

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
    let admission_reason = payload.admission_reason.and_then(normalize_optional);
    let lifestyle = payload.lifestyle.and_then(normalize_optional);
    let entrance_treatment = payload.entrance_treatment.and_then(normalize_optional);
    let disease_history = payload.disease_history.and_then(normalize_optional);
    let clinical_exam = payload.clinical_exam.and_then(normalize_optional);
    let allergies = payload.allergies.and_then(normalize_optional);
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
          id, patient_id, visit_id, service, admission_reason, lifestyle, entrance_treatment, disease_history, clinical_exam, allergies, synthesis
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(patient_id) DO UPDATE SET
          visit_id = excluded.visit_id,
          service = excluded.service,
          admission_reason = excluded.admission_reason,
          lifestyle = excluded.lifestyle,
          entrance_treatment = excluded.entrance_treatment,
          disease_history = excluded.disease_history,
          clinical_exam = excluded.clinical_exam,
          allergies = excluded.allergies,
          synthesis = excluded.synthesis,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        RETURNING *, visit_id = ? AS is_draft
        "#,
    )
    .bind(exam_id)
    .bind(&patient_id)
    .bind(visit_id)
    .bind(service)
    .bind(admission_reason)
    .bind(lifestyle)
    .bind(entrance_treatment)
    .bind(disease_history)
    .bind(clinical_exam)
    .bind(allergies)
    .bind(synthesis)
    .bind(DRAFT_VISIT_ID)
    .fetch_one(&mut *transaction)
    .await?;

    let submitted_existing_antecedent_ids = antecedents
        .iter()
        .filter_map(|antecedent| antecedent.id.clone())
        .collect::<HashSet<_>>();
    let editable_antecedent_ids = sqlx::query_as::<_, (String,)>(
        r#"
        SELECT id
        FROM patient_antecedents
        WHERE patient_id = ?
          AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')
        "#,
    )
    .bind(&patient_id)
    .fetch_all(&mut *transaction)
    .await?;

    for (antecedent_id,) in editable_antecedent_ids {
        if submitted_existing_antecedent_ids.contains(&antecedent_id) {
            continue;
        }

        sqlx::query("DELETE FROM patient_antecedents WHERE patient_id = ? AND id = ?")
            .bind(&patient_id)
            .bind(antecedent_id)
            .execute(&mut *transaction)
            .await?;
    }

    for antecedent in antecedents {
        if let Some(antecedent_id) = antecedent.id {
            sqlx::query(
                r#"
                UPDATE patient_antecedents
                SET category = ?,
                    source = ?,
                    code = ?,
                    label = ?,
                    notes = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE patient_id = ?
                  AND id = ?
                  AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')
                "#,
            )
            .bind(antecedent.category)
            .bind(antecedent.source)
            .bind(antecedent.code)
            .bind(antecedent.label)
            .bind(antecedent.notes)
            .bind(&patient_id)
            .bind(antecedent_id)
            .execute(&mut *transaction)
            .await?;
        } else {
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
    }

    transaction.commit().await?;

    let antecedents = list_patient_antecedents(&state, patient_id).await?;
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
            .unwrap_or_else(|| patient_id.to_string()),
        Some(patient_id.to_string()),
        ["patient", "entrance"],
        &response,
    );

    Ok(Json(response))
}

async fn list_patient_antecedents(
    state: &AppState,
    patient_id: PatientId,
) -> ApiResult<Vec<PatientAntecedent>> {
    let antecedents = sqlx::query_as::<_, PatientAntecedent>(
        r#"
        SELECT *
        FROM patient_antecedents
        WHERE patient_id = ?
        ORDER BY
          CASE category
            WHEN 'pathology' THEN 0
            WHEN 'medical_history' THEN 1
            WHEN 'heavy_treatment' THEN 1
            WHEN 'surgery' THEN 2
            WHEN 'medical_act' THEN 2
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
    id: Option<String>,
    category: String,
    source: Option<String>,
    code: Option<String>,
    label: String,
    notes: Option<String>,
}

fn normalize_antecedent_input(input: AntecedentInput) -> Option<NormalizedAntecedentInput> {
    let label = input.label.trim();
    let category = match input.category.as_str() {
        "medical_act" => "surgery",
        "heavy_treatment" => "medical_history",
        category => category,
    };

    if label.is_empty() {
        return None;
    }

    let source = if category == "pathology" {
        input.source.and_then(normalize_optional)
    } else {
        None
    };
    let code = if category == "pathology" {
        input.code.and_then(normalize_optional)
    } else {
        None
    };

    Some(NormalizedAntecedentInput {
        id: input.id.and_then(normalize_optional),
        category: category.to_string(),
        source,
        code,
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
