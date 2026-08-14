# Licensing System — Seller Guide

Ye document batata hai ki license system kaise kaam karta hai aur aap (seller)
naya customer kaise add karte hain.

## Kaam kaise karta hai

- Har shop apne **apne** Supabase project par app chala raha hai (data uski DB mein).
- **License check central project par hota hai** — ek alag chhota Supabase project
  jo aapke paas hai (`docs/licensing/central-project.sql`).
- Shop ke admin Settings → License Activation mein key daalta hai.
- App server-side par central project ka RPC `activate_license()` call karta hai:
  - Key valid hai? Plan/expiry kya hai?
  - Is shop (instance) pehle se activate hai? (refresh last_seen)
  - Nahi to max_activations ke under to hai?
- Success par shop ke `system_info` mein status save hota hai.
- **Daily re-check**: har 24h mein ek baar app central ka `check_license()` RPC
  call karta hai taaki expiry/renewal asli ho. Central unreachable ho to grace:
  last saved status se chalta hai (offline shop ko koi dikkt nahi).

## License enforcement (login gate)

- **Login hamesha allowed hai** — license ki wajah se kabhi login block nahi hota.
- Login ke **baad** agar license active nahi (trial / expired / disabled) to pura
  dashboard block ho jata hai aur **full-screen License Gate** dikhta hai:
  - Admin: gate mein hi naya key daal kar turant activate kar sakta hai
    (Settings tak jaane ki zaroorat nahi).
  - Staff/client: "shop ke admin/seller se contact karein" message.
  - Har jagah **Logout** button — koi bhi kabhi atka nahi.
- Expired hone par renewal itna aasan: seller `expires_at` update kare → client
  login kare → gate dikhe → same key se re-activate → app chale.

## Setup (ek baar, seller ke liye)

1. **Central project banao**: https://supabase.com → New Project (koi bhi region,
   free plan kaafi hai). Naam: `vtech-licensing`.
2. **SQL run karo**: Supabase dashboard → SQL Editor → `docs/licensing/central-project.sql`
   paste → Run.
3. **API keys lo**: Project Settings → API → Project URL + anon (public) key.
4. **App mein daalo**: har shop ke deploy par `.env`/`.env.local` mein:
   ```
   LICENSE_SERVICE_URL=https://xxx.supabase.co
   LICENSE_SERVICE_ANON_KEY=eyJ...
   ```
   (Ye dono public-safe hain — RLS sirf RPC functions allow karta hai.)

## Naya customer activate karna (har bechne par)

Dashboard → Table Editor → `public.licenses` → **Insert row**:

| column | value |
| --- | --- |
| license_key | `VTC-XXXX-XXXX-XXXX-XXXX` (naya random) |
| shop_name | Customer ki shop ka naam |
| owner_name / owner_email | Customer ke details (bill ke liye) |
| plan | `standard` (1 shop) ya `premium`/`lifetime` |
| max_activations | 1 (standard) — jitne PCs/instances allowed |
| expires_at | NULL = lifetime, ya koi date |
| status | `active` |

> ⚠️ **Har customer ko ALAG key do.** Same key ek se zyada shops mein mat daalo —
> `max_activations` ke baad `MAX_ACTIVATIONS` error milega.

Key format: `VTC-` + 4 groups of 4 alphanumeric (uppercase), e.g.
`VTC-K7Q2-M9PL-5RTX-WN4A`. Aap khud koi generator use kar sakte ho ya manually.

## Customer ko kya bolna hai

> "Settings → License Activation mein ye key daalein: `VTC-XXXX-XXXX-XXXX-XXXX`.
> Activate dabao — ho gaya. Ek key ek shop ke liye hai."

## Billing/revoke

- **Renewal**: `expires_at` badal kar nayi date de do → customer app mein dobara
  activate (key same) karega to status refresh hoga.
- **Revoke/disable**: `licenses.status = 'disabled'` karo → naya activation block,
  aur `activations` table se shop ka activation delete kar do (ya `deactivate_license`
  RPC call karo with activation_id).
- **Instances check**: `activations` table se dekho kaunsa shop kab activate hua.

## Seema (kya koi code bypass kar sakta hai?)

- Ye system ek **standard phone-home license** hai — non-technical shop owners ko
  rokne ke liye kaafi hai. Koi expert developer source copy karke `activate` API
  ke success check ko hatana/forge karna technical rehta hai.
- **Hard-block is abhi**: bina valid license ke dashboard block hai (login chhuat).
- Soft mode hata diya gaya hai — ab `status` endpoint `valid` flag return karta
  hai aur RootClient gate us par render hota hai.
- Isse aur kathor banana hai to:
  1. Har data API route (clients/jobs) ke andar license check add karo.
  2. `LICENSE_ENFORCE=strict` — login ke time par bhi server-side verify.

## Client Package + Setup Page (naye client ko kya dena hai)

> **Naye client ka Supabase project banate time schema lagane ke liye
> [`supabase-cli-guide.md`](./supabase-cli-guide.md) padho** — CLI install se
> dump nikalne tak, step-by-step (Windows/PowerShell).

Client ke liye ready-to-deploy package banane ka system:

1. **Setup page** (`/setup`) — har client package mein built-in. Pehli baar kholne
   par admin apna naam/email/password set karta hai (one-time; admin banne ke baad
   page lock ho jata hai).
2. **API keys** — `scripts/make-client-package.mjs` har client ke liye
   `packages/<slug>/` folder banata hai jisme `.env.production` (client ke apne
   Supabase keys + license service keys + optional `SETUP_TOKEN`) hota hai.
3. **SETUP_TOKEN (optional)** — `/setup` par admin banana is token ke bina possible
   nahi. Har client ko alag token do.

### Developer portal — Setup Kit Generator (sab web se, koi CLI nahi)

Developer page (`/developer`) par ab poora **Setup Kit Generator** built-in hai:

- Har client ki row par **"Create Package"** button.
- Click → modal khulta hai jisme Supabase keys (URL/Anon/Service Role) + App URL
  bharte ho. Pehle se stored creds hain to khud bhar aate hain.
- **"Generate & Download"** → server package build karke zip download karta hai
  (`/api/developer/setup-kit/<licenseId>`, POST).
- "Credentials save karo" checkbox on rahe to wo keys encrypted central DB mein
  save ho jati hain — dobara package banane par prefill hoti hain (aur seller
  portal ko bhi dikhti hain).
- Setup token khali chhoro to auto derive hota hai (seller secret se HMAC);
  kuch custom chahiye to khud likh sakte ho.

Files: `src/app/developer/page.tsx` + `src/app/api/developer/setup-kit/[licenseId]/route.ts`.
Builder `src/lib/setup-kit.ts` teeno jagah (CLI, seller portal, developer portal)
ka ek hi source of truth hai — output format hamesha same.

### Seller portal se setup kit download (recommended)

Client Details page par **"Download Setup Kit"** button hai:

- Stored credentials (Supabase URL + anon + service role) + license se **`.zip`**
  package banata hai (`/api/seller/setup-kit/<licenseId>`).
- `SETUP_TOKEN` automatically derive hota hai per client (seller secret se HMAC) —
  har client ko ek stable token, zip ke `.env.production` + `SETUP.md` mein.
- Koi key missing ho (jaise Supabase service role) to button se pehle **Save
  Credentials** karna hota hai — API error batata hai.
- Content builder `src/lib/setup-kit.ts` shared hai CLI script se — dono ka
  output same format.
- Zip format bina dependency ka store-only writer hai (deploy-agnostic).

> ⚠️ `SETUP_TOKEN` seller ke `SELLER_CREDS_ENCRYPTION_KEY` (ya service role key)
> se derive hota hai. Wo secret rotate karo to purane kits ke setup token invalid
> ho jayenge — naya kit download karke client ko bhejna padega.

Use (CLI alternative):
```bash
cp scripts/clients.sample.json scripts/clients.json   # values bharo (git-ignored)
node scripts/make-client-package.mjs                  # sab packages banao
node scripts/make-client-package.mjs --zip            # zip ke saath
```

> ⚠️ Client package mein **seller portal vars nahi jaate** (`LICENSE_SERVICE_SERVICE_ROLE_KEY`,
> `SELLER_PORTAL_PASSWORD`, `DEV_PORTAL_PASSWORD`) — isliye client ke admin ko
> navigation mein **Seller Portal / Developer NAHI dikhte**. Bas normal dashboard +
> Settings (jisme License Activation hai) dikhta hai.

## Seller / Developer Portals (in-app)

Dono portals **isi app ke andar** hain aur sirf seller ke APNE deployment par
chalti hain (customer shops par 403). Inhe on karne ke liye `.env`/`.env.local` mein:

```
# central licensing project ka Service Role key (customer ke deploy par kabhi nahi!)
LICENSE_SERVICE_SERVICE_ROLE_KEY=eyJ...
SELLER_PORTAL_PASSWORD=strong-seller-password
DEV_PORTAL_PASSWORD=strong-dev-password
```

> ⚠️ `LICENSE_SERVICE_SERVICE_ROLE_KEY` se central DB par **full CRUD** khulta hai —
> isliye ye sirf aapke deployment par hi set rahe. Bina in vars ke
> `/seller`, `/developer` aur unke API routes sab 403/503 dete hain.

**Seller Portal — `/seller`** (admin login + seller password):
- Naya client add karo → server **key auto-generate** karta hai (`VTC-XXXX-...`)
- Avdhi (expires_at), plan, max_activations set karo
- List: har client ki key, shop, owner, instances, expiry, last-seen
- Renewal / edit / disable / revoke / delete, copy-key button

**Developer Portal — `/developer`** (admin/developer login + dev password):
- View-only stats: kitne clients ko license diye, kitne active/expired, 30 din
  ke andar kitne expire honge, har client ki exact expiry date + days-left.

**"Double password"** = app login (password 1) + portal password (password 2,
server-side env se verify, HMAC-signed HttpOnly cookie 6h).

**Developer role:** `profiles.role = 'developer'` — admin ke barabar trusted
(hoga hi `Users` page se create kiya ja sakta hai). Usi tarah licensing stats
dekh sakta hai.

## Files

- `docs/licensing/central-project.sql` — central DB migration (seller ke project par)
- `docs/licensing/supabase-cli-guide.md` — Supabase CLI install → schema dump → client project guide
- `src/lib/license.ts` — client + key validation + activation id
- `src/lib/license-admin.ts` — seller-side CRUD (service role, server-only)
- `src/lib/portal-auth.ts` — portal password + signed cookie auth
- `src/app/api/license/activate/route.ts` — activation endpoint
- `src/app/api/license/status/route.ts` — status + daily re-check endpoint
- `src/app/api/seller/*` — seller CRUD endpoints
- `src/app/api/developer/*` — developer stats endpoints
- `src/components/LicenseGate.tsx` — login ke baad full-screen license gate
- `src/components/PortalGate.tsx` — portal double-password gate
- `src/app/seller/page.tsx` — Seller License Manager UI
- `src/app/developer/page.tsx` — Developer licensing overview UI
- `src/components/LicenseBanner.tsx` — inline fallback banner
- `src/app/settings/page.tsx` — Settings mein License card
- `.env.example` — `LICENSE_SERVICE_URL` / `LICENSE_SERVICE_ANON_KEY` / portal vars
