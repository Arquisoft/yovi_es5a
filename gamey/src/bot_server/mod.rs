//! HTTP server for Y game bots.

pub mod choose;
pub mod error;
pub mod state;
pub mod version;
use axum::response::IntoResponse;
use std::sync::Arc;
pub use choose::MoveResponse;
pub use error::ErrorResponse;
pub use version::*;

use crate::{GameYError, Medium, RandomBot, YBotRegistry, state::AppState};

use tower_http::cors::{Any, CorsLayer};
use axum::http::Method;

pub fn create_router(state: AppState) -> axum::Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    axum::Router::new()
        .route("/status", axum::routing::get(status))
        .route(
            "/{api_version}/ybot/choose/{bot_id}",
            axum::routing::post(choose::choose),
        )
        .with_state(state)
        .layer(cors)
}

/// Creates the default application state with the standard bot registry.
///
/// Includes `RandomBot` (easy) and `Medium` (medium difficulty).
pub fn create_default_state() -> AppState {
    let bots = YBotRegistry::new()
        .with_bot(Arc::new(RandomBot))
        .with_bot(Arc::new(Medium));  // ← registrar Medium
    AppState::new(bots)
}

pub async fn run_bot_server(port: u16) -> Result<(), GameYError> {
    let state = create_default_state();
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Failed to bind to {}: {}", addr, e),
        })?;

    println!("Server mode: Listening on http://{}", addr);
    axum::serve(listener, app)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Server error: {}", e),
        })?;

    Ok(())
}

pub async fn status() -> impl IntoResponse {
    "OK"
}