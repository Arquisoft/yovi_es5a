use crate::game_server::game_error::ErrorResponse;

/// Versión actual de la API.
pub const SUPPORTED_VERSION: &str = "v1";

/// Valida la versión de la API.
pub fn check_api_version(version: &str) -> Result<(), ErrorResponse> {
    if version != SUPPORTED_VERSION {
        Err(ErrorResponse::error(
            &format!(
                "Unsupported API version: {}. Supported version is {}",
                version, SUPPORTED_VERSION
            ),
            Some(version.to_string()),
        ))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_supported_version() {
        assert!(check_api_version("v1").is_ok());
    }

    #[test]
    fn test_unsupported_version_v2() {
        let result = check_api_version("v2");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.message.contains("Unsupported API version"));
        assert!(err.message.contains("v2"));
        assert_eq!(err.api_version, Some("v2".to_string()));
    }

    #[test]
    fn test_unsupported_version_empty() {
        let result = check_api_version("");
        assert!(result.is_err());
    }

    #[test]
    fn test_unsupported_version_random() {
        let result = check_api_version("random_version");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.api_version, Some("random_version".to_string()));
    }

    #[test]
    fn test_supported_version_constant() {
        assert_eq!(SUPPORTED_VERSION, "v1");
    }
}
