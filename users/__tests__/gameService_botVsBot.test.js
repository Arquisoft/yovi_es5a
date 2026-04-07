import { describe, it, expect, vi, beforeEach } from 'vitest'


vi.mock('../repositories/gameRepository', () => ({
  default: vi.fn(() => repoInstance)
}));
const { createBotVsBotGame, gameRepo } = require('../services/gameService');


describe('createBotVsBotGame', () => {
  let mockConn;

  beforeEach(() => {
    mockConn = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
    };

    gameRepo.getConnection = vi.fn().mockResolvedValue(mockConn);
    gameRepo.insertGame = vi.fn().mockResolvedValue(10);
    gameRepo.insertBotGame = vi.fn().mockResolvedValue();
  });

  it('bots iguales → error', async () => {
    await expect(createBotVsBotGame(1, 1, 8, 'Hard'))
      .rejects.toThrow('Bots must be different');
  });

  it('flujo correcto con commit', async () => {

    const msg = await createBotVsBotGame(1, 2, 8, 'Hard');

    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(gameRepo.insertGame).toHaveBeenCalledWith(8, 'botvsbot', mockConn);
    expect(gameRepo.insertBotGame).toHaveBeenCalledWith(10, 1, 2, 'Hard', mockConn);
    expect(mockConn.commit).toHaveBeenCalled();
    expect(msg).toBe('Game created with ID: 10');
  });
});
