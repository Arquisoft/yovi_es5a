import { describe, it, expect } from 'vitest'
const leaderboardService = require('../services/leaderboardService')

describe('ranking y paginación helpers', () => {
  it('parsePage usa 1 por defecto para valores inválidos', () => {
    expect(leaderboardService.__testing.parsePage(undefined)).toBe(1)
    expect(leaderboardService.__testing.parsePage('abc')).toBe(1)
    expect(leaderboardService.__testing.parsePage(0)).toBe(1)
  })

  it('parsePageSize restringe a 25/50/100', () => {
    expect(leaderboardService.__testing.parsePageSize(25)).toBe(25)
    expect(leaderboardService.__testing.parsePageSize(50)).toBe(50)
    expect(leaderboardService.__testing.parsePageSize(100)).toBe(100)
    expect(leaderboardService.__testing.parsePageSize(999)).toBe(25)
  })
})
