use crate::{Coordinates, GameStatus, GameY, GameYError, Movement, PlayerId, YEN, game_server::{game_error::ErrorResponse, version::check_api_version}};
use axum::{
    Json,
    extract::{Path},
};
use serde::{Deserialize, Serialize};

/// Parámetros extraidos de la URL.
#[derive(Deserialize)]
pub struct ActionParams {
    /// Versión de la API (e.g., "v1").
    api_version: String,
    /// Identificador de un jugador dentro de una partida.
    player_id: u32,
}

/// Cuerpo de las peticiones HTTP para realizar una jugada
#[derive(Deserialize)]
pub struct PlaceRequest {
    /// Estado actual del juego
    game: YEN,
    /// Coordenadas de la jugada
    coords: Coordinates
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct MoveResponse {
    /// Versión de la API usada para la petición.
    pub api_version: String,
    /// EL jugador que ha realizado la jugada.
    pub player_id: u32,
    /// El resultado de la jugada.
    pub state: MovementState
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum MovementState {
    Valid, Invalid, Win
}

/// Comprueba si la acción realizada por el jugador es válida o no, y si es para ganar.
pub async fn place(
    Path(params) : Path<ActionParams>,
    Json(place): Json<PlaceRequest>
) -> Result<Json<MoveResponse>, Json<ErrorResponse>> {
    // Comprueba la versión de la API
    check_api_version(&params.api_version)?;
    let mut game_y = match GameY::try_from(place.game) {
        Ok(game) => game,
        Err(err) => {
            return Err(Json(ErrorResponse::error(
                &format!("Invalid YEN format: {}", err),
                Some(params.api_version)
            )));
        }
    };
    // Determina si el movimiento realizado es válido o no
    let state: MovementState = match game_y.add_move(Movement::Placement {
            player: PlayerId::new(params.player_id),
            coords: place.coords,
    }) {
        Ok(()) => {
            match game_y.status() {
                GameStatus::Finished { .. } => MovementState::Win,
                GameStatus::Ongoing { .. } => MovementState::Valid
            }
        }
        Err(GameYError::Occupied { .. }) => { 
            MovementState::Invalid
        }
        Err(_e) => {
            return Err(Json(ErrorResponse::error(
                "Unkown error.",
                Some(params.api_version),
            )));
        }
    };
    let response = MoveResponse {
        api_version: params.api_version,
        player_id: params.player_id,
        state
    };
    Ok(Json(response))
}