# Graph Report - .  (2026-09-30)

## Corpus Check
- 115 files · ~120,097 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 970 nodes · 2924 edges · 60 communities (51 shown, 9 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 208 edges (avg confidence: 0.88)
- Token cost: 492,010 input · 0 output

## Community Hubs (Navigation)
- Shared UI & Page Shells
- Form Field Components
- Visual Bundle & API Contract
- Application Form Validation
- Trackers & Program Simulators
- Mock API & Document Rules
- Progress & Wizard Visuals
- Product Requirement Frameworks
- PRD Core Features
- App Routing & Shell
- Calculation Display Rules
- Finance Calculation Engine
- Mock DB & Seed Data
- Product Decisions & Delivery
- Bank Program Matching
- AI Coding Workflow Commands
- Date Utilities & Derivation
- State Machines & Data Model
- shadcn Components Config
- Runtime Dependencies
- Dev Dependencies
- Home Page
- Oxlint Config
- Playwright E2E Flows
- Dev Panel & Mock Controls
- npm Scripts
- jsconfig Path Aliases
- My KPR Tabs Spec
- Alert Primitive
- Tabs Primitive
- Package Metadata
- API Error Handling
- Refinancing Icon
- Card Overview Illustration
- KPR Primary Icon (256)
- Multiguna Icon (256)
- KPR Primary Icon
- Multiguna Icon
- Take Over Icon
- Empty State Illustration
- Badge Primitive
- Refinancing Icon (256)
- tw-animate-css Dep
- Testing Library Dep
- Favicon & Brand Color
- Take Over Icon (256)

## God Nodes (most connected - your core abstractions)
1. `02 Frontend Functional Spec` - 71 edges
2. `01 Master PRD — RuangKPR` - 65 edges
3. `rupiah()` - 51 edges
4. `react` - 44 edges
5. `useResource()` - 41 edges
6. `toMoney()` - 40 edges
7. `createMockApi()` - 39 edges
8. `04 Mock API JSON Contract` - 33 edges
9. `03 Financial Calculation Spec` - 32 edges
10. `dateShort()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `resolveMonthlyDueDate()` --implements--> `Due-date month addition with end-of-month clamp`  [INFERRED]
  src/calculations/dates.js → ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md
- `CalculationError` --implements--> `CalculationError`  [INFERRED]
  src/calculations/finance.js → ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md
- `roundMoney()` --implements--> `Rounding policy (roundMoney at output boundary, unrounded internal balances)`  [INFERRED]
  src/calculations/finance.js → ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md
- `calculateAnnuityPayment()` --implements--> `calculateAnnuityPayment()`  [INFERRED]
  src/calculations/finance.js → ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md
- `calculateOutstanding()` --implements--> `calculateOutstanding()`  [INFERRED]
  src/calculations/finance.js → ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Approved visual prototype modules** — ruangkpr_app__standalone__shell_template, ruangkpr_app__standalone__pengajuan_module, ruangkpr_app__standalone__pantau_module, ruangkpr_app__standalone__takeover_module, ruangkpr_app__standalone__simulasi_tab [EXTRACTED 1.00]
- **Home lifecycle render states and priority** — ruangkpr_docs_02_frontend_functional_spec_home_fresh, ruangkpr_docs_02_frontend_functional_spec_home_application_draft, ruangkpr_docs_02_frontend_functional_spec_home_mortgage_setup_draft, ruangkpr_docs_02_frontend_functional_spec_home_in_process, ruangkpr_docs_02_frontend_functional_spec_home_rejected, ruangkpr_docs_02_frontend_functional_spec_home_monitoring_normal, ruangkpr_docs_02_frontend_functional_spec_home_near_floating, ruangkpr_docs_02_frontend_functional_spec_home_already_floating, ruangkpr_docs_02_frontend_functional_spec_home_partial_error, ruangkpr_docs_02_frontend_functional_spec_home_render_priority, ruangkpr_docs_01_master_prd_home_render_priority [EXTRACTED 1.00]
- **Amortization schedule generation and reconciliation** — ruangkpr_docs_03_financial_calculation_spec_generateamortizationschedule, ruangkpr_docs_03_financial_calculation_spec_validaterateperiods, ruangkpr_docs_03_financial_calculation_spec_rate_period_shape, ruangkpr_docs_03_financial_calculation_spec_payment_reset_policy, ruangkpr_docs_03_financial_calculation_spec_rounding_policy, ruangkpr_docs_03_financial_calculation_spec_reconciliation_invariants, ruangkpr_docs_03_financial_calculation_spec_due_date_clamping, ruangkpr_docs_01_master_prd_amortization_invariants [EXTRACTED 1.00]
- **Take Over / Top-up decision math (costs, net saving, break-even, top-up)** — ruangkpr_docs_03_financial_calculation_spec_calculatetakeoverscenario, ruangkpr_docs_03_financial_calculation_spec_calculatetopupscenario, ruangkpr_docs_03_financial_calculation_spec_cost_treatment, ruangkpr_docs_03_financial_calculation_spec_cumulative_net_saving, ruangkpr_docs_03_financial_calculation_spec_break_even_status, ruangkpr_docs_03_financial_calculation_spec_topup_definitions, ruangkpr_docs_02_frontend_functional_spec_opt_program_detail, ruangkpr_docs_01_master_prd_break_even_rule [INFERRED 0.85]
- **Graphify-first slash command workflow (build/fix/review)** — _claude_commands_build_build_command, _claude_commands_fix_fix_command, _claude_commands_review_review_command, claude_graphify_context_retrieval [INFERRED 0.95]
- **Mock-first data boundary rules** — claude_mock_first_architecture, claude_api_boundary, claude_mockdb_localstorage_boundary [EXTRACTED 1.00]
- **Definition of Done verification checks** — claude_npm_run_lint, claude_vitest, claude_npm_run_build, claude_playwright [EXTRACTED 1.00]

## Communities (60 total, 9 thin omitted)

### Community 0 - "Shared UI & Page Shells"
Cohesion: 0.09
Nodes (46): react, NotFoundPage(), FormDialog(), UnsavedChangesGuard(), BankMark(), Chip(), CHIP_TONES, Disclaimer() (+38 more)

### Community 1 - "Form Field Components"
Cohesion: 0.07
Nodes (49): CheckboxField(), DateField(), describedBy(), ErrorSummary(), FieldError(), FormGrid(), MoneyField(), NumberField() (+41 more)

### Community 2 - "Visual Bundle & API Contract"
Cohesion: 0.05
Nodes (61): RuangKPR App (Standalone) approved visual bundle, Status badge palette (ok/warn/bad/info), Mock banks ABC / XYZ / DEF with fixed years, floating and fees, Artifact tokens (#003DA5, #F4F6FA, #DC1C2E, ink #0B1B33, muted #6B7A90, radius 24px/999px, shadow 0 6px 24px), KPR Health detail screen (76/100 Perlu perhatian, not a credit score), Artifact nav: Home, KPR Saya, Simulasi, Aktivitas, Profil, Pantau module (monitoring setup 6 steps, Home warning/floating, My KPR tabs, amortization, activity, profile), Pengajuan module (register, OTP, Home states, 5-step KPR application, My KPR application) (+53 more)

### Community 3 - "Application Form Validation"
Cohesion: 0.10
Nodes (55): initialValues(), PrimaryDetailsStep(), stepValues(), blank(), minLen(), property, toEmployment(), toPersonal() (+47 more)

### Community 4 - "Trackers & Program Simulators"
Cohesion: 0.12
Nodes (48): stepPercent(), DraftChecklist(), heroFor(), Tracker(), productName(), stepsOf(), CapacityHero(), PrimaryCompareStep() (+40 more)

### Community 5 - "Mock API & Document Rules"
Cohesion: 0.11
Nodes (39): ARTICLES, ACCEPTED_EXTENSIONS, ACCEPTED_TYPES, doc(), DOC_LABELS, MAX_FILE_BYTES, requiredDocuments(), activeMortgageOf() (+31 more)

### Community 6 - "Progress & Wizard Visuals"
Cohesion: 0.09
Nodes (28): ConfirmDialog(), HouseIllustration(), StatusStepper(), Timeline(), useTween(), WizardProgress(), ProgressBar(), Spinner() (+20 more)

### Community 7 - "Product Requirement Frameworks"
Cohesion: 0.09
Nodes (40): Explore product cards only with active mortgage (not rendered, not disabled), Multiguna requirement framework, Non-functional requirements (performance, WCAG 2.1 AA, responsive), Payment capacity rule (ratio_config × income − existing debt, default 35%), Refinancing + Top-up requirement framework, Rejected recovery paths (Ajukan ke Bank Lain / Perbaiki & Ajukan Ulang), Take Over product (existing-mortgage entry vs cold entry), Take Over ordering signals (floating_signal, opportunity_signal) (+32 more)

### Community 8 - "PRD Core Features"
Cohesion: 0.09
Nodes (39): 01 Master PRD — RuangKPR, AI boundary (may explain, never produce rates/balances/eligibility), Already-floating state (no countdown), Amortization (My KPR → Payment → Lihat Jadwal Amortisasi), Generate schedule from inputs; do not persist rows, Amortization financial invariants (Σprincipal = opening, final balance 0), Application tracker (Diajukan → … → Selesai), Rule-based bank product matching (+31 more)

### Community 9 - "App Routing & Shell"
Cohesion: 0.11
Nodes (33): GuestOnly(), RequireAuth(), router, AppShell(), Brand(), NAV, PageHeader(), unreadLabel() (+25 more)

### Community 10 - "Calculation Display Rules"
Cohesion: 0.16
Nodes (34): Break-even rule (monthly_benefit ≤ 0 → no positive break-even), Principle: Estimate is not approval, Calculation & display rules, MYKPR-03 Amortization page, OPT-08 Program Detail Simulation, Shared format & validation rules (integer Rupiah, NIK 16 digits, tenor 12–360, due day 1–31, 5MB uploads), 03 Financial Calculation Spec, Break-even status (reached / not_reached / no_monthly_benefit) + sustained break-even (+26 more)

### Community 11 - "Finance Calculation Engine"
Cohesion: 0.22
Nodes (23): aggregateScheduleByYear(), assertInteger(), assertMoney(), assertNumber(), calculateAnnuityPayment(), calculateDti(), calculateFloatingImpact(), calculateOutstanding() (+15 more)

### Community 12 - "Mock DB & Seed Data"
Cohesion: 0.13
Nodes (27): loadDb(), resetDb(), saveDb(), STORAGE_KEY, activity(), base(), CLOCK, createSeed() (+19 more)

### Community 13 - "Product Decisions & Delivery"
Cohesion: 0.09
Nodes (28): Confirmed product decisions, Delivery phases 0–5, Five always-enabled nav items (Home / My KPR / Explore / Activity / Profile), KPR Secondary removed as a separate product, MVP Definition of Done (PRD), Principle: No false integration claims, One application = one bank/program, Visual baseline (Plus Jakarta Sans, #003DA5, #F4F6FA, Command Center header) (+20 more)

### Community 14 - "Bank Program Matching"
Cohesion: 0.14
Nodes (25): ageOn(), comparePrimaryPrograms(), compareTakeoverPrograms(), defaultTakeoverSort(), eligibilityFromDti(), evaluatePrimaryProduct(), evaluateTakeoverProduct(), gapOf() (+17 more)

### Community 15 - "AI Coding Workflow Commands"
Cohesion: 0.14
Nodes (24): Build Command (/build), Fix Command (/fix), Root Cause, Smallest Safe Change, Review Checklist (architecture, a11y, states, boundaries, tests), Review Command (/review), AI Coding Workflow, API Boundary (src/data/api.js), Definition of Done (+16 more)

### Community 16 - "Date Utilities & Derivation"
Cohesion: 0.21
Nodes (20): addDays(), addMonths(), countDueDatesBetween(), daysInMonth(), daysUntil(), monthsBetweenDueDates(), nextDueDate(), parseIsoDate() (+12 more)

### Community 17 - "State Machines & Data Model"
Cohesion: 0.11
Nodes (23): Activity & notification reliability (idempotent scheduling, dedupe, preferences), Application state machine (draft→submitted→…→completed; rejected; cancelled), Conceptual data model (users, applications, mortgages, rate_periods, payments, bank_products…), Existing KPR monitoring setup (6-step wizard), Home render priority (PRD: rejected > in-process > app draft > setup draft > near-floating > floating > normal > fresh), Mortgage state machine (draft→active→closed), MVP assumption: one active draft/application and one active mortgage per user, Payment-changed accuracy branch (no reverse-engineering when payment changed) (+15 more)

### Community 18 - "shadcn Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 19 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (19): class-variance-authority, cn, lucide-react, dependencies, class-variance-authority, cn, lucide-react, radix-ui (+11 more)

### Community 20 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): jsdom, oxlint, devDependencies, jsdom, oxlint, @playwright/test, tailwindcss, @tailwindcss/vite (+11 more)

### Community 22 - "Home Page"
Cohesion: 0.19
Nodes (8): ARTICLE_ICONS, ArticleCard(), greeting(), HomePage(), RejectedHero(), SUBTITLE, selectHomeState(), firstName()

### Community 23 - "Oxlint Config"
Cohesion: 0.18
Nodes (10): ignorePatterns, plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, dist, oxc (+2 more)

### Community 25 - "Playwright E2E Flows"
Cohesion: 0.31
Nodes (3): expectNoSecondary(), pdf(), useScenario()

### Community 26 - "Dev Panel & Mock Controls"
Cohesion: 0.22
Nodes (5): DevPanel(), FAILABLE, mockControls, api, SCENARIOS

### Community 28 - "npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, e2e, lint, preview, test, test:watch

### Community 30 - "jsconfig Path Aliases"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, jsx, paths, include, src

### Community 31 - "My KPR Tabs Spec"
Cohesion: 0.40
Nodes (6): Manual payment is user-recorded, not bank-confirmed, My KPR tabs (Overview | Payment | Rate | Property), MYKPR-01 Overview, MYKPR-02 Payment (manual Tandai Pembayaran), MYKPR-05 Property, MYKPR-04 Rate

### Community 34 - "Package Metadata"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 36 - "Refinancing Icon"
Cohesion: 0.67
Nodes (4): 3D Glossy Blue/Red Service Icon Style, Refinancing Service Icon, Bank-to-Bank Transfer Metaphor (Take Over KPR), Refinancing Service

### Community 37 - "Card Overview Illustration"
Cohesion: 1.00
Nodes (3): Card Overview Illustration (card-overview.webp), Navy and Red Brand Accent Palette, Residential Street Scene (modern homes row)

### Community 38 - "KPR Primary Icon (256)"
Cohesion: 0.67
Nodes (3): KPR Primary Service Icon (256px), Blue Glossy 3D Service Icon Style, KPR (Home Ownership Loan) Service

### Community 39 - "Multiguna Icon (256)"
Cohesion: 0.67
Nodes (3): Multiguna Service Icon (256px), Kredit Multiguna (Home-Equity Multipurpose Loan), Glossy 3D Service Icon Style (blue house, red accents)

### Community 40 - "KPR Primary Icon"
Cohesion: 0.67
Nodes (3): Blue Gradient 3D Service Icon Style, Home Ownership / Mortgage (KPR) Metaphor, KPR Primary Service Icon (house with key)

### Community 41 - "Multiguna Icon"
Cohesion: 0.67
Nodes (3): Kredit Multiguna (home-equity / multipurpose loan), Multiguna Service Icon (house + coins + safe), 3D Glossy Service Icon Style (blue/red/gold palette)

### Community 42 - "Take Over Icon"
Cohesion: 0.67
Nodes (3): Take Over Service Icon (take-over.webp), RE/MAX Red-Blue Brand Palette, Take Over KPR Service

### Community 43 - "Empty State Illustration"
Cohesion: 0.67
Nodes (3): No KPR Page Illustration (house with SALE sign), Empty State Illustration Pattern (no KPR applications), RE/MAX Balloon Logo and Blue/Red/White Brand Palette

## Ambiguous Edges - Review These
- `01 Master PRD — RuangKPR` → `05 Frontend Architecture & Delivery Plan`  [AMBIGUOUS]
  ruangkpr-docs/05-FRONTEND-ARCHITECTURE-DELIVERY.md · relation: cites
- `Minimum frontend folder structure (src/features/…)` → `05 Frontend Architecture & Delivery Plan`  [AMBIGUOUS]
  ruangkpr-docs/02-FRONTEND-FUNCTIONAL-SPEC.md · relation: conceptually_related_to

## Knowledge Gaps
- **162 isolated node(s):** `$schema`, `oxc`, `dist`, `src/components/ui`, `react/rules-of-hooks` (+157 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `01 Master PRD — RuangKPR` and `05 Frontend Architecture & Delivery Plan`?**
  _Edge tagged AMBIGUOUS (relation: cites) - confidence is low._
- **What is the exact relationship between `Minimum frontend folder structure (src/features/…)` and `05 Frontend Architecture & Delivery Plan`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `Shared UI & Page Shells` to `Form Field Components`, `Trackers & Program Simulators`, `Progress & Wizard Visuals`, `App Routing & Shell`, `AI Coding Workflow Commands`, `Alert Dialog Primitive`, `Home Page`, `Oxlint Config`, `Dialog Primitive`, `Dev Panel & Mock Controls`, `Table Primitive`, `Card Primitive`, `Alert Primitive`, `Tabs Primitive`, `Badge Primitive`, `Radio Group Primitive`, `Checkbox Primitive`, `Input Primitive`, `Label Primitive`, `Progress Primitive`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **Why does `01 Master PRD — RuangKPR` connect `PRD Core Features` to `Visual Bundle & API Contract`, `Product Requirement Frameworks`, `Calculation Display Rules`, `Product Decisions & Delivery`, `State Machines & Data Model`, `My KPR Tabs Spec`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `api` connect `Shared UI & Page Shells` to `Form Field Components`, `Trackers & Program Simulators`, `Progress & Wizard Visuals`, `App Routing & Shell`, `Product Decisions & Delivery`, `Home Page`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `dist` to the rest of the system?**
  _162 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared UI & Page Shells` be split into smaller, more focused modules?**
  _Cohesion score 0.08994032395566923 - nodes in this community are weakly interconnected._