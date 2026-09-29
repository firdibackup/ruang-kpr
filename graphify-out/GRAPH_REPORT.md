# Graph Report - .  (2026-09-29)

## Corpus Check
- 102 files · ~102,610 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 931 nodes · 2917 edges · 51 communities (44 shown, 7 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 203 edges (avg confidence: 0.89)
- Token cost: 345,957 input · 0 output

## Community Hubs (Navigation)
- Form Fields & Wizard Steps
- Shared UI Primitives
- Hero Cards & Dashboards
- Progress, Upload & Tracker
- Functional Spec Screens
- Master PRD Requirements
- Mock API Adapter
- Mock DB, Seed & Doc Rules
- Calculation Spec & Break-even
- Explore, Home & Dialogs
- Finance Math (finance.js)
- Product Decisions & Nav
- Program Matching (programs.js)
- Router & App Shell
- Dates & Derived Mortgage
- State Machines & Home Priority
- shadcn components.json
- Mock API Contract (Doc 04)
- Checkbox & Dialog UI
- Runtime Dependencies
- Dev Dependencies
- Architecture Plan (Doc 05)
- Button, 404 & Success Pages
- Oxlint Config
- Approved Visual Artifact
- CLAUDE.md Invariants & Tests
- E2E Playwright Flows
- Dev Panel & API Tests
- Cross-doc Decisions & Scenarios
- npm Scripts
- Data Boundary & Money Units
- jsconfig Paths
- ApiError Handling
- My KPR Tabs
- Alert UI
- Tabs UI
- package.json Metadata
- Vite Entry & Visual Baseline
- Badge UI
- tw-animate-css
- Testing Library
- Favicon & Brand Color

## God Nodes (most connected - your core abstractions)
1. `02 Frontend Functional Spec` - 72 edges
2. `01 Master PRD — RuangKPR` - 66 edges
3. `rupiah()` - 51 edges
4. `react` - 43 edges
5. `useResource()` - 41 edges
6. `createMockApi()` - 39 edges
7. `toMoney()` - 38 edges
8. `03 Financial Calculation Spec` - 34 edges
9. `04 Mock API JSON Contract` - 34 edges
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
- **Home lifecycle render states and priority** — ruangkpr_docs_02_frontend_functional_spec_home_fresh, ruangkpr_docs_02_frontend_functional_spec_home_application_draft, ruangkpr_docs_02_frontend_functional_spec_home_mortgage_setup_draft, ruangkpr_docs_02_frontend_functional_spec_home_in_process, ruangkpr_docs_02_frontend_functional_spec_home_rejected, ruangkpr_docs_02_frontend_functional_spec_home_monitoring_normal, ruangkpr_docs_02_frontend_functional_spec_home_near_floating, ruangkpr_docs_02_frontend_functional_spec_home_already_floating, ruangkpr_docs_02_frontend_functional_spec_home_partial_error, ruangkpr_docs_02_frontend_functional_spec_home_render_priority, ruangkpr_docs_01_master_prd_home_render_priority [EXTRACTED 1.00]
- **Amortization schedule generation and reconciliation** — ruangkpr_docs_03_financial_calculation_spec_generateamortizationschedule, ruangkpr_docs_03_financial_calculation_spec_validaterateperiods, ruangkpr_docs_03_financial_calculation_spec_rate_period_shape, ruangkpr_docs_03_financial_calculation_spec_payment_reset_policy, ruangkpr_docs_03_financial_calculation_spec_rounding_policy, ruangkpr_docs_03_financial_calculation_spec_reconciliation_invariants, ruangkpr_docs_03_financial_calculation_spec_due_date_clamping, ruangkpr_docs_01_master_prd_amortization_invariants [EXTRACTED 1.00]
- **Take Over / Top-up decision math (costs, net saving, break-even, top-up)** — ruangkpr_docs_03_financial_calculation_spec_calculatetakeoverscenario, ruangkpr_docs_03_financial_calculation_spec_calculatetopupscenario, ruangkpr_docs_03_financial_calculation_spec_cost_treatment, ruangkpr_docs_03_financial_calculation_spec_cumulative_net_saving, ruangkpr_docs_03_financial_calculation_spec_break_even_status, ruangkpr_docs_03_financial_calculation_spec_topup_definitions, ruangkpr_docs_02_frontend_functional_spec_opt_program_detail, ruangkpr_docs_01_master_prd_break_even_rule [INFERRED 0.85]
- **Mock/HTTP adapter boundary implementation** — ruangkpr_docs_04_mock_api_json_contract_adapter_boundary, ruangkpr_docs_04_mock_api_json_contract_apierror, claude_one_data_boundary, src_data_api, src_data_mockapi, src_data_apierror, src_data_mockdb [INFERRED 0.85]
- **Approved visual prototype modules** — ruangkpr_app__standalone__shell_template, ruangkpr_app__standalone__pengajuan_module, ruangkpr_app__standalone__pantau_module, ruangkpr_app__standalone__takeover_module, ruangkpr_app__standalone__simulasi_tab [EXTRACTED 1.00]
- **Amortization reconciliation invariants** — ruangkpr_docs_04_mock_api_json_contract_amortization_contract, ruangkpr_docs_05_frontend_architecture_delivery_financial_invariants, claude_amortization_rows_rule, claude_derived_mortgage_state [INFERRED 0.85]

## Communities (51 total, 7 thin omitted)

### Community 0 - "Form Fields & Wizard Steps"
Cohesion: 0.05
Nodes (109): UnsavedChangesGuard(), CheckboxField(), DateField(), describedBy(), ErrorSummary(), FieldError(), FormGrid(), MoneyField() (+101 more)

### Community 1 - "Shared UI Primitives"
Cohesion: 0.10
Nodes (33): BankMark(), Chip(), CHIP_TONES, Disclaimer(), EmptyState(), ESTIMATE_DISCLAIMER, EstimateTag(), HeroCard() (+25 more)

### Community 2 - "Hero Cards & Dashboards"
Cohesion: 0.14
Nodes (44): heroFor(), Tracker(), CapacityHero(), PrimaryCompareStep(), ProgramSimulator(), SubmitSuccess(), ReviewStep(), ActiveMortgageMini() (+36 more)

### Community 3 - "Progress, Upload & Tracker"
Cohesion: 0.10
Nodes (27): StatusStepper(), Timeline(), WizardProgress(), Spinner(), UploadRow(), VIEW, ApplicationTracker(), CANCELLABLE (+19 more)

### Community 4 - "Functional Spec Screens"
Cohesion: 0.09
Nodes (40): Explore product cards only with active mortgage (not rendered, not disabled), Multiguna requirement framework, Non-functional requirements (performance, WCAG 2.1 AA, responsive), Payment capacity rule (ratio_config × income − existing debt, default 35%), Refinancing + Top-up requirement framework, Rejected recovery paths (Ajukan ke Bank Lain / Perbaiki & Ajukan Ulang), Take Over product (existing-mortgage entry vs cold entry), Take Over ordering signals (floating_signal, opportunity_signal) (+32 more)

### Community 5 - "Master PRD Requirements"
Cohesion: 0.09
Nodes (39): 01 Master PRD — RuangKPR, AI boundary (may explain, never produce rates/balances/eligibility), Already-floating state (no countdown), Amortization (My KPR → Payment → Lihat Jadwal Amortisasi), Generate schedule from inputs; do not persist rows, Amortization financial invariants (Σprincipal = opening, final balance 0), Application tracker (Diajukan → … → Selesai), Rule-based bank product matching (+31 more)

### Community 6 - "Mock API Adapter"
Cohesion: 0.12
Nodes (36): comparePrimaryPrograms(), isAvailable(), ARTICLES, activeMortgageOf(), CANCELLABLE, clone(), completeApplication(), createMockApi() (+28 more)

### Community 7 - "Mock DB, Seed & Doc Rules"
Cohesion: 0.10
Nodes (33): ACCEPTED_EXTENSIONS, ACCEPTED_TYPES, doc(), DOC_LABELS, MAX_FILE_BYTES, requiredDocuments(), loadDb(), resetDb() (+25 more)

### Community 8 - "Calculation Spec & Break-even"
Cohesion: 0.16
Nodes (34): Break-even rule (monthly_benefit ≤ 0 → no positive break-even), Principle: Estimate is not approval, Calculation & display rules, MYKPR-03 Amortization page, OPT-08 Program Detail Simulation, Shared format & validation rules (integer Rupiah, NIK 16 digits, tenor 12–360, due day 1–31, 5MB uploads), 03 Financial Calculation Spec, Break-even status (reached / not_reached / no_monthly_benefit) + sustained break-even (+26 more)

### Community 9 - "Explore, Home & Dialogs"
Cohesion: 0.11
Nodes (24): PageHeader(), ConfirmDialog(), FormDialog(), LoadingCards(), PrimaryWizard(), EducationPage(), ExplorePage(), ARTICLE_ICONS (+16 more)

### Community 10 - "Finance Math (finance.js)"
Cohesion: 0.22
Nodes (23): aggregateScheduleByYear(), assertInteger(), assertMoney(), assertNumber(), calculateAnnuityPayment(), calculateDti(), calculateFloatingImpact(), calculateOutstanding() (+15 more)

### Community 11 - "Product Decisions & Nav"
Cohesion: 0.09
Nodes (28): Confirmed product decisions, Delivery phases 0–5, Five always-enabled nav items (Home / My KPR / Explore / Activity / Profile), KPR Secondary removed as a separate product, MVP Definition of Done (PRD), Principle: No false integration claims, One application = one bank/program, Visual baseline (Plus Jakarta Sans, #003DA5, #F4F6FA, Command Center header) (+20 more)

### Community 12 - "Program Matching (programs.js)"
Cohesion: 0.14
Nodes (23): ageOn(), compareTakeoverPrograms(), defaultTakeoverSort(), eligibilityFromDti(), evaluatePrimaryProduct(), evaluateTakeoverProduct(), gapOf(), GOAL_SORT (+15 more)

### Community 13 - "Router & App Shell"
Cohesion: 0.16
Nodes (18): GuestOnly(), RequireAuth(), router, AppShell(), Brand(), NAV, unreadLabel(), Notice (+10 more)

### Community 14 - "Dates & Derived Mortgage"
Cohesion: 0.22
Nodes (20): Pure math in src/calculations (callers pass asOf), addDays(), addMonths(), countDueDatesBetween(), daysInMonth(), daysUntil(), monthsBetweenDueDates(), nextDueDate() (+12 more)

### Community 15 - "State Machines & Home Priority"
Cohesion: 0.11
Nodes (23): Activity & notification reliability (idempotent scheduling, dedupe, preferences), Application state machine (draft→submitted→…→completed; rejected; cancelled), Conceptual data model (users, applications, mortgages, rate_periods, payments, bank_products…), Existing KPR monitoring setup (6-step wizard), Home render priority (PRD: rejected > in-process > app draft > setup draft > near-floating > floating > normal > fresh), Mortgage state machine (draft→active→closed), MVP assumption: one active draft/application and one active mortgage per user, Payment-changed accuracy branch (no reverse-engineering when payment changed) (+15 more)

### Community 16 - "shadcn components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 17 - "Mock API Contract (Doc 04)"
Cohesion: 0.14
Nodes (21): KPR Primary application journey (5 steps, one bank), Existing-mortgage monitoring journey (6-step setup, warning, My KPR), Product invariants (never violate), Take Over + Top-up flow (mode takeover/topup, 7-step cold entry), 04 Mock API JSON Contract, Application status state machine (draft -> submitted -> ... -> disbursed), Bank products and compare (eligibility, capacity, total cost), Document upload metadata lifecycle (intent, complete, replace) (+13 more)

### Community 19 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (19): class-variance-authority, cn, lucide-react, dependencies, class-variance-authority, cn, lucide-react, radix-ui (+11 more)

### Community 20 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): jsdom, oxlint, devDependencies, jsdom, oxlint, @playwright/test, tailwindcss, @tailwindcss/vite (+11 more)

### Community 21 - "Architecture Plan (Doc 05)"
Cohesion: 0.17
Nodes (16): Minimum frontend folder structure (src/features/…), Deterministic mock clock 2026-09-28 and seed, 05 Frontend Architecture & Delivery Plan, Migration path to backend (httpApi, endpoint by endpoint), Calculation pure functions contract (no Date.now, integer Rupiah), Context policy (SessionProvider only), Deliberate deferrals (backend, history, multi-draft, OCR, AI), Dependency policy (no Redux/Zustand/TanStack Query/Axios/date/money/chart libs) (+8 more)

### Community 23 - "Button, 404 & Success Pages"
Cohesion: 0.27
Nodes (7): NotFoundPage(), HouseIllustration(), ErrorPanel(), Button(), buttonVariants, PrimarySuccess(), OptimizeSuccess()

### Community 24 - "Oxlint Config"
Cohesion: 0.18
Nodes (10): ignorePatterns, plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, dist, oxc (+2 more)

### Community 25 - "Approved Visual Artifact"
Cohesion: 0.33
Nodes (11): RuangKPR App (Standalone) approved visual bundle, Status badge palette (ok/warn/bad/info), Mock banks ABC / XYZ / DEF with fixed years, floating and fees, Artifact tokens (#003DA5, #F4F6FA, #DC1C2E, ink #0B1B33, muted #6B7A90, radius 24px/999px, shadow 0 6px 24px), KPR Health detail screen (76/100 Perlu perhatian, not a credit score), Artifact nav: Home, KPR Saya, Simulasi, Aktivitas, Profil, Pantau module (monitoring setup 6 steps, Home warning/floating, My KPR tabs, amortization, activity, profile), Pengajuan module (register, OTP, Home states, 5-step KPR application, My KPR application) (+3 more)

### Community 26 - "CLAUDE.md Invariants & Tests"
Cohesion: 0.29
Nodes (10): CLAUDE.md project guide, Amortization rows rule (unrounded balances, principal = opening - closing), Derived mortgage state (schedule, warning window, DTI/LTV), Know -> Warn -> Act product frame, Provisional KPR Health score (partial when inputs missing), No KPR Secondary anywhere (tested), Amortization endpoint with reconciliation block, Adapter contract tests minimum (18 checks) (+2 more)

### Community 27 - "E2E Playwright Flows"
Cohesion: 0.31
Nodes (3): expectNoSecondary(), pdf(), useScenario()

### Community 28 - "Dev Panel & API Tests"
Cohesion: 0.22
Nodes (5): DevPanel(), FAILABLE, mockControls, api, SCENARIOS

### Community 30 - "Cross-doc Decisions & Scenarios"
Cohesion: 0.29
Nodes (8): Decisions taken on cross-doc conflicts, Dev scenarios (SCENARIOS, Demo panel, window.__ruangkpr.reset), Aggregate home contract (GET /home, state priority), Named fixture scenarios (fresh, h90, floating, takeover, ...), Mock OTP fixture (148260 ok, 000000 invalid, 999999 expired), selectHomeState(snapshot, now) priority selector, Route target plan (/home, /apply/primary/:step, /monitoring/new/:step, /my-kpr/*), Target folder tree (app, components, domains, calculations, data)

### Community 31 - "npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, e2e, lint, preview, test, test:watch

### Community 33 - "Data Boundary & Money Units"
Cohesion: 0.29
Nodes (7): Domain values, not wire JSON (camelCase, integer Rupiah, integer bps), One data boundary (UI imports only api from src/data/api.js), Adapter boundary (api = mockApi | httpApi), Money as integer minor units {amount, currency, scale: 2}, Property equity and LTV (not an official appraisal), Rates and ratios as integer basis points (value_bps, is_estimate), API adapter contract ({data, error} result shape, integer Rupiah)

### Community 34 - "jsconfig Paths"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, jsx, paths, include, src

### Community 35 - "ApiError Handling"
Cohesion: 0.29
Nodes (3): ApiError class and unwrap(envelope), Response envelope {ok, data, meta, error} with cursor pagination, ApiError

### Community 36 - "My KPR Tabs"
Cohesion: 0.40
Nodes (6): Manual payment is user-recorded, not bank-confirmed, My KPR tabs (Overview | Payment | Rate | Property), MYKPR-01 Overview, MYKPR-02 Payment (manual Tandai Pembayaran), MYKPR-05 Property, MYKPR-04 Rate

### Community 39 - "package.json Metadata"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 40 - "Vite Entry & Visual Baseline"
Cohesion: 0.50
Nodes (3): Visual baseline (Plus Jakarta Sans, #003DA5, #F4F6FA, #DC1C2E, rounded-card 24px), index.html (Vite entry, lang id, Plus Jakarta Sans, theme #003DA5), App()

## Ambiguous Edges - Review These
- `01 Master PRD — RuangKPR` → `05 Frontend Architecture & Delivery Plan`  [AMBIGUOUS]
  ruangkpr-docs/05-FRONTEND-ARCHITECTURE-DELIVERY.md · relation: cites
- `Minimum frontend folder structure (src/features/…)` → `05 Frontend Architecture & Delivery Plan`  [AMBIGUOUS]
  ruangkpr-docs/02-FRONTEND-FUNCTIONAL-SPEC.md · relation: conceptually_related_to

## Knowledge Gaps
- **142 isolated node(s):** `$schema`, `oxc`, `dist`, `src/components/ui`, `react/rules-of-hooks` (+137 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `01 Master PRD — RuangKPR` and `05 Frontend Architecture & Delivery Plan`?**
  _Edge tagged AMBIGUOUS (relation: cites) - confidence is low._
- **What is the exact relationship between `Minimum frontend folder structure (src/features/…)` and `05 Frontend Architecture & Delivery Plan`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `Checkbox & Dialog UI` to `Form Fields & Wizard Steps`, `Card UI`, `Shared UI Primitives`, `Progress, Upload & Tracker`, `Hero Cards & Dashboards`, `Alert UI`, `Tabs UI`, `Vite Entry & Visual Baseline`, `Explore, Home & Dialogs`, `Badge UI`, `Radio Group UI`, `Router & App Shell`, `Alert Dialog UI`, `Button, 404 & Success Pages`, `Oxlint Config`, `Dev Panel & API Tests`, `Table UI`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `01 Master PRD — RuangKPR` connect `Master PRD Requirements` to `Functional Spec Screens`, `My KPR Tabs`, `Calculation Spec & Break-even`, `Product Decisions & Nav`, `State Machines & Home Priority`, `Mock API Contract (Doc 04)`, `Architecture Plan (Doc 05)`, `CLAUDE.md Invariants & Tests`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `02 Frontend Functional Spec` connect `Functional Spec Screens` to `My KPR Tabs`, `Master PRD Requirements`, `Calculation Spec & Break-even`, `Product Decisions & Nav`, `State Machines & Home Priority`, `Architecture Plan (Doc 05)`, `Cross-doc Decisions & Scenarios`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `dist` to the rest of the system?**
  _142 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Form Fields & Wizard Steps` be split into smaller, more focused modules?**
  _Cohesion score 0.05366643534582466 - nodes in this community are weakly interconnected._