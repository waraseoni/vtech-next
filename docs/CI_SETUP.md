# CI/CD Setup (GitHub Actions)

Ye project `.github/workflows/ci.yml` (GitHub Actions) se CI/CD chalta hai. Har push/PR
par `main` branch ko do jobs check karte hain:

1. **quality** — lint, typecheck, tests, formatting
2. **build** — production build (sirf `quality` pass hone par)

## Required GitHub Secrets

`build` job production build chalti hai. Isliye neeche diye secrets **configure kiye
jane chahiye** GitHub repo ke **Settings → Secrets and variables → Actions** mein.
Inke bina `build` job fail ho jayegi.

| Secret name | Kahan se milega | Zaroori? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Project Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Project Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Project Settings → API (service_role) | ✅ |

> **⚠️ Security note:** `SUPABASE_SERVICE_ROLE_KEY` service-level access deta hai. GitHub
> secret ke roop mein hi rakho — kabhi frontend/anon code mein mat daalo.

### Quality job ke liye secrets kyun nahi chahiye?

`lint`, `typecheck`, `test` aur `format:check` ko koi ke env var nahi chahiye — inka
kone koi runtime DB/API call nahi hota bina actual run ke. Isliye `quality` job bina
secrets ke poori tarah chalti hai.

## Adding secrets (GitHub UI)

1. GitHub repo kholo → **Settings** tab
2. Left sidebar → **Secrets and variables** → **Actions**
3. **New repository secret** dabao
4. Naam (e.g. `NEXT_PUBLIC_SUPABASE_URL`) aur value daalo
5. Same process teeeno secrets ke liye repeat karo

## Local verification

CI ke same steps locally verify karne ke liye:

```bash
npm run lint          # quality
npm run typecheck     # quality
npm test              # quality
npm run format:check  # quality
npm run build         # build (local .env.local se vars mile hain)
```

## CI flow (dashboard)

- **PR** — PR ke andar inline checks dikhte hain (quality + build)
- **Push to main** — push ke saath ci run hota hai; checks pass nahi to merge block

> Vercel ka apna git-integrated deploy bhi chal sakta hai — GitHub Actions CI ek
> independent safety net hai jo deploy se pehle regressions pakadta hai.
