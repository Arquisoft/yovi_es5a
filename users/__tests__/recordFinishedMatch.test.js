import { describe, it, expect, vi, beforeEach } from 'vitest'

const { recordFinishedMatch, gameRepo } = require('../services/gameService')

describe('recordFinishedMatch', () => {
  let conn

  beforeEach(() => {
    conn = {
      beginTransaction: vi.fn().mockResolvedValue(),
      commit: vi.fn().mockResolvedValue(),
      rollback: vi.fn().mockResolvedValue(),
    }

    gameRepo.getConnection = vi.fn().mockResolvedValue(conn)
    gameRepo.findUserIdByUsername = vi.fn()
    gameRepo.findBotIdByDifficulty = vi.fn()
    gameRepo.insertFinishedGame = vi.fn().mockResolvedValue(101)
    gameRepo.insertUserGame = vi.fn().mockResolvedValue()
    gameRepo.insertUserBotGame = vi.fn().mockResolvedValue()
    gameRepo.updateUserBotStats = vi.fn().mockResolvedValue()
  })

  it('guarda partida 1vs1 y relaciona ganador/perdedor', async () => {
    gameRepo.findUserIdByUsername.mockResolvedValueOnce(11)

    const gameId = await recordFinishedMatch({
      mode: '1vs1',
      boardSize: 8,
      turnNumber: 12,
      elapsedSeconds: 33,
      playerName: 'Ana',
      guestName: 'Luis',
      winner: 'player',
      isDraw: false,
    }, 250, { username: 'Ana' })

    expect(gameId).toBe(101)
    expect(gameRepo.insertFinishedGame).toHaveBeenCalledWith({
      boardSize: 8,
      mode: '1vs1',
      winner: 'player1',
      totalTurns: 12,
      elapsedSeconds: 33,
      score: 250,
    }, conn)
    expect(gameRepo.insertUserGame).toHaveBeenCalledWith(101, 11, null, 'Luis', conn)
    expect(conn.commit).toHaveBeenCalledOnce()
  })

  it('si no existe usuario principal en 1vs1 devuelve error de cliente y rollback', async () => {
    gameRepo.findUserIdByUsername.mockResolvedValueOnce(null)

    await expect(recordFinishedMatch({
      mode: '1vs1',
      boardSize: 8,
      turnNumber: 9,
      elapsedSeconds: 20,
      playerName: 'Desconocido',
      guestName: 'Luis',
      winner: 'guest',
    }, 100, { username: 'Desconocido' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Usuario no encontrado: Desconocido',
    })

    expect(conn.rollback).toHaveBeenCalledOnce()
  })

  it('rechaza 1vs1 si el token no coincide con el usuario principal', async () => {
    await expect(recordFinishedMatch({
      mode: '1vs1',
      boardSize: 8,
      turnNumber: 10,
      elapsedSeconds: 25,
      playerName: 'Ana',
      guestName: 'Luis',
      winner: 'player',
    }, 100, { username: 'Otra' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'El token no corresponde con playerName en 1vs1',
    })
  })

  it('normaliza winner/difficulty en 1vsbot y actualiza stats de usuario', async () => {
    gameRepo.findUserIdByUsername.mockResolvedValueOnce(77)
    gameRepo.findBotIdByDifficulty.mockResolvedValueOnce(5)

    const gameId = await recordFinishedMatch({
      mode: '1vsbot',
      boardSize: '10',
      turnNumber: '14',
      elapsedSeconds: '40',
      playerName: 'Ana',
      winner: 'player2',
      difficulty: 'Media',
      isDraw: false,
    }, 180, { username: 'Ana' })

    expect(gameId).toBe(101)
    expect(gameRepo.insertFinishedGame).toHaveBeenCalledWith({
      boardSize: 10,
      mode: '1vsbot',
      winner: 'bot',
      totalTurns: 14,
      elapsedSeconds: 40,
      score: 180,
    }, conn)
    expect(gameRepo.insertUserBotGame).toHaveBeenCalledWith(101, 77, 5, 'medio', conn)
    expect(gameRepo.updateUserBotStats).toHaveBeenCalledWith(77, 180, conn)
    expect(conn.commit).toHaveBeenCalledOnce()
  })

  it('rechaza dificultad invalida para 1vsbot', async () => {
    await expect(recordFinishedMatch({
      mode: '1vsbot',
      boardSize: 8,
      turnNumber: 14,
      elapsedSeconds: 40,
      playerName: 'Ana',
      winner: 'player',
      difficulty: 'imposible',
    }, 180, { username: 'Ana' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Dificultad inválida para 1vsbot',
    })

    expect(conn.rollback).toHaveBeenCalledOnce()
  })

  it('rechaza modo no soportado', async () => {
    await expect(recordFinishedMatch({
      mode: 'botvsbot',
      boardSize: 8,
      turnNumber: 10,
      elapsedSeconds: 15,
    }, 0, { username: 'Ana' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Modo de partida no soportado',
    })

    expect(conn.rollback).toHaveBeenCalledOnce()
  })
})
