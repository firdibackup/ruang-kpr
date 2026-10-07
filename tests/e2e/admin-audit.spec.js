import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

test('the audit log shows who changed what and why, with the before and after values', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await page.getByLabel('Ukuran maksimal').fill('2')
  await page.getByRole('button', { name: 'Simpan batas unggah' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Batas bank mitra')
  await page.getByRole('button', { name: 'Ya, simpan' }).click()
  await expect(page.getByText('JPG, PNG, atau PDF · maks 2MB')).toBeVisible()

  await page.getByRole('link', { name: 'Audit Log' }).click()
  const entry = page.getByRole('list', { name: 'Log audit' }).getByRole('listitem').first()
  await expect(entry).toContainText('Ubah konfigurasi · Unggah dokumen')
  await expect(entry).toContainText('“Batas bank mitra”')
  await entry.getByText('Lihat detail').click()
  await expect(entry.getByRole('row', { name: /Ukuran maksimal/ })).toHaveText(/Ukuran maksimal\s*5\s*2/)
})
