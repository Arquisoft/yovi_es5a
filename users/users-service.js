const express = require('express');
const app = express();
const port = 3000;
const swaggerUi = require('swagger-ui-express');
const fs = require('node:fs');
const YAML = require('js-yaml');
const promBundle = require('express-prom-bundle');
const { createUser } = require('./services/userService');
const { createInsertGame, finishGame } = require('./services/gameService');
const ScoreService = require('./services/scoreService');
const { getConnection } = require('./db');
const { match } = require('node:assert');

const metricsMiddleware = promBundle({includeMethod: true});
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

app.post('/createuser', async (req, res) => {
  const username = req.body && req.body.username;
  try {
    const message = await createUser(username);
    res.status(200).json({ message });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/finished-match", async (req, res) => {
  console.log("BODY RECIBIDO:", req.body);
  const matchSummary = req.body;

  if (!matchSummary) {
    return res.status(400).json({
      message: "Datos de partida requeridos"
    });
  }
  let winner = matchSummary.winnerName;
  if(winner ==null) winner = matchSummary.playerName;
  console.log("WINNER RECIBIDO:", winner);
  if (!winner) {
      return res.status(400).json({
      message: "There is no winner, a winner is required"
      });
    }  
  try{
    const score = ScoreService.calculate(matchSummary);
    const gameId = await createInsertGame(matchSummary);
    console.log("GAME ID:", gameId, "SCORE CALCULATED:", score); 
    await finishGame(gameId, winner, score);
    res.json({ score });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }

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
