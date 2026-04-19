import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'

const userService = require('../services/userService')
vi.spyOn(userService, 'resolveUserByExactUsername').mockResolvedValue(null)

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
    vi.spyOn(userService, 'resolveUserByExactUsername')
      .mockResolvedValueOnce({ username: 'Ana' })
      .mockResolvedValueOnce(null)

    const found = await request(app).get('/users/resolve?username=ana')
    const missing = await request(app).get('/users/resolve?username=desconocido')

    expect(found.status).toBe(200)
    expect(found.body.username).toBe('Ana')
    expect(missing.status).toBe(404)
  })

  it('retorna 500 si leaderboardService.getLeaderboard falla', async () => {
    vi.spyOn(leaderboardService, 'getLeaderboard').mockRejectedValue(new Error('Fallo de conexión'));

    const res = await request(app).get('/leaderboard');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Fallo de conexión');
  });

  it('retorna 500 si leaderboardService.getUserSuggestions falla', async () => {
    vi.spyOn(leaderboardService, 'getUserSuggestions').mockRejectedValue(new Error('Error interno en sugerencias'));

    const res = await request(app).get('/leaderboard/suggest?q=ana');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error interno en sugerencias');
  });

  it('retorna 400 si el username está vacío en /users/resolve', async () => {
    
    const res = await request(app).get('/users/resolve?username=   ')

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('username is required')
  })

  it('retorna 500 si userService.resolveUserByExactUsername falla', async () => {
    
    vi.spyOn(userService, 'resolveUserByExactUsername').mockRejectedValue(new Error('Error de base de datos'))

    const res = await request(app).get('/users/resolve?username=ana')

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Error de base de datos')
  })

  it('retorna 500 si leaderboardService.getUserProfile falla', async () => {
    vi.spyOn(leaderboardService, 'getUserProfile').mockRejectedValue(new Error('Error al conectar con el servidor de perfiles'));

    const res = await request(app).get('/users/ana');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error al conectar con el servidor de perfiles');
  });

  

})
