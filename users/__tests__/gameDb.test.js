import { describe, it, expect, vi, beforeEach } from 'vitest'
const gameDb = require('../gameDb')
const userDb = require('../userDb')

describe('gameDb queries', () => {
  let conn

  beforeEach(() => {
    conn = {
      execute: vi.fn(),
      query: vi.fn(),
    }
  })

  it('insertFinishedGame inserta y devuelve insertId', async () => {
    conn.execute.mockResolvedValueOnce([{ insertId: 99 }])

    const id = await gameDb.insertFinishedGame({
      boardSize: 8,
      mode: '1vsbot',
      winner: 'player',
      totalTurns: 12,
      elapsedSeconds: 50,
      score: 120,
    }, conn)

    expect(id).toBe(99)
    expect(conn.execute).toHaveBeenCalledOnce()
  })

  it('insertGame inserta y devuelve el id generado', async () => {
    conn.execute.mockResolvedValueOnce([{ insertId: 17 }])

    const id = await gameDb.insertGame(8, '1vs1', conn)

    expect(id).toBe(17)
    expect(conn.execute).toHaveBeenCalledWith(
      'INSERT INTO game (board_size, mode) VALUES (?, ?)',
      [8, '1vs1']
    )
  })

  it('insertUserGame/insertUserBotGame/insertBotGame/updateGameWinner delegan SQL', async () => {
    conn.execute.mockResolvedValue([])

    await gameDb.insertUserGame(9, 1, 2, conn)
    await gameDb.insertUserBotGame(10, 3, 4, 'medio', conn)
    await gameDb.insertBotGame(11, 5, 6, 'facil', conn)
    await gameDb.updateGameWinner(12, 'player1', conn)

    expect(conn.execute).toHaveBeenCalledTimes(4)
    expect(conn.execute.mock.calls[0][0]).toContain('INSERT INTO userGames')
    expect(conn.execute.mock.calls[1][0]).toContain('INSERT INTO ubotGames')
    expect(conn.execute.mock.calls[2][0]).toContain('INSERT INTO botGames')
    expect(conn.execute.mock.calls[3][0]).toContain('UPDATE game SET winner')
  })

  it('findUserIdByUsername y findBotIdByDifficulty devuelven objeto o null', async () => {
  conn.execute
    .mockResolvedValueOnce([[{ id: 21 }]]) // user encontrado
    .mockResolvedValueOnce([[]])           // user no encontrado
    .mockResolvedValueOnce([[{ id: 7 }]])  // bot encontrado

  const userObj = await userDb.findUserByUsernameExact('Ana', conn)
  const userMissing = await userDb.findUserByUsernameExact('Nadie', conn)
  const botObj = await gameDb.findBotIdByDifficulty('medio', conn)

  expect(userObj).toEqual({ id: 21 })
  expect(userMissing).toBeNull()
  expect(botObj).toBe(7)
})


  it('updateUserBotStats ejecuta update agregado', async () => {
    conn.execute.mockResolvedValueOnce([])

    await gameDb.updateUserBotStats(3, 420, conn)

    expect(conn.execute).toHaveBeenCalledTimes(1)
    expect(conn.execute.mock.calls[0][0]).toContain('total_games_1vsbot')
    expect(conn.execute.mock.calls[0][1]).toEqual([420, 3])
  })

  it('findUserByUsernameExact normaliza username y devuelve null cuando no existe', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ id: 1, username: 'Ana', best_score: 20, total_games_1vsbot: 2 }]])
      .mockResolvedValueOnce([[]])

    const found = await userDb.findUserByUsernameExact('  aNa  ', conn)
    const missing = await userDb.findUserByUsernameExact('ghost', conn)

    expect(found.username).toBe('Ana')
    expect(missing).toBeNull()
    expect(conn.execute.mock.calls[0][1]).toEqual(['ana'])
  })

  it('getLeaderboardPage usa LIMIT/OFFSET saneados', async () => {
    conn.execute.mockResolvedValueOnce([[{ total: 40 }]])
    conn.query.mockResolvedValueOnce([[{ username: 'Ana', best_score: 123, total_games: 5, global_position: 1 }]])

    const result = await gameDb.getLeaderboardPage('2', '25', conn)

    expect(result.total).toBe(40)
    expect(result.rows[0].username).toBe('Ana')
    expect(conn.query.mock.calls[0][0]).toContain('LIMIT 25 OFFSET 25')
  })

  it('getLeaderboardPageCenteredByUserId usa pagina calculada cuando requestedPage no existe', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ total: 70 }]])
      .mockResolvedValueOnce([[{ global_position: 33 }]])
    conn.query.mockResolvedValueOnce([[{ username: 'Bob', global_position: 33 }]])

    const result = await gameDb.getLeaderboardPageCenteredByUserId(7, 25, null, conn)

    expect(result.userRank).toBe(33)
    expect(result.currentPage).toBe(2)
    expect(conn.query.mock.calls[0][0]).toContain('LIMIT 25 OFFSET 25')
  })

  it('getLeaderboardPageCenteredByUserId devuelve vacio si usuario no tiene rank', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ total: 70 }]])
      .mockResolvedValueOnce([[{ global_position: 0 }]])

    const result = await gameDb.getLeaderboardPageCenteredByUserId(99, 25, 3, conn)

    expect(result.rows).toEqual([])
    expect(result.userRank).toBe(0)
    expect(result.currentPage).toBe(1)
    expect(conn.query).not.toHaveBeenCalled()
  })

  it('getLeaderboardPageCenteredByUserId respeta requestedPage acotada por totalPages', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ total: 40 }]])
      .mockResolvedValueOnce([[{ global_position: 6 }]])
    conn.query.mockResolvedValueOnce([[{ username: 'Ana', global_position: 6 }]])

    const result = await gameDb.getLeaderboardPageCenteredByUserId(1, 25, 99, conn)

    expect(result.currentPage).toBe(2)
    expect(conn.query.mock.calls[0][0]).toContain('LIMIT 25 OFFSET 25')
  })

  it('getUserSuggestionsByUsername sanea query y limit', async () => {
    conn.execute.mockResolvedValueOnce([[{ username: 'Ana' }]])

    const rows = await gameDb.getUserSuggestionsByUsername('  An  ', 999, conn)

    expect(rows).toEqual([{ username: 'Ana' }])
    expect(conn.execute.mock.calls[0][0]).toContain('LIMIT 10')
    expect(conn.execute.mock.calls[0][1]).toEqual(['%an%'])
  })

  it('getUserMatchHistory devuelve filas y total con paginacion', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ total: 2 }]])
      .mockResolvedValueOnce([[{ id: 1, score: 40, difficulty: 'medio' }]])

    const result = await gameDb.getUserMatchHistory(4, 2, 25, conn)

    expect(result.total).toBe(2)
    expect(result.rows[0].id).toBe(1)
    expect(conn.execute).toHaveBeenCalledTimes(2)
    expect(conn.execute.mock.calls[1][0]).toContain('LIMIT 25 OFFSET 25')
  })

  it('getUserVsUserMatchHistory devuelve filas y total', async () => {
    conn.execute
      .mockResolvedValueOnce([[{ total: 3 }]])
      .mockResolvedValueOnce([[{ id: 1, winner_name: 'Ana', player1_name: 'Ana', player2_name: 'Luis' }]])

    const result = await gameDb.getUserVsUserMatchHistory(4, 1, 25, conn)

    expect(result.total).toBe(3)
    expect(result.rows[0].winner_name).toBe('Ana')
    expect(conn.execute).toHaveBeenCalledTimes(2)
  })
})
