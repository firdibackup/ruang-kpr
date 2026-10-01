import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

async function openFirstProgram(page, mode) {
  await page.goto(`/optimize/start?mode=${mode}`)
  await page.getByRole('button', { name: 'Lihat Kondisi KPR' }).click()
  await expect(page).toHaveURL(/optimize\/baseline/)
  await expect(page.getByText('Estimasi biaya keluar dari bank lama')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tahap 2 selesai' })).toHaveCount(0) // Explore simulation is not an application
  await page.getByRole('button', { name: 'Bandingkan Program' }).click()
  await expect(page).toHaveURL(/optimize\/programs$/)
  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await expect(page).toHaveURL(/optimize\/programs\/bpr_/)
}

test('take over from Explore: simulation creates no application; apply → docs → review → submit → settlement stage', async ({ page }) => {
  await useScenario(page, 'mortgage_active_floating', '/explore')
  await page.getByRole('button', { name: /^Take Over/ }).click()
  await expect(page).toHaveURL(/optimize\/start\?mode=takeover/)
  await openFirstProgram(page, 'takeover')
  await expect(page.getByRole('heading', { name: 'Biaya pindah' })).toBeVisible()
  await page.getByRole('button', { name: 'Selesai Simulasi' }).click()
  await expect(page).toHaveURL(/\/explore$/)
  await page.goto('/my-kpr')
  await expect(page).toHaveURL(/my-kpr\/overview/) // still no application

  await openFirstProgram(page, 'takeover')
  await page.getByRole('button', { name: /^Ajukan / }).click()
  await expect(page.getByText('Pengajuan ini hanya dikirim ke satu bank/program.')).toBeVisible()
  await page.getByRole('button', { name: 'Lanjut Dokumen' }).click()
  await expect(page).toHaveURL(/optimize\/6/)
  await expect(page.getByText('KPR LAMA', { exact: true })).toBeVisible() // take-over specific documents
  await page.getByRole('button', { name: 'Unggah semua (demo)' }).click()
  await expect(page.getByRole('button', { name: 'Simpan & Lanjutkan' })).toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 })
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

  await expect(page).toHaveURL(/optimize\/7/)
  await page.getByRole('checkbox', { name: /Data yang saya berikan benar/ }).check()
  await page.getByRole('checkbox', { name: /Saya setuju data dikirim/ }).check()
  await page.getByRole('button', { name: 'Submit Pengajuan' }).click()
  await expect(page.getByRole('heading', { name: 'Pengajuan berhasil dikirim' })).toBeVisible()
  await expect(page.getByText('Tetap bayar cicilan bank lama')).toBeVisible()
  await page.getByRole('link', { name: 'Pantau Pengajuan' }).click()
  await expect(page.getByRole('list', { name: 'Status pengajuan' })).toContainText('Pelunasan KPR Lama')
})

test('cold-entry take over: 5 data steps (changed payment → official figures) → baseline → programs', async ({ page }) => {
  await useScenario(page, 'fresh', '/')
  await page.getByRole('button', { name: /^Take Over/ }).click()
  await expect(page).toHaveURL(/optimize\/intro/)
  await page.getByRole('button', { name: 'Mulai' }).click()
  const save = () => page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

  await expect(page).toHaveURL(/optimize\/1$/)
  await expect(page.getByText('Bagian 1 dari 3 · Kamu & KPR Lama')).toBeVisible()
  await expect(page.getByText('10% selesai.')).toBeAttached()
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()
  await expect(page).toHaveURL(/optimize\/1\/pekerjaan/)
  await expect(page.getByText('20% selesai.')).toBeAttached() // Pekerjaan is its own progress screen
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()
  await expect(page).toHaveURL(/optimize\/2$/)
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()

  await expect(page).toHaveURL(/optimize\/2\/resmi/) // payment changed → no single-rate estimate
  await expect(page.getByText('Kami tidak menghitung balik bunga')).toBeVisible()
  await page.getByLabel('Sisa pokok saat ini').fill('421500000')
  await page.getByLabel('Bunga saat ini').fill('10,50')
  await page.getByRole('radio', { name: 'Floating' }).click()
  await page.getByLabel('Sisa tenor').fill('181')
  await save()

  // Phase 1 milestone: what staying with the old bank looks like.
  await expect(page).toHaveURL(/optimize\/3/)
  await expect(page.getByRole('heading', { name: 'Tahap 1 selesai' })).toBeVisible()
  await expect(page.getByText('45% selesai.')).toBeAttached()
  await expect(page.getByText('Sisa bunga jika tetap')).toBeVisible()
  await expect(page.getByText('Pokok sudah lunas')).toBeVisible()
  await expect(page.getByText('Floating', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Lanjut ke Tahap 2' }).click()
  await page.reload() // "Lanjut" replaced the milestone entry: reloading stays on the form
  await expect(page.getByRole('heading', { name: 'Tahap 1 selesai' })).toHaveCount(0)

  await expect(page).toHaveURL(/optimize\/3/) // Kemampuan bayar
  // Going back to edit keeps the furthest saved percent instead of dropping it.
  await page.goto('/optimize/1/pekerjaan')
  await expect(page.getByText('45% selesai.')).toBeAttached()
  await page.goto('/optimize/3')
  await expect(page.getByText('Bagian 2 dari 3 · Kondisi & Tujuan')).toBeVisible()
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()
  await expect(page).toHaveURL(/optimize\/4/) // Properti
  await expect(page.getByText('Kesehatan KPR kamu')).toBeVisible()
  await expect(page.getByText('Isi estimasi nilai')).toBeVisible()
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await expect(page.getByText('Isi estimasi nilai')).toBeHidden() // LTV follows the typed property value
  await save()
  await expect(page).toHaveURL(/optimize\/5/) // Tujuan: last data step, runs the simulation
  await expect(page.getByRole('region', { name: 'Kondisi keuangan: Tanpa dana tambahan' })).toContainText('Biaya keluar bank lama')
  await expect(page.getByRole('region', { name: 'Kondisi keuangan: + Dana tambahan' })).toContainText('Top-up kotor maksimum')
  await page.getByRole('radio', { name: /Pindah KPR tanpa dana tambahan/ }).click()
  await page.getByRole('radio', { name: 'Cicilan bulanan lebih ringan' }).click()
  await page.getByLabel('Tenor baru yang diinginkan').selectOption('180')
  await page.getByRole('button', { name: 'Lihat Kondisi KPR' }).click()

  await expect(page).toHaveURL(/optimize\/baseline/)
  await expect(page.getByRole('heading', { name: 'Tahap 2 selesai' })).toBeVisible()
  await expect(page.getByText('75% selesai.')).toBeAttached()
  await expect(page.getByText(/\d+ program cocok/)).toBeVisible()
  await expect(page.getByText('Angka resmi dari bank')).toBeVisible()
  await page.getByRole('button', { name: 'Bandingkan Program' }).click()
  await expect(page.getByText('Sesuai tujuan kamu')).toBeVisible()
  await expect(page.getByText('Data perlu dicek ulang')).toBeVisible() // stale product flagged, not recommended
})

test('top-up branch shows gross/net funds and LTV', async ({ page }) => {
  await useScenario(page, 'mortgage_active_floating', '/')
  await openFirstProgram(page, 'topup')
  await expect(page.getByText('Rincian dana Top-up')).toBeVisible()
  await expect(page.getByText('Top-up kotor')).toBeVisible()
  await expect(page.getByText('Dana bersih diterima').first()).toBeVisible()
  await expect(page.getByText(/LTV baru/)).toBeVisible()
})

test('benefit ≤ 0 never shows a positive break-even', async ({ page }) => {
  await useScenario(page, 'takeover_no_break_even', '/')
  await openFirstProgram(page, 'takeover')
  await expect(page.getByText('Tidak ada titik impas')).toBeVisible()
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 320, height: 568 } })
  test('bottom nav works and pages have no horizontal overflow', async ({ page }) => {
    await useScenario(page, 'mortgage_active_h90', '/')
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' }).last()
    await expect(nav.getByRole('link')).toHaveCount(5)
    for (const [label, url] of [['My KPR', /my-kpr/], ['Explore', /explore/], ['Activity', /activity/], ['Profile', /profile/], ['Home', /\/$/]]) {
      await nav.getByRole('link', { name: label }).click()
      await expect(page).toHaveURL(url)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `horizontal overflow on ${label}`).toBeLessThanOrEqual(0)
    }
  })

  // Status steppers scroll sideways; their sr-only labels must not widen the page.
  test('status steppers do not overflow the page', async ({ page }) => {
    for (const scenario of ['application_in_process', 'takeover_in_process']) {
      for (const path of ['/', '/my-kpr/application']) {
        await useScenario(page, scenario, path)
        await expect(page.getByRole('list', { name: /Tahapan pengajuan|Status pengajuan/ }).first()).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `horizontal overflow on ${scenario} ${path}`).toBeLessThanOrEqual(0)
      }
    }
  })
})
