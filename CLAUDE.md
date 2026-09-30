# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RuangKPR is a mobile-first, B2C "Personal KPR (mortgage) Financial Assistant" (**Know → Warn → Act**), built frontend-only and mock-first: Vite + React (**JavaScript, no TypeScript**) + shadcn/ui (Radix base) + Tailwind v4. UI copy is Indonesian. Main journeys:

- KPR Primary application (new and used houses, one bank per application), 7 steps: Data Diri → Pekerjaan & Penghasilan → Properti (incl. jenis pembelian) → Pinjaman → Dokumen → Bandingkan Program → Review. No product-picker step (Home already picks KPR Primary); the draft is created on step 1's first save.
- Existing-mortgage monitoring: 6-step setup, reminders, fixed→floating warning, My KPR, amortization.
- One Take Over + Top-up flow (`mode` takeover/topup), cold entry (7 steps) or from an active mortgage via Explore.

Specs live in `ruangkpr-docs/` (read in order; 06 is the execution prompt). The approved visual is `RuangKPR App (Standalone).html` (a bundle, see "Visual baseline"). Paths like `/home/ubuntu/...` in the docs are from another machine.

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:5173), shows the dev-only "Demo" panel
npm run build        # production build (dev panel and window.__ruangkpr are stripped)
npm run lint         # oxlint (only react fast-refresh warnings are expected)
npm test             # vitest run — unit + mock-API contract tests (jsdom)
npx vitest run src/calculations/finance.test.js      # one file
npx vitest run -t "F09"                              # one test by name
npm run e2e          # Playwright smoke (Chromium); reuses a running dev server on :5173
npx playwright test -g "cold-entry"                  # one E2E test
```

Git Bash on Windows rewrites `/paths` in CLI args; prefix with `MSYS_NO_PATHCONV=1` when passing routes to scripts.

## Architecture (the parts that span files)

- **One data boundary**: UI imports only `api` from `src/data/api.js` (the single mock→HTTP switch point). `mockApi.js` implements the doc-04 surface (auth, dashboard, profile, applications, bankProducts, mortgages, simulations, explore, activities), is always async, and throws `ApiError` (`src/data/apiError.js`). `mockDb.js` is the **only** file touching `localStorage` (key `ruangkpr:prototype:v1`; corrupt data resets to seed). Components never import fixtures, `mockDb`, or call `fetch`.
- **Domain values, not wire JSON**: the adapter returns camelCase objects with integer Rupiah and integer bps. Doc 04's `{ amount, currency, scale: 2 }` snake_case shape is the future HTTP wire format to map inside `httpApi`, not in components.
- **Pure math** in `src/calculations/`: `finance.js` (doc 03 functions, `CalculationError`), `dates.js` (clamped due dates, calendar days), `programs.js` (rule-based bank matching, take-over/top-up evaluation). Both the mock adapter and UI sliders call the same functions, so detail-page numbers always match list numbers. Nothing there reads `Date.now()`; callers pass `asOf` (the mock clock `2026-09-28` from the DB).
- **Amortization rows**: balances stay unrounded internally; each row shows `principal = opening − closing` and `interest = payment − principal`, so Σprincipal equals the opening balance exactly and the last balance is 0. Payment resets at each rate-period start. Rows are never persisted.
- **Derived mortgage state** (`src/domains/mortgages/derive.js`): schedule from today's outstanding, warning window (0 < days ≤ 90), floating impact, DTI/LTV, and a provisional documented KPR Health score (partial when inputs are missing, never zero-filled). Missing floating estimate or sharia scheme ⇒ no schedule (partial state), never a fake table.
- **Home state** is the pure `selectHomeState(snapshot, now)` in `src/domains/home/selectHomeState.js` (rejected > in-process > app draft > mortgage setup draft > warning > floating > normal/partial > fresh). When an application exists alongside an active mortgage, Home shows the application card plus a compact mortgage card.
- **State**: only `SessionProvider` is app-wide. Pages load via `useResource` and patch/refetch after mutations; forms use `useForm(initial, validate)` (`src/lib/hooks.js`) with pure validators in each domain's `validation.js`. Wizard steps persist only on "Simpan & Lanjutkan"/"Lanjutkan" (`saveStep` advances `currentStep`; a URL step ahead of it redirects back). Uploads save per file, metadata only.
- **Folders**: `src/app` (router, dev panel), `src/components/ui` (shadcn, restyled button), `src/components/shared` (fields, panels, dialogs, stepper, upload row), `src/components/layout/AppShell.jsx`, `src/domains/<area>` (pages + rules), `src/data` (adapter, seed scenarios, catalog, document rules, articles).
- **Dev scenarios**: `src/data/seed.js` `SCENARIOS` (guest, fresh, drafts, in-process, rejected, H-90, floating, partial, take-over…). Switch via the Demo panel or `window.__ruangkpr.reset(id)` (dev only; E2E uses it). OTP fixture: `148260` ok, `000000` wrong, `999999` expired.

## Decisions taken on cross-doc conflicts

Routes follow doc 02 (`/`, `/apply/primary/:step`, `/monitoring/setup/:step`, `/optimize/*`, `/my-kpr/*`); folder layout follows doc 05; calc names/units follow doc 03; enums and `ApiError` throwing follow doc 04; Home priority follows 01/04/05. Nav labels are Home / My KPR / Explore / Activity / Profile (docs; the artifact's "Simulasi" tab was not adopted). Muted text uses `#5F6E84` instead of the artifact's `#6B7A90` for WCAG AA contrast.

## Product invariants (never violate)

- No **KPR Secondary** anywhere (routes, strings, ids, fixtures) — tests assert this.
- One application = one bank/program. Monitoring creates a `mortgage`, never an application. Saving a simulation creates nothing; only "Ajukan" creates/updates a draft.
- Payment ever changed ⇒ official outstanding required; solve-for-rate is forbidden.
- Monthly benefit ≤ 0 ⇒ no positive break-even. Unknown costs are never 0.
- Floating rates, property values, eligibility, health, and pre-akad numbers are labeled **estimasi**; manual payments are user-recorded (`bankConfirmed: false`); unknown values show "Belum tersedia"/"Belum diisi".
- Five nav items always enabled; Home has no charts; amortization lives under My KPR → Payment; Explore renders Take Over/Refinancing/Multiguna cards only with an active mortgage (not disabled). Multiguna is informational only.
- MVP: one active draft/application and one active mortgage per user. Cancel = mock hard delete (retention still needs compliance review).
- Dependency policy: no Redux/Zustand/TanStack Query/Axios/react-hook-form/Zod/date/money/chart/animation libraries.

## Visual baseline

Tokens live in `src/styles/globals.css` (mapped onto shadcn variables plus status/ink colors, `rounded-card` = 24px, `shadow-card`). Font Plus Jakarta Sans, primary `#003DA5`, background `#F4F6FA`, brand red `#DC1C2E` ("Command Center"). Desktop sidebar ≥1024px, bottom nav below; touch targets ≥44px. To inspect the artifact: `<script type="__bundler/manifest">` is JSON of UUID → `{ mime, compressed, data }` (base64, gzipped if `compressed`); decode with `gzip.decompress(base64.b64decode(data))`. It holds three module pages (Pengajuan, Pantau, TakeOver) plus the shell template in `<script type="__bundler/template">`. The onboarding photo asset is not in the bundle; `HouseIllustration.jsx` stands in for it.


## AI Coding Workflow

### Simplicity / Ponytail Principles

When implementing changes, prefer the smallest solution that fits the existing architecture.

- Reuse existing components, hooks, utilities, domain rules, and data boundaries before creating new ones.
- Do not introduce a new abstraction, dependency, state-management library, data-fetching library, validation library, or utility layer unless the task genuinely requires it.
- Do not create wrapper components/functions that only rename or forward existing behavior.
- Prefer native React, Vite, browser APIs, and existing project utilities.
- Keep changes local and focused; do not refactor unrelated code.
- Before adding a new file, check whether an existing file is the appropriate home.
- Before adding a dependency, check whether the repository already provides the capability.
- Preserve the existing mock-first architecture and API boundary.
- Never bypass `src/data/api.js` from UI code.
- Never move persistence into components; `mockDb.js` remains the only localStorage boundary.

### UI / UX / Impeccable Principles

For frontend work, treat the existing visual baseline in this file as authoritative.

- Inspect existing UI components and `src/styles/globals.css` before creating new visual patterns.
- Reuse shadcn/Radix components and existing shared components where possible.
- Preserve Plus Jakarta Sans, existing color tokens, spacing language, 24px card radius, and navigation patterns unless the task explicitly changes them.
- Maintain mobile-first behavior and the desktop breakpoint at 1024px.
- Keep touch targets at least 44px.
- Check loading, empty, error, and disabled states for new interactive UI.
- Maintain WCAG-conscious contrast and keyboard accessibility.
- Avoid arbitrary colors, gradients, excessive shadows, decorative animation, or new visual patterns without a clear product reason.
- Do not redesign unrelated screens while implementing a feature.

### Definition of Done

After implementation:

1. Run `npm run lint`.
2. Run the most relevant Vitest tests for changed logic.
3. Run `npm run build` for production-facing changes.
4. Run the relevant Playwright test when a user journey or routing behavior changes.
5. Review the diff and remove unnecessary code or files.
6. Report any check that could not be run rather than claiming it passed.
