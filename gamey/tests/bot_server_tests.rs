use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use axum::http::HeaderValue;
use gamey::{
    create_default_state,
    create_router,
    ErrorResponse,
    MoveResponse,
    RandomBot,
    YBotRegistry,
    YEN,
    state::AppState,
    status,
};
use http_body_util::BodyExt;
use std::sync::Arc;
use tower::ServiceExt;
use axum::response::IntoResponse;

/// Helper to create a test app with the default state
fn test_app() -> axum::Router {
    create_router(create_default_state())
}

/// Helper to create a test app with a custom state
fn test_app_with_state(state: AppState) -> axum::Router {
    create_router(state)
}

fn valid_choose_yen() -> YEN {
    YEN::new(3, 0, vec!['B', 'R'], "./../...".to_string())
}

fn partially_filled_choose_yen() -> YEN {
    YEN::new(3, 2, vec!['B', 'R'], "B/R./.B.".to_string())
}

// ============================================================================
// Status endpoint tests
// ============================================================================

#[tokio::test]
async fn test_status_endpoint_returns_ok() {
    let app = test_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(&body[..], b"OK");
}

// ============================================================================
// Choose endpoint tests
// ============================================================================

#[tokio::test]
async fn test_choose_endpoint_with_valid_request_returns_success_or_error_json() {
    let app = test_app();
    let yen = valid_choose_yen();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/choose/random_bot")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&yen).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(value["api_version"], "v1");
    assert_eq!(value["bot_id"], "random_bot");

    if value.get("coords").is_some() {
        let move_response: MoveResponse = serde_json::from_value(value).unwrap();
        assert_eq!(move_response.api_version, "v1");
        assert_eq!(move_response.bot_id, "random_bot");
    } else {
        let error_response: ErrorResponse = serde_json::from_slice(&body).unwrap();
        assert_eq!(error_response.api_version, Some("v1".to_string()));
        assert_eq!(error_response.bot_id, Some("random_bot".to_string()));
        assert!(!error_response.message.is_empty());
    }
}

#[tokio::test]
async fn test_choose_endpoint_with_partially_filled_board_returns_success_or_error_json() {
    let app = test_app();
    let yen = partially_filled_choose_yen();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/choose/random_bot")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&yen).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(value["api_version"], "v1");
    assert_eq!(value["bot_id"], "random_bot");

    if value.get("coords").is_some() {
        let move_response: MoveResponse = serde_json::from_value(value).unwrap();
        assert_eq!(move_response.api_version, "v1");
        assert_eq!(move_response.bot_id, "random_bot");
    } else {
        let error_response: ErrorResponse = serde_json::from_slice(&body).unwrap();
        assert_eq!(error_response.api_version, Some("v1".to_string()));
        assert_eq!(error_response.bot_id, Some("random_bot".to_string()));
        assert!(!error_response.message.is_empty());
    }
}

#[tokio::test]
async fn test_choose_endpoint_with_invalid_api_version() {
    let app = test_app();
    let yen = valid_choose_yen();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v2/choose/random_bot")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&yen).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let error_response: ErrorResponse = serde_json::from_slice(&body).unwrap();

    assert!(error_response.message.contains("Unsupported API version"));
    assert_eq!(error_response.api_version, Some("v2".to_string()));
}

#[tokio::test]
async fn test_choose_endpoint_with_unknown_bot_returns_error_json() {
    let app = test_app();
    let yen = valid_choose_yen();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/choose/unknown_bot")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&yen).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let error_response: ErrorResponse = serde_json::from_slice(&body).unwrap();

    assert_eq!(error_response.api_version, Some("v1".to_string()));
    assert_eq!(error_response.bot_id, Some("unknown_bot".to_string()));
    assert!(!error_response.message.is_empty());
}

#[tokio::test]
async fn test_choose_endpoint_with_invalid_json() {
    let app = test_app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/choose/random_bot")
                .header("content-type", "application/json")
                .body(Body::from("{ invalid json }"))
                .unwrap(),
        )
        .await
        .unwrap();

    assert!(response.status().is_client_error());
}

#[tokio::test]
async fn test_choose_endpoint_with_missing_content_type() {
    let app = test_app();
    let yen = valid_choose_yen();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/choose/random_bot")
                .body(Body::from(serde_json::to_string(&yen).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert!(response.status().is_client_error());
}

// ============================================================================
// Custom state tests
// ============================================================================

#[tokio::test]
async fn test_choose_with_custom_bot_registry() {
    let bots = YBotRegistry::new().with_bot(Arc::new(RandomBot));
    let state = AppState::new(bots);
    let app = test_app_with_state(state);

    let yen = valid_choose_yen();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/choose/random_bot")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&yen).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_choose_with_empty_bot_registry_returns_error_json() {
    let bots = YBotRegistry::new();
    let state = AppState::new(bots);
    let app = test_app_with_state(state);

    let yen = valid_choose_yen();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/choose/random_bot")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&yen).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let error_response: ErrorResponse = serde_json::from_slice(&body).unwrap();

    assert_eq!(error_response.api_version, Some("v1".to_string()));
    assert_eq!(error_response.bot_id, Some("random_bot".to_string()));
    assert!(!error_response.message.is_empty());
}

// ============================================================================
// Route not found tests
// ============================================================================

#[tokio::test]
async fn test_unknown_route_returns_404() {
    let app = test_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/unknown/route")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_wrong_method_on_status_endpoint() {
    let app = test_app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
}

#[tokio::test]
async fn test_get_on_choose_endpoint_returns_method_not_allowed() {
    let app = test_app();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/v1/choose/random_bot")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
}

// ============================================================================
// Play endpoint tests
// ============================================================================

// Omitidos aquí a propósito porque:
// 1) create_play_router mete Prometheus y da WinError 10048 en tests de Windows
// 2) llamar al handler directamente requiere construir PlayParams,
//    pero sus campos son privados desde tests de integración externos

// ============================================================================
// CORS header tests
// ============================================================================

#[tokio::test]
async fn test_cors_headers_present_on_options() {
    let app = create_router(create_default_state());

    let response = app
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/v1/choose/random_bot")
                .header("Origin", "http://example.com")
                .header("Access-Control-Request-Method", "POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let headers = response.headers();
    assert_eq!(
        headers.get("access-control-allow-origin"),
        Some(&HeaderValue::from_static("*"))
    );
}

// ============================================================================
// Status endpoint returns & IntoResponse coverage
// ============================================================================

#[tokio::test]
async fn test_status_function_directly() {
    let resp = status().await.into_response();
    let (parts, body) = resp.into_parts();

    assert_eq!(parts.status, StatusCode::OK);

    let bytes = body.collect().await.unwrap().to_bytes();
    assert_eq!(&bytes[..], b"OK");
}