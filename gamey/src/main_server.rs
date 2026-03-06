use axum::{Router, routing::get, extract::State, Json};
use serde::Serialize;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use axum::http::Method;

// Importa tu estado y lógica del juego
use gamey::core::game::GameY;
use gamey::bot_server::state::AppState;

#[derive(Serialize)]
pub struct GameRenderState {
    pub board_size: u32,
    pub board_map: Vec<(String, u32)>, // (coordenadas, id jugador)
    pub next_player: Option<u32>,
    pub available_cells: Vec<u32>,
    pub history: Vec<String>, // serialización simple
}

/// Dummy game state para demo (reemplaza por extracción real)
fn get_demo_game() -> GameY {
    GameY::new(5)
}

async fn game_state(State(_state): State<AppState>) -> Json<GameRenderState> {
    let game = get_demo_game(); // TODO: extraer el estado real
    let board_map = game.board_map()
        .map(|(coords, (_set_idx, player))| (format!("{}", coords), player.id()))
        .collect();
    let history = game.history().map(|m| format!("{:?}", m)).collect();
    let render_state = GameRenderState {
        board_size: game.board_size(),
        board_map,
        next_player: game.next_player().map(|p| p.id()),
        available_cells: game.available_cells().clone(),
        history,
    };
    Json(render_state)
}

#[tokio::main]
async fn main() {
    // Inicializa el estado de la aplicación
    let state = AppState::new(gamey::YBotRegistry::new());
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/v1/game/state", get(game_state))
        .with_state(state)
        .layer(cors);

    let addr: std::net::SocketAddr = "0.0.0.0:3000".parse().unwrap();
    println!("Server listening on http://0.0.0.0:3000");
    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
