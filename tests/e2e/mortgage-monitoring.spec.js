import { expect, test } from '@playwright/test'
import { pdf, useScenario } from './helpers'

const save = (page) => page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()
const skip = (page) => page.getByRole('button', { name: 'Lewati', exact: true }).click()

// Step 1 (wajib): everything reminders and amortization need. Sisa pokok is estimated, not typed.
async function fillKprStep(page) {
  await page.getByLabel('Bank', { exact: true }).selectOption('Bank ABC')
  await page.getByLabel('Jumlah pinjaman awal').fill('600000000')
  await page.getByLabel('Cicilan bulanan saat ini').fill('4127324')
  await page.getByLabel('Tenor awal').fill('240')
  await page.getByLabel('Tanggal akad').fill('2021-12-22')
  await page.getByLabel('Jatuh tempo setiap tanggal').fill('22')
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  await page.getByLabel('Bunga saat ini').fill('5,50')
  await page.getByLabel('Fixed berakhir').fill('2026-12-22')
  await page.getByLabel('Estimasi bunga floating').fill('9,00')
  await page.getByRole('radio', { name: 'Tidak, hitungkan perkiraan' }).click()
  await expect(page.getByText(/Perkiraan sisa pokok ± .*, sisa tenor 183 bulan/)).toBeVisible()
  await expect(page.getByText(/Setelah fixed, cicilan bisa naik jadi/)).toBeVisible()
  await save(page)
}

async function fillEmployment(page) {
  await page.getByLabel('Penghasilan bulanan').fill('15000000')
  await page.getByLabel('Jenis pekerjaan').selectOption('private_employee')
  await page.getByLabel('Nama perusahaan / usaha').fill('PT Nusantara Digital')
  await page.getByLabel('Jabatan / bidang usaha').fill('Software Engineer')
  await page.getByLabel('Lama bekerja').fill('4')
  await page.getByLabel('Tambahan bulan').fill('6')
}

async function activate(page) {
  await page.getByRole('checkbox', { name: 'Data yang saya masukkan benar' }).check()
  await page.getByRole('button', { name: 'Aktifkan Pemantauan KPR' }).click()
  await expect(page.getByRole('heading', { name: 'Pemantauan KPR aktif' })).toBeVisible()
}

test('monitoring: 3-step setup (KPR wajib, data pendukung sebagian dilewati) → dashboard → payment → amortization; no application created', async ({ page }) => {
  await useScenario(page, 'fresh', '/')
  await page.getByRole('link', { name: /Pantau KPR Saya/ }).click()
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/1/)
  await expect(page.getByText('Bagian 1 dari 3 · Data KPR')).toBeVisible()
  await expect(page.getByText('10% selesai.')).toBeAttached()

  // Step 1 is required: an empty submit stops on the errors.
  await save(page)
  await expect(page).toHaveURL(/setup\/1/)
  await expect(page.getByLabel('Jumlah pinjaman awal')).toHaveAttribute('aria-invalid', 'true')
  // A past end date means the rate is already floating: one tap fixes the answer.
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  await page.getByLabel('Fixed berakhir').fill('2026-09-01')
  await expect(page.getByText('Tanggal ini sudah lewat, berarti bunga kamu sudah floating.')).toBeVisible()
  await page.getByRole('button', { name: 'Pilih Sudah floating' }).click()
  await expect(page.getByRole('radio', { name: /Sudah floating/ })).toHaveAttribute('aria-checked', 'true')
  await fillKprStep(page)

  // Data pendukung: three short optional forms; required fields carry * and aria-required.
  await expect(page).toHaveURL(/setup\/2$/)
  await expect(page.getByText('Bagian 2 dari 3 · Data pendukung')).toBeVisible()
  await expect(page.getByText('45% selesai.')).toBeAttached()
  await expect(page.getByText('Form 1 dari 3')).toBeVisible()
  // Only Nama is required here; an empty NIK saves just like Lewati would.
  await expect(page.getByLabel('Nama sesuai KTP')).toHaveAttribute('aria-required', 'true')
  await expect(page.getByLabel('NIK')).not.toHaveAttribute('aria-required', 'true')
  await save(page)
  await expect(page).toHaveURL(/setup\/2\/pekerjaan$/)
  await expect(page.getByText('55% selesai.')).toBeAttached()
  // Nothing is prefilled that the user did not type; Penghasilan is the one required field.
  await expect(page.getByLabel('Penghasilan bulanan')).toHaveValue('')
  await expect(page.getByLabel('Cicilan kendaraan')).toHaveValue('')
  await expect(page.getByLabel('Kartu kredit / paylater')).toHaveValue('')
  await save(page)
  await expect(page.getByLabel('Penghasilan bulanan')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Jenis pekerjaan')).not.toHaveAttribute('aria-invalid', 'true')
  await fillEmployment(page)
  await save(page)
  await expect(page).toHaveURL(/setup\/2\/properti$/)
  await skip(page)

  await expect(page).toHaveURL(/setup\/3/)
  await expect(page.getByText('75% selesai.')).toBeAttached()
  const payment = page.getByRole('group', { name: 'Pembayaran bulanan' })
  await expect(payment.getByRole('checkbox', { name: 'H-7' })).toHaveAttribute('aria-checked', 'true')
  await expect(payment.getByRole('checkbox', { name: 'Hari-H' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('group', { name: 'Masa fixed berakhir' }).getByRole('checkbox', { name: 'H-90' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('checkbox', { name: /WhatsApp/ })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText('Karyawan Swasta · PT Nusantara Digital')).toBeVisible()
  await expect(page.getByText('Data KTP bisa menyusul')).toBeVisible()
  await expect(page.getByText('Belum diisi (opsional)')).toHaveCount(1) // Properti
  await activate(page)
  await page.getByRole('link', { name: 'Lihat Dashboard' }).click()

  await expect(page.getByText('Fixed rate berakhir 85 hari lagi')).toBeVisible()
  await expect(page.locator('main canvas, main [data-chart]')).toHaveCount(0) // no charts on Home

  await page.goto('/my-kpr/property')
  await expect(page.getByRole('link', { name: 'Lengkapi data properti' })).toHaveAttribute('href', '/monitoring/setup/2/properti?edit=property')
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

test('old setup draft resumes on the last step in the new 3-step language', async ({ page }) => {
  await useScenario(page, 'mortgage_setup_step_3', '/')
  await expect(page.getByText('Bagian 3 dari 3 · Reminder')).toBeVisible()
  await page.getByRole('button', { name: 'Lanjutkan Pengaturan' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/3/)
  await expect(page.getByText('Ringkasan data')).toBeVisible()
  await page.goto('/monitoring/setup/6?edit=review') // link from the old 6-step setup
  await expect(page).toHaveURL(/monitoring\/setup\/3$/)
  await page.goto('/my-kpr')
  await expect(page.locator('main ol > li')).toHaveText([/Data KPR/, /Data pendukung/, /Reminder/])
})

test('Data pendukung from the KPR setup fills Take Over, so it is not typed again; skipped parts are flagged', async ({ page }) => {
  await useScenario(page, 'fresh', '/monitoring/intro')
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await fillKprStep(page)
  await page.getByLabel('NIK').fill('3174012345678901')
  await page.getByLabel('Tempat lahir').fill('Bekasi')
  await page.getByLabel('Tanggal lahir').fill('1994-08-12')
  await page.getByRole('radio', { name: 'Laki-laki' }).click()
  await page.getByLabel('Status perkawinan').selectOption('single')
  await page.getByLabel('Alamat KTP').fill('Jl. Melati No. 12, Bekasi Selatan')
  await page.getByLabel('Email').fill('firdi.audi@email.com')
  await save(page)
  await fillEmployment(page)
  await save(page)
  await skip(page) // Data properti
  await activate(page)

  await page.goto('/optimize/start?mode=takeover')
  await page.getByRole('button', { name: 'Lihat Kondisi KPR' }).click()
  await page.getByRole('button', { name: 'Bandingkan Program' }).click()
  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await page.getByRole('button', { name: /^Ajukan / }).click()
  await page.getByRole('button', { name: 'Lanjut Dokumen' }).click()
  await expect(page).toHaveURL(/optimize\/6/)
  await page.getByRole('button', { name: 'Unggah semua (demo)' }).click()
  await expect(page.getByRole('button', { name: 'Simpan & Lanjutkan' })).toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 })
  await save(page)

  await expect(page).toHaveURL(/optimize\/7/)
  await expect(page.getByText('Karyawan Swasta · PT Nusantara Digital')).toBeVisible()
  await expect(page.getByText('Lengkapi data pribadi.')).toHaveCount(0)
  await expect(page.getByText('Lengkapi pekerjaan & penghasilan.')).toHaveCount(0)
  await expect(page.getByText('Lengkapi data properti.')).toBeVisible() // skipped in the setup
  await page.goto('/optimize/1')
  await expect(page.getByLabel('NIK')).toHaveValue('3174012345678901')
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
