import { describe, it, expect, vi, beforeEach } from 'vitest'

// 👇 IMPORTANTE: mockear antes de importar el módulo
const conn = {
  execute: vi.fn(),
}

vi.mock('../db', () => ({
  getConnection: vi.fn().mockResolvedValue(conn)
}))

const userDb = require('../userDb')

describe('userDb queries', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('findUserByUsernameExact normaliza y encuentra', async () => {
    conn.execute.mockResolvedValueOnce([[{
      id: 1,
      username: 'Ana',
      best_score: null,
      total_games_1vsbot: null
    }]])

    const user = await userDb.findUserByUsernameExact('  AnA  ', conn)

    expect(user.id).toBe(1)
    expect(user.username).toBe('Ana')
    expect(conn.execute.mock.calls[0][1]).toEqual(['ana'])
  })

  it('findUserByUsernameExact devuelve null', async () => {
    conn.execute.mockResolvedValueOnce([[]])

    const user = await userDb.findUserByUsernameExact('ghost', conn)

    expect(user).toBeNull()
  })

  it('findUserByEmailExact normaliza email', async () => {
    conn.execute.mockResolvedValueOnce([[{
      id: 2,
      username: 'bob',
      email: 'test@ejemplo.com'
    }]])

    const user = await userDb.findUserByEmailExact('  TeSt@EjEmPlO.cOm  ', conn)

    expect(user.email).toBe('test@ejemplo.com')
    expect(conn.execute.mock.calls[0][1]).toEqual(['test@ejemplo.com'])
  })

  it('findUserByEmailExact devuelve null', async () => {
    conn.execute.mockResolvedValueOnce([[]])

    const user = await userDb.findUserByEmailExact('ghost@test.com', conn)

    expect(user).toBeNull()
  })


})