import { describe, it, expect, vi, afterEach } from 'vitest'
const mysql = require('mysql2/promise')

function loadFreshDbModule() {
  delete require.cache[require.resolve('../db')]
  return require('../db')
}

describe('db.getConnection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete require.cache[require.resolve('../db')]
  })

  
  it('crea conexion una vez y la reutiliza', async () => {
    const createConnection = vi.spyOn(mysql, 'createConnection').mockResolvedValue({ id: 'conn-1' })

    const { getConnection } = loadFreshDbModule()

    const conn1 = await getConnection()
    const conn2 = await getConnection()

    expect(createConnection).toHaveBeenCalledTimes(1)
    expect(conn2).toBe(conn1)
  })

  it('reintenta conexion cuando mysql aun no esta listo', async () => {
    const createConnection = vi.spyOn(mysql, 'createConnection')
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValueOnce({ id: 'conn-2' })

    vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback()
      return 0
    })

    const { getConnection } = loadFreshDbModule()

    const conn = await getConnection()

    expect(conn).toEqual({ id: 'conn-2' })
    expect(createConnection).toHaveBeenCalledTimes(2)
  })
})
