import { describe, it, expect, vi, beforeEach } from 'vitest'


const { createUser, userRepo } = require('../services/userService')



describe('createUser', () => {

  beforeEach(() => {
    userRepo.getConnection = vi.fn().mockResolvedValue({ id: 'fake-connection' });
    userRepo.insertUser = vi.fn()
  })

  it('falta username → error', async () => {
    await expect(createUser()).rejects.toThrow('Username is required')
  })

  it('crea usuario correctamente', async () => {
    userRepo.insertUser.mockResolvedValue(7)

    const msg = await createUser('Pablo')

    expect(msg).toBe('Hello Pablo! Welcome to the course! User created with ID: 7')

    expect(userRepo.insertUser).toHaveBeenCalledWith(
      'Pablo',
      undefined,
      undefined,
      { id: 'fake-connection' }
    );
  })

  it('error en DB → error controlado', async () => {
    userRepo.insertUser.mockRejectedValue(new Error('DB fail'))

    await expect(createUser('Pablo')).rejects.toThrow('Database error: DB fail')
  })

})
