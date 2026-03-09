pub mod game_error;
pub mod version;
pub mod action;

use crate::{GameYError, game_server::action::play};
use tower_http::cors::{Any, CorsLayer};
use axum::http::Method;
use axum::{body::Body, http::Request, middleware::{self, Next}, response::Response};

async fn log_request(request: Request<Body>, next: Next) -> Response {
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("📡 {} {}", request.method(), request.uri());
    println!("   Headers: {:?}", request.headers().get("content-type"));

    let (parts, body) = request.into_parts();
    let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap_or_default();
    println!("📦 Body: {}", String::from_utf8_lossy(&bytes));

    let request = Request::from_parts(parts, Body::from(bytes));
    let response = next.run(request).await;

    println!("📤 Status: {}", response.status());
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    response
}

fn create_router() -> axum::Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    axum::Router::new()
        .route("/game/play", axum::routing::post(play))
        .route("/game/play/", axum::routing::post(play))
        .layer(middleware::from_fn(log_request))
        .layer(cors)
}

pub async fn run_game_server(port: u16) -> Result<(), GameYError> {
    let app = create_router();
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Failed to bind to {}: {}", addr, e),
        })?;

    println!("🚀 Game server escuchando en http://{}", addr);
    axum::serve(listener, app)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Server error: {}", e),
        })?;

    Ok(())
}
