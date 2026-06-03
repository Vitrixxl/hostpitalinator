use axum::{
    extract::{rejection::JsonRejection, FromRequest, Request},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{de::DeserializeOwned, Serialize};
use std::{error::Error, fmt};

pub type ApiResult<T> = Result<T, ApiError>;

pub struct ApiJson<T>(pub T);

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    Conflict(String),
    Internal(String),
}

#[derive(Serialize)]
struct ErrorEnvelope {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
}

impl ApiError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::BadRequest(message.into())
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::Unauthorized(message.into())
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::Forbidden(message.into())
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::NotFound(message.into())
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict(message.into())
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal(message.into())
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::BadRequest(message)
            | Self::Unauthorized(message)
            | Self::Forbidden(message)
            | Self::NotFound(message)
            | Self::Conflict(message)
            | Self::Internal(message) => formatter.write_str(message),
        }
    }
}

impl Error for ApiError {}

impl<S, T> FromRequest<S> for ApiJson<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        Json::<T>::from_request(request, state)
            .await
            .map(|Json(payload)| Self(payload))
            .map_err(api_json_rejection)
    }
}

fn api_json_rejection(rejection: JsonRejection) -> ApiError {
    let message = match rejection {
        JsonRejection::JsonDataError(_) => "Les donnees envoyees sont invalides",
        JsonRejection::JsonSyntaxError(_) => "Le format JSON de la requete est invalide",
        JsonRejection::MissingJsonContentType(_) => {
            "Le corps de la requete doit etre au format JSON"
        }
        JsonRejection::BytesRejection(_) => "Le corps de la requete est illisible",
        _ => "La requete JSON est invalide",
    };

    ApiError::bad_request(message)
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            Self::BadRequest(message) => (StatusCode::BAD_REQUEST, "bad_request", message),
            Self::Unauthorized(message) => (StatusCode::UNAUTHORIZED, "unauthorized", message),
            Self::Forbidden(message) => (StatusCode::FORBIDDEN, "forbidden", message),
            Self::NotFound(message) => (StatusCode::NOT_FOUND, "not_found", message),
            Self::Conflict(message) => (StatusCode::CONFLICT, "conflict", message),
            Self::Internal(message) => {
                tracing::error!(%message, "internal API error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "Erreur interne du serveur".to_string(),
                )
            }
        };

        (
            status,
            Json(ErrorEnvelope {
                error: ErrorBody { code, message },
            }),
        )
            .into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        match error {
            sqlx::Error::RowNotFound => Self::not_found("Ressource introuvable"),
            other => Self::internal(other.to_string()),
        }
    }
}

impl From<sqlx::migrate::MigrateError> for ApiError {
    fn from(error: sqlx::migrate::MigrateError) -> Self {
        Self::internal(error.to_string())
    }
}

pub fn is_unique_constraint(error: &sqlx::Error) -> bool {
    let sqlx::Error::Database(database_error) = error else {
        return false;
    };

    matches!(database_error.code().as_deref(), Some("1555" | "2067"))
        || database_error
            .message()
            .contains("UNIQUE constraint failed")
}

pub fn is_foreign_key_constraint(error: &sqlx::Error) -> bool {
    let sqlx::Error::Database(database_error) = error else {
        return false;
    };

    matches!(database_error.code().as_deref(), Some("787"))
        || database_error
            .message()
            .contains("FOREIGN KEY constraint failed")
}
