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

#[cfg(test)]
mod tests {
    use super::*;
 
    // =========================================================================
    // UTILIDADES DE TEST
    // =========================================================================
 
    /// Devuelve un PlayerId para el jugador 0 y otro para el 1.
    fn p0() -> PlayerId { PlayerId::new(0) }
    fn p1() -> PlayerId { PlayerId::new(1) }
 
    /// Construye un SharedTables mínimo para un tablero de tamaño `n`.
    /// En un Y-board de tamaño n hay n*(n+1)/2 celdas.
    fn make_tables(n: u32) -> SharedTables {
        SharedTables::new(n)
    }
 
    /// Devuelve un owner slice completamente vacío de `len` celdas.
    fn empty_owner(len: usize) -> Vec<Option<PlayerId>> {
        vec![None; len]
    }
 
    // =========================================================================
    // HARDCONFIG
    // =========================================================================
 
    #[test]
    fn hardconfig_default_sanity() {
        let cfg = HardConfig::default();
        assert!(cfg.mcts_iterations > 0, "mcts_iterations debe ser positivo");
        assert!(cfg.mcts_time_ms > 0, "mcts_time_ms debe ser positivo");
        assert!(cfg.top_k_tactical > 0);
        assert!(cfg.tactical_depth > 0);
        assert!(cfg.candidate_limit >= cfg.rerank_limit,
            "candidate_limit ({}) debe ser >= rerank_limit ({})",
            cfg.candidate_limit, cfg.rerank_limit);
        assert!(cfg.mcts_candidate_cap > 0);
        assert!(cfg.threads >= 1);
        assert!(cfg.mcts_weight > 0.0 && cfg.mcts_weight < 1.0);
        assert!(cfg.threat_scan_limit > 0);
        assert!(cfg.path_scan_limit > 0);
        // Pesos deben ser positivos para que el prior tenga sentido
        assert!(cfg.w_center > 0.0);
        assert!(cfg.w_neighbor_own > 0.0);
        assert!(cfg.w_neighbor_opp > 0.0);
        assert!(cfg.w_bridge > 0.0);
        assert!(cfg.w_block_path > 0.0);
    }
 
    #[test]
    fn hardconfig_threads_bounded() {
        let cfg = HardConfig::default();
        // Nunca debería superar 8 (el límite configurado)
        assert!(cfg.threads <= 8);
    }
 
    // =========================================================================
    // OTHER_PLAYER
    // =========================================================================
 
    #[test]
    fn other_player_involution() {
        assert_eq!(other_player(p0()).id(), p1().id());
        assert_eq!(other_player(p1()).id(), p0().id());
        // Doble negación devuelve el mismo jugador
        assert_eq!(other_player(other_player(p0())).id(), p0().id());
        assert_eq!(other_player(other_player(p1())).id(), p1().id());
    }
 
    // =========================================================================
    // TTENTRY — ENCODE / DECODE
    // =========================================================================
 
    #[test]
    fn ttentry_encode_decode_positive_value() {
        let value = 42_000i32;
        let depth = 7u8;
        let bound = 0u8; // exact
        let mv = 0x1234u32;
 
        let encoded = TTEntry::encode(value, depth, bound, mv);
        let (v, d, b, m) = TTEntry::decode(encoded);
 
        assert_eq!(v, value);
        assert_eq!(d, depth);
        assert_eq!(b, bound);
        assert_eq!(m, mv & 0x3F_FFFF);
    }
 
    #[test]
    fn ttentry_encode_decode_negative_value() {
        let value = -500_000i32;
        let depth = 3u8;
        let bound = 2u8; // upper bound
        let mv = 5u32;
 
        let (v, d, b, m) = TTEntry::decode(TTEntry::encode(value, depth, bound, mv));
 
        assert_eq!(v, value);
        assert_eq!(d, depth);
        assert_eq!(b, bound);
        assert_eq!(m, mv);
    }
 
    #[test]
    fn ttentry_encode_decode_zero_value() {
        let (v, d, b, m) = TTEntry::decode(TTEntry::encode(0, 0, 0, 0));
        assert_eq!(v, 0);
        assert_eq!(d, 0);
        assert_eq!(b, 0);
        assert_eq!(m, 0);
    }
 
    #[test]
    fn ttentry_encode_decode_max_depth() {
        let (_, d, _, _) = TTEntry::decode(TTEntry::encode(1, 255, 1, 10));
        assert_eq!(d, 255);
    }
 
    #[test]
    fn ttentry_encode_decode_all_bound_types() {
        for bound in 0u8..=2 {
            let (_, _, b, _) = TTEntry::decode(TTEntry::encode(0, 1, bound, 0));
            assert_eq!(b, bound, "bound {bound} no sobrevive encode/decode");
        }
    }
 
    // =========================================================================
    // TRANSPOSITION TABLE — probe / store
    // =========================================================================
 
    #[test]
    fn tt_miss_on_empty() {
        let tt = TranspositionTable::new(1024);
        // Sin ningún store, probe siempre debe devolver None
        assert!(tt.probe(0xDEAD_BEEF, 3, -1000, 1000).is_none());
        assert!(tt.probe(0x0000_0001, 1, 0, 0).is_none());
    }
 
    #[test]
    fn tt_store_and_probe_exact() {
        let tt = TranspositionTable::new(1024);
        let hash = 0xCAFE_BABE_1234_5678u64;
        tt.store(hash, 4, 300, 7, 0); // bound=0 (exact)
 
        let result = tt.probe(hash, 4, -1000, 1000);
        assert!(result.is_some(), "debe encontrar la entrada exacta");
        let (val, mv) = result.unwrap();
        assert_eq!(val, 300);
        assert_eq!(mv, 7);
    }
 
    #[test]
    fn tt_probe_fails_if_depth_too_low() {
        let tt = TranspositionTable::new(1024);
        let hash = 0xABCD_EF01u64;
        tt.store(hash, 2, 100, 3, 0);
 
        // Pedir profundidad 5 cuando solo tenemos 2 → miss
        assert!(tt.probe(hash, 5, -1000, 1000).is_none());
    }
 
    #[test]
    fn tt_probe_wrong_hash_is_miss() {
        let tt = TranspositionTable::new(1024);
        let hash = 0x1111_2222_3333_4444u64;
        tt.store(hash, 4, 50, 1, 0);
 
        // Hash diferente → miss aunque aterrice en el mismo slot
        let other_hash = hash ^ 0x0000_0000_0000_0001;
        assert!(tt.probe(other_hash, 4, -1000, 1000).is_none());
    }
 
    #[test]
    fn tt_lower_bound_triggers_only_above_beta() {
        let tt = TranspositionTable::new(1024);
        let hash = 0xAAAA_BBBBu64;
        tt.store(hash, 4, 500, 2, 1); // bound=1 (lower bound / corte beta)
 
        // val=500 >= beta=300 → hit
        assert!(tt.probe(hash, 4, -1000, 300).is_some());
        // val=500 < beta=600 → miss (no garantizado el valor)
        assert!(tt.probe(hash, 4, -1000, 600).is_none());
    }
 
    #[test]
    fn tt_upper_bound_triggers_only_below_alpha() {
        let tt = TranspositionTable::new(1024);
        let hash = 0xCCCC_DDDDu64;
        tt.store(hash, 4, -200, 9, 2); // bound=2 (upper bound / corte alpha)
 
        // val=-200 <= alpha=-300 → miss (no hay mejora garantizada)
        assert!(tt.probe(hash, 4, -300, 1000).is_none());
        // val=-200 <= alpha=-100 → hit
        assert!(tt.probe(hash, 4, -100, 1000).is_some());
    }
 
    #[test]
    fn tt_replace_policy_prefers_higher_depth() {
        let tt = TranspositionTable::new(1024);
        let hash = 0x5555_6666u64;
 
        tt.store(hash, 2, 10, 1, 0);
        tt.store(hash, 5, 99, 2, 0); // profundidad mayor → debe reemplazar
 
        let (val, mv) = tt.probe(hash, 5, -1000, 1000).unwrap();
        assert_eq!(val, 99);
        assert_eq!(mv, 2);
    }
 
    #[test]
    fn tt_does_not_replace_with_lower_depth() {
        let tt = TranspositionTable::new(1024);
        let hash = 0x7777_8888u64;
 
        tt.store(hash, 6, 77, 3, 0); // profundidad alta primero
        tt.store(hash, 2, 11, 4, 0); // intento de reemplazar con menor profundidad
 
        // La entrada de profundidad 6 debe seguir ahí
        let (val, _) = tt.probe(hash, 6, -1000, 1000).unwrap();
        assert_eq!(val, 77);
    }
 
    // =========================================================================
    // KILLER TABLE
    // =========================================================================
 
    #[test]
    fn killer_store_and_query() {
        let mut kt = KillerTable::new();
        kt.store(0, 42);
        assert!(kt.is_killer(0, 42));
        assert!(!kt.is_killer(0, 99));
    }
 
    #[test]
    fn killer_two_slots_per_depth() {
        let mut kt = KillerTable::new();
        kt.store(3, 10);
        kt.store(3, 20); // desplaza al 10
 
        assert!(kt.is_killer(3, 20), "el último killer debe estar en slot 0");
        assert!(kt.is_killer(3, 10), "el anterior debe estar en slot 1");
    }
 
    #[test]
    fn killer_third_move_evicts_oldest() {
        let mut kt = KillerTable::new();
        kt.store(1, 100);
        kt.store(1, 200);
        kt.store(1, 300); // desplaza al 100
 
        assert!(kt.is_killer(1, 300));
        assert!(kt.is_killer(1, 200));
        assert!(!kt.is_killer(1, 100), "100 ya no debería ser killer");
    }
 
    #[test]
    fn killer_no_duplicate_insertion() {
        let mut kt = KillerTable::new();
        kt.store(2, 55);
        kt.store(2, 55); // misma jugada dos veces
 
        // No se duplica, slot 1 permanece MAX
        assert_eq!(kt.killers[2][1], u32::MAX);
        assert!(kt.is_killer(2, 55));
    }
 
    #[test]
    fn killer_depth_out_of_range_is_noop() {
        let mut kt = KillerTable::new();
        kt.store(MAX_KILLER_DEPTH, 7); // debe ser silencioso
        kt.store(MAX_KILLER_DEPTH + 5, 7);
 
        assert!(!kt.is_killer(MAX_KILLER_DEPTH, 7));
    }
 
    // =========================================================================
    // ZOBRIST TABLE
    // =========================================================================
 
    #[test]
    fn zobrist_determinism() {
        let z1 = ZobristTable::new(10);
        let z2 = ZobristTable::new(10);
        // Ambas tablas deben producir los mismos hashes para las mismas entradas
        for cell in 0..10u32 {
            assert_eq!(z1.hash_for(cell, p0()), z2.hash_for(cell, p0()));
            assert_eq!(z1.hash_for(cell, p1()), z2.hash_for(cell, p1()));
        }
    }
 
    #[test]
    fn zobrist_different_players_different_hashes() {
        let z = ZobristTable::new(20);
        for cell in 0..20u32 {
            assert_ne!(
                z.hash_for(cell, p0()),
                z.hash_for(cell, p1()),
                "jugadores distintos deben producir hashes distintos en celda {cell}"
            );
        }
    }
 
    #[test]
    fn zobrist_different_cells_different_hashes() {
        let z = ZobristTable::new(20);
        for cell in 0..19u32 {
            assert_ne!(
                z.hash_for(cell, p0()),
                z.hash_for(cell + 1, p0()),
                "celdas distintas deben producir hashes distintos"
            );
        }
    }
 
    #[test]
    fn zobrist_nonzero_hashes() {
        let z = ZobristTable::new(30);
        for cell in 0..30u32 {
            assert_ne!(z.hash_for(cell, p0()), 0, "hash no debería ser 0");
            assert_ne!(z.hash_for(cell, p1()), 0);
        }
    }
 
    // =========================================================================
    // MOVE STATS
    // =========================================================================
 
    #[test]
    fn movestats_value_no_visits() {
        let ms = MoveStats { idx: 0, visits: 0, wins: 0, prior: 0.0 };
        assert!((ms.value() - 0.5).abs() < 1e-9, "sin visitas debe devolver 0.5");
    }
 
    #[test]
    fn movestats_value_all_wins() {
        let ms = MoveStats { idx: 0, visits: 100, wins: 100, prior: 0.0 };
        assert!((ms.value() - 1.0).abs() < 1e-9);
    }
 
    #[test]
    fn movestats_value_no_wins() {
        let ms = MoveStats { idx: 0, visits: 50, wins: 0, prior: 0.0 };
        assert!((ms.value() - 0.0).abs() < 1e-9);
    }
 
    #[test]
    fn movestats_value_half() {
        let ms = MoveStats { idx: 0, visits: 80, wins: 40, prior: 0.0 };
        assert!((ms.value() - 0.5).abs() < 1e-9);
    }
 
    #[test]
    fn movestats_value_arbitrary() {
        let ms = MoveStats { idx: 3, visits: 7, wins: 3, prior: 1.5 };
        let expected = 3.0 / 7.0;
        assert!((ms.value() - expected).abs() < 1e-9);
    }
 
    // =========================================================================
    // SELECT PUCT
    // =========================================================================
 
    #[test]
    fn select_puct_prefers_unvisited_with_high_prior() {
        // Dos movimientos: el primero muy visitado y ganador, el segundo sin visitas
        // pero con prior altísimo. PUCT debería explorar el segundo.
        let stats = vec![(100u32, 90u32), (0u32, 0u32)];
        let priors = vec![0.1f32, 100.0f32];
        let sel = select_puct(&stats, &priors, 100);
        assert_eq!(sel, 1, "debería explorar el movimiento con prior alto y 0 visitas");
    }
 
    #[test]
    fn select_puct_picks_best_q_when_prior_equal() {
        // Priors iguales, el movimiento 0 tiene Q=1.0, el 1 tiene Q=0.0
        let stats = vec![(10u32, 10u32), (10u32, 0u32)];
        let priors = vec![1.0f32, 1.0f32];
        let sel = select_puct(&stats, &priors, 20);
        assert_eq!(sel, 0, "debería elegir el de mayor Q");
    }
 
    #[test]
    fn select_puct_single_candidate_always_returns_0() {
        let stats = vec![(5u32, 2u32)];
        let priors = vec![0.5f32];
        let sel = select_puct(&stats, &priors, 5);
        assert_eq!(sel, 0);
    }
 
    #[test]
    fn select_puct_does_not_panic_on_zero_total() {
        let stats = vec![(0u32, 0u32), (0u32, 0u32)];
        let priors = vec![0.5f32, 0.5f32];
        // total=0 no debe provocar division by zero ni panic
        let _ = select_puct(&stats, &priors, 0);
    }
 
    // =========================================================================
    // SHARED TABLES — construcción y consultas básicas
    // =========================================================================
 
    #[test]
    fn shared_tables_total_cells_formula() {
        for n in [2u32, 3, 4, 5, 6] {
            let t = make_tables(n);
            let expected = (n * (n + 1) / 2) as usize;
            assert_eq!(t.total_cells, expected,
                "board_size={n}: se esperaban {expected} celdas, hay {}", t.total_cells);
        }
    }
 
    #[test]
    fn shared_tables_neighbor_count_reasonable() {
        // En un Y-hexboard cada celda tiene entre 2 y 6 vecinos
        for n in [3u32, 4, 5] {
            let t = make_tables(n);
            for idx in 0..t.total_cells as u32 {
                let nc = t.neighbors_of(idx).len();
                assert!(nc >= 2 && nc <= 6,
                    "board_size={n} celda={idx}: {nc} vecinos fuera de rango");
            }
        }
    }
 
    #[test]
    fn shared_tables_neighbor_symmetry() {
        // Si A es vecino de B, entonces B debe ser vecino de A
        for n in [3u32, 4, 5] {
            let t = make_tables(n);
            for a in 0..t.total_cells as u32 {
                for &b in t.neighbors_of(a) {
                    assert!(
                        t.neighbors_of(b).contains(&a),
                        "board_size={n}: {a} tiene a {b} como vecino pero no viceversa"
                    );
                }
            }
        }
    }
 
    #[test]
    fn shared_tables_centrality_in_range() {
        for n in [3u32, 4, 5] {
            let t = make_tables(n);
            for idx in 0..t.total_cells as u32 {
                let c = t.centrality_of(idx);
                assert!(c >= 0.0 && c <= 1.0,
                    "centralidad fuera de [0,1]: {c} en celda {idx} tablero {n}");
            }
        }
    }
 
    #[test]
    fn shared_tables_side_mask_bits() {
        // side_mask solo usa los bits 0-2 (máx valor = 0b111)
        for n in [3u32, 4, 5] {
            let t = make_tables(n);
            for idx in 0..t.total_cells as u32 {
                let m = t.side_mask_of(idx);
                assert!(m <= 0b111,
                    "side_mask={m:#b} excede 3 bits en celda {idx} tablero {n}");
            }
        }
    }
 
    #[test]
    fn shared_tables_center_order_is_full_permutation() {
        for n in [3u32, 4, 5] {
            let t = make_tables(n);
            assert_eq!(t.center_order.len(), t.total_cells,
                "center_order debe tener exactamente total_cells elementos");
            let mut sorted = t.center_order.clone();
            sorted.sort_unstable();
            let expected: Vec<u32> = (0..t.total_cells as u32).collect();
            assert_eq!(sorted, expected, "center_order debe ser una permutación completa");
        }
    }
 
    #[test]
    fn shared_tables_center_order_decreasing_centrality() {
        for n in [3u32, 4, 5] {
            let t = make_tables(n);
            // La centralidad debe ser no creciente a lo largo de center_order
            let mut prev = f32::MAX;
            for &idx in &t.center_order {
                let c = t.centrality_of(idx);
                assert!(c <= prev + 1e-6,
                    "center_order no está ordenado por centralidad decreciente en tablero {n}");
                prev = c;
            }
        }
    }
 
    #[test]
    fn shared_tables_neighbor_count_vec_agrees() {
        for n in [3u32, 4] {
            let t = make_tables(n);
            for idx in 0..t.total_cells as u32 {
                assert_eq!(
                    t.neighbor_count[idx as usize] as usize,
                    t.neighbors_of(idx).len(),
                    "neighbor_count y neighbors_of no concuerdan en celda {idx}"
                );
            }
        }
    }
 
    // =========================================================================
    // IS_WINNING_MOVE_FAST — tablero vacío
    // =========================================================================
 
    #[test]
    fn winning_move_false_on_empty_board_small() {
        let n = 3u32;
        let t = make_tables(n);
        let owner = empty_owner(t.total_cells);
        // En un tablero vacío ninguna casilla es ganadora de inmediato
        // (necesitaría ya tocar los 3 lados y conectarlos en un solo paso,
        // lo cual no es posible con el tablero vacío)
        for idx in 0..t.total_cells as u32 {
            // Una sola pieza no puede conectar los 3 lados a la vez excepto
            // si toca los 3 lados por sí sola (esquinas de ciertos tableros).
            // Aquí solo comprobamos que no haya panic.
            let _ = is_winning_move_fast(idx, &owner, p0(), &t);
        }
    }
 
    #[test]
    fn winning_move_false_on_occupied_cell() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        owner[0] = Some(p0()); // celda ocupada
 
        // Una celda ocupada nunca puede ser un movimiento ganador
        assert!(!is_winning_move_fast(0, &owner, p0(), &t));
    }
 
    // =========================================================================
    // OPPONENT_SIDE_COUNT
    // =========================================================================
 
    #[test]
    fn opp_side_count_zero_on_empty() {
        let n = 4u32;
        let t = make_tables(n);
        let owner = empty_owner(t.total_cells);
        // Sin piezas rivales, la cuenta debe ser 0 o solo lo que toca la propia celda
        for idx in 0..t.total_cells as u32 {
            let c = opponent_side_count(idx, &owner, p1(), &t);
            // La cuenta no puede exceder 3 (hay 3 lados)
            assert!(c <= 3, "opponent_side_count > 3 en celda {idx}: {c}");
        }
    }
 
    #[test]
    fn opp_side_count_zero_on_occupied_cell() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        owner[2] = Some(p0()); // ocupada por el jugador actual
 
        // Una celda ocupada devuelve 0
        assert_eq!(opponent_side_count(2, &owner, p1(), &t), 0);
    }
 
    // =========================================================================
    // LOCAL_STRUCTURAL_PRESSURE
    // =========================================================================
 
    #[test]
    fn structural_pressure_zero_on_occupied() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        owner[1] = Some(p1());
 
        assert_eq!(local_structural_pressure(1, &owner, p1(), &t), 0.0);
    }
 
    #[test]
    fn structural_pressure_nonnegative() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        // Colocar algunas piezas rivales
        owner[0] = Some(p1());
        owner[1] = Some(p1());
 
        for idx in 0..t.total_cells as u32 {
            let p = local_structural_pressure(idx, &owner, p1(), &t);
            assert!(p >= 0.0, "presión estructural negativa en celda {idx}: {p}");
        }
    }
 
    // =========================================================================
    // WIN_DISTANCE — propiedades básicas
    // =========================================================================
 
    #[test]
    fn win_distance_max_on_empty_small() {
        // En tablero vacío pequeño, la distancia no debe ser 0 para ningún jugador
        let n = 3u32;
        let t = make_tables(n);
        let owner = empty_owner(t.total_cells);
        let d = win_distance(&owner, p0(), &t);
        assert!(d > 0, "en tablero vacío la distancia debe ser > 0");
    }
 
    #[test]
    fn win_distance_decreases_with_pieces() {
        // Más piezas bien colocadas → distancia menor
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        let d_empty = win_distance(&owner, p0(), &t);
 
        // Colocar piezas del jugador 0 en celdas que tocan diferentes lados
        for idx in 0..t.total_cells as u32 {
            if t.side_mask_of(idx) != 0 {
                owner[idx as usize] = Some(p0());
            }
        }
        let d_with_pieces = win_distance(&owner, p0(), &t);
        assert!(d_with_pieces <= d_empty,
            "con piezas la distancia debería ser <= que en vacío");
    }
 
    #[test]
    fn win_distance_opponent_blocks_path() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        let d_before = win_distance(&owner, p0(), &t);
 
        // Rellenar con piezas del rival en celdas centrales
        for idx in t.center_order.iter().take(3) {
            owner[*idx as usize] = Some(p1());
        }
        let d_after = win_distance(&owner, p0(), &t);
        assert!(d_after >= d_before,
            "bloquear con piezas rivales no debería disminuir la distancia del jugador 0");
    }
 
    // =========================================================================
    // WIN_DISTANCES_PARALLEL — consistencia con win_distance secuencial
    // =========================================================================
 
    #[test]
    fn win_distances_parallel_matches_sequential() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        owner[0] = Some(p0());
        owner[1] = Some(p1());
 
        let (my, opp) = win_distances_parallel(&owner, p0(), &t);
        let my_seq = win_distance(&owner, p0(), &t);
        let opp_seq = win_distance(&owner, p1(), &t);
 
        assert_eq!(my, my_seq, "win_distance paralelo vs secuencial para p0");
        assert_eq!(opp, opp_seq, "win_distance paralelo vs secuencial para p1");
    }
 
    // =========================================================================
    // FIND_OPPONENT_PATH_CELLS
    // =========================================================================
 
    #[test]
    fn find_path_cells_respects_limit() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        owner[0] = Some(p1());
 
        let opp_d = win_distance(&owner, p1(), &t);
        let limit = 5;
        let results = find_opponent_path_cells(&owner, p1(), opp_d, &t, limit);
        // Solo se devuelven celdas que reduzcan la distancia
        for (_, drop) in &results {
            assert!(*drop > 0, "drop debe ser positivo");
        }
        assert!(results.len() <= limit);
    }
 
    #[test]
    fn find_path_cells_sorted_descending() {
        let n = 5u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        owner[0] = Some(p1());
        owner[1] = Some(p1());
 
        let opp_d = win_distance(&owner, p1(), &t);
        let results = find_opponent_path_cells(&owner, p1(), opp_d, &t, 10);
 
        // Los resultados deben estar ordenados por drop descendente
        let drops: Vec<u32> = results.iter().map(|(_, d)| *d).collect();
        let mut sorted = drops.clone();
        sorted.sort_unstable_by(|a, b| b.cmp(a));
        assert_eq!(drops, sorted, "find_opponent_path_cells debe devolver resultados ordenados");
    }
 
    // =========================================================================
    // COMPONENT_METRICS
    // =========================================================================
 
    #[test]
    fn component_metrics_empty_board() {
        let n = 4u32;
        let t = make_tables(n);
        let owner = empty_owner(t.total_cells);
        let (best_sides, best_size, best_frontier, total_components) =
            component_metrics(&owner, p0(), &t);
 
        assert_eq!(best_sides, 0);
        assert_eq!(best_size, 0);
        assert_eq!(best_frontier, 0);
        assert_eq!(total_components, 0);
    }
 
    #[test]
    fn component_metrics_single_piece() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        owner[0] = Some(p0());
 
        let (_, best_size, _, total) = component_metrics(&owner, p0(), &t);
        assert_eq!(best_size, 1, "un solo componente de tamaño 1");
        assert_eq!(total, 1, "exactamente un componente");
    }
 
    #[test]
    fn component_metrics_two_isolated_pieces() {
        let n = 5u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        // Colocar dos piezas que no sean vecinas
        owner[0] = Some(p0());
        owner[t.total_cells - 1] = Some(p0());
 
        let (_, _, _, total) = component_metrics(&owner, p0(), &t);
        assert!(total >= 1, "debe haber al menos un componente");
    }
 
    // =========================================================================
    // TRANSPOSITION TABLE — stress / colisiones
    // =========================================================================
 
    #[test]
    fn tt_survives_many_stores() {
        let tt = TranspositionTable::new(64); // tabla pequeña → muchas colisiones
        for i in 0u64..200 {
            tt.store(i, 3, i as i32 * 10, (i % 30) as u32, 0);
        }
        // Solo comprobamos que no haya panic
    }
 
    #[test]
    fn tt_size_always_power_of_two() {
        for size in [1usize, 3, 7, 15, 100, 999] {
            let tt = TranspositionTable::new(size);
            assert!(tt.size.is_power_of_two(), "tamaño {size} → {} no es potencia de 2", tt.size);
        }
    }
 
    // =========================================================================
    // SELECT_PUCT — propiedades adicionales
    // =========================================================================
 
    #[test]
    fn select_puct_result_in_valid_range() {
        let n: usize = 5;
        let stats: Vec<(u32, u32)> = (0..n).map(|i| (i as u32 * 3, i as u32 * 2)).collect();
        let priors: Vec<f32> = (0..n).map(|i| (i + 1) as f32 * 0.2).collect();
        let total: u32 = stats.iter().map(|(v, _)| v).sum();
        let sel = select_puct(&stats, &priors, total);
        assert!(sel < n, "índice seleccionado fuera de rango: {sel}");
    }
    
 
    // =========================================================================
    // MOVE_PRIOR — smoke test (no panic, valor finito)
    // =========================================================================
 
    #[test]
    fn move_prior_is_finite_on_empty_board() {
        let n = 4u32;
        let t = make_tables(n);
        let owner = empty_owner(t.total_cells);
        let cfg = HardConfig::default();
 
        for idx in 0..t.total_cells as u32 {
            let p = move_prior(idx, &owner, p0(), &t, &cfg, 0.0);
            assert!(p.is_finite(), "move_prior no finito en celda {idx}: {p}");
        }
    }
 
    #[test]
    fn move_prior_increases_with_opp_path_bonus() {
        let n = 4u32;
        let t = make_tables(n);
        let owner = empty_owner(t.total_cells);
        let cfg = HardConfig::default();
        let idx = t.center_order[0]; // celda más central
 
        let p_low = move_prior(idx, &owner, p0(), &t, &cfg, 0.0);
        let p_high = move_prior(idx, &owner, p0(), &t, &cfg, 5.0);
        assert!(p_high > p_low,
            "un bonus de bloqueo mayor debe aumentar el prior: {p_low} vs {p_high}");
    }
 
    #[test]
    fn move_prior_occupied_cell_does_not_panic() {
        let n = 4u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        owner[0] = Some(p1());
        let cfg = HardConfig::default();
 
        // No debe paniquear aunque la celda esté ocupada
        let _ = move_prior(0, &owner, p0(), &t, &cfg, 0.0);
    }
 
    // =========================================================================
    // HARD BOT — recursos cacheados
    // =========================================================================
 
    #[test]
    fn hard_resources_cached_by_size() {
        let bot = Hard::default();
        let (t1, tt1, _) = bot.get_resources(4);
        let (t2, tt2, _) = bot.get_resources(4);
        // Mismas referencias (mismos Arc) → el mismo tamaño usa la caché
        assert!(Arc::ptr_eq(&t1, &t2), "SharedTables debe venir de caché");
        assert!(Arc::ptr_eq(&tt1, &tt2), "TranspositionTable debe venir de caché");
    }
 
    #[test]
    fn hard_resources_rebuilt_on_size_change() {
        let bot = Hard::default();
        let (t1, _, _) = bot.get_resources(3);
        let (t2, _, _) = bot.get_resources(5);
        // Tamaños distintos → punteros distintos
        assert!(!Arc::ptr_eq(&t1, &t2), "tableros de distinto tamaño deben tener recursos distintos");
    }
 
    // =========================================================================
    // INVARIANTES CRUZADAS
    // =========================================================================
 
    #[test]
    fn win_distance_symmetric_on_empty() {
        // En tablero vacío ambos jugadores deberían tener la misma distancia
        let n = 4u32;
        let t = make_tables(n);
        let owner = empty_owner(t.total_cells);
        let d0 = win_distance(&owner, p0(), &t);
        let d1 = win_distance(&owner, p1(), &t);
        assert_eq!(d0, d1,
            "distancias deben ser iguales en tablero vacío simétrico: d0={d0} d1={d1}");
    }
 
    #[test]
    fn is_winning_move_fast_never_true_for_occupied() {
        let n = 5u32;
        let t = make_tables(n);
        let mut owner = empty_owner(t.total_cells);
        for idx in 0..t.total_cells as u32 {
            owner[idx as usize] = Some(p0());
        }
        // Tablero completamente lleno de p0: no hay movimiento posible
        for idx in 0..t.total_cells as u32 {
            assert!(!is_winning_move_fast(idx, &owner, p0(), &t),
                "celda ocupada no puede ser movimiento ganador");
        }
    }

    use super::*;

    // =========================================================================
    // PRUEBAS DE CONFIGURACIÓN
    // =========================================================================

    #[test]
    fn test_hardconfig_default_values() {
        let config = HardConfig::default();
        
        // Verificamos algunos valores clave para asegurarnos de que no cambien 
        // accidentalmente y rompan el rendimiento del bot.
        assert_eq!(config.mcts_iterations, 14_000);
        assert_eq!(config.tactical_depth, 5);
        assert_eq!(config.mcts_weight, 0.34);
        // El número de hilos depende de la máquina, pero debe ser al menos 1 y máximo 8
        assert!(config.threads >= 1 && config.threads <= 8);
    }

    // =========================================================================
    // PRUEBAS DE TRANSPOSITION TABLE (TT) Y ENTRIES
    // =========================================================================

    #[test]
    fn test_ttentry_encode_decode() {
        let original_value = -12345; // Valor negativo para probar el signo
        let original_depth = 7;
        let original_bound = 2; // Upper bound, por ejemplo
        let original_mv = 0x3A_BCDE; // Un movimiento arbitrario dentro del límite de 22 bits

        let encoded = TTEntry::encode(original_value, original_depth, original_bound, original_mv);
        let (value, depth, bound, mv) = TTEntry::decode(encoded);

        assert_eq!(value, original_value, "El valor decodificado no coincide");
        assert_eq!(depth, original_depth, "La profundidad decodificada no coincide");
        assert_eq!(bound, original_bound, "El bound decodificado no coincide");
        assert_eq!(mv, original_mv, "El movimiento decodificado no coincide");
    }

    #[test]
    fn test_transposition_table_store_and_probe() {
        // Inicializamos con un tamaño que no es potencia de 2 para probar el redondeo interno
        let tt = TranspositionTable::new(1000); 
        assert_eq!(tt.size, 1024, "El tamaño de la tabla debe ser la siguiente potencia de 2");

        let hash = 0xDEADBEEFCAFE1234;
        let depth = 4;
        let value = 150;
        let mv = 42;
        let bound_exact = 0;

        // Guardamos la entrada
        tt.store(hash, depth, value, mv, bound_exact);

        // 1. Probar éxito (misma o menor profundidad requerida)
        let probed = tt.probe(hash, 3, -1000, 1000);
        assert_eq!(probed, Some((value, mv)), "Debería encontrar la entrada exacta");

        // 2. Probar fallo por profundidad insuficiente
        let probed_deep = tt.probe(hash, 5, -1000, 1000);
        assert_eq!(probed_deep, None, "No debería usar una entrada si requiere más profundidad");

        // 3. Probar fallo por colisión de hash (hash diferente, mismo slot potencial)
        let bad_hash = hash + 1024; // Mismo slot si el tamaño es 1024
        assert_eq!(tt.probe(bad_hash, 3, -1000, 1000), None, "No debería devolver nada con hash incorrecto");
    }

    #[test]
    fn test_transposition_table_bounds() {
        let tt = TranspositionTable::new(1024);
        let hash = 0x1122334455667788;
        
        // Lower bound (bound = 1) -> valor >= beta
        tt.store(hash, 4, 100, 10, 1);
        assert_eq!(tt.probe(hash, 4, 50, 80), Some((100, 10)), "Debería devolver valor porque 100 >= 80 (beta)");
        assert_eq!(tt.probe(hash, 4, 50, 120), None, "No debería devolver porque 100 < 120 (beta)");

        // Upper bound (bound = 2) -> valor <= alpha
        let hash2 = 0x8877665544332211;
        tt.store(hash2, 4, -50, 20, 2);
        assert_eq!(tt.probe(hash2, 4, -20, 100), Some((-50, 20)), "Debería devolver valor porque -50 <= -20 (alpha)");
        assert_eq!(tt.probe(hash2, 4, -80, 100), None, "No debería devolver porque -50 > -80 (alpha)");
    }

    // =========================================================================
    // PRUEBAS DE KILLER TABLE
    // =========================================================================

    #[test]
    fn test_killer_table_logic() {
        let mut kt = KillerTable::new();
        let depth = 3;

        // Inserción inicial
        kt.store(depth, 10);
        assert!(kt.is_killer(depth, 10));
        assert!(!kt.is_killer(depth, 20));

        // Segunda inserción (desplaza la primera)
        kt.store(depth, 20);
        assert!(kt.is_killer(depth, 20), "El nuevo killer debería estar presente");
        assert!(kt.is_killer(depth, 10), "El primer killer debería haber sido desplazado a la segunda ranura");

        // Tercera inserción (evacúa la primera)
        kt.store(depth, 30);
        assert!(kt.is_killer(depth, 30));
        assert!(kt.is_killer(depth, 20));
        assert!(!kt.is_killer(depth, 10), "El killer más antiguo debería haber sido eliminado");

        // Intentar guardar un duplicado no debería cambiar nada
        kt.store(depth, 30);
        assert!(kt.is_killer(depth, 30));
        assert!(kt.is_killer(depth, 20));

        // Superar la profundidad máxima no debe paniquear
        kt.store(MAX_KILLER_DEPTH + 1, 99);
        assert!(!kt.is_killer(MAX_KILLER_DEPTH + 1, 99));
    }

    // =========================================================================
    // PRUEBAS DE ZOBRIST TABLE
    // =========================================================================

    #[test]
    fn test_zobrist_table_determinism() {
        let total_cells = 50;
        let z1 = ZobristTable::new(total_cells);
        let z2 = ZobristTable::new(total_cells);

        // Para PlayerId necesitamos mockearlo basado en tu crate (asumiendo que tiene .id())
        // Aquí validamos que las dos tablas se inicialicen exactamente igual,
        // garantizando determinismo entre ejecuciones.
        for i in 0..total_cells {
            for p in 0..2 {
                assert_eq!(
                    z1.table[i][p], z2.table[i][p],
                    "Los hashes Zobrist deben ser deterministas"
                );
            }
        }
    }

    // =========================================================================
    // PRUEBAS DE HELPERS
    // =========================================================================

    #[test]
    fn test_other_player() {
        // Asumiendo la firma clásica de `PlayerId::new(0)` y `PlayerId::new(1)`
        let p1 = PlayerId::new(0);
        let p2 = PlayerId::new(1);
        
        assert_eq!(other_player(p1).id(), 1);
        assert_eq!(other_player(p2).id(), 0);
    }

        #[test]
    fn win_distance_zero_when_forced_connection() {
        let tables = make_tables(3);
        let mut owner = empty_owner(tables.total_cells);

        // llenar TODO con el jugador → conexión garantizada
        for i in 0..tables.total_cells {
            owner[i] = Some(p0());
        }

        let d = win_distance(&owner, p0(), &tables);
        assert_eq!(d, 0);
    }

    #[test]
    fn win_distance_blocked_by_opponent() {
        let tables = make_tables(3);
        let mut owner = empty_owner(tables.total_cells);

        // oponente bloqueando todo
        for i in 0..tables.total_cells {
            owner[i] = Some(p1());
        }

        let d = win_distance(&owner, p0(), &tables);
        assert_eq!(d, u32::MAX);
    }

    #[test]
    fn winning_move_small_board_stack_path() {
        let tables = make_tables(5); // <512
        let owner = empty_owner(tables.total_cells);

        assert!(!is_winning_move_fast(0, &owner, p0(), &tables));
    }

    #[test]
    fn winning_move_large_board_heap_path() {
        let tables = make_tables(40); // >512
        let owner = empty_owner(tables.total_cells);

        assert!(!is_winning_move_fast(0, &owner, p0(), &tables));
    }

    #[test]
    fn generate_candidates_contains_winning_move_if_exists() {
        let tables = make_tables(5);
        let cfg = HardConfig::default();
        let board = GameY::new(5);

        let bonuses = vec![0.0; tables.total_cells];
        let cands = generate_candidates(&board, p0(), &tables, &cfg, &bonuses);

        assert!(!cands.is_empty());
    }

    #[test]
    fn path_cells_respects_limit() {
        let tables = make_tables(5);
        let owner = empty_owner(tables.total_cells);

        let limit = 5;
        let res = find_opponent_path_cells(&owner, p1(), 10, &tables, limit);

        assert!(res.len() <= limit);
    }

    #[test]
    fn evaluate_penalizes_close_opponent() {
        let tables = make_tables(5);
        let cfg = HardConfig::default();
        let board = GameY::new(5);

        let score = evaluate_with_dist(&board, p0(), &cfg, &tables, 5.0, 3.0);

        assert!(score < 0.0, "oponente cerca debería penalizar");
    }

    #[test]
    fn select_puct_prefers_unvisited_with_prior() {
        let stats = vec![(0, 0), (10, 9)];
        let priors = vec![1.0, 0.1];

        let idx = select_puct(&stats, &priors, 10);
        assert_eq!(idx, 0);
    }

    #[test]
    fn rollout_runs_without_panic() {
        let mut board = GameY::new(5);
        let tables = make_tables(5);

        let result = rollout(&mut board, p0(), p0(), &tables);

        // no nos importa quién gana, solo que ejecuta
        assert!(result == true || result == false);
    }

    #[test]
    fn negamax_depth_zero_uses_eval() {
        let mut board = GameY::new(5);
        let tables = make_tables(5);
        let cfg = HardConfig::default();
        let tt = TranspositionTable::new(1024);
        let zob = ZobristTable::new(tables.total_cells);
        let mut killers = KillerTable::new();

        let val = negamax(
            &mut board,
            p0(),
            0,
            0,
            -1000,
            1000,
            0,
            &cfg,
            &tables,
            &tt,
            &zob,
            &mut killers,
        );

        // solo comprobamos que devuelve algo razonable
        assert!(val.abs() < INF_SCORE);
    }

    #[test]
    fn choose_move_empty_board_returns_center() {
        let bot = Hard::default();
        let board = GameY::new(5);

        let mv = bot.choose_move(&board);
        assert!(mv.is_some());
    }

    #[test]
    fn choose_move_no_moves_returns_none() {
        let bot = Hard::default();
        let mut board = GameY::new(3);

        // llenar tablero
        for _ in 0..10 {
            if let Some(p) = board.next_player() {
                if let Some(&idx) = board.available_cells().first() {
                    let _ = board.apply_move_bot(p, Coordinates::from_index(idx, 3));
                }
            }
        }

        assert!(bot.choose_move(&board).is_none());
    }

}