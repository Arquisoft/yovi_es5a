-- Initialize database for Yovi project
CREATE DATABASE IF NOT EXISTS yovi_db;
USE yovi_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Tabla hija para partidas usuario vs usuario
CREATE TABLE IF NOT EXISTS userGames (
  id INT PRIMARY KEY,  -- FK a game(id)
  player1_id INT NOT NULL,  -- ID del primer usuario
  player2_id INT NOT NULL,  -- ID del segundo usuario
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
