import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../repositories/gameRepository', () => ({
  default: vi.fn(() => repoInstance)
}));
const { createUserVsUserGame, gameRepo } = require('../services/gameService');


describe('createUserVsUserGame', () => {

  let mockConn

  beforeEach(() => {
    mockConn = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn()
    }

  
    gameRepo.getConnection = vi.fn().mockResolvedValue(mockConn)
    gameRepo.insertGame = vi.fn().mockResolvedValue(10)
    gameRepo.insertUserGame = vi.fn().mockResolvedValue()
  })

  it('falta parámetro → error', async () => {
    await expect(createUserVsUserGame(null, 2, 8))
      .rejects.toThrow('player1Id, player2Id, and boardSize are required')
  })

  it('jugadores iguales → error', async () => {
    await expect(createUserVsUserGame(1, 1, 8))
      .rejects.toThrow('Players must be different')
  })

  it('flujo correcto con commit', async () => {

    const msg = await createUserVsUserGame(1, 2, 8)

    expect(mockConn.beginTransaction).toHaveBeenCalled()
    expect(gameRepo.insertGame).toHaveBeenCalledWith(8, '1vs1', mockConn)
    expect(gameRepo.insertUserGame).toHaveBeenCalledWith(10, 1, 2, null, mockConn)
    expect(mockConn.commit).toHaveBeenCalled()
    expect(msg).toBe('Game created with ID: 10')
  })

  it('error en insertUserGame → rollback', async () => {
    gameRepo.insertGame = vi.fn().mockResolvedValue(10)
    gameRepo.insertUserGame = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(createUserVsUserGame(1, 2, 8)).rejects.toThrow('Database error')
    expect(mockConn.rollback).toHaveBeenCalled()
  })

})
