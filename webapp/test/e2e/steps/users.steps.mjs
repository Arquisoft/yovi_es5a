import { Given, When, Then } from '@cucumber/cucumber'
import { register } from "../../../src/services/authApi.js";
import assert from 'assert'

const browserName = process.env.BROWSER || 'chromium'

Given('The users page is open', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.goto(`http://localhost:5173`)

  const email = `test3+${browserName}@example.com`
  const username = `test3+${browserName}`
  const password = "PrUeBa"

  await register({ 
    email, username, password, confirmPassword: password 
  })
  await new Promise(r => setTimeout(r, 1000))
  await page.fill('#identifier', username)
  await page.fill('#loginPassword', password)
  await page.click('.authSubmit')

  await page.waitForSelector('#gameMode', { timeout: 15000 })
  const scoresLink = page.getByRole('link', { name: 'Ver puntuaciones' });
  await scoresLink.waitFor({ state: 'visible' });
  await scoresLink.click();

})

When('I select a specific user', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.waitForSelector('div.tableWrap', { state: 'visible' })
  
  await page.getByRole('link', { name: `test3+${browserName}` }).click()
})

Then('I should see his game historial and global score', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.waitForSelector('div.tableWrap', { state: 'visible', timeout: 10000 })

  await page.waitForSelector(
    'text=Este usuario no tiene partidas.', 
    { state: 'visible', timeout: 10000 }
  )

  const v1 = await page.locator('div.tableWrap').isVisible()
  const noMatches = await page.getByText('Este usuario no tiene partidas.').isVisible()

  assert.ok(v1, 'La tabla de usuarios no es visible')
  assert.ok(noMatches, 'El mensaje de usuario sin partidas no es visible')
})