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
    fn score_cell(&self, index: usize, board_size: u32) -> i32 {
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
    use crate::{Movement, PlayerId};

    #[test]
    fn test_medium_bot_name() {
        let bot = Medium;
        assert_eq!(bot.name(), "medium");
    }

    #[test]
    fn test_medium_bot_returns_move_on_empty_board() {
        let bot = Medium;
        let game = GameY::new(5);
        assert!(bot.choose_move(&game).is_some());
    }

    #[test]
    fn test_medium_bot_returns_none_on_full_board() {
        let bot = Medium;
        let mut game = GameY::new(2);

        let moves = vec![
            Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(1, 0, 0),
            },
            Movement::Placement {
                player: PlayerId::new(1),
                coords: Coordinates::new(0, 1, 0),
            },
            Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(0, 0, 1),
            },
        ];

        for mv in moves {
            game.add_move(mv).unwrap();
        }

        assert!(game.available_cells().is_empty());
        assert!(bot.choose_move(&game).is_none());
    }

    #[test]
    fn test_medium_bot_returns_valid_coordinates() {
        let bot = Medium;
        let game = GameY::new(5);

        let coords = bot.choose_move(&game).unwrap();
        let index = coords.to_index(game.board_size());
        // Total cells for size 5 = (5 * 6) / 2 = 15
        assert!(index < 15);
    }

    #[test]
    fn test_medium_bot_chooses_from_available_cells() {
        let bot = Medium;
        let mut game = GameY::new(3);

        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0),
        })
        .unwrap();

        let coords = bot.choose_move(&game).unwrap();
        let index = coords.to_index(game.board_size());
        assert!(game.available_cells().contains(&index));
    }

    #[test]
    fn test_medium_bot_multiple_calls_return_valid_moves() {
        let bot = Medium;
        let game = GameY::new(7);

        for _ in 0..10 {
            let coords = bot.choose_move(&game).unwrap();
            let index = coords.to_index(game.board_size());
            // Total cells for size 7 = (7 * 8) / 2 = 28
            assert!(index < 28);
            assert!(game.available_cells().contains(&index));
        }
    }
} 