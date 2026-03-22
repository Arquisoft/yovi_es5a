import { describe, it, expect, vi, beforeEach } from 'vitest'
const gameDb = require('../gameDb')

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
