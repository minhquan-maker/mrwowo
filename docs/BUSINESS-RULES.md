# Business rules — mrwowo

This document describes exactly what `assets/js/engine.js` enforces. When the code changes, update this file and run `npm test`.
Vietnamese version: [`vi/QUY-TAC-NGHIEP-VU.md`](vi/QUY-TAC-NGHIEP-VU.md).

## 1. Scope of goods

| Type | Accepted? | Safety line (pulled from sale) | In sample data |
|---|---|---|---|
| Dry packaged goods, seal intact | Yes | 30 days (configurable 30–90) | Yes — 15 lots |
| Chilled goods | Yes (configuration only) | 7 days (configurable 7–30) | No |
| Fresh goods | **No** | — | No |
| Expired goods | **No** — documented disposal only | — | No |

## 2. Owner rules (screen 1)

| Rule | Default | Range | Effect |
|---|---|---|---|
| Price floor | 60% of list | 20–90% | No unit is sold below this on any channel |
| Maximum discount (cap) | 50% | 0–80% | No price step or approver can exceed it. *70% is only an example an owner might choose.* |
| Limit per buyer | 6 units / order | 1–50 | Applied on every channel; a low limit slightly slows sell-through in the simulation |
| Brand display | Shown; hidden on Zalo group-buy | Default + per-channel override | When hidden the listing reads "… — genuine product" |
| Excluded regions | None | 5 regions | A channel present only in excluded regions is blocked; multi-region channels hide the listing there |
| Donation minimum | ≥ 21 days | 7–60 | The charity only accepts stock with enough shelf life to distribute |

**Lowest allowed price** = `max(floor, list × (1 − cap))`, rounded **up** to a multiple of 500 ₫.

## 3. Price steps by days left

Adapted from `ladder()` / `priceAt()` in the earlier prototype (`index_1.html`): same 500 ₫ rounding and floor clamp,
plus a "hold price" step above 90 days.

| Days left | ≥ 91 | 61–90 | 46–60 | 31–45 | 15–30 | 7–14 | 0–6 |
|---|---|---|---|---|---|---|---|
| Discount step | 0% | 20% | 30% | 40% | 50% | 60% | 65% |

```
price = clamp( round500(list × (1 − (step + manual extra + channel extra))),
               lowest allowed price,
               list price )
```

- Zalo group-buy takes an extra 5% for group orders — still clamped at the floor.
- A manual extra discount can only be entered on the Approvals screen; `guard()` blocks it if the requested price is below the floor or the requested discount exceeds the cap.

## 4. Recommendation — `recommend(lot, daysLeft, rules)`

Velocity at list price `v` = demand × Σ reach of open sales channels × per-buyer-limit factor.
`need = stock / v` days; `window = daysLeft − safety line`.

**At or past the safety line:**
1. *Return to supplier* — if the contract has a clause and the return window is still open.
2. *Donate* — if the category is accepted, days left ≥ the donation minimum, and the charity is not excluded everywhere.
3. *Documented disposal* — otherwise.

**Above the safety line:**
1. *Transfer stock* — if a suitable receiving warehouse exists and `window ≥ 45`.
2. *Hold price & monitor* — if `need ≤ 0.85 × window`.
3. *Bundle* — if a bundle partner exists and `window ≥ 20`.
4. *Sell via channels* — if more than safety line + 30 days remain.
5. *Step markdown* — otherwise.

Each recommendation returns its reasons as structured messages (stock, velocity, days needed, days available) that the UI translates.

## 5. Rule check — `guard(lot, proposal, daysLeft, rules)`

| Check | Applies to | Blocks when |
|---|---|---|
| Dry packaged, seal intact | All actions | Not dry goods / seal broken |
| Not expired | All actions | Days left ≤ 0 |
| Above the safety line | Sales actions | Days left ≤ safety line |
| Not below the floor | Sales actions | A manual discount pushes the price below the floor |
| Discount ≤ cap | Sales actions | A manual discount pushes the discount above the cap |
| No sales in excluded regions | Sales actions | Any allocation > 0 to a blocked channel |
| Allocation within stock | Sales actions | Total allocation > stock |
| Supplier return clause | Return | No clause / window closed |
| Charity can accept | Donate | Not accepted / too few days / excluded everywhere |
| Bundle partner / receiving warehouse | Bundle / Transfer | Not declared |

Limit per buyer, brand display and the disposal record are **informational** checks (always pass, shown to the approver).
The *Chief Accountant* operator can view and export only — not approve or change rules.

## 6. Simulation & lot record — `simulateLot()`

- Day 0 = today. Sales run day by day until the stock is gone or the safety line is reached.
- Velocity per channel = demand × channel reach × (1 + 2.5 × discount) × action factor × per-buyer-limit factor.
  - Bundle: × 1.35, plus 1,000 ₫/unit to pack the combo.
  - Transfer: no sales while in transit; then × the receiving region factor; transfer cost on the units allocated to sales.
- At the safety line the lot is **auto-pulled** from every channel; the remainder follows section 4, two days later.
- Direct donate / return / dispose actions execute after two processing days.
- Every event produces a document: donation handover (`QG-…`), supplier return note (`TH-…`), disposal record (`HB-…`), transfer note (`DC-…`).
- Unified ledger: each day × channel is one entry `MM|ZL|AP|TT-<lot>-<n>`, with orders estimated as ⌈units / 3⌉.

## 7. Net recovery value

```
Net recovery = Revenue + Supplier refund − Channel fees − Freight − Handling − Transfer − Disposal
```

| Parameter (estimate) | Default |
|---|---|
| Channel fee | mini-mart 15%, group-buy 5%, partner app 12%, charity 0% |
| Freight per unit | 600 / 1,200 / 900 / 300 ₫ × the lot's bulk factor |
| Handling | 500 ₫ / unit |
| Supervised disposal | 2,500 ₫ / unit × bulk |
| Return freight | 800 ₫ / unit × bulk |

**Baseline (current practice):** liquidation to jobbers = stock × list × 22% − 400 ₫/unit loading; end-of-period disposal = − stock × disposal cost.

**Portfolio summary:** approved lots use the mrwowo plan; pending or rejected lots use current practice.

**CO2e (estimate):** (sold + donated + returned) × category factor × bulk factor. The factors are assumptions and always labelled "estimate".

## 8. Decision log

Every action records time, operator, role, type (`approve`, `reject`, `blocked`, `undo`, `rules`, `allocation`, `export`, `system`), lot and a message
stored as `{ key, vars }` — so the log reads in whichever language is selected. Export as UTF-8 CSV with BOM (opens cleanly in Excel) from the Lot report.

## 9. Shop listing — `storefront(lot, plan, rules, day, 'shop')`

The buyer storefront (`shop.html`) is just another sales channel (`shop`: reach 0.6, fee 3%, freight 800 ₫/unit,
all regions). A lot is listed only when **all** of these hold:

| Condition | Otherwise |
|---|---|
| The lot's decision is **approved** and the action is a sale action | not listed |
| Days left > safety line | `removed` |
| The shop channel is not blocked by excluded regions | `blocked` |
| A transfer has finished its transit days | `transit` |
| Shop allocation − sold on the shop − pending shop orders > 0, and stock − all pending orders > 0 | `soldOut` |

- Price = `priceAt()` for the `shop` channel on the simulated day, including any approved manual discount — always
  between the floor and list. The card shows the next lower price and when it starts.
- A basket line is capped at `min(per-buyer limit, available)`; buyers in an excluded region cannot check out.
- An order `{ id, day, channel: 'shop', units, price }` is booked on its day **before** simulated demand, at the price the
  buyer paid; units promised to a later order are reserved. It appears in the unified ledger (`SH-…`), the lot record
  and the decision log (type *Shop order*).
