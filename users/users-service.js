const express = require('express');
const app = express();
const port = 3000;
const swaggerUi = require('swagger-ui-express');
const fs = require('node:fs');
const YAML = require('js-yaml');
const promBundle = require('express-prom-bundle');
const userService = require('./services/userService');
const ScoreService = require('./services/scoreService');
const gameService = require('./services/gameService');
const leaderboardService = require('./services/leaderboardService');
const { getConnection } = require('./db');
const tokenService = require('./auth/tokenService');
const { authenticateAccessToken } = require('./middleware/authMiddleware');

const metricsMiddleware = promBundle({ includeMethod: true });
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

function validateFinishedMatchPayload(matchSummary) {
  if (!matchSummary || typeof matchSummary !== 'object') {
    return 'Datos de partida requeridos';
  }

  const boardSize = Number(matchSummary.boardSize);
  if (!Number.isFinite(boardSize) || boardSize <= 0) {
    return 'boardSize debe ser un número positivo';
  }

  const turnNumber = Number(matchSummary.turnNumber);
  if (!Number.isFinite(turnNumber) || turnNumber < 0) {
    return 'turnNumber debe ser un número mayor o igual que 0';
  }

  const elapsedSeconds = Number(matchSummary.elapsedSeconds ?? 0);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    return 'elapsedSeconds debe ser un número mayor o igual que 0';
  }

  if (matchSummary.mode === '1vs1') {
    const playerName = String(matchSummary.playerName || '').trim();
    const guestName = String(matchSummary.guestName || '').trim();
    const winner = String(matchSummary.winner || '').trim();
    if (!playerName || !guestName) {
      return 'playerName y guestName son obligatorios en 1vs1';
    }
    if (!['player', 'guest', 'draw'].includes(winner)) {
      return 'winner debe ser player, guest o draw en 1vs1';
    }
    return null;
  }

  if (matchSummary.mode === '1vsbot') {
    const playerName = String(matchSummary.playerName || '').trim();
    const difficulty = String(matchSummary.difficulty || '').trim();
    const isDraw = Boolean(matchSummary.isDraw);
    const winner = String(matchSummary.winner || '').trim();

    if (!playerName) {
      return 'playerName es obligatorio en 1vsbot';
    }

    if (!difficulty) {
      return 'difficulty es obligatorio en 1vsbot';
    }

    if (!isDraw && !winner) {
      return 'winner es obligatorio en 1vsbot si no hay empate';
    }

    return null;
  }

  return 'mode debe ser 1vs1 o 1vsbot';
}

app.post('/createuser', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (!username) {
      return res.status(400).json({ error: 'Faltan el usuario' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Faltan el correo electrónico' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Faltan la contraseña' });
    }


    if (await emailExists(email)) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    //Necesitamos instalar bcrypt, npm install bcrypt.
    //Esto es una libreria para hashear la contraseña, es decir, convertirla en una cadena de texto que no se pueda revertir a la contraseña original, para proteger la seguridad de los usuarios en caso de que la base de datos sea comprometida.
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    //Poner el numero 10 ahi implica que se aplicaran 10 rondas de hashing, lo que hace que el proceso sea mas lento y por lo tanto mas seguro contra ataques de fuerza bruta.

    await createUser(username, email, hashedPassword);
    res.status(200).json({ message });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  const { identifier, password } = req.body;

  try {
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const user = await userService.resolveUserByExactUsername(identifier);
    if (!user) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    //Hace falta hacer npm install
    const bcrypt = require('bcrypt');
    //Compara la contraseña proporcionada por el usuario con la contraseña hasheada almacenada en la base de datos.
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Usuario o Contraseña incorrecta' });
    }

    const tokens = tokenService.issueTokenPair({ userId: user.id, username: user.username });

    res.status(200).json({
      user: { id: user.id, username: user.username, email: user.email },
      ...tokens,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/auth/refresh', async (req, res) => {
  // Para persistencia real en producción debe guardarse la rotación en DB (refresh token hash, revocación y cadena de reemplazo).
  const refreshToken = String(req.body?.refreshToken || '').trim();
  if (!refreshToken) {
    return res.status(400).json({ message: 'refreshToken es obligatorio' });
  }

  try {
    const rotatedTokens = tokenService.rotateRefreshToken(refreshToken);
    return res.status(200).json(rotatedTokens);
  } catch (err) {
    const statusCode = err.statusCode || 401;
    return res.status(statusCode).json({ message: err.message });
  }
});

app.post('/auth/register', async (req, res) => {
  const { email, username, password, confirmPassword } = req.body;
  try {    if (!email || !username || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }
   
    if (await userService.resolveUserByExactEmail(email)) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    //Hashear la contraseña antes de guardarla en la base de datos.
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    await userService.createUser(username, email, hashedPassword);
    res.status(200).json({ message: 'Registro correcto' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(400).json({ error: err.message });
  }

});

app.post('/auth/logout', async (req, res) => {
  // Para persistencia real en producción debe invalidarse también la sesión en almacenamiento persistente compartido.
  const refreshToken = String(req.body?.refreshToken || '').trim();
  if (!refreshToken) {
    return res.status(400).json({ message: 'refreshToken es obligatorio' });
  }

  const revoked = tokenService.revokeRefreshToken(refreshToken);
  return res.status(200).json({ revoked });
});

app.post('/finished-match', authenticateAccessToken, async (req, res) => {
  const matchSummary = req.body;
  console.log('Received finished match:', matchSummary);
  const validationError = validateFinishedMatchPayload(matchSummary);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const score = ScoreService.calculate(matchSummary);
    const gameId = await gameService.recordFinishedMatch(matchSummary, score, req.auth);
    return res.json({ score, saved: true, gameId });
  } catch (err) {
    console.error('Error al finalizar partida:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ message: err.message });
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
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ message: err.message || 'Error al obtener leaderboard' });
  }
});

app.get('/leaderboard/suggest', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const items = await leaderboardService.getUserSuggestions(q);
    return res.json({ items });
  } catch (err) {
    console.error('Error en sugerencias:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ message: err.message || 'Error al obtener sugerencias' });
  }
});

app.get('/users/resolve', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) {
      return res.status(400).json({ message: 'username es obligatorio' });
    }

    const user = await userService.resolveUserByExactUsername(username);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.json({ username: user.username });
  } catch (err) {
    console.error('Error al resolver usuario:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ message: err.message || 'Error al resolver usuario' });
  }
});

app.get('/users/:username', async (req, res) => {
  try {
    const profile = await leaderboardService.getUserProfile(req.params.username);
    return res.json(profile);
  } catch (err) {
    console.error('Error al obtener perfil:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ message: err.message || 'Error al obtener perfil' });
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
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ message: err.message || 'Error al obtener historial' });
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
    console.error('Error al obtener leaderboard centrado:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ message: err.message || 'Error al obtener leaderboard centrado' });
  }
});

//Con esto ya validamos el token antes de crear tablero
app.get('/auth/check', authenticateAccessToken, (req, res) => {
  return res.json({ valid: true });
});

if (require.main === module) {
  getConnection().then(() => {
    console.log('Connected to MySQL database');
    app.listen(port, () => {
      console.log(`User Service listening at http://localhost:${port}`)
    });
  }).catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });
}

module.exports = app
