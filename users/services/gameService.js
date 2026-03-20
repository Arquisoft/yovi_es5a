const GameRepository = require('../repositories/gameRepository');

const gameRepo = new GameRepository();

async function createInsertGame(matchSummary) {
   if (!matchSummary ) {
    throw new Error('Match summary is required');
  }

  const { mode, boardSize } = matchSummary;

  if (mode === "1vs1") {
    const { winnerName, loserName } = matchSummary;
    //Posiblemente no deben existir estos 2 componentes, comprobar nombres.
    return createUserVsUserGame(
      winnerName,
      loserName,
      boardSize
    );
  }

  if (mode === "1vsbot") {
    const { playerName } = matchSummary;

    return createUserVsBotGame(
      playerName,
      1, //Esta hardcodeao el numero 1 ahora mismo, hace falta mirar como hacer con los bots.
      boardSize,
      1
    );
  }

  if (mode === "botvsbot") {
    const { bot1Id, bot2Id, difficulty } = matchSummary;
    return createBotVsBotGame(bot1Id, bot2Id, boardSize, difficulty);
  }

  throw new Error("Invalid game mode");


}

async function runInTransaction(callback) {
  const connection = await gameRepo.getConnection();

  try {
    await connection.beginTransaction();

    const result = await callback(connection);

    await connection.commit();
    return result;

  } catch (err) {
    await connection.rollback();
    throw new Error('Database error: ' + err.message);

  } finally {
    connection.release();
  }
}

async function createUserVsUserGame(player1Id, player2Id, boardSize) {
  if (!player1Id || !player2Id || !boardSize) {
    throw new Error('player1Id, player2Id, and boardSize are required');
  }
  if (player1Id === player2Id) {
    throw new Error('Players must be different');
  }
  return runInTransaction(async (connection) => {
    const gameId = await gameRepo.insertGame(connection, boardSize);
    await gameRepo.insertUserGame(connection, gameId, player1Id, player2Id);
    return gameId;
  });
}

async function createUserVsBotGame(userId, botId, boardSize, difficulty) {
  console.log("Creating user vs bot game with userId:", userId, "botId:", botId, "boardSize:", boardSize, "difficulty:", difficulty);
  if (!userId || !botId || !boardSize || !difficulty) {
    throw new Error('userId, botId, boardSize, and difficulty are required');
  }
  return runInTransaction(async (connection) => {
    const gameId = await gameRepo.insertGame(connection, boardSize);
    await gameRepo.insertUserBotGame(connection, gameId, userId, botId, difficulty);
    return gameId;
  });
}

async function createBotVsBotGame(bot1Id, bot2Id, boardSize, difficulty) {
  if (!bot1Id || !bot2Id || !boardSize || !difficulty) {
    throw new Error('bot1Id, bot2Id, boardSize, and difficulty are required');
  }
  if (bot1Id === bot2Id) {
    throw new Error('Bots must be different');
  }
  return runInTransaction(async (connection) => {
    const gameId = await gameRepo.insertGame(connection, boardSize);
    await gameRepo.insertBotGameTx(connection, gameId, bot1Id, bot2Id, difficulty);
    return gameId;
  });
}

async function finishGame(gameId, winner, score) {
  if (!gameId || !winner || score == null) {
    throw new Error('gameId, winner, and score are required');
  }

  return runInTransaction(async (connection) => {
    await gameRepo.updateGameWinner(connection, gameId, winner, score);
    return gameId;
  });
}

module.exports = {
  gameRepo,
  createUserVsUserGame,
  createUserVsBotGame,
  createBotVsBotGame,
  createInsertGame,
  finishGame
};