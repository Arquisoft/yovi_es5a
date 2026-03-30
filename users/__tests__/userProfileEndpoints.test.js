import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
const leaderboardService = require('../services/leaderboardService')

describe('endpoints de perfil de usuario', () => {
  it('GET /users/:username devuelve perfil', async () => {
    vi.spyOn(leaderboardService, 'getUserProfile').mockResolvedValue({
      id: 1,
      username: 'Ana',
      globalPosition: 3,
      bestScore: 120,
      totalGames: 7,
    })

    const res = await request(app).get('/users/Ana')

    expect(res.status).toBe(200)
    expect(res.body.username).toBe('Ana')
    expect(res.body.globalPosition).toBe(3)
  })

  it('GET /users/:username/history devuelve historial paginado', async () => {
    vi.spyOn(leaderboardService, 'getUserHistory').mockResolvedValue({
      user: { id: 1, username: 'Ana' },
      items: [{ id: 10, score: 100 }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    })

    const res = await request(app).get('/users/Ana/history?page=1&pageSize=25')

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
  })

  it('GET /users/:username/centered-leaderboard devuelve datos centrados', async () => {
    vi.spyOn(leaderboardService, 'getCenteredLeaderboard').mockResolvedValue({
      highlightedUsername: 'Ana',
      userGlobalPosition: 40,
      page: 2,
      pageSize: 25,
      total: 80,
      totalPages: 4,
      items: [{ globalPosition: 40, username: 'Ana', bestScore: 100, totalGames: 8 }],
    })

    const res = await request(app).get('/users/Ana/centered-leaderboard?pageSize=25')

    expect(res.status).toBe(200)
    expect(res.body.highlightedUsername).toBe('Ana')
    expect(res.body.page).toBe(2)
  })
})
