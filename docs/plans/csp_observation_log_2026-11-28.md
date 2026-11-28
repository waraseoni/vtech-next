# CSP observation log — 28 Nov → 11 Dec 2026

> **Mode: REPORT-ONLY.** `next.config.ts:109` me abhi `Content-Security-Policy-Report-Only` hai.
> Browser sirf violation report bhejta hai, page block nahi karta. **Abhi enforce NA.**

- Sink: `POST /api/csp-report` → `204`; violations Vercel Function Logs me `[csp-report]` ke taur par.
- Roz ~2 minute: Vercel logs kholein, `[csp-report]` lines count karein, directive + path note karein.
- Target: production me violation rate ~0.
- 14 din clean hone ke baad hi `Content-Security-Policy-Report-Only` → `Content-Security-Policy`
  (one-line flip). Rollback = wahi line wapas.
- Print routes ka nonce-CSP alag se pehle se enforced hai — is window se unrelated.

| Date        | `[csp-report]` count  | Directive / path | Action            |
| ----------- | --------------------- | ---------------- | ----------------- |
| 28 Nov 2026 | _owner check pending_ | —                | Observation start |
| 29 Nov 2026 |                       |                  |                   |
| 30 Nov 2026 |                       |                  |                   |
| 01 Dec 2026 |                       |                  |                   |
| 02 Dec 2026 |                       |                  |                   |
| 03 Dec 2026 |                       |                  |                   |
| 04 Dec 2026 |                       |                  |                   |
| 05 Dec 2026 |                       |                  |                   |
| 06 Dec 2026 |                       |                  |                   |
| 07 Dec 2026 |                       |                  |                   |
| 08 Dec 2026 |                       |                  |                   |
| 09 Dec 2026 |                       |                  |                   |
| 10 Dec 2026 |                       |                  |                   |
| 11 Dec 2026 |                       |                  | Window end        |

**12 Dec 2026 — enforcement decision:** 14 din clean → flip to enforce · violations mile →
allowlist/nonce/hash fix karein aur naya 14-din window start karein.
