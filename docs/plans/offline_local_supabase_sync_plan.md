# Offline Local DB + Online Supabase — Sync Plan

> Status: PLAN ONLY (abhi apply nahi kiya)
> Date: 2026-09-05
> Goal: Local dev machine par offline ke liye ek local DB, online ke liye hosted Supabase,
> aur dono DB ke beech sync — taaki offline me bhi kaam ho sake aur baad me online par sync ho jaye.

---

## Context / Project ke liye asli baat

- Ye project Next.js + `@supabase/supabase-js` use karta hai (package.json).
- Pura schema `supabase/migrations/` me hai + backups `backups/supabase/` me.
- RLS policies, `auth.users`, `storage` buckets, `supabase_realtime` sab Supabase me live hai.
- Capacitor/Android app bhi hai (offline-first mobile use-case ka khyal rakhna).

Isliye best approach: **dono (local + cloud) ko actual Supabase banana** (Docker + hosted),
taaki schema/RLS/auth 100% same rahe aur application code bilkul na badle.
Local ↔ Cloud switch sirf env se hoga.

---

## 3 Practical Approaches (sab valid, use-case par depend)

### Approach A — Local Supabase Docker + Cloud Mirror (SIMPLEST — Recommended start)
- Local machine par **Supabase self-hosted (Docker)** chalega — same engine, same schema, same RLS, same auth.
- Local offline dev ke liye perfect. Cloud se kabhi-kabhi mirror refresh (one-way cloud→local).
- **Pro:** zero conflict, code change nahi, safe.
- **Con:** local par dono jagah mobile-level offline nahi milta (woh Approach C ka kaam hai).

### Approach B — Full Two-way Sync (CDC) — COMPLEX
- Local Docker + Cloud dono me live bidirectional sync.
- `supabase_realtime` (WAL) + `sync_outbox` table + triggers (`updated_at`, changelog) + sync worker (cron/Next API).
- **Pro:** dono "live" aur synced.
- **Con:** conflict resolution zaroori (dono jagah same record edit → last-write-wins ya field-merge).
  Ye hidden complexity hai — isi liye sabse mehnga/risky.

### Approach C — Device Offline (Capacitor) — for REAL END-USER offline
- Mobile app me **SQLite local** + internet aane par outbox sync.
- **Ye hi actual user ko offline experience deta hai** (kabhi bhi network na ho tab bhi kaam).
- Alag project hai end-user app ke liye, dev-machine offline se nahi jude.

---

## Recommended Path

```
Step 1: Approach A banayo (Supabase Docker local + cloud→local mirror)   ← safe, start yahin
Step 2: Zaroorat pare to Approach B ka CDC sync layer upar add karo       ← optional, complex
Step 3: Mobile offline chahiye to Approach C (device SQLite) alag se      ← end-user
```

---

## Step-by-Step Implementation (jab apply karna ho)

### Step 1 — Docker + Supabase CLI
```
npm i -D supabase
npx supabase init
npx supabase start
```
- Local ports: Postgres `54322`, API `54321`, Kong `8000`.
- Isse local Supabase stack (DB, auth, storage, realtime) chal padega.

### Step 2 — Schema ko local DB par apply
Options:
- `npx supabase db reset`  (supabase/migrations/ se schema, idempotent)  ← preferred
- ya `backups/supabase/01_schema_public.sql` + roles + storage + data via `psql`

### Step 3 — Env dual config (local vs cloud)
- `.env.local` → `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` + local anon key
- `.env.cloud` → hosted Supabase URL + anon key
- npm scripts se switch:
```
"dev:local": "copy .env.local .env && next dev"
"dev:cloud": "copy .env.cloud .env && next dev"
```

### Step 4 — Sync setup

#### 4a. One-way mirror (Cloud → Local) — Approach A
```
npx supabase db dump -p <cloud-pass> -d postgres
# dump ko local par restore karo
```
- Weekly / हर start par refresh. Zero conflict.

#### 4b. Two-way sync — Approach B (CDC worker)
- `sync_outbox` table + triggers jo har INSERT/UPDATE par changelog likhe.
- `updated_at` timestamp har row me.
- Node sync worker (cron / Next API route) jo:
  - Local pull: cloud se last-sync ke baad ke rows fetch karke local me upsert
  - Local push: outbox rows cloud me push (batched, per-id)
- Conflict policy: `last-write-wins` (updated_at compare) ya field-level merge.

---

## Reality Check (imp — par baad me apply karte samay dhayan)

- "Magical bidirectional sync" nahi hota. Dono jagah same record edit ho → **conflict** aayega hi.
- Isliye Approach A se shuru karo (zero risk), baad me zaroorat par layer 2 (CDC) add karo.
- Dev-machine offline ≠ end-user offline. End-user ke liye Approach C (device SQLite) alag.

---

## Decision / Priority

| Use-case | Kya use kare | Koi jaldi |
|---|---|---|
| Dev machine offline kaam | Approach A (Docker local + mirror) | Recommended start |
| Dev machine + cloud live 2-way | Approach B (CDC) | Optional, baad me |
| End-user mobile offline | Approach C (device SQLite) | Alag module |

**Next action (jab apply karein): Step 1 — Docker + `npx supabase start` karke verify karo.**
