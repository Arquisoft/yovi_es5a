use crate::{
    check_api_version,
    error::ErrorResponse,
    state::AppState,
    Coordinates,
    GameY,
    Movement,
    PlayerId,
    YEN,
};
use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};


const DEFAULT_BOT: &str = "hard_bot";


/// Path parameters for the play endpoint.
/// `bot_id` is optional — if omitted, hard_bot (maximum difficulty) will be used.
#[derive(Deserialize)]
pub struct PlayParams {
    api_version: String,
    #[serde(default)]
    bot_id: Option<String>,
}


/// Query parameters for the play endpoint.
/// `position` carries the full YEN payload as a URL-encoded JSON string.
#[derive(Deserialize)]
pub struct PlayQuery {
    position: String,
}


/// Response returned by the play endpoint.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PlayResponse {
    pub api_version: String,
    pub bot_id: String,
    /// The move the bot chose, in barycentric coordinates.
    pub coords: Coordinates,
    /// The updated board state after the bot's move, in YEN notation.
    pub position: YEN,
}


/// GET /{api_version}/play/{bot_id}?position=<url-encoded-json>  (bot_id optional)
///
/// Receives the current board position in YEN notation as a JSON-encoded
/// query parameter `position`, lets the specified bot (or hard_bot by default)
/// choose a move, applies it, and returns the resulting position together
/// with the chosen coordinates.
#[axum::debug_handler]
pub async fn play(
    State(state): State<AppState>,
    Path(params): Path<PlayParams>,
    Query(query): Query<PlayQuery>,
) -> Result<Json<PlayResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    // Resolve bot_id: use provided value or fall back to hard_bot (maximum difficulty).
    let bot_id = match &params.bot_id {
        Some(id) => id.clone(),
        None => DEFAULT_BOT.to_string(),
    };

    // Deserialize YEN from the `position` query parameter.
    let yen: YEN = match serde_json::from_str(&query.position) {
        Ok(y) => y,
        Err(err) => {
            return Err(Json(ErrorResponse::error(
                &format!("Invalid JSON in `position` parameter: {}", err),
                Some(params.api_version),
                Some(bot_id),
            )));
        }
    };

    let turn = yen.turn();

    // Parse YEN into a GameY instance.
    let game_y = match GameY::try_from(yen.clone()) {
        Ok(game) => game,
        Err(err) => {
            return Err(Json(ErrorResponse::error(
                &format!("Invalid YEN format: {}", err),
                Some(params.api_version),
                Some(bot_id),
            )));
        }
    };

    // Reject already-finished games.
    if game_y.check_game_over() {
        return Err(Json(ErrorResponse::error(
            "The game is already over, no moves can be made",
            Some(params.api_version),
            Some(bot_id),
        )));
    }

    // Look up the requested bot.
    let bot = match state.bots().find(&bot_id) {
        Some(bot) => bot,
        None => {
            let available_bots = state.bots().names().join(", ");
            return Err(Json(ErrorResponse::error(
                &format!(
                    "Bot not found: {}, available bots: [{}]",
                    bot_id, available_bots
                ),
                Some(params.api_version),
                Some(bot_id),
            )));
        }
    };

    // Ask the bot for a valid (unoccupied) move.
    let coords = loop {
        match bot.choose_move(&game_y) {
            None => {
                return Err(Json(ErrorResponse::error(
                    "No valid moves available for the bot",
                    Some(params.api_version),
                    Some(bot_id),
                )));
            }
            Some(candidate) if !game_y.is_occupied(&candidate) => break candidate,
            Some(_) => {}
        }
    };

    // Apply the move to produce the new game state.
    let mut updated_game = game_y.clone();

    if let Err(err) = updated_game.add_move(Movement::Placement {
        player: PlayerId::new(turn),
        coords: coords.clone(),
    }) {
        return Err(Json(ErrorResponse::error(
            &format!("The bot selected an invalid move: {}", err),
            Some(params.api_version),
            Some(bot_id),
        )));
    }

    let updated_yen = YEN::from(&updated_game);

    Ok(Json(PlayResponse {
        api_version: params.api_version,
        bot_id,
        coords,
        position: updated_yen,
    }))
}


#[cfg(test)]
mod tests {

    use crate::{YBot, YBotRegistry};
    use super::*;
    use axum::extract::Query;
    use std::sync::Mutex;
    use std::sync::Arc;


    fn sample_yen() -> YEN {
        YEN::new(3, 0, vec!['B', 'R'], ".../.../...".to_string())
    }

    fn yen_to_query(yen: &YEN) -> PlayQuery {
        PlayQuery {
            position: serde_json::to_string(yen).unwrap(),
        }
    }

    #[test]
    fn test_default_bot_is_hard() {
        assert_eq!(DEFAULT_BOT, "hard_bot");
    }

    #[test]
    fn test_play_response_creation() {
        let response = PlayResponse {
            api_version: "v1".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(1, 1, 1),
            position: sample_yen(),
        };
        assert_eq!(response.api_version, "v1");
        assert_eq!(response.bot_id, "random");
        assert_eq!(response.coords, Coordinates::new(1, 1, 1));
    }

    #[test]
    fn test_play_response_serialize() {
        let response = PlayResponse {
            api_version: "v1".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(0, 0, 0),
            position: sample_yen(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"position\""));
        assert!(json.contains("\"coords\""));
        assert!(!json.contains("hasWon"));
    }

    #[test]
    fn test_play_response_serialize_roundtrip() {
        let response = PlayResponse {
            api_version: "v1".to_string(),
            bot_id: "test-bot".to_string(),
            coords: Coordinates::new(1, 0, 2),
            position: sample_yen(),
        };
        let json = serde_json::to_string(&response).unwrap();
        let deserialized: PlayResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(response.api_version, deserialized.api_version);
        assert_eq!(response.bot_id, deserialized.bot_id);
        assert_eq!(response.coords, deserialized.coords);
    }

    #[test]
    fn test_play_response_clone() {
        let response = PlayResponse {
            api_version: "v1".to_string(),
            bot_id: "random".to_string(),
            coords: Coordinates::new(0, 0, 0),
            position: sample_yen(),
        };
        let cloned = response.clone();
        assert_eq!(response.api_version, cloned.api_version);
        assert_eq!(response.bot_id, cloned.bot_id);
        assert_eq!(response.coords, cloned.coords);
    }

    fn build_state_with_registry(registry: YBotRegistry) -> AppState {
        AppState::new(registry)
    }

    fn valid_params(bot_id: Option<&str>) -> PlayParams {
        PlayParams {
            api_version: "v1".to_string(),
            bot_id: bot_id.map(|s| s.to_string()),
        }
    }

    fn valid_yen() -> YEN {
        YEN::new(
            3,
            0,
            vec!['R', 'B'],
            "./.B/.RB".to_string(),
        )
    }

    fn finished_yen() -> YEN {
        YEN::new(3, 9, vec!['B', 'R'], "BBB/RRR/BBB".to_string())
    }

    struct TestBot {
        name: String,
        moves: Mutex<Vec<Option<Coordinates>>>,
    }

    impl TestBot {
        fn new(name: &str, moves: Vec<Option<Coordinates>>) -> Self {
            Self {
                name: name.to_string(),
                moves: Mutex::new(moves),
            }
        }
    }

    impl YBot for TestBot {
        fn name(&self) -> &str {
            &self.name
        }

        fn choose_move(&self, _board: &GameY) -> Option<Coordinates> {
            let mut moves = self.moves.lock().unwrap();
            if moves.is_empty() {
                None
            } else {
                moves.remove(0)
            }
        }
    }

    #[tokio::test]
    async fn test_bot_not_found() {
        let registry = YBotRegistry::new();
        let state = build_state_with_registry(registry);

        let result = play(
            State(state),
            Path(valid_params(Some("ghost"))),
            Query(yen_to_query(&valid_yen())),
        )
        .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_game_already_over() {
        let registry = YBotRegistry::new();
        let state = build_state_with_registry(registry);

        let result = play(
            State(state),
            Path(valid_params(None)),
            Query(yen_to_query(&finished_yen())),
        )
        .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_bot_without_moves() {
        let registry = YBotRegistry::new().with_bot(Arc::new(TestBot::new(
            "hard_bot",
            vec![None],
        )));
        let state = build_state_with_registry(registry);

        let result = play(
            State(state),
            Path(valid_params(None)),
            Query(yen_to_query(&valid_yen())),
        )
        .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_bot_skips_occupied_move() {
        let valid = Coordinates::new(0, 0, 0);
        let occupied = Coordinates::new(1, 1, 0);

        let bot = TestBot::new(
            "hard_bot",
            vec![Some(occupied), Some(valid.clone())],
        );

        let registry = YBotRegistry::new().with_bot(Arc::new(bot));
        let state = AppState::new(registry);

        let result = play(
            State(state),
            Path(valid_params(None)),
            Query(yen_to_query(&valid_yen())),
        )
        .await;

        assert!(result.is_ok());

        let Json(res) = result.unwrap();
        assert_eq!(res.coords, valid);
        assert_eq!(res.bot_id, "hard_bot");
    }

    #[tokio::test]
    async fn test_successful_play() {
        let coords = Coordinates::new(1, 1, 1);
        let bot = TestBot::new("hard_bot", vec![Some(coords.clone())]);
        let registry = YBotRegistry::new().with_bot(Arc::new(bot));
        let state = AppState::new(registry);

        let result = play(
            State(state),
            Path(valid_params(None)),
            Query(yen_to_query(&valid_yen())),
        )
        .await;

        assert!(result.is_ok());

        let Json(res) = result.unwrap();
        assert_eq!(res.coords, coords);
        assert_eq!(res.bot_id, "hard_bot");
    }

    #[tokio::test]
    async fn test_invalid_yen() {
        let registry = YBotRegistry::new();
        let state = build_state_with_registry(registry);

        let result = play(
            State(state),
            Path(valid_params(None)),
            Query(PlayQuery {
                position: "esto no es json válido".to_string(),
            }),
        )
        .await;

        assert!(result.is_err());
    }
}