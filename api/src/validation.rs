use crate::error::{ApiError, ApiResult};

pub fn require_non_empty(value: &str, field: &str) -> ApiResult<()> {
    if value.trim().is_empty() {
        return Err(ApiError::bad_request(format!("{field} is required")));
    }

    Ok(())
}

pub fn require_one_of(value: &str, field: &str, allowed: &[&str]) -> ApiResult<()> {
    require_non_empty(value, field)?;

    if allowed.contains(&value) {
        return Ok(());
    }

    Err(ApiError::bad_request(format!(
        "{field} has an unsupported value"
    )))
}

pub fn require_positive_f64(value: f64, field: &str) -> ApiResult<()> {
    if value.is_finite() && value > 0.0 {
        return Ok(());
    }

    Err(ApiError::bad_request(format!("{field} must be positive")))
}

pub fn require_positive_i64(value: i64, field: &str) -> ApiResult<()> {
    if value > 0 {
        return Ok(());
    }

    Err(ApiError::bad_request(format!("{field} must be positive")))
}
