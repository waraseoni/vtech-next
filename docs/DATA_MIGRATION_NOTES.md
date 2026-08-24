# ⚠️ MUST-READ: PHP → Next.js Migration Conventions

> **Ye note har bug-fix / naye feature se PEHLE padho.** Isme woh rules hain jo
> batate hain ki purana (PHP-yug) data kaise dikhna chahiye aur naya data kaise
> likha jaana chahiye.

## Background

- Pehle main software **PHP** tha. Next.js project uske DB aur logic se bana.
- Ab **Next.js hi main project hai; PHP retire ho chuka hai.**
- DB ka bada hissa PHP ke DB se migrate hua — tables/columns wahi hain, par
  **naam aur conventions me antar hai** (PHP me "Transactions", Next.js me "Jobs").
- Purana data dheere-dheere purane conventions ke saath rahega; naya data naye
  conventions se likha jayega. Kisi din legacy branches hat jayengi — tab tak
  **readers dono yug samjhein, writers sirf naya convention follow karein.**

## Golden Rule

> **PURANA DATA PURANE RULES SE PADHO, NAYA DATA NAYE RULES SE LIKHO.**
> Kabhi bhi purane data ko wholesale naye format me convert mat karo, aur kabhi
> bhi naye code ko sirf legacy convention par lock mat karo. Dono ka coexistence
> hi transition strategy hai.

## activity_logs — Dual-Era Conventions (sabse zaroori)

Ek hi table `activity_logs`, par dono systems ne apne-apne rules se likha:

| Yug | module | action (status change) | meta_id ka matlab |
|---|---|---|---|
| **Legacy (PHP)** | `Transactions` | `Transaction Status Changed` | `transaction_list.id` (internal PK, chhota number) |
| **Modern (Next.js)** | `Jobs` | `Updated Job Status` | ~~`job_id` string~~ → **ab canonical `transaction_list.id`** (Aug 2026 se) |

### Reader rule
- Status-date / stale-time nikalte waqt **dono yug alag-alag query karo**
  (`fetchStatusChangeLogs("legacy" | "modern")` in `src/app/jobs/page.tsx`),
  phir lookup me **dono keys try karo**: pehle `txn.id`, phir `txn.job_id`.
- Ek hi mixed `.in(module:[...])` + mixed meta_id list bhi chalta hai, par
  key-collision ka risk hota hai (ek row ka `id` dusri row ka `job_id` ho sakta
  hai) — isliye era-wise targeted queries hi sahi hain.

### Writer rule
- Naye logs **hamesha canonical PK (`transaction_list.id`) ko `meta_id`** banao,
  human-readable job number sirf `details` text me.
- Module = domain naam naye style me (`Jobs`, `Clients`, `Sales`...).

## Date/Time Display Rule

- **Delivered (status=5):** `date_completed`
- **Baaki statuses:** latest status-change log (upar wala dual-era reader)
- **Kabhi bhi `date_updated` ko "status date" mat dikhaao** — sync/migration/
  triggers rows ko bulk-touch kar dete hain (aaj ki date dikh jaati hai jabki
  status mahino purana ho). Logs na mile to **date chhupa do** — jhooti date se
  better.
- `date_updated` sirf *stale-detection* fallback ke liye theek hai (approx),
  display ke liye kabhi nahi.

## Naam-Antar Map (jo abhi pata hai)

| PHP duniya | Next.js duniya | Same cheez? |
|---|---|---|
| module `Transactions` | module `Jobs` | Haan — repair jobs |
| `uniq_id` (spot label) | `locations` table (`kind='job'`) + `transaction_list.location_id` | Purani text-label vs nayi FK system |
| Job "number" (`job_id` col, e.g. `28201`) | Display-only identifier | PK alag hai: `transaction_list.id` |
| — | `status_changed_at` column | **DB me exist NAHI karta** — derived hota hai |

Naya antar milte hi is table me add karo.

## Aage Ke Liye Checklist (har DB-related change par)

1. Kya ye reader purane logs/data ko bhi padh payega?
2. Kya ye writer naye canonical convention se likh raha hai?
3. Kya maine `date_updated` ko kahin display ke liye use kiya? (Mat karo)
4. Fallbacks: missing data par **kuch-na-dikhao** ya approx — jhooti fresh date kabhi nahi.

---
*Banaya gaya: Aug 2026 — jab jobs-page status-date bug (#28201 par aaj ki date)
iske root cause (dual-era log conventions) se mila.*
