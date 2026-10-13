# RAMU — AI Business Copilot for Indonesian UMKM

**Ramu data. Temukan peluang.**

RAMU is a focused Next.js MVP with a Bahasa Indonesia interface: Dashboard, Data Bisnis, Target Bisnis, and Tanya RAMU. It reuses deterministic analytics for financial values and treats Gemini as optional assistance. No authentication, database, payments, background notifications, or external business integrations.

## Page responsibilities

- **Data Bisnis:** connect a source, then inspect the active filename, processed status, period, load date, and available capabilities. The uploader is shown again only through **Ganti Data**. **Lihat Mapping** reveals the confirmed column interpretation; invalid replacement files preserve active data. Demo data stays on this page until **Lihat Dashboard** is selected.
- **Dashboard:** five compact KPIs, revenue trend beside Kondisi Bisnis, ranked channels, five products, synchronized period highlights, at most three deterministic insights, and two compact active goals. Product detail and recommendations use disclosures. **Kelola Data**, **Lihat Target**, and **Tanya RAMU** lead to dedicated pages.
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

The Dashboard uses a 12-column desktop grid: trend **8** + Kondisi Bisnis **4**; channels **3** + products **6** + highlights **3**; insights **8** + goals **4**. Laptop spans adapt to available width, tablet panels use two columns, and mobile stacks panels with fewer product columns. Five KPI values use the existing latest-window metrics, including unavailable states. The chart and highlights share daily/weekly/monthly selection over the full data range; best/lowest buckets are compared as recorded, may be partial at the boundaries, and ties choose the earliest bucket. Channel contribution divides each existing channel revenue by the total channel revenue, including unassigned revenue. A file with only `Tanpa kanal` gets no large channel panel. Zero denominators remain unavailable.

`app/executive.css` refines the existing Liquid Glass tokens without adding GPU surfaces. The 60 px desktop topbar is transparent at the top, gaining a light sage background, blur, and divider after scrolling. It shows workspace information without repeating the page title. Dashboard entry and bar effects last 350–400 ms; the 270 px revenue chart animates on initial load and aggregation changes. Reduced motion disables these effects. There are no idle animation loops, analytics recalculations during animation, or hover network calls.

Tanya RAMU now follows **question → structured query → deterministic facts → optional Gemini prose**:

- `lib/queries/understand.ts` composes topic, operation, metric, entity, rank, and goal-period matching. It handles Indonesian and common English vocabulary using Unicode normalization and whole-name matching. Product/channel name collisions and incomplete comparisons ask for clarification. Use full names when several products share a word, such as the demo's Brownie variants.
- Topics: overview, revenue, gross profit/margin, orders, AOV, units, products, channels, growth, goals, and warnings. Operations include summary, top/bottom, ranking (including second/third), contribution, comparison, historical change where available, and goal status/remaining/pace. Product comparisons reuse revenue, contribution, units, gross profit, margin, and growth. Channel comparisons support revenue/share only because other channel metrics do not exist in the aggregate model.
- `lib/queries/index.ts` retrieves facts from existing analytics and goal results. It does not read raw transactions or replace financial calculations. Null values stay unavailable; profit/growth rankings disclose incomplete coverage. Requests for order, AOV, and gross-profit change reuse the existing growth fields; unsupported unit/profit/margin growth per product gets a specific limitation. Goal ranking uses the gap between existing progress and expected progress. `generateInsights` was moved unchanged into `lib/insights/rules.ts` to share deterministic rules without a circular dependency.
- A previous structured query is held in the chat component for explicit follow-ups such as **“Kalau yang kedua?”**. It resets with the current chat/data session. No conversation database or permanent memory is added.
- Unknown phrasing asks for clarification. Missing data and unsupported customer, forecast, inventory, tax, and summary net-profit requests get distinct explanations. An optional AI query parser is **not implemented** in this iteration; Gemini is only the prose layer.
- `/api/ai/chat` accepts a bounded, strict Zod result and channel context. Its provider payload contains only closed query fields, numeric facts, period metadata, and closed limitation codes. The original question, fallback narrative, source filename, and business entity names are excluded from the Gemini request. Product/channel names are replaced with request-local aliases and restored in the returned text. Closed goal metric/period/date metadata stays attached to every goal fact and supporting product so different target periods remain distinct. No uploaded rows or files are sent. The existing explanation, goal-coaching, and mapping routes retain their aggregate/schema-only flows.
- `Dibantu AI` means Gemini supplied the prose. Missing keys, failures, unavailable facts, unsupported questions, clarification, and rule-only warnings use deterministic text and `Analisis dasar`. The legacy intent export remains for compatibility but no longer decides whether a structured chat answer can use Gemini. The existing server-only model configuration and safe diagnostics remain shared by all four endpoints.

Query results are bounded to eight channels, five ordinary product rows (up to eight explicit comparison entities), eight goals, and 64 numeric facts. These limits affect explanation size, not analytics; the Dashboard still allows product detail disclosure. Multi-topic requests, arbitrary date filtering, forecasts, and fuzzy name disambiguation are not supported. Facts are structurally validated client summaries, not independent server accounting. Gemini prose remains advisory and may need user review.

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

1. Upload XLSX or CSV on `/data`. RAMU reads the file locally and proposes sheet classifications and column matches.
2. Review **Kolom File → Dibaca Sebagai → Status**. Change the data type or column dropdowns, or ignore irrelevant sheets/columns. Confidence appears as **Tinggi** or **Perlu dicek**.
3. If needed, choose **Biarkan RAMU Membantu** for an optional Gemini suggestion. Without a key or during provider failure, deterministic matching and manual controls remain available.
4. Click **Konfirmasi & Analisis Data**. Only then are rows validated, converted locally, and used for analytics. A failed import preserves the previous dataset.
5. Review the available capabilities and open Dashboard.

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

`POST /api/ai/chat`, `/api/ai/explain`, and `/api/ai/goals` accept bounded metric summaries, deterministic answers, goal progress, and relevant aggregate product contributions. No raw transaction rows or files are sent. Names of products and source columns are metadata; avoid putting personal information in those names. All inputs are untrusted data, not model instructions.

The official `@google/genai` SDK runs server-side with `gemini-3.5-flash-lite` by default, a 12-second provider timeout, and a 16-second client timeout. Optional server-only `GEMINI_MODEL` overrides the default consistently for chat, explanations, goals, and mapping; neither it nor `GEMINI_API_KEY` uses a `NEXT_PUBLIC_` variable. Gemini helps recognise structure, explain existing metrics, and suggest actions to consider. It must not calculate financial values or goal progress, invent product/channel performance, guarantee success, or claim causation. Keys remain server-only. Missing keys, timeouts, provider errors, invalid mapping responses, or empty explanations fall back to deterministic behavior. Tests mock provider responses; live Gemini requires a valid key and access to `generativelanguage.googleapis.com`.

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
