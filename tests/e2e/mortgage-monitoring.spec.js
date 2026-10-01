import { expect, test } from '@playwright/test'
import { pdf, useScenario } from './helpers'

const save = (page) => page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

test('monitoring: 6-step setup (estimate branch) → active dashboard → payment → amortization; no application created', async ({ page }) => {
  await useScenario(page, 'fresh', '/')
  await page.getByRole('link', { name: /Pantau KPR Saya/ }).click()
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/1/)

  await page.getByLabel('Bank').selectOption('Bank ABC')
  await page.getByLabel('Jumlah pinjaman awal').fill('600000000')
  await page.getByLabel('Cicilan bulanan saat ini').fill('4127324')
  await page.getByLabel('Tenor awal').fill('240')
  await page.getByLabel('Tanggal akad').fill('2021-12-22')
  await page.getByLabel('Jatuh tempo setiap tanggal').fill('22')
  await page.getByRole('radio', { name: 'Tidak' }).click()
  await save(page)

  await expect(page).toHaveURL(/setup\/2/)
  // changed-payment branch requires official numbers and never offers the estimate
  await page.getByRole('radio', { name: 'Pernah berubah', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Hitung Kondisi KPR' })).toHaveCount(0)
  await save(page)
  await expect(page.getByText('Cicilan pernah berubah: isi sisa pokok resmi dari bank.')).toBeVisible()

  await page.getByRole('radio', { name: 'Belum pernah berubah' }).click()
  await page.getByLabel('Bunga saat ini', { exact: true }).fill('5,50')
  await page.getByRole('radio', { name: 'Fixed' }).click()
  await page.getByLabel('Masa fixed berakhir').fill('2026-12-22')
  await page.getByLabel('Estimasi bunga floating').fill('9,00')
  await page.getByRole('button', { name: 'Hitung Kondisi KPR' }).click()
  await expect(page.getByText('Estimasi kondisi KPR')).toBeVisible()
  await expect(page.getByText('5,50%').first()).toBeVisible()
  await page.getByRole('button', { name: 'Gunakan Estimasi' }).click()

  await expect(page).toHaveURL(/setup\/3/)
  await page.getByLabel('Jenis properti').selectOption('landed_house')
  await page.getByLabel('Kota/Kabupaten').selectOption('Kota Bekasi')
  await page.getByLabel('Alamat properti').fill('Griya Asri Blok C2, Bekasi')
  await page.getByLabel('Luas tanah').fill('72')
  await page.getByLabel('Luas bangunan').fill('45')
  await page.getByLabel('Status sertifikat').selectOption('shm')
  await page.getByLabel('Nama pemilik sertifikat').fill('Firdi Audi')
  await page.getByLabel('Estimasi nilai properti sekarang').fill('850000000')
  await save(page)

  await expect(page).toHaveURL(/setup\/4/)
  await page.getByLabel('Penghasilan bulanan').fill('15000000')
  await expect(page.getByText('Ringkasan realtime')).toBeVisible()
  await save(page)

  await expect(page).toHaveURL(/setup\/5/)
  const payment = page.getByRole('group', { name: 'Pembayaran bulanan' })
  await expect(payment.getByRole('checkbox', { name: 'H-7' })).toHaveAttribute('aria-checked', 'true')
  await expect(payment.getByRole('checkbox', { name: 'Hari-H' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('group', { name: 'Masa fixed berakhir' }).getByRole('checkbox', { name: 'H-90' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('checkbox', { name: /WhatsApp/ })).toHaveAttribute('aria-disabled', 'true')
  await save(page)

  await expect(page).toHaveURL(/setup\/6/)
  await page.getByRole('checkbox', { name: 'Data yang saya masukkan benar' }).check()
  await page.getByRole('button', { name: 'Aktifkan Pemantauan KPR' }).click()
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
