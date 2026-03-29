//! Bot module for the Game of Y.
//!
//! This module provides the infrastructure for creating and managing AI bots
//! that can play the Game of Y. It includes:
//!
//! - [`YBot`] - A trait that defines the interface for all bots
//! - [`YBotRegistry`] - A registry for managing multiple bot implementations
//! - [`RandomBot`] - A simple bot that makes random valid moves
//! - [`Medium`] - A medium difficulty bot using heuristics

pub mod random;
pub mod medium;
pub mod ybot;
pub mod ybot_registry;
pub use random::*;
pub use medium::*;   // ← faltaba esto
pub use ybot::*;
pub use ybot_registry::*;