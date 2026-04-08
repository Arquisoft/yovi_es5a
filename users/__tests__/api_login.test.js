import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'


describe('POST /auth/login - casos de error', () => {
  it('retorna 400 si faltan datos', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'user' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Faltan datos')
  })

  it('retorna 400 si usuario no existe', async () => {
    const userService = require('../services/userService')
    vi.spyOn(userService, 'resolveUserByExactUsername').mockResolvedValue(null)

    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'user', password: '123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Usuario no encontrado')
  })

  it('retorna 400 si contraseña incorrecta', async () => {
    const userService = require('../services/userService')
    vi.spyOn(userService, 'resolveUserByExactUsername').mockResolvedValue({ id: 1, username: 'a', password: 'hash' })

    const bcrypt = require('bcrypt')
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false)

    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'a', password: '123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Usuario o Contraseña incorrecta')
  })

  it('lanza error natural al pasar password no string', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'user', password: 12345 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })
})