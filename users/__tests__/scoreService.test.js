import { describe, it, expect } from 'vitest'
import ScoreService from '../services/scoreService.js'

describe('ScoreService.calculate', () => {

  it('calcula correctamente con valores normales', () => {
    const result = ScoreService.calculate({ turnNumber: 1, boardSize: 8 })
    expect(result).toBe(129)
  })

  it('turnNumber muy alto → penalización mínima 0', () => {
    const result = ScoreService.calculate({ turnNumber: 100, boardSize: 10 })
    expect(result).toBe(100)
  })

  
  it('valores mínimos', () => {
    const result = ScoreService.calculate({ turnNumber: 0, boardSize: 1 })
    expect(result).toBe(60)
  })

})