
use crate::{Coordinates, GameY, Movement, PlayerId, YBot};

fn evaluate_position(game: &GameY, bot_player: PlayerId) -> i32 {
    // Ejemplos de términos:
    // +10000 si el bot ha ganado
    // -10000 si el humano ha ganado
    // luego, heurística tipo “Medium” como refinamiento

    if game.check_game_over() {
        // Supongamos que game.winner() devuelve Option<PlayerId>
        if let Some(last) = game.history().last() {
            let last_player = match last {
                Movement::Placement { player, .. } => *player,
                Movement::Action { player, .. } => *player,
            };
            if last_player == bot_player {
                return 10_000;
            } else {
                return -10_000;
            }
        }
    }

    // Si no ha terminado, usa algo tipo “centralidad + conectividad”
    // Aquí puedes empezar simple:
    // suma de score_cell para las fichas del bot
    // menos suma de score_cell para las fichas del rival
    0
}

fn minimax(
    game: &GameY,
    depth: u32,
    alpha: i32,
    beta: i32,
    maximizing: bool,
    bot_player: PlayerId,
) -> i32 {
    // 1. Condición de parada
    if depth == 0 || game.check_game_over() {
        return evaluate_position(game, bot_player);
    }

    let mut alpha = alpha;
    let mut beta = beta;

    let available = game.available_cells();

    if maximizing {
        let mut best = i32::MIN;
        for cell in available {
            let coords = Coordinates::from_index(*cell, game.board_size());
            let mut copy = game.clone();
            let mv = Movement::Placement {
                player: bot_player,
                coords,
            };
            if copy.add_move(mv).is_err() {
                continue;
            }
            let value = minimax(&copy, depth - 1, alpha, beta, false, bot_player);
            best = best.max(value);
            alpha = alpha.max(best);
            if beta <= alpha {
                break; // poda beta
            }
        }
        best
    } else {
        let mut best = i32::MAX;
        let opp = if bot_player.id() == 0 {
            PlayerId::new(1)
        } else {
            PlayerId::new(0)
        };
        for cell in available {
            let coords = Coordinates::from_index(*cell, game.board_size());
            let mut copy = game.clone();
            let mv = Movement::Placement {
                player: opp,
                coords,
            };
            if copy.add_move(mv).is_err() {
                continue;
            }
            let value = minimax(&copy, depth - 1, alpha, beta, true, bot_player);
            best = best.min(value);
            beta = beta.min(best);
            if beta <= alpha {
                break; // poda alpha
            }
        }
        best
    }
}

pub struct Hard;

impl YBot for Hard {
    fn name(&self) -> &str {
        "hard_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let bot_player = board.next_player()?;
        let mut best_score = i32::MIN;
        let mut best_move = None;

        for cell in board.available_cells() {
            let coords = Coordinates::from_index(*cell, board.board_size());
            let mut copy = board.clone();
            let mv = Movement::Placement {
                player: bot_player,
                coords,
            };
            if copy.add_move(mv).is_err() {
                continue;
            }
            let score = minimax(&copy, 3, i32::MIN, i32::MAX, false, bot_player);
            if score > best_score {
                best_score = score;
                best_move = Some(coords);
            }
        }

        best_move
    }
}

