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
| 2 | `ledger-print` + `api/print-client-ledger` + client portal pending/non-delivered jobs ko billed amount me jodte the | ✅ **FIXED** — delivered-only (61 clients ke numbers correct hue) |
| 3 | `api/print-client-ledger` "Total Paid" = settled (cash+discount), discount alag nahi | ✅ **FIXED** — "Total Paid (Cash)" + "Total Discount" |
| 4 | `loan_id = 0` payments `.is("loan_id", null)` se table se gayab ho jate | ✅ **FIXED** — `.or("loan_id.is.null,loan_id.eq.0")` |
| 5 | Baaki app (client list, due, reports, payments, portal) consistent | ✅ verified |

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

## 2. Bug #2 — Pending / non-delivered jobs "billed" me count ho rahe (FIXED)

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

### Kahan deviates tha

| File | Purani query | Effect |
| ---- | ----- | ------ |
| `src/app/clients/[id]/ledger-print/page.tsx` | `select("amount").eq("client_name", id)` — no `status`, no `del_status` | Total Repairs + running balance me pending/done/cancelled jobs bhi |
| `src/app/api/print-client-ledger/route.ts` | `select(...).eq("client_name", clientId)` — no `status`, no `del_status` | Total Billed same tarah inflate |
| `src/app/api/client/ledger/route.ts` (client portal) | `select("amount").eq("del_status", 0)` — no `status` | Portal due me pending/done jobs |
| `src/app/clients/clientLedgerQueries.ts` (server seed) | same as ledger-print | Revert/refresh par wapas inflated |

### Data impact (live DB, 20 Nov 2026, fix se pehle)

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

### Applied fix

Chaaron jagah billable repairs ab canonical filter use karte hain:

```ts
.eq("status", 5)      // sirf Delivered
.eq("del_status", 0)  // deleted jobs nahi
```

Details:

1. `ledger-print` page + server seed: all-time totals, brought-forward aur
   row list — teeno delivered-only. Statement ab sirf billed (delivered) jobs
   dikhata hai, isliye running balance aur outstanding canonical se match karta hai.
2. Filter dropdown se Pending / In Progress / Done / Paid / Cancelled options
   hata diye (ab sirf Delivered + Payments / Direct Sale / Loan). Pending jobs
   statement ka part nahi hain, isliye unka filter bhi nahi.
3. `api/print-client-ledger`: Total Billed + repair rows delivered-only.
4. `api/client/ledger` (client portal): totals + rows delivered-only.

### Verification (fix ke baad, live dev server)

| Client | Pehle "Total Repairs" | Ab "Total Repairs" | Ab outstanding |
| -----: | --------------------: | -----------------: | -------------: |
| 565 | 1,500 (delivered hi the) | 1,500 | ₹0 (settled) |
| 186 | 4,875 | **0** | ₹0 (opening 62,250 fully paid) |
| 523 | 3,600 | **0** | ₹0 |

Client 186 me 13 "Done" jobs the jo kabhi deliver nahi hue — ab statement unhe
bill nahi karta (client list / dashboard / job forms se match).

> ℹ️ Ye 61 clients ke statements ke numbers badle hain (ledger ab canonical
> delivered-only hai). Ye intended hai — user ne confirm kiya: "statement me
> keval delivered ko hi due manana hai".

---

## 3. Bug #3 — `print-client-ledger` "Total Paid" misleading (FIXED)

Purana code:

```ts
const totalPaid = paymentsList.reduce((s, p) => s + toNum(p.amount) + toNum(p.discount), 0);
// summary: "Total Paid" = totalPaid
```

- Math sahi tha (net balance `amount + discount` se ghatta tha).
- Par label "Total Paid" tha aur discount alag stat me nahi → cash ₹1,400
  hone par "Total Paid ₹1,500" dikhta tha (same confusion class as bug #1).

Ab:

```ts
const totalPaid = ...sum(p.amount);        // cash received
const totalDiscount = ...sum(p.discount);  // discount given
const netBalance = opening + billed + sales - (totalPaid + totalDiscount);
```

Summary tiles: **Total Paid (Cash)** ₹1,400 + **Total Discount** ₹100 +
**Net Balance** ₹0 (client 565 par verified).

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
`0` = 0 rows. Pehle ledger rows query `.is("loan_id", null)` use karti thi —
abhi koi data miss nahi ho raha tha, par `loan_id = 0` aane par wo row table se
gayab ho jati. ✅ Hardened: teeno ledger queries ab
`.or("loan_id.is.null,loan_id.eq.0")` use karti hain (canonical
`isServicePayment()` 0 ko service maanta hai).

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

## 6. Next steps / remaining notes

1. ✅ Bug #2 fixed — delivered-only, canonical ke mutabik (61 clients ke
   statement numbers correct hue).
2. ✅ Bug #3 fixed — print route me "Total Paid (Cash)" + "Total Discount" alag.
3. ✅ `loan_id = 0` hardening applied in all three ledger queries.
4. 🔎 **Open (chhota, low priority):** ledger totals `client_loans` ke **saare**
   loans count karte hain, jabki canonical due sirf **active (status = 1)** loans
   + unke repayments leta hai. Aaj ke data me loan payments sirf 2 rows hain;
   agar closed loans ke saath mismatch dikhe to ise alag se align karna hoga.
5. 🔎 Statement rows me ab sirf Delivered jobs aate hain. Agar user ko "pending
   jobs bhi history ke liye dikhao" chahiye, to unhe alag (non-billing) section
   me dikhana hoga — totals me nahi milana.
6. 🎨 **UI polish (best practice):** Overall Account Summary ab sirf meaningful
   lines dikhata hai — zero-value lines (Direct Sales 0, Loans 0, Discount 0)
   auto-hide ho jati hain; core lines (Opening, Repairs, Payments, Outstanding)
   hamesha dikhengi. Label "Total Payments" → "Total Payments (Cash)" aur
   Outstanding line summary me bhi add ki (balance box ke alawa). Print route
   (`/api/print-client-ledger`) ke stat tiles bhi same conditional logic.
