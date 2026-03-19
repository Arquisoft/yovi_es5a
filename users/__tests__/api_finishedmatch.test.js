import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
const gameService = require('../services/gameService')

describe('POST /finished-match', () => {

  it('devuelve score correctamente', async () => {
    const recordSpy = vi.spyOn(gameService, 'recordFinishedMatch').mockResolvedValue(77)

    const res = await request(app)
      .post('/finished-match')
      .send({
        turnNumber: 1,
        elapsedSeconds: 12,
        boardSize: 8,
        mode: '1vs1',
        winnerName: 'a',
        loserName: 'b'
      })

    expect(res.status).toBe(200)
    expect(res.body.score).toBe(129)
    expect(res.body.saved).toBe(true)
    expect(res.body.gameId).toBe(77)
    expect(recordSpy).toHaveBeenCalledOnce()
  })

  it('retorna 400 si faltan datos obligatorios', async () => {
    const res = await request(app)
      .post('/finished-match')
      .send({
        turnNumber: 2,
        boardSize: 8,
        mode: '1vsbot',
        difficulty: 'facil',
        winner: 'player'
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/playerName/)
  })

})
