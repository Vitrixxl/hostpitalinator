use axum::{
    extract::{Path, State},
    routing::{get, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::ApiResult,
    modules::{auth::CurrentAccount, patients::require_patient_scope},
    realtime::publish_change,
    state::AppState,
    validation::{require_non_empty, require_positive_f64, require_positive_i64},
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct VitalRecord {
    id: String,
    patient_id: String,
    recorded_at: String,
    temperature: f64,
    heart_rate: i64,
    systolic_blood_pressure: i64,
    diastolic_blood_pressure: i64,
    oxygen_saturation: f64,
    weight: f64,
    diuresis: Option<f64>,
    last_stool_date: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddVitalRecordRequest {
    recorded_at: String,
    temperature: f64,
    heart_rate: i64,
    systolic_blood_pressure: i64,
    diastolic_blood_pressure: i64,
    oxygen_saturation: f64,
    weight: f64,
    diuresis: Option<f64>,
    last_stool_date: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/patients/{patient_id}/vitals",
            get(list_vital_records).post(add_vital_record),
        )
        .route(
            "/patients/{patient_id}/vitals/{id}",
            put(update_vital_record).delete(delete_vital_record),
        )
        .route(
            "/patients/{patient_id}/vitals/latest",
            get(get_latest_vital_record),
        )
}

async fn list_vital_records(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Vec<VitalRecord>>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;

    let records = sqlx::query_as::<_, VitalRecord>(
        "SELECT * FROM vital_records WHERE patient_id = ? ORDER BY recorded_at DESC, created_at DESC",
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(records))
}

async fn get_latest_vital_record(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Option<VitalRecord>>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;

    let record = sqlx::query_as::<_, VitalRecord>(
        "SELECT * FROM vital_records WHERE patient_id = ? ORDER BY recorded_at DESC, created_at DESC LIMIT 1",
    )
    .bind(patient_id)
    .fetch_optional(&state.pool)
    .await?;

    Ok(Json(record))
}

async fn add_vital_record(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
    Json(payload): Json<AddVitalRecordRequest>,
) -> ApiResult<Json<VitalRecord>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;
    payload.validate()?;

    let record = sqlx::query_as::<_, VitalRecord>(
        r#"
        INSERT INTO vital_records (
          id,
          patient_id,
          recorded_at,
          temperature,
          heart_rate,
          systolic_blood_pressure,
          diastolic_blood_pressure,
          oxygen_saturation,
          weight,
          diuresis,
          last_stool_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(patient_id.clone())
    .bind(payload.recorded_at.trim())
    .bind(payload.temperature)
    .bind(payload.heart_rate)
    .bind(payload.systolic_blood_pressure)
    .bind(payload.diastolic_blood_pressure)
    .bind(payload.oxygen_saturation)
    .bind(payload.weight)
    .bind(payload.diuresis)
    .bind(payload.last_stool_date.trim())
    .fetch_one(&state.pool)
    .await?;

    publish_change(
        &state,
        "vitalRecord",
        "created",
        record.id.clone(),
        Some(patient_id),
        ["patient", "vitals"],
        &record,
    );

    Ok(Json(record))
}

async fn update_vital_record(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path((patient_id, id)): Path<(String, String)>,
    Json(payload): Json<AddVitalRecordRequest>,
) -> ApiResult<Json<VitalRecord>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;
    payload.validate()?;

    let record = sqlx::query_as::<_, VitalRecord>(
        r#"
        UPDATE vital_records
        SET
          recorded_at = ?,
          temperature = ?,
          heart_rate = ?,
          systolic_blood_pressure = ?,
          diastolic_blood_pressure = ?,
          oxygen_saturation = ?,
          weight = ?,
          diuresis = ?,
          last_stool_date = ?
        WHERE id = ? AND patient_id = ?
        RETURNING *
        "#,
    )
    .bind(payload.recorded_at.trim())
    .bind(payload.temperature)
    .bind(payload.heart_rate)
    .bind(payload.systolic_blood_pressure)
    .bind(payload.diastolic_blood_pressure)
    .bind(payload.oxygen_saturation)
    .bind(payload.weight)
    .bind(payload.diuresis)
    .bind(payload.last_stool_date.trim())
    .bind(id)
    .bind(patient_id.clone())
    .fetch_one(&state.pool)
    .await?;

    publish_change(
        &state,
        "vitalRecord",
        "updated",
        record.id.clone(),
        Some(patient_id),
        ["patient", "vitals"],
        &record,
    );

    Ok(Json(record))
}

async fn delete_vital_record(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path((patient_id, id)): Path<(String, String)>,
) -> ApiResult<Json<VitalRecord>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;

    let record = sqlx::query_as::<_, VitalRecord>(
        r#"
        DELETE FROM vital_records
        WHERE id = ? AND patient_id = ?
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(patient_id.clone())
    .fetch_one(&state.pool)
    .await?;

    publish_change(
        &state,
        "vitalRecord",
        "deleted",
        record.id.clone(),
        Some(patient_id),
        ["patient", "vitals"],
        &record,
    );

    Ok(Json(record))
}

impl AddVitalRecordRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.recorded_at, "recordedAt")?;
        require_positive_f64(self.temperature, "temperature")?;
        require_positive_i64(self.heart_rate, "heartRate")?;
        require_positive_i64(self.systolic_blood_pressure, "systolicBloodPressure")?;
        require_positive_i64(self.diastolic_blood_pressure, "diastolicBloodPressure")?;
        require_positive_f64(self.oxygen_saturation, "oxygenSaturation")?;
        require_positive_f64(self.weight, "weight")?;
        require_non_empty(&self.last_stool_date, "lastStoolDate")?;

        if let Some(diuresis) = self.diuresis {
            require_positive_f64(diuresis, "diuresis")?;
        }

        Ok(())
    }
}
