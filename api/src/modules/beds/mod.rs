use axum::{
    extract::{Path, Query, State},
    routing::{get, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{is_unique_constraint, ApiError, ApiJson, ApiResult},
    modules::{
        auth::{require_admin, CurrentAccount},
        patients::PatientId,
        rooms::{self, Room},
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
    room_id: String,
    room: String,
    service: String,
    sort_order: i64,
    occupied_patient_id: Option<PatientId>,
    occupied_patient_name: Option<String>,
    occupied_patient_sex: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListBedsQuery {
    service: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBedRequest {
    label: String,
    room_id: Option<String>,
    room: Option<String>,
    service: Option<String>,
    sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBedRequest {
    label: Option<String>,
    room_id: Option<String>,
    room: Option<String>,
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
    Query(query): Query<ListBedsQuery>,
) -> ApiResult<Json<Vec<Bed>>> {
    let service_filter = match query.service.as_deref() {
        Some(service) if !service.trim().is_empty() => {
            Some(services::canonical_service_name(&state, service).await?)
        }
        _ => None,
    };

    let beds = if let Some(service) = service_filter {
        sqlx::query_as::<_, Bed>(
            r#"
            SELECT
              b.id,
              b.label,
              b.room_id,
              COALESCE(r.label, b.room) AS room,
              COALESCE(r.service, b.service) AS service,
              b.sort_order,
              p.id AS occupied_patient_id,
              CASE
                WHEN p.id IS NULL THEN NULL
                ELSE p.last_name || ' ' || p.first_name
              END AS occupied_patient_name,
              p.sex AS occupied_patient_sex
            FROM beds b
            LEFT JOIN rooms r
              ON r.id = b.room_id
            LEFT JOIN patients p
              ON p.bed_id = b.id
             AND p.archived_at IS NULL
            WHERE COALESCE(r.service, b.service) = ?
            ORDER BY b.sort_order ASC, b.label ASC
            "#,
        )
        .bind(service)
        .fetch_all(&state.pool)
        .await?
    } else if current_account.role == "admin" {
        sqlx::query_as::<_, Bed>(LIST_BEDS_SQL)
            .fetch_all(&state.pool)
            .await?
    } else {
        sqlx::query_as::<_, Bed>(
            r#"
            SELECT
              b.id,
              b.label,
              b.room_id,
              COALESCE(r.label, b.room) AS room,
              COALESCE(r.service, b.service) AS service,
              b.sort_order,
              p.id AS occupied_patient_id,
              CASE
                WHEN p.id IS NULL THEN NULL
                ELSE p.last_name || ' ' || p.first_name
              END AS occupied_patient_name,
              p.sex AS occupied_patient_sex
            FROM beds b
            LEFT JOIN rooms r
              ON r.id = b.room_id
            LEFT JOIN patients p
              ON p.bed_id = b.id
             AND p.archived_at IS NULL
            WHERE COALESCE(r.service, b.service) = ?
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
    ApiJson(payload): ApiJson<CreateBedRequest>,
) -> ApiResult<Json<Bed>> {
    require_admin(&current_account)?;
    payload.validate()?;
    let room = resolve_create_room(&state, &payload).await?;

    let bed = sqlx::query_as::<_, Bed>(
        r#"
        INSERT INTO beds (id, label, room_id, room, service, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING
          id,
          label,
          room_id,
          room,
          service,
          sort_order,
          NULL AS occupied_patient_id,
          NULL AS occupied_patient_name,
          NULL AS occupied_patient_sex
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(payload.label.trim())
    .bind(&room.id)
    .bind(&room.label)
    .bind(&room.service)
    .bind(payload.sort_order.unwrap_or(0))
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("Un lit avec ce libelle existe deja")
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
    ApiJson(payload): ApiJson<UpdateBedRequest>,
) -> ApiResult<Json<Bed>> {
    require_admin(&current_account)?;
    payload.validate()?;

    let current = fetch_bed(&state, &id).await?;
    let label = payload
        .label
        .as_deref()
        .unwrap_or(&current.label)
        .to_string();
    let room = resolve_update_room(&state, &payload, &current).await?;
    let service = room.service.clone();
    let sort_order = payload.sort_order.unwrap_or(current.sort_order);

    ensure_occupied_bed_can_move(&state, &id, &service).await?;

    let bed = sqlx::query_as::<_, Bed>(
        r#"
        UPDATE beds
        SET label = ?, room_id = ?, room = ?, service = ?, sort_order = ?
        WHERE id = ?
        RETURNING
          id,
          label,
          room_id,
          room,
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
          ) AS occupied_patient_name,
          (
            SELECT patients.sex
            FROM patients
            WHERE patients.bed_id = beds.id
              AND patients.archived_at IS NULL
            LIMIT 1
          ) AS occupied_patient_sex
        "#,
    )
    .bind(label.trim())
    .bind(&room.id)
    .bind(&room.label)
    .bind(service)
    .bind(sort_order)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("Un lit avec ce libelle existe deja")
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
        return Err(ApiError::conflict("Ce lit est actuellement affecte"));
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
  b.room_id,
  COALESCE(r.label, b.room) AS room,
  COALESCE(r.service, b.service) AS service,
  b.sort_order,
  p.id AS occupied_patient_id,
  CASE
    WHEN p.id IS NULL THEN NULL
    ELSE p.last_name || ' ' || p.first_name
  END AS occupied_patient_name,
  p.sex AS occupied_patient_sex
FROM beds b
LEFT JOIN rooms r
  ON r.id = b.room_id
LEFT JOIN patients p
  ON p.bed_id = b.id
 AND p.archived_at IS NULL
ORDER BY COALESCE(r.sort_order, b.sort_order) ASC, b.sort_order ASC, b.label ASC
"#;

async fn fetch_bed(state: &AppState, id: &str) -> ApiResult<Bed> {
    sqlx::query_as::<_, Bed>(
        r#"
        SELECT *
        FROM (
          SELECT
            b.id,
            b.label,
            b.room_id,
            COALESCE(r.label, b.room) AS room,
            COALESCE(r.service, b.service) AS service,
            b.sort_order,
            p.id AS occupied_patient_id,
            CASE
              WHEN p.id IS NULL THEN NULL
              ELSE p.last_name || ' ' || p.first_name
            END AS occupied_patient_name,
            p.sex AS occupied_patient_sex
          FROM beds b
          LEFT JOIN rooms r
            ON r.id = b.room_id
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
    .ok_or_else(|| ApiError::not_found("Lit introuvable"))
}

async fn ensure_occupied_bed_can_move(
    state: &AppState,
    bed_id: &str,
    service: &str,
) -> ApiResult<()> {
    let patient: Option<(PatientId,)> = sqlx::query_as(
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
            "Le service du lit occupe doit correspondre au service du patient",
        ));
    }

    Ok(())
}

impl CreateBedRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.label, "label")?;
        if let Some(room_id) = &self.room_id {
            require_non_empty(room_id, "roomId")?;
        }
        if let Some(room) = &self.room {
            require_non_empty(room, "room")?;
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

async fn resolve_create_room(state: &AppState, payload: &CreateBedRequest) -> ApiResult<Room> {
    if let Some(room_id) = normalize_optional_ref(payload.room_id.as_deref()) {
        let room = rooms::fetch_room(state, &room_id).await?;
        ensure_payload_service_matches_room(state, payload.service.as_deref(), &room).await?;
        return Ok(room);
    }

    let service = payload.service.as_deref().ok_or_else(|| {
        ApiError::bad_request("Le service est obligatoire sans chambre selectionnee")
    })?;
    let fallback_room = derive_room_from_label(&payload.label);
    let room = payload
        .room
        .as_deref()
        .and_then(|value| normalize_optional_ref(Some(value)))
        .unwrap_or(fallback_room);

    rooms::ensure_room_created(state, service, &room).await
}

async fn resolve_update_room(
    state: &AppState,
    payload: &UpdateBedRequest,
    current: &Bed,
) -> ApiResult<Room> {
    if let Some(room_id) = normalize_optional_ref(payload.room_id.as_deref()) {
        let room = rooms::fetch_room(state, &room_id).await?;
        ensure_payload_service_matches_room(state, payload.service.as_deref(), &room).await?;
        return Ok(room);
    }

    if let Some(room_label) = payload
        .room
        .as_deref()
        .and_then(|value| normalize_optional_ref(Some(value)))
    {
        let service = payload.service.as_deref().unwrap_or(&current.service);
        return rooms::ensure_room_created(state, service, &room_label).await;
    }

    if let Some(service) = payload.service.as_deref() {
        return rooms::ensure_room_created(state, service, &current.room).await;
    }

    if let Some(room_id) = normalize_optional_ref(Some(&current.room_id)) {
        return rooms::fetch_room(state, &room_id).await;
    }

    rooms::ensure_room_created(state, &current.service, &current.room).await
}

async fn ensure_payload_service_matches_room(
    state: &AppState,
    service: Option<&str>,
    room: &Room,
) -> ApiResult<()> {
    let Some(service) = service else {
        return Ok(());
    };

    let service = services::canonical_service_name(state, service).await?;

    if service != room.service {
        return Err(ApiError::conflict(
            "Le service de la chambre doit correspondre au service du lit",
        ));
    }

    Ok(())
}

fn derive_room_from_label(label: &str) -> String {
    let trimmed = label.trim();
    let room = trimmed
        .trim_end_matches(|character: char| character.is_ascii_digit())
        .trim_end_matches(|character: char| matches!(character, '-' | '_' | ' '));

    if room.is_empty() {
        trimmed.to_string()
    } else {
        room.to_string()
    }
}

fn normalize_optional_ref(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

impl UpdateBedRequest {
    fn validate(&self) -> ApiResult<()> {
        if let Some(label) = &self.label {
            require_non_empty(label, "label")?;
        }

        if let Some(room_id) = &self.room_id {
            require_non_empty(room_id, "roomId")?;
        }

        if let Some(room) = &self.room {
            require_non_empty(room, "room")?;
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
