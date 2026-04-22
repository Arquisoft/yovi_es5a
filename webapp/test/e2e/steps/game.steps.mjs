import { register } from "../../../src/services/authApi.js";
import { Given, When, Then } from '@cucumber/cucumber'

const browserName = process.env.BROWSER || 'chromium'
const size = 6

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
    { q: 0, r: 6 },  // J2 - libre  ⚠️ verifica que esta celda existe en size=6
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

})

When('I play a game against the medium bot', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('#gameMode', { timeout: 10000 })
  await page.selectOption('#gameMode', '1vsbot');
  await page.fill('#boardSize', `${size}`);
  await page.click('.startButton')
})

Then('I should see the victory menu', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('div.victoryCard', { state: 'visible', timeout: 10000 })
  const v1 = await page.locator('div.victoryCard').isVisible()
})