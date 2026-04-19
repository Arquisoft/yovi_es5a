use crate::core::SetIdx;
use crate::core::player_set::PlayerSet;
use crate::{Coordinates, GameAction, GameYError, Movement, PlayerId, RenderOptions, YEN};
use std::collections::HashMap;
use std::fmt::Write;
use std::path::Path;


pub type Result<T> = std::result::Result<T, crate::GameYError>;


#[derive(Debug, Clone)]
pub struct GameY {
    board_size: u32,
    board_map: HashMap<Coordinates, (SetIdx, PlayerId)>,
    owner_table: Vec<Option<PlayerId>>,
    status: GameStatus,
    history: Vec<Movement>,
    sets: Vec<PlayerSet>,
    available_cells: Vec<u32>,
}


#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    Empty,
    Occupied(PlayerId),
}


#[derive(Debug, Clone)]
struct UnionChange {
    root_i: SetIdx,
    root_j: SetIdx,
    root_j_before: PlayerSet,
}


#[derive(Debug, Clone)]
pub struct UndoMove {
    coords: Coordinates,
    player: PlayerId,
    prev_status: GameStatus,
    inserted_set_idx: SetIdx,
    union_changes: Vec<UnionChange>,
}


impl GameY {
    pub fn board_map(&self) -> impl Iterator<Item = (&Coordinates, &(SetIdx, PlayerId))> {
        self.board_map.iter()
    }


    pub fn history(&self) -> impl Iterator<Item = &Movement> {
        self.history.iter()
    }


    pub fn new(board_size: u32) -> Self {
        let total_cells = (board_size * (board_size + 1)) / 2;
        Self {
            board_size,
            board_map: HashMap::new(),
            owner_table: vec![None; total_cells as usize],
            history: Vec::new(),
            sets: Vec::new(),
            status: GameStatus::Ongoing {
                next_player: PlayerId::new(0),
            },
            available_cells: (0..total_cells).collect(),
        }
    }


    pub fn status(&self) -> &GameStatus {
        &self.status
    }


    pub fn check_game_over(&self) -> bool {
        match self.status {
            GameStatus::Ongoing { .. } => false,
            GameStatus::Finished { winner: _ } => true,
        }
    }


    pub fn available_cells(&self) -> &Vec<u32> {
        &self.available_cells
    }


    pub fn owner_table(&self) -> &[Option<PlayerId>] {
        &self.owner_table
    }


    pub fn is_occupied(&self, coords: &Coordinates) -> bool {
        self.board_map.contains_key(coords)
    }


    pub fn total_cells(&self) -> u32 {
        (self.board_size * (self.board_size + 1)) / 2
    }


    pub fn check_player_turn(&self, movement: &Movement) -> Result<()> {
        if let GameStatus::Ongoing { next_player } = self.status {
            let player = match movement {
                Movement::Placement { player, .. } => *player,
                Movement::Action { player, .. } => *player,
            };
            if player != next_player {
                return Err(GameYError::InvalidPlayerTurn {
                    expected: next_player,
                    found: player,
                });
            }
        }
        Ok(())
    }


    pub fn next_player(&self) -> Option<PlayerId> {
        if let GameStatus::Ongoing { next_player } = self.status {
            Some(next_player)
        } else {
            None
        }
    }


    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let filename = path.as_ref().display().to_string();
        let file_content = std::fs::read_to_string(path).map_err(|e| GameYError::IoError {
            message: format!("Failed to read file: {}", filename),
            error: e.to_string(),
        })?;
        let yen: YEN =
            serde_json::from_str(&file_content).map_err(|e| GameYError::SerdeError { error: e })?;
        GameY::try_from(yen)
    }


    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let yen: YEN = self.into();
        let json_content =
            serde_json::to_string_pretty(&yen).map_err(|e| GameYError::SerdeError { error: e })?;
        let filename = path.as_ref().display().to_string();
        std::fs::write(path, json_content).map_err(|e| GameYError::IoError {
            message: format!("Failed to write file: {}", filename),
            error: e.to_string(),
        })?;
        Ok(())
    }


    pub fn add_move(&mut self, movement: Movement) -> Result<()> {
        match &movement {
            Movement::Placement { player, coords } => {
                self.handle_placement(*player, *coords)?;
            }
            Movement::Action { player, action } => {
                self.handle_action(*player, action);
            }
        }
        self.history.push(movement);
        Ok(())
    }


    fn handle_placement(&mut self, player: PlayerId, coords: Coordinates) -> Result<()> {
        self.validate_placement(player, coords)?;
        let set_idx = self.register_piece(player, coords);
        let won = self.connect_neighbors_and_check_win(coords, player, set_idx);
        self.update_status_after_placement(player, won);
        Ok(())
    }


    fn connect_neighbors_and_check_win(
        &mut self,
        coords: Coordinates,
        player: PlayerId,
        current_set_idx: usize,
    ) -> bool {
        let mut won = self.sets[current_set_idx].is_winning_configuration();
        let neighbors = self.get_neighbors(&coords);
        for neighbor in neighbors {
            if let Some((neighbor_idx, neighbor_player)) = self.board_map.get(&neighbor)
                && *neighbor_player == player
            {
                let connection_won = self.union(current_set_idx, *neighbor_idx);
                won = won || connection_won;
            }
        }
        won
    }


    fn update_status_after_placement(&mut self, player: PlayerId, won: bool) {
        if self.check_game_over() {
            tracing::info!("Game was already over. Move ignored for status update.");
        } else if won {
            tracing::debug!("Player {} wins the game!", player);
            self.status = GameStatus::Finished { winner: player };
        } else {
            self.status = GameStatus::Ongoing {
                next_player: other_player(player),
            };
        }
    }


    fn handle_action(&mut self, player: PlayerId, action: &GameAction) {
        match action {
            GameAction::Resign => {
                self.status = GameStatus::Finished {
                    winner: other_player(player),
                };
            }
            GameAction::Swap => {
                self.status = GameStatus::Ongoing {
                    next_player: other_player(player),
                };
            }
        }
    }


    fn validate_placement(&self, player: PlayerId, coords: Coordinates) -> Result<()> {
        if self.check_game_over() {
            tracing::info!("Game is already over. Move at {} could be ignored", coords);
        }
        if self.board_map.contains_key(&coords) {
            return Err(GameYError::Occupied {
                coordinates: coords,
                player,
            });
        }
        Ok(())
    }


    fn register_piece(&mut self, player: PlayerId, coords: Coordinates) -> usize {
        let cell_idx = coords.to_index(self.board_size);
        self.available_cells.retain(|&x| x != cell_idx);
        let set_idx = self.sets.len();
        let new_set = PlayerSet {
            parent: set_idx,
            touches_side_a: coords.touches_side_a(),
            touches_side_b: coords.touches_side_b(),
            touches_side_c: coords.touches_side_c(),
        };
        self.sets.push(new_set);
        self.board_map.insert(coords, (set_idx, player));
        self.owner_table[cell_idx as usize] = Some(player);
        set_idx
    }


    pub fn board_size(&self) -> u32 {
        self.board_size
    }


    fn get_neighbors(&self, coords: &Coordinates) -> Vec<Coordinates> {
        let mut neighbors = Vec::new();
        let x = coords.x();
        let y = coords.y();
        let z = coords.z();
        if x > 0 {
            neighbors.push(Coordinates::new(x - 1, y + 1, z));
            neighbors.push(Coordinates::new(x - 1, y, z + 1));
        }
        if y > 0 {
            neighbors.push(Coordinates::new(x + 1, y - 1, z));
            neighbors.push(Coordinates::new(x, y - 1, z + 1));
        }
        if z > 0 {
            neighbors.push(Coordinates::new(x + 1, y, z - 1));
            neighbors.push(Coordinates::new(x, y + 1, z - 1));
        }
        neighbors
    }


    pub fn render(&self, options: &RenderOptions) -> String {
        let mut result = String::new();
        let coords_size = self.board_size.to_string().len();
        let _ = writeln!(result, "--- Game of Y (Size {}) ---", self.board_size);
        let indent_multiplier = self.get_indent_multiplier(options);
        for row in 0..self.board_size {
            let x = self.board_size - 1 - row;
            indent(&mut result, x * indent_multiplier);
            for y in 0..=row {
                let z = row - y;
                let coords = Coordinates::new(x, y, z);
                let cell_str = self.format_cell(coords, options, coords_size);
                let _ = write!(result, "{} ", cell_str);
            }
            result.push('\n');
            if options.show_idx || options.show_3d_coords {
                result.push('\n');
            }
        }
        result
    }


    fn get_indent_multiplier(&self, options: &RenderOptions) -> u32 {
        match (options.show_3d_coords, options.show_idx) {
            (true, true) => 8,
            (true, false) => 4,
            (false, true) => 4,
            (false, false) => 2,
        }
    }


    fn format_cell(&self, coords: Coordinates, options: &RenderOptions, width: usize) -> String {
        let player = self.board_map.get(&coords).map(|(_, p)| *p);
        let mut symbol = match player {
            Some(p) => format!("{}", p),
            None => ".".to_string(),
        };
        if options.show_3d_coords {
            symbol.push_str(&format!(
                "({:0w$},{:0w$},{:0w$})",
                coords.x(),
                coords.y(),
                coords.z(),
                w = width
            ));
        }
        if options.show_idx {
            let idx = coords.to_index(self.board_size);
            symbol.push_str(&format!("({}) ", idx));
        }
        if options.show_colors {
            symbol = apply_player_color(symbol, player);
        }
        symbol
    }


    fn find(&mut self, i: SetIdx) -> SetIdx {
        if self.sets[i].parent == i {
            i
        } else {
            self.sets[i].parent = self.find(self.sets[i].parent);
            self.sets[i].parent
        }
    }


    fn union(&mut self, i: SetIdx, j: SetIdx) -> bool {
        let root_i = self.find(i);
        let root_j = self.find(j);
        if root_i != root_j {
            self.sets[root_i].parent = root_j;
            self.sets[root_j].touches_side_a |= self.sets[root_i].touches_side_a;
            self.sets[root_j].touches_side_b |= self.sets[root_i].touches_side_b;
            self.sets[root_j].touches_side_c |= self.sets[root_i].touches_side_c;
            return self.sets[root_j].touches_side_a
                && self.sets[root_j].touches_side_b
                && self.sets[root_j].touches_side_c;
        }
        false
    }


    // ──────────────────────────────────────────────
    // API exclusiva del bot hard
    // ──────────────────────────────────────────────


    /// Non-compressing root finder for use in bot search (apply_move_bot / unmake_move).
    ///
    /// The standard `find` applies path compression, which mutates parent pointers on
    /// nodes not part of the current move. Those mutations are NOT recorded in UnionChange
    /// and therefore cannot be reverted by unmake_move, corrupting the Union-Find state
    /// during deep search. This version avoids the problem by walking without modifying.
    pub(crate) fn find_root_no_compress(&self, mut i: SetIdx) -> SetIdx {
        while self.sets[i].parent != i {
            i = self.sets[i].parent;
        }
        i
    }


    pub fn apply_move_bot(&mut self, player: PlayerId, coords: Coordinates) -> Result<UndoMove> {
        if self.board_map.contains_key(&coords) {
            return Err(GameYError::Occupied { coordinates: coords, player });
        }


        let prev_status = self.status.clone();
        let cell_idx = coords.to_index(self.board_size);


        if let Some(pos) = self.available_cells.iter().position(|&x| x == cell_idx) {
            self.available_cells.swap_remove(pos);
        }


        let set_idx = self.sets.len();
        self.sets.push(PlayerSet {
            parent: set_idx,
            touches_side_a: coords.touches_side_a(),
            touches_side_b: coords.touches_side_b(),
            touches_side_c: coords.touches_side_c(),
        });
        self.board_map.insert(coords, (set_idx, player));
        self.owner_table[cell_idx as usize] = Some(player);


        let mut won = self.sets[set_idx].is_winning_configuration();
        let mut union_changes = Vec::new();


        for neighbor in self.get_neighbors(&coords) {
            let (nb_idx, nb_player) = match self.board_map.get(&neighbor) {
                Some(&(idx, p)) => (idx, p),
                None => continue,
            };


            if nb_player == player {
                // Use find_root_no_compress so that path compression does not
                // mutate parent pointers outside the recorded UnionChange entries.
                // This guarantees that unmake_move fully restores the Union-Find state.
                let root_i = self.find_root_no_compress(set_idx);
                let root_j = self.find_root_no_compress(nb_idx);
                if root_i != root_j {
                    let root_j_before = self.sets[root_j].clone();
                    self.sets[root_i].parent = root_j;
                    self.sets[root_j].touches_side_a |= self.sets[root_i].touches_side_a;
                    self.sets[root_j].touches_side_b |= self.sets[root_i].touches_side_b;
                    self.sets[root_j].touches_side_c |= self.sets[root_i].touches_side_c;
                    if self.sets[root_j].touches_side_a
                        && self.sets[root_j].touches_side_b
                        && self.sets[root_j].touches_side_c
                    {
                        won = true;
                    }
                    union_changes.push(UnionChange { root_i, root_j, root_j_before });
                }
            }
        }


        self.update_status_after_placement(player, won);


        Ok(UndoMove {
            coords,
            player,
            prev_status,
            inserted_set_idx: set_idx,
            union_changes,
        })
    }


    pub fn unmake_move(&mut self, undo: UndoMove) {
        self.status = undo.prev_status;
        let cell_idx = undo.coords.to_index(self.board_size);


        self.board_map.remove(&undo.coords);
        self.owner_table[cell_idx as usize] = None;
        self.available_cells.push(cell_idx);


        for change in undo.union_changes.into_iter().rev() {
            self.sets[change.root_i].parent = change.root_i;
            self.sets[change.root_j] = change.root_j_before;
        }


        self.sets.truncate(undo.inserted_set_idx);
    }
}


fn indent(str: &mut String, level: u32) {
    str.push_str(&" ".repeat(level as usize));
}


impl TryFrom<YEN> for GameY {
    type Error = GameYError;


    fn try_from(game: YEN) -> Result<Self> {
        let mut ygame = GameY::new(game.size());
        let rows: Vec<&str> = game.layout().split('/').collect();
        if rows.len() as u32 != game.size() {
            return Err(GameYError::InvalidYENLayout {
                expected: game.size(),
                found: rows.len() as u32,
            });
        }
        for (row, row_str) in rows.iter().enumerate() {
            let cells: Vec<char> = row_str.chars().collect();
            if cells.len() as u32 != row as u32 + 1 {
                return Err(GameYError::InvalidYENLayoutLine {
                    expected: row as u32 + 1,
                    found: cells.len() as u32,
                    line: row as u32,
                });
            }
            for (col, cell) in cells.iter().enumerate() {
                let x = game.size() - 1 - (row as u32);
                let y = col as u32;
                let z = game.size() - 1 - x - y;
                let coords = Coordinates::new(x, y, z);
                match cell {
                    'B' => {
                        ygame.add_move(Movement::Placement {
                            player: PlayerId::new(0),
                            coords,
                        })?;
                    }
                    'R' => {
                        ygame.add_move(Movement::Placement {
                            player: PlayerId::new(1),
                            coords,
                        })?;
                    }
                    '.' => {}
                    _ => {
                        return Err(GameYError::InvalidCharInLayout {
                            char: *cell,
                            row,
                            col,
                        });
                    }
                }
            }
        }
        Ok(ygame)
    }
}


impl From<&GameY> for YEN {
    fn from(game: &GameY) -> Self {
        let size = game.board_size;
        let turn = match game.status {
            GameStatus::Finished { winner } => other_player(winner).id() as u32,
            GameStatus::Ongoing { next_player } => next_player.id(),
        };
        let mut layout = String::new();
        let total_cells = (game.board_size * (game.board_size + 1)) / 2;
        let players = vec!['B', 'R'];
        for idx in 0..total_cells {
            let coords = Coordinates::from_index(idx, game.board_size);
            let cell_char = match game.board_map.get(&coords) {
                Some((_, player)) if player.id() == 0 => 'B',
                Some((_, player)) if player.id() == 1 => 'R',
                _ => '.',
            };
            layout.push(cell_char);
            if coords.z() == 0 && coords.x() > 0 {
                layout.push('/');
            }
        }
        YEN::new(size, turn, players, layout)
    }
}


fn other_player(player: PlayerId) -> PlayerId {
    if player.id() == 0 {
        PlayerId::new(1)
    } else {
        PlayerId::new(0)
    }
}


fn apply_player_color(symbol: String, player: Option<PlayerId>) -> String {
    match player {
        Some(p) if p.id() == 0 => format!("\x1b[34m{}\x1b[0m", symbol),
        Some(p) if p.id() == 1 => format!("\x1b[31m{}\x1b[0m", symbol),
        _ => symbol,
    }
}


#[derive(Debug, Clone)]
pub enum GameStatus {
    Ongoing { next_player: PlayerId },
    Finished { winner: PlayerId },
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;


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
}
