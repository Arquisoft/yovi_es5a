import { describe, it, expect, vi, beforeEach } from 'vitest'


const conn = {
  execute: vi.fn(),
}

vi.mock('../db', () => ({
  getConnection: vi.fn().mockResolvedValue(conn)
}))

const userDb = require('../userDb')

describe('userDb queries', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('findUserByUsernameExact normaliza y encuentra', async () => {
    conn.execute.mockResolvedValueOnce([[{
      id: 1,
      username: 'Ana',
      best_score: null,
      total_games_1vsbot: null
    }]])

    const user = await userDb.findUserByUsernameExact('  AnA  ', conn)

    expect(user.id).toBe(1)
    expect(user.username).toBe('Ana')
    expect(conn.execute.mock.calls[0][1]).toEqual(['ana'])
  })

  it('findUserByUsernameExact devuelve null', async () => {
    conn.execute.mockResolvedValueOnce([[]])

    const user = await userDb.findUserByUsernameExact('ghost', conn)

    expect(user).toBeNull()
  })

  it('findUserByEmailExact normaliza email', async () => {
    conn.execute.mockResolvedValueOnce([[{
      id: 2,
      username: 'bob',
      email: 'test@ejemplo.com'
    }]])

    const user = await userDb.findUserByEmailExact('  TeSt@EjEmPlO.cOm  ', conn)

    expect(user.email).toBe('test@ejemplo.com')
    expect(conn.execute.mock.calls[0][1]).toEqual(['test@ejemplo.com'])
  })

  it('findUserByEmailExact devuelve null', async () => {
    conn.execute.mockResolvedValueOnce([[]])

    const user = await userDb.findUserByEmailExact('ghost@test.com', conn)

    expect(user).toBeNull()
  })
  it('debe insertar un usuario y retornar el insertId', async () => {
    // mysql2 retorna [result, fields], por eso el array con el objeto y luego otro array vacío
    conn.execute.mockResolvedValueOnce([{ insertId: 99 }, []]);

    // Usamos userDb.insertUser porque es el objeto que importamos
    const id = await userDb.insertUser('testuser', 'test@mail.com', 'pass123', conn);

    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['testuser', 'test@mail.com', 'pass123']
    );
    expect(id).toBe(99);
  });

  it('debe lanzar un error si la query de inserción falla', async () => {
    conn.execute.mockRejectedValueOnce(new Error('Query Error'));

    await expect(userDb.insertUser('a', 'b', 'c', conn))
      .rejects.toThrow('Query Error');
  });

  it('debe retornar la lista de usuarios', async () => {
    const mockRows = [
      { id: 1, username: 'user1' },
      { id: 2, username: 'user2' }
    ];
    // mysql2 retorna [rows, fields]
    conn.execute.mockResolvedValueOnce([mockRows, []]);

    const users = await userDb.getUsersFromDB(conn);

    expect(conn).toBeDefined(); 
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, username')
    );
    expect(users).toEqual(mockRows);
    expect(users).toHaveLength(2);
  });

  
  it('debe manejar errores al obtener usuarios (catch)', async () => {
    conn.execute.mockRejectedValueOnce(new Error('Read Error'));

    await expect(userDb.getUsersFromDB(conn))
      .rejects.toThrow('Read Error');
  });


})