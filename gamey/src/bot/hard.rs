//! Hard bot: Hybrid MCTS + Alpha-Beta tactical refinement.
//! v3 â€” improved opponent-path blocking, always-active threat scan,
//! threat-frontier candidate pass, stronger evaluation.

use std::collections::BinaryHeap;
use std::cmp::Reverse;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use rayon::prelude::*;

use crate::{Coordinates, GameStatus, GameY, Movement, PlayerId, YBot};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Configuration
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[derive(Debug, Clone)]
struct HardConfig {
    mcts_iterations:  u32,
    mcts_time_ms:     u64,
    top_k_tactical:   usize,
    tactical_depth:   u32,
    candidate_limit:  usize,
    threads:          usize,
    mcts_weight:      f64,
    w_center:         f32,
    w_side_touch:     f32,
    w_neighbor_own:   f32,
    w_neighbor_opp:   f32,
    w_bridge:         f32,
    // Blocking-specific weights
    w_block_path:     f32,   // bonus for cutting opponent's shortest path
    threat_scan_limit: usize, // max cells evaluated in per-cell threat scan
}

impl Default for HardConfig {
    fn default() -> Self {
        let threads = std::thread::available_parallelism()
            .map(|n| n.get()).unwrap_or(4).min(8);
        Self {
            mcts_iterations:   18_000,
            mcts_time_ms:      4_500,
            top_k_tactical:    7,
            tactical_depth:    5,
            candidate_limit:   24,
            threads,
            mcts_weight:       0.45,  // lean more on tactics (better at blocking)
            w_center:          14.0,
            w_side_touch:      1.5,
            w_neighbor_own:    2.5,
            w_neighbor_opp:    12.0,  // increased: punish opponent connectivity hard
            w_bridge:          7.0,
            w_block_path:      30.0,  // new: reward cutting opponent's path
            threat_scan_limit: 30,    // scan top-30 cells by centrality in threat pass
        }
    }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Precomputed tables
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

struct SharedTables {
    board_size:     u32,
    total_cells:    usize,
    neighbors:      Vec<Vec<u32>>,
    centrality:     Vec<f32>,
    side_mask:      Vec<u8>,
    center_order:   Vec<u32>,
    neighbor_count: Vec<u8>,
}

impl SharedTables {
    fn new(board_size: u32) -> Self {
        let total_cells = ((board_size * (board_size + 1)) / 2) as usize;
        let mut neighbors      = vec![Vec::new(); total_cells];
        let mut centrality     = vec![0.0f32; total_cells];
        let mut side_mask      = vec![0u8; total_cells];
        let mut neighbor_count = vec![0u8; total_cells];

        let center   = (board_size as f32 - 1.0) / 3.0;
        let max_dist = center * std::f32::consts::SQRT_2 + 1.0;
        let n = board_size - 1;

        for idx in 0..total_cells as u32 {
            let c = Coordinates::from_index(idx, board_size);
            let (cx, cy, cz) = (c.x(), c.y(), c.z());
            let raw: [(i64, i64, i64); 6] = [
                (cx as i64 - 1, cy as i64 + 1, cz as i64),
                (cx as i64 - 1, cy as i64,     cz as i64 + 1),
                (cx as i64 + 1, cy as i64 - 1, cz as i64),
                (cx as i64,     cy as i64 - 1, cz as i64 + 1),
                (cx as i64 + 1, cy as i64,     cz as i64 - 1),
                (cx as i64,     cy as i64 + 1, cz as i64 - 1),
            ];
            let nbrs: Vec<u32> = raw.iter()
                .filter(|&&(nx, ny, nz)|
                    nx >= 0 && ny >= 0 && nz >= 0
                    && nx as u32 + ny as u32 + nz as u32 == n)
                .map(|&(nx, ny, nz)|
                    Coordinates::new(nx as u32, ny as u32, nz as u32).to_index(board_size))
                .collect();
            neighbor_count[idx as usize] = nbrs.len() as u8;
            neighbors[idx as usize] = nbrs;

            let dist = ((cx as f32 - center).powi(2)
                + (cy as f32 - center).powi(2)
                + (cz as f32 - center).powi(2)).sqrt();
            centrality[idx as usize] = (1.0 - dist / max_dist).max(0.0);

            let mut mask = 0u8;
            if c.touches_side_a() { mask |= 0b001; }
            if c.touches_side_b() { mask |= 0b010; }
            if c.touches_side_c() { mask |= 0b100; }
            side_mask[idx as usize] = mask;
        }

        let mut center_order: Vec<u32> = (0..total_cells as u32).collect();
        center_order.sort_unstable_by(|&a, &b|
            centrality[b as usize].partial_cmp(&centrality[a as usize]).unwrap());

        Self { board_size, total_cells, neighbors, centrality, side_mask,
               center_order, neighbor_count }
    }

    #[inline] fn neighbors_of(&self, idx: u32) -> &[u32]  { &self.neighbors[idx as usize] }
    #[inline] fn centrality_of(&self, idx: u32) -> f32    { self.centrality[idx as usize] }
    #[inline] fn side_mask_of(&self, idx: u32) -> u8      { self.side_mask[idx as usize] }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Lock-free transposition table (4 M entries)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

struct TTEntry {
    key:  AtomicU64,
    data: AtomicU64,
}
impl TTEntry {
    const fn new() -> Self { Self { key: AtomicU64::new(0), data: AtomicU64::new(0) } }
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
        let mv    = (data & 0x3F_FFFF) as u32;
        (value, depth, bound, mv)
    }
}

struct TranspositionTable { size: usize, entries: Vec<TTEntry> }
unsafe impl Send for TranspositionTable {}
unsafe impl Sync for TranspositionTable {}

impl TranspositionTable {
    fn new(size: usize) -> Self {
        let size = size.next_power_of_two();
        let mut entries = Vec::with_capacity(size);
        for _ in 0..size { entries.push(TTEntry::new()); }
        Self { size, entries }
    }
    #[inline] fn slot(&self, hash: u64) -> usize { hash as usize & (self.size - 1) }
    fn probe(&self, hash: u64, depth: u8, alpha: i32, beta: i32) -> Option<(i32, u32)> {
        let e    = &self.entries[self.slot(hash)];
        let key  = e.key.load(Ordering::Relaxed);
        let data = e.data.load(Ordering::Relaxed);
        if key != hash { return None; }
        let (val, edepth, bound, mv) = TTEntry::decode(data);
        if edepth < depth { return None; }
        match bound {
            0 => Some((val, mv)),
            1 if val >= beta  => Some((val, mv)),
            2 if val <= alpha => Some((val, mv)),
            _ => None,
        }
    }
    fn store(&self, hash: u64, depth: u8, value: i32, mv: u32, bound: u8) {
        let slot     = self.slot(hash);
        let e        = &self.entries[slot];
        let old_data = e.data.load(Ordering::Relaxed);
        let (_, old_depth, _, _) = TTEntry::decode(old_data);
        if depth >= old_depth || e.key.load(Ordering::Relaxed) != hash {
            e.key.store(hash, Ordering::Relaxed);
            e.data.store(TTEntry::encode(value, depth, bound, mv), Ordering::Relaxed);
        }
    }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Killer move table
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MAX_KILLER_DEPTH: usize = 8;
struct KillerTable { killers: [[u32; 2]; MAX_KILLER_DEPTH] }
impl KillerTable {
    fn new() -> Self { Self { killers: [[u32::MAX; 2]; MAX_KILLER_DEPTH] } }
    fn store(&mut self, depth: usize, mv: u32) {
        if depth >= MAX_KILLER_DEPTH { return; }
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Zobrist
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

struct ZobristTable { table: Vec<[u64; 2]> }
impl ZobristTable {
    fn new(total_cells: usize) -> Self {
        let table = (0..total_cells).map(|i| {
            [0usize, 1].map(|p| {
                let s = (i as u64).wrapping_mul(6_364_136_223_846_793_005)
                    ^ (p as u64).wrapping_mul(1_442_695_040_888_963_407)
                    ^ 0xDEAD_BEEF_CAFE_1337;
                let v = (s ^ (s >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
                let v = (v ^ (v >> 27)).wrapping_mul(0x94d049bb133111eb);
                v ^ (v >> 31)
            })
        }).collect();
        Self { table }
    }
    #[inline] fn hash_for(&self, cell: u32, player: PlayerId) -> u64 {
        self.table[cell as usize][player.id() as usize]
    }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[inline] fn other_player(p: PlayerId) -> PlayerId {
    if p.id() == 0 { PlayerId::new(1) } else { PlayerId::new(0) }
}
#[inline] fn is_game_over(b: &GameY) -> bool {
    matches!(b.status(), GameStatus::Finished { .. })
}
#[inline] fn get_winner(b: &GameY) -> Option<PlayerId> {
    match b.status() { GameStatus::Finished { winner } => Some(*winner), _ => None }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Win distance â€” Dijkstra over (cell, side_mask) state space
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

fn win_distance(owner: &[Option<PlayerId>], player: PlayerId, tables: &SharedTables) -> u32 {
    let n   = tables.total_cells;
    let opp = other_player(player);
    let mut dist = vec![[u32::MAX; 8]; n];
    let mut heap = BinaryHeap::new();

    for idx in 0..n as u32 {
        if owner[idx as usize] == Some(opp) { continue; }
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
        if sm == 0b111 { best = d; break; }
        if d > dist[idx as usize][sm] { continue; }
        for &nb in tables.neighbors_of(idx) {
            if owner[nb as usize] == Some(opp) { continue; }
            let nb_cost  = if owner[nb as usize].is_some() { 0u32 } else { 1u32 };
            let new_mask = sm | tables.side_mask_of(nb) as usize;
            let nd       = d + nb_cost;
            if nd < dist[nb as usize][new_mask] {
                dist[nb as usize][new_mask] = nd;
                heap.push(Reverse((nd, nb, new_mask as u8)));
            }
        }
    }
    best
}

fn win_distances_parallel(
    owner: &[Option<PlayerId>],
    player: PlayerId,
    tables: &SharedTables,
) -> (u32, u32) {
    let opp     = other_player(player);
    let owner_a = owner.to_vec();
    let owner_b = owner_a.clone();
    let tptr    = tables as *const SharedTables as usize;
    rayon::join(
        move || { let t = unsafe { &*(tptr as *const SharedTables) }; win_distance(&owner_a, player, t) },
        move || { let t = unsafe { &*(tptr as *const SharedTables) }; win_distance(&owner_b, opp,    t) },
    )
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fast win check â€” BFS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[inline]
fn is_winning_move_fast(
    mv: u32, owner: &[Option<PlayerId>], player: PlayerId, tables: &SharedTables,
) -> bool {
    if owner[mv as usize].is_some() { return false; }
    let mut mask = tables.side_mask_of(mv);
    if mask == 0b111 { return true; }

    if tables.total_cells <= 512 {
        let mut queue   = [0u32; 512];
        let mut visited = [false; 512];
        let (mut head, mut tail) = (0, 0);
        for &nb in tables.neighbors_of(mv) {
            if owner[nb as usize] == Some(player) && !visited[nb as usize] {
                visited[nb as usize] = true;
                mask |= tables.side_mask_of(nb);
                if mask == 0b111 { return true; }
                queue[tail] = nb; tail += 1;
            }
        }
        while head < tail {
            let cur = queue[head]; head += 1;
            for &nb in tables.neighbors_of(cur) {
                if owner[nb as usize] == Some(player) && !visited[nb as usize] {
                    visited[nb as usize] = true;
                    mask |= tables.side_mask_of(nb);
                    if mask == 0b111 { return true; }
                    queue[tail] = nb; tail += 1;
                }
            }
        }
    } else {
        let mut vis = vec![false; tables.total_cells];
        let mut q   = VecDeque::new();
        for &nb in tables.neighbors_of(mv) {
            if owner[nb as usize] == Some(player) && !vis[nb as usize] {
                vis[nb as usize] = true; mask |= tables.side_mask_of(nb);
                if mask == 0b111 { return true; } q.push_back(nb);
            }
        }
        while let Some(cur) = q.pop_front() {
            for &nb in tables.neighbors_of(cur) {
                if owner[nb as usize] == Some(player) && !vis[nb as usize] {
                    vis[nb as usize] = true; mask |= tables.side_mask_of(nb);
                    if mask == 0b111 { return true; } q.push_back(nb);
                }
            }
        }
    }
    false
}

fn opponent_side_count(
    mv: u32, owner: &[Option<PlayerId>], opp: PlayerId, tables: &SharedTables,
) -> u32 {
    if owner[mv as usize].is_some() { return 0; }
    let mut mask = tables.side_mask_of(mv);
    let mut vis  = vec![false; tables.total_cells];
    let mut q    = VecDeque::new();
    for &nb in tables.neighbors_of(mv) {
        if owner[nb as usize] == Some(opp) && !vis[nb as usize] {
            vis[nb as usize] = true; mask |= tables.side_mask_of(nb);
            if mask == 0b111 { return 3; } q.push_back(nb);
        }
    }
    while let Some(cur) = q.pop_front() {
        for &nb in tables.neighbors_of(cur) {
            if owner[nb as usize] == Some(opp) && !vis[nb as usize] {
                vis[nb as usize] = true; mask |= tables.side_mask_of(nb);
                if mask == 0b111 { return 3; } q.push_back(nb);
            }
        }
    }
    mask.count_ones()
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NEW: Find cells on opponent's threatening path.
//
// Strategy: for each empty cell (up to `limit` by centrality), simulate the
// opponent placing there and measure the distance drop. Cells that reduce
// opponent's distance the most are the most urgent to block.
// We return (cell_idx, distance_drop) sorted descending.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

fn find_opponent_path_cells(
    owner: &[Option<PlayerId>],
    opp: PlayerId,
    opp_d_base: u32,
    tables: &SharedTables,
    limit: usize,
) -> Vec<(u32, u32)> {
    // Iterate cells in centrality order (most dangerous first) up to `limit`
    let mut results: Vec<(u32, u32)> = tables.center_order.iter()
        .filter(|&&idx| owner[idx as usize].is_none())
        .take(limit)
        .filter_map(|&idx| {
            let mut sim = owner.to_vec();
            sim[idx as usize] = Some(opp);
            let d = win_distance(&sim, opp, tables);
            if d < opp_d_base { Some((idx, opp_d_base - d)) } else { None }
        })
        .collect();
    results.sort_unstable_by(|a, b| b.1.cmp(&a.1));
    results
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Evaluation
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

fn evaluate_with_dist(
    board: &GameY, player: PlayerId, cfg: &HardConfig,
    tables: &SharedTables, my_dist: f32, opp_dist: f32,
) -> f32 {
    let owner = board.owner_table();

    // Primary: win-distance differential
    let mut score = (opp_dist - my_dist) * 22.0;

    // Steeper urgency curves â€” opponent close is an emergency
    if opp_dist <= 4.0 { score -= (5.0 - opp_dist) * 120.0; }
    else if opp_dist <= 7.0 { score -= (8.0 - opp_dist) * 30.0; }
    if my_dist <= 4.0 { score += (5.0 - my_dist) * 100.0; }

    for idx in 0..tables.total_cells as u32 {
        let Some(cp) = owner[idx as usize] else { continue };
        let sign = if cp == player { 1.0f32 } else { -1.0 };
        let c    = tables.centrality_of(idx);

        // Quadratic centrality
        score += sign * cfg.w_center * c * c * 4.5;

        let mut connected = 0u32;
        let mut opp_adj   = 0u32;
        for &nb in tables.neighbors_of(idx) {
            if owner[nb as usize] == Some(cp)            { connected += 1; }
            else if owner[nb as usize].is_some()         { opp_adj   += 1; }
        }

        // Isolation penalty
        if connected == 0 { score += sign * (-5.0); }
        else               { score += sign * cfg.w_neighbor_own * connected as f32; }

        // Pressure / threat â€” opponent adjacency is dangerous for us
        if cp == player {
            score -= cfg.w_neighbor_opp * 0.2 * opp_adj as f32;
        }

        // Virtual connections
        if cp == player {
            let mut bridges = 0u32;
            for &nb in tables.neighbors_of(idx) {
                if owner[nb as usize].is_none() {
                    for &nb2 in tables.neighbors_of(nb) {
                        if nb2 != idx && owner[nb2 as usize] == Some(player) { bridges += 1; }
                    }
                }
            }
            score += cfg.w_bridge * (bridges as f32 / 2.0);
        }
    }
    score
}

fn evaluate(board: &GameY, player: PlayerId, cfg: &HardConfig, tables: &SharedTables) -> f32 {
    let owner              = board.owner_table();
    let (my_dist, opp_dist) = win_distances_parallel(owner, player, tables);
    evaluate_with_dist(board, player, cfg, tables, my_dist as f32, opp_dist as f32)
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Move prior â€” now with explicit path-blocking bonus
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

fn move_prior(
    mv: u32,
    owner: &[Option<PlayerId>],
    player: PlayerId,
    tables: &SharedTables,
    cfg: &HardConfig,
    opp_path_bonus: f32,  // precomputed bonus: how much this cell blocks opp path
) -> f32 {
    let opponent   = other_player(player);
    let centrality = tables.centrality_of(mv);

    let mut score = centrality * centrality * cfg.w_center * 22.0;
    if centrality > 0.5 { score += (centrality - 0.5) * cfg.w_center * 16.0; }

    // Path-blocking bonus (precomputed from find_opponent_path_cells)
    score += opp_path_bonus * cfg.w_block_path;

    let mut own_nbrs = 0u32;
    let mut opp_nbrs = 0u32;
    let mut bridges  = 0u32;
    for &nb in tables.neighbors_of(mv) {
        match owner[nb as usize] {
            Some(p) if p == player => own_nbrs += 1,
            Some(_) => opp_nbrs += 1,
            None => {
                for &nb2 in tables.neighbors_of(nb) {
                    if nb2 != mv && owner[nb2 as usize] == Some(player) { bridges += 1; }
                }
            }
        }
    }
    score += cfg.w_neighbor_own * own_nbrs as f32;
    score += cfg.w_bridge       * (bridges as f32 / 2.0);
    // Reward cells that sit next to opponent pieces (they're likely on paths)
    score += cfg.w_neighbor_opp * 0.6 * opp_nbrs as f32;

    let mask = tables.side_mask_of(mv);
    if mask != 0 && centrality < 0.3 { score -= 9.0 * (0.3 - centrality); }

    let opp_sides = opponent_side_count(mv, owner, opponent, tables);
    score += opp_sides as f32 * cfg.w_neighbor_opp * 5.0;
    if opp_sides >= 2 { score += 300.0; }

    score
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Candidate generation â€” with threat-frontier pass
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

fn generate_candidates(
    board: &GameY, player: PlayerId,
    tables: &SharedTables, cfg: &HardConfig,
    // Precomputed path-block bonuses: cell â†’ bonus value (0 if not on path)
    path_bonuses: &[f32],
) -> Vec<(u32, f32)> {
    let owner    = board.owner_table();
    let opponent = other_player(player);
    let total    = tables.total_cells;
    let mut seen  = vec![false; total];
    let mut cands: Vec<(u32, f32)> = Vec::with_capacity(cfg.candidate_limit * 2);

    // Pass 1: immediate WIN
    for &idx in board.available_cells() {
        if is_winning_move_fast(idx, owner, player, tables) {
            return vec![(idx, f32::MAX)];
        }
    }
    // Pass 2: immediate BLOCK
    let mut must_block: Vec<u32> = Vec::new();
    for &idx in board.available_cells() {
        if is_winning_move_fast(idx, owner, opponent, tables) { must_block.push(idx); }
    }
    if !must_block.is_empty() {
        return must_block.into_iter().map(|idx| {
            seen[idx as usize] = true;
            (idx, move_prior(idx, owner, player, tables, cfg, path_bonuses[idx as usize]) + 1_000_000.0)
        }).collect();
    }
    // Pass 3: block 2-side threats
    for &idx in board.available_cells() {
        if !seen[idx as usize] && opponent_side_count(idx, owner, opponent, tables) >= 2 {
            cands.push((idx, move_prior(idx, owner, player, tables, cfg, path_bonuses[idx as usize]) + 500_000.0));
            seen[idx as usize] = true;
        }
    }
    // Pass 3.5 (NEW): threat-frontier â€” cells with high path-blocking bonus
    // These are cells that, if the opponent takes them, most shorten their path.
    // We must block them proactively even if they're not yet adjacent to opp pieces.
    for &idx in board.available_cells() {
        if seen[idx as usize] { continue; }
        let bonus = path_bonuses[idx as usize];
        if bonus >= 2.0 {  // blocks â‰¥2 steps from opponent's path
            cands.push((idx, move_prior(idx, owner, player, tables, cfg, bonus) + bonus * 200.0));
            seen[idx as usize] = true;
        }
    }
    // Pass 4: top-centrality cells
    for &idx in &tables.center_order {
        if cands.len() >= cfg.candidate_limit { break; }
        if owner[idx as usize].is_none() && !seen[idx as usize] {
            cands.push((idx, move_prior(idx, owner, player, tables, cfg, path_bonuses[idx as usize])));
            seen[idx as usize] = true;
        }
    }
    // Pass 5: frontier fill
    for idx in 0..total as u32 {
        if cands.len() >= cfg.candidate_limit { break; }
        if owner[idx as usize].is_some() {
            for &nb in tables.neighbors_of(idx) {
                if owner[nb as usize].is_none() && !seen[nb as usize] {
                    cands.push((nb, move_prior(nb, owner, player, tables, cfg, path_bonuses[nb as usize])));
                    seen[nb as usize] = true;
                }
            }
        }
    }

    cands.sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    cands.truncate(cfg.candidate_limit);
    cands
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MCTS â€” root-parallel
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PUCT_C: f64 = 1.2;

#[derive(Debug)]
struct MoveStats {
    idx: u32, visits: u32, wins: u32, prior: f32,
}
impl MoveStats {
    fn value(&self) -> f64 {
        if self.visits == 0 { 0.5 } else { self.wins as f64 / self.visits as f64 }
    }
}

fn select_puct(stats: &[(u32, u32)], priors: &[f32], total: u32) -> usize {
    let ln_t = ((total + 1) as f64).ln();
    let mut best = 0;
    let mut bval = f64::NEG_INFINITY;
    for (i, ((v, w), &p)) in stats.iter().zip(priors.iter()).enumerate() {
        let q = if *v == 0 { 0.5 } else { *w as f64 / *v as f64 };
        let u = PUCT_C * p as f64 * (ln_t / (*v as f64 + 1.0)).sqrt();
        if q + u > bval { bval = q + u; best = i; }
    }
    best
}

fn rollout(
    board: &mut GameY, mut cur: PlayerId, init: PlayerId,
    tables: &SharedTables, _cfg: &HardConfig,
) -> bool {
    let bs = board.board_size();
    for _ in 0..tables.total_cells {
        if is_game_over(board) { break; }
        let avail = board.available_cells();
        if avail.is_empty() { break; }
        let opp   = other_player(cur);
        let owner = board.owner_table();
        let mut chosen = None;

        for &idx in avail {
            if is_winning_move_fast(idx, owner, cur, tables) { chosen = Some(idx); break; }
        }
        if chosen.is_none() {
            for &idx in avail {
                if is_winning_move_fast(idx, owner, opp, tables) { chosen = Some(idx); break; }
            }
        }
        if chosen.is_none() {
            let step = (avail.len() / 10).max(1);
            let mut best_score = f32::NEG_INFINITY;
            for i in (0..avail.len()).step_by(step).take(10) {
                let idx      = avail[i];
                let own_nbrs = tables.neighbors_of(idx)
                    .iter().filter(|&&nb| owner[nb as usize] == Some(cur)).count() as f32;
                // Also consider opponent blocking in rollout
                let opp_nbrs = tables.neighbors_of(idx)
                    .iter().filter(|&&nb| owner[nb as usize] == Some(opp)).count() as f32;
                let score = tables.centrality_of(idx) * 2.5 + own_nbrs * 0.6 + opp_nbrs * 0.4;
                if score > best_score { best_score = score; chosen = Some(idx); }
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

fn run_mcts(
    board: &GameY, player: PlayerId,
    candidates: &[(u32, f32)],
    tables: &Arc<SharedTables>,
    cfg: &HardConfig,
) -> Vec<MoveStats> {
    if candidates.is_empty() { return Vec::new(); }

    let deadline         = Instant::now() + Duration::from_millis(cfg.mcts_time_ms);
    let iters_per_thread = (cfg.mcts_iterations / cfg.threads as u32).max(1);
    let priors: Vec<f32> = candidates.iter().map(|(_, p)| *p).collect();

    let thread_results: Vec<Vec<(u32, u32)>> = (0..cfg.threads)
        .into_par_iter()
        .map(|_| {
            let t    = Arc::clone(tables);
            let mut stats = vec![(0u32, 0u32); candidates.len()];
            for _ in 0..iters_per_thread {
                if Instant::now() >= deadline { break; }
                let total: u32 = stats.iter().map(|(v, _)| v).sum();
                let sel         = select_puct(&stats, &priors, total);
                let (mi, _)     = candidates[sel];
                let coords      = Coordinates::from_index(mi, board.board_size());
                let mut sim     = board.clone();
                let undo = match sim.apply_move_bot(player, coords) { Ok(u) => u, Err(_) => continue };
                let won = if is_game_over(&sim) && get_winner(&sim) == Some(player) {
                    true
                } else {
                    let mut r = sim.clone();
                    rollout(&mut r, other_player(player), player, &t, cfg)
                };
                sim.unmake_move(undo);
                stats[sel].0 += 1;
                if won { stats[sel].1 += 1; }
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

    let mut result: Vec<MoveStats> = candidates.iter().zip(combined.iter())
        .map(|((idx, prior), (visits, wins))|
            MoveStats { idx: *idx, visits: *visits, wins: *wins, prior: *prior })
        .collect();
    result.sort_unstable_by(|a, b| b.value().partial_cmp(&a.value()).unwrap());
    result
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Negamax + Alpha-Beta + TT + killer moves
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const INF_SCORE: i32 = 1_000_000;

#[allow(clippy::too_many_arguments)]
fn negamax(
    board: &mut GameY, player: PlayerId,
    depth: u32, ply: usize,
    mut alpha: i32, beta: i32,
    hash: u64,
    cfg: &HardConfig, tables: &SharedTables,
    tt: &TranspositionTable, zobrist: &ZobristTable,
    killers: &mut KillerTable,
) -> i32 {
    if let Some((val, _)) = tt.probe(hash, depth as u8, alpha, beta) { return val; }
    if is_game_over(board) { return -(INF_SCORE - 1); }
    if depth == 0 {
        let val = evaluate(board, player, cfg, tables) as i32;
        tt.store(hash, 0, val, u32::MAX, 0);
        return val;
    }

    // In tactical search we use empty path bonuses (no precomputed data available here)
    let empty_bonuses = vec![0.0f32; tables.total_cells];
    let mut cands = generate_candidates(board, player, tables, cfg, &empty_bonuses);
    if cands.is_empty() { return evaluate(board, player, cfg, tables) as i32; }

    for (mv, prior) in cands.iter_mut() {
        if killers.is_killer(ply, *mv) { *prior += 800.0; }
    }
    cands.sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    let orig_alpha = alpha;
    let mut best_val  = -INF_SCORE;
    let mut best_move = u32::MAX;

    for (mv, _) in &cands {
        let coords    = Coordinates::from_index(*mv, board.board_size());
        let undo      = match board.apply_move_bot(player, coords) { Ok(u) => u, Err(_) => continue };
        let child_hash = hash ^ zobrist.hash_for(*mv, player);
        let child_val  = if is_game_over(board) { INF_SCORE - 1 } else {
            -negamax(board, other_player(player), depth - 1, ply + 1,
                     -beta, -alpha, child_hash, cfg, tables, tt, zobrist, killers)
        };
        board.unmake_move(undo);

        if child_val > best_val { best_val = child_val; best_move = *mv; }
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

fn tactical_score(
    board: &GameY, player: PlayerId, mv: u32,
    cfg: &HardConfig, tables: &SharedTables,
    tt: &TranspositionTable, zobrist: &ZobristTable,
) -> i32 {
    let coords = Coordinates::from_index(mv, board.board_size());
    let mut b  = board.clone();
    let undo   = match b.apply_move_bot(player, coords) { Ok(u) => u, Err(_) => return i32::MIN / 2 };
    if is_game_over(&b) { b.unmake_move(undo); return INF_SCORE - 1; }
    let base_hash   = zobrist.hash_for(mv, player);
    let mut killers = KillerTable::new();
    let score = -negamax(
        &mut b, other_player(player), cfg.tactical_depth - 1, 0,
        -INF_SCORE, INF_SCORE, base_hash,
        cfg, tables, tt, zobrist, &mut killers,
    );
    b.unmake_move(undo);
    score
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Resource cache
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

struct Resources {
    tables:  Arc<SharedTables>,
    tt:      Arc<TranspositionTable>,
    zobrist: Arc<ZobristTable>,
}
impl Resources {
    fn build(board_size: u32) -> Self {
        let tables = Arc::new(SharedTables::new(board_size));
        let total  = tables.total_cells;
        Self {
            tables,
            tt:      Arc::new(TranspositionTable::new(1 << 22)),
            zobrist: Arc::new(ZobristTable::new(total)),
        }
    }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Public bot struct
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub struct Hard {
    cfg:   HardConfig,
    cache: Mutex<Option<(u32, Resources)>>,
}

impl Default for Hard {
    fn default() -> Self { Self { cfg: HardConfig::default(), cache: Mutex::new(None) } }
}

impl Hard {
    pub fn new(cfg: HardConfig) -> Self { Self { cfg, cache: Mutex::new(None) } }

    fn get_resources(
        &self, board_size: u32,
    ) -> (Arc<SharedTables>, Arc<TranspositionTable>, Arc<ZobristTable>) {
        let mut lock = self.cache.lock().unwrap();
        if lock.as_ref().map(|(s, _)| *s) != Some(board_size) {
            *lock = Some((board_size, Resources::build(board_size)));
        }
        let (_, res) = lock.as_ref().unwrap();
        (Arc::clone(&res.tables), Arc::clone(&res.tt), Arc::clone(&res.zobrist))
    }
}

impl YBot for Hard {
    fn name(&self) -> &str { "hard_bot" }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let player = board.next_player()?;
        if board.available_cells().is_empty() { return None; }

        let board_size            = board.board_size();
        let (tables, tt, zobrist) = self.get_resources(board_size);
        let opponent              = other_player(player);
        let owner                 = board.owner_table();

        // â”€â”€ Step 1: immediate WIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        for &idx in board.available_cells() {
            if is_winning_move_fast(idx, owner, player, &tables) {
                return Some(Coordinates::from_index(idx, board_size));
            }
        }
        {
            let my_d_base = win_distance(owner, player, &tables);
            if my_d_base <= 1 {
                for &idx in board.available_cells() {
                    let mut sim = owner.to_vec();
                    sim[idx as usize] = Some(player);
                    if win_distance(&sim, player, &tables) == 0 {
                        return Some(Coordinates::from_index(idx, board_size));
                    }
                }
            }
        }

        // â”€â”€ Step 2: immediate BLOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        for &idx in board.available_cells() {
            if is_winning_move_fast(idx, owner, opponent, &tables) {
                return Some(Coordinates::from_index(idx, board_size));
            }
        }
        {
            let opp_d_base = win_distance(owner, opponent, &tables);
            if opp_d_base <= 2 {
                for &idx in board.available_cells() {
                    let mut sim = owner.to_vec();
                    sim[idx as usize] = Some(opponent);
                    if win_distance(&sim, opponent, &tables) == 0 {
                        return Some(Coordinates::from_index(idx, board_size));
                    }
                }
            }
        }

        // â”€â”€ Step 2.5: Threat scan (ALWAYS active) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Previously gated at opp_d <= 6 â€” now always runs but with a cell limit
        // so it doesn't blow the time budget.
        {
            let opp_d_now = win_distance(owner, opponent, &tables);
            let my_d_now  = win_distance(owner, player,   &tables);

            // Adaptive scan limit: deeper scan when threat is close
            let scan_limit = if opp_d_now <= 4 { 60 }
                             else if opp_d_now <= 7 { 40 }
                             else { 25 };

            let mut forced_block:      Option<u32> = None;
            let mut urgent_block:      Option<u32> = None;
            let mut best_threat_mv:    Option<u32> = None;
            let mut best_threat_score: i32         = i32::MIN;

            // Scan in centrality order so we check the most dangerous cells first
            for &idx in tables.center_order.iter()
                .filter(|&&i| owner[i as usize].is_none())
                .take(scan_limit)
            {
                let mut sim_opp = owner.to_vec();
                sim_opp[idx as usize] = Some(opponent);
                let opp_d_if_opp = win_distance(&sim_opp, opponent, &tables);

                if opp_d_if_opp == 0 { forced_block = Some(idx); break; }
                if opp_d_if_opp == 1 && urgent_block.is_none() { urgent_block = Some(idx); }

                let mut sim_us = owner.to_vec();
                sim_us[idx as usize] = Some(player);
                let opp_d_if_us = win_distance(&sim_us, opponent, &tables);
                let my_d_if_us  = win_distance(&sim_us, player,   &tables);

                let block_gain   = opp_d_if_us as i32 - opp_d_now as i32;
                let advance_gain = my_d_now as i32 - my_d_if_us as i32;
                // Weight blocking more heavily when opponent is close
                let block_weight = match opp_d_now {
                    0..=3 => 5,
                    4..=6 => 3,
                    _     => 2,
                };
                let score = block_gain * block_weight + advance_gain;

                if score > best_threat_score {
                    best_threat_score = score;
                    best_threat_mv    = Some(idx);
                }
            }

            if let Some(idx) = forced_block {
                return Some(Coordinates::from_index(idx, board_size));
            }
            if let Some(idx) = urgent_block {
                return Some(Coordinates::from_index(idx, board_size));
            }
            // Act on strategic blocks when opponent is threatening or we're behind
            if best_threat_score > 1 && (opp_d_now < my_d_now || opp_d_now <= 8) {
                if let Some(idx) = best_threat_mv {
                    return Some(Coordinates::from_index(idx, board_size));
                }
            }
        }

        // â”€â”€ Step 3: precompute distances + opponent path bonuses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let (my_dist, opp_dist) = win_distances_parallel(owner, player, &tables);
        let opp_d_base = win_distance(owner, opponent, &tables);

        // Build per-cell path-blocking bonus array (used throughout remaining steps)
        let path_cells = find_opponent_path_cells(
            owner, opponent, opp_d_base, &tables, self.cfg.threat_scan_limit,
        );
        let mut path_bonuses = vec![0.0f32; tables.total_cells];
        for (idx, drop) in &path_cells {
            path_bonuses[*idx as usize] = *drop as f32;
        }

        // â”€â”€ Step 4: early game shortcut â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let pieces_placed: usize = (0..tables.total_cells)
            .filter(|&i| board.owner_table()[i].is_some()).count();
        if pieces_placed < 3 {
            if let Some(&best) = tables.center_order.iter()
                .find(|&&idx| board.owner_table()[idx as usize].is_none())
            {
                return Some(Coordinates::from_index(best, board_size));
            }
        }

        // â”€â”€ Step 5: generate + re-rank candidates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let mut candidates = generate_candidates(board, player, &tables, &self.cfg, &path_bonuses);
        if candidates.is_empty() { return None; }
        if candidates.len() == 1 {
            return Some(Coordinates::from_index(candidates[0].0, board_size));
        }

        // Re-rank by win-distance delta (top candidates only, for speed)
        {
            let opp          = other_player(player);
            let my_d_base    = win_distance(owner, player, &tables);
            let rerank_limit = self.cfg.candidate_limit.min(candidates.len());
            for (idx, prior) in candidates[..rerank_limit].iter_mut() {
                let mut sim = owner.to_vec();
                sim[*idx as usize] = Some(player);
                let my_d_new  = win_distance(&sim, player, &tables);
                let opp_d_new = win_distance(&sim, opp,    &tables);
                let delta = (my_d_base as f32 - my_d_new as f32)  * 16.0
                          + (opp_d_new as f32 - opp_d_base as f32) * 24.0; // blocking weighted more
                *prior += delta;
            }
            candidates.sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        }

        // â”€â”€ Step 6: MCTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let mcts_stats = run_mcts(board, player, &candidates, &tables, &self.cfg);

        // â”€â”€ Step 7: tactical refinement on top-K â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let top_k    = self.cfg.top_k_tactical.min(mcts_stats.len());

        // Boost tactical weight when opponent is close (tactics find blocks better)
        let tac_weight = if opp_dist <= 5 {
            (1.0 - self.cfg.mcts_weight + 0.20_f64).min(0.70)
        } else {
            1.0 - self.cfg.mcts_weight
        };
        let mcts_w = 1.0 - tac_weight;

        let best_idx = mcts_stats[..top_k].iter()
            .map(|s| {
                let mcts_val = s.value();
                let tac_raw  = if self.cfg.tactical_depth > 0 {
                    tactical_score(board, player, s.idx, &self.cfg, &tables, &tt, &zobrist)
                } else { 0 };
                let tac_val = (tac_raw as f64 + INF_SCORE as f64) / (2.0 * INF_SCORE as f64);

                let mut sim = owner.to_vec();
                sim[s.idx as usize] = Some(player);
                let my_d_after  = win_distance(&sim, player,             &tables) as f64;
                let opp_d_after = win_distance(&sim, other_player(player), &tables) as f64;
                // Blocking bonus: how much does this move push opponent away?
                let block_delta = (opp_d_after - opp_dist as f64) * 0.25;
                let adv_delta   = (my_dist as f64 - my_d_after)   * 0.14;
                let dist_bonus  = if opp_dist > 0 {
                    (opp_dist as f64 / (my_dist as f64 + 1.0)).min(3.0)
                } else { 1.0 };
                // Path-blocking bonus
                let pb = path_bonuses[s.idx as usize] as f64 / 10.0;

                let blended = mcts_w    * mcts_val
                    + tac_weight        * tac_val
                    + 0.05              * dist_bonus
                    + (block_delta + adv_delta).clamp(-0.35, 0.35)
                    + 0.03 * pb;
                (s.idx, blended)
            })
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .map(|(idx, _)| idx)?;

        Some(Coordinates::from_index(best_idx, board_size))
    }
}