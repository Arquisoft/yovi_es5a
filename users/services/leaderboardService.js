const GameRepository = require('../repositories/gameRepository');

const gameRepo = new GameRepository();

const ALLOWED_PAGE_SIZES = new Set([25, 50, 100]);

function parsePage(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parsePageSize(value) {
  const parsed = Number(value);
  if (!ALLOWED_PAGE_SIZES.has(parsed)) {
    return 25;
  }
  return parsed;
}

function toLeaderboardResponse(rows) {
  return rows.map((row) => ({
    globalPosition: Number(row.global_position),
    username: row.username,
    bestScore: Number(row.best_score),
    totalGames: Number(row.total_games),
  }));
}

async function getLeaderboard({ page, pageSize }) {
  const safePage = parsePage(page);
  const safePageSize = parsePageSize(pageSize);
  const { rows, total } = await gameRepo.getLeaderboardPage(safePage, safePageSize);

  return {
    items: toLeaderboardResponse(rows),
    page: safePage,
    pageSize: safePageSize,
    total: Number(total),
    totalPages: Math.max(1, Math.ceil(Number(total) / safePageSize)),
  };
}

async function getUserSuggestions(query) {
  const normalized = String(query || '').trim();
  if (normalized.length <= 3) {
    return [];
  }

  const rows = await gameRepo.getUserSuggestionsByUsername(normalized, 10);
  return rows.map((row) => row.username);
}

async function resolveUserByExactUsername(username) {
  const normalized = String(username || '').trim();
  if (!normalized) {
    return null;
  }
  return gameRepo.findUserByUsernameExact(normalized);
}

async function getUserProfile(username) {
  const user = await resolveUserByExactUsername(username);
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const rank = await gameRepo.getUserRankById(user.id);

  return {
    id: Number(user.id),
    username: user.username,
    createdAt: user.created_at,
    bestScore: Number(user.best_score),
    totalGames: Number(user.total_games_1vsbot),
    globalPosition: Number(rank || 0),
  };
}

async function getUserHistory(username, { page, pageSize }) {
  const user = await resolveUserByExactUsername(username);
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const safePage = parsePage(page);
  const safePageSize = parsePageSize(pageSize);
  const { rows: botRows, total: botTotal } = await gameRepo.getUserMatchHistory(user.id, safePage, safePageSize);
  const { rows: pvpRows, total: pvpTotal } = await gameRepo.getUserVsUserMatchHistory(user.id, safePage, safePageSize);

  const botItems = botRows.map((row) => ({
    id: Number(row.id),
    score: Number(row.score),
    boardSize: Number(row.board_size),
    totalTurns: Number(row.total_turns),
    elapsedSeconds: Number(row.elapsed_seconds),
    winner: row.winner,
    winnerName: row.winner === 'player' ? user.username : row.winner === 'bot' ? row.bot_name : 'Empate',
    difficulty: row.difficulty,
    botName: row.bot_name,
    finishedAt: row.finished_at,
  }));

  const pvpItems = pvpRows.map((row) => ({
    id: Number(row.id),
    score: Number(row.score),
    boardSize: Number(row.board_size),
    totalTurns: Number(row.total_turns),
    elapsedSeconds: Number(row.elapsed_seconds),
    winner: row.winner,
    winnerName: row.winner_name,
    player1Name: row.player1_name,
    player2Name: row.player2_name,
    finishedAt: row.finished_at,
  }));

  return {
    user: {
      id: Number(user.id),
      username: user.username,
    },
    items: botItems,
    botItems,
    pvpItems,
    page: safePage,
    pageSize: safePageSize,
    total: Number(botTotal),
    totalPages: Math.max(1, Math.ceil(Number(botTotal) / safePageSize)),
    pvpTotal: Number(pvpTotal),
    pvpTotalPages: Math.max(1, Math.ceil(Number(pvpTotal) / safePageSize)),
  };
}

async function getCenteredLeaderboard(username, { page, pageSize }) {
  const user = await resolveUserByExactUsername(username);
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const safePageSize = parsePageSize(pageSize);
  const requestedPage = Number.isInteger(Number(page)) ? Number(page) : null;
  const centered = await gameRepo.getLeaderboardPageCenteredByUserId(user.id, safePageSize, requestedPage);

  return {
    highlightedUsername: user.username,
    userGlobalPosition: Number(centered.userRank || 0),
    page: Number(centered.currentPage || 1),
    pageSize: safePageSize,
    total: Number(centered.total || 0),
    totalPages: Number(centered.totalPages || 1),
    items: toLeaderboardResponse(centered.rows),
  };
}

module.exports = {
  gameRepo,
  getLeaderboard,
  getUserSuggestions,
  resolveUserByExactUsername,
  getUserProfile,
  getUserHistory,
  getCenteredLeaderboard,
  __testing: {
    parsePage,
    parsePageSize,
  },
};
