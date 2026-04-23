import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'

describe('POST /auth/register - cobertura de errores y catch', () => {

  it('retorna 400 si faltan datos', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ username: 'a', password: '123' }) // falta confirmPassword

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Faltan datos')
  })

  it('retorna 400 si passwords no coinciden', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ username: 'a', password: '123', confirmPassword: '321' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Las contraseñas no coinciden')
  })

})