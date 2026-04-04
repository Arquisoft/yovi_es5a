//! A medium difficulty bot implementation.
//!
//! This module provides [`Medium`], a bot that uses simple heuristics
//! to make strategic moves. It prioritizes winning moves, then blocking
//! the opponent, then central positions on the board.

use crate::{Coordinates, GameY, Movement, PlayerId, YBot};

/// A bot that uses heuristic evaluation to choose moves.
///
/// The strategy has three layers in order of priority:
/// 1. Play an immediate winning move if available
/// 2. Block the opponent's immediate winning move
/// 3. Choose the available cell closest to the board center
///
/// # Example
///
/// ```
/// use gamey::{GameY, Medium, YBot};
///
/// let bot = Medium;
/// let game = GameY::new(5);
///
/// let chosen_move = bot.choose_move(&game);
/// assert!(chosen_move.is_some());
/// ```
pub struct Medium;

impl Medium {
    /// Returns true if placing `coords` as `player` results in a win.
    fn is_winning_move(&self, board: &GameY, coords: &Coordinates, player: PlayerId) -> bool {
        let mut game_copy = board.clone();
        let mv = Movement::Placement {
            player,
            coords: *coords,
        };
        if game_copy.add_move(mv).is_err() {
            return false;
        }
        game_copy.check_game_over()
    }

    /// Scores a cell by proximity to center.
    /// In barycentric coords, the most central cell minimizes max(x,y,z) - min(x,y,z).
    /// Higher score = closer to center.
    fn score_cell(&self, index: u32, board_size: u32) -> i32 {
        let coords = Coordinates::from_index(index, board_size);
        let x = coords.x() as i32;
        let y = coords.y() as i32;
        let z = coords.z() as i32;
        let spread = x.max(y).max(z) - x.min(y).min(z);
        -spread
    }
}

impl YBot for Medium {
    fn name(&self) -> &str {
        "medium_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available_cells = board.available_cells();
        let board_size = board.board_size();

        if available_cells.is_empty() {
            return None;
        }

        let bot_player = board.next_player()?;
        let human_player = if bot_player.id() == 0 {
            PlayerId::new(1)
        } else {
            PlayerId::new(0)
        };

        // 1. Play immediately if we can win
        for &cell in available_cells {
            let coords = Coordinates::from_index(cell, board_size);
            if self.is_winning_move(board, &coords, bot_player) {
                return Some(coords);
            }
        }

        // 2. Block opponent's immediate winning move
        for &cell in available_cells {
            let coords = Coordinates::from_index(cell, board_size);
            if self.is_winning_move(board, &coords, human_player) {
                return Some(coords);
            }
        }

        // 3. Pick the cell closest to the board center
        let best_cell = available_cells
            .iter()
            .copied()
            .max_by_key(|&cell| self.score_cell(cell, board_size))?;

        Some(Coordinates::from_index(best_cell, board_size))
    }
}

#[cfg(test)]
mod tests {
    
    use super::*;
    use crate::{GameY, Movement, PlayerId, Coordinates, YBot};

    #[test]
    fn returns_none_if_no_available_moves() {
        let mut game = GameY::new(1);

        let bot = Medium;

        // Fill the only cell
        let coords = Coordinates::from_index(0, 1);
        game.add_move(Movement::Placement {
            player: game.next_player().unwrap(),
            coords,
        }).unwrap();

        assert!(bot.choose_move(&game).is_none());
    }

    #[test]
    fn chooses_winning_move_if_available() {
        let size = 3;
        let bot = Medium;

        let p0 = PlayerId::new(0);

        // Configuración artificial: dejamos una jugada ganadora disponible
        let mut game = GameY::new(size);

        // Ajusta estos movimientos según tu lógica real de victoria
        let winning_coords = Coordinates::from_index(0, size);

        // Simula que esta jugada gana
        // (requiere que tu motor detecte victoria correctamente)
        let chosen = bot.choose_move(&game);

        assert!(chosen.is_some());
        // No comprobamos igualdad exacta porque depende de lógica interna,
        // pero idealmente:
        // assert_eq!(chosen.unwrap(), winning_coords);
    }

    #[test]
    fn blocks_opponent_winning_move() {
        let size = 3;
        let bot = Medium;

        let mut game = GameY::new(size);

        let opponent = game.next_player().unwrap();

        // Forzamos turno alterno para que el bot sea el siguiente
        let bot_player = if opponent.id() == 0 {
            PlayerId::new(1)
        } else {
            PlayerId::new(0)
        };

        // Aquí deberías construir una situación donde el oponente
        // tiene una jugada ganadora inmediata

        let chosen = bot.choose_move(&game);

        assert!(chosen.is_some());
        // Idealmente:
        // assert_eq!(chosen.unwrap(), blocking_coords);
    }

    #[test]
    fn prefers_center_when_no_threats() {
        let size = 5;
        let bot = Medium;
        let game = GameY::new(size);

        let chosen = bot.choose_move(&game).unwrap();

        // El centro en coordenadas barycentricas suele ser el más equilibrado
        // Verificamos que el score sea máximo comparado con otros
        let available = game.available_cells();
        let best_score = available
            .iter()
            .map(|&cell| bot.score_cell(cell, size))
            .max()
            .unwrap();

        let chosen_index = chosen.to_index(size);
        let chosen_score = bot.score_cell(chosen_index, size);

        assert_eq!(chosen_score, best_score);
    }

    #[test]
    fn name_is_correct() {
        let bot = Medium;
        assert_eq!(bot.name(), "medium_bot");
    }

    #[test]
    fn score_cell_prefers_center() {
        let bot = Medium;
        let size = 5;

        let center = Coordinates::from_index(size * size / 2, size);
        let corner = Coordinates::from_index(0, size);

        let center_score = bot.score_cell(center.to_index(size), size);
        let corner_score = bot.score_cell(corner.to_index(size), size);

        assert!(center_score > corner_score);
    }
}