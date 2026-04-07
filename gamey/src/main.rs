//! GameY binary entry point.

use clap::Parser;
use gamey::{self, CliArgs, Mode, game_server::run_game_server, run_bot_server, run_play_server, run_cli_game};
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry().init();
    let args = CliArgs::parse();

    if args.mode == Mode::Server {
        if let Err(e) = tokio::try_join!(
            run_bot_server(args.port + 1),   // API choose
            run_game_server(args.port),       // game server
            run_play_server(args.port + 2),            //  API play
        ) {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    } else {
        run_cli_game().expect("End CLI game");
    }
}