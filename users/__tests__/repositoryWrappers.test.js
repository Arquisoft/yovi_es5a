import { describe, it, expect, vi } from 'vitest'

const GameRepository = require('../repositories/gameRepository')
const UserRepository = require('../repositories/userRepository')

describe('repository wrappers', () => {
  it('GameRepository delega todas las operaciones al db adapter', async () => {
    const db = {
      insertGame: vi.fn().mockResolvedValue(1),
      insertUserGame: vi.fn().mockResolvedValue(2),
      insertUserBotGame: vi.fn().mockResolvedValue(3),
      insertBotGame: vi.fn().mockResolvedValue(4),
      updateGameWinner: vi.fn().mockResolvedValue(5),
      findUserIdByUsername: vi.fn().mockResolvedValue(6),
      findBotIdByDifficulty: vi.fn().mockResolvedValue(7),
      insertFinishedGame: vi.fn().mockResolvedValue(8),
      updateUserBotStats: vi.fn().mockResolvedValue(9),
      findUserByUsernameExact: vi.fn().mockResolvedValue({ id: 10 }),
      getLeaderboardPage: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
      getUserRankById: vi.fn().mockResolvedValue(11),
      getLeaderboardPageCenteredByUserId: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
      getUserSuggestionsByUsername: vi.fn().mockResolvedValue([]),
      getUserMatchHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
      getUserVsUserMatchHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    }
    const connFactory = vi.fn().mockResolvedValue({ kind: 'connection' })
    const repo = new GameRepository(db, connFactory)
    const conn = { tx: true }

    await expect(repo.insertGame(8, '1vs1', conn)).resolves.toBe(1)
    await expect(repo.insertUserGame(1, 2, 3, conn)).resolves.toBe(2)
    await expect(repo.insertUserBotGame(1, 2, 4, 'medio', conn)).resolves.toBe(3)
    await expect(repo.insertBotGame(1, 5, 6, 'facil', conn)).resolves.toBe(4)
    await expect(repo.updateGameWinner(1, 'player1', conn)).resolves.toBe(5)
    await expect(repo.findUserIdByUsername('Ana', conn)).resolves.toBe(6)
    await expect(repo.findBotIdByDifficulty('medio', conn)).resolves.toBe(7)
    await expect(repo.insertFinishedGame({ mode: '1vs1' }, conn)).resolves.toBe(8)
    await expect(repo.updateUserBotStats(2, 100, conn)).resolves.toBe(9)
    await expect(repo.findUserByUsernameExact('Ana', conn)).resolves.toEqual({ id: 10 })
    await expect(repo.getLeaderboardPage(1, 25, conn)).resolves.toEqual({ rows: [], total: 0 })
    await expect(repo.getUserRankById(2, conn)).resolves.toBe(11)
    await expect(repo.getLeaderboardPageCenteredByUserId(2, 25, 2, conn)).resolves.toEqual({ rows: [], total: 0 })
    await expect(repo.getUserSuggestionsByUsername('a', 10, conn)).resolves.toEqual([])
    await expect(repo.getUserMatchHistory(2, 1, 25, conn)).resolves.toEqual({ rows: [], total: 0 })
    await expect(repo.getUserVsUserMatchHistory(2, 1, 25, conn)).resolves.toEqual({ rows: [], total: 0 })
    await expect(repo.getConnection()).resolves.toEqual({ kind: 'connection' })

    expect(db.insertGame).toHaveBeenCalledWith(8, '1vs1', conn)
    expect(db.getUserVsUserMatchHistory).toHaveBeenCalledWith(2, 1, 25, conn)
    expect(connFactory).toHaveBeenCalledOnce()
  })

  it('UserRepository delega en userDb y proveedor de conexion', async () => {
    const db = {
      insertUser: vi.fn().mockResolvedValue(77),
    }
    const connFactory = vi.fn().mockResolvedValue({ kind: 'connection' })
    const repo = new UserRepository(db, connFactory)

    await expect(repo.insertUser('Ana')).resolves.toBe(77)
    await expect(repo.getConnection()).resolves.toEqual({ kind: 'connection' })

    expect(db.insertUser).toHaveBeenCalledWith('Ana')
    expect(connFactory).toHaveBeenCalledOnce()
  })
})
