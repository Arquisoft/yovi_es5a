import { describe, it, expect, vi, beforeEach } from 'vitest'
const leaderboardService = require('../services/leaderboardService')

describe('leaderboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normaliza page/pageSize y mapea respuesta', async () => {
    leaderboardService.gameRepo.getLeaderboardPage = vi.fn().mockResolvedValue({
      rows: [{ global_position: 1, username: 'Ana', best_score: 140, total_games: 6 }],
      total: 1,
    })

    const result = await leaderboardService.getLeaderboard({ page: '0', pageSize: '77' })

    expect(leaderboardService.gameRepo.getLeaderboardPage).toHaveBeenCalledWith(1, 25)
    expect(result.items[0]).toEqual({
      globalPosition: 1,
      username: 'Ana',
      bestScore: 140,
      totalGames: 6,
    })
  })

  it('limita sugerencias con query corta', async () => {
    leaderboardService.gameRepo.getUserSuggestionsByUsername = vi.fn()
    const result = await leaderboardService.getUserSuggestions('ana')
    expect(result).toEqual([])
    expect(leaderboardService.gameRepo.getUserSuggestionsByUsername).not.toHaveBeenCalled()
  })

  it('lanza 404 cuando perfil no existe', async () => {
    leaderboardService.gameRepo.findUserByUsernameExact = vi.fn().mockResolvedValue(null)
    await expect(leaderboardService.getUserProfile('desconocido')).rejects.toThrow('Usuario no encontrado')
  })
})
