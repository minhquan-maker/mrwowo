# mrwowo

> **Clear short-dated stock, protect price, keep a record for every lot.**
> *Xử lý hàng cận date, giữ giá, có hồ sơ từng lô.*

A clickable Phase 0 demo for FMCG **brand owners and distributors in Vietnam**. It helps a head of
**trade marketing or supply chain** turn short-dated stock into cash without breaking price or losing track of a lot:

set the rules once → the system proposes an action for each lot → an authorised person approves → stock goes out
through many channels → every order posts back to **one lot record** → the report shows **net recovery** against the
current practice (liquidation to jobbers or disposal).

The demo exists to be taken into interviews with one question: *"Would you pay for this?"*

- **English by default, Vietnamese one click away** — the **EN / VI** switch sits in the header of both pages and is remembered.
- No backend, no login, no payments — state lives in the browser (`localStorage`).

> ⚠️ Every figure is **sample data / an estimate**. Brands, the distributor and the approvers are fictional.
> The "partner app" channel is **illustrative only** — there is no partnership.

---

## Contents

- [Run it](#run-it)
- [What's inside](#whats-inside)
- [3-minute demo](#3-minute-demo)
- [Business rules](#business-rules)
- [How net recovery is calculated](#how-net-recovery-is-calculated)
- [Code structure](#code-structure)
- [Internationalisation](#internationalisation)
- [Sample data](#sample-data)
- [Tests](#tests)
- [Deploy](#deploy)
- [Limits of the demo](#limits-of-the-demo)
- [Tóm tắt tiếng Việt](#tóm-tắt-tiếng-việt)

---

## Run it

No build step, nothing to install — plain HTML/CSS/JS.

```bash
# Option 1 — static server (recommended)
python3 -m http.server 8080        # or: npm start
# → http://localhost:8080            product site (landing)
# → http://localhost:8080/app.html   the 5-screen dashboard
# → append ?lang=vi to open in Vietnamese

# Option 2 — open the file directly
open index.html                     # Windows: start index.html · Linux: xdg-open index.html
```

Both work: scripts are classic `<script>` tags (not ES modules), so `file://` is fine.
Google Fonts fall back to system fonts when offline.

Requirements: a recent Chrome, Edge, Safari or Firefox. Node ≥ 18 only for the tests.

---

## What's inside

### Product site — `index.html`

Laid out after the Instacart reference pages (header with a two-level menu, dark green hero, store-tile row with
arrows, "how it works" cards, comparison table, FAQ, CTA, multi-column footer with a high-contrast switch):

| Block | Content |
|---|---|
| Hero | Headline + a live product preview driven by the real engine (price steps down, hits the floor, pulls itself) |
| Channels | Mini-mart, Zalo group-buy, partner app (illustrative), charity, transfer, supplier return, bundle, documented disposal |
| Benefits | Sells the **outcome** (cash recovered), not the technology |
| How it works | 5 steps = 5 screens |
| Figures | Computed live by the engine over the 15 sample lots (count up on scroll) |
| Comparison | Liquidation to jobbers / end-of-period disposal / mrwowo |
| Model | The owner keeps lots + rules; channels are doors; one lot record |
| Booking form | Validated, stored locally (sent nowhere) |

### Dashboard — `app.html`

| # | Screen | Route | Highlights |
|---|---|---|---|
| 1 | **Owner rules** | `#/luat` | Price floor, discount cap, per-buyer limit, brand display per channel, excluded regions, safety line (dry 30 / chilled 7 days, fresh refused). Side panel: price steps on a sample lot and the effect on net recovery *before* saving |
| 2 | **Lot board** ⭐ | `#/lo-hang` | Cards coloured by days left, proposed action per lot, **0–60 day time simulation** (drag or ▶): prices step down, stop at the floor, lots pull themselves at the safety line; net recovery counts up |
| 3 | **Approvals** | `#/duyet` | Approve / reject / undo per lot, change the action, add a manual discount. The rule check runs live — **nothing gets past the rules**; blocked attempts are logged |
| 4 | **Channel split** | `#/kenh/:lot` | One lot → four doors; allocation table (quantity, price per channel, listing with brand shown/hidden, open regions); **unified ledger** — orders from every channel flow into one record while time runs |
| 5 | **Lot report** ⭐ | `#/bao-cao/:lot` | Headline **net recovery** vs current practice; per-lot chart; lot record (cash flow, what sold at what price, where the rest went, documents, decision log); CSV / JSON / print-to-PDF export |

Shared: **operator** picker (two approvers + a view-only chief accountant), floating **3-minute demo script**,
⋮ menu to *load a pre-approved scenario*, *reset sample data*, *export CSV*, *toggle high contrast*.
Keyboard accessible, `prefers-reduced-motion` aware, responsive down to 360 px.

---

## 3-minute demo

Full talk track and interview questions: [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) · Vietnamese: [`docs/vi/KICH-BAN-DEMO.md`](docs/vi/KICH-BAN-DEMO.md).

| Time | Screen | Do |
|---|---|---|
| 0:00 | Lot board | 15 dry lots, colour = days left, every lot has a proposal + reason |
| 0:30 | Lot board | Press ▶ — prices step down, stop at the floor, lots at 30 days pull themselves |
| 1:10 | Owner rules | Floor, cap, hidden brand, excluded regions; watch the impact |
| 1:40 | Approvals | Push the manual discount past the floor → blocked. Then approve all valid proposals |
| 2:15 | Channel split | One lot, four doors; press ▶ — orders flow into one ledger |
| 2:35 | Lot report | Net recovery vs liquidation/disposal; lot record; export for finance |
| 3:00 | — | *"Would you pay for this?"* |

Tip: before each meeting press ⋮ → **Reset sample data**, or **Load pre-approved scenario** when you only have a minute.

---

## Business rules

Full spec: [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md).

- **Dry packaged goods with the seal intact only.** No fresh goods, no chilled goods in the sample data, nothing expired.
- **Safety line:** dry goods leave every sales channel at **30 days**; chilled **7 days** (configuration only).
- **Price always sits between the floor and list price;** the discount never exceeds the owner's cap.
  Lowest price = `max(floor, list × (1 − cap))`, rounded **up** to 500 ₫.
- **Price steps** (adapted from `ladder()` / `priceAt()` in the earlier prototype, 500 ₫ rounding):

  | Days left | > 90 | 61–90 | 46–60 | 31–45 | 15–30\* | 7–14\* | < 7\* |
  |---|---|---|---|---|---|---|---|
  | Discount | 0% (hold) | 20% | 30% | 40% | 50% | 60% | 65% |

  \* only relevant to chilled goods — dry goods are already pulled at 30 days.
- **After the safety line:** return to supplier (if the contract allows) → donate (if the charity still accepts, default ≥ 21 days) → documented disposal.
- **Every decision** goes through `guard()`; nothing that breaks a rule can be approved, and blocked attempts are still logged.
- 70% is only an **example** of a cap an owner might set — never a claim. Demo defaults: floor 60%, cap 50%.
- CO2e is always labelled **"estimate"**. No "first in Vietnam" or "the only" claims.

---

## How net recovery is calculated

```
Net recovery = Sales revenue + Supplier refund
             − Channel fees − Freight − Handling (seal check, lot sticker, expiry photo)
             − Stock transfer − Supervised disposal
```

Compared with the **current practice** for the same lot:

- *Liquidation to jobbers:* `stock × list × 22%` − loading (configurable on the Rules screen).
- *End-of-period disposal:* `− stock × disposal cost`.

In the portfolio summary, **approved** lots use the mrwowo plan and **pending / rejected** lots use current practice —
so the headline number **rises every time a lot is approved**, which is the "we sell outcomes" story.

Day-by-day sales: velocity = lot demand × channel reach × (1 + 2.5 × discount) × action factor
(bundle +35%, transfer × receiving-region factor). This is an **estimation model** for the demo, not a forecast.

---

## Code structure

```
mrwowo/
├── index.html              Product site (landing)
├── app.html                5-screen dashboard (hash routing)
├── assets/
│   ├── css/
│   │   ├── base.css        Design tokens, reset, buttons, pills, forms, toast, EN/VI switch, reduced motion
│   │   ├── landing.css     Landing layout
│   │   └── app.css         Dashboard layout + print styles
│   ├── js/
│   │   ├── data.js         Sample data (bilingual): owner, 15 lots, 4 channels, 8 actions, default rules, price steps
│   │   ├── engine.js       Pure, language-neutral business logic: price, recommendation, guard, simulation, baseline
│   │   ├── i18n.js         EN/VI dictionaries, t()/tm(), locale formatting, DOM translation, language switch
│   │   ├── ui.js           SVG icons, toast, count-up, safe localStorage, high contrast, downloads
│   │   ├── store.js        Demo state + localStorage (rules, decisions, splits, log, simulated day)
│   │   ├── app.js          The 5 screens, lot drawer, chart, exports, demo script
│   │   └── landing.js      Menu, channel rail, hero preview, figures, booking form
│   └── img/favicon.svg
├── docs/
│   ├── DEMO-SCRIPT.md      3-minute talk track + Phase 0 interview questions
│   ├── BUSINESS-RULES.md   What the engine enforces
│   └── vi/                 Vietnamese versions of both
├── tests/
│   ├── engine.test.js      26 engine tests (node:assert, no dependencies)
│   └── i18n.test.js        8 dictionary / rendering tests
├── package.json            Convenience scripts only — no dependencies
└── vercel.json             Static-site config
```

**Principles**

- `engine.js` and `data.js` are **pure** and run in the browser (`window.Mrwowo.*`) and in Node (`require`) — testable without a browser.
- The engine never produces text: reasons and checks are `{ key, vars }` messages translated by `i18n.js`.
- `app.js` holds no business rules; every number comes from the engine. The landing calls the same engine, so its figures match the app.
- No framework, no bundler. Script order: `data → engine → i18n → ui → store → app | landing`.
- `localStorage` is always wrapped in `try/catch` (`ui.storage`) — the pages still work in private mode.

### Browser storage

| Key | Content |
|---|---|
| `mrwowo.demo.v1` | `{ v, anchor, day, persona, rules, decisions, allocations, log, ui, tour }` |
| `mrwowo.lang` | `en` or `vi` |
| `mrwowo.leads.v1` | Booking requests from the landing form |
| `mrwowo.contrast` | High contrast on/off |

`anchor` is the date the demo was first opened; expiry = `anchor + days left`, so dates always look current.
Reset from the ⋮ menu or by clearing `mrwowo.demo.v1`.

---

## Internationalisation

- Default language is **English**; `?lang=vi` or the **EN / VI** switch changes it, and the choice is stored in `mrwowo.lang`.
- Static HTML uses `data-i18n="key"`, `data-i18n-html="key"` (dictionary content only) and `data-i18n-attr="aria-label:key;…"`.
- Dynamic UI uses `I.t(key, vars)`; engine messages use `I.tm({ key, vars })`, which resolves lots, warehouses, channels, units and money.
- Money: `8,500 ₫` / `343.8M ₫` in English, `8.500 đ` / `343,8 tr đ` in Vietnamese. Dates: `27 Nov 2026` / `27/11/2026`.
- The decision log stores message keys, not sentences — switching language re-renders the whole history.
- `tests/i18n.test.js` fails if EN and VI keys or `{placeholders}` diverge, if a key used in HTML/JS is missing, or if any engine message renders with a leftover placeholder.

To add a string: add the key to **both** `DICT.en` and `DICT.vi` in `assets/js/i18n.js`, then run `npm test`.

---

## Sample data

15 dry lots (snacks, packaged drinks, personal care, household), VND prices, 24 to 120 days left,
four lots just past the safety line. Default proposals cover all 8 actions: hold & monitor, sell via channels,
step markdown, bundle, transfer stock, return to supplier, donate, documented disposal.

Four sample channels: **mini-mart chain**, **Zalo group-buy**, **charity partner**, **partner app (illustrative)**.

To use a real owner's data: edit `LOTS` in `assets/js/data.js` (each lot needs `qty`, `base`, `daysLeft`, `demand`,
`bulk`, `practice`, bilingual `name` / `unit` / `story`, …) and run `npm test` to confirm every invariant still holds.

---

## Tests

```bash
npm test             # engine + i18n tests
npm run check        # syntax-check every script, then the tests
```

Invariants covered: price always within `[lowest allowed, list]` across 4,000 random rule/channel/manual-cut combinations;
price never rises as days left fall; no sale at or below the safety line; unit conservation
(sold + donated + returned + disposed + stock = starting stock); guard blocks a cut below the floor, selling past the
safety line, selling into excluded regions and over-allocation; sample data never names a commercial app as a partner;
EN/VI dictionaries stay in sync.

---

## Deploy

It is a static site — push the folder to any static host (Vercel, Netlify, GitHub Pages, S3).
`vercel.json` sets `framework: null` and `outputDirectory: "."`.

---

## Limits of the demo

- No backend, login or real payments; data lives in the viewer's browser.
- Sell-through, costs and CO2e factors are **assumptions** for storytelling — replace them with the owner's real numbers in Phase 1.
- Decisions apply "from today"; the timeline simulates the future, it is not history.
- One goods owner only; multi-owner / real channel integrations are for a later version.

---

## Tóm tắt tiếng Việt

**mrwowo** — xử lý hàng cận date, giữ giá, có hồ sơ từng lô. Bản demo click được (Phase 0) cho trưởng phòng
trade marketing / supply chain của hãng hoặc nhà phân phối hàng tiêu dùng đóng gói tại Việt Nam.

- Chạy: `python3 -m http.server 8080` rồi mở `http://localhost:8080` (hoặc mở thẳng `index.html`).
- Giao diện **mặc định tiếng Anh**; bấm **VI** ở góc trên (hoặc thêm `?lang=vi`) để chuyển sang tiếng Việt — lựa chọn được ghi nhớ.
- 5 màn hình: Cài luật → Bảng lô hàng (thanh mô phỏng 0–60 ngày) → Duyệt hành động → Phân kênh → Báo cáo từng lô (giá trị thu hồi ròng so với xả hàng/hủy).
- Kịch bản 3 phút: [`docs/vi/KICH-BAN-DEMO.md`](docs/vi/KICH-BAN-DEMO.md) · Quy tắc nghiệp vụ: [`docs/vi/QUY-TAC-NGHIEP-VU.md`](docs/vi/QUY-TAC-NGHIEP-VU.md).
- Mọi số liệu là **dữ liệu mẫu / ước tính**; thương hiệu và người duyệt là tên giả định; "app đối tác" chỉ mang tính minh họa.
