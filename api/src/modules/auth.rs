use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    body::Body,
    extract::{Request, State},
    http::{header, HeaderMap},
    middleware::Next,
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{seq::SliceRandom, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::{is_unique_constraint, ApiError, ApiResult},
    modules::services,
    state::AppState,
    validation::require_non_empty,
};

const PASSWORD_WORD_COUNT: usize = 5;
const WORDS: &[&str] = &[
    "abricot",
    "acier",
    "agenda",
    "alarme",
    "amande",
    "ancre",
    "ardoise",
    "atlas",
    "aviron",
    "azur",
    "balise",
    "banque",
    "bassin",
    "bocal",
    "bougie",
    "branche",
    "cabine",
    "cactus",
    "carnet",
    "cascade",
    "cellule",
    "cerise",
    "clavier",
    "colline",
    "compas",
    "coton",
    "couloir",
    "crayon",
    "cuivre",
    "dalle",
    "dossier",
    "eclair",
    "ecole",
    "emeraude",
    "encre",
    "etoile",
    "falaises",
    "farine",
    "fenetre",
    "ficelle",
    "flamme",
    "foret",
    "galerie",
    "gaufre",
    "glacier",
    "gomme",
    "granit",
    "haricot",
    "horizon",
    "jardin",
    "jonquille",
    "lampe",
    "lavande",
    "lentille",
    "lilas",
    "machine",
    "marbre",
    "melodie",
    "menthe",
    "miroir",
    "moteur",
    "nuage",
    "olivier",
    "orange",
    "papier",
    "pastel",
    "pierre",
    "plume",
    "prairie",
    "quartz",
    "radar",
    "riviere",
    "ruban",
    "sable",
    "saphir",
    "signal",
    "silence",
    "soleil",
    "tableau",
    "tissu",
    "tulipe",
    "valise",
    "vapeur",
    "verger",
    "violet",
];

#[derive(Clone, Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentAccount {
    pub id: String,
    pub name: String,
    pub email: String,
    pub role: String,
    pub service: String,
    pub status: String,
}

#[derive(Clone, Debug)]
pub struct CurrentSession {
    pub token_hash: String,
}

#[derive(Debug, FromRow)]
struct AccountCredentials {
    id: String,
    name: String,
    email: String,
    role: String,
    service: String,
    status: String,
    password_hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWithGeneratedPassword {
    pub account: CurrentAccount,
    pub generated_password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginResponse {
    token: String,
    account: CurrentAccount,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MeResponse {
    account: CurrentAccount,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapAdminRequest {
    name: String,
    email: String,
    service: String,
}

pub fn public_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/login", post(login))
        .route("/auth/bootstrap-admin", post(bootstrap_admin))
}

pub fn authenticated_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/me", get(me))
        .route("/auth/logout", post(logout))
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> ApiResult<Response> {
    let token = bearer_token(request.headers())?;
    let (account, session) = authenticate_token(&state, token).await?;

    request.extensions_mut().insert(account);
    request.extensions_mut().insert(session);

    Ok(next.run(request).await)
}

pub async fn authenticate_token(
    state: &AppState,
    token: &str,
) -> ApiResult<(CurrentAccount, CurrentSession)> {
    let token_hash = hash_token(token);

    let account = sqlx::query_as::<_, CurrentAccount>(
        r#"
        SELECT accounts.id, accounts.name, accounts.email, accounts.role, accounts.service, accounts.status
        FROM sessions
        INNER JOIN accounts ON accounts.id = sessions.account_id
        WHERE sessions.token_hash = ?
          AND sessions.revoked_at IS NULL
          AND accounts.status != 'disabled'
        "#,
    )
    .bind(&token_hash)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::unauthorized("Authentication required"))?;

    sqlx::query(
        "UPDATE sessions SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE token_hash = ?",
    )
    .bind(&token_hash)
    .execute(&state.pool)
    .await?;

    Ok((account, CurrentSession { token_hash }))
}

pub fn require_admin(account: &CurrentAccount) -> ApiResult<()> {
    if account.role == "admin" {
        return Ok(());
    }

    Err(ApiError::forbidden("Admin role required"))
}

pub fn require_service_scope(account: &CurrentAccount, service: &str) -> ApiResult<()> {
    if account.role == "admin" || account.service == service {
        return Ok(());
    }

    Err(ApiError::forbidden("Service scope required"))
}

pub fn generate_password() -> String {
    let mut rng = rand::thread_rng();

    (0..PASSWORD_WORD_COUNT)
        .map(|_| {
            WORDS
                .choose(&mut rng)
                .expect("password word list is not empty")
        })
        .copied()
        .collect::<Vec<_>>()
        .join("-")
}

pub fn hash_password(password: &str) -> ApiResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| ApiError::internal(error.to_string()))
}

pub fn verify_password(password: &str, password_hash: &str) -> ApiResult<bool> {
    if password_hash.trim().is_empty() {
        return Ok(false);
    }

    let parsed_hash =
        PasswordHash::new(password_hash).map_err(|error| ApiError::internal(error.to_string()))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

pub fn hash_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    hex::encode(digest)
}

pub fn generate_token() -> String {
    let mut bytes = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn to_current_account(credentials: &AccountCredentials) -> CurrentAccount {
    CurrentAccount {
        id: credentials.id.clone(),
        name: credentials.name.clone(),
        email: credentials.email.clone(),
        role: credentials.role.clone(),
        service: credentials.service.clone(),
        status: credentials.status.clone(),
    }
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> ApiResult<Json<LoginResponse>> {
    require_non_empty(&payload.email, "email")?;
    require_non_empty(&payload.password, "password")?;

    let credentials = sqlx::query_as::<_, AccountCredentials>(
        r#"
        SELECT id, name, email, role, service, status, password_hash
        FROM accounts
        WHERE email = ?
        "#,
    )
    .bind(payload.email.trim())
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::unauthorized("Invalid credentials"))?;

    if credentials.status == "disabled" {
        return Err(ApiError::unauthorized("Account is disabled"));
    }

    if !verify_password(&payload.password, &credentials.password_hash)? {
        return Err(ApiError::unauthorized("Invalid credentials"));
    }

    let token = generate_token();
    let token_hash = hash_token(&token);

    sqlx::query("INSERT INTO sessions (token_hash, account_id) VALUES (?, ?)")
        .bind(token_hash)
        .bind(&credentials.id)
        .execute(&state.pool)
        .await?;

    Ok(Json(LoginResponse {
        token,
        account: to_current_account(&credentials),
    }))
}

async fn logout(
    State(state): State<AppState>,
    Extension(session): Extension<CurrentSession>,
) -> ApiResult<Json<serde_json::Value>> {
    sqlx::query(
        "UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE token_hash = ?",
    )
    .bind(session.token_hash)
    .execute(&state.pool)
    .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn me(Extension(account): Extension<CurrentAccount>) -> Json<MeResponse> {
    Json(MeResponse { account })
}

async fn bootstrap_admin(
    State(state): State<AppState>,
    Json(payload): Json<BootstrapAdminRequest>,
) -> ApiResult<Json<AccountWithGeneratedPassword>> {
    require_non_empty(&payload.name, "name")?;
    require_non_empty(&payload.email, "email")?;

    let account_count: (i64,) = sqlx::query_as("SELECT COUNT(1) FROM accounts")
        .fetch_one(&state.pool)
        .await?;

    if account_count.0 > 0 {
        return Err(ApiError::forbidden("Initial admin already exists"));
    }

    let service = services::ensure_service_created(&state, &payload.service).await?;
    let generated_password = generate_password();
    let password_hash = hash_password(&generated_password)?;
    let id = Uuid::new_v4().to_string();

    let credentials = sqlx::query_as::<_, AccountCredentials>(
        r#"
        INSERT INTO accounts (id, name, email, role, service, status, password_hash)
        VALUES (?, ?, ?, 'admin', ?, 'active', ?)
        RETURNING id, name, email, role, service, status, password_hash
        "#,
    )
    .bind(id)
    .bind(payload.name.trim())
    .bind(payload.email.trim())
    .bind(service)
    .bind(password_hash)
    .fetch_one(&state.pool)
    .await
    .map_err(|error| {
        if is_unique_constraint(&error) {
            ApiError::conflict("An account with this email already exists")
        } else {
            ApiError::from(error)
        }
    })?;

    Ok(Json(AccountWithGeneratedPassword {
        account: to_current_account(&credentials),
        generated_password,
    }))
}

fn bearer_token(headers: &HeaderMap) -> ApiResult<&str> {
    let value = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| ApiError::unauthorized("Authentication required"))?;

    value
        .strip_prefix("Bearer ")
        .filter(|token| !token.trim().is_empty())
        .ok_or_else(|| ApiError::unauthorized("Authentication required"))
}
