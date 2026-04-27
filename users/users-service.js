const express = require('express');
const app = express();
app.disable('x-powered-by'); //lo pide sonar
const port = 3000;
const swaggerUi = require('swagger-ui-express');
const fs = require('node:fs');
const YAML = require('js-yaml');
const promBundle = require('express-prom-bundle');
const promClient = require('prom-client');
const bcrypt = require('bcrypt');
const userService = require('./services/userService');
const ScoreService = require('./services/scoreService');
const gameService = require('./services/gameService');
const leaderboardService = require('./services/leaderboardService');
const { getConnection } = require('./db');
const tokenService = require('./auth/tokenService');
const { authenticateAccessToken } = require('./middleware/authMiddleware');

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,         // label con la ruta (/leaderboard, /auth/login, etc.)
  includeStatusCode: true,   // label con el código HTTP (200, 400, 500...)
  promClient: {
    collectDefaultMetrics: {}  // activa CPU, RAM, event loop automáticamente
  }
});

app.use(metricsMiddleware);

try {
  const swaggerDocument = YAML.load(fs.readFileSync('./openapi.yaml', 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  console.log(e);
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Funciones auxiliares para enviar errores de forma consistente
function sendError(res, status, code, text, key = "error") {
  return res.status(status).json({ [key]: text, code });
}

function sendErrorFromException(res, err, key = "error") {
  return res.status(err.statusCode || 400).json({ [key]: err.message, code: err.code || "UNEXPECTED_ERROR" });
}

function validateFinishedMatchPayload(matchSummary) {
  if (!matchSummary || typeof matchSummary !== 'object') {
    return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'Match data is required' };
  }

  const boardSize = Number(matchSummary.boardSize);
  if (!Number.isFinite(boardSize) || boardSize <= 0) {
    return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'boardSize must be a positive number' };
  }

  const turnNumber = Number(matchSummary.turnNumber);
  if (!Number.isFinite(turnNumber) || turnNumber < 0) {
    return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'turnNumber must be a number greater than or equal to 0' };
  }

  const elapsedSeconds = Number(matchSummary.elapsedSeconds ?? 0);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'elapsedSeconds must be a number greater than or equal to 0' };
  }

  if (matchSummary.mode === '1vs1') {
    const playerName = String(matchSummary.playerName || '').trim();
    const guestName = String(matchSummary.guestName || '').trim();
    const winner = String(matchSummary.winner || '').trim();
    if (!playerName || !guestName) {
      return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'playerName and guestName are required for 1vs1' };
    }
    if (!['player', 'guest', 'draw'].includes(winner)) {
      return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'winner must be player, guest, or draw in 1vs1' };
    }
    return null;
  }

  if (matchSummary.mode === '1vsbot') {
    const playerName = matchSummary.playerName
      ? String(matchSummary.playerName || '').trim()
      : 'BOT';
    const difficulty = String(matchSummary.difficulty || '').trim();
    const isDraw = Boolean(matchSummary.isDraw);
    const winner = String(matchSummary.winner || '').trim();

    if (!playerName) return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'playerName is required for 1vsbot' };
    if (!difficulty) return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'difficulty is required for 1vsbot' };
    if (!isDraw && !winner) return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'winner is required for 1vsbot if there is no draw' };

    return null;
  }

  return { code: 'INVALID_FINISHED_MATCH_PAYLOAD', message: 'mode must be 1vs1 or 1vsbot' };
}

app.post('/createuser', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (!username) {
      return sendError(res, 400, 'MISSING_USERNAME', 'Missing username');
    }
    if (!email) {
      return sendError(res, 400, 'MISSING_EMAIL', 'Missing email');
    }
    if (!password) {
      return sendError(res, 400, 'MISSING_PASSWORD', 'Missing password');
    }

    if (await userService.resolveUserByExactEmail(email)) {
      return sendError(res, 400, 'EMAIL_ALREADY_REGISTERED', 'Email already registered');
    }

    // bcrypt ya está importado al inicio del módulo
    // 10 rondas de hashing para proteger contra fuerza bruta
    const hashedPassword = await bcrypt.hash(password, 10);
    await userService.createUser(username, email, hashedPassword);
    res.status(200).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Error:', err.message);
    return sendErrorFromException(res, err);
  }
});

app.post('/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  try {
    if (!identifier || !password) {
      return sendError(res, 400, 'MISSING_LOGIN_DATA', 'Missing login data');
    }

    const user = await userService.resolveUserByExactUsername(identifier);
    if (!user) {
      return sendError(res, 400, 'USER_NOT_FOUND', 'User not found');
    }

    // Compara la contraseña proporcionada con el hash almacenado en la base de datos
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 400, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }

    const tokens = tokenService.issueTokenPair({ userId: user.id, username: user.username });
    res.status(200).json({
      user: { id: user.id, username: user.username, email: user.email },
      ...tokens,
    });
  } catch (err) {
    return sendErrorFromException(res, err);
  }
});

app.post('/auth/refresh', async (req, res) => {
  // Para persistencia real en producción debe guardarse la rotación en DB
  // (refresh token hash, revocación y cadena de reemplazo).
  const refreshToken = String(req.body?.refreshToken || '').trim();
  if (!refreshToken) {
    return sendError(res, 400, 'REFRESH_TOKEN_REQUIRED', 'refreshToken is required', 'message');
  }
  try {
    const rotatedTokens = tokenService.rotateRefreshToken(refreshToken);
    return res.status(200).json(rotatedTokens);
  } catch (err) {
    return sendErrorFromException(res, err, 'message');
  }
});

app.post('/auth/register', async (req, res) => {
  const { email, username, password, confirmPassword } = req.body;
  try {
    if (!email || !username || !password || !confirmPassword) {
      return sendError(res, 400, 'MISSING_REGISTRATION_DATA', 'Missing registration data');
    }
    if (password !== confirmPassword) {
      return sendError(res, 400, 'PASSWORDS_MISMATCH', 'Passwords do not match');
    }
    if (await userService.resolveUserByExactEmail(email)) {
      return sendError(res, 400, 'EMAIL_ALREADY_REGISTERED', 'Email already registered');
    }

    // Hashear la contraseña antes de guardarla en la base de datos
    const hashedPassword = await bcrypt.hash(password, 10);
    await userService.createUser(username, email, hashedPassword);
    res.status(200).json({ message: 'Registration successful' });
  } catch (err) {
    console.error('Error:', err.message);
    return sendErrorFromException(res, err);
  }
});

app.post('/auth/logout', async (req, res) => {
  // Para persistencia real en producción debe invalidarse también la sesión
  // en almacenamiento persistente compartido.
  const refreshToken = String(req.body?.refreshToken || '').trim();
  if (!refreshToken) {
    return sendError(res, 400, 'REFRESH_TOKEN_REQUIRED', 'refreshToken is required', 'message');
  }
  const revoked = tokenService.revokeRefreshToken(refreshToken);
  return res.status(200).json({ revoked });
});

app.post('/finished-match', authenticateAccessToken, async (req, res) => {
  const matchSummary = req.body;
  const validationError = validateFinishedMatchPayload(matchSummary);
  if (validationError) {
    return sendError(res, 400, validationError.code, validationError.message, 'message');
  }
  try {
    const score = ScoreService.calculate(matchSummary);
    const gameId = await gameService.recordFinishedMatch(matchSummary, score, req.auth);
    return res.json({ score, saved: true, gameId });
  } catch (err) {
    console.error('Error al finalizar partida:', err.message);
    return sendErrorFromException(res, err, 'message');
  }
});

app.get('/leaderboard', async (req, res) => {
  try {
    const response = await leaderboardService.getLeaderboard({
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json(response);
  } catch (err) {
    console.error('Error en leaderboard:', err.message);
    return sendErrorFromException(res, err, 'message');
  }
});

app.get('/leaderboard/suggest', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const items = await leaderboardService.getUserSuggestions(q);
    return res.json({ items });
  } catch (err) {
    console.error('Error en sugerencias:', err.message);
    return sendErrorFromException(res, err, 'message');
  }
});

app.get('/users/resolve', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) {
      return sendError(res, 400, 'MISSING_USERNAME', 'username is required', 'message');
    }
    const user = await userService.resolveUserByExactUsername(username);
    if (!user) {
      return sendError(res, 404, 'USER_NOT_FOUND', 'User not found', 'message');
    }
    return res.json({ username: user.username });
  } catch (err) {
    console.error('Error al resolver usuario:', err.message);
    return sendErrorFromException(res, err, 'message');
  }
});

app.get('/users/:username', async (req, res) => {
  try {
    const profile = await leaderboardService.getUserProfile(req.params.username);
    return res.json(profile);
  } catch (err) {
    console.error('Error al obtener perfil:', err.message);
    return sendErrorFromException(res, err, 'message');
  }
});

app.get('/users/:username/history', async (req, res) => {
  try {
    const response = await leaderboardService.getUserHistory(req.params.username, {
      page: req.query.page,
      pageSize: req.query.pageSize,
      botPage: req.query.botPage,
      botPageSize: req.query.botPageSize,
      pvpPage: req.query.pvpPage,
      pvpPageSize: req.query.pvpPageSize,
    });
    return res.json(response);
  } catch (err) {
    console.error('Error al obtener historial:', err.message);
    return sendErrorFromException(res, err, 'message');
  }
});

app.get('/users/:username/centered-leaderboard', async (req, res) => {
  try {
    const response = await leaderboardService.getCenteredLeaderboard(req.params.username, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json(response);
  } catch (err) {
    return sendErrorFromException(res, err, 'message');
  }
});

// Valida el token antes de crear tablero
app.get('/auth/check', authenticateAccessToken, (req, res) => {
  return res.json({ valid: true });
});

if (require.main === module) {
  getConnection().then(() => {
    console.log('Connected to MySQL database');
    app.listen(port, () => {
      console.log(`User Service listening at http://localhost:${port}`);
    });
  }).catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });
}

module.exports = app;