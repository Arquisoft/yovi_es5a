import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'

describe('POST /createuser - casos de error', () => {
  it('retorna 400 si falta username', async () => {
    const res = await request(app)
      .post('/createuser')
      .send({ password: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Faltan el usuario')
  })

  it('retorna 400 si falta password', async () => {
    const res = await request(app)
      .post('/createuser')
      .send({ username: 'a' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Faltan la contraseña')
  })

})