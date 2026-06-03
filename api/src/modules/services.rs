use axum::{
    extract::{Path, State},
    routing::{get, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{is_unique_constraint, ApiError, ApiJson, ApiResult},
    modules::auth::{require_admin, CurrentAccount},
    realtime::publish_change,
    state::AppState,
    validation::require_non_empty,
};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceRequest {
    name: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/services", get(list_services).post(create_service))
        .route("/services/{id}", put(update_service).delete(delete_service))
}

pub fn normalize_service_name(value: &str) -> ApiResult<String> {
    require_non_empty(value, "service")?;
    Ok(value.split_whitespace().collect::<Vec<_>>().join(" "))
}

pub async fn ensure_service_exists(state: &AppState, service: &str) -> ApiResult<()> {
    let service = normalize_service_name(service)?;
    let exists: (i64,) = sqlx::query_as("SELECT COUNT(1) FROM services WHERE name = ?")
        .bind(service)
        .fetch_one(&state.pool)
        .await?;

    if exists.0 == 0 {
        return Err(ApiError::not_found("Service introuvable"));
    }

    Ok(())
}

pub async fn ensure_service_created(state: &AppState, service: &str) -> ApiResult<String> {
    let service = normalize_service_name(service)?;

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO services (id, name)
        VALUES (?, ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&service)
    .execute(&state.pool)
    .await?;

    canonical_service_name(state, &service).await
}

pub async fn canonical_service_name(state: &AppState, service: &str) -> ApiResult<String> {
    let service = normalize_service_name(service)?;

    let row: (String,) = sqlx::query_as("SELECT name FROM services WHERE name = ?")
        .bind(service)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Service introuvable"))?;

    Ok(row.0)
}

async fn list_services(State(state): State<AppState>) -> ApiResult<Json<Vec<Service>>> {
    let services =
        sqlx::query_as::<_, Service>("SELECT * FROM services ORDER BY name COLLATE NOCASE ASC")
            .fetch_all(&state.pool)
            .await?;

    Ok(Json(services))
}

async fn create_service(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    ApiJson(payload): ApiJson<ServiceRequest>,
) -> ApiResult<Json<Service>> {
    require_admin(&current_account)?;
    let name = normalize_service_name(&payload.name)?;

    let service = sqlx::query_as::<_, Service>(
        r#"
        INSERT INTO services (id, name)
        VALUES (?, ?)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(name)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("Ce service existe deja")
        } else {
            ApiError::from(error)
        }
    })?;

    publish_change(
        &state,
        "service",
        "created",
        service.id.clone(),
        None,
        ["admin", "services"],
        &service,
    );

    Ok(Json(service))
}

async fn update_service(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
    ApiJson(payload): ApiJson<ServiceRequest>,
) -> ApiResult<Json<Service>> {
    require_admin(&current_account)?;
    let name = normalize_service_name(&payload.name)?;

    let mut transaction = state.pool.begin().await?;
    let previous: (String,) = sqlx::query_as("SELECT name FROM services WHERE id = ?")
        .bind(&id)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or_else(|| ApiError::not_found("Service introuvable"))?;
    let reference_count = service_reference_count(&state, &previous.0).await?;

    if previous.0 != name && reference_count > 0 {
        return Err(ApiError::conflict("Ce service est encore utilise"));
    }

    let service = sqlx::query_as::<_, Service>(
        r#"
        UPDATE services
        SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("Ce service existe deja")
        } else {
            ApiError::from(error)
        }
    })?;

    transaction.commit().await?;

    publish_change(
        &state,
        "service",
        "updated",
        service.id.clone(),
        None,
        ["admin", "services"],
        &service,
    );

    Ok(Json(service))
}

async fn delete_service(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<Service>> {
    require_admin(&current_account)?;

    let service = sqlx::query_as::<_, Service>("SELECT * FROM services WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Service introuvable"))?;

    let reference_count = service_reference_count(&state, &service.name).await?;

    if reference_count > 0 {
        return Err(ApiError::conflict("Ce service est encore utilise"));
    }

    sqlx::query("DELETE FROM services WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await?;

    publish_change(
        &state,
        "service",
        "deleted",
        service.id.clone(),
        None,
        ["admin", "services"],
        &service,
    );

    Ok(Json(service))
}

async fn service_reference_count(state: &AppState, service: &str) -> ApiResult<i64> {
    let reference_count: (i64,) = sqlx::query_as(
        r#"
        SELECT
          (SELECT COUNT(1) FROM accounts WHERE service = ?)
          + (SELECT COUNT(1) FROM patients WHERE current_service = ?)
          + (SELECT COUNT(1) FROM rooms WHERE service = ?)
          + (SELECT COUNT(1) FROM beds WHERE service = ?)
          + (SELECT COUNT(1) FROM evolution_notes WHERE service = ?)
        "#,
    )
    .bind(service)
    .bind(service)
    .bind(service)
    .bind(service)
    .bind(service)
    .fetch_one(&state.pool)
    .await?;

    Ok(reference_count.0)
}
