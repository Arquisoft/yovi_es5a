use axum::{Json, http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};

/// A structured error response returned by the game server API.
///
/// This type is serialized to JSON and returned when API requests fail.
/// It includes context about which API version were involved.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct ErrorResponse {
    /// A stable error code for localization and machine handling.
    pub code: String,
    /// A human-readable error message describing what went wrong.
    pub message: String,
}

impl ErrorResponse {
    /// Creates a new error response with the given code and message.
    ///
    /// # Arguments
    /// * `code` - A stable error code suitable for localization
    /// * `message` - A description of the error
    pub fn error(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
        }
    }
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> axum::response::Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_with_all_fields() {
        let err = ErrorResponse::error(
            "UNKNOWN_ERROR",
            "Something went wrong"
        );
        assert_eq!(err.code, "UNKNOWN_ERROR");
        assert_eq!(err.message, "Something went wrong");
    }

    #[test]
    fn test_error_with_no_context() {
        let err = ErrorResponse::error("UNKNOWN_ERROR", "Generic error");
        assert_eq!(err.code, "UNKNOWN_ERROR");
        assert_eq!(err.message, "Generic error");
    }

    #[test]
    fn test_serialize() {
        let err = ErrorResponse::error("UNKNOWN_ERROR", "Test error");
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"code\":\"UNKNOWN_ERROR\""));
        assert!(json.contains("\"message\":\"Test error\""));
    }

    #[test]
    fn test_deserialize() {
        let json = r#"{"code":"UNKNOWN_ERROR","message":"error msg"}"#;
        let err: ErrorResponse = serde_json::from_str(json).unwrap();
        assert_eq!(err.code, "UNKNOWN_ERROR");
        assert_eq!(err.message, "error msg");
    }

    #[test]
    fn test_clone() {
        let err = ErrorResponse::error("UNKNOWN_ERROR", "Clone test");
        let cloned = err.clone();
        assert_eq!(err, cloned);
    }
}
