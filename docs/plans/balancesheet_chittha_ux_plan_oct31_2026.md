# Balance Sheet (व्यापार चिट्ठा) UX Plan — Oct 31, 2026

**Status:** Phase 1+2+3 IMPLEMENTED (screen statement, shared data, print chittha, CSV) — manual QA pending
**Route:** `/reports/balancesheet` · API `/api/reports/balancesheet` · print `/api/print-balancesheet`
**Constraint:** zero DB writes/schema changes; read-only queries only.

## 1. Problem

Page ka naam "Balance Sheet" hai par structure dashboard + 7 ledgers ka hai:

- Balance sheet point-in-time statement hoti hai (`Assets = Liabilities + Capital`),
  page period report (from–to) ki tarah behave karta hai.
- KPI strip P&L (income/expense/net profit) ko position (stock/payable/loan) ke saath
  mix karta hai; actual statement rows kahin nahi.
- "Calculation Summary" English formula box developer-facing hai.
- Tabs primary navigation hain; statement aur drill-down ka rishta missing hai.

## 2. Goals

1. Sabse upar asli chittha: do-column Assets / Liabilities + Capital, double-rule totals.
2. Period (P&L) aur as-on (position) semantics alag dikhein.
3. Har statement row se related ledger tab tak drill-down.
4. Reporting convention: tabular numbers, ₹ Indian grouping, zero = `—`,
   red sirf genuinely negative/overdue values par.
5. Mobile par stacked sections, desktop par T-format.

Non-goals (is phase me): DB schema, naye write paths, AI/export.

## 3. UX specification

```
व्यापार चिट्ठा                            [इस तारीख तक: 31 Oct 2026]
[Assets] [Liabilities] [Capital] [Net Profit (period)]      [Refresh] [Print]
अवधि (आय-व्यय): मासिक/वार्षिक/कस्टम + वर्ष/महीना + लागू + ‹ ›
┌ संपत्ति (Assets) ───────────────┐ ┌ देनदारी (Liabilities) ─────────┐
│ स्टॉक (माल)              ₹x     │ │ ग्राहक अग्रिम          ₹x      │
│ ग्राहक उधार              ₹x     │ │ स्टाफ बकाया            ₹x      │
│ स्टाफ अग्रिम             ₹x     │ │ लेंडर लोन बकाया        ₹x      │
│ लेंडर को अग्रिम (rare)   ₹x     │ │ ────────────────────           │
│ ───────────────────             │ │ कुल देनदारी            ₹x      │
│ कुल संपत्ति              ₹x     │ │ पूंजी (Net Worth)      ₹x      │
│                                │ │ ════════════════════           │
│                                │ │ कुल (देनदारी+पूंजी)    ₹x      │
└────────────────────────────────┘ └────────────────────────────────┘
इस अवधि का लाभ-हानि: आय ₹x · व्यय ₹x · शुद्ध लाभ ₹x
┌ विवरण (drill-down) ─────────────────────────────────────────────┐
│ [ग्राहक लेजर] [मैकेनिक] [स्टॉक] [आय] [व्यय] [शीर्ष] [लोन]      │
└─────────────────────────────────────────────────────────────────┘
```

Row click → neeche detail card scroll + corresponding tab select.
Footer note: "संपत्ति = देनदारी + पूंजी. नकद/बैंक शेष अनुमानित है."

### Sign conventions (API se)

| Source | Field | +ve | −ve |
|---|---|---|---|
| customerLedger | `current_balance` | ग्राहक उधार (asset) | ग्राहक अग्रिम (liability) |
| mechanicLedger | `balance_amount` (salary − advance) | स्टाफ बकाया (liability) | स्टाफ अग्रिम (asset) |
| loanLedger | `balance_amount` (loan − paid) | लेंडर लोन बकाया (liability) | लेंडर को अग्रिम (asset) |
| stockInventory | `stock_value` | स्टॉक (asset) | — |
| cashFlow (estimated) | `balance` | नकद/बैंक (asset) | नकद ओवरड्राफ्ट (liability) |
| clientLoanLedger | `outstanding` | क्लाइंट लोन बकाया (asset) | — |

Capital = Total Assets − Total Liabilities (derived net worth).

## 4. Phases

### Phase 1 — Screen statement (implemented this session)

- [x] `src/lib/balance-sheet.ts` — pure grouping helper (`buildBalanceSheet`), sign-split.
- [x] Unit tests (`src/lib/balance-sheet.test.ts`).
- [x] Header as-on date + 4 KPI (Assets / Liabilities / Capital / Net profit of period).
- [x] T-format statement card with double-rule totals.
- [x] Row click → detail tab drill-down.
- [x] Filters relabelled as "आय-व्यय की अवधि"; statement header as-on = period end.
- [x] "Calculation Summary" panel removed, honest footer note added.
- [x] Tabs secondary card with tabular numbers / zero `—`.

### Phase 2 — Data completeness (implemented)

- [x] Cash & bank balance derive karna (`computeCashFlow`): cumulative inflows
      (service payments, client-loan EMIs, direct sales, lender loans) − outflows
      (shop expenses, lender payments, mechanic advances, client-loan principals,
      received POs). Negative balance → "नकद ओवरड्राफ्ट" liability.
      Owner capital/drawings + paid-purchase records missing → label "अनुमानित".
- [x] Client loans given (client-loans module, active only, `outstanding > 0`) asset row.
- [x] Print route ke numbers report route ke saath aligned — dono ab
      `src/lib/balance-sheet-data.ts` ke `fetchBalanceSheetData` se aate hain
      (salary history + commission + attendance math ek hi jagah).
- [x] "As on" date alag control (UI + `asOn` API param; default = period end).
- [x] Fix: `lender_list.delete_flag` column exist nahi karta — filter hataya
      (purana print route is query par 400/500 de sakta tha).

### Phase 3 — Polish (implemented)

- [x] Print chittha: cream paper, T-format double-rule statement, detail tables,
      P&L + previous-period strip, signature lines, escaped output, A4 print CSS.
- [x] CSV export (BOM UTF-8; statement, P&L, cash, customer, mechanic,
      client-loan, stock, income, expense, lender sections).
- [x] Previous-period comparison (calendar month/year aware; else same-length window).
- [x] Mobile accordion + totals in section headers; desktop T-format unchanged.
- [x] Dead code cleanup (`ClientLedgerModal` aur uske states removed).

## 5. Verification

Final gate results (2026-11-01, Phase 2+3):

- [x] `npx tsc --noEmit` — clean.
- [x] `npx eslint .` — 0 errors, 0 warnings.
- [x] `npx prettier --check` on all changed files — clean. (Repo-wide `--check .`
      flags ~302 untouched files kyunki working tree CRLF hai `core.autocrlf=true`
      ke saath; pre-existing, is change se related nahi.)
- [x] `npx vitest run` — 580/580 passed (balancesheet helper ke 17 tests: sign split,
      cash/overdraft, client loans, tabs, previous period, cash flow).
- [x] `npm run build` — exit 0.
- [ ] Read-only smoke: `/api/reports/balancesheet` (auth required) — payload labels + totals.
- [ ] Manual (user): login → `/reports/balancesheet` desktop/mobile; row click drill-down;
      monthly/yearly/custom switch; as-on date change; CSV download; print chittha.

## 6. Risks

- Statement ke numbers `asOn` date par depend karte hain — UI me clearly
  "चिट्ठा स्थिति" label hai; default = period end.
- Estimated cash owner capital/drawings aur paid-purchase records ke bina banta hai;
  UI/print/CSV teeno par "अनुमानित" note hai.
- Client-loan asset `status = 1` aur `outstanding > 0` par based hai; closed/paid
  loans statement me nahi aate (detail tab bhi wahi dikhata hai).
- Previous-period comparison P&L ka hai, position ka nahi (position ek point-in-time
  hoti hai, isliye uska comparison nahi dikhaya).
