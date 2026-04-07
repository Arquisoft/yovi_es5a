import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

describe('POST /createuser', () => {
  let app;
  let userService;

  beforeEach(async () => {
    // 1. Limpiamos el caché de módulos para forzar re-importación con mocks
    vi.resetModules();

    // 2. MOCK DE LA BASE DE DATOS (Ruta exacta)
    vi.doMock('../db', () => ({
      getConnection: vi.fn().mockResolvedValue({
        execute: vi.fn().mockResolvedValue([[]]),
        release: vi.fn(),
        end: vi.fn()
      })
    }));

    // 3. MOCK DE LOS SERVICIOS QUE NO USAMOS (Para evitar que despierten la DB)
    vi.doMock('../services/scoreService', () => ({}));
    vi.mock('../services/gameService', () => ({}));
    vi.mock('../services/leaderboardService', () => ({}));

    // 4. MOCK DEL SERVICIO QUE SÍ USAMOS
    vi.doMock('../services/userService', () => ({
      resolveUserByExactEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue(7),
      resolveUserByExactUsername: vi.fn(),
      getUserByUsername: vi.fn(),
      userRepo: { insertUser: vi.fn() }
    }));

    // 5. CARGA DINÁMICA: Importamos la app y el servicio AQUÍ
    // Esto garantiza que los mocks de arriba ya existan en Vitest
    const userApp = await import('../users-service.js');
    app = userApp.default;
    userService = await import('../services/userService');
  });

  it('crea usuario y devuelve mensaje sin timeout', async () => {
    const res = await request(app)
      .post('/createuser')
      .send({
        username: 'Pablo',
        email: 'p@p.com',
        password: '123'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Usuario creado correctamente/);
    expect(userService.createUser).toHaveBeenCalled();
  });
});