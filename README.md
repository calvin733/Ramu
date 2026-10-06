# RAMU — AI Business Copilot for Indonesian UMKM

**Ramu data. Temukan peluang.**

RAMU helps small business owners understand sales, product performance, and practical opportunities. All application UI is in Bahasa Indonesia. This is a working, focused MVP with no login, database, subscriptions, or permanent storage.

## Quick start

Use Node.js 22.13+ (tested with Node.js 24.19) and npm. From the existing checkout:

```bash
cd /workspace/Ramu
npm ci
npm run dev
```

Open the development server on port 3000. `/` redirects to `/dashboard`. Routes: `/dashboard`, `/data`, `/ask`.

In this cloud environment, npm needs a writable cache:

```bash
npm --cache /workspace/.npm-cache ci
```

## Features

- Six months of reproducible Indonesian bakery demo data: April–September 2026, six products, three channels, weekend demand, promotions, growth and varied margins.
- Local XLSX/CSV parsing, required-column validation, friendly errors, and template downloads.
- Deterministic revenue, unique orders, units, AOV, COGS, gross profit, gross margin, product contribution, comparable growth, and daily/weekly/monthly trends.
- Dashboard with data-driven KPI cards, Recharts revenue chart, channel breakdown, product table, and 2–4 rule-based insights.
- Tanya RAMU with suggested questions and deterministic answers, plus optional Gemini explanations.
- Responsive navigation, accessible form labels, reduced-motion support, and a text table for chart values.

## Try demo mode and Excel uploads

1. Click **Gunakan Data Demo** on Dashboard or Data. All values come from the generated transactions, not hardcoded KPI values.
2. On **Data**, click **Unduh data demo** to export a complete bakery workbook.
3. Upload that workbook with **Upload Excel / CSV**, or drag and drop it. Click **Lihat Dashboard** after validation.
4. Alternatively, download **Template Excel**, replace its example rows, and upload it. The template includes `transactions`, `products`, and `expenses` sheets.
5. Download **Template CSV** to try transaction-only uploads. CSV costs are optional; add a `cogs` column with the product's cost per unit if available.
6. Try **Tanya RAMU** with the suggested questions. It works without an API key.

Data is held in React context across client-side navigation. A full refresh or closing the tab clears both business data and chat. New uploads replace the current dataset; failed uploads preserve it. Uploaded data is never combined with demo costs.

## Optional Gemini configuration

Create `.env.local` locally using `.env.example` as a template:

```dotenv
GEMINI_API_KEY=
```

Enter your own key in `.env.local` or inject `GEMINI_API_KEY` through secure environment settings, then restart the server. Never commit keys or use `NEXT_PUBLIC_GEMINI_API_KEY`. No key is required to use RAMU.

The official `@google/genai` SDK runs exclusively in the Node.js server routes:

- `POST /api/ai/explain`
- `POST /api/ai/chat`

Requests contain only bounded, validated metric summaries and rule-based insights. No raw transaction rows, uploaded files, or credentials are sent from the browser to Gemini. The browser computes metrics deterministically; the stateless server validates their structure, not their provenance. This is intentionally a single-session analysis tool, not an accounting audit service.

Gemini uses `gemini-2.5-flash` to explain these metrics; it is instructed never to calculate new financial metrics or invent missing information. Generated explanations are assistance, not verified accounting output; KPI values always remain deterministic. Missing keys, timeouts, provider failures, and empty responses fall back to deterministic answers. The server timeout is 12 seconds; the client also has a timeout. In a restricted cloud network, enable `generativelanguage.googleapis.com` for live Gemini requests. Live provider access requires a valid user-supplied key; integration tests use a mocked SDK.

## Expected data format

Only `.xlsx` and `.csv` are accepted, up to 10 MB and 50,000 data rows per sheet. CSV is interpreted as transaction data. XLSX sheet names match case-insensitively; unrelated sheets are ignored.

| Sheet          | Required columns                                             | Optional columns                                       |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `transactions` | `date`, `order_id`, `product_name`, `quantity`, `unit_price` | `product_id`, `discount`, `revenue`, `channel`, `cogs` |
| `products`     | `product_name`                                               | `product_id`, `category`, `selling_price`, `cogs`      |
| `expenses`     | `date`, `category`, `amount`                                 | `description`                                          |

Only `transactions` is required. Optional sheets may be empty. Headers are trimmed and lowercased. Products can be matched by ID, falling back to normalized names. Duplicate product IDs/names and inconsistent inline costs are rejected rather than guessed. Explicit product records take precedence over transaction-level costs.

- Dates: `YYYY-MM-DD`, `DD/MM/YYYY`, or native Excel date cells. Impossible dates are rejected.
- Numbers: plain nonnegative numeric values, without `Rp` or thousands separators. Quantity must be a positive integer.
- Discount is the total discount per transaction line, not a percentage or a per-unit value, and cannot exceed the line's pre-discount revenue.
- When supplied, explicit `revenue` is authoritative, including zero. Otherwise: `quantity × unit_price − discount`.
- `cogs` is cost per unit. It may be omitted; known zero cost remains valid.
- Negative returns/refunds and fractional quantities are outside this MVP. No AI column mapping or automatic financial corrections are performed.

Example CSV:

```csv
date,order_id,product_name,quantity,unit_price,discount,channel
2026-09-30,A001,Fudgy Brownie,2,50000,0,WhatsApp
2026-09-30,A002,Fudgy Brownie,1,50000,0,Offline
```

With product COGS of Rp20.000, this example yields Rp150.000 revenue, 2 orders, 3 units, Rp75.000 AOV, Rp60.000 COGS, Rp90.000 gross profit, and 60% gross margin.

## Metric and comparison semantics

Financial calculations are pure TypeScript functions. Orders count distinct `order_id`, including multi-product orders. Product rankings are computed separately by revenue, units, profit, or margin as appropriate.

Dashboard KPI cards, product rankings, channels, insights, and chat use the latest 30 days **in the uploaded data**, compared with the preceding 30 days. When the dataset spans fewer than 60 days, equal adjacent windows of `floor(span / 2)` days are used. One-day datasets have no comparison. The UI shows exact current and previous date ranges. A zero revenue baseline produces no growth percentage. Profit growth is also unavailable if the previous profit is nonpositive or either period has missing costs.

The trend chart covers **the entire uploaded dataset**, clearly labeled separately from the KPI period. Its default aggregation is monthly for a long dataset, weekly for a medium dataset, and daily for a short dataset; users can switch. Calendar weeks begin on Monday, with edge weeks possibly partial. Missing days are filled with zero revenue.

Total COGS, gross profit and margin are shown only when **all sold products in the analyzed period have known COGS**. Product-level profit remains available for products with complete costs. Coverage is measured as the percentage of sold units with known costs. Margin is unavailable when revenue is zero. Gross profit is before operational expenses; expenses are separately included in supported profit answers, never silently deducted from gross profit.

## Architecture and project structure

```text
Business files → parser → TypeScript analytics → calculated metrics
  → deterministic insights/answers → optional Gemini explanation → user

app/
  dashboard/              Business dashboard
  data/                   Uploads, file summary, templates
  ask/                    Tanya RAMU
  api/ai/{chat,explain}/   Server-only Gemini endpoints
components/
  business-provider.tsx   Session-scoped React context
  layout/                 Sidebar, header, navigation
  dashboard/              KPIs, chart, products, insights
  chat/                   Chat interface
  ui/                     Reusable shadcn-style button using Radix Slot
lib/
  analytics/              Pure deterministic functions
  parsers/                XLSX/CSV parsing and validation
  demo/                   Seeded bakery dataset
  insights/               Rules, intent detection, verified context
  ai/                     Client requests and server-only provider
  types.ts                Domain interfaces
  utils.ts                Rupiah, number, date and formatting helpers
  templates.ts            Downloadable XLSX and CSV samples
tests/
  *.test.ts               Analytics, parser and mocked provider tests
  e2e/                    Real-browser acceptance flows
```

Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Radix Slot, Lucide, Recharts, PapaParse, SheetJS CE 0.20.3, Zod, Google GenAI SDK, Vitest, Playwright. Manrope is packaged locally, so startup and builds do not require a remote font service.

The official SheetJS CDN is blocked by this cloud's current egress policy. The `xlsx` dependency uses the npm-distributed `@e965/xlsx` 0.20.3 mirror through an alias, rather than the older `xlsx` 0.18.5 registry release. The lockfile pins the artifact and its integrity. Imports and APIs remain `xlsx`. See the dependency declaration if changing distribution later.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Unit tests exercise revenue, orders, AOV, COGS, profit, margins, products, comparison windows, missing costs, zero revenue, trends, demo reproducibility, parser errors, chat intents, bounded AI context, and provider success/failure.

Browser tests cover the actual demo flow, chart controls, deterministic chat, CSV and XLSX imports, invalid-file recovery, template round trips, session reset, and mobile layouts:

```bash
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed (as in this cloud environment), avoid downloading another browser:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The test runner starts the app when needed or reuses a running development server on port 3000. Provider-independent acceptance tests should run without `GEMINI_API_KEY`. Playwright browser downloads otherwise require `cdn.playwright.dev` and the Chrome download destination permitted by your network.

Production:

```bash
npm run build
npm start
```

## Deliberate MVP limits

No authentication, permanent storage, multi-business support, inventory, customer analytics, forecasting, or integrations. Chat handles current-period revenue, gross profit, best sellers, profitability, margins, growth, overview, and warnings. Unsupported questions return an insufficient-data response. It does not infer causality, forecast future sales, retain chat across routes, or analyze arbitrary periods selected in a question. XLSX is the preferred full-data upload format; multi-file CSV merging is not implemented.
