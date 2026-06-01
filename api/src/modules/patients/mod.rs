use axum::{
    extract::{Path, Query, State},
    routing::{get, patch},
    Extension, Json, Router,
};
use serde::{Deserialize, Deserializer, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiResult},
    modules::{
        auth::{require_service_scope, CurrentAccount},
        services,
    },
    realtime::publish_change,
    state::AppState,
    validation::{require_non_empty, require_one_of},
};

const PATIENT_SEXES: &[&str] = &["female", "male", "other", "unknown"];

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Patient {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub birth_date: String,
    pub sex: Option<String>,
    pub address: Option<String>,
    pub phone_number: Option<String>,
    pub email: Option<String>,
    pub administrative_info: Option<String>,
    pub current_service: String,
    pub bed_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePatientRequest {
    first_name: String,
    last_name: String,
    birth_date: String,
    sex: Option<String>,
    address: Option<String>,
    phone_number: Option<String>,
    email: Option<String>,
    administrative_info: Option<String>,
    current_service: Option<String>,
    bed_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePatientRequest {
    first_name: Option<String>,
    last_name: Option<String>,
    birth_date: Option<String>,
    #[serde(default, deserialize_with = "deserialize_nullable_string_field")]
    sex: NullableStringField,
    #[serde(default, deserialize_with = "deserialize_nullable_string_field")]
    address: NullableStringField,
    #[serde(default, deserialize_with = "deserialize_nullable_string_field")]
    phone_number: NullableStringField,
    #[serde(default, deserialize_with = "deserialize_nullable_string_field")]
    email: NullableStringField,
    #[serde(default, deserialize_with = "deserialize_nullable_string_field")]
    administrative_info: NullableStringField,
    current_service: Option<String>,
    #[serde(default, deserialize_with = "deserialize_nullable_string_field")]
    bed_id: NullableStringField,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPatientsQuery {
    include_archived: Option<bool>,
    q: Option<String>,
}

#[derive(Debug, Default)]
enum NullableStringField {
    #[default]
    Missing,
    Present(Option<String>),
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/patients", get(list_patients).post(create_patient))
        .route("/patients/{id}", get(get_patient).put(update_patient))
        .route("/patients/{id}/archive", patch(archive_patient))
}

async fn list_patients(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Query(query): Query<ListPatientsQuery>,
) -> ApiResult<Json<Vec<Patient>>> {
    let search = query.q.unwrap_or_default();
    let like_search = format!("%{}%", search.trim());
    let patients = if current_account.role == "admin" && query.include_archived.unwrap_or(false) {
        sqlx::query_as::<_, Patient>(
            r#"
            SELECT * FROM patients
            WHERE (? = '%%'
              OR first_name LIKE ?
              OR last_name LIKE ?
              OR email LIKE ?
              OR phone_number LIKE ?
              OR address LIKE ?)
            ORDER BY last_name ASC, first_name ASC
            "#,
        )
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .fetch_all(&state.pool)
        .await?
    } else if current_account.role == "admin" {
        sqlx::query_as::<_, Patient>(
            r#"
            SELECT * FROM patients
            WHERE archived_at IS NULL
              AND (? = '%%'
                OR first_name LIKE ?
                OR last_name LIKE ?
                OR email LIKE ?
                OR phone_number LIKE ?
                OR address LIKE ?)
            ORDER BY last_name ASC, first_name ASC
            "#,
        )
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .fetch_all(&state.pool)
        .await?
    } else if query.include_archived.unwrap_or(false) {
        sqlx::query_as::<_, Patient>(
            r#"
            SELECT * FROM patients
            WHERE current_service = ?
              AND (? = '%%'
                OR first_name LIKE ?
                OR last_name LIKE ?
                OR email LIKE ?
                OR phone_number LIKE ?
                OR address LIKE ?)
            ORDER BY last_name ASC, first_name ASC
            "#,
        )
        .bind(&current_account.service)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, Patient>(
            r#"
            SELECT * FROM patients
            WHERE current_service = ?
              AND archived_at IS NULL
              AND (? = '%%'
                OR first_name LIKE ?
                OR last_name LIKE ?
                OR email LIKE ?
                OR phone_number LIKE ?
                OR address LIKE ?)
            ORDER BY last_name ASC, first_name ASC
            "#,
        )
        .bind(&current_account.service)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .bind(&like_search)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(patients))
}

async fn get_patient(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<Patient>> {
    let patient = require_patient_scope(&state, &id, &current_account).await?;
    Ok(Json(patient))
}

async fn create_patient(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Json(payload): Json<CreatePatientRequest>,
) -> ApiResult<Json<Patient>> {
    payload.validate()?;

    let bed_id = payload.bed_id.and_then(normalize_optional);
    let sex = payload.sex.and_then(normalize_optional);
    let address = payload.address.and_then(normalize_optional);
    let phone_number = payload.phone_number.and_then(normalize_optional);
    let email = payload.email.and_then(normalize_optional);
    let bed_service = ensure_bed_assignable(&state, bed_id.as_deref(), None).await?;
    let current_service = resolve_patient_service(
        &state,
        &current_account,
        payload.current_service,
        bed_service.as_deref(),
    )
    .await?;
    ensure_bed_matches_service(bed_service.as_deref(), &current_service)?;

    let patient = sqlx::query_as::<_, Patient>(
        r#"
        INSERT INTO patients (
          id, first_name, last_name, birth_date, sex, address, phone_number, email,
          administrative_info, current_service, bed_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(payload.first_name.trim())
    .bind(payload.last_name.trim())
    .bind(payload.birth_date.trim())
    .bind(sex)
    .bind(address)
    .bind(phone_number)
    .bind(email)
    .bind(payload.administrative_info.map(trim_optional))
    .bind(current_service)
    .bind(bed_id)
    .fetch_one(&state.pool)
    .await?;

    publish_change(
        &state,
        "patient",
        "created",
        patient.id.clone(),
        Some(patient.id.clone()),
        ["patients", "patient"],
        &patient,
    );

    Ok(Json(patient))
}

async fn update_patient(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
    Json(payload): Json<UpdatePatientRequest>,
) -> ApiResult<Json<Patient>> {
    payload.validate()?;

    let current = require_patient_scope(&state, &id, &current_account).await?;
    let requested_service = payload.current_service;
    let requested_bed = payload.bed_id;
    let should_infer_service_from_bed =
        matches!(&requested_bed, NullableStringField::Present(Some(_)));
    let first_name = payload.first_name.unwrap_or(current.first_name);
    let last_name = payload.last_name.unwrap_or(current.last_name);
    let birth_date = payload.birth_date.unwrap_or(current.birth_date);
    let sex = merge_nullable_string_field(payload.sex, current.sex);
    let address = merge_nullable_string_field(payload.address, current.address);
    let phone_number = merge_nullable_string_field(payload.phone_number, current.phone_number);
    let email = merge_nullable_string_field(payload.email, current.email);
    let administrative_info =
        merge_nullable_string_field(payload.administrative_info, current.administrative_info);
    let bed_id = match requested_bed {
        NullableStringField::Present(Some(value)) => normalize_optional(value),
        NullableStringField::Present(None) => None,
        NullableStringField::Missing => current.bed_id,
    };
    let bed_service = ensure_bed_assignable(&state, bed_id.as_deref(), Some(&id)).await?;
    let service_fallback = if should_infer_service_from_bed {
        bed_service
            .as_deref()
            .unwrap_or(current.current_service.as_str())
    } else {
        current.current_service.as_str()
    };
    let current_service = resolve_patient_service(
        &state,
        &current_account,
        requested_service,
        Some(service_fallback),
    )
    .await?;
    ensure_bed_matches_service(bed_service.as_deref(), &current_service)?;

    let patient = sqlx::query_as::<_, Patient>(
        r#"
        UPDATE patients
        SET first_name = ?,
            last_name = ?,
            birth_date = ?,
            sex = ?,
            address = ?,
            phone_number = ?,
            email = ?,
            administrative_info = ?,
            current_service = ?,
            bed_id = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(first_name.trim())
    .bind(last_name.trim())
    .bind(birth_date.trim())
    .bind(sex)
    .bind(address)
    .bind(phone_number)
    .bind(email)
    .bind(administrative_info.map(trim_optional))
    .bind(current_service)
    .bind(bed_id)
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    publish_change(
        &state,
        "patient",
        "updated",
        patient.id.clone(),
        Some(patient.id.clone()),
        ["patients", "patient"],
        &patient,
    );

    Ok(Json(patient))
}

async fn archive_patient(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<Patient>> {
    require_patient_scope(&state, &id, &current_account).await?;

    let patient = sqlx::query_as::<_, Patient>(
        r#"
        UPDATE patients
        SET archived_at = COALESCE(archived_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            bed_id = NULL,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Patient not found"))?;

    publish_change(
        &state,
        "patient",
        "archived",
        patient.id.clone(),
        Some(patient.id.clone()),
        ["patients", "patient"],
        &patient,
    );

    Ok(Json(patient))
}

pub async fn patient_exists(state: &AppState, patient_id: &str) -> ApiResult<()> {
    let exists: (i64,) = sqlx::query_as("SELECT COUNT(1) FROM patients WHERE id = ?")
        .bind(patient_id)
        .fetch_one(&state.pool)
        .await?;

    if exists.0 == 0 {
        return Err(ApiError::not_found("Patient not found"));
    }

    Ok(())
}

pub async fn require_patient_scope(
    state: &AppState,
    patient_id: &str,
    account: &CurrentAccount,
) -> ApiResult<Patient> {
    let patient = fetch_patient(state, patient_id).await?;
    require_service_scope(account, &patient.current_service)?;
    Ok(patient)
}

async fn ensure_bed_assignable(
    state: &AppState,
    bed_id: Option<&str>,
    patient_id: Option<&str>,
) -> ApiResult<Option<String>> {
    let Some(bed_id) = bed_id else {
        return Ok(None);
    };

    let bed_service: Option<(String,)> = sqlx::query_as("SELECT service FROM beds WHERE id = ?")
        .bind(bed_id)
        .fetch_optional(&state.pool)
        .await?;

    let Some((bed_service,)) = bed_service else {
        return Err(ApiError::not_found("Bed not found"));
    };

    let occupied = if let Some(patient_id) = patient_id {
        sqlx::query_as::<_, (String,)>(
            r#"
            SELECT id
            FROM patients
            WHERE bed_id = ?
              AND archived_at IS NULL
              AND id != ?
            LIMIT 1
            "#,
        )
        .bind(bed_id)
        .bind(patient_id)
        .fetch_optional(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, (String,)>(
            r#"
            SELECT id
            FROM patients
            WHERE bed_id = ?
              AND archived_at IS NULL
            LIMIT 1
            "#,
        )
        .bind(bed_id)
        .fetch_optional(&state.pool)
        .await?
    };

    if occupied.is_some() {
        return Err(ApiError::conflict("Bed is already assigned"));
    }

    Ok(Some(bed_service))
}

async fn fetch_patient(state: &AppState, id: &str) -> ApiResult<Patient> {
    sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Patient not found"))
}

impl CreatePatientRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.first_name, "firstName")?;
        require_non_empty(&self.last_name, "lastName")?;
        require_non_empty(&self.birth_date, "birthDate")?;
        if let Some(sex) = &self.sex {
            validate_patient_sex(sex)?;
        }
        Ok(())
    }
}

impl UpdatePatientRequest {
    fn validate(&self) -> ApiResult<()> {
        if let Some(first_name) = &self.first_name {
            require_non_empty(first_name, "firstName")?;
        }
        if let Some(last_name) = &self.last_name {
            require_non_empty(last_name, "lastName")?;
        }
        if let Some(birth_date) = &self.birth_date {
            require_non_empty(birth_date, "birthDate")?;
        }
        if let NullableStringField::Present(Some(sex)) = &self.sex {
            validate_patient_sex(sex)?;
        }
        if let Some(current_service) = &self.current_service {
            require_non_empty(current_service, "currentService")?;
        }
        Ok(())
    }
}

fn trim_optional(value: String) -> String {
    value.trim().to_string()
}

fn merge_nullable_string_field(
    field: NullableStringField,
    current_value: Option<String>,
) -> Option<String> {
    match field {
        NullableStringField::Missing => current_value,
        NullableStringField::Present(Some(value)) => normalize_optional(value),
        NullableStringField::Present(None) => None,
    }
}

fn validate_patient_sex(value: &str) -> ApiResult<()> {
    let value = value.trim();

    if value.is_empty() {
        return Ok(());
    }

    require_one_of(value, "sex", PATIENT_SEXES)
}

fn deserialize_nullable_string_field<'de, D>(
    deserializer: D,
) -> Result<NullableStringField, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer).map(NullableStringField::Present)
}

fn normalize_optional(value: String) -> Option<String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

async fn resolve_patient_service(
    state: &AppState,
    account: &CurrentAccount,
    requested_service: Option<String>,
    fallback_service: Option<&str>,
) -> ApiResult<String> {
    let service = requested_service
        .and_then(normalize_optional)
        .or_else(|| fallback_service.map(ToString::to_string))
        .unwrap_or_else(|| account.service.clone());
    let service = services::canonical_service_name(state, &service).await?;

    require_service_scope(account, &service)?;
    Ok(service)
}

fn ensure_bed_matches_service(bed_service: Option<&str>, patient_service: &str) -> ApiResult<()> {
    if let Some(bed_service) = bed_service {
        if bed_service != patient_service {
            return Err(ApiError::bad_request(
                "Bed must belong to the patient service",
            ));
        }
    }

    Ok(())
}
