import { setWorldConstructor, Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium, firefox, webkit } from 'playwright'

setDefaultTimeout(120_000)

class CustomWorld {
  browser = null
  page = null
}

setWorldConstructor(CustomWorld)

Before(async function () {
  const browserName = process.env.BROWSER || 'chromium'

  let browserType
  switch (browserName) {
    case 'firefox':
      browserType = firefox
      break
    case 'webkit':
      browserType = webkit
      break
    default:
      browserType = chromium
  }

  const headless = true
  const slowMo = 0
  const devtools = false


  this.browser = await browserType.launch({ headless, slowMo, devtools })
  this.page = await this.browser.newPage()
})

After(async function () {
  if (this.page) await this.page.close()
  if (this.browser) await this.browser.close()
})

