import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'assert'

Given('The register page is open', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto(`http://localhost/`)

})

When('I enter a specific email and username, {string} as the password and submit', async function (password) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.getByTestId("tab-register").click();
  const browserName = process.env.BROWSER || 'chromium'
  const email = `test+${browserName}@example.com`
  const username = `test+${browserName}`
  await page.fill('#registerEmail', email)
  await page.fill('#registerUsername', username)
  await page.fill('#registerPassword', password)
  await page.fill('#registerPasswordRepeat', password)
  await page.click('.registerSubmit')
})

Then('I should see a message containing {string}', async function (expected) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.waitForSelector('.authSuccess', { timeout: 5000 })
  const text = await page.textContent('.authSuccess')
  assert.ok(text && text.includes(expected), `Expected success message to include "${expected}", got: "${text}"`)
}) 