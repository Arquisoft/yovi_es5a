import { register } from "../../../src/services/authApi.js";
import { Given, When, Then } from '@cucumber/cucumber'

const browserName = process.env.BROWSER || 'chromium'
const size = 6

async function playToWin(page, size) {
  const occupiedByUs = new Set();
  let isFirstMove = true;

  // --- DEFINICIÓN DE BORDES (Según tus datos) ---
  const bordes = {
    izquierdo: ["0,1", "1,1", "2,1", "3,1", "4,1", "5,0"],
    derecho: ["0,6", "1,5", "2,4", "3,3", "4,2", "5,0"],
    base: ["0,1", "0,2", "0,3", "0,4", "0,5", "0,6"]
  };

  // --- LÓGICA DE VECINDAD (Basada en tus ejemplos) ---
  function getNeighbors(q, r) {
    // Aplicando el patrón que describiste para (1,3) y (3,2)
    // El patrón detectado es: (q-1, r), (q-1, r+1), (q, r+1), (q, r-1), (q+1, r-1), (q+1, r)
    return [
      { q: q - 1, r: r },
      { q: q - 1, r: r + 1 },
      { q: q, r: r + 1 },
      { q: q, r: r - 1 },
      { q: q + 1, r: r - 1 },
      { q: q + 1, r: r }
    ];
  }

  async function tryClick(q, r) {
    try {
      const cell = page.locator(`[data-testid="cell-${q}-${r}"]`);
      // Forzamos la espera de que sea clicable
      await cell.click({ timeout: 2000 });
      await page.waitForTimeout(600); 
      return true;
    } catch (e) {
      return false;
    }
  }

  async function readBoardState() {
    // Obtenemos todas las celdas y su estado de una sola vez
    const cells = await page.$$eval('[data-testid^="cell-"]', elements => {
      return elements.map(el => ({
        id: el.getAttribute('data-testid'),
        state: el.getAttribute('data-state')
      }));
    });

    const board = {};
    for (const c of cells) {
      const [, q, r] = c.id.split('-').map(Number);
      const key = `${q},${r}`;
      if (occupiedByUs.has(key)) board[key] = 'us';
      else if (c.state !== 'empty' && c.state !== null) board[key] = 'bot';
      else board[key] = 'empty';
    }
    return board;
  }

  function calculateDistances(board, targetEdgeKeys) {
    const dist = {};
    const queue = [];

    // Inicializar distancias
    for (const key in board) {
      if (targetEdgeKeys.includes(key)) {
        if (board[key] === 'us') {
          dist[key] = 0;
          queue.push(key);
        } else if (board[key] === 'empty') {
          dist[key] = 1;
          queue.push(key);
        } else {
          dist[key] = Infinity;
        }
      } else {
        dist[key] = Infinity;
      }
    }

    // Dijkstra / BFS pesado
    let head = 0;
    while (head < queue.length) {
      const currentKey = queue[head++];
      const [q, r] = currentKey.split(',').map(Number);
      
      for (const neighbor of getNeighbors(q, r)) {
        const nKey = `${neighbor.q},${neighbor.r}`;
        if (board[nKey] === undefined || board[nKey] === 'bot') continue;

        const weight = board[nKey] === 'us' ? 0 : 1;
        const newDist = dist[currentKey] + weight;

        if (newDist < dist[nKey]) {
          dist[nKey] = newDist;
          queue.push(nKey);
        }
      }
    }
    return dist;
  }

  // --- BUCLE PRINCIPAL ---
  while (!(await page.locator('div.victoryCard').isVisible())) {
    
    // 1. PRIMER MOVIMIENTO OBLIGATORIO (1,3)
    if (isFirstMove) {
      const success = await tryClick(1, 3);
      if (success) {
        occupiedByUs.add("1,3");
        isFirstMove = false;
        continue;
      }
      isFirstMove = false;
    }

    const board = await readBoardState();
    
    // 2. CALCULAR DISTANCIAS A CADA LADO
    const dIzq = calculateDistances(board, bordes.izquierdo);
    const dDer = calculateDistances(board, bordes.derecho);
    const dBase = calculateDistances(board, bordes.base);

    let bestMove = null;
    let minScore = Infinity;

    // 3. ENCONTRAR LA MEJOR CASILLA (La que conecta mejor los 3 lados)
    for (const key in board) {
      if (board[key] !== 'empty') continue;

      const score = (dIzq[key] || 99) + (dDer[key] || 99) + (dBase[key] || 99);
      
      if (score < minScore) {
        minScore = score;
        bestMove = key;
      }
    }

    if (bestMove) {
      const [q, r] = bestMove.split(',').map(Number);
      if (await tryClick(q, r)) {
        occupiedByUs.add(bestMove);
      }
    } else {
      // Fallback: clic en cualquier lugar si el camino está bloqueado
      const firstEmpty = Object.keys(board).find(k => board[k] === 'empty');
      if (firstEmpty) {
        const [q, r] = firstEmpty.split(',').map(Number);
        await tryClick(q, r);
        occupiedByUs.add(firstEmpty);
      } else break;
    }
  }
}

Given('I register the user {string} and the start game form page is open', async function (user) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto(`http://localhost/`)
  const email = `test4+${user}+${browserName}@example.com`
  const username = `test4+${user}+${browserName}`
  const password = "PrUeBa"
  await register({ 
    email: email, 
    username: username, 
    password: password, 
    confirmPassword: password })
  await page.fill('#identifier', username)
  await page.fill('#loginPassword', password)
  await page.click('.authSubmit')
})

When('I play a game against the local player', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('#gameMode', { timeout: 10000 })
  await page.fill('#boardSize', `${size}`);
  await page.fill('#guestName', "local_player")
  await page.click('.startButton')

  await page.waitForSelector('[data-testid^="cell-"]', { timeout: 10000 })

  const moves = [
    { q: 5, r: 0 },  // J1 - punta
    { q: 0, r: 2 },  // J2 - libre
    { q: 4, r: 1 },  // J1
    { q: 0, r: 3 },  // J2 - libre
    { q: 3, r: 1 },  // J1
    { q: 0, r: 4 },  // J2 - libre
    { q: 2, r: 1 },  // J1
    { q: 0, r: 5 },  // J2 - libre
    { q: 1, r: 1 },  // J1
    { q: 0, r: 6 },  // J2 - libre - verifica que esta celda existe en size=6
    { q: 0, r: 1 },  // J1 - esquina inferior → GANA
  ];

  for (const { q, r } of moves) {
    await page.click(`[data-testid="cell-${q}-${r}"]`);
    await page.waitForTimeout(300);
  }
})

When('I play a game against the easy bot', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('#gameMode', { timeout: 10000 })
  await page.selectOption('#gameMode', '1vsbot');
  await page.fill('#boardSize', `${size}`);
  await page.click('.startButton')
  await page.waitForSelector('[data-testid^="cell-"]', { timeout: 10000 })
  await playToWin(page, size)
})

When('I play a game against the medium bot', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('#gameMode', { timeout: 10000 })
  await page.selectOption('#gameMode', '1vsbot');
  await page.fill('#boardSize', `${size}`);
  await page.selectOption('#difficulty', 'Media');
  await page.click('.startButton')
  await page.waitForSelector('[data-testid^="cell-"]', { timeout: 10000 })
  await playToWin(page, size)
})

Then('I should see the victory menu', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('div.victoryCard', { state: 'visible', timeout: 10000 })
  const v1 = await page.locator('div.victoryCard').isVisible()
})