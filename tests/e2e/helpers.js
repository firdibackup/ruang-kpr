import { expect } from '@playwright/test'

// Dev-only hook exposed by DevPanel (never in production builds).
export async function useScenario(page, scenario, path = '/') {
  await page.goto('/register')
  await page.waitForFunction(() => window.__ruangkpr)
  await page.evaluate((s) => window.__ruangkpr.reset(s), scenario)
  await page.goto(path)
}

export const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 mock') })

export async function fillMoney(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value))
}

export async function expectNoSecondary(page) {
  await expect(page.locator('body')).not.toContainText(/secondary/i)
}
