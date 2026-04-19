import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'

describe('POST /createuser - casos de error', () => {
  it('retorna 400 si falta username', async () => {
    const res = await request(app)
      .post('/createuser')
      .send({ email: 'a@a.com', password: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Missing username')
  })

  it('retorna 400 si falta email', async () => {
    const res = await request(app)
      .post('/createuser')
      .send({ username: 'a', password: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Missing email')
  })

  it('retorna 400 si falta password', async () => {
    const res = await request(app)
      .post('/createuser')
      .send({ username: 'a', email: 'a@a.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Missing password')
  })

  it('retorna 400 si email ya existe', async () => {
    // mockea userService para que devuelva algo
    const userService = require('../services/userService')
    vi.spyOn(userService, 'resolveUserByExactEmail').mockResolvedValue({ id: 1 })

    const res = await request(app)
      .post('/createuser')
      .send({ username: 'a', email: 'a@a.com', password: '123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Email already registered')
  })

  it('lanza error natural al pasar datos no esperados', async () => {
    const res = await request(app)
      .post('/createuser')
      .send({ username: 123, email: 'a@a.com', password: '123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })
})