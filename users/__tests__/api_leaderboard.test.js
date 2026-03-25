import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
const leaderboardService = require('../services/leaderboardService')

describe('GET /leaderboard y endpoints de usuario', () => {
  it('devuelve leaderboard paginado', async () => {
    vi.spyOn(leaderboardService, 'getLeaderboard').mockResolvedValue({
      items: [{ globalPosition: 1, username: 'Ana', bestScore: 120, totalGames: 9 }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    })

    const res = await request(app).get('/leaderboard?page=1&pageSize=25')

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].username).toBe('Ana')
    expect(leaderboardService.getLeaderboard).toHaveBeenCalledOnce()
  })

  it('devuelve sugerencias', async () => {
    vi.spyOn(leaderboardService, 'getUserSuggestions').mockResolvedValue(['Ana', 'Anabel'])

    const res = await request(app).get('/leaderboard/suggest?q=ana')

    expect(res.status).toBe(200)
    expect(res.body.items).toEqual(['Ana', 'Anabel'])
  })

  it('resuelve usuario exacto y devuelve 404 si no existe', async () => {
    vi.spyOn(leaderboardService, 'resolveUserByExactUsername')
      .mockResolvedValueOnce({ username: 'Ana' })
      .mockResolvedValueOnce(null)

    const found = await request(app).get('/users/resolve?username=ana')
    const missing = await request(app).get('/users/resolve?username=desconocido')

    expect(found.status).toBe(200)
    expect(found.body.username).toBe('Ana')
    expect(missing.status).toBe(404)
  })
})
