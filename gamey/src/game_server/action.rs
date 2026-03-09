use crate::{
    Coordinates, GameStatus, GameY, GameYError, Movement, PlayerId, YEN,
    game_server::game_error::ErrorResponse,
};
use axum::Json;
use serde::{Deserialize, Serialize};

// ── Estructuras de entrada ──────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BoardDto {
    pub size: u32,
    pub turn: u32,
    pub players: Vec<char>,
    pub layout: String,
}

impl From<BoardDto> for YEN {
    fn from(b: BoardDto) -> Self {
        YEN::new(b.size, b.turn, b.players, b.layout)
    }
}

impl From<YEN> for BoardDto {
    fn from(y: YEN) -> Self {
        BoardDto {
            size: y.size(),
            turn: y.turn(),
            players: y.players().to_vec(),
            layout: y.layout().to_string(),
        }
    }
}

#[derive(Deserialize, Debug)]
pub struct SelectedCell {
    #[serde(rename = "cellIndex")]
    pub cell_index: u32,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "mode")]
pub enum PlayRequest {
    #[serde(rename = "1vs1")]
    TwoPlayer {
        board: BoardDto,
        #[serde(rename = "selectedCell")]
        selected_cell: SelectedCell,
    },
    #[serde(rename = "1vsbot")]
    VsBot {
        board: BoardDto,
        #[serde(rename = "selectedCell")]
        selected_cell: SelectedCell,
        difficulty: Option<String>,
    },
}

// ── Estructuras de salida ───────────────────────────────────────────────────

#[derive(Serialize, Debug)]
pub struct TwoPlayerResponse {
    #[serde(rename = "isValidMove")]
    pub is_valid_move: bool,
    #[serde(rename = "hasWon")]
    pub has_won: bool,
    pub message: String,
}

#[derive(Serialize, Debug)]
pub struct BotMoveResponse {
    #[serde(rename = "isValidMove")]
    pub is_valid_move: bool,
    pub board: BoardDto,
    #[serde(rename = "hasPlayerWon")]
    pub has_player_won: bool,
    #[serde(rename = "hasBotWon")]
    pub has_bot_won: bool,
    pub message: String,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn coords_from_cell(cell: &SelectedCell, board_size: u32) -> Coordinates {
    Coordinates::from_index(cell.cell_index, board_size)
}

// ── Handler principal ────────────────────────────────────────────────────────

pub async fn play(
    Json(request): Json<PlayRequest>,
) -> Result<axum::response::Response, Json<ErrorResponse>> {
    // ── Logging de la petición entrante ──
    match &request {
        PlayRequest::TwoPlayer { board, selected_cell } => {
            println!(
                "📥 [1vs1] size={} turn={} players={:?} layout={} cellIndex={}",
                board.size, board.turn, board.players, board.layout, selected_cell.cell_index
            );
        }
        PlayRequest::VsBot { board, selected_cell, difficulty } => {
            println!(
                "📥 [1vsbot] size={} turn={} players={:?} layout={} cellIndex={} difficulty={:?}",
                board.size, board.turn, board.players, board.layout, selected_cell.cell_index, difficulty
            );
        }
    }

    match request {
        PlayRequest::TwoPlayer { board, selected_cell } => {
            handle_two_player(board, selected_cell).await
        }
        PlayRequest::VsBot { board, selected_cell, difficulty } => {
            handle_vs_bot(board, selected_cell, difficulty).await
        }
    }
}

async fn handle_two_player(
    board: BoardDto,
    selected_cell: SelectedCell,
) -> Result<axum::response::Response, Json<ErrorResponse>> {
    use axum::response::IntoResponse;

    let board_size = board.size;
    let player_id = board.turn;
    let yen: YEN = board.into();

    let mut game_y = GameY::try_from(yen).map_err(|e| {
        println!("❌ Board inválido: {}", e);
        Json(ErrorResponse::error(&format!("Invalid board: {}", e), None))
    })?;

    let coords = coords_from_cell(&selected_cell, board_size);
    let result = game_y.add_move(Movement::Placement {
        player: PlayerId::new(player_id),
        coords,
    });

    let (is_valid_move, has_won) = match result {
        Ok(()) => {
            let won = matches!(game_y.status(), GameStatus::Finished { .. });
            (true, won)
        }
        Err(GameYError::Occupied { .. }) => (false, false),
        Err(e) => {
            println!("❌ Error al mover: {}", e);
            return Err(Json(ErrorResponse::error(&format!("Error: {}", e), None)));
        }
    };

    println!("✅ [1vs1] isValidMove={} hasWon={}", is_valid_move, has_won);

    Ok(Json(TwoPlayerResponse {
        is_valid_move,
        has_won,
        message: if has_won {
            "Player wins!".to_string()
        } else if is_valid_move {
            "Valid move.".to_string()
        } else {
            "Invalid move: cell is occupied.".to_string()
        },
    })
    .into_response())
}

async fn handle_vs_bot(
    board: BoardDto,
    selected_cell: SelectedCell,
    _difficulty: Option<String>,
) -> Result<axum::response::Response, Json<ErrorResponse>> {
    use axum::response::IntoResponse;

    let board_size = board.size;
    let player_id = board.turn;
    let yen: YEN = board.into();

    let mut game_y = GameY::try_from(yen).map_err(|e| {
        println!("❌ Board inválido: {}", e);
        Json(ErrorResponse::error(&format!("Invalid board: {}", e), None))
    })?;

    let coords = coords_from_cell(&selected_cell, board_size);
    let result = game_y.add_move(Movement::Placement {
        player: PlayerId::new(player_id),
        coords,
    });

    let (is_valid_move, has_player_won) = match result {
        Ok(()) => {
            let won = matches!(game_y.status(), GameStatus::Finished { .. });
            (true, won)
        }
        Err(GameYError::Occupied { .. }) => (false, false),
        Err(e) => {
            println!("❌ Error al mover: {}", e);
            return Err(Json(ErrorResponse::error(&format!("Error: {}", e), None)));
        }
    };

    let has_bot_won = false; // TODO: lógica del bot

    let updated_board: BoardDto = YEN::from(&game_y).into();

    println!(
        "✅ [1vsbot] isValidMove={} hasPlayerWon={} newLayout={}",
        is_valid_move, has_player_won, updated_board.layout
    );

    Ok(Json(BotMoveResponse {
        is_valid_move,
        board: updated_board,
        has_player_won,
        has_bot_won,
        message: if has_player_won {
            "Player wins!".to_string()
        } else if is_valid_move {
            "Move accepted.".to_string()
        } else {
            "Invalid move: cell is occupied.".to_string()
        },
    })
    .into_response())
}
