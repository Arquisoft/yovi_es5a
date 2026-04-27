import assert from 'assert'
import { register } from "../../../src/services/authApi.js";
import { Given, When, Then } from '@cucumber/cucumber'

const browserName = process.env.BROWSER || 'chromium'

const STEP_TIMEOUT = 60_000

Given('The users page is open', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto(`http://localhost:5173`)
  const email    = `test3+${browserName}@example.com`
  const username = `test3+${browserName}`
  const password = "PrUeBa"
  await register({
    email, username, password, confirmPassword: password
  })
  await new Promise(r => setTimeout(r, 1000))
  await page.fill('#identifier', username)
  await page.fill('#loginPassword', password)
  await page.click('.authSubmit')
  await page.waitForSelector('div.homeActions', { timeout: STEP_TIMEOUT })
  await page.click('a.primaryLinkButton')
})

When('I select a specific user', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('div.tableWrap', { timeout: STEP_TIMEOUT })
  await page.getByRole('link', { name: `test3+${browserName}` }).click()
})

Then('I should see his game historial and global score', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('div.tableWrap', { state: 'visible', timeout: STEP_TIMEOUT })
  await page.waitForSelector(
    'text=Este usuario no tiene partidas.',
    { state: 'visible', timeout: STEP_TIMEOUT }
  )
  const v1       = await page.locator('div.tableWrap').isVisible()
  const noMatches = await page.getByText('Este usuario no tiene partidas.').isVisible()
  assert.ok(v1,        'La tabla de usuarios no es visible')
  assert.ok(noMatches, 'El mensaje de usuario sin partidas no es visible')
})
