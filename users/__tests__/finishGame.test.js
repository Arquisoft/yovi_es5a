import { describe, it, expect, vi, beforeEach } from 'vitest'

const { finishGame, gameRepo } = require('../services/gameService')

describe('finishGame', () => {

  beforeEach(() => {
    gameRepo.updateGameWinner = vi.fn()
  })

  it('falta gameId o winner → error', async () => {
    await expect(finishGame(null, 'player1'))
      .rejects.toThrow('gameId and winner are required')
  })

  it('winner inválido → error', async () => {
    await expect(finishGame(1, 'invalid'))
      .rejects.toThrow('Winner must be player1, player2, player, bot, or draw')
  })

  it('flujo correcto', async () => {
    gameRepo.updateGameWinner.mockResolvedValue()

    const msg = await finishGame(1, 'player1')

    expect(gameRepo.updateGameWinner).toHaveBeenCalledWith(1, 'player1')
    expect(msg).toBe('Game 1 finished with winner: player1')
  })

  it('error de base de datos', async () => {
    gameRepo.updateGameWinner.mockRejectedValue(new Error('fail'))

    await expect(finishGame(1, 'player1'))
      .rejects.toThrow('Database error: fail')
  })
})
