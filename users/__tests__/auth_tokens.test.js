import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'

const tokenService = require('../auth/tokenService')
const sessionStore = require('../auth/sessionStore')
const gameService = require('../services/gameService')

describe('auth tokens', () => {
  beforeEach(() => {
    sessionStore.clearSessions()
  })

  it('rota refresh token y emite nuevo par', async () => {
    const initial = tokenService.issueTokenPair({ userId: 12, username: 'ana' })

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: initial.refreshToken })

    expect(res.status).toBe(200)
    expect(typeof res.body.accessToken).toBe('string')
    expect(typeof res.body.refreshToken).toBe('string')
    expect(res.body.refreshToken).not.toBe(initial.refreshToken)
  })

  it('rechaza refresh revocado (reuse detection básico)', async () => {
    const initial = tokenService.issueTokenPair({ userId: 12, username: 'ana' })

    const first = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: initial.refreshToken })

    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: initial.refreshToken })

    expect(second.status).toBe(401)
    expect(second.body.message).toMatch(/revocado|reutilizado/i)
  })

  it('logout revoca el refresh token', async () => {
    const initial = tokenService.issueTokenPair({ userId: 99, username: 'pablo' })

    const logoutRes = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: initial.refreshToken })

    expect(logoutRes.status).toBe(200)
    expect(logoutRes.body.revoked).toBe(true)

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: initial.refreshToken })

    expect(refreshRes.status).toBe(401)
  })

  it('finished-match permite acceso con access token válido', async () => {
    gameService.recordFinishedMatch = async () => 44
    const pair = tokenService.issueTokenPair({ userId: 1, username: 'ana' })

    const res = await request(app)
      .post('/finished-match')
      .set('Authorization', `Bearer ${pair.accessToken}`)
      .send({
        mode: '1vsbot',
        boardSize: 8,
        turnNumber: 1,
        elapsedSeconds: 10,
        playerName: 'ana',
        difficulty: 'facil',
        winner: 'player',
      })

    expect(res.status).toBe(200)
  })
})
