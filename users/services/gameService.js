const GameRepository = require('../repositories/gameRepository');

const gameRepo = new GameRepository();

function createClientError(message) {
  const error = new Error(message);
  error.statusCode = 400;
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
    throw new Error('player1Id, player2Id, and boardSize are required');
  }
  if (player1Id === player2Id) {
    throw new Error('Players must be different');
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
    throw new Error('Database error: ' + err.message);
  }
}

async function createUserVsBotGame(userId, botId, boardSize, difficulty) {
  if (!userId || !botId || !boardSize || !difficulty) {
    throw new Error('userId, botId, boardSize, and difficulty are required');
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
    throw new Error('Database error: ' + err.message);
  }
}

async function createBotVsBotGame(bot1Id, bot2Id, boardSize, difficulty) {
  if (!bot1Id || !bot2Id || !boardSize || !difficulty) {
    throw new Error('bot1Id, bot2Id, boardSize, and difficulty are required');
  }
  if (bot1Id === bot2Id) {
    throw new Error('Bots must be different');
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
    throw new Error('Database error: ' + err.message);
  }
}

async function finishGame(gameId, winner) {
  if (!gameId || !winner) {
    throw new Error('gameId and winner are required');
  }
  if (!['player1', 'player2', 'player', 'bot', 'draw'].includes(winner)) {
    throw new Error('Winner must be player1, player2, player, bot, or draw');
  }
  try {
    await gameRepo.updateGameWinner(gameId, winner);
    return `Game ${gameId} finished with winner: ${winner}`;
  } catch (err) {
    throw new Error('Database error: ' + err.message);
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
        throw createClientError('El token no corresponde con playerName en 1vs1');
      }

      if (!['player', 'guest', 'draw'].includes(winner)) {
        throw createClientError('winner debe ser player, guest o draw en 1vs1');
      }

      const playerUserId = await gameRepo.findUserIdByUsername(playerName, connection);
      if (!playerUserId) {
        throw createClientError(`Usuario no encontrado: ${playerName}`);
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
        throw createClientError('El token no corresponde con playerName en 1vsbot');
      }

      if (!winner) {
        throw createClientError('El campo winner debe ser player, bot o draw');
      }

      if (!difficulty) {
        throw createClientError('Dificultad inválida para 1vsbot');
      }

      const userId = await gameRepo.findUserIdByUsername(playerName, connection);
      if (!userId) {
        throw createClientError(`Usuario no encontrado: ${playerName}`);
      }

      const botId = await gameRepo.findBotIdByDifficulty(difficulty, connection);
      if (!botId) {
        throw createClientError(`No existe bot para dificultad: ${difficulty}`);
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
      throw createClientError('Modo de partida no soportado');
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