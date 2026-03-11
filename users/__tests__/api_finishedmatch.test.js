import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'

describe('POST /finished-match', () => {

  it('devuelve score correctamente', async () => {
    const res = await request(app)
      .post('/finished-match')
      .send({
        turnNumber: 1,
        boardSize: 8,
        mode: '1vs1',
        winnerName: 'a',
        loserName: 'b'
      })

    expect(res.status).toBe(200)
    expect(res.body.score).toBe(129)
  })

})
