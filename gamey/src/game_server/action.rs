use crate::{Coordinates, GameStatus, GameY, GameYError, Movement, PlayerId, YEN, game_server::{game_error::ErrorResponse}};
use axum::{
    Json
};
use serde::{Deserialize, Serialize};

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

/// Cuerpo de las peticiones HTTP para realizar una jugada
#[derive(Deserialize)]
pub struct PlaceRequest {
    /// Estado actual del juego
    board: BoardDto,
    /// Coordenadas de la jugada
    #[serde(rename = "selectedCell")]
    selected_cell: BodyCoords,
    /// Modo de juego
    mode: String
}

// Coordenadas pasadas en el cuerpo de la petición
#[derive(Deserialize, Debug)]
pub struct BodyCoords {
    /// Columna
    pub q: u32,
    /// Fila
    pub r: u32,
}

// Respuesta tras un movimiento de un jugador
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct MoveResponse {
    // Indica si el movimiento es válido o no
    #[serde(rename = "isValidMove")]
    pub is_valid_move : bool,
    // Indica si el movimiento es para ganar la partida o no
    #[serde(rename = "hasWon")]
    pub has_won : bool,
    // Mensaje informativo sobre el movimiento realizado
    pub message : String
}
// transforma las coordenadas q y r al formato (x,y,z) donde 
//x=distancia con el lado de abajo,y=distancia con el lado de la izquierda, z=distancia con el lado de la derecha
pub fn axial_to_trilinear(q: u32, r: u32, n: u32) -> Result<(u32, u32, u32), String> {
    // x = distancia al lado de abajo
    let x = q;

    // Caso especial: vértice ápex (única celda con r = 0)
    if r == 0 {
        if q != n - 1 {
            return Err(format!(
                "r=0 solo es válido para el ápex en q={}, recibido q={q}",
                n - 1
            ));
        }
        return Ok((x, 0, 0));
    }

    // Validar que r esté dentro del rango [1, n - q]
    let r_max = n.saturating_sub(q);
    if r > r_max {
        return Err(format!(
            "Coordenadas fuera del triángulo: q={q}, r={r} (máximo r={r_max} para q={q})"
        ));
    }

    // z = distancia al lado derecho  → 0 cuando r es máximo (celda más a la derecha)
    let z = n - q - r; // seguro: r <= n - q garantizado arriba

    // y = distancia al lado izquierdo → 0 cuando r = 1 (celda más a la izquierda)
    let y = r - 1; // seguro: r >= 1 garantizado arriba

    Ok((x, y, z))
}

/// Comprueba si la acción realizada por el jugador es válida o no, y si es para ganar.
pub async fn place(
    Json(place): Json<PlaceRequest>
) -> Result<Json<MoveResponse>, Json<ErrorResponse>> {
    let yen : YEN = place.board.into();
    // Se extrae el turno actual y el tamaño del tablero
    let turn = yen.turn();
    let size = yen.size();
    // Se inicializa el tablero a partir de los parámetros recibidos 
    let mut game_y = match GameY::try_from(yen) {
        Ok(game) => game,
        Err(err) => {
            return Err(Json(ErrorResponse::error(
                &format!("Formato YEN inválido: {}", err),
            )));
        }
    };
    let mut is_valid = false;
    let mut has_won = false;
    let message ;
    println!(
        "org: ({}, {})",
        place.selected_cell.q, 
        place.selected_cell.r
    );
    let (a, b, c) = axial_to_trilinear(place.selected_cell.q, place.selected_cell.r, size).expect("coordenadas transformadas inválidas");
    let coords = Coordinates::new(a,b,c);
    println!(
        "coords: ({}, {}, {})",
        coords.x(),
        coords.y(),
        coords.z()
    );
    match game_y.add_move(Movement::Placement {
            player: PlayerId::new(turn),
            coords,
    }) {
        Ok(()) => {
            is_valid = true;
            match game_y.status() {
                GameStatus::Finished { .. } => {
                    has_won = true;
                    message = "Movimiento ganador";
                },
                GameStatus::Ongoing { .. } => message = "Movimiento válido"
            }
        }
        Err(GameYError::Occupied { .. }) => { 
            message = "Movimiento inválido"
        }
        Err(_e) => {
            return Err(Json(ErrorResponse::error(
                "Se ha producido un error al realizar la jugada"
            )));
        }
    };
    let response = MoveResponse {
        is_valid_move : is_valid,
        has_won,
        message : message.to_string()
    };
    Ok(Json(response))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::Json;
    use serde_json::json;

    // Constructor YEN para pruebas 
    fn yen(size: u32, turn: u32, rows: &[&str]) -> YEN {
        let layout = rows.join("/");
        YEN::new(size, turn, vec!['A', 'B'], layout)
    }

    #[tokio::test]
    async fn test_valid_move() {
        // Tablero triangular vacío de tamaño 3
        // .../../.
        let yen = yen(4, 0, &[".", "..", "...", "...."]);

        let body = json!({
            "game": yen,
            "coords": { "q": 0, "r": 0 }
        });

        let response = place(Json(serde_json::from_value(body).unwrap()))
            .await
            .unwrap()
            .0;

        assert_eq!(response.is_valid_move, true);
        assert_eq!(response.has_won, false);
        assert_eq!(response.message, "Movimiento válido");
    }

    #[tokio::test]
    async fn test_invalid_move_occupied() {
        // Celda (2,0,0) ocupada
        // B/../...
        let yen = yen(4, 1, &["B", "..", "...", "...."]);

        let body = json!({
            "game": yen,
            "coords": { "q": 0, "r": 0 }
        });

        let response = place(Json(serde_json::from_value(body).unwrap()))
            .await
            .unwrap()
            .0;

        assert_eq!(response.is_valid_move, false);
        assert_eq!(response.has_won, false);
        assert_eq!(response.message, "Movimiento inválido");
    }

    #[tokio::test]
    async fn test_winning_move() {
        // Estado donde el siguiente movimiento gana
        // B/.B/..B
        let yen = yen(4, 0, &["B", ".B", ".B.", "...."]);

        let body = json!({
            "game": yen,
            "coords": { "q": 1, "r": 3 }
        });

        let response = place(Json(serde_json::from_value(body).unwrap()))
            .await
            .unwrap()
            .0;

        assert_eq!(response.is_valid_move, true);
        assert_eq!(response.has_won, true);
        assert_eq!(response.message, "Movimiento ganador");
    }

    #[tokio::test]
    async fn test_invalid_layout() {
        // Layout no triangular
        let yen = yen(3, 0, &["...", "....", "..."]);

        let body = json!({
            "game": yen,
            "coords": { "q": 0, "r": 0 }
        });

        let err = place(Json(serde_json::from_value(body).unwrap()))
            .await
            .unwrap_err()
            .0;

        assert!(err.message.contains("Formato YEN inválido"));
    }

}
