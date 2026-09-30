import { test } from '@playwright/test'

test('app loads and dashboard renders', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.topbar', { timeout: 15_000 })
  await page.screenshot({ path: 'e2e/screenshots/dashboard.png', fullPage: true })
})
