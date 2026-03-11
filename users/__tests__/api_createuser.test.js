import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { createUser, userRepo } = require('../services/userService')

import app from '../users-service.js'

describe('POST /createuser', () => {

  beforeEach(() => {
    userRepo.insertUser = vi.fn().mockResolvedValue(7)
  })
  it('crea usuario y devuelve mensaje', async () => {
    const res = await request(app)
      .post('/createuser')
      .send({ username: 'Pablo' })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/Hello Pablo/)
    expect(userRepo.insertUser).toHaveBeenCalledWith('Pablo')
  })
})