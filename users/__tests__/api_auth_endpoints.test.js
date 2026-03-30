import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'

const tokenService = require('../auth/tokenService')
const sessionStore = require('../auth/sessionStore')

describe('auth endpoints validation', () => {
  beforeEach(() => {
    sessionStore.clearSessions()
  })

  it('refresh devuelve 400 sin refreshToken', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/refreshtoken/i)
  })

  it('logout devuelve 400 sin refreshToken', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .send({})

    expect(res.status).toBe(400)
  })

  it('finished-match devuelve 401 con header Authorization malformado', async () => {
    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', 'Token invalid')
      .send({
        mode: '1vsbot',
        boardSize: 8,
        turnNumber: 1,
        elapsedSeconds: 10,
        playerName: 'ana',
        difficulty: 'facil',
        winner: 'player',
      })

    expect(res.status).toBe(401)
  })

  it('refresh devuelve 401 con refresh token inválido', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid.token.value' })

    expect(res.status).toBe(401)
  })

  it('logout devuelve revoked false para token inválido', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: 'invalid.token.value' })

    expect(res.status).toBe(200)
    expect(res.body.revoked).toBe(false)
  })

  it('refresh rota correctamente y devuelve expiraciones', async () => {
    const pair = tokenService.issueTokenPair({ userId: 5, username: 'ana' })

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: pair.refreshToken })

    expect(res.status).toBe(200)
    expect(res.body.accessTokenExpiresIn).toBe(900)
    expect(res.body.refreshTokenExpiresIn).toBe(259200)
  })
})
