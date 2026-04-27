import { register } from "../../../src/services/authApi.js";
import { Given, When, Then } from '@cucumber/cucumber'

const browserName = process.env.BROWSER || 'chromium'
const size = 6

// Timeouts adaptados para CI (runners más lentos que local)
const STEP_TIMEOUT    = 60_000   // espera de selector/función individual
const BOT_WAIT        = 3_000    // tiempo que se le da al bot para responder entre turnos
const CELL_WAIT       = 8_000    // espera de confirmación de click en celda

async function playToWin(page, size) {
  const occupiedByUs = new Set();
  let isFirstMove = true;

  const bordes = {
    izquierdo: ["0,1", "1,1", "2,1", "3,1", "4,1", "5,0"],
    derecho:   ["0,6", "1,5", "2,4", "3,3", "4,2", "5,0"],
    base:      ["0,1", "0,2", "0,3", "0,4", "0,5", "0,6"]
  };

  function getNeighbors(q, r) {
    return [
      { q: q - 1, r: r },
      { q: q - 1, r: r + 1 },
      { q: q,     r: r + 1 },
      { q: q,     r: r - 1 },
      { q: q + 1, r: r - 1 },
      { q: q + 1, r: r }
    ];
  }

  async function tryClick(q, r) {
    try {
      await page.waitForSelector(`[data-testid="cell-${q}-${r}"]`, { timeout: STEP_TIMEOUT });
      const cell = page.locator(`[data-testid="cell-${q}-${r}"]`);
      await cell.click({ timeout: STEP_TIMEOUT });
      await page.waitForFunction(
        ([tq, tr]) => {
          const el = document.querySelector(`[data-testid="cell-${tq}-${tr}"]`);
          return el != null && el.getAttribute('data-state') !== 'empty';
        },
        [q, r],
        { timeout: CELL_WAIT }
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  async function readBoardState() {
    const cells = await page.$$eval('[data-testid^="cell-"]', elements => {
      return elements.map(el => ({
        id:    el.getAttribute('data-testid'),
        state: el.getAttribute('data-state')
      }));
    });

    const board = {};
    for (const c of cells) {
      const [, q, r] = c.id.split('-').map(Number);
      const key = `${q},${r}`;
      if (occupiedByUs.has(key))               board[key] = 'us';
      else if (c.state !== 'empty' && c.state !== null) board[key] = 'bot';
      else                                      board[key] = 'empty';
    }
    return board;
  }

  function calculateDistances(board, targetEdgeKeys) {
    const dist  = {};
    const queue = [];

    for (const key in board) {
      if (targetEdgeKeys.includes(key)) {
        if      (board[key] === 'us')    { dist[key] = 0;        queue.push(key); }
        else if (board[key] === 'empty') { dist[key] = 1;        queue.push(key); }
        else                             { dist[key] = Infinity; }
      } else {
        dist[key] = Infinity;
      }
    }

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

  while (!(await page.locator('div.victoryCard').isVisible())) {

    if (isFirstMove) {
      const success = await tryClick(1, 3);
      if (success) {
        occupiedByUs.add("1,3");
        isFirstMove = false;
        await page.waitForTimeout(BOT_WAIT);
        continue;
      }
      isFirstMove = false;
    }

    const board = await readBoardState();

    const dIzq  = calculateDistances(board, bordes.izquierdo);
    const dDer  = calculateDistances(board, bordes.derecho);
    const dBase = calculateDistances(board, bordes.base);

    let bestMove = null;
    let minScore = Infinity;

    for (const key in board) {
      if (board[key] !== 'empty') continue;
      const score = (dIzq[key] ?? 99) + (dDer[key] ?? 99) + (dBase[key] ?? 99);
      if (score < minScore) { minScore = score; bestMove = key; }
    }

    if (bestMove) {
      const [q, r] = bestMove.split(',').map(Number);
      if (await tryClick(q, r)) {
        occupiedByUs.add(bestMove);
        await page.waitForTimeout(BOT_WAIT);
      }
    } else {
      const firstEmpty = Object.keys(board).find(k => board[k] === 'empty');
      if (firstEmpty) {
        const [q, r] = firstEmpty.split(',').map(Number);
        if (await tryClick(q, r)) {
          occupiedByUs.add(firstEmpty);
          await page.waitForTimeout(BOT_WAIT);
        }
      } else break;
    }
  }
}

Given('I register the user {string} and the start game form page is open', async function (user) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto(`http://localhost:5173`)
  const email    = `test4+${user}+${browserName}@example.com`
  const username = `test4+${user}+${browserName}`
  const password = "PrUeBa"
  await register({
    email,
    username,
    password,
    confirmPassword: password
  })
  await new Promise(r => setTimeout(r, 1000))
  await page.fill('#identifier', username)
  await page.fill('#loginPassword', password)
  await page.click('.authSubmit')
  await page.waitForSelector('#gameMode', { timeout: STEP_TIMEOUT })
})

When('I play a game against the local player', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('#gameMode', { timeout: STEP_TIMEOUT })
  await page.fill('#boardSize', `${size}`);
  await page.fill('#guestName', "local_player")
  await page.click('.startButton')

  await page.waitForSelector('[data-testid^="cell-"]', { timeout: STEP_TIMEOUT })

  const moves = [
    { q: 5, r: 0 },
    { q: 0, r: 2 },
    { q: 4, r: 1 },
    { q: 0, r: 3 },
    { q: 3, r: 1 },
    { q: 0, r: 4 },
    { q: 2, r: 1 },
    { q: 0, r: 5 },
    { q: 1, r: 1 },
    { q: 0, r: 6 },
    { q: 0, r: 1 },
  ];

  for (const { q, r } of moves) {
    await page.waitForFunction(
      ([tq, tr]) => {
        const el    = document.querySelector(`[data-testid="cell-${tq}-${tr}"]`);
        const state = el ? el.getAttribute('data-state') : null;
        return el != null && (state === 'empty' || !state);
      },
      [q, r],
      { timeout: STEP_TIMEOUT }
    );
    const cell = page.locator(`[data-testid="cell-${q}-${r}"]`);
    await cell.click({ force: true });

    await page.waitForFunction(
      ([tq, tr]) => {
        const el = document.querySelector(`[data-testid="cell-${tq}-${tr}"]`);
        return el != null && el.getAttribute('data-state') !== 'empty';
      },
      [q, r],
      { timeout: STEP_TIMEOUT }
    );
  }
})

When('I play a game against the easy bot', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('#gameMode', { timeout: STEP_TIMEOUT })
  await page.selectOption('#gameMode', '1vsbot');
  await page.fill('#boardSize', `${size}`);
  await page.click('.startButton')
  await page.waitForSelector('[data-testid^="cell-"]', { timeout: STEP_TIMEOUT })
  await playToWin(page, size)
})

When('I play a game against the medium bot', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('#gameMode', { timeout: STEP_TIMEOUT })
  await page.selectOption('#gameMode', '1vsbot');
  await page.fill('#boardSize', `${size}`);
  await page.selectOption('#difficulty', 'Media');
  await page.click('.startButton')
  await page.waitForSelector('[data-testid^="cell-"]', { timeout: STEP_TIMEOUT })
  await playToWin(page, size)
})

When('I play a game against the hard bot', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('#gameMode', { timeout: STEP_TIMEOUT })
  await page.selectOption('#gameMode', '1vsbot');
  await page.fill('#boardSize', `${size}`);
  await page.selectOption('#difficulty', 'Dificil');
  await page.click('.startButton')
  await page.waitForSelector('[data-testid^="cell-"]', { timeout: STEP_TIMEOUT })
  await playToWin(page, size)
})

Then('I should see the victory menu', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('div.victoryCard', { state: 'visible', timeout: STEP_TIMEOUT })
  const v1 = await page.locator('div.victoryCard').isVisible()
})
