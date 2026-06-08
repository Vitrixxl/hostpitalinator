use axum::{
    extract::{Path, State},
    routing::{get, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiJson, ApiResult},
    modules::{
        auth::CurrentAccount,
        patients::{require_patient_read_scope, require_patient_scope, Patient, PatientId},
    },
    realtime::publish_change,
    state::AppState,
    validation::{require_non_empty, require_positive_f64, require_positive_i64},
};

const VITAL_RECORD_EDIT_WINDOW_SECONDS: i64 = 30 * 60;
const VITAL_RECORD_EDIT_WINDOW_EXPIRED_MESSAGE: &str =
    "Les constantes ne sont modifiables que pendant 30 minutes apres leur creation";

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct VitalRecord {
    id: String,
    patient_id: PatientId,
    recorded_at: String,
    temperature: f64,
    heart_rate: i64,
    systolic_blood_pressure: i64,
    diastolic_blood_pressure: i64,
    oxygen_saturation: f64,
    blood_glucose: Option<f64>,
    oxygen_therapy: bool,
    oxygen_flow_liters: Option<f64>,
    weight: f64,
    height: Option<f64>,
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
    blood_glucose: Option<f64>,
    #[serde(default)]
    oxygen_therapy: bool,
    oxygen_flow_liters: Option<f64>,
    weight: f64,
    height: Option<f64>,
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
    Path(patient_id): Path<PatientId>,
) -> ApiResult<Json<Vec<VitalRecord>>> {
    require_patient_read_scope(&state, patient_id, &current_account).await?;

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
    Path(patient_id): Path<PatientId>,
) -> ApiResult<Json<Option<VitalRecord>>> {
    require_patient_read_scope(&state, patient_id, &current_account).await?;

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
    Path(patient_id): Path<PatientId>,
    ApiJson(payload): ApiJson<AddVitalRecordRequest>,
) -> ApiResult<Json<VitalRecord>> {
    require_patient_scope(&state, patient_id, &current_account).await?;
    payload.validate()?;
    let oxygen_flow_liters = payload.normalized_oxygen_flow_liters();

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
          blood_glucose,
          oxygen_therapy,
          oxygen_flow_liters,
          weight,
          height,
          diuresis,
          last_stool_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(patient_id)
    .bind(payload.recorded_at.trim())
    .bind(payload.temperature)
    .bind(payload.heart_rate)
    .bind(payload.systolic_blood_pressure)
    .bind(payload.diastolic_blood_pressure)
    .bind(payload.oxygen_saturation)
    .bind(payload.blood_glucose)
    .bind(payload.oxygen_therapy)
    .bind(oxygen_flow_liters)
    .bind(payload.weight)
    .bind(payload.height)
    .bind(payload.diuresis)
    .bind(payload.last_stool_date.trim())
    .fetch_one(&state.pool)
    .await?;

    let synced_patient = sync_patient_measurements_from_latest_vital(&state, patient_id).await?;

    publish_change(
        &state,
        "vitalRecord",
        "created",
        record.id.clone(),
        Some(patient_id.to_string()),
        ["patient", "vitals"],
        &record,
    );
    publish_synced_patient(&state, synced_patient);

    Ok(Json(record))
}

async fn update_vital_record(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path((patient_id, id)): Path<(PatientId, String)>,
    ApiJson(payload): ApiJson<AddVitalRecordRequest>,
) -> ApiResult<Json<VitalRecord>> {
    require_patient_scope(&state, patient_id, &current_account).await?;
    require_vital_record_editable(&state, patient_id, &id).await?;
    payload.validate()?;
    let oxygen_flow_liters = payload.normalized_oxygen_flow_liters();

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
          blood_glucose = ?,
          oxygen_therapy = ?,
          oxygen_flow_liters = ?,
          weight = ?,
          height = ?,
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
    .bind(payload.blood_glucose)
    .bind(payload.oxygen_therapy)
    .bind(oxygen_flow_liters)
    .bind(payload.weight)
    .bind(payload.height)
    .bind(payload.diuresis)
    .bind(payload.last_stool_date.trim())
    .bind(id)
    .bind(patient_id)
    .fetch_one(&state.pool)
    .await?;

    let synced_patient = sync_patient_measurements_from_latest_vital(&state, patient_id).await?;

    publish_change(
        &state,
        "vitalRecord",
        "updated",
        record.id.clone(),
        Some(patient_id.to_string()),
        ["patient", "vitals"],
        &record,
    );
    publish_synced_patient(&state, synced_patient);

    Ok(Json(record))
}

async fn require_vital_record_editable(
    state: &AppState,
    patient_id: PatientId,
    id: &str,
) -> ApiResult<()> {
    let is_editable = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT CASE
          WHEN strftime('%s', created_at) IS NOT NULL
           AND CAST(strftime('%s', 'now') AS INTEGER)
             - CAST(strftime('%s', created_at) AS INTEGER) <= ?
          THEN 1
          ELSE 0
        END
        FROM vital_records
        WHERE id = ? AND patient_id = ?
        "#,
    )
    .bind(VITAL_RECORD_EDIT_WINDOW_SECONDS)
    .bind(id)
    .bind(patient_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Ressource introuvable"))?;

    if is_editable == 1 {
        return Ok(());
    }

    Err(ApiError::forbidden(
        VITAL_RECORD_EDIT_WINDOW_EXPIRED_MESSAGE,
    ))
}

async fn delete_vital_record(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path((patient_id, id)): Path<(PatientId, String)>,
) -> ApiResult<Json<VitalRecord>> {
    require_patient_scope(&state, patient_id, &current_account).await?;

    let record = sqlx::query_as::<_, VitalRecord>(
        r#"
        DELETE FROM vital_records
        WHERE id = ? AND patient_id = ?
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(patient_id)
    .fetch_one(&state.pool)
    .await?;

    let synced_patient = sync_patient_measurements_from_latest_vital(&state, patient_id).await?;

    publish_change(
        &state,
        "vitalRecord",
        "deleted",
        record.id.clone(),
        Some(patient_id.to_string()),
        ["patient", "vitals"],
        &record,
    );
    publish_synced_patient(&state, synced_patient);

    Ok(Json(record))
}

async fn sync_patient_measurements_from_latest_vital(
    state: &AppState,
    patient_id: PatientId,
) -> ApiResult<Option<Patient>> {
    let latest_measurement = sqlx::query_as::<_, (f64, Option<f64>)>(
        r#"
        SELECT weight, height
        FROM vital_records
        WHERE patient_id = ?
        ORDER BY recorded_at DESC, created_at DESC
        LIMIT 1
        "#,
    )
    .bind(patient_id)
    .fetch_optional(&state.pool)
    .await?;

    let Some((weight, height)) = latest_measurement else {
        return Ok(None);
    };

    let patient = sqlx::query_as::<_, Patient>(
        r#"
        UPDATE patients
        SET weight = ?,
            height = COALESCE(?, height),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(weight)
    .bind(height)
    .bind(patient_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Some(patient))
}

fn publish_synced_patient(state: &AppState, patient: Option<Patient>) {
    let Some(patient) = patient else {
        return;
    };

    publish_change(
        state,
        "patient",
        "updated",
        patient.id.to_string(),
        Some(patient.id.to_string()),
        ["patients", "patient"],
        &patient,
    );
}

impl AddVitalRecordRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.recorded_at, "recordedAt")?;
        require_positive_f64(self.temperature, "temperature")?;
        require_positive_i64(self.heart_rate, "heartRate")?;
        require_positive_i64(self.systolic_blood_pressure, "systolicBloodPressure")?;
        require_positive_i64(self.diastolic_blood_pressure, "diastolicBloodPressure")?;
        require_positive_f64(self.oxygen_saturation, "oxygenSaturation")?;
        if let Some(blood_glucose) = self.blood_glucose {
            require_positive_f64(blood_glucose, "bloodGlucose")?;
        }
        if self.oxygen_therapy && self.oxygen_flow_liters.is_none() {
            return Err(crate::error::ApiError::bad_request(
                "Le debit d'oxygene est obligatoire".to_string(),
            ));
        }
        if let Some(oxygen_flow_liters) = self.oxygen_flow_liters {
            require_positive_f64(oxygen_flow_liters, "oxygenFlowLiters")?;
        }
        require_positive_f64(self.weight, "weight")?;
        if let Some(height) = self.height {
            require_positive_f64(height, "height")?;
        }
        require_non_empty(&self.last_stool_date, "lastStoolDate")?;

        if let Some(diuresis) = self.diuresis {
            require_positive_f64(diuresis, "diuresis")?;
        }

        Ok(())
    }

    fn normalized_oxygen_flow_liters(&self) -> Option<f64> {
        self.oxygen_therapy
            .then_some(self.oxygen_flow_liters)
            .flatten()
    }
}
