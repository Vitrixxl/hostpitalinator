use std::{env, path::PathBuf};

#[derive(Clone, Debug)]
pub struct ApiConfig {
    pub host: String,
    pub port: u16,
    pub web_origins: Vec<String>,
    pub database_url: String,
    pub file_storage_dir: PathBuf,
    pub web_dist_dir: Option<PathBuf>,
}

const DEFAULT_WEB_ORIGINS: &[&str] = &[
    "http://127.0.0.1:5188",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
];

impl ApiConfig {
    pub fn from_env() -> Self {
        Self {
            host: env::var("API_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("API_PORT")
                .ok()
                .and_then(|value| value.parse::<u16>().ok())
                .unwrap_or(4000),
            web_origins: web_origins_from_env(),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| default_database_url()),
            file_storage_dir: env::var("FILE_STORAGE_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| default_file_storage_dir()),
            web_dist_dir: env::var("WEB_DIST_DIR")
                .map(PathBuf::from)
                .ok()
                .or_else(default_web_dist_dir),
        }
    }

    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

fn web_origins_from_env() -> Vec<String> {
    let origins = env::var("WEB_ORIGINS")
        .or_else(|_| env::var("WEB_ORIGIN"))
        .map(|value| parse_web_origins(&value))
        .unwrap_or_else(|_| default_web_origins());

    if origins.is_empty() {
        default_web_origins()
    } else {
        origins
    }
}

fn parse_web_origins(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(str::to_string)
        .collect()
}

fn default_web_origins() -> Vec<String> {
    DEFAULT_WEB_ORIGINS
        .iter()
        .map(|origin| (*origin).to_string())
        .collect()
}

fn default_database_url() -> String {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("data")
        .join("hospitalinator.sqlite");

    format!("sqlite://{}", path.display())
}

fn default_file_storage_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("data")
        .join("documents")
}

fn default_web_dist_dir() -> Option<PathBuf> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|repo_root| repo_root.join("dist"))?;

    path.exists().then_some(path)
}
