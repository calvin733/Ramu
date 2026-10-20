# Dashboard decisions

Dashboard presents the existing deterministic results; it does not calculate a
second set of financial metrics. Summary/product/channel facts use `metrics.period`;
the chart uses `dataPeriod`; each goal keeps its own calendar period/reference date.

| Decision / question                   | Minimum data                     | Verified evidence                                                                          | Interpretation / suggested action                                                                                                                                                         | Limits                                                                                                           |
| ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Health: is business improving?        | Date + sales                     | Revenue, existing revenueGrowth; orders/profit when available                              | A decline greater than 10% deserves investigation; inspect product changes before spending more on promotion                                                                              | Equal historical windows, no comparison with a zero baseline; sales are not cash received; no causal explanation |
| Product: what deserves focus?         | Product + sales                  | Contribution, growth, units, gross profit/margin when known                                | A product with at least 25% contribution declining over 10% takes precedence over concentration alone; contribution over 40% suggests diversification; reuse the existing low-margin rule | Bestseller does not mean most profitable; unknown costs are not zero; product growth is historical               |
| Channel: where is sales concentrated? | Named sales channels + sales     | Existing channel revenue/contribution, including unknown channel in denominator            | Keep the leading channel reliable; compare a second channel before expanding effort                                                                                                       | Payment methods are not sales channels; there is no channel cost allocation or profitability claim               |
| Goal: am I on track?                  | Enabled goal + its required data | Existing progress, expectedProgressToDate, remaining, daysRemaining, requiredRemainingPace | Behind-pace goals need attention; use the existing required pace and calendar period                                                                                                      | No new pace formula; ended periods cannot be caught up; missing costs matter only for an explicit profit goal    |
| Priorities: what next?                | Any supported decision above     | Evidence retained with every decision                                                      | Show one primary decision and at most two other decisions from different topics                                                                                                           | Suggestions are experiments, never promised outcomes or invented causes                                          |

## Ordering and repetition

An explicit, stable rule order replaces a weighted scoring system: significant
sales decline → behind-pace goal → declining major product → product concentration
→ existing margin warning → growing secondary product → significant sales growth
→ leading named channel → data needed for an explicit goal. Positive product growth
must exceed 10%, have positive sales and at least 5% contribution. With no such
signal, show a neutral, period-specific sales observation. Missing data alone is
not a business warning. Rules use existing aggregates and existing insight thresholds.

Keep only the highest-priority finding per topic. Business Pulse shows the primary
decision with up to two facts and a visible action. Secondary insights exclude it.
Product/channel panels show supporting rankings rather than repeat the priority
prose. Highlights only describe chart periods; growth belongs to the summary.
One goal is selected by existing pace status (behind first), then remaining time.

## Capability and period presentation

Always show sales. Show historical change only when comparable; orders and gross
profit only when supported. AOV, units and margin stay in a compact disclosure.
Revenue-only data therefore has no fake order/profit/product/channel cards.
Dates distinguish the summary window from the complete chart range. Best/lowest
weekly/monthly highlights consider only complete calendar buckets; partial edges
remain visible in the chart and are explicitly labelled. No forecast is inferred.
