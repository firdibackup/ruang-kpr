import { expect, test } from '@playwright/test'
import { pdf, useScenario } from './helpers'

const save = (page) => page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

test('monitoring: 3-step reminder setup (fixed + perkiraan) → active dashboard → payment → amortization; no application created', async ({ page }) => {
  await useScenario(page, 'fresh', '/')
  await page.getByRole('link', { name: /Pantau KPR Saya/ }).click()
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/1/)
  await expect(page.getByText('Bagian 1 dari 3 · KPR kamu')).toBeVisible()
  await expect(page.getByText('10% selesai.')).toBeAttached()

  await page.getByLabel('Bank').selectOption('Bank ABC')
  await page.getByLabel('Cicilan per bulan').fill('4127324')
  await page.getByLabel('Jatuh tempo setiap tanggal').fill('22')
  await save(page)

  await expect(page).toHaveURL(/setup\/2/)
  await expect(page.getByText('45% selesai.')).toBeAttached()
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  // A past end date means the rate is already floating: one tap fixes the answer.
  await page.getByLabel('Fixed berakhir').fill('2026-09-01')
  await expect(page.getByText('Tanggal ini sudah lewat, berarti bunga kamu sudah floating.')).toBeVisible()
  await page.getByRole('button', { name: 'Pilih Sudah floating' }).click()
  await expect(page.getByRole('radio', { name: /Sudah floating/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  await page.getByLabel('Fixed berakhir').fill('2026-12-22')
  await page.getByRole('button', { name: /Mau tahu perkiraan cicilan setelah fixed/ }).click()
  await page.getByLabel('Bunga sekarang').fill('5,50')
  await page.getByLabel('Sisa tenor').fill('15')
  await page.getByLabel('Tambahan bulan').fill('3')
  await page.getByLabel('Perkiraan bunga floating').fill('9,00')
  await expect(page.getByText(/Cicilan bisa naik jadi/)).toBeVisible()
  await save(page)

  await expect(page).toHaveURL(/setup\/3/)
  await expect(page.getByText('Yang akan kami ingatkan')).toBeVisible()
  await expect(page.getByText('85 hari lagi', { exact: true })).toBeVisible()
  await expect(page.getByText('Cicilan setelah fixed')).toBeVisible()
  const payment = page.getByRole('group', { name: 'Pembayaran bulanan' })
  await expect(payment.getByRole('checkbox', { name: 'H-7' })).toHaveAttribute('aria-checked', 'true')
  await expect(payment.getByRole('checkbox', { name: 'Hari-H' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('group', { name: 'Masa fixed berakhir' }).getByRole('checkbox', { name: 'H-90' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('checkbox', { name: /WhatsApp/ })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('checkbox', { name: 'Data yang saya masukkan benar' }).check()
  await page.getByRole('button', { name: 'Aktifkan Reminder' }).click()
  await expect(page.getByRole('heading', { name: 'Pemantauan KPR aktif' })).toBeVisible()
  await page.getByRole('link', { name: 'Lihat Dashboard' }).click()

  await expect(page.getByText('Fixed rate berakhir 85 hari lagi')).toBeVisible()
  await expect(page.locator('main canvas, main [data-chart]')).toHaveCount(0) // no charts on Home

  await page.goto('/my-kpr')
  await expect(page).toHaveURL(/my-kpr\/overview/) // no application was created
  await page.getByRole('tab', { name: 'Payment' }).click()
  await expect(page.getByText(/user-recorded/)).toBeVisible()
  await page.getByRole('button', { name: 'Tandai Sudah Dibayar' }).click()
  const markPaid = page.getByRole('dialog', { name: 'Tandai pembayaran' })
  await markPaid.locator('input[type=file]').setInputFiles(pdf('bukti-transfer.pdf'))
  await expect(markPaid.getByText('bukti-transfer.pdf')).toBeVisible()
  await markPaid.getByRole('button', { name: 'Simpan' }).click()
  await expect(markPaid).toHaveCount(0)
  await expect(page.getByText('bukti-transfer.pdf')).toBeVisible() // proof shows in history
  await page.getByRole('button', { name: 'Lihat Jadwal Amortisasi' }).click()
  await expect(page.getByText('Komposisi Pembayaran per Tahun')).toBeVisible()
  await page.getByRole('link', { name: 'Lihat Jadwal Lengkap' }).click()
  await expect(page.getByRole('columnheader', { name: 'Sisa Pokok' })).toBeVisible()
  await page.getByLabel('Tahun').selectOption('2027')
  await expect(page.getByText('Mulai periode floating — estimasi 9,00%')).toBeVisible()
})

test('warning & partial states: H-90 warning is first, partial rate shows no fake table', async ({ page }) => {
  await useScenario(page, 'mortgage_active_h90', '/')
  await expect(page.getByText('Peringatan bunga · H-90')).toBeVisible()
  await page.getByRole('button', { name: 'Lihat Pilihan' }).click()
  await expect(page).toHaveURL(/my-kpr\/rate/)
  await expect(page.getByText('estimasi').first()).toBeVisible()

  await useScenario(page, 'mortgage_partial_rate', '/my-kpr/amortization')
  await expect(page.getByText('Jadwal belum bisa dihitung lengkap.')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('explore without mortgage shows education only', async ({ page }) => {
  await useScenario(page, 'fresh', '/explore')
  await expect(page.getByText('Edukasi')).toBeVisible()
  await expect(page.getByRole('button', { name: /Take Over/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Multiguna/ })).toHaveCount(0)
})
