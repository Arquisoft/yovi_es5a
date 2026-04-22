//! HTTP server for Y game bots.

pub mod choose;
pub mod error;
pub mod play;
pub mod state;
pub mod version;

use axum::response::IntoResponse;
use std::sync::Arc;
pub use choose::MoveResponse;
pub use error::ErrorResponse;
pub use play::PlayResponse;
pub use version::*;

use crate::{GameYError, Medium, Hard, RandomBot, YBotRegistry, state::AppState};
use axum_prometheus::PrometheusMetricLayer;

use tower_http::cors::{Any, CorsLayer};
use axum::http::Method;


fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any)
}


/// Router para la API de bots existente (choose).
pub fn create_router(state: AppState) -> axum::Router {
    axum::Router::new()
        .route("/status", axum::routing::get(status))
        .route(
            "/{api_version}/choose/{bot_id}",
            axum::routing::post(choose::choose),
        )
        .with_state(state)
        .layer(cors_layer())
}


/// Router para la nueva API de play (puerto separado) con métricas Prometheus.
pub fn create_play_router(state: AppState) -> axum::Router {
    let (prometheus_layer, metric_handle) = PrometheusMetricLayer::pair();

    axum::Router::new()
        .route("/metrics", axum::routing::get(move || async move {
            metric_handle.render()
        }))
        .route("/status", axum::routing::get(status))
        .route(
            "/{api_version}/play/{bot_id}",
            axum::routing::get(play::play),
        )
        .route(
            "/{api_version}/play",
            axum::routing::get(play::play),
        )
        .with_state(state)
        .layer(cors_layer())
        .layer(prometheus_layer)
}


/// Crea el estado por defecto con el registro de bots estándar.
pub fn create_default_state() -> AppState {
    let bots = YBotRegistry::new()
        .with_bot(Arc::new(RandomBot))
        .with_bot(Arc::new(Medium))
        .with_bot(Arc::new(Hard::default()));

    AppState::new(bots)
}


/// Levanta el servidor de bots existente (choose).
pub async fn run_bot_server(port: u16) -> Result<(), GameYError> {
    let state = create_default_state();
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Failed to bind to {}: {}", addr, e),
        })?;

    println!("Bot server (choose): Listening on http://{}", addr);
    axum::serve(listener, app)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Server error: {}", e),
        })?;

    Ok(())
}


/// Levanta el servidor de la nueva API de play en el puerto indicado.
pub async fn run_play_server(port: u16) -> Result<(), GameYError> {
    let state = create_default_state();
    let app = create_play_router(state);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Failed to bind to {}: {}", addr, e),
        })?;

    println!("Play API server: Listening on http://{}", addr);
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