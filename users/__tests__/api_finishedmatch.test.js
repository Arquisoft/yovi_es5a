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

  it('devuelve score correctamente', async () => {
    const recordSpy = vi.spyOn(gameService, 'recordFinishedMatch').mockResolvedValue(77)

    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', authHeader('a'))
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
    expect(res.body.score).toBe(129)
    expect(res.body.saved).toBe(true)
    expect(res.body.gameId).toBe(77)
    expect(recordSpy).toHaveBeenCalledOnce()
  })

  it('retorna 400 si falta difficulty en 1vsbot', async () => {
  const res = await request(app)
    .post('/finished-match')
    .set('Authorization', authHeader('ana'))
    .send({
      turnNumber: 2,
      boardSize: 8,
      mode: '1vsbot',
      // falta difficulty
      winner: 'player'
    })

  expect(res.status).toBe(400)
  expect(res.body.message).toMatch(/difficulty es obligatorio/)
  })

  it('retorna 400 si falta winner en 1vsbot sin empate', async () => {
  const res = await request(app)
    .post('/finished-match')
    .set('Authorization', authHeader('ana'))
    .send({
      turnNumber: 2,
      boardSize: 8,
      mode: '1vsbot',
      difficulty: 'facil',
      isDraw: false
      // falta winner
    })

  expect(res.status).toBe(400)
  expect(res.body.message).toMatch(/winner es obligatorio/)
})

})
