# V-Tech PRO — Repair Shop Management SaaS

V-Tech PRO is a white-label SaaS platform for repair shop management (stage lighting,
industrial electronics, power supply repair). A "seller" deploys separate instances for
each client; each instance is licensed independently.

Built with **Next.js (App Router) + Supabase + React 19 + Tailwind CSS v4**, with PWA
(Serwist), Android packaging (Capacitor), and AI assistance (Gemini + Groq).

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Database & Auth | Supabase (Postgres + Auth + Storage) |
| Styling | Tailwind CSS v4 |
| PWA | Serwist (service worker + web push) |
| Android | Capacitor |
| AI | Google Gemini + Groq (tool calling) |
| Charts | Recharts |
| Testing | Vitest + Testing Library |
| Linting / Formatting | ESLint + Prettier |

## Getting Started

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase + API keys
npm run dev                  # LAN-accessible (mobile testing)
# or
npm run dev:local            # localhost only
```

Open [http://localhost:3000](http://localhost:3000).

See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for a full production
deployment walkthrough (Supabase setup, Vercel deploy, licensing, backup/restore).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server on 0.0.0.0 (LAN/mobile accessible) |
| `npm run dev:local` | Dev server on localhost only |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm test` | Run Vitest tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Verify formatting (CI) |

## Key Directories

```
src/app/        # App Router routes (dashboard, jobs, clients, inventory, reports...)
src/components/ # Shared UI components
src/lib/        # Services & utilities (supabase, auth, license, AI, push...)
src/app/api/    # API routes (auth, print, images, license, sync...)
supabase/       # Database migrations (SQL)
docs/           # Deployment, migration, user & licensing guides
```

## Architecture Notes

- **Data migration conventions** — the DB carries legacy PHP-era data. Follow
  `docs/DATA_MIGRATION_NOTES.md` for dual-era rules (activity_logs modules, `meta_id`
  keys, date display) before any data work.
- **Licensing** — each instance is gated by a central licensing service
  (`src/lib/license.ts` + `src/app/api/license/*`).
- **Module system** — clients can toggle business modules via `src/lib/modules.ts`.
- **Session policy** — unified 30-min idle / 8-hour absolute timeout in
  `src/lib/session-policy.ts`.

## Testing

Tests use Vitest (`jsdom` environment). Pure-logic modules in `src/lib/` are the
primary test targets (e.g. `dateUtils.test.ts`, `status-colors.test.ts`).

```bash
npm test
```

## Deployment

Deploy to **Vercel**. Client instances are standalone Vercel projects wired to their
own Supabase project and license. Full guide: `docs/DEPLOYMENT_GUIDE.md`.

## License

Proprietary. Licensed per-client through the central licensing service.
