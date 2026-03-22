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

  it('getUserSuggestions consulta repositorio para query larga', async () => {
    leaderboardService.gameRepo.getUserSuggestionsByUsername = vi.fn().mockResolvedValue([
      { username: 'Anabel' },
      { username: 'Anais' },
    ])

    const result = await leaderboardService.getUserSuggestions('anab')

    expect(leaderboardService.gameRepo.getUserSuggestionsByUsername).toHaveBeenCalledWith('anab', 10)
    expect(result).toEqual(['Anabel', 'Anais'])
  })

  it('getUserHistory devuelve bot y pvp con paginación independiente', async () => {
    leaderboardService.gameRepo.findUserByUsernameExact = vi.fn().mockResolvedValue({
      id: 5,
      username: 'Ana',
      created_at: new Date(),
      best_score: 150,
      total_games_1vsbot: 7,
    })
    leaderboardService.gameRepo.getUserMatchHistory = vi.fn().mockResolvedValue({
      rows: [{
        id: 1,
        score: 100,
        board_size: 8,
        total_turns: 22,
        elapsed_seconds: 80,
        winner: 'player',
        difficulty: 'medio',
        bot_name: 'Bot Medio',
      }],
      total: 9,
    })
    leaderboardService.gameRepo.getUserVsUserMatchHistory = vi.fn().mockResolvedValue({
      rows: [{
        id: 10,
        score: 120,
        board_size: 8,
        total_turns: 24,
        elapsed_seconds: 90,
        winner: 'player1',
        winner_name: 'Ana',
        player1_name: 'Ana',
        player2_name: 'Luis',
      }],
      total: 3,
    })

    const result = await leaderboardService.getUserHistory('Ana', {
      botPage: 2,
      botPageSize: 50,
      pvpPage: 3,
      pvpPageSize: 25,
    })

    expect(leaderboardService.gameRepo.getUserMatchHistory).toHaveBeenCalledWith(5, 2, 50)
    expect(leaderboardService.gameRepo.getUserVsUserMatchHistory).toHaveBeenCalledWith(5, 3, 25)
    expect(result.botItems).toHaveLength(1)
    expect(result.pvpItems).toHaveLength(1)
    expect(result.botTotalPages).toBe(1)
    expect(result.pvpTotalPages).toBe(1)
  })

  it('getCenteredLeaderboard usa página solicitada si existe', async () => {
    leaderboardService.gameRepo.findUserByUsernameExact = vi.fn().mockResolvedValue({ id: 3, username: 'Ana' })
    leaderboardService.gameRepo.getLeaderboardPageCenteredByUserId = vi.fn().mockResolvedValue({
      rows: [{ global_position: 26, username: 'Ana', best_score: 100, total_games: 2 }],
      userRank: 26,
      currentPage: 2,
      total: 70,
      totalPages: 3,
    })

    const result = await leaderboardService.getCenteredLeaderboard('Ana', { page: 2, pageSize: 25 })

    expect(leaderboardService.gameRepo.getLeaderboardPageCenteredByUserId).toHaveBeenCalledWith(3, 25, 2)
    expect(result.page).toBe(2)
    expect(result.items[0].globalPosition).toBe(26)
  })
})
