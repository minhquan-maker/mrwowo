# mrwowo — Project proposal

> **Clear short-dated stock, protect price, keep a record for every lot.**

## 1. The problem in plain words

Every FMCG brand owner and distributor ends up with packaged food, drinks or personal-care products that are
**30–90 days from expiry**. Today there are two usual outcomes in Vietnam:

1. **Dump it on jobbers** at a deep discount. The cash is low, and the stock can leak back into normal shops and break the brand's price.
2. **Let it expire and destroy it.** The cash is zero, and disposal costs money.

Either way, decisions are made by chat and spreadsheet, so nobody can later answer: *who approved this, at what price,
through which channel, and where did the rest go?*

## 2. The idea

A simple tool that sits between the stock owner and the sales channels:

> **Set the rules once → the system proposes an action per lot → an authorised person approves →
> stock sells through several channels → every order lands in one lot record → a report shows net cash recovered.**

Three promises to the customer:

| Promise | How |
|---|---|
| **Recover more cash** | Sell through mini-marts, group-buy, partner apps, bundles, transfers, supplier returns and charity instead of only dumping or destroying |
| **Protect price and brand** | Owner sets a price floor, a discount cap, per-buyer limits, hidden brand per channel and excluded regions. Nobody, including an approver, can break these rules; blocked attempts are logged |
| **Keep a record per lot** | One ledger: what sold, at what price, fees, who approved, documents. Exportable for finance |

Built-in safety line: dry goods leave every channel at 30 days left; fresh goods are refused.

## 3. Who it is for

Heads of **trade marketing or supply chain** at FMCG brand owners and distributors in Vietnam. Finance is the likely
second stakeholder because the headline number is **net recovery**.

## 4. What this repo is (Phase 0)

A clickable demo, not a product. It exists to run customer interviews and ask one question:
**"Would you pay for this, and how?"** All numbers are sample data.

## 5. Has anything like this been validated? (evidence check)

Web search done during drafting; links at the bottom. What I could and could not confirm:

### Australia — the problem and similar businesses exist

| Example | What it does | What it tells us |
|---|---|---|
| **Yume** (Melbourne, founded c. 2014–2016; sources differ) | B2B marketplace where food manufacturers sell or donate surplus, short-dated and de-ranged stock to commercial buyers. Big FMCG names (Unilever, Mars Food, Kellogg's) used it | **The need is real and big brands pay attention.** |
| **Too Good To Go** (launched in Australia in Aug 2024) | Consumer app selling "surprise bags" of surplus food from shops and cafes. Reports 1,300+ Australian business partners | Consumers will buy discounted surplus food at scale. It is B2C and retail/hospitality, not brand-owner lot control |
| **Charity rescue** (e.g. OzHarvest, Foodbank) | Donation channel | Shows the "donate" door is normal and socially accepted |

**Important warning:** Yume was placed in **liquidation on 18 November 2025** after about ten years, after running out of operating capital. A marketplace alone is
not automatically a good business. mrwowo must prove customers pay for *recovery + rule control + audit trail*, not just
"a place to list stock". This is exactly what the Phase 0 interviews should test.

### Vietnam — I found no dedicated product, but "I found none" is not proof

- Near-date goods are sold mainly through **social-media groups** with tens to hundreds of thousands of members, typically
  at **30–70% of original price**. Vietnamese press warns about **tampered dates** and fakes, and selling expired goods can be fined
  (reports cite up to 50 million VND).
- Searches for a Vietnam-based B2B near-expiry platform returned nothing specific. Telio is a Vietnam B2B commerce
  company, but it supplies small retailers, not surplus recovery.

So the honest wording is: **"We found no dedicated, brand-owner-grade near-date recovery platform in Vietnam,
only informal channels."** Do **not** claim "first in Vietnam" or "the only" (also banned in the demo script).
Before pitching, check manually: Zalo/Facebook groups, big e-commerce platforms' clearance sections, and distributors' own programmes.

### What is NOT yet validated

- That Vietnamese brand owners will pay, and which pricing model (monthly fee, share of extra recovery, per lot).
- The demo's economics: jobber recovery ≈ 22% of list, sell-through speed, fees and CO2e are **assumptions**.
- Whether channel partners (apps, mini-mart chains) will agree to take part. The "partner app" in the demo is illustrative.

## 6. Why mrwowo could differ from a plain marketplace

- **Owner-first rules:** the owner controls floor, brand visibility and regions, which protects the main distribution.
- **Approval + audit:** a decision log and one lot record that finance can trust.
- **Outcome-based pitch:** sells *net cash recovered*, not software.

## 7. Roadmap

| Phase | Goal | Success signal |
|---|---|---|
| 0 (now) | Demo + 10–15 interviews | Several say they would pay; a clear pricing model emerges |
| 1 | Pilot one real lot with real costs | Net recovery beats current practice with the customer's own numbers |
| 2 | Backend, login, multi-owner, real channel integrations | Paid pilots convert to contracts |

## 8. Main risks

1. Weak willingness to pay (Yume's outcome is the cautionary example).
2. Channel partners not onboarding, or hurting brand perception.
3. Food-safety and legal exposure around near-expiry sales. Stay within dry, sealed, unexpired goods.
4. Data access: owners may not share lot-level data until trust exists.

## Sources

- [Yume overview (CEBIC, Victorian Government)](https://www.cebic.vic.gov.au/learn/case-studies/yume-surplus-food-technology-making-use-of-excess-food-stock)
- [Why Kellogg's is backing Yume (Internet Retailing)](https://internetretailing.com.au/why-kelloggs-is-backing-yume-the-ebay-for-surplus-food/)
- [Yume collapses into liquidation (SmartCompany)](https://www.smartcompany.com.au/startupsmart/yume-food-collapses-into-liquidation-decade-of-fighting-food-waste/)
- [Too Good To Go launches in Melbourne (Power Retail)](https://powerretail.com.au/too-good-to-go-launches-in-melbourne/)
- [Too Good To Go helps Queensland (Food & Drink Business)](https://www.foodanddrinkbusiness.com.au/news/too-good-to-go-helps-qld-food-savings)
- [Food waste facts (Queensland Government)](https://www.qld.gov.au/environment/waste-reduction-recycling/reduction/reduce-food-waste/facts)
- [Cẩn thận khi "giải cứu" hàng cận date (Báo Mới)](https://baomoi.com/can-than-khi-giai-cuu-hang-can-date-c55685037.epi)
- [Cẩn thận với hàng cận "đát", hàng giả (SGGP)](https://www.sggp.org.vn/can-than-voi-hang-can-dat-hang-gia-74164.html)
