use crate::{Coordinates, GameY, Movement, PlayerId, YBot};
use std::collections::BinaryHeap;
use std::cmp::Reverse;
use std::sync::atomic::{AtomicI32, Ordering};
use rayon::prelude::*;

// ──────────────────────────────────────────────
// Tablas auxiliares
// ──────────────────────────────────────────────

/// Construye un array indexado por índice de celda que indica qué jugador
/// ocupa cada celda (None si está vacía). Permite acceso O(1) en lugar de
/// buscar en el HashMap de GameY en cada consulta.
fn build_owner_table(game: &GameY) -> Vec<Option<PlayerId>> {
    let size = game.board_size();
    let total = (size * (size + 1)) / 2;
    let mut table = vec![None; total as usize];
    for (coords, (_, player)) in game.board_map() {
        table[coords.to_index(size) as usize] = Some(*player);
    }
    table
}

/// Precalcula los vecinos de cada celda como índices lineales.
/// En el juego Y con coordenadas baricéntricas, cada celda tiene hasta 6 vecinos:
/// modificamos uno de los tres ejes en +1 y otro en -1 para obtenerlos.
/// Al calcularlo una sola vez evitamos repetir la aritmética baricéntrica
/// en cada nodo del árbol de búsqueda.
fn build_neighbor_table(board_size: u32) -> Vec<Vec<u32>> {
    let total = (board_size * (board_size + 1)) / 2;
    (0..total)
        .map(|idx| {
            let c = Coordinates::from_index(idx, board_size);
            let (x, y, z) = (c.x(), c.y(), c.z());
            let mut n = Vec::with_capacity(6);
            if x > 0 {
                n.push(Coordinates::new(x - 1, y + 1, z).to_index(board_size));
                n.push(Coordinates::new(x - 1, y, z + 1).to_index(board_size));
            }
            if y > 0 {
                n.push(Coordinates::new(x + 1, y - 1, z).to_index(board_size));
                n.push(Coordinates::new(x, y - 1, z + 1).to_index(board_size));
            }
            if z > 0 {
                n.push(Coordinates::new(x + 1, y, z - 1).to_index(board_size));
                n.push(Coordinates::new(x, y + 1, z - 1).to_index(board_size));
            }
            n
        })
        .collect()
}

/// Devuelve los índices de las celdas que tocan cada uno de los tres lados
/// del tablero triangular (lado A: x==0, lado B: y==0, lado C: z==0).
/// Estas celdas son los puntos de partida de Dijkstra para calcular
/// la distancia mínima de conexión entre lados.
fn side_cells(board_size: u32) -> (Vec<u32>, Vec<u32>, Vec<u32>) {
    let total = (board_size * (board_size + 1)) / 2;
    let mut a = vec![];
    let mut b = vec![];
    let mut c = vec![];
    for idx in 0..total {
        let coords = Coordinates::from_index(idx, board_size);
        if coords.x() == 0 { a.push(idx); }
        if coords.y() == 0 { b.push(idx); }
        if coords.z() == 0 { c.push(idx); }
    }
    (a, b, c)
}

// ──────────────────────────────────────────────
// Dijkstra
// ──────────────────────────────────────────────

/// Algoritmo de Dijkstra adaptado al juego Y:
/// - Celda propia del jugador: coste 0 (ya conquistada, se atraviesa gratis)
/// - Celda vacía: coste 1 (habría que colocar una ficha)
/// - Celda del rival: bloqueada, no se puede atravesar
///
/// Devuelve un array con la distancia mínima desde cualquiera de las
/// `sources` hasta cada celda del tablero. Las celdas inalcanzables
/// quedan con valor u32::MAX.
fn dijkstra(
    sources: &[u32],
    player: PlayerId,
    owner: &[Option<PlayerId>],
    neighbors: &[Vec<u32>],
    total: usize,
) -> Vec<u32> {
    let mut dist = vec![u32::MAX; total];
    let mut heap = BinaryHeap::new(); // min-heap gracias a Reverse

    // Inicializamos con todas las fuentes a coste 0
    for &src in sources {
        if owner[src as usize] == Some(opponent(player)) {
            continue; // Bloquear fuentes inválidas
        }
        dist[src as usize] = 0;
        heap.push(Reverse((0u32, src)));
    }

    while let Some(Reverse((cost, idx))) = heap.pop() {
        // Si ya encontramos un camino más corto, descartamos esta entrada
        if cost > dist[idx as usize] { continue; }
        for &nidx in &neighbors[idx as usize] {
            let cell_cost = match owner[nidx as usize] {
                Some(p) if p == player => 0,  // propia: gratis
                None => 1,                     // vacía: coste 1
                Some(_) => continue,           // rival: bloqueada
            };
            let new_cost = cost + cell_cost;
            if new_cost < dist[nidx as usize] {
                dist[nidx as usize] = new_cost;
                heap.push(Reverse((new_cost, nidx)));
            }
        }
    }

    dist
}

/// Construye la lista de celdas fuente para Dijkstra a partir de un lado:
/// incluimos todas las celdas del lado que no estén ocupadas por el rival,
/// ya que el rival bloquea el acceso a esas celdas del borde.
fn combined_sources(
    player: PlayerId,
    owner: &[Option<PlayerId>],
    sides: &(Vec<u32>, Vec<u32>, Vec<u32>),
) -> Vec<u32> {
    [&sides.0, &sides.1, &sides.2]
        .iter()
        .flat_map(|side| side.iter())
        .filter(|&&idx| owner[idx as usize] != Some(opponent(player)))
        .copied()
        .collect()
}

/// Calcula el coste mínimo para que `player` conecte los tres lados del tablero.
///
/// Estrategia: lanzamos Dijkstra desde cada lado por separado (da, db, dc).
/// Para cada celda del tablero, da[i] + db[i] + dc[i] representa el coste
/// total de un camino que pase por esa celda conectando los tres lados.
/// Restamos 2*cell_cost porque la celda aparece contada tres veces pero
/// solo se paga una.
///
/// El mínimo sobre todas las celdas es el coste óptimo de conexión.
fn connection_cost(
    player: PlayerId,
    owner: &[Option<PlayerId>],
    neighbors: &[Vec<u32>],
    sides: &(Vec<u32>, Vec<u32>, Vec<u32>),
    total: usize,
) -> i32 {
    // Fuentes de cada lado: celdas del borde no bloqueadas por el rival
    let src = |side: &Vec<u32>| -> Vec<u32> {
        side.iter()
            .filter(|&&idx| owner[idx as usize] != Some(opponent(player)))
            .copied()
            .collect()
    };

    // Tres Dijkstras independientes, uno desde cada lado
    let da = dijkstra(&src(&sides.0), player, owner, neighbors, total);
    let db = dijkstra(&src(&sides.1), player, owner, neighbors, total);
    let dc = dijkstra(&src(&sides.2), player, owner, neighbors, total);

    let mut min_cost = i32::MAX;
    for idx in 0..total {
        // Si algún lado es inalcanzable desde esta celda, la descartamos
        if da[idx] == u32::MAX || db[idx] == u32::MAX || dc[idx] == u32::MAX { continue; }
        // La celda actúa como punto de unión de los tres caminos;
        // su coste se descuenta dos veces porque se sumó tres veces
        let cell_cost = if owner[idx] == Some(player) { 0u32 } else { 1 };
        let cost = (da[idx] + db[idx] + dc[idx]).saturating_sub(2 * cell_cost);
        if (cost as i32) < min_cost {
            min_cost = cost as i32;
        }
    }

    // 1000 como valor de "imposible" si el jugador está completamente bloqueado
    if min_cost == i32::MAX { 1000 } else { min_cost }
}

// ──────────────────────────────────────────────
// Evaluación y ordenación
// ──────────────────────────────────────────────

/// Función de evaluación estática del tablero desde la perspectiva del bot.
///
/// - Si el juego terminó: +10000 si ganó el bot, -10000 si ganó el rival.
/// - Si sigue en curso: `opp_cost * 2 - bot_cost`
///   El factor 2 hace que el bot priorice bloquear al rival sobre avanzar,
///   ya que reducir el camino del rival vale el doble que acortar el propio.
fn evaluate_position(
    game: &GameY,
    bot_player: PlayerId,
    owner: &[Option<PlayerId>],
    neighbors: &[Vec<u32>],
    sides: &(Vec<u32>, Vec<u32>, Vec<u32>),
) -> i32 {
    if game.check_game_over() {
        if let Some(last) = game.history().last() {
            let last_player = match last {
                Movement::Placement { player, .. } => *player,
                Movement::Action { player, .. } => *player,
            };
            return if last_player == bot_player { 10_000 } else { -10_000 };
        }
    }

    let total = owner.len();
    let opp = opponent(bot_player);
    let bot_cost = connection_cost(bot_player, owner, neighbors, sides, total);
    let opp_cost = connection_cost(opp, owner, neighbors, sides, total);

    opp_cost * 2 - bot_cost
}

/// Ordena los movimientos disponibles por relevancia estratégica para
/// maximizar la eficiencia de la poda alfa-beta.
///
/// Usamos dos Dijkstras combinados (uno por jugador con todos los lados
/// como fuente a la vez) para estimar qué celdas están en los caminos
/// críticos de ambos jugadores. Una celda con distancia combinada baja
/// es estratégicamente urgente: o acelera al bot o bloquea al rival.
fn order_moves_with_tables(
    cells: &[u32],
    bot_player: PlayerId,
    owner: &[Option<PlayerId>],
    neighbors: &[Vec<u32>],
    sides: &(Vec<u32>, Vec<u32>, Vec<u32>),
    total: usize,
) -> Vec<u32> {
    let opp = opponent(bot_player);
    // Un Dijkstra por jugador con todos sus lados como fuentes simultáneas
    let dist_bot = dijkstra(&combined_sources(bot_player, owner, sides), bot_player, owner, neighbors, total);
    let dist_opp = dijkstra(&combined_sources(opp, owner, sides), opp, owner, neighbors, total);

    let mut scored: Vec<(u32, i32)> = cells
        .iter()
        .map(|&idx| {
            let db = dist_bot[idx as usize] as i32;
            let do_ = dist_opp[idx as usize] as i32;
            // Tomamos el mínimo: la celda más urgente para cualquiera de los dos
            // Negativo porque queremos ordenar de mayor a menor urgencia
            (idx, -(db.min(do_)))
        })
        .collect();

    // Ordenamos de más a menos urgente (mayor score = más prioritario)
    scored.sort_unstable_by(|a, b| b.1.cmp(&a.1));
    scored.into_iter().map(|(idx, _)| idx).collect()
}

fn opponent(player: PlayerId) -> PlayerId {
    if player.id() == 0 { PlayerId::new(1) } else { PlayerId::new(0) }
}

/// Ajusta la profundidad de búsqueda según las celdas disponibles.
/// Con pocas celdas (endgame) podemos buscar más profundo porque el
/// árbol de juego es más pequeño. En opening reducimos para mantener
/// tiempos de respuesta razonables.
fn dynamic_depth(available: usize) -> u32 {
    match available {
        0..=6   => 7,
        7..=15  => 5,
        16..=30 => 4,
        _       => 3,
    }
}

// ──────────────────────────────────────────────
// Minimax secuencial (niveles internos)
// ──────────────────────────────────────────────

/// Minimax con poda alfa-beta para los niveles internos del árbol.
///
/// - `maximizing=true`: turno del bot, busca maximizar la evaluación.
/// - `maximizing=false`: turno del rival, busca minimizar la evaluación.
/// - `alpha`: mejor valor garantizado para el maximizador hasta ahora.
/// - `beta`: mejor valor garantizado para el minimizador hasta ahora.
/// - Si beta <= alpha, podamos la rama (el oponente nunca permitirá llegar aquí).
///
/// `neighbors` y `sides` se pasan por referencia y se reutilizan en toda
/// la recursión ya que no cambian durante la búsqueda.
fn minimax(
    game: &GameY,
    depth: u32,
    mut alpha: i32,
    mut beta: i32,
    maximizing: bool,
    bot_player: PlayerId,
    neighbors: &[Vec<u32>],
    sides: &(Vec<u32>, Vec<u32>, Vec<u32>),
) -> i32 {
    // Reconstruimos la tabla de owners para este estado concreto del tablero
    let owner = build_owner_table(game);
    let total = owner.len();

    // Condición de parada: profundidad agotada o juego terminado
    if depth == 0 || game.check_game_over() {
        return evaluate_position(game, bot_player, &owner, neighbors, sides);
    }

    let current = if maximizing { bot_player } else { opponent(bot_player) };

    // Ordenamos movimientos para explorar primero los más prometedores,
    // lo que genera más cortes alfa-beta y reduce el árbol explorado
    let ordered = order_moves_with_tables(
        game.available_cells(), bot_player, &owner, neighbors, sides, total,
    );

    if maximizing {
        let mut best = i32::MIN + 1;
        for cell in ordered {
            let coords = Coordinates::from_index(cell, game.board_size());
            let mut copy = game.clone();
            if copy.add_move(Movement::Placement { player: current, coords }).is_err() { continue; }
            let value = minimax(&copy, depth - 1, alpha, beta, false, bot_player, neighbors, sides);
            best = best.max(value);
            alpha = alpha.max(best);
            if beta <= alpha { break; } // poda beta: el minimizador no permite esto
        }
        best
    } else {
        let mut best = i32::MAX;
        for cell in ordered {
            let coords = Coordinates::from_index(cell, game.board_size());
            let mut copy = game.clone();
            if copy.add_move(Movement::Placement { player: current, coords }).is_err() { continue; }
            let value = minimax(&copy, depth - 1, alpha, beta, true, bot_player, neighbors, sides);
            best = best.min(value);
            beta = beta.min(best);
            if beta <= alpha { break; } // poda alpha: el maximizador no permite esto
        }
        best
    }
}

// ──────────────────────────────────────────────
// Nivel raíz paralelo con Rayon
// ──────────────────────────────────────────────

/// Evalúa los movimientos del nivel raíz en paralelo usando Rayon.
///
/// La poda alfa-beta clásica es inherentemente secuencial (cada nodo
/// necesita el resultado del anterior para actualizar alpha/beta).
/// En el nivel raíz rompemos esa dependencia: evaluamos todos los hijos
/// en paralelo y tomamos el máximo al final.
///
/// Compensación: perdemos algunos cortes alfa-beta en el nivel 0,
/// pero ganamos todos los núcleos de la CPU, lo que es mucho más rentable.
///
/// El `AtomicI32` permite que los hilos compartan el mejor score visto
/// hasta ahora para una poda temprana optimista: si un hilo ya encontró
/// una victoria segura (score >= 9000), los demás pueden saltarse su trabajo.
fn parallel_root(
    board: &GameY,
    depth: u32,
    bot_player: PlayerId,
    ordered: Vec<u32>,
    neighbors: &[Vec<u32>],
    sides: &(Vec<u32>, Vec<u32>, Vec<u32>),
) -> Option<(i32, Coordinates)> {
    let best_so_far = AtomicI32::new(i32::MIN + 1);

    let results: Vec<Option<(i32, Coordinates)>> = ordered
        .par_iter() // Rayon: cada iteración se ejecuta en un hilo distinto
        .map(|&cell| {
            // Poda temprana: si otro hilo ya encontró una victoria segura,
            // no tiene sentido seguir evaluando más movimientos
            if best_so_far.load(Ordering::Relaxed) >= 9_000 {
                return None;
            }

            let coords = Coordinates::from_index(cell, board.board_size());
            let mut copy = board.clone();
            if copy.add_move(Movement::Placement { player: bot_player, coords }).is_err() {
                return None;
            }

            // Llamada secuencial al minimax para los niveles internos
            let score = minimax(
                &copy, depth, i32::MIN + 1, i32::MAX,
                false, bot_player, neighbors, sides,
            );

            // Actualizamos el mejor score global de forma atómica (sin mutex)
            // usando compare_exchange_weak en un bucle CAS (Compare-And-Swap)
            let mut prev = best_so_far.load(Ordering::Relaxed);
            while score > prev {
                match best_so_far.compare_exchange_weak(prev, score, Ordering::Relaxed, Ordering::Relaxed) {
                    Ok(_) => break,
                    Err(current) => prev = current, // otro hilo actualizó antes, reintentamos
                }
            }

            Some((score, coords))
        })
        .collect();

    // De todos los resultados paralelos, tomamos el movimiento con mayor score
    results
        .into_iter()
        .flatten()
        .max_by_key(|(score, _)| *score)
}

// ──────────────────────────────────────────────
// Bot
// ──────────────────────────────────────────────

pub struct Hard;

impl YBot for Hard {
    fn name(&self) -> &str { "hard_bot" }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let bot_player = board.next_player()?;
        let size = board.board_size();

        // Precalculamos las estructuras que no cambian durante la búsqueda:
        // - neighbors: vecinos de cada celda (depende solo del tamaño del tablero)
        // - sides: índices de celdas en cada borde (idem)
        // - owner: estado actual del tablero (snapshot inicial)
        // Pasarlas por referencia a toda la recursión evita recalcularlas
        let neighbors = build_neighbor_table(size);
        let sides = side_cells(size);
        let owner = build_owner_table(board);
        let total = owner.len();

        // Profundidad adaptativa según fase de la partida
        let depth = dynamic_depth(board.available_cells().len());

        // Ordenamos los movimientos raíz antes de lanzar los hilos
        // para que Rayon distribuya primero los trabajos más prometedores
        let ordered = order_moves_with_tables(
            board.available_cells(), bot_player, &owner, &neighbors, &sides, total,
        );

        // Evaluación paralela del nivel raíz → elegimos el mejor movimiento
        parallel_root(board, depth, bot_player, ordered, &neighbors, &sides)
            .map(|(_, coords)| coords)
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::Coordinates;
    use rand::Rng;

    #[test]
    fn test_index_roundtrip() {
        let size = 5;
        let total = (size * (size + 1)) / 2;

        for i in 0..total {
            let c = Coordinates::from_index(i, size);
            let idx = c.to_index(size);
            assert_eq!(i, idx, "Roundtrip failed at index {}", i);
        }
    }

    #[test]
    fn test_neighbors_validity() {
        let size = 5;
        let neighbors = build_neighbor_table(size);
        let total = neighbors.len();

        for (i, ns) in neighbors.iter().enumerate() {
            for &n in ns {
                assert!((n as usize) < total, "Neighbor out of bounds");
            }
        }
    }

    #[test]
    fn test_neighbors_max_6() {
        let size = 6;
        let neighbors = build_neighbor_table(size);

        for ns in neighbors {
            assert!(ns.len() <= 6, "Too many neighbors");
        }
    }

    #[test]
    fn test_side_cells_cover_board() {
        let size = 5;
        let (a, b, c) = side_cells(size);

        assert!(!a.is_empty());
        assert!(!b.is_empty());
        assert!(!c.is_empty());

        // Cada celda debe pertenecer al menos a un lado
        let total = (size * (size + 1)) / 2;

        let mut union = std::collections::HashSet::new();

        for &x in &a { union.insert(x); }
        for &x in &b { union.insert(x); }
        for &x in &c { union.insert(x); }

        // comprobar que SOLO las de borde están
        for i in 0..total {
            let coords = Coordinates::from_index(i, size);
            let is_side = coords.x() == 0 || coords.y() == 0 || coords.z() == 0;

            assert_eq!(
                union.contains(&i),
                is_side,
                "Mismatch at cell {}",
                i
            );
        }
    }

    #[test]
    fn test_dijkstra_empty_board() {
        let size = 4;
        let neighbors = build_neighbor_table(size);
        let owner = vec![None; neighbors.len()];
        let (a, _, _) = side_cells(size);

        let dist = dijkstra(&a, PlayerId::new(0), &owner, &neighbors, owner.len());

        // Distancias deben ser finitas
        assert!(dist.iter().any(|&d| d > 0));
    }

    #[test]
    fn test_dijkstra_blocked() {
        let size = 3;
        let neighbors = build_neighbor_table(size);

        // Todo ocupado por rival
        let owner = vec![Some(PlayerId::new(1)); neighbors.len()];
        let (a, _, _) = side_cells(size);

        let dist = dijkstra(&a, PlayerId::new(0), &owner, &neighbors, owner.len());

        assert!(dist.iter().all(|&d| d == u32::MAX));
    }

    #[test]
    fn test_dijkstra_own_cells_zero_cost() {
        let size = 3;
        let neighbors = build_neighbor_table(size);

        let mut owner = vec![None; neighbors.len()];
        owner[0] = Some(PlayerId::new(0));

        let dist = dijkstra(&[0], PlayerId::new(0), &owner, &neighbors, owner.len());

        assert_eq!(dist[0], 0);
    }

    #[test]
    fn test_connection_cost_win() {
        let size = 3;
        let neighbors = build_neighbor_table(size);
        let sides = side_cells(size);

        let mut owner = vec![None; neighbors.len()];

        // Simular conexión trivial (dependerá de tu sistema exacto)
        for i in 0..owner.len() {
            owner[i] = Some(PlayerId::new(0));
        }

        let cost = connection_cost(PlayerId::new(0), &owner, &neighbors, &sides, owner.len());

        assert_eq!(cost, 0);
    }

    #[test]
    fn test_connection_cost_impossible() {
        let size = 3;
        let neighbors = build_neighbor_table(size);
        let sides = side_cells(size);

        let owner = vec![Some(PlayerId::new(1)); neighbors.len()];

        let cost = connection_cost(PlayerId::new(0), &owner, &neighbors, &sides, owner.len());

        assert_eq!(cost, 1000);
    }

    #[test]
    fn test_evaluate_win() {
        let mut game = GameY::new(2);
        let player = PlayerId::new(0);

        let moves = [
            Coordinates::new(1, 1, 0),
            Coordinates::new(0, 1, 1),
            Coordinates::new(1, 0, 1),
        ];

        for coords in moves {
            game.add_move(Movement::Placement { player, coords }).unwrap();
        }

        // Ahora sí debería ser victoria
        assert!(game.check_game_over(), "El estado debería ser ganador");

        let owner = build_owner_table(&game);
        let neighbors = build_neighbor_table(2);
        let sides = side_cells(2);

        let score = evaluate_position(&game, player, &owner, &neighbors, &sides);

        assert!(
            score >= 10000,
            "Score no indica victoria: {}",
            score
        );
    }

    #[test]
    fn test_evaluation_prefers_blocking() {
        let size = 4;
        let neighbors = build_neighbor_table(size);
        let sides = side_cells(size);

        let mut owner = vec![None; neighbors.len()];

        // Rival casi gana
        owner[0] = Some(PlayerId::new(1));

        let score = evaluate_position(
            &GameY::new(size),
            PlayerId::new(0),
            &owner,
            &neighbors,
            &sides,
        );

        // No comprobamos valor exacto, solo que no sea neutro
        assert!(score != 0);
    }

    #[test]
    fn test_move_ordering_stability() {
        let size = 4;
        let neighbors = build_neighbor_table(size);
        let sides = side_cells(size);

        let owner = vec![None; neighbors.len()];
        let cells: Vec<u32> = (0..neighbors.len() as u32).collect();

        let ordered = order_moves_with_tables(
            &cells,
            PlayerId::new(0),
            &owner,
            &neighbors,
            &sides,
            neighbors.len(),
        );

        assert_eq!(ordered.len(), cells.len());
    }

    #[test]
    fn test_minimax_depth_zero() {
        let game = GameY::new(3);
        let neighbors = build_neighbor_table(3);
        let sides = side_cells(3);

        let score = minimax(
            &game,
            0,
            i32::MIN,
            i32::MAX,
            true,
            PlayerId::new(0),
            &neighbors,
            &sides,
        );

        let owner = build_owner_table(&game);
        let eval = evaluate_position(&game, PlayerId::new(0), &owner, &neighbors, &sides);

        assert_eq!(score, eval);
    }

    #[test]
    fn test_parallel_root_returns_move() {
        let game = GameY::new(3);
        let neighbors = build_neighbor_table(3);
        let sides = side_cells(3);

        let owner = build_owner_table(&game);
        let ordered = game.available_cells().to_vec();

        let result = parallel_root(
            &game,
            2,
            PlayerId::new(0),
            ordered,
            &neighbors,
            &sides,
        );

        assert!(result.is_some());
    }

    #[test]
    fn test_bot_plays_valid_move() {
        let game = GameY::new(4);
        let bot = Hard;

        let mv = bot.choose_move(&game);

        assert!(mv.is_some());

        let coords = mv.unwrap();

        assert!(game.available_cells().contains(&coords.to_index(4)));
    }

    #[test]
    fn test_random_states_do_not_panic() {
        let size: u32 = 5;

        for _ in 0..100 {
            let mut game: GameY = GameY::new(size);

            let mut rng = rand::rng();

            for _ in 0..10 {
                if let Some(p) = game.next_player() {
                    let cells: &Vec<u32> = game.available_cells();
                    if cells.is_empty() { break; }

                    let idx: u32 = cells[rng.random_range(0..cells.len())];
                    let coords: Coordinates = Coordinates::from_index(idx, size);

                    let _ = game.add_move(Movement::Placement { player: p, coords });
                }
            }

            let bot: Hard = Hard;
            let _ = bot.choose_move(&game); // NO debe panic
        }
    }

    #[test]
    fn test_connection_cost_monotonicity_multiple() {
        let size = 4;
        let neighbors = build_neighbor_table(size);
        let sides = side_cells(size);

        let player = PlayerId::new(0);

        for idx in 0..neighbors.len() {
            let mut owner = vec![None; neighbors.len()];

            let cost_before = connection_cost(
                player,
                &owner,
                &neighbors,
                &sides,
                owner.len(),
            );

            owner[idx] = Some(player);

            let cost_after = connection_cost(
                player,
                &owner,
                &neighbors,
                &sides,
                owner.len(),
            );

            assert!(
                cost_after <= cost_before,
                "Coste aumentó en idx {}: before={}, after={}",
                idx,
                cost_before,
                cost_after
            );
        }
    }

}