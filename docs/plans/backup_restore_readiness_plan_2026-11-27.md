# Backup/Restore Readiness Plan — 27 Nov 2026

_Status (28 Nov 2026): **W1 LANDED locally** — format 4.0 + schema snapshot + migration IDs +
removed-column fail/override. Baaki W2–W6 ka partial progress niche gate runbook me track hai._

## Objective

Backup/restore ko **lossless, error-visible aur schema-ready** banana — yani naye schema ke
saath bina data loss ke chalna, aur jab bhi koi migration aaye to backup/restore surfaces
apne aap update honi chahiye (bina owner ke baar baar bataye).

## Current baseline (already landed locally)

- Golden rule `AGENTS.md` + `docs/DATA_MIGRATION_NOTES.md` me hai.
- `docs/backup_restore_contract.md` canonical contract hai (60 tables / 512 migration columns /
  10 surfaces), `npm run backup:contract` + CI gate chal raha hai.
- Purana backup me na hone wale **naye tables preserve** hote hain (data-loss bug band).
- Count mismatch ab error toast me dikhta hai — jhootha "100% verified" nahi.
- **Lekin** backup JSON me schema snapshot nahi, grants/RLS/functions backup nahi,
  converter/CLI static hain, auth-linked tables + sequence allowlist hard-coded hain.

## Work packages

### W0 — Foundation (done)

| ID | Kaam | Status |
|---|---|---|
| B0 | Golden rule + contract + CI gate + old-backup preserve + count-mismatch error | ✅ local `7695e0a` |

### W1 — Backup file schema-aware banana (P0)

| ID | Kaam | Detail |
|---|---|---|
| B1 | `_meta.schema_snapshot` add karo | Har backup me `{captured_at, tables: {cols, pk, notNull, generated}, migration_ids}` likho. Browser + server + CLI tino writers. |
| B2 | Backup format version `4.0` | Purane `3.0`/`v2` files padhne ke liye backward-compatible reader rakho. Version constant nahi rahega. |
| B3 | Restore validation snapshot-aware karo | Snapshot ho to rename/type-change/removed column detect karo; purana file ho to explicit `legacy` warning + owner confirmation. |
| B4 | Removed-column policy | Dry-run me dikhao ki kaunse columns drop honge; silent data drop mat karo. |

**W1 result (28 Nov 2026, local):** B1 ✅ (`buildSchemaSnapshot` shared helper; browser/server/CLI
+ converter writers), B2 ✅ (`4.0` writers + non-blocking legacy reader with warning), B3 ✅
(version warning preview + toast; snapshot capture), B4 ✅ (dry-run **aur** real restore fail by
default; opt-in checkbox / `--allow-removed-columns`). Tests:
`src/lib/backupSchema.test.ts`, `src/lib/scheduledBackup.test.ts`.

### W2 — Restore correctness (P0)

| ID | Kaam | Detail |
|---|---|---|
| B5 | Clear policy explicit karo | Dry-run preview me "ye tables clear honge / ye preserve honge" dikhao; empty-array vs missing-key ka matlab document karo. |
| B6 | Hard-fail semantics | `verifyFails` > 0 par success toast nahi; report me per-table file vs DB count. |
| B7 | New NOT NULL column handling | Dry-run me missing required cells ke liye clear repair hint; insert error se pehle rok. |
| B8 | Generated/identity single source | `GENERATED_COLUMNS` browser/CLI/force-restore me duplicate nahi — snapshot/shared module se derive karo. |

### W3 — CLI/server + converter parity (P1)

| ID | Kaam | Detail |
|---|---|---|
| B9 | FK-first order shared karo | `scheduledBackup.ts` + `supabase-json-backup.mjs` + `force-restore.cjs` ko `backupRestore.ts` ki ordered list se feed karo; reverse-clear bhi wahi kare. |
| B10 | Converter sync | `public/tools/vtech_mysql_converter.html`: naye tables (brands, service_types, brand_job_counters, device_models, device_identifiers) + bool columns (`expects_fault`, `is_authorized`, `is_active`) add karo; table list contract se generate karo. |

### W4 — Auth + sequence (P1)

| ID | Kaam | Detail |
|---|---|---|
| B11 | Dynamic auth map | 8 hard-coded auth tables ki jagah snapshot me `auth.users` FK se tables/UUID columns nikaalo. Admin profile preserve logic bani rahe. |
| B12 | Dynamic sequence allowlist | Serial/identity columns snapshot se nikaal kar `resetSequence.ts` allowlist generate karo; unknown sequence ke liye visible warning. |

### W5 — Security / DR semantics (P1)

| ID | Kaam | Detail |
|---|---|---|
| B13 | JSON restore ki seema document karo | Grants/RLS/functions/triggers JSON me nahi jaate — target DB par pehle migrations apply hona zaroori. Guide + backup page me clear note. |
| B14 | RLS-scoped backup guard | Browser backup sirf staff/admin se; table count 0 aur user role suspect ho to "empty verified backup" mat dikhao. Server/CLI service-role preferred. |
| B15 | Offsite + drill | `docs/BACKUP_GUIDE.md` me documented restore drill + rollback; owner staging me confirm. |

### W6 — Tests + rollout (P0 before claiming ready)

| ID | Kaam | Detail |
|---|---|---|
| B16 | Round-trip fixture test | staging par backup → restore → count/hash match. |
| B17 | Old-backup-vs-new-schema fixture | naye tables preserve, removed column warning, NOT NULL block — teeno cases. |
| B18 | Converter output test | boolean columns `true/false`, naye tables present. |
| B19 | Browser smoke | `/backup` page: schema fetch, dry-run, error toast, sequence reset (owner admin se). |
| B20 | Gate set | `npm run verify:data`, `tsc`, touched `eslint`, `vitest` (naye tests ke saath), `build`, prettier (touched). |

## Acceptance criteria (inhe pure bina hi "ready" bolna hai)

1. Fresh backup + restore ke baad **har table ka row count aur PK set match**.
2. Purana backup naye schema par restore karne par **naye tables ki data safe**.
3. Removed/renamed/type-changed column par restore **silent loss nahi** — dry-run ya error.
4. Grants/RLS/functions ka missing hona **documented aur visible**.
5. CLI/server/converter aur browser tooling **ek hi contract** follow karte hain.
6. `npm run verify:data` + CI green; owner staging me live drill confirm.

## Owner decisions — final (28 Nov 2026, agent ko choose karne diya gaya)

- ✅ **Format 4.0** — purane 3.x/2.x files `legacy` warning ke saath padhte hain (hard-block nahi):
  disaster recovery me purana backup bhi kaam aana chahiye.
- ✅ **Removed column → FAIL + explicit override** —silent drop sabse bada data-loss risk tha;
  ab dry-run aur real restore dono fail karte hain, opt-in sirf checkbox / CLI flag se.
- ✅ **Migration IDs haan** — local `supabase/migrations/*.sql` filenames snapshot me store (live DB
  me migrations table nahi hai), taaki restore ke baad schema verify ho.
- ✅ **Live restore drill (test DB)** — owner ne `.env.local` wali test DB par restore test ki
  ijazat di. Fresh `4.0` backup → browser `Restore Now`: **42 rows 100% restored + count verified**,
  60/60 table counts same (`108 → 108`), 48/48 sequence reset `200`, `peek_next_job_id()=28107`.
  Auth-linked 8 tables + `ai_providers` is round-trip me preserve rahe. Production par abhi bhi
  destructive restore nahi chalaya gaya.
- ✅ **Auth/RLS skip default ON** — owner ke poori file wale restore me `profiles` (6) aur
  `user_presence` (2) RLS/UUID mismatch se FAIL hue, par data safe raha. Ab browser restore
  9 tables (8 auth-linked + `ai_providers`) ko auto-skip karta hai; inhe service-role Admin
  Restore se hi restore karein.

## Standing rules (badalte nahi)

- Schema/migration change → backup/restore surfaces usi kaam me update (`npm run verify:data`).
- Commit/push sirf owner approval par; final version bump/release owner bole tabhi.
- Secrets print nahi; service-role browser me nahi. Agent sirf **test DB** par owner-ijazat se
  read/write karta hai; prod URLs/DB kabhi touch nahi.
- Masters deactivate-only; global `job_id`/counter/index untouched.

---

_Created: 27 Nov 2026 · Source: backup/restore audit + `docs/backup_restore_contract.md`_
