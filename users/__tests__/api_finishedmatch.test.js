import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
const gameService = require('../services/gameService')
const tokenService = require('../auth/tokenService')
const sessionStore = require('../auth/sessionStore')

describe('POST /finished-match', () => {
  function authHeader(username = 'a') {
    const pair = tokenService.issueTokenPair({ userId: 1, username });
    return `Bearer ${pair.accessToken}`;
  }

  beforeEach(() => {
    sessionStore.clearSessions();
  });

  it('retorna 401 si no hay token', async () => {
    const res = await request(app)
      .post('/finished-match')
      .send({ mode: '1vs1' })

    expect(res.status).toBe(401)
  })

  it('retorna 400 si matchSummary es null', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send(null)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Match data is required')
  })

  it('retorna 400 si boardSize <= 0', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        boardSize: 0,
        turnNumber: 1,
        elapsedSeconds: 1,
        mode: '1vs1',
        playerName: 'a',
        guestName: 'b',
        winner: 'player'
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('boardSize must be a positive number')
  })

  it('retorna 400 si turnNumber < 0', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        boardSize: 8,
        turnNumber: -1,
        elapsedSeconds: 1,
        mode: '1vs1',
        playerName: 'a',
        guestName: 'b',
        winner: 'player'
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('turnNumber must be a number greater than or equal to 0')
  })

  it('retorna 400 si elapsedSeconds < 0', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        boardSize: 8,
        turnNumber: 1,
        elapsedSeconds: -5,
        mode: '1vs1',
        playerName: 'a',
        guestName: 'b',
        winner: 'player'
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('elapsedSeconds must be a number greater than or equal to 0')
  })

  it('retorna 400 si falta playerName o guestName en 1vs1', async () => {
    const res1 = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        boardSize: 8,
        turnNumber: 1,
        elapsedSeconds: 1,
        mode: '1vs1',
        playerName: '',
        guestName: 'b',
        winner: 'player'
      })
    expect(res1.status).toBe(400)
    expect(res1.body.message).toBe('playerName and guestName are required for 1vs1')

    const res2 = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        boardSize: 8,
        turnNumber: 1,
        elapsedSeconds: 1,
        mode: '1vs1',
        playerName: 'a',
        guestName: '',
        winner: 'player'
      })
    expect(res2.status).toBe(400)
    expect(res2.body.message).toBe('playerName and guestName are required for 1vs1')
  })

  it('retorna 400 si winner inválido en 1vs1', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        boardSize: 8,
        turnNumber: 1,
        elapsedSeconds: 1,
        mode: '1vs1',
        playerName: 'a',
        guestName: 'b',
        winner: 'invalid'
      })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('winner must be player, guest, or draw in 1vs1')
  })


  it('retorna 400 si mode inválido', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        boardSize: 8,
        turnNumber: 1,
        elapsedSeconds: 1,
        mode: 'invalid'
      })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('mode must be 1vs1 or 1vsbot')
  })

  it('devuelve score correctamente en 1vs1', async () => {
    vi.spyOn(gameService, 'recordFinishedMatch').mockResolvedValue(77)

    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        turnNumber: 1,
        elapsedSeconds: 12,
        boardSize: 8,
        mode: '1vs1',
        playerName: 'a',
        guestName: 'invitado',
        winner: 'player'
      })

    expect(res.status).toBe(200)
    expect(res.body.saved).toBe(true)
    expect(res.body.gameId).toBe(77)
  })

  it('retorna 400 si falta difficulty en 1vsbot', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        turnNumber: 2,
        boardSize: 8,
        mode: '1vsbot',
        winner: 'player'
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('difficulty is required for 1vsbot')
  })

  it('retorna 400 si falta winner en 1vsbot sin empate', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        turnNumber: 2,
        boardSize: 8,
        mode: '1vsbot',
        difficulty: 'facil',
        isDraw: false
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('winner is required for 1vsbot if there is no draw')
  })

  it('retorna 500 si ocurre un error inesperado en el servidor', async () => {
    vi.spyOn(gameService, 'recordFinishedMatch').mockRejectedValue(new Error('Error de base de datos'));

    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader())
      .send({
        turnNumber: 10,
        elapsedSeconds: 100,
        boardSize: 8,
        mode: '1vs1',
        playerName: 'a',
        guestName: 'b',
        winner: 'player'
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error de base de datos');
  });

})