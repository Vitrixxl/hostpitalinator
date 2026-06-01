use axum::{
    extract::{Path, State},
    routing::{get, patch},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiResult},
    modules::{
        auth::CurrentAccount, medicines::find_commercialized_medicine_name,
        patients::require_patient_scope,
    },
    realtime::publish_change,
    state::AppState,
    validation::require_non_empty,
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Prescription {
    id: String,
    patient_id: String,
    medicine_id: Option<String>,
    medication: String,
    dosage: String,
    frequency: String,
    route: String,
    start_date: String,
    end_date: Option<String>,
    prescriber: String,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddPrescriptionRequest {
    medicine_id: String,
    dosage: String,
    frequency: String,
    route: String,
    start_date: String,
    end_date: Option<String>,
    status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePrescriptionStatusRequest {
    status: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/patients/{patient_id}/prescriptions",
            get(list_prescriptions).post(add_prescription),
        )
        .route(
            "/prescriptions/{id}/status",
            patch(update_prescription_status),
        )
}

async fn list_prescriptions(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Vec<Prescription>>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;

    let prescriptions = sqlx::query_as::<_, Prescription>(
        "SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY start_date DESC, created_at DESC",
    )
    .bind(patient_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(prescriptions))
}

async fn add_prescription(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(patient_id): Path<String>,
    Json(payload): Json<AddPrescriptionRequest>,
) -> ApiResult<Json<Prescription>> {
    require_patient_scope(&state, &patient_id, &current_account).await?;
    payload.validate()?;
    let prescriber = current_account.name.trim();
    require_non_empty(prescriber, "prescriber")?;
    let medicine_id = payload.medicine_id.trim();
    let medication = find_commercialized_medicine_name(&state, medicine_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Medicine not found"))?;

    let prescription = sqlx::query_as::<_, Prescription>(
        r#"
        INSERT INTO prescriptions (
          id, patient_id, medicine_id, medication, dosage, frequency, route, start_date, end_date, prescriber, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(patient_id.clone())
    .bind(medicine_id)
    .bind(medication)
    .bind(payload.dosage.trim())
    .bind(payload.frequency.trim())
    .bind(payload.route.trim())
    .bind(payload.start_date.trim())
    .bind(payload.end_date.map(trim_optional))
    .bind(prescriber)
    .bind(payload.status.trim())
    .fetch_one(&state.pool)
    .await?;

    publish_change(
        &state,
        "prescription",
        "created",
        prescription.id.clone(),
        Some(patient_id),
        ["patient", "prescriptions"],
        &prescription,
    );

    Ok(Json(prescription))
}

async fn update_prescription_status(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
    Json(payload): Json<UpdatePrescriptionStatusRequest>,
) -> ApiResult<Json<Prescription>> {
    require_non_empty(&payload.status, "status")?;

    let patient_id: (String,) = sqlx::query_as("SELECT patient_id FROM prescriptions WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Prescription not found"))?;
    require_patient_scope(&state, &patient_id.0, &current_account).await?;

    let prescription = sqlx::query_as::<_, Prescription>(
        r#"
        UPDATE prescriptions
        SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(payload.status.trim())
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Prescription not found"))?;

    publish_change(
        &state,
        "prescription",
        "statusUpdated",
        prescription.id.clone(),
        Some(prescription.patient_id.clone()),
        ["patient", "prescriptions"],
        &prescription,
    );

    Ok(Json(prescription))
}

impl AddPrescriptionRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.medicine_id, "medicineId")?;
        require_non_empty(&self.dosage, "dosage")?;
        require_non_empty(&self.frequency, "frequency")?;
        require_non_empty(&self.route, "route")?;
        require_non_empty(&self.start_date, "startDate")?;
        require_non_empty(&self.status, "status")?;
        Ok(())
    }
}

fn trim_optional(value: String) -> String {
    value.trim().to_string()
}
