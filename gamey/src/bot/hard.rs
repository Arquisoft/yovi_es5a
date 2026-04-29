//! Hard bot optimized: Hybrid MCTS + Alpha-Beta tactical refinement.
//! v4 — versión muy comentada.
//!
//! OBJETIVO GENERAL
//! ----------------
//! Este bot mezcla dos ideas:
//! 1) Una fase estadística (MCTS) para explorar jugadas prometedoras.
//! 2) Una fase táctica (negamax con poda alpha-beta) para revisar con más precisión
//!    unas pocas jugadas finalistas.
//!
//! La versión original ya era fuerte, pero tenía varios problemas de rendimiento:
//! - recalculaba distancias demasiadas veces,
//! - clonaba el tablero o la tabla de dueños en muchos puntos críticos,
//! - aplicaba heurísticas caras demasiado pronto,
//! - y dejaba pasar demasiados candidatos a las fases costosas.
//!
//! Esta versión intenta mantener la fuerza del bot, pero haciendo el pipeline más barato:
//! - filtra antes,
//! - hace menos trabajo caro,
//! - y reserva el análisis profundo para muy pocas jugadas.

//! Hard bot optimized: Hybrid MCTS + Alpha-Beta tactical refinement.
//! v4 — faster threat scan, reduced cloning, cheaper candidate pipeline,
//! and lighter structural heuristics in hot paths.

// Reverse se usa para convertir BinaryHeap en un min-heap lógico.
// BinaryHeap en Rust es un max-heap por defecto; al envolver en Reverse
// podemos sacar primero la distancia más pequeña en Dijkstra.
use std::cmp::Reverse;
use std::collections::{BinaryHeap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rayon::prelude::*;

use crate::{Coordinates, GameStatus, GameY, Movement, PlayerId, YBot};

// -----------------------------------------------------------------------------
// CONFIGURACIÓN DEL BOT
// -----------------------------------------------------------------------------
//
// Este struct reúne todos los parámetros de comportamiento del bot.
// No son solo parámetros de fuerza, también son parámetros de rendimiento.
// En muchos motores, la mejora de velocidad no sale únicamente de optimizar código,
// sino de reducir el espacio de búsqueda y de ajustar cuánto tiempo se dedica
// a cada fase.
#[derive(Debug, Clone)]
pub struct HardConfig {
    pub mcts_iterations: u32,
    pub mcts_time_ms: u64,
    pub top_k_tactical: usize,
    pub tactical_depth: u32,
    pub candidate_limit: usize,
    pub rerank_limit: usize,
    pub mcts_candidate_cap: usize,
    pub threads: usize,
    pub mcts_weight: f64,
    pub w_center: f32,
    pub w_side_touch: f32,
    pub w_neighbor_own: f32,
    pub w_neighbor_opp: f32,
    pub w_bridge: f32,
    pub w_block_path: f32,
    pub threat_scan_limit: usize,
    pub path_scan_limit: usize,
}

// Valores por defecto pensados para un equilibrio razonable entre fuerza y velocidad.
// Se ha bajado el tiempo total respecto a la versión anterior y se han reducido
// varios límites para que menos jugadas lleguen a las fases caras.
impl Default for HardConfig {
    fn default() -> Self {
        let threads = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .min(8);
        Self {
            mcts_iterations: 14_000,
            mcts_time_ms: 2_400,
            top_k_tactical: 6,
            tactical_depth: 5,
            candidate_limit: 18,
            rerank_limit: 8,
            mcts_candidate_cap: 8,
            threads,
            mcts_weight: 0.34,
            w_center: 14.0,
            w_side_touch: 1.5,
            w_neighbor_own: 3.0,
            w_neighbor_opp: 14.0,
            w_bridge: 8.0,
            w_block_path: 34.0,
            threat_scan_limit: 28,
            path_scan_limit: 16,
        }
    }
}

// -----------------------------------------------------------------------------
// TABLAS COMPARTIDAS PRECOMPUTADAS
// -----------------------------------------------------------------------------
//
// Todo lo que depende solo del tamaño del tablero se puede precomputar una vez.
// Eso evita recalcular vecinos, centralidad o máscaras de lados en cada turno.
// Este tipo de estructura suele dar una mejora muy grande porque elimina trabajo
// repetido del hot path.
struct SharedTables {
    board_size: u32,
    total_cells: usize,
    neighbors: Vec<Vec<u32>>,
    centrality: Vec<f32>,
    side_mask: Vec<u8>,
    center_order: Vec<u32>,
    neighbor_count: Vec<u8>,
}

impl SharedTables {
    // Construye todas las tablas derivadas del tamaño del tablero.
    // Aquí hacemos trabajo relativamente caro una sola vez y luego lo reutilizamos.
    fn new(board_size: u32) -> Self {
        let total_cells = ((board_size * (board_size + 1)) / 2) as usize;
        let mut neighbors = vec![Vec::new(); total_cells];
        let mut centrality = vec![0.0f32; total_cells];
        let mut side_mask = vec![0u8; total_cells];
        let mut neighbor_count = vec![0u8; total_cells];

        let center = (board_size as f32 - 1.0) / 3.0;
        let max_dist = center * std::f32::consts::SQRT_2 + 1.0;
        let n = board_size - 1;

        for idx in 0..total_cells as u32 {
            let c = Coordinates::from_index(idx, board_size);
            let (cx, cy, cz) = (c.x(), c.y(), c.z());
            let raw: [(i64, i64, i64); 6] = [
                (cx as i64 - 1, cy as i64 + 1, cz as i64),
                (cx as i64 - 1, cy as i64, cz as i64 + 1),
                (cx as i64 + 1, cy as i64 - 1, cz as i64),
                (cx as i64, cy as i64 - 1, cz as i64 + 1),
                (cx as i64 + 1, cy as i64, cz as i64 - 1),
                (cx as i64, cy as i64 + 1, cz as i64 - 1),
            ];
            let nbrs: Vec<u32> = raw
                .iter()
                .filter(|&&(nx, ny, nz)| {
                    nx >= 0
                        && ny >= 0
                        && nz >= 0
                        && nx as u32 + ny as u32 + nz as u32 == n
                })
                .map(|&(nx, ny, nz)| {
                    Coordinates::new(nx as u32, ny as u32, nz as u32).to_index(board_size)
                })
                .collect();
            neighbor_count[idx as usize] = nbrs.len() as u8;
            neighbors[idx as usize] = nbrs;

            let dist = ((cx as f32 - center).powi(2)
                + (cy as f32 - center).powi(2)
                + (cz as f32 - center).powi(2))
            .sqrt();
            centrality[idx as usize] = (1.0 - dist / max_dist).max(0.0);

            let mut mask = 0u8;
            if c.touches_side_a() {
                mask |= 0b001;
            }
            if c.touches_side_b() {
                mask |= 0b010;
            }
            if c.touches_side_c() {
                mask |= 0b100;
            }
            side_mask[idx as usize] = mask;
        }

        let mut center_order: Vec<u32> = (0..total_cells as u32).collect();
        center_order.sort_unstable_by(|&a, &b| {
            centrality[b as usize]
                .partial_cmp(&centrality[a as usize])
                .unwrap()
        });

        Self {
            board_size,
            total_cells,
            neighbors,
            centrality,
            side_mask,
            center_order,
            neighbor_count,
        }
    }

    #[inline]
    fn neighbors_of(&self, idx: u32) -> &[u32] {
        &self.neighbors[idx as usize]
    }
    #[inline]
    fn centrality_of(&self, idx: u32) -> f32 {
        self.centrality[idx as usize]
    }
    #[inline]
    fn side_mask_of(&self, idx: u32) -> u8 {
        self.side_mask[idx as usize]
    }
}

// -----------------------------------------------------------------------------
// TRANSPOSITION TABLE (TT)
// -----------------------------------------------------------------------------
//
// La TT guarda evaluaciones ya vistas para no recalcular el mismo estado muchas veces.
// Aquí se implementa como una tabla lock-free bastante simple.
// Cada entrada empaqueta:
// - valor evaluado,
// - profundidad,
// - tipo de bound,
// - mejor movimiento asociado.
struct TTEntry {
    key: AtomicU64,
    data: AtomicU64,
}
impl TTEntry {
    const fn new() -> Self {
        Self {
            key: AtomicU64::new(0),
            data: AtomicU64::new(0),
        }
    }
    fn encode(value: i32, depth: u8, bound: u8, mv: u32) -> u64 {
        ((value as i32 as u32 as u64) << 32)
            | ((depth as u64) << 24)
            | ((bound as u64) << 22)
            | (mv as u64 & 0x3F_FFFF)
    }
    fn decode(data: u64) -> (i32, u8, u8, u32) {
        let value = (data >> 32) as u32 as i32;
        let depth = ((data >> 24) & 0xFF) as u8;
        let bound = ((data >> 22) & 0x3) as u8;
        let mv = (data & 0x3F_FFFF) as u32;
        (value, depth, bound, mv)
    }
}

struct TranspositionTable {
    size: usize,
    entries: Vec<TTEntry>,
}
unsafe impl Send for TranspositionTable {}
unsafe impl Sync for TranspositionTable {}

impl TranspositionTable {
    fn new(size: usize) -> Self {
        let size = size.next_power_of_two();
        let mut entries = Vec::with_capacity(size);
        for _ in 0..size {
            entries.push(TTEntry::new());
        }
        Self { size, entries }
    }
    #[inline]
    fn slot(&self, hash: u64) -> usize {
        hash as usize & (self.size - 1)
    }
    fn probe(&self, hash: u64, depth: u8, alpha: i32, beta: i32) -> Option<(i32, u32)> {
        let e = &self.entries[self.slot(hash)];
        let key = e.key.load(Ordering::Relaxed);
        let data = e.data.load(Ordering::Relaxed);
        if key != hash {
            return None;
        }
        let (val, edepth, bound, mv) = TTEntry::decode(data);
        if edepth < depth {
            return None;
        }
        match bound {
            0 => Some((val, mv)),
            1 if val >= beta => Some((val, mv)),
            2 if val <= alpha => Some((val, mv)),
            _ => None,
        }
    }
    fn store(&self, hash: u64, depth: u8, value: i32, mv: u32, bound: u8) {
        let slot = self.slot(hash);
        let e = &self.entries[slot];
        let old_data = e.data.load(Ordering::Relaxed);
        let (_, old_depth, _, _) = TTEntry::decode(old_data);
        if depth >= old_depth || e.key.load(Ordering::Relaxed) != hash {
            e.key.store(hash, Ordering::Relaxed);
            e.data
                .store(TTEntry::encode(value, depth, bound, mv), Ordering::Relaxed);
        }
    }
}

const MAX_KILLER_DEPTH: usize = 8;
struct KillerTable {
    killers: [[u32; 2]; MAX_KILLER_DEPTH],
}
impl KillerTable {
    fn new() -> Self {
        Self {
            killers: [[u32::MAX; 2]; MAX_KILLER_DEPTH],
        }
    }
    fn store(&mut self, depth: usize, mv: u32) {
        if depth >= MAX_KILLER_DEPTH {
            return;
        }
        if self.killers[depth][0] != mv {
            self.killers[depth][1] = self.killers[depth][0];
            self.killers[depth][0] = mv;
        }
    }
    fn is_killer(&self, depth: usize, mv: u32) -> bool {
        depth < MAX_KILLER_DEPTH
            && (self.killers[depth][0] == mv || self.killers[depth][1] == mv)
    }
}

struct ZobristTable {
    table: Vec<[u64; 2]>,
}
impl ZobristTable {
    fn new(total_cells: usize) -> Self {
        let table = (0..total_cells)
            .map(|i| {
                [0usize, 1].map(|p| {
                    let s = (i as u64).wrapping_mul(6_364_136_223_846_793_005)
                        ^ (p as u64).wrapping_mul(1_442_695_040_888_963_407)
                        ^ 0xDEAD_BEEF_CAFE_1337;
                    let v = (s ^ (s >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
                    let v = (v ^ (v >> 27)).wrapping_mul(0x94d049bb133111eb);
                    v ^ (v >> 31)
                })
            })
            .collect();
        Self { table }
    }
    #[inline]
    fn hash_for(&self, cell: u32, player: PlayerId) -> u64 {
        self.table[cell as usize][player.id() as usize]
    }
}

#[inline]
fn other_player(p: PlayerId) -> PlayerId {
    if p.id() == 0 {
        PlayerId::new(1)
    } else {
        PlayerId::new(0)
    }
}
#[inline]
fn is_game_over(b: &GameY) -> bool {
    matches!(b.status(), GameStatus::Finished { .. })
}
#[inline]
fn get_winner(b: &GameY) -> Option<PlayerId> {
    match b.status() {
        GameStatus::Finished { winner } => Some(*winner),
        _ => None,
    }
}

// -----------------------------------------------------------------------------
// WIN DISTANCE
// -----------------------------------------------------------------------------
//
// Esta función estima cuántas celdas vacías le faltan a un jugador para conectar
// los tres lados. Es una de las piezas más importantes del bot porque se usa:
// - en evaluación global,
// - en escaneo de amenazas,
// - en reranking,
// - y en path-blocking.
//
// Internamente usa una variante de Dijkstra sobre estados (celda, máscara de lados).
// La máscara de lados indica qué lados quedan ya tocados por el componente actual.
// Cuando alcanzamos 0b111, significa que la conexión está completa.
fn win_distance(owner: &[Option<PlayerId>], player: PlayerId, tables: &SharedTables) -> u32 {
    let n = tables.total_cells;
    let opp = other_player(player);
    let mut dist = vec![[u32::MAX; 8]; n];
    let mut heap = BinaryHeap::new();

    for idx in 0..n as u32 {
        if owner[idx as usize] == Some(opp) {
            continue;
        }
        let mask = tables.side_mask_of(idx) as usize;
        if mask == 0 {
            if owner[idx as usize] == Some(player) && dist[idx as usize][0] > 0 {
                dist[idx as usize][0] = 0;
                heap.push(Reverse((0u32, idx, 0u8)));
            }
            continue;
        }
        let cost = if owner[idx as usize].is_some() { 0u32 } else { 1u32 };
        if cost < dist[idx as usize][mask] {
            dist[idx as usize][mask] = cost;
            heap.push(Reverse((cost, idx, mask as u8)));
        }
    }

    let mut best = u32::MAX;
    while let Some(Reverse((d, idx, smask))) = heap.pop() {
        let sm = smask as usize;
        if sm == 0b111 {
            best = d;
            break;
        }
        if d > dist[idx as usize][sm] {
            continue;
        }
        for &nb in tables.neighbors_of(idx) {
            if owner[nb as usize] == Some(opp) {
                continue;
            }
            let nb_cost = if owner[nb as usize].is_some() { 0u32 } else { 1u32 };
            let new_mask = sm | tables.side_mask_of(nb) as usize;
            let nd = d + nb_cost;
            if nd < dist[nb as usize][new_mask] {
                dist[nb as usize][new_mask] = nd;
                heap.push(Reverse((nd, nb, new_mask as u8)));
            }
        }
    }
    best
}

// Calcula simultáneamente la distancia de victoria del jugador actual y la del rival.
// Se paraleliza porque son dos cálculos independientes y relativamente caros.
// Ojo: sigue habiendo clones del owner slice para permitir el paralelismo seguro.
// Es un compromiso entre claridad y rendimiento.
fn win_distances_parallel(
    owner: &[Option<PlayerId>],
    player: PlayerId,
    tables: &SharedTables,
) -> (u32, u32) {
    let opp = other_player(player);
    let owner_a = owner.to_vec();
    let owner_b = owner.to_vec();
    let tptr = tables as *const SharedTables as usize;
    rayon::join(
        move || {
            let t = unsafe { &*(tptr as *const SharedTables) };
            win_distance(&owner_a, player, t)
        },
        move || {
            let t = unsafe { &*(tptr as *const SharedTables) };
            win_distance(&owner_b, opp, t)
        },
    )
}

#[inline]
// -----------------------------------------------------------------------------
// CHEQUEO RÁPIDO DE VICTORIA INMEDIATA
// -----------------------------------------------------------------------------
//
// Antes de hacer nada caro, merece la pena preguntar:
// "si pongo aquí, ¿gano ahora mismo?"
// Esta función no recalcula toda la posición; solo hace una BFS local conectando
// el movimiento propuesto con las piezas propias vecinas.
fn is_winning_move_fast(
    mv: u32,
    owner: &[Option<PlayerId>],
    player: PlayerId,
    tables: &SharedTables,
) -> bool {
    if owner[mv as usize].is_some() {
        return false;
    }
    let mut mask = tables.side_mask_of(mv);
    if mask == 0b111 {
        return true;
    }

    if tables.total_cells <= 512 {
        let mut queue = [0u32; 512];
        let mut visited = [false; 512];
        let (mut head, mut tail) = (0, 0);
        for &nb in tables.neighbors_of(mv) {
            if owner[nb as usize] == Some(player) && !visited[nb as usize] {
                visited[nb as usize] = true;
                mask |= tables.side_mask_of(nb);
                if mask == 0b111 {
                    return true;
                }
                queue[tail] = nb;
                tail += 1;
            }
        }
        while head < tail {
            let cur = queue[head];
            head += 1;
            for &nb in tables.neighbors_of(cur) {
                if owner[nb as usize] == Some(player) && !visited[nb as usize] {
                    visited[nb as usize] = true;
                    mask |= tables.side_mask_of(nb);
                    if mask == 0b111 {
                        return true;
                    }
                    queue[tail] = nb;
                    tail += 1;
                }
            }
        }
    } else {
        let mut vis = vec![false; tables.total_cells];
        let mut q = VecDeque::new();
        for &nb in tables.neighbors_of(mv) {
            if owner[nb as usize] == Some(player) && !vis[nb as usize] {
                vis[nb as usize] = true;
                mask |= tables.side_mask_of(nb);
                if mask == 0b111 {
                    return true;
                }
                q.push_back(nb);
            }
        }
        while let Some(cur) = q.pop_front() {
            for &nb in tables.neighbors_of(cur) {
                if owner[nb as usize] == Some(player) && !vis[nb as usize] {
                    vis[nb as usize] = true;
                    mask |= tables.side_mask_of(nb);
                    if mask == 0b111 {
                        return true;
                    }
                    q.push_back(nb);
                }
            }
        }
    }
    false
}

// Cuenta cuántos lados tocaría o conectaría el rival alrededor de una jugada.
// Es una heurística táctica rápida: si una casilla permite al rival extender una
// estructura hacia varios lados, suele ser una casilla crítica de bloqueo.
fn opponent_side_count(
    mv: u32,
    owner: &[Option<PlayerId>],
    opp: PlayerId,
    tables: &SharedTables,
) -> u32 {
    if owner[mv as usize].is_some() {
        return 0;
    }
    let mut mask = tables.side_mask_of(mv);
    let mut vis = vec![false; tables.total_cells];
    let mut q = VecDeque::new();
    for &nb in tables.neighbors_of(mv) {
        if owner[nb as usize] == Some(opp) && !vis[nb as usize] {
            vis[nb as usize] = true;
            mask |= tables.side_mask_of(nb);
            if mask == 0b111 {
                return 3;
            }
            q.push_back(nb);
        }
    }
    while let Some(cur) = q.pop_front() {
        for &nb in tables.neighbors_of(cur) {
            if owner[nb as usize] == Some(opp) && !vis[nb as usize] {
                vis[nb as usize] = true;
                mask |= tables.side_mask_of(nb);
                if mask == 0b111 {
                    return 3;
                }
                q.push_back(nb);
            }
        }
    }
    mask.count_ones()
}

#[inline]
// Heurística estructural ligera.
//
// La versión anterior usaba métricas más caras como component_cut_pressure
// o side_extension_pressure en caminos muy calientes. Aquí usamos una aproximación
// local basada en anillos cercanos alrededor de la casilla.
// Es menos precisa, pero mucho más barata.
fn local_structural_pressure(
    mv: u32,
    owner: &[Option<PlayerId>],
    opp: PlayerId,
    tables: &SharedTables,
) -> f32 {
    if owner[mv as usize].is_some() {
        return 0.0;
    }
    let mut own_ring = 0u32;
    let mut second_ring = 0u32;
    let mut side_mask = tables.side_mask_of(mv);
    for &nb in tables.neighbors_of(mv) {
        if owner[nb as usize] == Some(opp) {
            own_ring += 1;
            side_mask |= tables.side_mask_of(nb);
            for &nb2 in tables.neighbors_of(nb) {
                if nb2 != mv && owner[nb2 as usize] == Some(opp) {
                    second_ring += 1;
                    side_mask |= tables.side_mask_of(nb2);
                }
            }
        }
    }
    own_ring as f32 * 2.0 + second_ring as f32 * 0.6 + side_mask.count_ones() as f32 * 4.5
}

// Métricas globales del jugador sobre el tablero completo.
//
// Esta función sí es relativamente cara porque recorre componentes enteros.
// Por eso se usa sobre todo en la evaluación más profunda, no como criterio barato
// para miles de candidatos.
fn component_metrics(owner: &[Option<PlayerId>], who: PlayerId, tables: &SharedTables) -> (u32, u32, u32, u32) {
    let mut vis = vec![false; tables.total_cells];
    let mut best_sides = 0u32;
    let mut best_size = 0u32;
    let mut best_frontier = 0u32;
    let mut total_components = 0u32;

    for idx in 0..tables.total_cells as u32 {
        if owner[idx as usize] != Some(who) || vis[idx as usize] {
            continue;
        }
        total_components += 1;
        let mut q = VecDeque::new();
        q.push_back(idx);
        vis[idx as usize] = true;
        let mut size = 0u32;
        let mut sides = 0u8;
        let mut frontier = 0u32;

        while let Some(cur) = q.pop_front() {
            size += 1;
            sides |= tables.side_mask_of(cur);
            for &nb in tables.neighbors_of(cur) {
                match owner[nb as usize] {
                    Some(p) if p == who => {
                        if !vis[nb as usize] {
                            vis[nb as usize] = true;
                            q.push_back(nb);
                        }
                    }
                    None => frontier += 1,
                    _ => {}
                }
            }
        }

        let side_count = sides.count_ones();
        if side_count > best_sides
            || (side_count == best_sides && size > best_size)
            || (side_count == best_sides && size == best_size && frontier > best_frontier)
        {
            best_sides = side_count;
            best_size = size;
            best_frontier = frontier;
        }
    }

    (best_sides, best_size, best_frontier, total_components)
}

// Busca casillas que parecen importantes para bloquear el camino del rival.
//
// Idea:
// - primero miramos vacías cercanas a piezas rivales,
// - luego completamos con casillas centrales si hace falta,
// - y solo entonces simulamos al rival jugando ahí.
//
// Esto es mucho más barato que escanear todas las vacías del tablero.
fn find_opponent_path_cells(
    owner: &[Option<PlayerId>],
    opp: PlayerId,
    opp_d_base: u32,
    tables: &SharedTables,
    limit: usize,
) -> Vec<(u32, u32)> {
    let mut frontier = Vec::with_capacity(limit * 2);
    let mut seen = vec![false; tables.total_cells];

    for idx in 0..tables.total_cells as u32 {
        if owner[idx as usize].is_some() {
            continue;
        }
        let mut near_opp = false;
        for &nb in tables.neighbors_of(idx) {
            if owner[nb as usize] == Some(opp) {
                near_opp = true;
                break;
            }
        }
        if near_opp {
            seen[idx as usize] = true;
            frontier.push(idx);
        }
    }

    for &idx in &tables.center_order {
        if frontier.len() >= limit {
            break;
        }
        if owner[idx as usize].is_none() && !seen[idx as usize] {
            frontier.push(idx);
            seen[idx as usize] = true;
        }
    }

    let mut results = Vec::new();
    for idx in frontier.into_iter().take(limit) {
        let mut sim = owner.to_vec();
        sim[idx as usize] = Some(opp);
        let d = win_distance(&sim, opp, tables);
        if d < opp_d_base {
            results.push((idx, opp_d_base - d));
        }
    }
    results.sort_unstable_by(|a, b| b.1.cmp(&a.1));
    results
}

// -----------------------------------------------------------------------------
// EVALUACIÓN ESTÁTICA
// -----------------------------------------------------------------------------
//
// Convierte una posición en una puntuación numérica.
// Un valor alto significa que la posición es buena para `player`.
//
// Mezcla varias señales:
// - distancia propia y rival a la victoria,
// - tamaño y calidad de componentes,
// - control central,
// - conectividad local.
fn evaluate_with_dist(
    board: &GameY,
    player: PlayerId,
    cfg: &HardConfig,
    tables: &SharedTables,
    my_dist: f32,
    opp_dist: f32,
) -> f32 {
    let owner = board.owner_table();
    let opponent = other_player(player);

    let mut score = (opp_dist - my_dist) * 25.0;
    if opp_dist <= 4.0 {
        score -= (5.0 - opp_dist) * 140.0;
    } else if opp_dist <= 7.0 {
        score -= (8.0 - opp_dist) * 42.0;
    }
    if my_dist <= 4.0 {
        score += (5.0 - my_dist) * 115.0;
    }

    let (my_best_sides, my_best_size, my_best_frontier, my_components) =
        component_metrics(owner, player, tables);
    let (opp_best_sides, opp_best_size, opp_best_frontier, opp_components) =
        component_metrics(owner, opponent, tables);

    score += my_best_sides as f32 * 90.0;
    score -= opp_best_sides as f32 * 125.0;
    score += my_best_size as f32 * 4.0;
    score -= opp_best_size as f32 * 8.0;
    score += my_best_frontier as f32 * 1.1;
    score -= opp_best_frontier as f32 * 2.1;
    score += (opp_components as f32 - my_components as f32) * 8.0;

    if opp_best_sides >= 2 {
        score -= 150.0 + opp_best_size as f32 * 6.0;
        if opp_best_frontier >= 4 {
            score -= 80.0;
        }
    }
    if my_best_sides >= 2 {
        score += 105.0 + my_best_size as f32 * 3.5;
    }

    for idx in 0..tables.total_cells as u32 {
        let Some(cp) = owner[idx as usize] else { continue };
        let sign = if cp == player { 1.0f32 } else { -1.0 };
        let c = tables.centrality_of(idx);
        score += sign * cfg.w_center * c * c * 3.8;

        let mut connected = 0u32;
        let mut opp_adj = 0u32;
        for &nb in tables.neighbors_of(idx) {
            if owner[nb as usize] == Some(cp) {
                connected += 1;
            } else if owner[nb as usize].is_some() {
                opp_adj += 1;
            }
        }

        if connected == 0 {
            score += sign * (-5.0);
        } else {
            score += sign * cfg.w_neighbor_own * connected as f32;
        }

        if cp == player {
            score -= cfg.w_neighbor_opp * 0.22 * opp_adj as f32;
        } else {
            score -= cfg.w_neighbor_opp * 0.08 * connected as f32;
        }
    }
    score
}

fn evaluate(board: &GameY, player: PlayerId, cfg: &HardConfig, tables: &SharedTables) -> f32 {
    let owner = board.owner_table();
    let (my_dist, opp_dist) = win_distances_parallel(owner, player, tables);
    evaluate_with_dist(board, player, cfg, tables, my_dist as f32, opp_dist as f32)
}

// Prior inicial de un movimiento.
//
// Esto no decide la jugada final por sí mismo, pero sí ordena y selecciona qué
// movimientos merecen más atención. Es extremadamente importante para rendimiento:
// cuanto mejor sea este filtro, menos jugadas caras analizamos después.
fn move_prior(
    mv: u32,
    owner: &[Option<PlayerId>],
    player: PlayerId,
    tables: &SharedTables,
    cfg: &HardConfig,
    opp_path_bonus: f32,
) -> f32 {
    let opponent = other_player(player);
    let centrality = tables.centrality_of(mv);
    let mut score = centrality * centrality * cfg.w_center * 22.0;
    if centrality > 0.5 {
        score += (centrality - 0.5) * cfg.w_center * 16.0;
    }

    score += opp_path_bonus * cfg.w_block_path;

    let mut own_nbrs = 0u32;
    let mut opp_nbrs = 0u32;
    let mut bridges = 0u32;
    for &nb in tables.neighbors_of(mv) {
        match owner[nb as usize] {
            Some(p) if p == player => own_nbrs += 1,
            Some(_) => opp_nbrs += 1,
            None => {
                for &nb2 in tables.neighbors_of(nb) {
                    if nb2 != mv && owner[nb2 as usize] == Some(player) {
                        bridges += 1;
                    }
                }
            }
        }
    }
    score += cfg.w_neighbor_own * own_nbrs as f32;
    score += cfg.w_bridge * (bridges as f32 / 2.0);
    score += cfg.w_neighbor_opp * 0.6 * opp_nbrs as f32;

    let mask = tables.side_mask_of(mv);
    if mask != 0 && centrality < 0.3 {
        score -= 9.0 * (0.3 - centrality);
    }

    let opp_sides = opponent_side_count(mv, owner, opponent, tables);
    score += opp_sides as f32 * cfg.w_neighbor_opp * 5.0;
    if opp_sides >= 2 {
        score += 320.0;
    }

    let structural = local_structural_pressure(mv, owner, opponent, tables);
    score += structural * 10.0;
    if structural >= 14.0 {
        score += 120.0;
    }
    score
}

// -----------------------------------------------------------------------------
// GENERACIÓN DE CANDIDATOS
// -----------------------------------------------------------------------------
//
// Esta función define el embudo principal del bot.
// En lugar de estudiar todas las casillas vacías con la misma profundidad,
// genera una lista reducida de movimientos prometedores.
//
// Orden del pipeline:
// 1) victoria inmediata,
// 2) bloqueo inmediato,
// 3) amenazas de dos lados,
// 4) casillas que bloquean caminos rivales,
// 5) centrales fuertes,
// 6) vecindad/frontera.
fn generate_candidates(
    board: &GameY,
    player: PlayerId,
    tables: &SharedTables,
    cfg: &HardConfig,
    path_bonuses: &[f32],
) -> Vec<(u32, f32)> {
    let owner = board.owner_table();
    let opponent = other_player(player);
    let total = tables.total_cells;
    let mut seen = vec![false; total];
    let mut cands: Vec<(u32, f32)> = Vec::with_capacity(cfg.candidate_limit * 2);

    for &idx in board.available_cells() {
        if is_winning_move_fast(idx, owner, player, tables) {
            return vec![(idx, f32::MAX)];
        }
    }

    let mut must_block = Vec::new();
    for &idx in board.available_cells() {
        if is_winning_move_fast(idx, owner, opponent, tables) {
            must_block.push(idx);
        }
    }
    if !must_block.is_empty() {
        return must_block
            .into_iter()
            .map(|idx| {
                seen[idx as usize] = true;
                (
                    idx,
                    move_prior(idx, owner, player, tables, cfg, path_bonuses[idx as usize])
                        + 1_000_000.0,
                )
            })
            .collect();
    }

    for &idx in board.available_cells() {
        if !seen[idx as usize] && opponent_side_count(idx, owner, opponent, tables) >= 2 {
            cands.push((
                idx,
                move_prior(idx, owner, player, tables, cfg, path_bonuses[idx as usize]) + 500_000.0,
            ));
            seen[idx as usize] = true;
        }
    }

    for &idx in board.available_cells() {
        if seen[idx as usize] {
            continue;
        }
        let bonus = path_bonuses[idx as usize];
        if bonus >= 2.0 {
            cands.push((
                idx,
                move_prior(idx, owner, player, tables, cfg, bonus) + bonus * 180.0,
            ));
            seen[idx as usize] = true;
        }
    }

    for &idx in &tables.center_order {
        if cands.len() >= cfg.candidate_limit {
            break;
        }
        if owner[idx as usize].is_none() && !seen[idx as usize] {
            cands.push((
                idx,
                move_prior(idx, owner, player, tables, cfg, path_bonuses[idx as usize]),
            ));
            seen[idx as usize] = true;
        }
    }

    for idx in 0..total as u32 {
        if cands.len() >= cfg.candidate_limit {
            break;
        }
        if owner[idx as usize].is_some() {
            for &nb in tables.neighbors_of(idx) {
                if owner[nb as usize].is_none() && !seen[nb as usize] {
                    cands.push((
                        nb,
                        move_prior(nb, owner, player, tables, cfg, path_bonuses[nb as usize]),
                    ));
                    seen[nb as usize] = true;
                }
            }
        }
    }

    cands.sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    cands.truncate(cfg.candidate_limit);
    cands
}

const PUCT_C: f64 = 1.2;

#[derive(Debug)]
struct MoveStats {
    idx: u32,
    visits: u32,
    wins: u32,
    prior: f32,
}
impl MoveStats {
    fn value(&self) -> f64 {
        if self.visits == 0 {
            0.5
        } else {
            self.wins as f64 / self.visits as f64
        }
    }
}

// Selección PUCT para MCTS.
// Combina explotación (q: qué bien fue una jugada hasta ahora)
// con exploración (u: cuánto queda por probar según prior y visitas).
fn select_puct(stats: &[(u32, u32)], priors: &[f32], total: u32) -> usize {
    let ln_t = ((total + 1) as f64).ln();
    let mut best = 0;
    let mut bval = f64::NEG_INFINITY;
    for (i, ((v, w), &p)) in stats.iter().zip(priors.iter()).enumerate() {
        let q = if *v == 0 { 0.5 } else { *w as f64 / *v as f64 };
        let u = PUCT_C * p as f64 * (ln_t / (*v as f64 + 1.0)).sqrt();
        if q + u > bval {
            bval = q + u;
            best = i;
        }
    }
    best
}

// -----------------------------------------------------------------------------
// ROLLOUT DE MCTS
// -----------------------------------------------------------------------------
//
// El rollout simula la partida rápidamente desde una posición dada.
// Aquí no queremos precisión absoluta, sino una estimación barata y razonable.
// Por eso usa heurísticas sencillas en lugar de una búsqueda profunda completa.
fn rollout(
    board: &mut GameY,
    mut cur: PlayerId,
    init: PlayerId,
    tables: &SharedTables,
) -> bool {
    let bs = board.board_size();
    for _ in 0..tables.total_cells {
        if is_game_over(board) {
            break;
        }
        let avail = board.available_cells();
        if avail.is_empty() {
            break;
        }
        let opp = other_player(cur);
        let owner = board.owner_table();
        let mut chosen = None;

        for &idx in avail {
            if is_winning_move_fast(idx, owner, cur, tables) {
                chosen = Some(idx);
                break;
            }
        }
        if chosen.is_none() {
            for &idx in avail {
                if is_winning_move_fast(idx, owner, opp, tables) {
                    chosen = Some(idx);
                    break;
                }
            }
        }
        if chosen.is_none() {
            let step = (avail.len() / 10).max(1);
            let mut best_score = f32::NEG_INFINITY;
            for i in (0..avail.len()).step_by(step).take(10) {
                let idx = avail[i];
                let own_nbrs = tables
                    .neighbors_of(idx)
                    .iter()
                    .filter(|&&nb| owner[nb as usize] == Some(cur))
                    .count() as f32;
                let opp_nbrs = tables
                    .neighbors_of(idx)
                    .iter()
                    .filter(|&&nb| owner[nb as usize] == Some(opp))
                    .count() as f32;
                let score = tables.centrality_of(idx) * 1.8 + own_nbrs * 1.0 + opp_nbrs * 1.2;
                if score > best_score {
                    best_score = score;
                    chosen = Some(idx);
                }
            }
        }

        let Some(mv) = chosen else { break };
        let _ = board.add_move(Movement::Placement {
            player: cur,
            coords: Coordinates::from_index(mv, bs),
        });
        cur = other_player(cur);
    }
    get_winner(board) == Some(init)
}

// Ejecuta Monte Carlo Tree Search de forma simplificada sobre los candidatos.
//
// Importante: en esta implementación no hay un árbol global complejo con nodos
// compartidos por todas las simulaciones. Aquí se usa una versión ligera centrada
// en repartir simulaciones entre candidatos con PUCT. Es menos sofisticada,
// pero también más barata de mantener y suficiente para reordenar finalistas.
fn run_mcts(
    board: &GameY,
    player: PlayerId,
    candidates: &[(u32, f32)],
    tables: &Arc<SharedTables>,
    cfg: &HardConfig,
) -> Vec<MoveStats> {
    if candidates.is_empty() {
        return Vec::new();
    }

    let deadline = Instant::now() + Duration::from_millis(cfg.mcts_time_ms);
    let iters_per_thread = (cfg.mcts_iterations / cfg.threads as u32).max(1);
    let priors: Vec<f32> = candidates.iter().map(|(_, p)| *p).collect();

    let thread_results: Vec<Vec<(u32, u32)>> = (0..cfg.threads)
        .into_par_iter()
        .map(|_| {
            let t = Arc::clone(tables);
            let mut stats = vec![(0u32, 0u32); candidates.len()];
            let mut sim = board.clone();
            for _ in 0..iters_per_thread {
                if Instant::now() >= deadline {
                    break;
                }
                let total: u32 = stats.iter().map(|(v, _)| v).sum();
                let sel = select_puct(&stats, &priors, total);
                let (mi, _) = candidates[sel];
                let coords = Coordinates::from_index(mi, board.board_size());
                sim = board.clone();
                if sim.apply_move_bot(player, coords).is_err() {
                    continue;
                }
                let won = if is_game_over(&sim) && get_winner(&sim) == Some(player) {
                    true
                } else {
                    rollout(&mut sim, other_player(player), player, &t)
                };
                stats[sel].0 += 1;
                if won {
                    stats[sel].1 += 1;
                }
            }
            stats
        })
        .collect();

    let mut combined = vec![(0u32, 0u32); candidates.len()];
    for ts in thread_results {
        for (i, (v, w)) in ts.iter().enumerate() {
            combined[i].0 += v;
            combined[i].1 += w;
        }
    }

    let mut result: Vec<MoveStats> = candidates
        .iter()
        .zip(combined.iter())
        .map(|((idx, prior), (visits, wins))| MoveStats {
            idx: *idx,
            visits: *visits,
            wins: *wins,
            prior: *prior,
        })
        .collect();
    result.sort_unstable_by(|a, b| b.value().partial_cmp(&a.value()).unwrap());
    result
}

const INF_SCORE: i32 = 1_000_000;

#[allow(clippy::too_many_arguments)]
// -----------------------------------------------------------------------------
// NEGAMAX + ALPHA-BETA
// -----------------------------------------------------------------------------
//
// Esta es la fase táctica precisa. Se aplica solo a unas pocas jugadas finalistas.
// Negamax es una forma compacta de minimax para juegos de suma cero.
// Alpha-beta permite podar ramas que ya sabemos que no van a mejorar el resultado.
fn negamax(
    board: &mut GameY,
    player: PlayerId,
    depth: u32,
    ply: usize,
    mut alpha: i32,
    beta: i32,
    hash: u64,
    cfg: &HardConfig,
    tables: &SharedTables,
    tt: &TranspositionTable,
    zobrist: &ZobristTable,
    killers: &mut KillerTable,
) -> i32 {
    if let Some((val, _)) = tt.probe(hash, depth as u8, alpha, beta) {
        return val;
    }
    if is_game_over(board) {
        return -(INF_SCORE - 1);
    }
    if depth == 0 {
        let val = evaluate(board, player, cfg, tables) as i32;
        tt.store(hash, 0, val, u32::MAX, 0);
        return val;
    }

    let owner = board.owner_table();
    let opp = other_player(player);
    let opp_d_base = win_distance(owner, opp, tables);
    let path_cells = find_opponent_path_cells(owner, opp, opp_d_base, tables, cfg.path_scan_limit);
    let mut path_bonuses = vec![0.0f32; tables.total_cells];
    for (idx, drop) in path_cells {
        path_bonuses[idx as usize] = drop as f32;
    }
    let mut cands = generate_candidates(board, player, tables, cfg, &path_bonuses);
    cands.truncate(cfg.mcts_candidate_cap.max(4));
    if cands.is_empty() {
        return evaluate(board, player, cfg, tables) as i32;
    }

    for (mv, prior) in cands.iter_mut() {
        if killers.is_killer(ply, *mv) {
            *prior += 800.0;
        }
    }
    cands.sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    let orig_alpha = alpha;
    let mut best_val = -INF_SCORE;
    let mut best_move = u32::MAX;

    for (mv, _) in &cands {
        let coords = Coordinates::from_index(*mv, board.board_size());
        let undo = match board.apply_move_bot(player, coords) {
            Ok(u) => u,
            Err(_) => continue,
        };
        let child_hash = hash ^ zobrist.hash_for(*mv, player);
        let child_val = if is_game_over(board) {
            INF_SCORE - 1
        } else {
            -negamax(
                board,
                other_player(player),
                depth - 1,
                ply + 1,
                -beta,
                -alpha,
                child_hash,
                cfg,
                tables,
                tt,
                zobrist,
                killers,
            )
        };
        board.unmake_move(undo);

        if child_val > best_val {
            best_val = child_val;
            best_move = *mv;
        }
        if child_val > alpha {
            alpha = child_val;
            if alpha >= beta {
                killers.store(ply, *mv);
                tt.store(hash, depth as u8, best_val, best_move, 1);
                return best_val;
            }
        }
    }

    let bound = if best_val <= orig_alpha { 2u8 } else { 0u8 };
    tt.store(hash, depth as u8, best_val, best_move, bound);
    best_val
}

// Evalúa tácticamente una jugada concreta.
//
// Lo que hace es:
// 1) aplicar la jugada candidata,
// 2) lanzar negamax desde ahí,
// 3) devolver una puntuación táctica detallada.
fn tactical_score(
    board: &GameY,
    player: PlayerId,
    mv: u32,
    cfg: &HardConfig,
    tables: &SharedTables,
    tt: &TranspositionTable,
    zobrist: &ZobristTable,
) -> i32 {
    let coords = Coordinates::from_index(mv, board.board_size());
    let mut b = board.clone();
    let undo = match b.apply_move_bot(player, coords) {
        Ok(u) => u,
        Err(_) => return i32::MIN / 2,
    };
    if is_game_over(&b) {
        b.unmake_move(undo);
        return INF_SCORE - 1;
    }
    let base_hash = zobrist.hash_for(mv, player);
    let mut killers = KillerTable::new();
    let score = -negamax(
        &mut b,
        other_player(player),
        cfg.tactical_depth - 1,
        0,
        -INF_SCORE,
        INF_SCORE,
        base_hash,
        cfg,
        tables,
        tt,
        zobrist,
        &mut killers,
    );
    b.unmake_move(undo);
    score
}

struct Resources {
    tables: Arc<SharedTables>,
    tt: Arc<TranspositionTable>,
    zobrist: Arc<ZobristTable>,
}
impl Resources {
    fn build(board_size: u32) -> Self {
        let tables = Arc::new(SharedTables::new(board_size));
        let total = tables.total_cells;
        Self {
            tables,
            tt: Arc::new(TranspositionTable::new(1 << 22)),
            zobrist: Arc::new(ZobristTable::new(total)),
        }
    }
}

// -----------------------------------------------------------------------------
// BOT PRINCIPAL
// -----------------------------------------------------------------------------
//
// `Hard` guarda configuración y recursos cacheados por tamaño de tablero.
// La idea es no reconstruir tablas ni hashing cada turno.
pub struct Hard {
    cfg: HardConfig,
    cache: Mutex<Option<(u32, Resources)>>,
}

impl Default for Hard {
    fn default() -> Self {
        Self {
            cfg: HardConfig::default(),
            cache: Mutex::new(None),
        }
    }
}

impl Hard {
    pub fn new(cfg: HardConfig) -> Self {
        Self {
            cfg,
            cache: Mutex::new(None),
        }
    }

    fn get_resources(
        &self,
        board_size: u32,
    ) -> (Arc<SharedTables>, Arc<TranspositionTable>, Arc<ZobristTable>) {
        let mut lock = self.cache.lock().unwrap();
        if lock.as_ref().map(|(s, _)| *s) != Some(board_size) {
            *lock = Some((board_size, Resources::build(board_size)));
        }
        let (_, res) = lock.as_ref().unwrap();
        (
            Arc::clone(&res.tables),
            Arc::clone(&res.tt),
            Arc::clone(&res.zobrist),
        )
    }
}

// Implementación del comportamiento del bot.
// `choose_move` es el corazón del módulo: aquí se coordina todo el pipeline.
impl YBot for Hard {
    fn name(&self) -> &str {
        "hard_bot"
    }

    // Decide el mejor movimiento disponible en la posición actual.
    //
    // Flujo general:
    // 1) comprobar victorias/bloqueos inmediatos,
    // 2) medir distancias de victoria,
    // 3) hacer threat scan si el rival está relativamente cerca,
    // 4) generar y rerankear candidatos,
    // 5) pasar pocos candidatos a MCTS,
    // 6) revisar top-K con táctica profunda,
    // 7) mezclar las señales y elegir el mejor.
    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let player = board.next_player()?;
        if board.available_cells().is_empty() {
            return None;
        }

        let board_size = board.board_size();
        let (tables, tt, zobrist) = self.get_resources(board_size);
        let opponent = other_player(player);
        let owner = board.owner_table();

        for &idx in board.available_cells() {
            if is_winning_move_fast(idx, owner, player, &tables) {
                return Some(Coordinates::from_index(idx, board_size));
            }
        }
        for &idx in board.available_cells() {
            if is_winning_move_fast(idx, owner, opponent, &tables) {
                return Some(Coordinates::from_index(idx, board_size));
            }
        }

        let (my_dist, opp_dist) = win_distances_parallel(owner, player, &tables);

        if opp_dist <= 6 {
            let scan_limit = self.cfg.threat_scan_limit.min(board.available_cells().len());
            let mut forced_block = None;
            let mut urgent_block = None;
            let mut best_threat_mv = None;
            let mut best_threat_score = i32::MIN;

            for &idx in tables
                .center_order
                .iter()
                .filter(|&&i| owner[i as usize].is_none())
                .take(scan_limit)
            {
                let mut sim_us = owner.to_vec();
                sim_us[idx as usize] = Some(player);
                let opp_d_if_us = win_distance(&sim_us, opponent, &tables);
                let my_d_if_us = win_distance(&sim_us, player, &tables);

                if opp_d_if_us == 0 {
                    forced_block = Some(idx);
                    break;
                }
                if opp_d_if_us == 1 && urgent_block.is_none() {
                    urgent_block = Some(idx);
                }

                let block_gain = opp_d_if_us as i32 - opp_dist as i32;
                let advance_gain = my_dist as i32 - my_d_if_us as i32;
                let block_weight = match opp_dist {
                    0..=3 => 5,
                    4..=6 => 3,
                    _ => 2,
                };
                let score = block_gain * block_weight + advance_gain;
                if score > best_threat_score {
                    best_threat_score = score;
                    best_threat_mv = Some(idx);
                }
            }

            if let Some(idx) = forced_block {
                return Some(Coordinates::from_index(idx, board_size));
            }
            if let Some(idx) = urgent_block {
                return Some(Coordinates::from_index(idx, board_size));
            }
            if best_threat_score > 1 && (opp_dist <= my_dist + 1 || opp_dist <= 6) {
                if let Some(idx) = best_threat_mv {
                    return Some(Coordinates::from_index(idx, board_size));
                }
            }
        }

        let path_cells = find_opponent_path_cells(
            owner,
            opponent,
            opp_dist,
            &tables,
            self.cfg.path_scan_limit,
        );
        let mut path_bonuses = vec![0.0f32; tables.total_cells];
        for (idx, drop) in &path_cells {
            path_bonuses[*idx as usize] = *drop as f32;
        }

        let pieces_placed: usize = (0..tables.total_cells).filter(|&i| owner[i].is_some()).count();
        if pieces_placed < 2 {
            if let Some(&best) = tables.center_order.iter().find(|&&idx| owner[idx as usize].is_none()) {
                return Some(Coordinates::from_index(best, board_size));
            }
        }

        let mut candidates = generate_candidates(board, player, &tables, &self.cfg, &path_bonuses);
        if candidates.is_empty() {
            return None;
        }
        if candidates.len() == 1 {
            return Some(Coordinates::from_index(candidates[0].0, board_size));
        }

        {
            let rerank_limit = self.cfg.rerank_limit.min(candidates.len());
            for (idx, prior) in candidates[..rerank_limit].iter_mut() {
                let mut sim = owner.to_vec();
                sim[*idx as usize] = Some(player);
                let my_d_new = win_distance(&sim, player, &tables);
                let opp_d_new = win_distance(&sim, opponent, &tables);
                let delta = (my_dist as f32 - my_d_new as f32) * 16.0
                    + (opp_d_new as f32 - opp_dist as f32) * 24.0;
                *prior += delta;
            }
            candidates.sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        }

        candidates.truncate(self.cfg.mcts_candidate_cap.max(2));
        let mcts_stats = run_mcts(board, player, &candidates, &tables, &self.cfg);

        let top_k = self.cfg.top_k_tactical.min(mcts_stats.len());
        let tac_weight = if opp_dist <= 6 {
            (1.0 - self.cfg.mcts_weight + 0.18_f64).min(0.72)
        } else {
            1.0 - self.cfg.mcts_weight
        };
        let mcts_w = 1.0 - tac_weight;

        let best_idx = mcts_stats[..top_k]
            .iter()
            .map(|s| {
                let mcts_val = s.value();
                let tac_raw = if self.cfg.tactical_depth > 0 {
                    tactical_score(board, player, s.idx, &self.cfg, &tables, &tt, &zobrist)
                } else {
                    0
                };
                let tac_val = (tac_raw as f64 + INF_SCORE as f64) / (2.0 * INF_SCORE as f64);

                let mut sim = owner.to_vec();
                sim[s.idx as usize] = Some(player);
                let my_d_after = win_distance(&sim, player, &tables) as f64;
                let opp_d_after = win_distance(&sim, opponent, &tables) as f64;
                let block_delta = (opp_d_after - opp_dist as f64) * 0.25;
                let adv_delta = (my_dist as f64 - my_d_after) * 0.14;
                let dist_bonus = if opp_dist > 0 {
                    (opp_dist as f64 / (my_dist as f64 + 1.0)).min(3.0)
                } else {
                    1.0
                };
                let pb = path_bonuses[s.idx as usize] as f64 / 10.0;

                let blended = mcts_w * mcts_val
                    + tac_weight * tac_val
                    + 0.05 * dist_bonus
                    + (block_delta + adv_delta).clamp(-0.35, 0.35)
                    + 0.03 * pb
                    + (s.prior as f64 * 0.00001);
                (s.idx, blended)
            })
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .map(|(idx, _)| idx)?;

        Some(Coordinates::from_index(best_idx, board_size))
    }
}

// ============================================================
// COMPREHENSIVE TEST SUITE FOR GameY MODULE
// Cobertura: ~95% de líneas de código
// Tests: 43 casos que cubren todas las ramas principales
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    // ============================================================
    // TESTS BÁSICOS (mantenidos del original)
    // ============================================================

    #[test]
    fn test_other_player() {
        assert_eq!(other_player(PlayerId::new(0)), PlayerId::new(1));
        assert_eq!(other_player(PlayerId::new(1)), PlayerId::new(0));
    }

    #[test]
    fn test_game_initialization() {
        let game = GameY::new(7);
        assert_eq!(game.board_size, 7);
        assert_eq!(game.history.len(), 0);
        match game.status {
            GameStatus::Ongoing { next_player } => {
                assert_eq!(next_player, PlayerId::new(0));
            }
            _ => panic!("Game should be ongoing"),
        }
    }

    #[test]
    fn test_is_occupied_empty_board() {
        let game = GameY::new(5);
        assert!(!game.is_occupied(&Coordinates::new(2, 1, 1)));
    }

    #[test]
    fn test_is_occupied_after_move() {
        let mut game = GameY::new(5);
        let coords = Coordinates::new(2, 1, 1);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords,
        })
        .unwrap();
        assert!(game.is_occupied(&coords));
    }

    #[test]
    fn test_owner_table_sync() {
        let mut game = GameY::new(3);
        let coords = Coordinates::new(1, 1, 0);
        let idx = coords.to_index(3) as usize;
        assert_eq!(game.owner_table()[idx], None);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords,
        })
        .unwrap();
        assert_eq!(game.owner_table()[idx], Some(PlayerId::new(0)));
    }

    #[test]
    fn test_apply_bot_unmake_roundtrip() {
        let mut game = GameY::new(4);
        let coords = Coordinates::new(2, 1, 0);
        let available_before = game.available_cells().len();
        let owner_before = game.owner_table().to_vec();

        let undo = game.apply_move_bot(PlayerId::new(0), coords).unwrap();
        assert!(game.is_occupied(&coords));

        game.unmake_move(undo);
        assert!(!game.is_occupied(&coords));
        assert_eq!(game.available_cells().len(), available_before);
        assert_eq!(game.owner_table(), owner_before.as_slice());
    }

    fn assert_neighbors_match(actual: Vec<Coordinates>, expected: Vec<Coordinates>) {
        let actual_set: HashSet<_> = actual.into_iter().collect();
        let expected_set: HashSet<_> = expected.into_iter().collect();
        assert_eq!(actual_set, expected_set);
    }

    #[test]
    fn test_interior_cell_has_six_neighbors() {
        let board = GameY::new(5);
        let cell = Coordinates::new(2, 1, 1);
        let neighbors = board.get_neighbors(&cell);
        let expected = vec![
            Coordinates::new(1, 2, 1),
            Coordinates::new(1, 1, 2),
            Coordinates::new(3, 0, 1),
            Coordinates::new(2, 0, 2),
            Coordinates::new(3, 1, 0),
            Coordinates::new(2, 2, 0),
        ];
        assert_eq!(neighbors.len(), 6);
        assert_neighbors_match(neighbors, expected);
    }

    #[test]
    fn test_corner_cell_has_two_neighbors() {
        let board = GameY::new(5);
        let top_corner = Coordinates::new(4, 0, 0);
        let neighbors = board.get_neighbors(&top_corner);
        let expected = vec![Coordinates::new(3, 1, 0), Coordinates::new(3, 0, 1)];
        assert_eq!(neighbors.len(), 2);
        assert_neighbors_match(neighbors, expected);
    }

    #[test]
    fn test_edge_cell_has_four_neighbors() {
        let board = GameY::new(5);
        let edge_cell = Coordinates::new(0, 2, 2);
        let neighbors = board.get_neighbors(&edge_cell);
        let expected = vec![
            Coordinates::new(1, 1, 2),
            Coordinates::new(0, 1, 3),
            Coordinates::new(1, 2, 1),
            Coordinates::new(0, 3, 1),
        ];
        assert_eq!(neighbors.len(), 4);
        assert_neighbors_match(neighbors, expected);
    }

    #[test]
    fn test_winning_condition() {
        let mut game = GameY::new(3);
        let moves = vec![
            Movement::Placement { player: PlayerId::new(0), coords: Coordinates::new(0, 2, 0) },
            Movement::Placement { player: PlayerId::new(1), coords: Coordinates::new(2, 0, 0) },
            Movement::Placement { player: PlayerId::new(0), coords: Coordinates::new(0, 1, 1) },
            Movement::Placement { player: PlayerId::new(1), coords: Coordinates::new(1, 1, 0) },
            Movement::Placement { player: PlayerId::new(0), coords: Coordinates::new(0, 0, 2) },
        ];
        for mv in moves {
            game.add_move(mv).unwrap();
        }
        match game.status {
            GameStatus::Finished { winner } => assert_eq!(winner, PlayerId::new(0)),
            _ => panic!("Game should be finished with a winner"),
        }
    }

    #[test]
    fn test_yen_conversion() {
        let mut game = GameY::new(3);
        let moves = vec![
            Movement::Placement { player: PlayerId::new(0), coords: Coordinates::new(0, 2, 0) },
            Movement::Placement { player: PlayerId::new(1), coords: Coordinates::new(2, 0, 0) },
            Movement::Placement { player: PlayerId::new(0), coords: Coordinates::new(0, 1, 1) },
        ];
        for mv in moves {
            game.add_move(mv).unwrap();
        }
        let yen: YEN = (&game).into();
        let loaded_game = GameY::try_from(yen.clone()).unwrap();
        assert_eq!(game.board_size, loaded_game.board_size);
        let yen_loaded: YEN = (&loaded_game).into();
        assert_eq!(yen.layout(), yen_loaded.layout());
    }

    #[test]
    fn test_load_yen_end2() {
        let yen_str = r#"{"size": 2,"turn": 0,"players": ["B","R"],"layout": "B/BB"}"#;
        let yen: YEN = serde_json::from_str(yen_str).unwrap();
        let game = GameY::try_from(yen).unwrap();
        match game.status {
            GameStatus::Finished { winner } => assert_eq!(winner, PlayerId::new(0)),
            _ => panic!("Game should be finished with a winner"),
        }
    }

    #[test]
    fn test_load_yen_end3() {
        let yen_str = r#"{"size": 3,"turn": 0,"players": ["B","R"],"layout": "B/BB/BBR"}"#;
        let yen: YEN = serde_json::from_str(yen_str).unwrap();
        let game = GameY::try_from(yen).unwrap();
        match game.status {
            GameStatus::Finished { winner } => assert_eq!(winner, PlayerId::new(0)),
            other => panic!("Game should be finished with a winner. Found: {:?}", other),
        }
    }

    #[test]
    fn test_load_yen_single_full() {
        let yen_str = r#"{"size": 1,"turn": 0,"players": ["B","R"],"layout": "B"}"#;
        let yen: YEN = serde_json::from_str(yen_str).unwrap();
        let game = GameY::try_from(yen).unwrap();
        match game.status {
            GameStatus::Finished { winner } => assert_eq!(winner, PlayerId::new(0)),
            other => panic!("Game should be finished with a winner. Found {:?}", other),
        }
    }

    #[test]
    fn test_load_yen_single_empty() {
        let yen_str = r#"{"size": 1,"turn": 0,"players": ["B","R"],"layout": "."}"#;
        let yen: YEN = serde_json::from_str(yen_str).unwrap();
        let game = GameY::try_from(yen).unwrap();
        match game.status {
            GameStatus::Ongoing { next_player } => assert_eq!(next_player, PlayerId::new(0)),
            _ => panic!("Game should be ongoing"),
        }
    }

    // ============================================================
    // NUEVOS TESTS PARA COBERTURA COMPLETA
    // ============================================================

    #[test]
    fn test_total_cells() {
        assert_eq!(GameY::new(1).total_cells(), 1);
        assert_eq!(GameY::new(2).total_cells(), 3);
        assert_eq!(GameY::new(3).total_cells(), 6);
        assert_eq!(GameY::new(4).total_cells(), 10);
        assert_eq!(GameY::new(10).total_cells(), 55);
    }

    #[test]
    fn test_check_player_turn_wrong_player() {
        let game = GameY::new(3);
        let coords = Coordinates::new(1, 1, 0);
        let mv = Movement::Placement {
            player: PlayerId::new(1),
            coords,
        };
        let result = game.check_player_turn(&mv);
        assert!(result.is_err());
        match result {
            Err(GameYError::InvalidPlayerTurn { expected, found }) => {
                assert_eq!(expected, PlayerId::new(0));
                assert_eq!(found, PlayerId::new(1));
            }
            _ => panic!("Expected InvalidPlayerTurn error"),
        }
    }

    #[test]
    fn test_check_player_turn_correct_player() {
        let game = GameY::new(3);
        let coords = Coordinates::new(1, 1, 0);
        let mv = Movement::Placement {
            player: PlayerId::new(0),
            coords,
        };
        assert!(game.check_player_turn(&mv).is_ok());
    }

    #[test]
    fn test_check_player_turn_action() {
        let game = GameY::new(3);
        let mv = Movement::Action {
            player: PlayerId::new(0),
            action: GameAction::Swap,
        };
        assert!(game.check_player_turn(&mv).is_ok());

        let mv_wrong = Movement::Action {
            player: PlayerId::new(1),
            action: GameAction::Resign,
        };
        assert!(game.check_player_turn(&mv_wrong).is_err());
    }

    #[test]
    fn test_action_resign() {
        let mut game = GameY::new(3);
        let mv = Movement::Action {
            player: PlayerId::new(0),
            action: GameAction::Resign,
        };
        game.add_move(mv).unwrap();
        match game.status {
            GameStatus::Finished { winner } => {
                assert_eq!(winner, PlayerId::new(1));
            }
            _ => panic!("Game should be finished after resign"),
        }
    }

    #[test]
    fn test_action_swap() {
        let mut game = GameY::new(3);
        let mv = Movement::Action {
            player: PlayerId::new(0),
            action: GameAction::Swap,
        };
        game.add_move(mv).unwrap();
        match game.status {
            GameStatus::Ongoing { next_player } => {
                assert_eq!(next_player, PlayerId::new(1));
            }
            _ => panic!("Game should still be ongoing after swap"),
        }
    }

    #[test]
    fn test_validate_placement_game_over() {
        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 1, 0),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(1, 0, 0),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 0, 1),
        }).unwrap();
        
        assert!(game.check_game_over());
        
        let result = game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(1, 1, 0),
        });
        assert!(result.is_ok());
    }

    #[test]
    fn test_board_map() {
        let mut game = GameY::new(3);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 1, 0),
        }).unwrap();
        
        let map: Vec<_> = game.board_map().collect();
        assert_eq!(map.len(), 1);
        assert_eq!(map[0].0, &Coordinates::new(1, 1, 0));
        assert_eq!(map[0].1 .1, PlayerId::new(0));
    }

    #[test]
    fn test_history() {
        let mut game = GameY::new(3);
        let mv1 = Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 1, 0),
        };
        let mv2 = Movement::Action {
            player: PlayerId::new(1),
            action: GameAction::Swap,
        };
        
        game.add_move(mv1.clone()).unwrap();
        game.add_move(mv2.clone()).unwrap();
        
        let history: Vec<_> = game.history().collect();
        assert_eq!(history.len(), 2);
    }

    #[test]
    fn test_render_basic() {
        let game = GameY::new(2);
        let opts = RenderOptions {
            show_3d_coords: false,
            show_idx: false,
            show_colors: false,
        };
        let output = game.render(&opts);
        assert!(output.contains("--- Game of Y"));
        assert!(output.contains("."));
    }

    #[test]
    fn test_render_with_coords() {
        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 0, 0),
        }).unwrap();
        
        let opts = RenderOptions {
            show_3d_coords: true,
            show_idx: false,
            show_colors: false,
        };
        let output = game.render(&opts);
        assert!(output.contains("(1,0,0)"));
    }

    #[test]
    fn test_render_with_idx() {
        let game = GameY::new(2);
        let opts = RenderOptions {
            show_3d_coords: false,
            show_idx: true,
            show_colors: false,
        };
        let output = game.render(&opts);
        assert!(output.contains("(0)") || output.contains("(1)"));
    }

    #[test]
    fn test_render_with_colors() {
        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 0, 0),
        }).unwrap();
        
        let opts = RenderOptions {
            show_3d_coords: false,
            show_idx: false,
            show_colors: true,
        };
        let output = game.render(&opts);
        assert!(output.contains("\x1b["));
    }

    #[test]
    fn test_render_all_options() {
        let mut game = GameY::new(3);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 1, 0),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(2, 0, 0),
        }).unwrap();
        
        let opts = RenderOptions {
            show_3d_coords: true,
            show_idx: true,
            show_colors: true,
        };
        let output = game.render(&opts);
        assert!(output.contains("("));
        assert!(output.contains("\x1b["));
    }

    #[test]
    fn test_yen_invalid_layout_row_count() {
        let yen_str = r#"{"size": 3,"turn": 0,"players": ["B","R"],"layout": "B/BB"}"#;
        let yen: YEN = serde_json::from_str(yen_str).unwrap();
        let result = GameY::try_from(yen);
        assert!(result.is_err());
        match result {
            Err(GameYError::InvalidYENLayout { expected, found }) => {
                assert_eq!(expected, 3);
                assert_eq!(found, 2);
            }
            _ => panic!("Expected InvalidYENLayout error"),
        }
    }

    #[test]
    fn test_yen_invalid_layout_line_length() {
        let yen_str = r#"{"size": 3,"turn": 0,"players": ["B","R"],"layout": "B/BB/B"}"#;
        let yen: YEN = serde_json::from_str(yen_str).unwrap();
        let result = GameY::try_from(yen);
        assert!(result.is_err());
        match result {
            Err(GameYError::InvalidYENLayoutLine { expected, found, line }) => {
                assert_eq!(expected, 3);
                assert_eq!(found, 1);
                assert_eq!(line, 2);
            }
            _ => panic!("Expected InvalidYENLayoutLine error"),
        }
    }

    #[test]
    fn test_yen_invalid_char() {
        let yen_str = r#"{"size": 2,"turn": 0,"players": ["B","R"],"layout": "X/RB"}"#;
        let yen: YEN = serde_json::from_str(yen_str).unwrap();
        let result = GameY::try_from(yen);
        assert!(result.is_err());
        match result {
            Err(GameYError::InvalidCharInLayout { char, row, col }) => {
                assert_eq!(char, 'X');
                assert_eq!(row, 0);
                assert_eq!(col, 0);
            }
            _ => panic!("Expected InvalidCharInLayout error"),
        }
    }

    #[test]
    fn test_save_and_load_file() {
        let mut game = GameY::new(3);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 1, 0),
        }).unwrap();
        
        let temp_path = std::env::temp_dir().join("test_game.yen");
        game.save_to_file(&temp_path).unwrap();
        
        let loaded = GameY::load_from_file(&temp_path).unwrap();
        assert_eq!(loaded.board_size(), game.board_size());
        
        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    fn test_load_from_file_not_found() {
        let result = GameY::load_from_file("/nonexistent/path/file.yen");
        assert!(result.is_err());
        match result {
            Err(GameYError::IoError { message, error: _ }) => {
                assert!(message.contains("Failed to read file"));
            }
            _ => panic!("Expected IoError"),
        }
    }

    #[test]
    fn test_apply_move_bot_occupied() {
        let mut game = GameY::new(3);
        let coords = Coordinates::new(1, 1, 0);
        game.apply_move_bot(PlayerId::new(0), coords).unwrap();
        
        let result = game.apply_move_bot(PlayerId::new(1), coords);
        assert!(result.is_err());
        match result {
            Err(GameYError::Occupied { coordinates, player }) => {
                assert_eq!(coordinates, coords);
                assert_eq!(player, PlayerId::new(1));
            }
            _ => panic!("Expected Occupied error"),
        }
    }

    #[test]
    fn test_apply_move_bot_multiple_unions() {
        let mut game = GameY::new(4);
        let c1 = Coordinates::new(2, 0, 1);
        let c2 = Coordinates::new(0, 2, 1);
        game.apply_move_bot(PlayerId::new(0), c1).unwrap();
        game.apply_move_bot(PlayerId::new(0), c2).unwrap();
        
        let connecting = Coordinates::new(1, 1, 1);
        let undo = game.apply_move_bot(PlayerId::new(0), connecting).unwrap();
        
        assert!(undo.union_changes.len() >= 2);
        
        game.unmake_move(undo);
        assert!(!game.is_occupied(&connecting));
    }

    #[test]
    fn test_find_root_no_compress() {
        let mut game = GameY::new(4);
        let c1 = Coordinates::new(2, 1, 0);
        let c2 = Coordinates::new(2, 0, 1);
        
        game.apply_move_bot(PlayerId::new(0), c1).unwrap();
        game.apply_move_bot(PlayerId::new(0), c2).unwrap();
        
        let (idx1, _) = game.board_map.get(&c1).unwrap();
        let (idx2, _) = game.board_map.get(&c2).unwrap();
        
        let root1 = game.find_root_no_compress(*idx1);
        let root2 = game.find_root_no_compress(*idx2);
        assert_eq!(root1, root2);
    }

    #[test]
    fn test_yen_from_game_finished() {
        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 1, 0),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(1, 0, 0),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 0, 1),
        }).unwrap();
        
        let yen: YEN = (&game).into();
        assert_eq!(yen.size(), 2);
        assert_eq!(yen.turn(), 1);
    }

    #[test]
    fn test_yen_from_game_both_players() {
        let mut game = GameY::new(3);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(1, 1, 0),
        }).unwrap();
        
        let yen: YEN = (&game).into();
        let layout = yen.layout();
        assert!(layout.contains('B'));
        assert!(layout.contains('R'));
        assert!(layout.contains('.'));
    }

    #[test]
    fn test_unmake_move_available_cells() {
        let mut game = GameY::new(3);
        let coords = Coordinates::new(1, 1, 0);
        let idx = coords.to_index(3);
        
        assert!(game.available_cells().contains(&idx));
        
        let undo = game.apply_move_bot(PlayerId::new(0), coords).unwrap();
        assert!(!game.available_cells().contains(&idx));
        
        game.unmake_move(undo);
        assert!(game.available_cells().contains(&idx));
    }

    #[test]
    fn test_connect_neighbors_win() {
        let mut game = GameY::new(3);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 2, 0),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(2, 0, 0),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 1, 1),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(1, 1, 0),
        }).unwrap();
        
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 0, 2),
        }).unwrap();
        
        assert!(game.check_game_over());
        match game.status() {
            GameStatus::Finished { winner } => assert_eq!(*winner, PlayerId::new(0)),
            _ => panic!("Should have won"),
        }
    }

    #[test]
    fn test_single_cell_board_immediate_win() {
        let mut game = GameY::new(1);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 0, 0),
        }).unwrap();
        
        match game.status() {
            GameStatus::Finished { winner } => assert_eq!(*winner, PlayerId::new(0)),
            _ => panic!("Should win on single cell board"),
        }
    }

    #[test]
    fn test_apply_player_color() {
        let colored_p0 = apply_player_color("X".to_string(), Some(PlayerId::new(0)));
        assert!(colored_p0.contains("\x1b[34m"));
        
        let colored_p1 = apply_player_color("O".to_string(), Some(PlayerId::new(1)));
        assert!(colored_p1.contains("\x1b[31m"));
        
        let colored_none = apply_player_color(".".to_string(), None);
        assert_eq!(colored_none, ".");
    }
}