use crate::{
    check_api_version,
    error::ErrorResponse,
    state::AppState,
    Coordinates,
    GameStatus,
    GameY,
    Movement,
    PlayerId,
    YEN,
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};

type ApiError = (StatusCode, Json<ErrorResponse>);

fn bad_request(err: ErrorResponse) -> ApiError {
    (StatusCode::BAD_REQUEST, Json(err))
}

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
    #[serde(rename = "hasWon")]
    pub has_won: bool,
}

#[axum::debug_handler]
pub async fn choose(
    State(state): State<AppState>,
    Path(params): Path<ChooseParams>,
    Json(yen): Json<YEN>,
) -> Result<Json<MoveResponse>, ApiError> {
    check_api_version(&params.api_version).map_err(bad_request)?;

    let turn = yen.turn();

    let game_y = match GameY::try_from(yen) {
        Ok(game) => game,
        Err(err) => {
            return Err(bad_request(ErrorResponse::error(
                &format!("Invalid YEN format: {}", err),
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    if game_y.check_game_over() {
        return Err(bad_request(ErrorResponse::error(
            "The game is already over, no moves can be made",
            Some(params.api_version),
            Some(params.bot_id),
        )));
    }

    let bot = match state.bots().find(&params.bot_id) {
        Some(bot) => bot,
        None => {
            let available_bots = state.bots().names().join(", ");
            return Err(bad_request(ErrorResponse::error(
                &format!(
                    "Bot not found: {}, available bots: [{}]",
                    params.bot_id, available_bots
                ),
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    let coords = loop {
        match bot.choose_move(&game_y) {
            None => {
                return Err(bad_request(ErrorResponse::error(
                    "No valid moves available for the bot",
                    Some(params.api_version),
                    Some(params.bot_id),
                )));
            }
            Some(candidate) if !game_y.is_occupied(&candidate) => break candidate,
            Some(_) => {}
        }
    };

    let mut simulated_game = game_y.clone();

    if let Err(err) = simulated_game.add_move(Movement::Placement {
        player: PlayerId::new(turn),
        coords: coords.clone(),
    }) {
        return Err(bad_request(ErrorResponse::error(
            &format!("The bot selected an invalid move: {}", err),
            Some(params.api_version),
            Some(params.bot_id),
        )));
    }

    let has_won = matches!(simulated_game.status(), GameStatus::Finished { .. });
    println!("{has_won}");
    Ok(Json(MoveResponse {
        api_version: params.api_version,
        bot_id: params.bot_id,
        coords,
        has_won,
    }))
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::{YBotRegistry, RandomBot};
    use axum::{
        Router,
        body::Body,
        http::{Request, StatusCode},
        routing::post,
    };
    use std::sync::Arc;
    use tower::ServiceExt;

    // ─── Helpers ───────────────────────────────────────────────────────────────

    fn state_with_random_bot() -> AppState {
        let registry = YBotRegistry::new().with_bot(Arc::new(RandomBot));
        AppState::new(registry)
    }

    fn state_empty() -> AppState {
        AppState::new(YBotRegistry::new())
    }

    fn app(state: AppState) -> Router {
        Router::new()
            .route("/{api_version}/{bot_id}/choose", post(choose))
            .with_state(state)
    }

    fn empty_yen_json() -> &'static str {
        r#"{"size":3,"turn":0,"players":["B","R"],"layout":"./../..."}"#
    }

    fn build_request(api_version: &str, bot_id: &str, body: &str) -> Request<Body> {
        Request::builder()
            .method("POST")
            .uri(format!("/{}/{}/choose", api_version, bot_id))
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .unwrap()
    }

    fn axial_to_trilinear(q: u32, r: u32, n: u32) -> Option<(u32, u32, u32)> {
        let x = q;
        if r == 0 {
            if q != n - 1 { return None; }
            return Some((x, 0, 0));
        }
        let r_max = n.saturating_sub(q);
        if r > r_max { return None; }
        let z = n - q - r;
        let y = r - 1;
        Some((x, y, z))
    }

    // ─── MoveResponse — struct tests ───────────────────────────────────────────

    #[test]
    fn test_move_response_creation() {
        let (x, y, z) = axial_to_trilinear(2, 0, 3).unwrap();
        let response = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random_bot".to_string(),
            coords: Coordinates::new(x, y, z),
            has_won: false,
        };
        assert_eq!(response.api_version, "v1");
        assert_eq!(response.bot_id, "random_bot");
        assert_eq!(response.coords, Coordinates::new(2, 0, 0));
        assert!(!response.has_won);
    }

    #[test]
    fn test_move_response_serialize_has_won_false() {
        let (x, y, z) = axial_to_trilinear(0, 1, 3).unwrap();
        let response = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random_bot".to_string(),
            coords: Coordinates::new(x, y, z),
            has_won: false,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"api_version\":\"v1\""));
        assert!(json.contains("\"bot_id\":\"random_bot\""));
        assert!(json.contains("\"hasWon\":false"));
    }

    #[test]
    fn test_move_response_serialize_has_won_true() {
        let (x, y, z) = axial_to_trilinear(0, 1, 3).unwrap();
        let response = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random_bot".to_string(),
            coords: Coordinates::new(x, y, z),
            has_won: true,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"hasWon\":true"));
    }

    #[test]
    fn test_move_response_deserialize() {
        let json =
            r#"{"api_version":"v1","bot_id":"test","coords":{"x":1,"y":0,"z":1},"hasWon":false}"#;
        let response: MoveResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.api_version, "v1");
        assert_eq!(response.bot_id, "test");
        let (x, y, z) = axial_to_trilinear(1, 1, 3).unwrap();
        assert_eq!(response.coords, Coordinates::new(x, y, z));
        assert!(!response.has_won);
    }

    #[test]
    fn test_move_response_clone_and_equality() {
        let (x, y, z) = axial_to_trilinear(0, 2, 3).unwrap();
        let r1 = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random_bot".to_string(),
            coords: Coordinates::new(x, y, z),
            has_won: false,
        };
        assert_eq!(r1.clone(), r1);
    }

    #[test]
    fn test_move_response_inequality_on_api_version() {
        let (x, y, z) = axial_to_trilinear(0, 2, 3).unwrap();
        let r1 = MoveResponse {
            api_version: "v1".to_string(),
            bot_id: "random_bot".to_string(),
            coords: Coordinates::new(x, y, z),
            has_won: false,
        };
        let r2 = MoveResponse { api_version: "v2".to_string(), ..r1.clone() };
        assert_ne!(r1, r2);
    }

    // ─── axial_to_trilinear helper ─────────────────────────────────────────────

    #[test]
    fn test_axial_apex_converts_correctly() {
        assert_eq!(axial_to_trilinear(2, 0, 3), Some((2, 0, 0)));
        assert_eq!(axial_to_trilinear(4, 0, 5), Some((4, 0, 0)));
    }

    #[test]
    fn test_axial_base_left_converts_correctly() {
        assert_eq!(axial_to_trilinear(0, 1, 3), Some((0, 0, 2)));
    }

    #[test]
    fn test_axial_base_right_converts_correctly() {
        assert_eq!(axial_to_trilinear(0, 3, 3), Some((0, 2, 0)));
    }

    #[test]
    fn test_axial_invalid_r0_non_apex_returns_none() {
        assert_eq!(axial_to_trilinear(0, 0, 3), None);
        assert_eq!(axial_to_trilinear(1, 0, 3), None);
    }

    #[test]
    fn test_axial_out_of_bounds_returns_none() {
        assert_eq!(axial_to_trilinear(0, 4, 3), None);
        assert_eq!(axial_to_trilinear(1, 3, 3), None);
    }

    // ─── Handler — API version inválida ────────────────────────────────────────

    #[tokio::test]
    async fn test_handler_invalid_api_version_returns_error() {
        let app = app(state_with_random_bot());
        let req = build_request("v99", "random_bot", empty_yen_json());

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
        assert!(err.message.contains("Unsupported API version"));
        assert_eq!(err.api_version, Some("v99".to_string()));
    }

    // ─── Handler — bot no encontrado ───────────────────────────────────────────

    #[tokio::test]
    async fn test_handler_unknown_bot_returns_error() {
        let app = app(state_with_random_bot());
        let req = build_request("v1", "ghost_bot", empty_yen_json());

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
        assert!(err.message.contains("Bot not found"));
        assert!(err.message.contains("ghost_bot"));
        assert_eq!(err.bot_id, Some("ghost_bot".to_string()));
    }

    #[tokio::test]
    async fn test_handler_unknown_bot_lists_available_bots() {
        let app = app(state_with_random_bot());
        let req = build_request("v1", "nonexistent", empty_yen_json());

        let response = app.oneshot(req).await.unwrap();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
        assert!(err.message.contains("random_bot"));
    }

    #[tokio::test]
    async fn test_handler_no_bots_registered_returns_error() {
        let app = app(state_empty());
        let req = build_request("v1", "random_bot", empty_yen_json());

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
        assert!(err.message.contains("Bot not found"));
    }

    // ─── Handler — YEN inválido ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_handler_invalid_json_body_returns_error() {
        let app = app(state_with_random_bot());
        let req = build_request("v1", "random_bot", "this is not json");

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_handler_malformed_yen_returns_error() {
        let app = app(state_with_random_bot());
        let bad_yen = r#"{"size":3,"turn":0,"players":["B","R"],"layout":"INVALID"}"#;
        let req = build_request("v1", "random_bot", bad_yen);

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
        assert!(err.message.contains("Invalid YEN format"));
    }

    // ─── Handler — juego ya terminado ─────────────────────────────────────────

    #[tokio::test]
    async fn test_handler_game_already_over_returns_error() {
        let app = app(state_with_random_bot());
        let finished_yen = r#"{"size":3,"turn":1,"players":["B","R"],"layout":"B/B./B.."}"#;
        let req = build_request("v1", "random_bot", finished_yen);

        let response = app.oneshot(req).await.unwrap();
        if response.status() == StatusCode::BAD_REQUEST {
            let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
            let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
            assert!(err.message.contains("already over"));
        }
    }

    // ─── Handler — movimiento válido ───────────────────────────────────────────

    #[tokio::test]
    async fn test_handler_valid_request_returns_200() {
        let app = app(state_with_random_bot());
        let req = build_request("v1", "random_bot", empty_yen_json());

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_handler_response_contains_correct_api_version_and_bot_id() {
        let app = app(state_with_random_bot());
        let req = build_request("v1", "random_bot", empty_yen_json());

        let response = app.oneshot(req).await.unwrap();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let mv: MoveResponse = serde_json::from_slice(&body).unwrap();

        assert_eq!(mv.api_version, "v1");
        assert_eq!(mv.bot_id, "random_bot");
    }

    #[tokio::test]
    async fn test_handler_returned_coords_satisfy_invariant() {
        let app = app(state_with_random_bot());
        let req = build_request("v1", "random_bot", empty_yen_json());

        let response = app.oneshot(req).await.unwrap();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let mv: MoveResponse = serde_json::from_slice(&body).unwrap();

        let size = 3u32;
        let x = mv.coords.x();
        let y = mv.coords.y();
        let z = mv.coords.z();
        assert_eq!(
            x + y + z, size - 1,
            "trilinear coords ({x},{y},{z}) must satisfy x+y+z == size-1"
        );
    }

    #[tokio::test]
    async fn test_handler_has_won_is_false_on_empty_board() {
        let app = app(state_with_random_bot());
        let req = build_request("v1", "random_bot", empty_yen_json());

        let response = app.oneshot(req).await.unwrap();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let mv: MoveResponse = serde_json::from_slice(&body).unwrap();

        assert!(!mv.has_won);
    }
}