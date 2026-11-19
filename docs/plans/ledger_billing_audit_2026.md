# Ledger / Billing Audit — 20 Nov 2026

Trigger: `/clients/565/ledger-print` par "Total Payments" ₹1,600 dikh raha tha
jabki client ne ₹1,400 cash diye aur ₹100 discount mila (bill ₹1,500).
Balance 0 hona chahiye tha.

Ye doc us investigation ka record hai: kya fix hua, kya bacha hai, aur
(kya) same-family bugs mile.

---

## 0. TL;DR (ek nazar me)

| # | Item | Status |
| - | ---- | ------ |
| 1 | `ledger-print` "Total Payments" discount double-count kar raha tha | ✅ **FIXED** (`a231e45`, pushed) |
| 2 | `ledger-print` + `api/print-client-ledger` pending/non-delivered jobs ko billed amount me jodte hain | 🔴 **OPEN** — 61/519 clients affected |
| 3 | `api/print-client-ledger` "Total Paid" = settled (cash+discount), discount alag nahi | 🟡 **OPEN** — label/value ambiguity |
| 4 | Baaki app (client list, due, reports, payments, portal) consistent | ✅ verified |

---

## 1. Bug #1 — Total Payments me discount do baar (FIXED)

### Kya galat tha

`totals.payments` = `totalSettled` = `SUM(client_payments.amount + discount)`,
kyunki **dono** balance clear karte hain (cash + discount).

Display line galti se discount **jod** rahi thi:

```ts
// before (committed code)
{ label: "Total Payments", val: totals.payments + totals.discount }
//  settled 1500 + discount 100 = 1600   ❌

// after
{ label: "Total Payments", val: totals.payments - totals.discount }
//  settled 1500 - discount 100 = 1400   ✅ (cash actually received)
```

Balance/outstanding math pehle se sahi tha (`currentOutstanding` `totalSettled`
use karta hai) — sirf summary tile inflate ho raha tha.

### Kyun pakda gaya late

Fix pehle se ek AI ne working tree me kiya tha, par **commit nahi hua**.
Isliye:

- dev server (working tree) → 1400 ✅
- committed/prod code → 1600 ❌

### Fix + verification

- Commit: `a231e45` — `fix(clients): ledger Total Payments shows cash received, not settled`
- File: `src/app/clients/[id]/ledger-print/page.tsx` (summary tile, ~line 1072)

Live page verify (headless Chrome, real staff login, client 565):

```
Total Repairs       : ₹1,500.00
Total Payments      : ₹1,400.00
Total Discount Given: ₹100.00
Outstanding         : ₹0.00  (FULLY SETTLED)
```

Ledger row `Credit (Cr)` ₹1,500 dikhata hai (`₹1,400 + ₹100 disc`) — wo
settled value hai, tfoot me `Cash: ₹1,400 + Disc: ₹100` explain karta hai.

DB cross-check (`client_payments` id 897):

```
amount=1400  discount=100  net_amount=1300 (generated = amount - discount)
```

Gates: `tsc` OK · eslint 0 warnings · prettier OK · `npm test` 688/688.

---

## 2. Bug #2 — Pending / non-delivered jobs "billed" me count ho rahe (OPEN)

### Rule jo poori app follow karti hai

`src/lib/client-due.ts` (single source of truth, PHP behaviour):

```
due = opening_balance
    + SUM(transaction_list.amount)  WHERE status = 5 (Delivered)
    + SUM(direct_sales.total_amount)
    - SUM(client_payments.amount + discount)     -- service payments
    + SUM(client_loans.total_payable)            -- active loans
    - SUM(payments.amount + discount)            -- active loan repayments
```

Sirf **Delivered (status=5)** jobs billed hote hain.

### Kahan deviates hai

| File | Query | Effect |
| ---- | ----- | ------ |
| `src/app/clients/[id]/ledger-print/page.tsx` | `select("amount").eq("client_name", id)` — no `status`, no `del_status` | Total Repairs + running balance me pending/done/cancelled jobs bhi |
| `src/app/api/print-client-ledger/route.ts` | `select(...).eq("client_name", clientId)` — no `status`, no `del_status` | Total Billed same tarah inflate |

Row-level list me saare jobs dikhana theek ho sakta hai (statement = history),
par **totals/outstanding** delivered-only hone chahiye.

### Data impact (live DB, 20 Nov 2026)

`transaction_list` wale 519 clients me se **61 clients** ke ledger repair total
canonical billed total se alag hain.

| Client | Ledger "Total Repairs" | Canonical billed (status=5) | App ke baaki pages | Reason |
| -----: | ---------------------: | --------------------------: | -----------------: | ------ |
| 186 | 4,875 | 0 | 0 | 13 jobs `status=2` (Done, deliver nahi hue) |
| 523 | 3,600 | 0 | 0 | 5 jobs `status=2` |
| 538 | 4,800 | 0 | 0 | 1 job `status=2` |
| 2 | 173,530 | 163,830 | 126,280 (due) | 18 jobs `status=2` (₹9,700) + 11 pending rows (₹0) |

Job status distribution (live):

| status | del_status | rows | amount |
| -----: | ---------: | ---: | -----: |
| 0 (Pending) | 0 | 244 | 11,800 |
| 1 | 0 | 1 | 0 |
| 2 (Done) | 0 | 123 | 118,125 |
| 4 (Cancelled) | 0 | 16 | 0 |
| 5 (Delivered) | 0 | 2,016 | 2,153,375 |

`del_status != 0` rows abhi 0 hain, isliye deleted-jobs ka impact abhi zero —
par filter code me hai hi nahi (future-proofing chahiye).

### Suggested fix (approval pending)

`ledger-print` (totals + seed) aur `print-client-ledger`:

1. Repairs total ke liye `status = 5 AND del_status = 0`.
2. Rows list me saare jobs rakhne hain to row par status label already hai —
   par running balance / outstanding delivered-only se banega.
3. Ya minimum: "Total Repairs (Delivered)" label + canonical outstanding.

> ⚠️ Ye 61 clients ke statements ke numbers badlega — business decision chahiye
> (pending job "due" hai ya nahi). Isliye abhi sirf documented hai, applied nahi.

---

## 3. Bug #3 — `print-client-ledger` "Total Paid" misleading (OPEN)

`src/app/api/print-client-ledger/route.ts`:

```ts
const totalPaid = paymentsList.reduce((s, p) => s + toNum(p.amount) + toNum(p.discount), 0);
// summary: "Total Paid" = totalPaid
```

- Math sahi hai (net balance `amount + discount` se ghatta hai).
- Par label "Total Paid" hai aur discount alag stat me nahi → cash ₹1,400
  hone par "Total Paid ₹1,500" dikhta hai (same confusion class as bug #1).

Suggested: `Total Paid = sum(amount)` (cash), alag `Total Discount` stat add karo;
net balance calculation waise hi `amount + discount` rakho.

---

## 4. Jo jagah verify ki gayi — sab consistent

| File | Kya check kiya | Result |
| ---- | -------------- | ------ |
| `src/lib/client-due.ts` | canonical due formula, `paymentCredit = amount + discount` | ✅ sahi |
| `src/app/clients/[id]/view/page.tsx` | `servicePaid = sum(amount + discount)`, status 5 billing | ✅ sahi |
| `src/app/clients/[id]/add-payment/page.tsx` | form: amount = cash, discount separate, `netAmount = amount + discount` display | ✅ sahi |
| `src/lib/ledger-data.ts` (reports/ledger) | `Cash In = p.amount`, discount `discount_amount` alag | ✅ sahi |
| `src/app/my-account/ledger/page.tsx` (client portal) | label "Payments (inc. discount)" | ✅ clear |
| `src/app/reports/top-customers/client.tsx` | settled + "inc. ₹X disc." sub-label | ✅ clear |
| `src/app/payments/components/PaymentsPageInner.tsx` | Amount / Discount / "Net Received" (= amount+discount) | ✅ sahi (label thoda generic) |
| `src/app/clients/clientLedgerQueries.ts` (seed) | `payments: totalSettled`, display subtract | ✅ sahi |
| DB `client_payments.net_amount` | generated `amount - discount` | ✅ koi code ise cash nahi samajhta |

`client_payments.loan_id` split: `null` = 842 rows, active loan = 2 rows,
`0` = 0 rows. Ledger rows query `.is("loan_id", null)` use karta hai — abhi
koi data miss nahi ho raha, par `loan_id = 0` aane par wo row table se gayab
ho jayegi (canonical `isServicePayment()` 0 ko service maanta hai). Chhota
hardening item.

---

## 5. Reproduce / re-check commands (read-only)

```sql
-- ledger vs canonical billed (top mismatches)
with all_jobs as (
  select client_name, sum(amount)::numeric amt_all
    from transaction_list where client_name ~ '^[0-9]+$' group by client_name
), billed as (
  select client_name, sum(amount)::numeric amt_billed
    from transaction_list
   where status = 5 and del_status = 0 and client_name ~ '^[0-9]+$'
   group by client_name
)
select a.client_name, a.amt_all, coalesce(b.amt_billed,0) amt_billed,
       a.amt_all - coalesce(b.amt_billed,0) diff
  from all_jobs a left join billed b using (client_name)
 where abs(a.amt_all - coalesce(b.amt_billed,0)) > 0.005
 order by abs(a.amt_all - coalesce(b.amt_billed,0)) desc;
```

Client 565 jaisa single-client check:

```sql
select amount, discount, net_amount from client_payments where client_id = 565;
-- 1400 | 100 | 1300
```

UI check: staff login → `/clients/565/ledger-print` → summary me
Payments ₹1,400 / Discount ₹100 / outstanding ₹0.

---

## 6. Next steps

1. Bug #2 par decision: pending/done jobs statement me "due" maane jayen ya nahi
   (recommendation: nahi — delivered-only, canonical ke mutabik).
2. Bug #3 fix: print route me "Total Paid" = cash + separate discount line.
3. `loan_id = 0` hardening (`.is("loan_id", null)` → `.or("loan_id.is.null,loan_id.eq.0")`)
   ya canonical `isServicePayment()` use karna.
