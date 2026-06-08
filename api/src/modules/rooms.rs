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
        services,
    },
    realtime::publish_change,
    state::AppState,
    validation::{require_non_empty, require_positive_i64},
};

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: String,
    pub label: String,
    pub service: String,
    pub sort_order: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRoomsQuery {
    service: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomRequest {
    label: String,
    service: String,
    sort_order: Option<i64>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/rooms", get(list_rooms).post(create_room))
        .route("/rooms/{id}", put(update_room).delete(delete_room))
}

pub async fn fetch_room(state: &AppState, id: &str) -> ApiResult<Room> {
    sqlx::query_as::<_, Room>(
        r#"
        SELECT id, label, service, sort_order
        FROM rooms
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Chambre introuvable"))
}

pub async fn ensure_room_created(state: &AppState, service: &str, label: &str) -> ApiResult<Room> {
    let label = normalize_room_label(label)?;
    let service = services::canonical_service_name(state, service).await?;

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO rooms (id, label, service)
        VALUES (?, ?, ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&label)
    .bind(&service)
    .execute(&state.pool)
    .await?;

    fetch_room_by_label(state, &service, &label).await
}

fn normalize_room_label(value: &str) -> ApiResult<String> {
    require_non_empty(value, "room")?;
    Ok(value.split_whitespace().collect::<Vec<_>>().join(" "))
}

async fn fetch_room_by_label(state: &AppState, service: &str, label: &str) -> ApiResult<Room> {
    sqlx::query_as::<_, Room>(
        r#"
        SELECT id, label, service, sort_order
        FROM rooms
        WHERE service = ? AND label = ?
        "#,
    )
    .bind(service)
    .bind(label)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Chambre introuvable"))
}

async fn list_rooms(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Query(query): Query<ListRoomsQuery>,
) -> ApiResult<Json<Vec<Room>>> {
    let service_filter = match query.service.as_deref() {
        Some(service) if !service.trim().is_empty() => {
            Some(services::canonical_service_name(&state, service).await?)
        }
        _ => None,
    };

    let rooms = if let Some(service) = service_filter {
        sqlx::query_as::<_, Room>(
            r#"
            SELECT id, label, service, sort_order
            FROM rooms
            WHERE service = ?
            ORDER BY sort_order ASC, label ASC
            "#,
        )
        .bind(service)
        .fetch_all(&state.pool)
        .await?
    } else if current_account.role == "admin" {
        sqlx::query_as::<_, Room>(
            r#"
            SELECT id, label, service, sort_order
            FROM rooms
            ORDER BY service COLLATE NOCASE ASC, sort_order ASC, label ASC
            "#,
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, Room>(
            r#"
            SELECT id, label, service, sort_order
            FROM rooms
            WHERE service = ?
            ORDER BY sort_order ASC, label ASC
            "#,
        )
        .bind(&current_account.service)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(rooms))
}

async fn create_room(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    ApiJson(payload): ApiJson<RoomRequest>,
) -> ApiResult<Json<Room>> {
    require_admin(&current_account)?;
    payload.validate()?;

    let label = normalize_room_label(&payload.label)?;
    let service = services::canonical_service_name(&state, &payload.service).await?;

    let room = sqlx::query_as::<_, Room>(
        r#"
        INSERT INTO rooms (id, label, service, sort_order)
        VALUES (?, ?, ?, ?)
        RETURNING id, label, service, sort_order
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(label)
    .bind(service)
    .bind(payload.sort_order.unwrap_or(0))
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("Une chambre avec ce libelle existe deja dans ce service")
        } else {
            ApiError::from(error)
        }
    })?;

    publish_change(
        &state,
        "room",
        "created",
        room.id.clone(),
        None,
        ["admin", "rooms"],
        &room,
    );

    Ok(Json(room))
}

async fn update_room(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
    ApiJson(payload): ApiJson<RoomRequest>,
) -> ApiResult<Json<Room>> {
    require_admin(&current_account)?;
    payload.validate()?;

    let label = normalize_room_label(&payload.label)?;
    let service = services::canonical_service_name(&state, &payload.service).await?;
    ensure_occupied_room_can_move(&state, &id, &service).await?;

    let room = sqlx::query_as::<_, Room>(
        r#"
        UPDATE rooms
        SET
          label = ?,
          service = ?,
          sort_order = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING id, label, service, sort_order
        "#,
    )
    .bind(label)
    .bind(service)
    .bind(payload.sort_order.unwrap_or(0))
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("Une chambre avec ce libelle existe deja dans ce service")
        } else {
            ApiError::from(error)
        }
    })?;

    publish_change(
        &state,
        "room",
        "updated",
        room.id.clone(),
        None,
        ["admin", "rooms"],
        &room,
    );

    Ok(Json(room))
}

async fn delete_room(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<Room>> {
    require_admin(&current_account)?;

    let room = fetch_room(&state, &id).await?;
    let bed_count: (i64,) = sqlx::query_as("SELECT COUNT(1) FROM beds WHERE room_id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await?;

    if bed_count.0 > 0 {
        return Err(ApiError::conflict(
            "Cette chambre est encore utilisee par des lits",
        ));
    }

    sqlx::query("DELETE FROM rooms WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await?;

    publish_change(
        &state,
        "room",
        "deleted",
        room.id.clone(),
        None,
        ["admin", "rooms"],
        &room,
    );

    Ok(Json(room))
}

async fn ensure_occupied_room_can_move(
    state: &AppState,
    room_id: &str,
    service: &str,
) -> ApiResult<()> {
    let patient: Option<(PatientId,)> = sqlx::query_as(
        r#"
        SELECT patients.id
        FROM beds
        JOIN patients ON patients.bed_id = beds.id
        WHERE beds.room_id = ?
          AND patients.archived_at IS NULL
          AND patients.current_service != ?
        LIMIT 1
        "#,
    )
    .bind(room_id)
    .bind(service)
    .fetch_optional(&state.pool)
    .await?;

    if patient.is_some() {
        return Err(ApiError::conflict(
            "Le service de la chambre occupee doit correspondre au service du patient",
        ));
    }

    Ok(())
}

impl RoomRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.label, "label")?;
        require_non_empty(&self.service, "service")?;

        if let Some(sort_order) = self.sort_order {
            require_positive_i64(sort_order, "sortOrder")?;
        }

        Ok(())
    }
}
