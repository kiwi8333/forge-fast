import { expect, test } from '@playwright/test'

const KEY = 'forge-fast:state'
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString()

// Puts saved data in place before the app loads.
async function seed(page, data) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify(data)])
}

const runningFast = (hours) => ({
  version: 1,
  fasting: { planId: '16:8', customHours: 16, active: { startedAt: hoursAgo(hours), targetHours: 16, planId: '16:8' }, logs: [] },
  bodyweight: [],
  settings: { units: 'kg', theme: 'system', window: null },
})

test('starts a fast and keeps it after a reload', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /Start 16h fast/ }).click()
  await expect(page.getByRole('button', { name: 'End fast' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'End fast' })).toBeVisible()
})

test('ending a long fast saves it, earns badges and asks how it went', async ({ page }) => {
  await seed(page, runningFast(18.5))
  await page.goto('./')
  await page.getByRole('button', { name: 'End fast' }).click()
  await page.locator('dialog[open]').getByRole('button', { name: 'End fast' }).click()
  await expect(page.getByText(/Badge earned/)).toBeVisible()
  await expect(page.getByText('How did it go?')).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('heading', { name: 'Badges' })).toBeVisible()
})

test('the Start fast shortcut starts a fast', async ({ page }) => {
  await page.goto('./#/?do=start')
  await expect(page.getByRole('button', { name: 'End fast' })).toBeVisible()
})

test('settings: pounds and theme stick', async ({ page }) => {
  await page.goto('./#/settings')
  await page.getByRole('radio', { name: 'lb' }).click()
  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.getByRole('radio', { name: 'lb' })).toHaveAttribute('aria-checked', 'true')
})

test('corrupt saved data does not crash the app', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{broken'), KEY)
  await page.goto('./')
  await expect(page.getByRole('button', { name: /Start .* fast/ })).toBeVisible()
})
