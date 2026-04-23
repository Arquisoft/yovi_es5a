-- Initialize database for Yovi project
CREATE DATABASE IF NOT EXISTS yovi_db;
USE yovi_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  best_score INT NOT NULL DEFAULT 0,
  total_games_1vsbot INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

alter table users
  add column password varchar(255) not null;

CREATE TABLE IF NOT EXISTS bots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,  -- Nombre del bot
  difficulty ENUM('facil', 'medio', 'dificil') NOT NULL,  -- Dificultad fija del bot
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game (
  id INT AUTO_INCREMENT PRIMARY KEY,
  board_size INT NOT NULL,  -- Tamaño del tablero (ej. 3 para 3x3, 5 para 5x5)
  winner ENUM('player1', 'player2', 'draw') DEFAULT NULL,  -- Resultado: quién ganó o empate
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Tiempo de la partida
);

ALTER TABLE game
  MODIFY COLUMN winner ENUM('player1', 'player2', 'player', 'bot', 'draw') DEFAULT NULL;

ALTER TABLE game
  ADD COLUMN mode ENUM('1vs1', '1vsbot', 'botvsbot') DEFAULT NULL,
  ADD COLUMN total_turns INT NOT NULL DEFAULT 0,
  ADD COLUMN elapsed_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN score INT NOT NULL DEFAULT 0,
  ADD COLUMN finished_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Tabla hija para partidas usuario vs usuario
CREATE TABLE IF NOT EXISTS userGames (
  id INT PRIMARY KEY,  -- FK a game(id)
  player1_id INT NOT NULL,  -- ID del primer usuario
  player2_id INT NULL,  -- ID del segundo usuario (legacy)
  guest_name VARCHAR(255) NULL,  -- Nombre del invitado en modo 1vs1
  FOREIGN KEY (id) REFERENCES game(id) ON DELETE CASCADE,
  FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla hija para partidas usuario vs bot
CREATE TABLE IF NOT EXISTS ubotGames (
  id INT PRIMARY KEY,  -- FK a game(id)
  user_id INT NOT NULL,  -- ID del usuario
  bot_id INT NOT NULL,  -- ID del bot
  difficulty ENUM('facil', 'medio', 'dificil') NOT NULL,  -- Dificultad del bot
  FOREIGN KEY (id) REFERENCES game(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

-- Tabla hija para partidas bot vs bot
CREATE TABLE IF NOT EXISTS botGames (
  id INT PRIMARY KEY,  -- FK a game(id)
  bot1_id INT NOT NULL,  -- ID del primer bot
  bot2_id INT NOT NULL,  -- ID del segundo bot
  difficulty ENUM('facil', 'medio', 'dificil') NOT NULL,  -- Dificultad de los bots (puede ser la misma o diferente)
  FOREIGN KEY (id) REFERENCES game(id) ON DELETE CASCADE,
  FOREIGN KEY (bot1_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (bot2_id) REFERENCES bots(id) ON DELETE CASCADE
);

INSERT IGNORE INTO bots (name, difficulty) 
VALUES
  ('Bot Facil', 'facil'),
  ('Bot Medio', 'medio'),
  ('Bot Dificil', 'dificil');

CREATE INDEX idx_users_ranking_1vsbot ON users(best_score, total_games_1vsbot, id);