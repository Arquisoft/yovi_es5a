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