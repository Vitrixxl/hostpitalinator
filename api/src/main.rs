use hospitalinator_api::{
    build_app, build_app_with_frontend, config::ApiConfig, db, state::AppState,
};
use tokio::net::TcpListener;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "hospitalinator_api=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = ApiConfig::from_env();
    let pool = db::connect(&config.database_url).await?;
    tokio::fs::create_dir_all(&config.file_storage_dir).await?;
    let state = AppState::new(pool, config.file_storage_dir.clone());
    let app = if let Some(web_dist_dir) = config.web_dist_dir.clone() {
        build_app_with_frontend(state, &config.web_origins, web_dist_dir)
    } else {
        build_app(state, &config.web_origins)
    };
    let listener = TcpListener::bind(config.socket_addr()).await?;

    tracing::info!(
        host = %config.host,
        port = config.port,
        web_origins = ?config.web_origins,
        database_url = %config.database_url,
        file_storage_dir = %config.file_storage_dir.display(),
        web_dist_dir = ?config.web_dist_dir,
        "hospitalinator API listening"
    );

    axum::serve(listener, app).await?;

    Ok(())
}
