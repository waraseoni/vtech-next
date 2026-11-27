# ⚠️ PROJECT NOTE (must-read before any DB/data work)

PHP software retire ho chuka hai — Next.js ab main hai, par DB ka purana data
PHP conventions se aaya hai. Dual-era rules (activity_logs modules, meta_id
keys, date display) ke liye **`docs/DATA_MIGRATION_NOTES.md` zaroor padho**.

## Golden Rule: schema change = backup/restore update (bina bole)

Har migration / table / column / grants change ke saath **usi kaam me** backup
aur restore surfaces bhi update karo — user ko baar baar batane ki zarurat nahi:

- `docs/backup_restore_contract.md` me naya table/column declare karo.
- FK-parent ho to `src/lib/backupRestore.ts`, generated/identity ho to
  `src/lib/backupSchema.ts` (+ CLI/force-restore), auth-linked ho to
  `src/lib/backupAuthRestore.ts`, sequence ho to `src/lib/resetSequence.ts`.
- `src/app/backup/page.tsx` ke static fallback/converter lists ko bhi sync karo.
- Gate: `npm run verify:data` (schema:drift + backup:contract) — CI me bhi chalao.
- Purana backup naye schema par restore karte waqt naye tables delete na hon —
  backup me na hone wale tables preserve karo.

Detail: `docs/DATA_MIGRATION_NOTES.md` + `docs/backup_restore_contract.md`.

## Golden Rule: project change = AI context update (bina bole)

Koi bhi naya/change hua field, mode, filter, search key, route, business rule ya
page — **usi kaam me** AI ko bhi wo change batana hai, warna AI purani jaankari
par jawab dega:

- `src/lib/gemini-tools.ts :: buildSystemPrompt()` me naya fact/workflow/link.
- `geminiTools` tool description + parameter description (model ko pata hona
  chahiye ki nayi key se kaise pooche).
- `executeGeminiTool()` me affected table ke `.select()`/`.or()`/`.eq()` clauses
  — naya searchable identifier ho to AI bhi usse search kare.
- AI contract test `src/lib/gemini-tools.test.ts` me clamp karo (prompt, schema
  aur query clause), taaki agla agent drift na kare.
- Provider plumbing (`gemini.ts`, `groq.ts`, `/api/chat`) sirf tab badlo jab
  tool list/prompt contract badle.
- Naya searchable identifier = ek saath 5 jagah: `jobSearchFilter()`, navbar
  search, public tracker (`/api/public/job-status`), `get_jobs_stats()` RPC,
  aur AI executor. Ek bhi chhoot gayi to user ko "search nahi ho raha" milega.

Gate: focused AI test (`npx vitest run src/lib/gemini-tools.test.ts`) + schema
chhue to `npm run verify:data`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
