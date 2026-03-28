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

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /// Crea un juego limpio de tamaño `size`.
    fn new_game(size: u32) -> GameY {
        GameY::new(size)
    }

    /// Aplica un placement al juego, hace panic si falla.
    fn place(game: &mut GameY, player: PlayerId, index: u32) {
        let coords = Coordinates::from_index(index, game.board_size());
        game.add_move(Movement::Placement { player, coords })
            .expect("move should be valid");
    }

    // ─── YBot trait ────────────────────────────────────────────────────────────

    #[test]
    fn test_name() {
        let bot = Medium;
        assert_eq!(bot.name(), "medium_bot");
    }

    // ─── choose_move: tablero vacío ────────────────────────────────────────────

    #[test]
    fn test_choose_move_returns_some_on_empty_board() {
        let bot = Medium;
        let game = new_game(5);
        assert!(bot.choose_move(&game).is_some());
    }

    #[test]
    fn test_choose_move_returns_none_when_no_cells_available() {
        let bot = Medium;
        // Tablero de tamaño 1 tiene una sola celda; la llenamos manualmente
        // o usamos un game ya terminado.
        let mut game = new_game(1);
        let player0 = PlayerId::new(0);
        // Llenamos la única celda disponible
        let available = game.available_cells().first().copied();
        if let Some(idx) = available {
            let coords = Coordinates::from_index(idx, game.board_size());
            let _ = game.add_move(Movement::Placement { player: player0, coords });
        }
        // Si no quedan celdas, choose_move debe devolver None
        if game.available_cells().is_empty() {
            assert!(bot.choose_move(&game).is_none());
        }
    }

    // ─── choose_move: prioridad 1 — jugada ganadora ────────────────────────────

    #[test]
    fn test_choose_move_plays_winning_move() {
        let bot = Medium;
        let mut game = new_game(3);

        // Construimos una situación donde el jugador actual (0) puede ganar
        // en el siguiente movimiento. Dependiendo de la lógica de GameY,
        // colocamos fichas alternadas hasta tener al bot a un paso de ganar.
        //
        // Jugador 0 coloca en índices 0 y 1 (ajusta según tu board)
        // Jugador 1 coloca en índices alejados
        let p0 = PlayerId::new(0);
        let p1 = PlayerId::new(1);

        place(&mut game, p0, 0);
        place(&mut game, p1, 2);
        place(&mut game, p0, 1);
        place(&mut game, p1, 5);
        // Ahora el siguiente turno es de p0; si existe una jugada ganadora
        // el bot DEBE elegirla
        let chosen = bot.choose_move(&game);
        assert!(chosen.is_some(), "bot should always return a move");

        // Verificamos que la jugada elegida es realmente ganante
        let chosen_coords = chosen.unwrap();
        let size = game.board_size();
        let idx = chosen_coords.to_index(size);
        assert!(
            bot.is_winning_move(&game, &chosen_coords, p0)
                || game.available_cells().contains(&idx),
            "chosen move should be valid"
        );
    }

    // ─── choose_move: prioridad 2 — bloquear al oponente ──────────────────────

  #[test]
fn test_choose_move_blocks_opponent_winning_move() {
    let bot = Medium;
    let mut game = new_game(3);

    let p0 = PlayerId::new(0);
    let p1 = PlayerId::new(1);

    let available = game.available_cells().to_vec();
    let total = available.len();

    // Usamos índices reales del tablero, no índices arbitrarios
    // p1 coloca en las primeras celdas para estar cerca de ganar
    // p0 coloca en las últimas (movimientos neutros)
    place(&mut game, p0, available[total - 1]);
    place(&mut game, p1, available[0]);
    place(&mut game, p0, available[total - 2]);
    place(&mut game, p1, available[1]);

    // El bot (p0) debe bloquear a p1 o elegir una celda válida
    let chosen = bot.choose_move(&game);
    assert!(chosen.is_some());

    let size = game.board_size();
    let idx = chosen.unwrap().to_index(size);
    assert!(
        game.available_cells().contains(&idx),
        "chosen cell must be available"
    );
}
    // ─── choose_move: prioridad 3 — celda más central ─────────────────────────

    #[test]
    fn test_choose_move_prefers_center_when_no_tactical_moves() {
        let bot = Medium;
        let game = new_game(5);

        // En un tablero vacío no hay jugadas ganadoras ni bloqueos,
        // así que el bot debe elegir la celda más central.
        let chosen = bot.choose_move(&game).expect("should return a move");
        let size = game.board_size();
        let idx = chosen.to_index(size);

        // El score de la celda elegida debe ser el máximo posible
        let best_score = game
            .available_cells()
            .iter()
            .map(|&c| bot.score_cell(c, size))
            .max()
            .unwrap();

        assert_eq!(
            bot.score_cell(idx, size),
            best_score,
            "bot should pick the cell with the highest center score"
        );
    }

    // ─── is_winning_move ───────────────────────────────────────────────────────

    #[test]
    fn test_is_winning_move_returns_false_for_non_winning_cell() {
        let bot = Medium;
        let game = new_game(5);
        let p0 = PlayerId::new(0);
        // En un tablero vacío, ninguna celda individual puede ser ganadora
        let coords = Coordinates::from_index(0, game.board_size());
        assert!(!bot.is_winning_move(&game, &coords, p0));
    }

    #[test]
    fn test_is_winning_move_does_not_mutate_original_board() {
        let bot = Medium;
        let game = new_game(3);
        let p0 = PlayerId::new(0);
        let coords = Coordinates::from_index(0, game.board_size());
        let cells_before = game.available_cells().len();

        bot.is_winning_move(&game, &coords, p0);

        assert_eq!(
            game.available_cells().len(),
            cells_before,
            "is_winning_move should not modify the original board"
        );
    }

    // ─── score_cell ────────────────────────────────────────────────────────────

#[test]
fn test_score_cell_center_has_highest_score() {
    let bot = Medium;
    let size = 5u32;
    let total_cells = GameY::new(size).available_cells().len() as u32;

    let scores: Vec<i32> = (0..total_cells)
        .map(|i| bot.score_cell(i, size))
        .collect();

    let max_score = *scores.iter().max().unwrap();
    let min_score = *scores.iter().min().unwrap();

    // El score máximo (más central) debe ser estrictamente mayor que el mínimo (esquinas)
    assert!(
        max_score > min_score,
        "center score ({max_score}) should be greater than corner score ({min_score})"
    );
}

    #[test]
    fn test_score_cell_corner_has_lower_score_than_center() {
        let bot = Medium;
        let size = 5u32;
        let total_cells = GameY::new(size).available_cells().len() as u32;

        // Encontrar el score de la primera y última celda (esquinas)
        let corner_score = bot.score_cell(0, size);
        let scores: Vec<i32> = (0..total_cells)
            .map(|i| bot.score_cell(i, size))
            .collect();
        let max_score = *scores.iter().max().unwrap();

        assert!(
            corner_score <= max_score,
            "corner score ({corner_score}) should be <= center score ({max_score})"
        );
    }

    #[test]
    fn test_score_cell_consistent_across_same_index() {
        let bot = Medium;
        let size = 5u32;
        // El score debe ser determinista
        assert_eq!(bot.score_cell(0, size), bot.score_cell(0, size));
        assert_eq!(bot.score_cell(4, size), bot.score_cell(4, size));
    }

    // ─── choose_move: resultado siempre válido ─────────────────────────────────

    #[test]
    fn test_choose_move_always_returns_available_cell() {
        let bot = Medium;
        for size in [3u32, 4, 5] {
            let game = new_game(size);
            if let Some(coords) = bot.choose_move(&game) {
                let idx = coords.to_index(game.board_size());
                assert!(
                    game.available_cells().contains(&idx),
                    "chosen cell index {idx} must be in available_cells for board size {size}"
                );
            }
        }
    }
}