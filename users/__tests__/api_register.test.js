import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'

describe('POST /auth/register - cobertura de errores y catch', () => {

  it('retorna 400 si faltan datos', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@a.com', username: 'a', password: '123' }) // falta confirmPassword

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Missing registration data')
  })

  it('retorna 400 si passwords no coinciden', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@a.com', username: 'a', password: '123', confirmPassword: '321' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Passwords do not match')
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