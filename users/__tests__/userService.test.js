import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserByUsername, resolveUserByExactUsername, userRepo } = require('../services/userService')

describe('getUserByUsername y resolveUserByExactUsername', () => {

  beforeEach(() => {
    userRepo.getConnection = vi.fn().mockResolvedValue({ id: 'fake-connection' });
    
    userRepo.getUsersFromDB = vi.fn();
    userRepo.findUserByUsernameExact = vi.fn();
  });

  describe('getUserByUsername', () => {
    it('debe encontrar un usuario existente en la lista', async () => {
      const mockUsers = [
        { username: 'Pablo', id: 1 },
        { username: 'Maria', id: 2 }
      ];
      userRepo.getUsersFromDB.mockResolvedValue(mockUsers);

      const user = await getUserByUsername('Pablo');

      expect(user).toEqual(mockUsers[0]);
      expect(userRepo.getUsersFromDB).toHaveBeenCalledWith({ id: 'fake-connection' });
    });

    it('debe devolver undefined si el usuario no existe', async () => {
      userRepo.getUsersFromDB.mockResolvedValue([{ username: 'Maria' }]);
      const user = await getUserByUsername('Pablo');
      expect(user).toBeUndefined();
    });
  });

  describe('resolveUserByExactUsername', () => {
    it('debe normalizar el nombre y llamar al repositorio', async () => {
      const mockUser = { username: 'Pablo', id: 1 };
      userRepo.findUserByUsernameExact.mockResolvedValue(mockUser);

      const user = await resolveUserByExactUsername('  PABLO  ');

      expect(user).toEqual(mockUser);
      expect(userRepo.findUserByUsernameExact).toHaveBeenCalledWith('PABLO');
    });

    it('debe devolver null si el username es vacío', async () => {
      const user = await resolveUserByExactUsername('   ');
      expect(user).toBeNull();
      expect(userRepo.findUserByUsernameExact).not.toHaveBeenCalled();
    });
  });

});