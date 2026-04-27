import { describe, it, expect, vi, beforeEach } from 'vitest'


const conn = {
  execute: vi.fn(),
}

vi.mock('../db', () => ({
  getConnection: vi.fn().mockResolvedValue(conn)
}))


const gameDb = {
  insertGame: vi.fn().mockResolvedValue(1),
  insertUserBotGame: vi.fn().mockResolvedValue(3),
  insertBotGame: vi.fn().mockResolvedValue(4),
  updateGameWinner: vi.fn().mockResolvedValue(5),
  insertFinishedGame: vi.fn().mockResolvedValue(8),
  updateUserBotStats: vi.fn().mockResolvedValue(9),
  getUserRankById: vi.fn().mockResolvedValue(11),
  getUserSuggestionsByUsername: vi.fn().mockResolvedValue([]),
}

const userDb = {
  findUserByUsernameExact: vi.fn().mockResolvedValue({ id: 10 }),
}


const GameRepository = require('../repositories/gameRepository')

describe('GameRepository uncovered methods', () => {

  let repo

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new GameRepository(gameDb, require('../db').getConnection, userDb)
  })

  it('insertGame delega correctamente sin conexión', async () => {
    const result = await repo.insertGame(8, '1vs1',conn)
    expect(result).toBe(1)
    expect(gameDb.insertGame).toHaveBeenCalledWith(8, '1vs1', conn)
  })

  it('insertGame delega correctamente con conexión', async () => {
    const result = await repo.insertGame(8, '1vs1', conn)
    expect(result).toBe(1)
    expect(gameDb.insertGame).toHaveBeenCalledWith(8, '1vs1', conn)
  })

  it('insertUserBotGame delega correctamente sin conexión', async () => {
    const result = await repo.insertUserBotGame(1, 2, 4, 'medio',conn)
    expect(result).toBe(3)
    expect(gameDb.insertUserBotGame).toHaveBeenCalledWith(1, 2, 4, 'medio', conn)
  })

  it('insertUserBotGame delega correctamente con conexión', async () => {
    const result = await repo.insertUserBotGame(1, 2, 4, 'medio', conn)
    expect(result).toBe(3)
    expect(gameDb.insertUserBotGame).toHaveBeenCalledWith(1, 2, 4, 'medio', conn)
  })

  it('insertBotGame delega correctamente sin conexión', async () => {
    const result = await repo.insertBotGame(1, 5, 6, 'facil',conn)
    expect(result).toBe(4)
    expect(gameDb.insertBotGame).toHaveBeenCalledWith(1, 5, 6, 'facil', conn)
  })

  it('insertBotGame delega correctamente con conexión', async () => {
    const result = await repo.insertBotGame(1, 5, 6, 'facil', conn)
    expect(result).toBe(4)
    expect(gameDb.insertBotGame).toHaveBeenCalledWith(1, 5, 6, 'facil', conn)
  })

  it('updateGameWinner delega correctamente sin conexión', async () => {
    const result = await repo.updateGameWinner(1, 'player1',conn)
    expect(result).toBe(5)
    expect(gameDb.updateGameWinner).toHaveBeenCalledWith(1, 'player1', conn)
  })

  it('updateGameWinner delega correctamente con conexión', async () => {
    const result = await repo.updateGameWinner(1, 'player1', conn)
    expect(result).toBe(5)
    expect(gameDb.updateGameWinner).toHaveBeenCalledWith(1, 'player1', conn)
  })

  it('findUserIdByUsername delega correctamente sin conexión', async () => {
    const result = await repo.findUserIdByUsername('Ana',conn)
    expect(result).toEqual({ id: 10 })
    expect(userDb.findUserByUsernameExact).toHaveBeenCalledWith('Ana', conn)
  })

  it('findUserIdByUsername delega correctamente con conexión', async () => {
    const result = await repo.findUserIdByUsername('Ana', conn)
    expect(result).toEqual({ id: 10 })
    expect(userDb.findUserByUsernameExact).toHaveBeenCalledWith('Ana', conn)
  })

  it('insertFinishedGame delega correctamente sin conexión', async () => {
    const summary = { mode: '1vs1' }
    const result = await repo.insertFinishedGame(summary,conn)
    expect(result).toBe(8)
    expect(gameDb.insertFinishedGame).toHaveBeenCalledWith(summary, conn)
  })

  it('insertFinishedGame delega correctamente con conexión', async () => {
    const summary = { mode: '1vs1' }
    const result = await repo.insertFinishedGame(summary, conn)
    expect(result).toBe(8)
    expect(gameDb.insertFinishedGame).toHaveBeenCalledWith(summary, conn)
  })

  it('updateUserBotStats delega correctamente sin conexión', async () => {
    const result = await repo.updateUserBotStats(2, 100,conn)
    expect(result).toBe(9)
    expect(gameDb.updateUserBotStats).toHaveBeenCalledWith(2, 100, conn)
  })

  it('updateUserBotStats delega correctamente con conexión', async () => {
    const result = await repo.updateUserBotStats(2, 100, conn)
    expect(result).toBe(9)
    expect(gameDb.updateUserBotStats).toHaveBeenCalledWith(2, 100, conn)
  })

  it('getUserRankById delega correctamente sin conexión', async () => {
    const result = await repo.getUserRankById(2,conn)
    expect(result).toBe(11)
    expect(gameDb.getUserRankById).toHaveBeenCalledWith(2, conn)
  })

  it('getUserRankById delega correctamente con conexión', async () => {
    const result = await repo.getUserRankById(2, conn)
    expect(result).toBe(11)
    expect(gameDb.getUserRankById).toHaveBeenCalledWith(2, conn)
  })

  it('getUserSuggestionsByUsername delega correctamente sin conexión', async () => {
    const result = await repo.getUserSuggestionsByUsername('a', 10,conn)
    expect(result).toEqual([])
    expect(gameDb.getUserSuggestionsByUsername).toHaveBeenCalledWith('a', 10, conn)
  })

  it('getUserSuggestionsByUsername delega correctamente con conexión', async () => {
    const result = await repo.getUserSuggestionsByUsername('a', 10, conn)
    expect(result).toEqual([])
    expect(gameDb.getUserSuggestionsByUsername).toHaveBeenCalledWith('a', 10, conn)
  })

  it('getConnection delega en el proveedor mockeado', async () => {
  const fakeConn = { tx: true }
  const mockGetConn = vi.fn().mockResolvedValue(fakeConn)

  const repo2 = new GameRepository(gameDb, mockGetConn, userDb)

  const result = await repo2.getConnection()

  expect(result).toBe(fakeConn)
  expect(mockGetConn).toHaveBeenCalled()
})

})