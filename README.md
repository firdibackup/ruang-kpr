# RuangKPR

Prototype aplikasi web RuangKPR (React 19 + Vite + Tailwind CSS 4). Semua data masih **mock**: tidak butuh backend, database, atau file `.env`. Data disimpan di `localStorage` browser (key `ruangkpr:prototype:v1`).

## Prasyarat

- **Node.js 22.12+** (cek dengan `node -v`)
- npm (sudah ikut terpasang bersama Node.js)

## Menjalankan di lokal

```bash
cd website          # kalau dari root repo kpr
npm install
npm run dev
```

Buka http://localhost:5173.

Dalam mode dev ada tombol **Demo** di kiri bawah untuk ganti skenario data, reset data mock, dan simulasi error API. Kode OTP mock: **148260**. Tombol ini tidak ikut ke build production.

## Build production

```bash
npm run build       # hasil di folder dist/
npm run preview     # cek hasil build di http://localhost:4173
```

Isi `dist/` adalah file statis dan bisa di-hosting di web server mana pun. Karena aplikasi ini SPA (React Router), server harus mengarahkan semua route ke `index.html`. Contoh untuk Apache (`.htaccess` di dalam `dist/`):

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

## Perintah lain

| Perintah | Fungsi |
| --- | --- |
| `npm run lint` | Cek kode dengan oxlint |
| `npm test` | Unit test (Vitest) |
| `npm run e2e` | Test end-to-end (Playwright). Pertama kali jalankan `npx playwright install chromium` |

## Struktur singkat

- `src/app` — routing, layout, shell aplikasi
- `src/domains` — fitur per domain (applications, optimize, profile, dll.)
- `src/data` — API mock (`api.js` adalah satu-satunya pintu data untuk UI; `mockDb.js` satu-satunya yang akses `localStorage`)
- `src/components` — komponen UI bersama (shadcn/Radix)
- `tests/e2e` — test Playwright

## Reset data

Pakai tombol **Demo → Reset data demo ke skenario ini** di mode dev, atau hapus key `ruangkpr:prototype:v1` dari `localStorage` lewat DevTools browser.
