import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../gameDb', () => ({
  insertGame: vi.fn().mockResolvedValue(1),
  insertUserGame: vi.fn().mockResolvedValue(2),
  insertUserBotGame: vi.fn().mockResolvedValue(3),
  insertBotGame: vi.fn().mockResolvedValue(4),
  updateGameWinner: vi.fn().mockResolvedValue(5),
  findBotIdByDifficulty: vi.fn().mockResolvedValue(7),

  insertFinishedGame: vi.fn().mockResolvedValue(8),
  updateUserBotStats: vi.fn().mockResolvedValue(9),
  getLeaderboardPage: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getUserRankById: vi.fn().mockResolvedValue(11),
  getLeaderboardPageCenteredByUserId: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getUserSuggestionsByUsername: vi.fn().mockResolvedValue([]),
  getUserMatchHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getUserVsUserMatchHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
}))


vi.mock('../userDb', () => ({
  findUserByUsernameExact: vi.fn().mockResolvedValue({ id: 10 }),
  findUserByEmailExact: vi.fn().mockResolvedValue({ id: 10 }),
  insertUser: vi.fn().mockResolvedValue(77),
  getUsersFromDB: vi.fn().mockResolvedValue([]),
}))

vi.mock('../db', () => ({
  getConnection: vi.fn().mockResolvedValue({ kind: 'connection' })
}))


describe('repository wrappers', () => {

  let GameRepository
  let UserRepository
  let gameDb
  let userDb
  let getConnection

  beforeEach(async () => {
    vi.clearAllMocks()

    GameRepository = (await import('../repositories/gameRepository')).default || (await import('../repositories/gameRepository'))
    UserRepository = (await import('../repositories/userRepository')).default || (await import('../repositories/userRepository'))

    gameDb = await import('../gameDb')
    userDb = await import('../userDb')
    getConnection = (await import('../db')).getConnection
  })

  it('GameRepository delega todas las operaciones al db adapter', async () => {
    const repo = new GameRepository(gameDb, getConnection, userDb)

    await expect(repo.insertGame(8, '1vs1')).resolves.toBe(1)
    await expect(repo.insertUserGame(1, 2, 3, 'Luis')).resolves.toBe(2)
    await expect(repo.insertUserBotGame(1, 2, 4, 'medio')).resolves.toBe(3)
    await expect(repo.insertBotGame(1, 5, 6, 'facil')).resolves.toBe(4)
    await expect(repo.updateGameWinner(1, 'player1')).resolves.toBe(5)

    await expect(repo.findUserIdByUsername('Ana')).resolves.toEqual({ id: 10 })

    await expect(repo.findBotIdByDifficulty('medio')).resolves.toBe(7)
    await expect(repo.insertFinishedGame({ mode: '1vs1' })).resolves.toBe(8)
    await expect(repo.updateUserBotStats(2, 100)).resolves.toBe(9)
    await expect(repo.getLeaderboardPage(1, 25)).resolves.toEqual({ rows: [], total: 0 })
    await expect(repo.getUserRankById(2)).resolves.toBe(11)
    await expect(repo.getLeaderboardPageCenteredByUserId(2, 25, 2)).resolves.toEqual({ rows: [], total: 0 })
    await expect(repo.getUserSuggestionsByUsername('a', 10)).resolves.toEqual([])
    await expect(repo.getUserMatchHistory(2, 1, 25)).resolves.toEqual({ rows: [], total: 0 })
    await expect(repo.getUserVsUserMatchHistory(2, 1, 25)).resolves.toEqual({ rows: [], total: 0 })

    await expect(repo.getConnection()).resolves.toEqual({ kind: 'connection' })
  })

  it('UserRepository delega en userDb y proveedor de conexion', async () => {
    const repo = new UserRepository(userDb, getConnection)

    await expect(repo.insertUser('Ana')).resolves.toBe(77)
    await expect(repo.getConnection()).resolves.toEqual({ kind: 'connection' })
  })
})