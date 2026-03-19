use crate::{Coordinates, GameY, YEN, check_api_version, error::ErrorResponse, state::AppState};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ChooseParams {
    api_version: String,
    bot_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct MoveResponse {
    pub api_version: String,
    pub bot_id: String,
    pub coords: Coordinates,
}

#[axum::debug_handler]
pub async fn choose(
    State(state): State<AppState>,
    Path(params): Path<ChooseParams>,
    Json(yen): Json<YEN>,
) -> Result<Json<MoveResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let game_y = match GameY::try_from(yen) {
        Ok(game) => game,
        Err(err) => {
            return Err(Json(ErrorResponse::error(
                &format!("Invalid YEN format: {}", err),
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    if game_y.check_game_over() {
        return Err(Json(ErrorResponse::error(
            "The game is already over, no moves can be made",
            Some(params.api_version),
            Some(params.bot_id),
        )));
    }

    let bot = match state.bots().find(&params.bot_id) {
        Some(bot) => bot,
        None => {
            let available_bots = state.bots().names().join(", ");
            return Err(Json(ErrorResponse::error(
                &format!(
                    "Bot not found: {}, available bots: [{}]",
                    params.bot_id, available_bots
                ),
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    // Pedir movimientos al bot hasta obtener una celda libre.
    // Usar is_occupied() es O(1) gracias al HashMap interno de GameY.
    // Si el bot devuelve None, el tablero está lleno.
    let coords = loop {
        match bot.choose_move(&game_y) {
            None => {
                return Err(Json(ErrorResponse::error(
                    "No valid moves available for the bot",
                    Some(params.api_version),
                    Some(params.bot_id),
                )));
            }
            Some(candidate) if !game_y.is_occupied(&candidate) => {
                break candidate;
            }
            Some(_) => {
                // Celda ocupada: volver a pedir al bot
            }
        }
    };

    Ok(Json(MoveResponse {
        api_version: params.api_version,
        bot_id: params.bot_id,
        coords,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_move_response_creation() {
        let response = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(1, 2, 3),
        };
        assert_eq!(response.api_version, "v1");
        assert_eq!(response.bot_id, "random");
        assert_eq!(response.coords, Coordinates::new(1, 2, 3));
    }

    #[test]
    fn test_move_response_serialize() {
        let response = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(1, 2, 3),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"api_version\":\"v1\""));
        assert!(json.contains("\"bot_id\":\"random\""));
    }

    #[test]
    fn test_move_response_deserialize() {
        let json = r#"{"api_version":"v1","bot_id":"test","coords":{"x":0,"y":1,"z":2}}"#;
        let response: MoveResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.api_version, "v1");
        assert_eq!(response.bot_id, "test");
    }

    #[test]
    fn test_move_response_clone() {
        let response = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(0, 0, 0),
        };
        let cloned = response.clone();
        assert_eq!(response, cloned);
    }

    #[test]
    fn test_move_response_equality() {
        let r1 = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(1, 1, 1),
        };
        let r2 = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(1, 1, 1),
        };
        let r3 = MoveResponse {
            api_version: "v2".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(1, 1, 1),
        };
        assert_eq!(r1, r2);
        assert_ne!(r1, r3);
    }
}
