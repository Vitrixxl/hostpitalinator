use axum::{
    extract::{Path, Query, State},
    routing::{get, patch},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{is_unique_constraint, ApiError, ApiJson, ApiResult},
    modules::auth::{generate_password, hash_password, require_admin, CurrentAccount},
    modules::services,
    realtime::publish_change,
    state::AppState,
    validation::{require_non_empty, require_one_of},
};

const ROLES: &[&str] = &["admin", "doctor", "nurse", "secretary"];

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    id: String,
    name: String,
    email: String,
    role: String,
    service: String,
    status: String,
    created_at: String,
    updated_at: String,
    disabled_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWithGeneratedPassword {
    account: Account,
    generated_password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountRequest {
    name: String,
    email: String,
    role: String,
    service: String,
    invite: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountRequest {
    name: Option<String>,
    email: Option<String>,
    role: Option<String>,
    service: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignRoleRequest {
    role: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAccountsQuery {
    include_disabled: Option<bool>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/accounts", get(list_accounts).post(create_account))
        .route("/accounts/{id}", get(get_account).put(update_account))
        .route("/accounts/{id}/disable", patch(disable_account))
        .route("/accounts/{id}/role", patch(assign_role))
        .route("/accounts/{id}/password/reset", patch(reset_password))
}

async fn list_accounts(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Query(query): Query<ListAccountsQuery>,
) -> ApiResult<Json<Vec<Account>>> {
    require_admin(&current_account)?;

    let accounts = if query.include_disabled.unwrap_or(false) {
        sqlx::query_as::<_, Account>("SELECT * FROM accounts ORDER BY created_at DESC, name ASC")
            .fetch_all(&state.pool)
            .await?
    } else {
        sqlx::query_as::<_, Account>(
            "SELECT * FROM accounts WHERE status != 'disabled' ORDER BY created_at DESC, name ASC",
        )
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(accounts))
}

async fn get_account(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<Account>> {
    require_admin(&current_account)?;

    let account = sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Compte introuvable"))?;

    Ok(Json(account))
}

async fn create_account(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    ApiJson(payload): ApiJson<CreateAccountRequest>,
) -> ApiResult<Json<AccountWithGeneratedPassword>> {
    require_admin(&current_account)?;
    payload.validate()?;
    let service = services::canonical_service_name(&state, &payload.service).await?;

    let id = Uuid::new_v4().to_string();
    let generated_password = generate_password();
    let password_hash = hash_password(&generated_password)?;
    let status = if payload.invite.unwrap_or(false) {
        "invited"
    } else {
        "active"
    };

    let account = sqlx::query_as::<_, Account>(
        r#"
        INSERT INTO accounts (id, name, email, role, service, status, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(payload.name.trim())
    .bind(payload.email.trim())
    .bind(payload.role)
    .bind(service)
    .bind(status)
    .bind(password_hash)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("Un compte avec ce courriel existe deja")
        } else {
            ApiError::from(error)
        }
    })?;

    publish_change(
        &state,
        "account",
        "created",
        account.id.clone(),
        None,
        ["admin", "accounts"],
        &account,
    );

    Ok(Json(AccountWithGeneratedPassword {
        account,
        generated_password,
    }))
}

async fn update_account(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
    ApiJson(payload): ApiJson<UpdateAccountRequest>,
) -> ApiResult<Json<Account>> {
    require_admin(&current_account)?;
    payload.validate()?;

    let current = sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Compte introuvable"))?;

    let name = payload.name.unwrap_or(current.name);
    let email = payload.email.unwrap_or(current.email);
    let role = payload.role.unwrap_or(current.role);
    let service = if let Some(service) = payload.service {
        services::canonical_service_name(&state, &service).await?
    } else {
        current.service
    };

    let account = sqlx::query_as::<_, Account>(
        r#"
        UPDATE accounts
        SET name = ?, email = ?, role = ?, service = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(name.trim())
    .bind(email.trim())
    .bind(role)
    .bind(service)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("Un compte avec ce courriel existe deja")
        } else {
            ApiError::from(error)
        }
    })?;

    publish_change(
        &state,
        "account",
        "updated",
        account.id.clone(),
        None,
        ["admin", "accounts"],
        &account,
    );

    Ok(Json(account))
}

async fn disable_account(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<Account>> {
    require_admin(&current_account)?;

    let account = sqlx::query_as::<_, Account>(
        r#"
        UPDATE accounts
        SET status = 'disabled',
            disabled_at = COALESCE(disabled_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Compte introuvable"))?;

    sqlx::query(
        "UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE account_id = ? AND revoked_at IS NULL",
    )
    .bind(&account.id)
    .execute(&state.pool)
    .await?;

    publish_change(
        &state,
        "account",
        "disabled",
        account.id.clone(),
        None,
        ["admin", "accounts"],
        &account,
    );

    Ok(Json(account))
}

async fn assign_role(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
    ApiJson(payload): ApiJson<AssignRoleRequest>,
) -> ApiResult<Json<Account>> {
    require_admin(&current_account)?;
    require_one_of(&payload.role, "role", ROLES)?;

    let account = sqlx::query_as::<_, Account>(
        r#"
        UPDATE accounts
        SET role = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(payload.role)
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Compte introuvable"))?;

    publish_change(
        &state,
        "account",
        "roleAssigned",
        account.id.clone(),
        None,
        ["admin", "accounts"],
        &account,
    );

    Ok(Json(account))
}

async fn reset_password(
    State(state): State<AppState>,
    Extension(current_account): Extension<CurrentAccount>,
    Path(id): Path<String>,
) -> ApiResult<Json<AccountWithGeneratedPassword>> {
    require_admin(&current_account)?;

    let generated_password = generate_password();
    let password_hash = hash_password(&generated_password)?;

    let account = sqlx::query_as::<_, Account>(
        r#"
        UPDATE accounts
        SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(password_hash)
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Compte introuvable"))?;

    sqlx::query(
        "UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE account_id = ? AND revoked_at IS NULL",
    )
    .bind(&account.id)
    .execute(&state.pool)
    .await?;

    publish_change(
        &state,
        "account",
        "passwordReset",
        account.id.clone(),
        None,
        ["admin", "accounts"],
        &account,
    );

    Ok(Json(AccountWithGeneratedPassword {
        account,
        generated_password,
    }))
}

impl CreateAccountRequest {
    fn validate(&self) -> ApiResult<()> {
        require_non_empty(&self.name, "name")?;
        require_non_empty(&self.email, "email")?;
        require_one_of(&self.role, "role", ROLES)?;
        require_non_empty(&self.service, "service")?;
        Ok(())
    }
}

impl UpdateAccountRequest {
    fn validate(&self) -> ApiResult<()> {
        if let Some(name) = &self.name {
            require_non_empty(name, "name")?;
        }

        if let Some(email) = &self.email {
            require_non_empty(email, "email")?;
        }

        if let Some(role) = &self.role {
            require_one_of(role, "role", ROLES)?;
        }

        if let Some(service) = &self.service {
            require_non_empty(service, "service")?;
        }

        Ok(())
    }
}
