import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../repositories/gameRepository', () => ({
  default: vi.fn(() => repoInstance)
}));

const { createUserVsBotGame, gameRepo } = require('../services/gameService');


describe('createUserVsBotGame', () => {

  let mockConn

  beforeEach(() => {
    mockConn = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn()
    }

    gameRepo.getConnection = vi.fn().mockResolvedValue(mockConn);
    gameRepo.insertGame = vi.fn().mockResolvedValue(10);
    gameRepo.insertUserBotGame = vi.fn().mockResolvedValue();
  })

  it('falta parámetro → error', async () => {
    await expect(createUserVsBotGame(null, 2, 8, 'Easy'))
      .rejects.toThrow('userId, botId, boardSize, and difficulty are required')
  })

  it('flujo correcto con commit', async () => {

    const msg = await createUserVsBotGame(1, 2, 8, 'Easy')

    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(gameRepo.insertGame).toHaveBeenCalledWith(8);
    expect(gameRepo.insertUserBotGame).toHaveBeenCalledWith(10, 1, 2, 'Easy');
    expect(mockConn.commit).toHaveBeenCalled();
    expect(msg).toBe('Game created with ID: 10');
  })

})
