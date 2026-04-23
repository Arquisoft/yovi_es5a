import { Given, When, Then } from '@cucumber/cucumber'
import { register } from "../../../src/services/authApi.js";
import assert from 'assert'

Given('The authentication page is open', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto('http://localhost:5173')
  const browserName = process.env.BROWSER || 'chromium'
  const email = `test2+${browserName}@example.com`
  const username = `test2+${browserName}`
  const password = "PrUeBa"
  await register({ 
    email: email, 
    username: username, 
    password: password, 
    confirmPassword: password })
})

When('I enter a specific username, {string} as the password and submit', async function (password) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  const browserName = process.env.BROWSER || 'chromium'
  const username = `test2+${browserName}`
  await page.fill('#identifier', username)
  await page.fill('#loginPassword', password)
  await page.click('.authSubmit')
})

Then('I should see the home page', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('form.startGameForm', { timeout: 10000 })
  const v1 = await page.locator('form.startGameForm').isVisible()
  assert.ok(v1, 'El formulario no está visible')
  const v2 = await page.locator('div.homeHero').isVisible()
  assert.ok(v2, 'El usuario no está visible')
}) 