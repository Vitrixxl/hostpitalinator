pub mod config;
pub mod db;
pub mod error;
pub mod modules;
pub mod realtime;
pub mod state;
pub mod validation;

use std::path::PathBuf;

use axum::{http::HeaderValue, middleware, routing::get, Json, Router};
use serde::Serialize;
use tower_http::{
    cors::{AllowOrigin, Any, CorsLayer},
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

use crate::state::AppState;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

pub fn build_app<S>(state: AppState, web_origins: &[S]) -> Router
where
    S: AsRef<str>,
{
    let cors = CorsLayer::new()
        .allow_origin(cors_allow_origin(web_origins))
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_private_network(true);

    let protected_routes = Router::new()
        .route("/health", get(health_check))
        .merge(modules::auth::authenticated_routes())
        .merge(modules::accounts::routes())
        .merge(modules::services::routes())
        .merge(modules::rooms::routes())
        .merge(modules::beds::routes())
        .merge(modules::patients::routes())
        .merge(modules::entrance_exams::routes())
        .merge(modules::doctors::routes())
        .merge(modules::medicines::routes())
        .merge(modules::vitals::routes())
        .merge(modules::prescriptions::routes())
        .merge(modules::labs::routes())
        .merge(modules::documents::routes())
        .merge(modules::evolutions::routes())
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            modules::auth::require_auth,
        ));

    Router::new()
        .merge(modules::auth::public_routes())
        .merge(realtime::routes())
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

pub fn build_app_with_frontend<S>(
    state: AppState,
    web_origins: &[S],
    web_dist_dir: impl Into<PathBuf>,
) -> Router
where
    S: AsRef<str>,
{
    let web_dist_dir = web_dist_dir.into();
    let index_file = web_dist_dir.join("index.html");
    let frontend = ServeDir::new(web_dist_dir).fallback(ServeFile::new(index_file));

    build_app(state, web_origins).fallback_service(frontend)
}

fn cors_allow_origin<S>(web_origins: &[S]) -> AllowOrigin
where
    S: AsRef<str>,
{
    let mut origins = Vec::new();

    for origin in web_origins {
        let origin = origin.as_ref().trim();

        if origin.is_empty() {
            continue;
        }

        if origin == "*" {
            return AllowOrigin::any();
        }

        match origin.parse::<HeaderValue>() {
            Ok(header) => origins.push(header),
            Err(error) => {
                tracing::warn!(%origin, %error, "ignoring invalid CORS origin");
            }
        }
    }

    if origins.is_empty() {
        origins.push(HeaderValue::from_static("http://127.0.0.1:5173"));
        origins.push(HeaderValue::from_static("http://localhost:5173"));
    }

    AllowOrigin::list(origins)
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}
