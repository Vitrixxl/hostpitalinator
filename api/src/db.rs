use std::{path::Path, str::FromStr};

use sqlx::{
    migrate::Migrator,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};

use crate::error::{ApiError, ApiResult};

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub async fn connect(database_url: &str) -> ApiResult<SqlitePool> {
    ensure_sqlite_parent(database_url)?;

    let options = SqliteConnectOptions::from_str(database_url)
        .map_err(|error| ApiError::internal(error.to_string()))?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(ApiError::from)?;

    MIGRATOR.run(&pool).await.map_err(ApiError::from)?;

    Ok(pool)
}

fn ensure_sqlite_parent(database_url: &str) -> ApiResult<()> {
    let Some(path) = database_url.strip_prefix("sqlite://") else {
        return Ok(());
    };

    if path == ":memory:" || path.starts_with("file:") {
        return Ok(());
    }

    let path = Path::new(path);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| ApiError::internal(error.to_string()))?;
    }

    Ok(())
}
