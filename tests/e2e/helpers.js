import { expect } from '@playwright/test'

// Dev-only hook exposed by DevPanel (never in production builds). Page tours start as already seen so
// their overlay never blocks a journey; pass { tours: true } to let them auto-run.
export async function useScenario(page, scenario, path = '/', { tours = false } = {}) {
  await page.goto('/register')
  await page.waitForFunction(() => window.__ruangkpr)
  await page.evaluate(
    ([s, t]) => {
      window.__ruangkpr.reset(s)
      if (!t) window.__ruangkpr.seeAllTours()
    },
    [scenario, tours],
  )
  await page.goto(path)
}

export const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 mock') })

// From the register page: one browser keeps every account, so this signs into (or creates) the contact's account.
export async function signIn(page, name, contact) {
  await page.getByLabel('Nama Lengkap').fill(name)
  await page.getByLabel('No. WhatsApp / Email').fill(contact)
  await page.getByRole('checkbox', { name: /Syarat & Ketentuan/ }).check()
  await page.getByRole('checkbox', { name: /Kebijakan Privasi/ }).check()
  await page.getByRole('button', { name: 'Daftar' }).click()
  await page.getByLabel('Digit 1 dari 6').fill('148260')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page).not.toHaveURL(/\/(register|verify)$/)
}

export async function fillMoney(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value))
}

export async function expectNoSecondary(page) {
  await expect(page.locator('body')).not.toContainText(/secondary/i)
}
