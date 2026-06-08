use axum::{
    extract::{Path, Query, State},
    routing::get,
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, Sqlite};
use uuid::Uuid;

use crate::{
    error::{is_unique_constraint, ApiError, ApiJson, ApiResult},
    modules::{
        auth::CurrentAccount,
        medicines::normalize_search,
        patients::{require_patient_read_scope, require_patient_scope, PatientId},
    },
    realtime::publish_change,
    state::AppState,
    validation::require_non_empty,
};

const DEFAULT_SEARCH_LIMIT: i64 = 20;
const MAX_SEARCH_LIMIT: i64 = 50;
const MIN_SEARCH_LENGTH: usize = 2;
const ANS_RPPS_SOURCE: &str = "ANS_RPPS";

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Doctor {
    id: String,
    national_id: String,
    civility: String,
    first_name: String,
    last_name: String,
    profession_code: String,
    profession_label: String,
    category_code: String,
    category_label: String,
    specialties: String,
    specialty_codes: String,
    practice_modes: String,
    practice_locations: String,
    phone_numbers: String,
    emails: String,
    source: String,
    source_updated_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PatientDoctorFollowup {
    id: String,
    patient_id: PatientId,
    doctor_id: String,
    doctor_national_id: String,
    doctor_civility: String,
    doctor_first_name: String,
    doctor_last_name: String,
    doctor_profession_label: String,
    doctor_specialties: String,
    doctor_practice_locations: String,
    doctor_phone_numbers: String,
    doctor_emails: String,
    specialty: String,
    start_date: String,
    end_date: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchDoctorsQuery {
    search: Option<String>,
    specialty: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListPatientDoctorsQuery {
    specialty: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePatientDoctorFollowupRequest {
    doctor_id: String,
    specialty: String,
    start_date: String,
    end_date: Option<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/doctors", get(search_doctors))
        .route(
            "/patients/{patient_id}/doctors",
            get(list_patient_doctors).post(add_patient_doctor),
        )
        .route(
            "/patients/{patient_id}/doctors/{id}",
            axum::routing::put(update_patient_doctor).delete(delete_patient_doctor),
        )
}

async fn search_doctors(
    State(state): State<AppState>,
    Extension(_current_account): Extension<CurrentAccount>,
    Query(params): Query<SearchDoctorsQuery>,
) -> ApiResult<Json<Vec<Doctor>>> {
    let search = normalize_search(params.search.unwrap_or_default());
    let specialty = normalize_search(params.specialty.unwrap_or_default());

    if search.len() < MIN_SEARCH_LENGTH && specialty.is_empty() {
        return Ok(Json(Vec::new()));
    }

    let limit = params
        .limit
        .unwrap_or(DEFAULT_SEARCH_LIMIT)
        .clamp(1, MAX_SEARCH_LIMIT);
    let search_terms = search
        .split_whitespace()
        .map(str::to_string)
        .collect::<Vec<_>>();
    let phrase_prefix_pattern = format!("{search}%");
    let first_term_prefix_pattern = search_terms
        .first()
        .map(|term| format!("{term}%"))
        .unwrap_or_default();

    let mut query_builder = QueryBuilder::<Sqlite>::new(
        r#"
        SELECT
          id,
          national_id,
          civility,
          first_name,
          last_name,
          profession_code,
          profession_label,
          category_code,
          category_label,
          specialties,
          specialty_codes,
          practice_modes,
          practice_locations,
          phone_numbers,
          emails,
          source,
          source_updated_at,
          created_at,
          updated_at
        FROM doctors
        WHERE source =
        "#,
    );
    query_builder.push_bind(ANS_RPPS_SOURCE);

    if !specialty.is_empty() {
        query_builder.push(" AND specialty_search_text LIKE ");
        query_builder.push_bind(format!("%{specialty}%"));
    }

    if search.len() >= MIN_SEARCH_LENGTH {
        for term in &search_terms {
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
              last_name COLLATE NOCASE,
              first_name COLLATE NOCASE
            LIMIT "#,
        );
    } else {
        query_builder.push(
            r#"
            ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
            LIMIT "#,
        );
    }
    query_builder.push_bind(limit);

    let doctors = query_builder
        .build_query_as::<Doctor>()
        .fetch_all(&state.pool)
        .await?
        .into_iter()
        .filter(|doctor| doctor_matches_allowed_search(doctor, &search_terms, &specialty))
        .collect::<Vec<_>>();

    Ok(Json(doctors))
}

async fn list_patient_doctors(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<PatientId>,
    Query(params): Query<ListPatientDoctorsQuery>,
) -> ApiResult<Json<Vec<PatientDoctorFollowup>>> {
    require_patient_read_scope(&state, patient_id, &current_account).await?;
    let specialty = normalize_search(params.specialty.unwrap_or_default());
    let mut query_builder = patient_doctor_followup_query();

    query_builder.push(" WHERE f.patient_id = ");
    query_builder.push_bind(patient_id);

    if !specialty.is_empty() {
        query_builder.push(" AND f.specialty_search_text LIKE ");
        query_builder.push_bind(format!("%{specialty}%"));
    }

    query_builder.push(
        r#"
        ORDER BY
          CASE WHEN f.end_date IS NULL THEN 0 ELSE 1 END,
          f.start_date DESC,
          d.last_name COLLATE NOCASE,
          d.first_name COLLATE NOCASE
        "#,
    );

    let followups = query_builder
        .build_query_as::<PatientDoctorFollowup>()
        .fetch_all(&state.pool)
        .await?;

    Ok(Json(followups))
}

async fn add_patient_doctor(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<PatientId>,
    ApiJson(payload): ApiJson<SavePatientDoctorFollowupRequest>,
) -> ApiResult<Json<PatientDoctorFollowup>> {
    require_patient_scope(&state, patient_id, &current_account).await?;
    let payload = payload.normalized()?;
    ensure_doctor_exists(&state, &payload.doctor_id).await?;

    let followup_id = Uuid::new_v4().to_string();
    let result = sqlx::query(
        r#"
        INSERT INTO patient_doctor_followups (
          id,
          patient_id,
          doctor_id,
          specialty,
          specialty_search_text,
          start_date,
          end_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&followup_id)
    .bind(patient_id)
    .bind(&payload.doctor_id)
    .bind(&payload.specialty)
    .bind(normalize_search(&payload.specialty))
    .bind(&payload.start_date)
    .bind(&payload.end_date)
    .execute(&state.pool)
    .await;

    if let Err(error) = result {
        if is_unique_constraint(&error) {
            return Err(ApiError::conflict("Ce suivi medecin existe deja"));
        }

        return Err(ApiError::from(error));
    }

    let followup = fetch_patient_doctor_followup(&state, patient_id, &followup_id).await?;

    publish_change(
        &state,
        "patientDoctorFollowup",
        "created",
        followup.id.clone(),
        Some(patient_id.to_string()),
        ["patient", "doctors"],
        &followup,
    );

    Ok(Json(followup))
}

async fn update_patient_doctor(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path((patient_id, id)): Path<(PatientId, String)>,
    ApiJson(payload): ApiJson<SavePatientDoctorFollowupRequest>,
) -> ApiResult<Json<PatientDoctorFollowup>> {
    require_patient_scope(&state, patient_id, &current_account).await?;
    let payload = payload.normalized()?;
    ensure_doctor_exists(&state, &payload.doctor_id).await?;

    let result = sqlx::query(
        r#"
        UPDATE patient_doctor_followups
        SET doctor_id = ?,
            specialty = ?,
            specialty_search_text = ?,
            start_date = ?,
            end_date = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND patient_id = ?
        "#,
    )
    .bind(&payload.doctor_id)
    .bind(&payload.specialty)
    .bind(normalize_search(&payload.specialty))
    .bind(&payload.start_date)
    .bind(&payload.end_date)
    .bind(&id)
    .bind(patient_id)
    .execute(&state.pool)
    .await;

    if let Err(error) = result {
        if is_unique_constraint(&error) {
            return Err(ApiError::conflict("Ce suivi medecin existe deja"));
        }

        return Err(ApiError::from(error));
    }

    let followup = fetch_patient_doctor_followup(&state, patient_id, &id).await?;

    publish_change(
        &state,
        "patientDoctorFollowup",
        "updated",
        followup.id.clone(),
        Some(patient_id.to_string()),
        ["patient", "doctors"],
        &followup,
    );

    Ok(Json(followup))
}

async fn delete_patient_doctor(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path((patient_id, id)): Path<(PatientId, String)>,
) -> ApiResult<Json<PatientDoctorFollowup>> {
    require_patient_scope(&state, patient_id, &current_account).await?;
    let followup = fetch_patient_doctor_followup(&state, patient_id, &id).await?;

    sqlx::query(
        r#"
        DELETE FROM patient_doctor_followups
        WHERE id = ? AND patient_id = ?
        "#,
    )
    .bind(&id)
    .bind(patient_id)
    .execute(&state.pool)
    .await?;

    publish_change(
        &state,
        "patientDoctorFollowup",
        "deleted",
        followup.id.clone(),
        Some(patient_id.to_string()),
        ["patient", "doctors"],
        &followup,
    );

    Ok(Json(followup))
}

impl SavePatientDoctorFollowupRequest {
    fn normalized(self) -> ApiResult<Self> {
        let doctor_id = self.doctor_id.trim().to_string();
        let specialty = self.specialty.trim().to_string();
        let start_date = self.start_date.trim().to_string();
        let end_date = self
            .end_date
            .and_then(|value| normalize_optional(value.trim().to_string()));

        require_non_empty(&doctor_id, "doctorId")?;
        require_non_empty(&specialty, "specialty")?;
        require_non_empty(&start_date, "startDate")?;

        if let Some(end_date) = end_date.as_deref() {
            if end_date < start_date.as_str() {
                return Err(ApiError::bad_request(
                    "La date de fin doit etre posterieure a la date de debut",
                ));
            }
        }

        Ok(Self {
            doctor_id,
            specialty,
            start_date,
            end_date,
        })
    }
}

async fn ensure_doctor_exists(state: &AppState, doctor_id: &str) -> ApiResult<()> {
    let exists: (i64,) = sqlx::query_as("SELECT COUNT(1) FROM doctors WHERE id = ?")
        .bind(doctor_id)
        .fetch_one(&state.pool)
        .await?;

    if exists.0 == 0 {
        return Err(ApiError::not_found("Medecin introuvable"));
    }

    Ok(())
}

async fn fetch_patient_doctor_followup(
    state: &AppState,
    patient_id: PatientId,
    id: &str,
) -> ApiResult<PatientDoctorFollowup> {
    let mut query_builder = patient_doctor_followup_query();
    query_builder.push(" WHERE f.patient_id = ");
    query_builder.push_bind(patient_id);
    query_builder.push(" AND f.id = ");
    query_builder.push_bind(id.to_string());

    query_builder
        .build_query_as::<PatientDoctorFollowup>()
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Suivi medecin introuvable"))
}

fn patient_doctor_followup_query() -> QueryBuilder<'static, Sqlite> {
    QueryBuilder::<Sqlite>::new(
        r#"
        SELECT
          f.id,
          f.patient_id,
          f.doctor_id,
          d.national_id AS doctor_national_id,
          d.civility AS doctor_civility,
          d.first_name AS doctor_first_name,
          d.last_name AS doctor_last_name,
          d.profession_label AS doctor_profession_label,
          d.specialties AS doctor_specialties,
          d.practice_locations AS doctor_practice_locations,
          d.phone_numbers AS doctor_phone_numbers,
          d.emails AS doctor_emails,
          f.specialty,
          f.start_date,
          f.end_date,
          f.created_at,
          f.updated_at
        FROM patient_doctor_followups f
        JOIN doctors d ON d.id = f.doctor_id
        "#,
    )
}

fn doctor_matches_allowed_search(
    doctor: &Doctor,
    search_terms: &[String],
    specialty: &str,
) -> bool {
    let searchable = normalize_search(format!(
        "{} {} {}",
        doctor.first_name, doctor.last_name, doctor.specialties
    ));
    let specialty_search = normalize_search(&doctor.specialties);

    (specialty.is_empty() || specialty_search.contains(specialty))
        && search_terms
            .iter()
            .all(|term| search_text_matches_term(&searchable, term))
}

fn search_text_matches_term(searchable: &str, term: &str) -> bool {
    searchable.starts_with(term) || searchable.contains(&format!(" {term}"))
}

fn normalize_optional(value: String) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}
