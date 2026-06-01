use std::path::PathBuf;

use sqlx::SqlitePool;

use crate::realtime::RealtimeHub;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub file_storage_dir: PathBuf,
    pub realtime: RealtimeHub,
}

impl AppState {
    pub fn new(pool: SqlitePool, file_storage_dir: PathBuf) -> Self {
        Self {
            pool,
            file_storage_dir,
            realtime: RealtimeHub::new(),
        }
    }
}
