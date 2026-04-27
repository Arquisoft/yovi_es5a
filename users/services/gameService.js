const GameRepository = require('../repositories/gameRepository');

const gameRepo = new GameRepository();

// Función auxiliar para crear errores de servicio con código y mensaje
function createServiceError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// Función auxiliar para crear errores de cliente (400) con código específico
function createClientError(message, code = 'INVALID_FINISHED_MATCH_PAYLOAD') {
  return createServiceError(message, code, 400);
}

function createDatabaseError(err) {
  const error = new Error('Database error');
  error.code = 'DATABASE_ERROR';
  error.statusCode = 500;
  return error;
}

function normalizeDifficulty(difficulty) {
  const normalized = String(difficulty || '').trim().toLowerCase();
  if (normalized === 'facil') return 'facil';
  if (normalized === 'media' || normalized === 'medio') return 'medio';
  if (normalized === 'dificil') return 'dificil';
  return null;
}

function normalizeUserVsBotWinner(winner, isDraw) {
  if (isDraw) return 'draw';
  const normalized = String(winner || '').trim().toLowerCase();
  if (normalized === 'player' || normalized === 'player1') return 'player';
  if (normalized === 'bot' || normalized === 'player2') return 'bot';
  if (normalized === 'draw') return 'draw';
  return null;
}

async function createUserVsUserGame(player1Id, player2Id, boardSize) {
  if (!player1Id || !player2Id || !boardSize) {
    throw createServiceError('player1Id, player2Id, and boardSize are required', 'MISSING_GAME_PARAMETERS');
  }
  if (player1Id === player2Id) {
    throw createServiceError('Players must be different', 'INVALID_GAME_PLAYERS');
  }
  const connection = await gameRepo.getConnection();
  try {
    await connection.beginTransaction();
    const gameId = await gameRepo.insertGame(boardSize, '1vs1', connection);
    await gameRepo.insertUserGame(gameId, player1Id, player2Id, null, connection);
    await connection.commit();
    return `Game created with ID: ${gameId}`;
  } catch (err) {
    await connection.rollback();
    throw createDatabaseError(err);
  }
}

async function createUserVsBotGame(userId, botId, boardSize, difficulty) {
  if (!userId || !botId || !boardSize || !difficulty) {
    throw createServiceError('userId, botId, boardSize, and difficulty are required', 'MISSING_GAME_PARAMETERS');
  }
  const connection = await gameRepo.getConnection();
  try {
    await connection.beginTransaction();
    const gameId = await gameRepo.insertGame(boardSize, '1vsbot', connection);
    await gameRepo.insertUserBotGame(gameId, userId, botId, difficulty, connection);
    await connection.commit();
    return `Game created with ID: ${gameId}`;
  } catch (err) {
    await connection.rollback();
    throw createDatabaseError(err);
  }
}

async function createBotVsBotGame(bot1Id, bot2Id, boardSize, difficulty) {
  if (!bot1Id || !bot2Id || !boardSize || !difficulty) {
    throw createServiceError('bot1Id, bot2Id, boardSize, and difficulty are required', 'MISSING_GAME_PARAMETERS');
  }
  if (bot1Id === bot2Id) {
    throw createServiceError('Bots must be different', 'INVALID_GAME_PLAYERS');
  }
  const connection = await gameRepo.getConnection();
  try {
    await connection.beginTransaction();
    const gameId = await gameRepo.insertGame(boardSize, 'botvsbot', connection);
    await gameRepo.insertBotGame(gameId, bot1Id, bot2Id, difficulty, connection);
    await connection.commit();
    return `Game created with ID: ${gameId}`;
  } catch (err) {
    await connection.rollback();
    throw createDatabaseError(err);
  }
}

async function finishGame(gameId, winner) {
  if (!gameId || !winner) {
    throw createServiceError('gameId and winner are required', 'MISSING_FINISH_GAME_DATA');
  }
  if (!['player1', 'player2', 'player', 'bot', 'draw'].includes(winner)) {
    throw createServiceError('Winner must be player1, player2, player, bot, or draw', 'INVALID_WINNER');
  }
  try {
    await gameRepo.updateGameWinner(gameId, winner);
    return `Game ${gameId} finished with winner: ${winner}`;
  } catch (err) {
    throw createDatabaseError(err);
  }
}

async function recordFinishedMatch(matchSummary, score, auth) {
  const connection = await gameRepo.getConnection();
  await connection.beginTransaction();

  try {
    const boardSize = Number(matchSummary.boardSize);
    const totalTurns = Number(matchSummary.turnNumber);
    const elapsedSeconds = Number(matchSummary.elapsedSeconds ?? 0);
    const isDraw = Boolean(matchSummary.isDraw);
    const mode = String(matchSummary.mode || '').trim();

    let gameId;

    if (mode === '1vs1') {
      const playerName = String(matchSummary.playerName || '').trim();
      const guestName = String(matchSummary.guestName || '').trim();
      const winner = String(matchSummary.winner || '').trim().toLowerCase();

      if (auth?.username !== playerName) {
        throw createClientError('Token does not match playerName in 1vs1', 'TOKEN_MISMATCH_PLAYER_NAME');
      }

      if (!['player', 'guest', 'draw'].includes(winner)) {
        throw createClientError('winner must be player, guest, or draw in 1vs1', 'INVALID_FINISHED_MATCH_PAYLOAD');
      }

      const playerUserId = await gameRepo.findUserIdByUsername(playerName, connection);
      if (!playerUserId) {
        throw createClientError(`User not found: ${playerName}`, 'USER_NOT_FOUND');
      }

    const winnerValue = winner === 'player'
        ? 'player1'
        : winner === 'guest'
          ? 'player2'
          : 'draw';

    const finishedGame = await gameRepo.insertFinishedGame({
            boardSize,
            mode: '1vs1',
            winner: isDraw ? 'draw' : winnerValue,
            totalTurns,
            elapsedSeconds,
            score
      }, connection);



    await gameRepo.insertUserGame(finishedGame, playerUserId.id, null, guestName, connection);
    await gameRepo.updateUserBotStats(playerUserId.id, score, connection);
    } else if (mode === '1vsbot') {
      const playerName = String(matchSummary.playerName || '').trim();
      const winner = normalizeUserVsBotWinner(matchSummary.winner, isDraw);
      const difficulty = normalizeDifficulty(matchSummary.difficulty);

      if (auth?.username !== playerName) {
        throw createClientError('Token does not match playerName in 1vsbot', 'TOKEN_MISMATCH_PLAYER_NAME');
      }

      if (!winner) {
        throw createClientError('Winner must be player, bot, or draw', 'INVALID_FINISHED_MATCH_PAYLOAD');
      }

      if (!difficulty) {
        throw createClientError('Invalid difficulty for 1vsbot', 'INVALID_DIFFICULTY');
      }

      const userId = await gameRepo.findUserIdByUsername(playerName, connection);
      if (!userId) {
        throw createClientError(`User not found: ${playerName}`, 'USER_NOT_FOUND');
      }

      const botId = await gameRepo.findBotIdByDifficulty(difficulty, connection);
      if (!botId) {
        throw createClientError(`No bot exists for difficulty: ${difficulty}`, 'NO_BOT_FOR_DIFFICULTY');
      }

      const finishedGame = await gameRepo.insertFinishedGame({
        boardSize,
        mode: '1vsbot',
        winner,
        totalTurns,
        elapsedSeconds,
        score
      }, connection);
      

      await gameRepo.insertUserBotGame(finishedGame, userId.id, botId, difficulty, connection);
      await gameRepo.updateUserBotStats(userId.id, score, connection);
    } else {
      throw createClientError('Unsupported game mode', 'UNSUPPORTED_GAME_MODE');
    }

    await connection.commit();
    return gameId;
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

module.exports = {
  gameRepo,
  createUserVsUserGame,
  createUserVsBotGame,
  createBotVsBotGame,
  finishGame,
  recordFinishedMatch
};