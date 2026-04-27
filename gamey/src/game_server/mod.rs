pub mod game_error;
pub mod action;

use crate::{GameYError, game_server::action::place};

use tower_http::cors::{Any, CorsLayer};
use axum::http::Method;

/// Crea el servidor del juego
fn create_router() -> axum::Router {

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);


    axum::Router::new()
        .route("/health", axum::routing::get(health))
        .route("/game/play/", axum::routing::post(place))
        .layer(cors) 
}

/// Lanza el servidor del juego
pub async fn run_game_server(port: u16) -> Result<(), GameYError> {
    let app = create_router();

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

async fn health() -> &'static str {
    "ok"
}