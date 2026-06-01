use axum::{
    extract::{Path, State},
    routing::{get, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{is_unique_constraint, ApiError, ApiResult},
    modules::{
        auth::{require_admin, CurrentAccount},
        services,
    },
    realtime::publish_change,
    state::AppState,
    validation::{require_non_empty, require_positive_i64},
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Bed {
    id: String,
    label: String,
    service: String,
    sort_order: i64,
    occupied_patient_id: Option<String>,
    occupied_patient_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBedRequest {
    label: String,
    service: String,
    sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBedRequest {
    label: Option<String>,
    service: Option<String>,
    sort_order: Option<i64>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/beds", get(list_beds).post(create_bed))
        .route("/beds/{id}", put(update_bed).delete(delete_bed))
}

async fn list_beds(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
) -> ApiResult<Json<Vec<Bed>>> {
    let beds = if current_account.role == "admin" {
        sqlx::query_as::<_, Bed>(LIST_BEDS_SQL)
            .fetch_all(&state.pool)
            .await?
    } else {
        sqlx::query_as::<_, Bed>(
            r#"
            SELECT
              b.id,
              b.label,
              b.service,
              b.sort_order,
              p.id AS occupied_patient_id,
              CASE
                WHEN p.id IS NULL THEN NULL
                ELSE p.last_name || ' ' || p.first_name
              END AS occupied_patient_name
            FROM beds b
            LEFT JOIN patients p
              ON p.bed_id = b.id
             AND p.archived_at IS NULL
            WHERE b.service = ?
            ORDER BY b.sort_order ASC, b.label ASC
            "#,
        )
        .bind(&current_account.service)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(beds))
}

async fn create_bed(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Json(payload): Json<CreateBedRequest>,
) -> ApiResult<Json<Bed>> {
    require_admin(&current_account)?;
    payload.validate()?;
    let service = services::canonical_service_name(&state, &payload.service).await?;

    let bed = sqlx::query_as::<_, Bed>(
        r#"
        INSERT INTO beds (id, label, service, sort_order)
        VALUES (?, ?, ?, ?)
        RETURNING
          id,
          label,
          service,
          sort_order,
          NULL AS occupied_patient_id,
          NULL AS occupied_patient_name
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(payload.label.trim())
    .bind(service)
    .bind(payload.sort_order.unwrap_or(0))
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("A bed with this label already exists")
        } else {
            ApiError::from(error)
        }
    })?;

    publish_change(
        &state,
        "bed",
        "created",
        bed.id.clone(),
        None,
        ["admin", "beds"],
        &bed,
    );

    Ok(Json(bed))
}

async fn update_bed(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateBedRequest>,
) -> ApiResult<Json<Bed>> {
    require_admin(&current_account)?;
    payload.validate()?;

    let current = fetch_bed(&state, &id).await?;
    let label = payload.label.unwrap_or(current.label);
    let service = if let Some(service) = payload.service {
        services::canonical_service_name(&state, &service).await?
    } else {
        current.service
    };
    let sort_order = payload.sort_order.unwrap_or(current.sort_order);

    ensure_occupied_bed_can_move(&state, &id, &service).await?;

    let bed = sqlx::query_as::<_, Bed>(
        r#"
        UPDATE beds
        SET label = ?, service = ?, sort_order = ?
        WHERE id = ?
        RETURNING
          id,
          label,
          service,
          sort_order,
          (
            SELECT patients.id
            FROM patients
            WHERE patients.bed_id = beds.id
              AND patients.archived_at IS NULL
            LIMIT 1
          ) AS occupied_patient_id,
          (
            SELECT patients.last_name || ' ' || patients.first_name
            FROM patients
            WHERE patients.bed_id = beds.id
              AND patients.archived_at IS NULL
            LIMIT 1
          ) AS occupied_patient_name
        "#,
    )
    .bind(label.trim())
    .bind(service)
    .bind(sort_order)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("A bed with this label already exists")
        } else {
            ApiError::from(error)
        }
    })?;

    publish_change(
        &state,
        "bed",
        "updated",
        bed.id.clone(),
        None,
        ["admin", "beds"],
        &bed,
    );

    Ok(Json(bed))
}

async fn delete_bed(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<Bed>> {
    require_admin(&current_account)?;
    let bed = fetch_bed(&state, &id).await?;

    if bed.occupied_patient_id.is_some() {
        return Err(ApiError::conflict("Bed is currently assigned"));
    }

    sqlx::query("DELETE FROM beds WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await?;

    publish_change(
        &state,
        "bed",
        "deleted",
        bed.id.clone(),
        None,
        ["admin", "beds"],
        &bed,
    );

    Ok(Json(bed))
}

const LIST_BEDS_SQL: &str = r#"
SELECT
  b.id,
  b.label,
  b.service,
  b.sort_order,
  p.id AS occupied_patient_id,
  CASE
    WHEN p.id IS NULL THEN NULL
    ELSE p.last_name || ' ' || p.first_name
  END AS occupied_patient_name
FROM beds b
LEFT JOIN patients p
  ON p.bed_id = b.id
 AND p.archived_at IS NULL
ORDER BY b.sort_order ASC, b.label ASC
"#;

async fn fetch_bed(state: &AppState, id: &str) -> ApiResult<Bed> {
    sqlx::query_as::<_, Bed>(
        r#"
        SELECT *
        FROM (
          SELECT
            b.id,
            b.label,
            b.service,
            b.sort_order,
            p.id AS occupied_patient_id,
            CASE
              WHEN p.id IS NULL THEN NULL
              ELSE p.last_name || ' ' || p.first_name
            END AS occupied_patient_name
          FROM beds b
          LEFT JOIN patients p
            ON p.bed_id = b.id
           AND p.archived_at IS NULL
        )
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Bed not found"))
}

async fn ensure_occupied_bed_can_move(
    state: &AppState,
    bed_id: &str,
    service: &str,
) -> ApiResult<()> {
    let patient: Option<(String,)> = sqlx::query_as(
        r#"
        SELECT id
        FROM patients
        WHERE bed_id = ?
          AND archived_at IS NULL
          AND current_service != ?
        LIMIT 1
        "#,
    )
    .bind(bed_id)
    .bind(service)
    .fetch_optional(&state.pool)
    .await?;

    if patient.is_some() {
        return Err(ApiError::conflict(
            "Occupied bed service must match patient service",
        ));
    }

    Ok(())
}

impl CreateBedRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.label, "label")?;
        require_non_empty(&self.service, "service")?;

        if let Some(sort_order) = self.sort_order {
            require_positive_i64(sort_order, "sortOrder")?;
        }

        Ok(())
    }
}

impl UpdateBedRequest {
    fn validate(&self) -> ApiResult<()> {
        if let Some(label) = &self.label {
            require_non_empty(label, "label")?;
        }

        if let Some(service) = &self.service {
            require_non_empty(service, "service")?;
        }

        if let Some(sort_order) = self.sort_order {
            require_positive_i64(sort_order, "sortOrder")?;
        }

        Ok(())
    }
}
