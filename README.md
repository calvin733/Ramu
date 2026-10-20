# RAMU — AI Business Copilot for Indonesian UMKM

**Ramu data. Temukan peluang.**

RAMU is a focused Next.js MVP with a Bahasa Indonesia interface: Dashboard, Data Bisnis, Target Bisnis, and Tanya RAMU. It reuses deterministic analytics for financial values and treats Gemini as optional assistance. No authentication, database, payments, background notifications, or external business integrations.

## Page responsibilities

- **Data Bisnis:** connect a source, then inspect the active filename, processed status, period, load date, and available capabilities. The uploader is shown again only through **Ganti Data**. **Lihat Mapping** reveals the confirmed column interpretation; invalid replacement files preserve active data. Demo data stays on this page until **Lihat Dashboard** is selected. Recognizable uploads are validated locally and lead directly to Dashboard; uncertain files ask only for needed corrections.
- **Dashboard:** supported summary KPIs, one evidence-backed business priority with a visible next step, sales trend and complete-period highlights, product/channel focus, up to two distinct secondary considerations, and one relevant active goal. AOV, units, margin and product detail use disclosures. **Kelola Data**, **Lihat Target**, and **Tanya RAMU** lead to dedicated pages.
- **Target Bisnis:** create, edit, enable/disable, and delete goals; inspect existing calculated progress, remaining amount, days, required pace, and goal coaching. Disabled goals remain manageable in a separate section. Goals can be created before business data is loaded.
- **Tanya RAMU:** a compact source context and a full-width conversation. Suggested questions include goals only when active goals exist. Existing AI/basic mode badges, verified metric context, and deterministic fallback remain intact.

The provider retains only confirmed mapping labels and the source load timestamp for presentation across navigation. This session-only summary contains no uploaded rows, changes no calculation, and adds no database or localStorage format. Capability availability describes the existing Dashboard analysis window; each goal continues to validate its own calendar period independently.

## RAMU Liquid Glass Design System

RAMU retains sage/green, locally packaged Manrope, readable type, and the four page responsibilities above. `app/glass.css` defines the atmospheric background and shared `--ramu-*` tokens: background, sage, surfaces, green/text/muted colors, glass strengths, borders/dividers, highlights, shadows, radii, blur, and 180 ms interaction timing. The existing `--green`, `--ink`, and related tokens reference this palette. Main headings remain 32–36 px, body 15–16 px, controls 14–15 px, and supporting text at least 12 px.

**CSS glass is the default.** The floating sidebar, seamless sticky desktop topbar, KPI/goal cards, compact context, and shared insight/product/capability panels use translucent fills, backdrop blur, restrained shadows, and inset highlights. Charts, mapping tables, and forms use a more opaque surface. Rows and table cells are plain content within shared surfaces; goal coaching uses a subtle nested CSS section.

**WebGL2 is a selective enhancement.** The selected navigation pill and one key control (Upload, Tambah Target, or the Tanya RAMU composer) can receive `LiquidGlass`. `GlassButton` explicitly opts in; other primary, secondary, and ghost buttons keep the CSS hierarchy. React owns the semantic control and its text; the canvas is decorative, hidden from assistive technology, and cannot intercept input. GPU code is dynamically imported in a client effect after the control is visible and idle time is available. It never initializes during SSR.

The renderer adapts shape-distance masks, shape-aware normals, edge/rim refraction, blur, and tinting from [`dashersw/liquid-glass-js`](https://github.com/dashersw/liquid-glass-js), reviewed at revision `78cb6ccb0b9987bb60a88b14ccbd13a9e6e8ab2a`. The isolated adaptation lives in `components/glass/renderer.ts`; the original MIT copyright and license are preserved in `components/glass/LICENSE.liquid-glass-js`. The vanilla DOM construction, demo styling, continuous nested render loop, and html2canvas page capture are not bundled.

### Fallbacks and performance

- At most **two WebGL contexts** can exist simultaneously. The renderer caps device pixel ratio at 1.5 and each canvas at roughly 160,000 pixels; blur uses five texture samples instead of the reference's large kernel.
- Rendering is event-driven: initial paint, coalesced resize/scroll/pointer events. There is **no continuous animation loop** and no GPU draw while idle. Renderer listeners, pending frames, resize observers, buffers, shaders, textures, and contexts are released on unmount, hidden elements/tabs, or fallback. The lightweight visibility/media observers remain until unmount so an eligible control can resume its enhancement; they are also disconnected during unmount.
- The shader refracts a cached 512 × 320 brand-atmosphere texture. It does **not** capture or refract moving page content or business text, and no uploaded data is sampled. Nested panels stay CSS-only. This keeps text sharp and avoids repeated page rasterization or expensive texture chains.
- CSS glass is used below 900 px, for coarse pointers, reduced motion, data-saving mode, and reported low-memory/low-core devices. Known software GPU backends (including SwiftShader and llvmpipe) are detected once and use CSS glass for the session, without CPU shader rendering. Missing WebGL2, initialization/shader failure, context loss, or missing required observer/media APIs also retain the CSS surface without an error message.
- `prefers-reduced-motion` disables WebGL and UI animation, and chat scrolling uses immediate positioning. Toggling the preference tears down active GPU resources.
- Modern Chrome/Edge, Firefox, and Safari can use backdrop-filter (including the WebKit prefix) and optional WebGL2. Browsers without backdrop-filter receive solid, readable surfaces. WebGL support and visual intensity depend on browser/GPU policy; the application never relies on it for functionality.

The adapted renderer intentionally enhances the background layer only. Native DOM buttons, labels, focus-visible outlines, status text, at least 44 px touch controls, and ordinary form/chat behavior remain available in every mode. Mobile uses lighter CSS blur and the existing four-item navigation, with no additional pages.

## Executive Dashboard and grounded conversation

The Dashboard keeps the existing 12-column Liquid Glass grid, but changes information priority: summary → one business decision → trend and period highlights → products/channels → compact goal monitoring. Sales, comparable historical change, orders and gross profit appear only when supported. Other figures are available in **Angka lainnya**. Revenue-only data has no fake order/profit/product/channel cards.

`lib/dashboard/decisions.ts` selects at most three distinct topics with explicit rule ordering and references to existing metric evidence. It reuses existing growth/concentration/margin findings, adds existing behind-pace goals and major-product growth facts, and does not turn missing cost data into a business problem unless an explicit goal requires it. Business Pulse shows the primary finding/action; secondary insights exclude it. One enabled goal is selected by existing pace status and remaining time. See [the decision framework](docs/dashboard-decision-framework.md). Financial calculations and Tanya RAMU's facts remain unchanged.

The chart still shows the complete uploaded range, separate from the latest summary window and goal calendar periods. Highlight rankings exclude incomplete weekly/monthly edges; the original aggregate values stay visible in the chart with a short period note. Single-period data is never labelled both best and worst.

`app/executive.css` refines the existing Liquid Glass tokens without adding GPU surfaces. The 60 px desktop topbar is transparent at the top, gaining a light sage background, blur, and divider after scrolling. It shows workspace information without repeating the page title. Dashboard entry and bar effects last 350–400 ms; the 270 px revenue chart animates on initial load and aggregation changes. Reduced motion disables these effects. There are no idle animation loops, analytics recalculations during animation, or hover network calls.

Tanya RAMU follows **sanitized question + bounded session memory → local fast path / optional AI plan → deterministic retrieval → verified aggregate snapshot → grounded Gemini reasoning → local entity restoration**.

- `lib/queries/understand.ts` remains the fast path for common questions. `retrieveBusinessQuery` exposes the same deterministic retrieval without requiring another regex match; analytics, financial formulas, goal calculations, import, and storage formats are unchanged.
- `lib/chat/planning.ts` routes uncertain, strategic, multi-topic and conversational questions to `/api/ai/plan`. Gemini returns a strict Zod plan: one closed intent, up to six typed information requests, a closed response goal, and unsupported topic codes. Requests use bounded ranks, closed metric/operation names, and known typed aliases. Plans cannot contain financial figures, executable instructions, arbitrary entity names, or new fields. Unsupported parts of mixed questions cannot be erased by a plan.
- `lib/chat/retrieval.ts` executes the plan locally against the existing metrics and goal results. Each request retains the existing availability and ranking rules. A snapshot carries at most 128 uniquely identified facts, four closed rule indicators, six retrieval statuses, and 12 aggregate trend buckets. Goal facts retain their calendar period/reference date; trend buckets have their own dates and granularity. No custom financial/date-range formulas or forecasts are introduced.
- The `BusinessProvider` owns one client-only `ChatSession` for each active data object. It holds visible messages, six recent sanitized message turns, the last plan, active topics, current/recent entity references, and stable fact-reference keys. It uses no chat database, localStorage, sessionStorage, cookies, or provider chat-session API. Page navigation keeps the conversation; refresh clears it. Goals continue to use their existing localStorage architecture.
- The local `EntityRegistry` keeps PRODUCT_n_RAMU / CHANNEL_n_RAMU / GOAL_n_RAMU aliases stable across all turns, including changes in retrieval order. Entity names and the inverse registry remain in the browser. A local matcher handles overlapping names, Unicode/emoji, case and whitespace; names shared by a product and channel remain explicit typed alternatives. Goal references use local IDs and display labels, with only aliases and verified goal metadata transmitted.
- Before sending either the question or history, `lib/chat/privacy.ts` aliases known product/channel names and redacts detected email, phone, URL, account/order/card/NIK-like identifiers, source filenames/IDs, recognizable address/name labels, known customer-name fields when present, and pasted record/table/code blocks. The normal importer excludes customer fields from financial records. At successful processing, `lib/chat/import-privacy.ts` retains recognized customer-column names in a browser-only WeakMap redaction index tied to the normalized dataset; neither rows nor the index are sent or persisted. Server routes repeat generic redaction, check aliases against the bounded catalog, and strictly reject raw arrays and unexpected fields. Private source IDs/filename/customer-name matchers are never part of conversation/provider state.
- The provider may see sanitized current text, up to six sanitized prior messages, structured analytical hints/plan/catalog, existing numeric aggregate facts, dates/periods, goal progress/pace, closed deterministic warnings/limitations, and aggregate trend points. It never receives RAMU's uploaded files, rows, order IDs, source names, notes/descriptions, arbitrary cells, inverse aliases, or real product/channel-name fields. Obvious/dataset-known identifiers in questions are masked; heuristic redaction cannot identify every possible unlabelled personal name or address in arbitrary prose. Avoid typing sensitive details into business questions.
- `/api/ai/chat` accepts the new strict conversation contract. Its actual provider payload is built from an explicit whitelist, excluding even sanitized fallback prose. Gemini can connect facts and propose grounded actions. It returns up to three short paragraphs with fact tokens for all financial numbers; RAMU rejects invented literal numbers, unknown/missing fact tokens, unknown aliases, and recognizable private output, then renders the verified values itself. Historical memory is context, never the authoritative source for a fresh answer. Interpretation remains advisory; the model cannot create new numerical metrics through this path.
- Planning uses temperature 0.1 for schema stability; conversation reasoning uses a moderate 0.3. Both use the shared server-only model/key, 12-second SDK timeout, safe diagnostics, and a separate 16-second client timeout per call. Complex turns can require two sequential provider calls. Tests use SDK mocks; no live-model quality comparison is claimed.
- Missing keys, outages, invalid plans, invalid reasoning, or unavailable facts return `Analisis dasar`. Direct questions retain deterministic answers, familiar follow-ups retrieve fresh facts, and strategic questions get an honest concise business summary. Customer/prediction/inventory/tax limitations can accompany an answer to a supported product/channel/goal part. Existing explanation/goal contracts remain compatible; their summaries now alias entity names and exclude free-form generated prose before provider transmission. Legacy stateless chat callers remain supported, while the product's Tanya RAMU UI uses the new session contract.

Fact structures validate client-supplied summary bounds, not independent server accounting provenance. The browser's deterministic engine remains the accounting source; no raw rows are uploaded for server recomputation. Arbitrary date filtering, customer analytics, inventory, tax calculations and forecasting remain unsupported. Semantic reasoning/causality constraints are prompt-enforced; generated prose should be reviewed as advice.

The layout reference returned HTTP 403 in this environment; the implementation follows the supplied executive-density brief rather than claiming a visual match to the inaccessible shot.

## Communication style

RAMU leads with the business answer in friendly Indonesian, then selects only relevant verified facts and, when helpful, one practical next step. Ordinary answers aim for 2–4 short sentences; comparisons and reviews of several targets can be longer. `lib/copy/business-answer.ts` formats deterministic results without changing query interpretation, fact selection, rankings, or calculations. Missing costs, customer information, or predictions get specific business explanations; unrelated unavailable figures are omitted. Unknown entity labels are translated only for display, including names restored after Gemini's local aliases.

Dashboard insight thresholds and goal formulas are unchanged. Their prose, goal status labels, data-status explanations, and shared Gemini system instruction now follow the same communication rules. Financial safety, period boundaries, server-only configuration, and aggregate/alias privacy restrictions remain intact. Without Gemini, the same concise deterministic answers are returned with `Analisis dasar`.

## Setup

Use Node.js 22.13+ (tested with Node.js 24.19) and npm:

```bash
cd /workspace/Ramu
npm ci
npm run dev
```

The development server binds to `0.0.0.0:3000`; `/` redirects to `/dashboard`. In this cloud workspace, use a writable npm cache if needed:

```bash
npm --cache /workspace/.npm-cache ci
```

Optional: copy `.env.example` to `.env.local`, set `GEMINI_API_KEY`, and restart the server. Never commit keys or put them in a `NEXT_PUBLIC_` variable. All features work without a key.

## Smart Data Import

1. Upload XLSX or CSV on `/data`. **Menyiapkan analisis bisnis Anda...** covers local inspection and validation, without artificial waiting.
2. `lib/mapping/automatic.ts` accepts only an unambiguous sales interpretation with validated rows, clear financial meanings and no unresolved populated sheets. It does not send anything to AI automatically. Recognized aliases alone are not proof: generic totals/payouts, payment methods presented as channels, competing financial columns, duplicate sales sheets, uncertain per-unit costs and conflicting product costs require a decision.
3. Clear files activate immediately and navigate to `/dashboard`, which announces **Data berhasil diproses** and the source file. Automatic imports leave expense completeness unconfirmed, including when expense rows exist.
4. Unclear files keep the original document locally and show one business question at a time. Users can choose a date/sales column, distinguish sales from received funds, classify an unresolved sheet, or select original sales sheets without double counting.
5. **Atur kolom secara manual** remains available during correction and as an opt-in review before uploading. It reuses the full mapping controls and optional **Biarkan RAMU Membantu**. Its disclosure explains that the explicit AI action sends only permitted sheet/column metadata, never cell values. AI suggestions remain strictly validated and require manual confirmation.
6. Both paths use `prepareImportedData`, the existing `normalizeImport`/parser validation and browser-only customer-name privacy registration. Invalid/cancelled replacements leave active data and chat context intact; successful replacements reset the existing dataset-specific chat session. Business-goal storage is unchanged.
7. Data Bisnis retains active-file status, capabilities, **Lihat Mapping**, replacement and deletion. The mapping summary describes the interpretation actually used, including explicitly ignored sheets/columns.

Conservative limits: unknown populated sheets are never silently ignored; multiple sales sheets need explicit selection/confirmation; subtotal rows mixed into transaction rows need correction in the source file. A generic total or per-unit cost can need one short confirmation. No cash-flow, forecasting or new financial formula is inferred.

Sheet names are flexible, including Penjualan, Sales, Transaksi April, Orders, Data Penjualan, Produk, Master Produk, Biaya, Expenses, and Pengeluaran. Users can explicitly classify any sheet as sales, products, expenses, or ignored. Multiple sales sheets can be combined, up to the normalized transaction limit.

Aliases match without case, spaces, or punctuation differences. Examples:

| RAMU reads              | Example source column names                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| Date                    | date, Tanggal, Tgl, Transaction Date, Tanggal Transaksi, Order Date, Created At |
| Order number            | order_id, Invoice, No Invoice, Order Number, Nomor Transaksi                    |
| Product                 | product_name, Produk, Nama Barang, Item                                         |
| Units                   | quantity, Qty, Jumlah, Units, Jumlah Barang                                     |
| Unit price              | unit_price, Harga, Harga Satuan, Price, Harga Jual                              |
| Revenue                 | revenue, Omzet, Pendapatan, Sales Amount, Total Penjualan                       |
| Discount                | discount, Diskon, Potongan                                                      |
| Channel                 | channel, Kanal, Platform, Marketplace                                           |
| Product cost per unit   | cogs, HPP, Harga Pokok, Biaya Produk                                            |
| Expense category/amount | Kategori Biaya / Nominal, Category / Amount                                     |

For example, both files below are useful:

```csv
Tanggal,No Invoice,Nama Barang,Qty,Harga,Diskon
2026-09-30,A001,Brownie,2,50000,0
```

```csv
Tanggal,Total Penjualan
2026-09-30,150000
```

Downloads for **Template Excel**, **Template CSV**, and the six-month bakery demo remain available. Templates use canonical English headers as examples, but those names are not required in the UI importer.

### Capabilities and validation

- Date plus revenue enables revenue and trend analysis.
- Date plus quantity and unit price enables calculated revenue. Explicit revenue takes precedence, including zero.
- Orders/AOV require actual order identifiers on all relevant rows. RAMU does not count rows as orders or invent IDs.
- Product analytics require product names; missing names disable the product table. Unit rankings require quantities.
- Total gross profit/margin require quantity and known per-unit costs for every relevant row. Missing cost data remains unavailable; known zero cost is valid.
- Expenses are never inferred from missing data. To support net profit, classify an expense sheet and explicitly confirm that operating expenses are complete for the uploaded period, including days without expenses.
- Dates support `YYYY-MM-DD`, `DD/MM/YYYY`, and native Excel date cells. Impossible dates are rejected.
- Transaction numeric cells must be plain numbers (no `Rp` or thousands separators in CSV). Quantities must be positive integers. Discount is a total per line, not a percentage, and cannot exceed a known pre-discount line total.
- Files: `.xlsx` / `.csv`, up to 10 MB, 16 workbook sheets, 100 columns per sheet, and 50,000 rows per sheet / normalized sales dataset. Password-protected and damaged files are rejected.
- Duplicate destination columns, inconsistent product costs, duplicate product records, invalid numbers, and invalid AI proposals are rejected with reviewable feedback.

The legacy strict parser exports remain available for existing callers/tests. The application importer uses `lib/mapping` to adapt flexible schemas before calling the validated parsers.

## Privacy and AI architecture

```text
File stays in browser → local workbook inspection → deterministic aliases
  → optional schema-only Gemini suggestion → user review
  → local conversion → deterministic analytics → verified goal calculations
  → optional Gemini explanation
```

`POST /api/ai/map-data` accepts only bounded sheet IDs/names, column names, and inferred types. **No cell examples or row values are sent**, even for apparently harmless columns. Suspected PII columns (email, phone, address, customer names, NIK, account/card numbers, and related aliases) are excluded. The server repeats this filtering, rejects unexpected raw-data fields, validates proposals with Zod, and rejects unknown columns/sheets, invalid targets/confidences, duplicate mappings, and incompatible sheet/field combinations. Every proposal still needs user confirmation.

`POST /api/ai/chat`, `/api/ai/explain`, and `/api/ai/goals` accept bounded metric summaries, deterministic answers, goal progress, and relevant aggregate product contributions. No raw transaction rows or files are sent. Business explanations alias product/channel names and omit generated free-form prose from provider context. Import assistance uses PII-filtered column metadata; avoid placing personal information in source titles. All inputs are untrusted data, not model instructions.

The official `@google/genai` SDK runs server-side with `gemini-3.5-flash-lite` by default, a 12-second provider timeout per call, and a 16-second client timeout per call. Optional server-only `GEMINI_MODEL` overrides the default consistently for planning, chat, explanations, goals, and mapping; neither it nor `GEMINI_API_KEY` uses a `NEXT_PUBLIC_` variable. Gemini helps recognise structure, explain existing metrics, and suggest actions to consider. It must not calculate financial values or goal progress, invent product/channel performance, guarantee success, or claim causation. Keys remain server-only. Missing keys, timeouts, provider errors, invalid mapping responses, or empty explanations fall back to deterministic behavior. Tests mock provider responses; live Gemini requires a valid key and access to `generativelanguage.googleapis.com`.

Vercel server logs include `[RAMU Gemini]` with route, model, and key presence, and `[RAMU Gemini Error]` with a safe failure category and bounded HTTP status or known transport code when available. Raw provider errors, API keys, headers, request data, and customer information are never logged. After changing Vercel environment variables, redeploy the affected Preview or Production environment to apply them.

As a stateless, single-session MVP, server routes validate the structure and bounds of summaries supplied by the client, not their accounting provenance. AI prose is assistance; displayed KPI and goal values are always calculated locally.

## Business Goals

Create, edit, and delete multiple goals on `/goals`:

- Pendapatan: Rupiah.
- Penjualan: Pesanan or Unit Terjual, positive integers.
- Laba Kotor: revenue minus complete product costs.
- Laba Bersih: gross profit minus confirmed, complete operating expenses for the goal period. This is a simplified result before tax or any other unprovided costs, not an audited net income figure.

Periods are daily, monthly, and yearly. Target inputs accept `100000000` or Indonesian formatting such as `Rp100.000.000`. Zero, negative, malformed, nonfinite, and excessively large targets are rejected. Duplicate metric + period combinations produce a warning and require editing the existing goal instead.

Goals persist locally under **`ramu.businessGoals.v1`**, as `{ version: 1, goals: [...] }`. Versioned Zod validation, bounded record counts, and safe JSON parsing prevent corrupt or unrecognised stored values from crashing the app. Reads never overwrite invalid/future-version data automatically. Browser storage failures produce a helpful save error. Changes synchronize between tabs. Clearing browser storage removes goals.

Sales data and chat still live only in the current browser session: refresh clears those, while goals remain and explain that business data must be loaded again.

### Deterministic formulas

Goal calculations in `lib/goals` operate on transactions in the goal's calendar period, through its reference date. Future rows are excluded. They do not use Dashboard's rolling comparison window.

- **Reference date:** today in Asia/Jakarta if data includes the current goal calendar period; otherwise the latest transaction date. Both the latest data date and reference date are shown.
- **Actual:** summed revenue, distinct order IDs, summed units, gross profit, or supported net profit.
- **Progress:** `actual / target × 100`; values can exceed 100% or be negative for losses. The visual bar is bounded to 0–100%.
- **Remaining:** `max(0, target − actual)`.
- **Days elapsed:** calendar days from period start through reference date, inclusive. Days remaining exclude the reference day; daily periods therefore have zero full days remaining.
- **Expected progress:** `daysElapsed / totalCalendarDays × 100`, including leap years.
- **Pace:** completed at ≥100%; ahead if progress exceeds expected by more than 5 percentage points; behind if more than 5 points below; otherwise on-track.
- **Required daily pace:** `remaining / daysRemaining`; zero when achieved, unavailable if an unfinished target has no days remaining. Historical completed periods explicitly state that no days remain.

Unavailable metrics remain null and explain missing data; they do not become fictional zeroes. Product contribution insights are calculated for the goal period and describe **revenue** contribution, without claiming equivalent profit/order contribution. Expense coverage must include the whole goal period through the reference date, not just any expense record. The demo's complete expense coverage is April–September 2026; outside that range net profit is unavailable.

Dashboard displays at most two active goals, practical in-app reminders, and a link to all goals. Goal cards contain deterministic progress/pace insights and optional Gemini explanations. Tanya RAMU understands progress, remaining amount, pace, status, and supporting-product questions, including yearly targets. All of this works without Gemini. No email, push, or WhatsApp reminders are implemented.

## Existing analytics and demo

The bakery demo retains six products, three channels, and six reproducible months (April–September 2026). Dashboard KPIs, rankings, channels, and business insights compare the latest 30 days in the data with the preceding 30 days. Short datasets use equal adjacent windows of `floor(span / 2)` days; one-day data has no comparison. Zero revenue baselines do not produce growth percentages.

The revenue chart covers the entire dataset with daily/weekly/monthly aggregation, zero-filled missing dates, and an accessible data table. Calendar weeks begin Monday. Gross margin is unavailable at zero revenue; product-level profitability remains available when its costs are complete. Uploaded costs never inherit another dataset's costs. Explicit product records take precedence over transaction-level costs.

## Project structure

- `app/{dashboard,data,ask,goals}`: application routes.
- `app/api/ai`: optional server-side Gemini endpoints.
- `components/business-provider.tsx`: session data, business analytics, persistent goals, and goal progress.
- `components/mapping-review.tsx`: classification and column review.
- `components/data`: onboarding/upload, active source status, capabilities, and confirmed mapping summary.
- `components/dashboard`: KPI summary, revenue chart, concise insights, compact goals, and product preview with expandable detail.
- `components/goals`: reusable goal cards and dashboard summary.
- `lib/mapping`: aliases, local file inspection, safe metadata, suggestion validation, local normalization.
- `lib/goals`: validated models, local storage adapter, period arithmetic, deterministic calculations and answers.
- `lib/analytics`, `lib/parsers`, `lib/demo`, `lib/insights`: existing calculation and validation foundations.
- `tests`: unit/integration and Playwright acceptance tests.

Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Radix Slot, Lucide, Recharts, PapaParse, SheetJS CE, Zod, Google GenAI SDK, Vitest, Playwright. Manrope is packaged locally. The lockfile uses `xlsx` as an npm alias for `@e965/xlsx` 0.20.3 because the official SheetJS CDN was unavailable during initial setup; imports remain `xlsx`.

## Validation

```bash
npm test
npm run typecheck
npm run lint
GEMINI_API_KEY= PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium CI=1 npm run test:e2e
npm run build
```

If system Chromium is unavailable, install Playwright's browser with `npx playwright install chromium` and omit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Browser tests must run without a Gemini key for predictable provider-independent results. The test runner starts a development server on port 3000.

Tests cover the existing analytics/parser/provider behavior, multilingual and manual mapping, incomplete data, schema privacy, rejected AI proposals and outages, daily/monthly/yearly goals, reference dates, expenses/cost availability, target parsing, status/pace, storage corruption/persistence, chat integration, template imports, and laptop/mobile layouts. UX acceptance flows also cover processed source status, deliberate replacement, mapping inspection after navigation, partial capabilities, compact preview limits, goal enable/disable, contextual chat suggestions, and the full Data → Dashboard → Target Bisnis → Tanya RAMU journey without an AI key.

Production locally:

```bash
npm run build
npm start
```

## Vercel deployment

Import this repository/branch into Vercel, choose the **Next.js** preset and Node.js **24.x**, and leave standard install/build/output settings (`npm ci`, `npm run build`, automatic output). If importing the whole repository, the application root is the repository root. Add `GEMINI_API_KEY` only to server environment variables if desired, then redeploy after changing it. It is optional. Next.js route handlers provide the entire server layer; no separate backend, database, or persistent filesystem is required.

## MVP limits

No authentication, permanent transaction storage, multi-business workspaces, multi-file CSV merging, inventory, customer analytics, integrations, or automated notifications. Goals are scoped to this browser, not a shared account. Data must be reloaded after refresh. Mapping expects the first row to contain column titles; merged multi-row headers and arbitrary locale/currency cleanup require preparation. Costs are per unit; negative returns and fractional quantities remain unsupported. Progress describes the supplied data, so incomplete transaction history can understate results. Chat does not forecast or guarantee future results, and supports the documented structured business queries. Gemini suggestions and prose require user judgment; deterministic figures remain the source of truth.
