import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'assert'

Given('The register page is open', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto(`http://localhost:5173`)
  await page.getByTestId("tab-register").click();
})

When('I enter a specific username, {string} as the password and submit the register form', async function (password) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  const browserName = process.env.BROWSER || 'chromium'
  const username = `test+${browserName}`
  await page.fill('#registerUsername', username)
  await page.fill('#registerPassword', password)
  await page.fill('#registerPasswordRepeat', password)
  await page.click('.registerSubmit')
})

Then('I should see a message containing {string}', async function (expected) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('.successMessage', { timeout: 10000 })
  const text = await page.textContent('.successMessage')
  assert.ok(text && text.includes(expected), `Expected success message to include "${expected}", got: "${text}"`)
}) 