# Job Item Location Tracking — Complete Guide

> **Kya hai:** Har repair job ka item (customer device) shop me **kahan rakha hai** — uska live record.
> **Kab:** Naya job banate waqt, item move karte waqt, deliver karte waqt.
> **Last Updated:** August 2026 (Phase 3 included)

---

## 1. Feature Ek Nazar Me

| Kya | Kahan |
|---|---|
| Naya job + spot choose karna | Jobs ▸ New — "Location / Spot" field |
| Item ki jagah badalna | Job Edit page ya list me jobs select karke **Move** |
| Kisi spot ka saara saman | Jobs page filter bar → **Spot** dropdown |
| Spot ke live items ki ginti | Har dropdown option ke aage `(count)` |
| Item deliver ho gaya | Status Delivered karte hi spot khali karne ka prompt |
| Quick jump | List ke "Loc" column / view page "Locate" row par click |
| **QR labels print** | Jobs filter bar ka **QR** button → `/jobs/spot-labels` |
| **Stale alert** | Jobs page upar amber banner — 7+ din se spot par pade items |

---

## 2. Concepts (Ek Baar Samajh Lo)

### Permanent vs Temporary
- **Inventory locations** (`kind='inventory'`) = spares/stock ke **permanent racks**
  — ye sirf Inventory module use karta hai. Inhe jobs me kabhi choose mat karo.
- **Job spots** (`kind='job'`) = customer items ke **temporary thehraav**
  — Counter 1, Shelf A3, Tray B... jo bhi aapke shop me hain. Sirf yahi jobs me dikhte hain.

Dono ek hi `locations` master me hain, `kind` column se alag — isliye list me kabhi gadbad nahi hogi.

### Dual-Write (technical, ek line me)
Spot choose karne par system do cheezein likhta hai:
1. `transaction_list.location_id` = spot ki id (proper link)
2. `transaction_list.uniq_id` = spot ka naam text (purane screens/search/export ke liye)

Isliye search box me "A3" type karne par bhi wahi items mil jayenge.

---

## 3. One-Time Setup

Supabase Dashboard → SQL Editor me ye file run karo (ek baar):

```
supabase/migrations/20260824_job_item_locations.sql
```

Ye automatically:
- `locations` table me `kind` column banata hai
- Purani jobs ki Location values ko spots bana kar link kar deta hai
- Kuch delete nahi karta — purana data safe

---

## 4. Daily Kaam

### 4.1 Naya Job — Intake
1. New Job form → Section 2 me **Location / Spot** field
2. Dropdown kholo — spots **khali pehle** sorted hain (`Shelf A3 · 0 items`)
3. Kam bhara spot tap karo → done
4. Naya shelf/counter aaya ho? **+ button** → naam likho ("Counter 3") → *Banao aur Select karo*
5. Save par job us spot par register ho jata hai

### 4.2 Item Aage Badha (repair → ready shelf)
Do tarike:

**Ek-do items:**
- Job Edit page kholo → Location / Spot badlo → Save

**Poori batch (recommended):**
1. List me un jobs ke checkbox lagao
2. Neeche bulk bar me **Move** button
3. Modal me naya spot chuno → *Move karo*
4. Har job ki history me log likh jata hai: `"Shelf A3 → Counter 2"`

### 4.3 Kisi Spot Ka Saman Dhundhna
Tin tarike:
- **Filter bar** → Spot dropdown → spot chuno (count dikh raha hoga)
- List me kisi bhi row ka **Loc** naam click karo → wahi spot filter ho jayega
- Search box me spot ka naam type karo (e.g. "A3")

### 4.4 Delivery Par
Bulk bar me status = Delivered karne par poochha jayega:
> *"Items client ko deliver ho rahe hain — unki location (spot) bhi khali kar dein?"*
- **OK** → item spot se hata (occupancy count kam) ✔ recommended
- **Cancel** → location rakhi rahegi (kabhi kabhi record ke liye chahiye hota hai)

### 4.5 Move-History Dekhna
Job view page ki activity timeline me har move ka record:
`Moved Job Item — Shelf A3 → Counter 2`
Kis ne move kiya, kab kiya — sab timestamps ke saath.

---

## 5. QR Labels (Printable)

Har physical spot (shelf/counter/tray) par ek chhota QR chipka do:

1. Desktop jobs page → filter bar me **QR** button
   (ya seedha `/jobs/spot-labels` URL)
2. Page par har spot ka card banta hai — naam + QR + "Scan →" hint
3. **Print Sheet** button → browser print dialog → paper par print
4. Card kaato, spot par chipka do

**Scan karne par kya hota hai:** phone se QR scan → browser me wahi spot ka
filtered jobs list khul jata hai — us spot par abhi kya-kya pada hai, live.

> **Zaroori:** Labels **production website se hi print karo** (jaise vtech ka
> live domain). Agar localhost/LAN IP par ye page khula ho to page khud amber
> warning dikha deta hai — kyunki printed QR us address ka banega jo phone
> se scan karne par kaam nahi karega.

---

## 6. Stale Alert (7+ Din Wale Items)

Jobs page ke upar amber banner aata hai:

> ⚠ *N repaired items 7+ din se spot par pade hain*

- Click karo → modal me poori list: job#, item, spot, kitne din hue
- Kisi row par tap → job view page khulta hai (customer ko call marne ke liye!)
- Banner ko modal band karne par dismiss ho jata hai (page refresh par wapas)
- Repair hone ke baad bhi customer uthane nahi aata — yahi wo list hai jo
  roz subah check karni chahiye

Count me sirf **Done / Paid** status wale aate hain — Pending/On-Progress
items normal kaam hain, wo stale nahi gine jayenge.

---

## 7. Occupancy Counts Ka Matlab

Har spot ke aage number = **us spot par abhi pade live items**
(Delivered/Cancelled gin me nahi aate).

- `Counter 2 · 0 items` = bilkul khali, naya rakne ke liye best
- `Shelf A3 · 7 items` = bhar raha hai, ab wahan kam rakho

Intake waqt spots khali-first sort hote hain — bas pehla wala chuno, shop barabar bategi.

---

## 8. Tips

1. **Naam chhota aur consistent rakho** — "Shelf A3" sahi, "shelf no a3 second" galat.
   Picker se hi choose karo, haath se mat likho — duplicates nahi banenge.
2. **Roz ka flow:** Intake → Counter 1 → (repair) → Technician Desk → Ready Shelf → Delivery
   — har step par Move karte raho, to koi item khoega nahi.
3. **Customer poochhe "aapki machine kahan hai?"** — list me job kholo, Loc column me turant dikhega.
4. Purani entry me agar Location khali dikhe to Edit page se ek baar set kar do — wo bhi track hone lagegi.
5. **Galat spelling wala spot ban gaya?** Sahi naam ka naya spot banao, purane spot
   ke items select karke **bulk Move** kar do. Purana khali spot list me `0 items`
   dikh raha hoga — use ignore karo (ya baad me Supabase se delete).
6. **QR labels ko lamination/lamination tape me lagao** — shop me dust/oil lagti hai,
   plain paper jaldi kharab hota hai.

---

## 9. Developer Notes

| Cheez | Detail |
|---|---|
| DB columns | `locations.kind` ('inventory'\|'job'), `transaction_list.location_id` FK |
| Job-spot rows | `zone=''`, `rack=<spot naam>`, `kind='job'` |
| Source of truth | `location_id`; `uniq_id` sirf readable mirror hai |
| Shared component | `src/components/JobSpotPicker.tsx` |
| Occupancy query | live = `del_status=0 AND status NOT IN (4,5)` per `location_id` |
| Stale query | status IN (2,3), `uniq_id != ''`, `status_changed_at < now() - 7d` |
| Activity logs | `'Moved Job Item'` / `'Updated Job Status'` → view page timeline |
| Migration | `supabase/migrations/20260824_job_item_locations.sql` (idempotent) |
| QR labels | `src/app/jobs/spot-labels/page.tsx` — `qrcode` package, print CSS |
| Known limits | Spot rename/delete UI nahi (SQL se karo); duplicate-spot race possible (do log ek saath same naam banayein) |
