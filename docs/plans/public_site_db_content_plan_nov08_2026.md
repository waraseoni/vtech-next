# Public Site — `system_info` se fully DB-driven content

Created: 2026-11-08 · Revised: 2026-11-08 (expert review + UI/UX review) · Status:
**IN PROGRESS — WS-0…WS-7 + WS-8a/8b/8c + WS-8e FAQ + GPS map/share implemented
(uncommitted); zero DB writes; WS-8d/8e ke bache hue polish items pending**
Scope: public website only (`/`, `/about`, `/contact`, `/stage-lighting`, `/industrial`,
`/power-supply`, `/job-status`, `/login` ka public shell). Dashboard/app routes is plan se
bahar hain.

---

## 0. TL;DR

Aaj public site ka data **teen jagah** se aa raha hai:

1. **Vercel build-time env** (`NEXT_PUBLIC_SITE_*`) — redeploy ke bina change nahi hota.
2. **DB `system_info`** — lekin sirf `/api/system-info` ke through **8 fields**, aur wo bhi
   hydration ke **baad** client-side; pehla paint env fallback dikhata hai.
3. **TSX me hardcoded** — hero copy, stats, testimonials, team, equipment lists, steps,
   section headings — sab code me.

Matlab: seller (V-Technologies) pages par phone/address bhi env se aate hain, jabki branded
pages par wahi fields DB se. Isliye user Settings me change kare to kuch pages update hote
hain, kuch nahi.

Target: **`system_info` single source of truth**, server-first load, typed defaults,
Settings me "Website" editor, aur save par on-demand revalidation — taaki user bina
redeploy, bina env change, apni site ka **saara customer-facing content** khud update kar
sake. **Koi schema migration nahi chahiye** — ek `site_content` JSON row + already-existing
firm keys kaafi hain. Content ke saath public **UI/UX polish (WS-8, findings §1.6)** bhi is
plan me hai — conversion, accessibility aur local trust improve karne ke liye.

> **Locked decision (2026-11-08):** public site ka maujooda static/hardcoded content
> **hataaya nahi jayega**. Wo permanent default + fallback rahega. DB me sirf wahi field
> override karega jo actually set ho; missing/blank/invalid DB value → wahi static content
> render hoga. Yaani DB empty hone par site **aaj jaisi hi** dikhegi.

> **Revision note (2026-11-08):** expert review ke baad plan me ye additions kiye — duplicate
> `meta_field` handling, single `updatedAt` source, save-route audit/size-cap/partial-failure
> reporting, disabled-service 404, SEO completeness (sitemap/JSON-LD/canonical), WS-5 ka
> MVP split, aur naya **WS-8 UI/UX polish** workstream. `site_mode` ka deployment-level vs
> runtime decision §9 me recommend kiya gaya hai.

---

## 1. Research findings — abhi kya kahan se aa raha hai

### 1.1 Source layers

| Layer          | Source                                                | Kab update hota hai                          | Kahan use hota hai                                                                          |
| -------------- | ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Build-time env | `NEXT_PUBLIC_SITE_*` (Vercel Project Env)             | Redeploy par                                 | `src/app/(public)/site.ts`, root `src/app/layout.tsx` metadata, QR share, seller-full pages |
| Runtime DB     | `system_info` → `GET /api/system-info` (service role) | Page load ke baad (client fetch, `no-store`) | Public layout, branded home/about, contact — sirf 8 fields                                  |
| Hardcoded TSX  | Repo code                                             | Code deploy par                              | Hero copy, stats, testimonials, team, equipment lists, steps, badges, CTAs                  |

Public routes abhi **static prerendered** hain (`.next/prerender-manifest.json`: `/`,
`/about`, `/contact`, `/industrial`, `/job-status`, `/power-supply`, `/stage-lighting`).
Client-side DB fetch hydration ke baad hoti hai — isliye first paint env/hardcoded hota
hai, phir value swap hoti hai (flash + SEO mismatch ka risk).

### 1.2 Env keys aur unka actual use

| Env var (`src/app/(public)/site.ts`)     | Public site par use                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_NAME`                  | Nav/footer brand, copyright, QR share. **Saath hi `IS_BRANDED` mode decide karta hai** |
| `NEXT_PUBLIC_SITE_SHORT_NAME`            | Public site par **unused** (sirf Settings preview)                                     |
| `NEXT_PUBLIC_SITE_TAGLINE`               | Hero badge, about title, footer line, QR share                                         |
| `NEXT_PUBLIC_SITE_OWNER`                 | About story (seller-full only)                                                         |
| `NEXT_PUBLIC_SITE_PHONE` / `_PHONE_HREF` | Seller-full home, about, services CTA band                                             |
| `NEXT_PUBLIC_SITE_WHATSAPP`              | Seller-full home floating button                                                       |
| `NEXT_PUBLIC_SITE_EMAIL`                 | Contact strip (branded), contact page                                                  |
| `NEXT_PUBLIC_SITE_ADDRESS`               | Footer, about "Visit workshop" (seller-full)                                           |
| `NEXT_PUBLIC_SITE_SERVICES`              | Nav dropdown/footer/home me kaunse service pages dikhein                               |
| `IS_BRANDED`                             | Build-time switch: branded minimal site vs seller full site                            |

Root metadata (`src/app/layout.tsx:12-38`) bhi `NEXT_PUBLIC_SITE_NAME/TAGLINE` se banti hai —
browser tab/PWA/OG title DB change se nahi badlega.

### 1.3 DB keys jo already hain (aur public site kya use karti hai)

`GET /api/system-info` (`src/app/api/system-info/route.ts:26-54`) sirf ye return karta hai:

| API field          | DB key                                | Note                                                    |
| ------------------ | ------------------------------------- | ------------------------------------------------------- |
| `shop_name`        | `name`                                |                                                         |
| `short_name`       | `short_name`                          | Public site use nahi karti                              |
| `phone`            | `contact`                             | `+91` prefix format                                     |
| `whatsapp`         | `contact`                             | **Bug:** alag `whatsapp` key ignore hoti hai            |
| `email`            | `email`                               |                                                         |
| `address`          | `address`                             |                                                         |
| `business_hours`   | `biz_days` + `biz_open` + `biz_close` | 12-hour format                                          |
| `established_year` | `established_year`                    | **Settings ise kabhi save nahi karti**; fallback `2007` |

DB me already maujood lekin public site par **bilkul unused**:

`logo`, `cover`, `whatsapp`, `map_url`, `map_iframe` (legacy), `facebook`, `instagram`,
`youtube`, `footer_text`, `announcement`, `short_name`, `gstin`.

RLS anon SELECT whitelist in keys tak hi hai
(`supabase/migrations/20260913000000_final_full_schema_idempotent.sql:2269-2270`) — lekin
content API service-role se chalti hai, isliye policy change ki zaroorat nahi.

> Schema note: `system_info.meta_field` par **unique constraint nahi hai** (PHP-era table,
> `.../20260913000000_final_full_schema_idempotent.sql:455`). Isliye `upsert({ onConflict })`
> par bharosa na karein — existing `select id → update/insert` pattern use karna hai.

### 1.4 Page-wise content source (detailed)

| Page / section                   | Abhi ka source                                                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout nav/footer**            | Brand/phone/email/address/hours DB-after-hydration; tagline env; footer "since {year}" hardcoded `2007`; nav links hardcoded; services env                                                                                                                                 |
| **Home (seller-full)**           | Hero headings/subtitle hardcoded; tagline env; 3 pillars env services + hardcoded labels/desc; stats hardcoded (`27000+`, `17+`, `5000+`, `100%`); 8 featured repairs hardcoded; 6 "Why Us" cards hardcoded; 4 testimonials hardcoded; phone/WhatsApp env; floating WA env |
| **Home (branded)**               | Name/phone/email/address DB-after-hydration; tagline/subtitle hardcoded-ish; services env; contact strip DB; CTA copy hardcoded                                                                                                                                            |
| **About (seller-full)**          | Title me literal "V-Technologies"; "Since 2007" hardcoded; 3 stats hardcoded; story 3 paragraphs (owner env); quote hardcoded; 3 badges; 3 "Why" cards; 3 team members; 2 testimonials; address/phone env                                                                  |
| **About (branded)**              | Name/phone/email/address DB; tagline/owner env; headings + contact labels hardcoded                                                                                                                                                                                        |
| **Contact**                      | 5 service options hardcoded; contact cards DB-after-hydration; hero/labels/copy hardcoded                                                                                                                                                                                  |
| **Stage Lighting**               | 12 equipment items; 3 steps; 4 points; hero + headings env-independent hardcoded                                                                                                                                                                                           |
| **Industrial**                   | 10 equipment items; 3 steps; 4 points; hardcoded                                                                                                                                                                                                                           |
| **Power Supply**                 | 6 equipment items; 3 steps; 4 points; EV charger highlight (4 chips + 3 images + CTA); hardcoded (phone env)                                                                                                                                                               |
| **Shared blocks** (`blocks.tsx`) | CTA band copy + phone env; branded 3 feature cards + "Kisi bhi repair ke liye {phone}" hardcoded                                                                                                                                                                           |
| **Login page footer**            | Name/phone env                                                                                                                                                                                                                                                             |
| **QR share modal**               | Name/tagline env                                                                                                                                                                                                                                                           |
| **Job status**                   | Functional tracker (API se); koi marketing content nahi — is plan me change nahi                                                                                                                                                                                           |

### 1.5 Rendering / caching facts (implementation ke liye)

- `cacheComponents` **off** hai (`next.config.ts`) → Next 16 ka "previous model" chalega:
  `unstable_cache` + `cacheTag` nahi, balki `unstable_cache(fn, keys, { tags, revalidate })`
  - `revalidateTag` / `revalidatePath`.
- Public pages static hain; root layout sirf `NEXT_PUBLIC_SSR_SHELL=on` hone par `cookies()`
  call karta hai (default off).
- `next.config.ts:66-74` already Supabase Storage public URLs allow karta hai
  (`**.supabase.co/storage/v1/object/public/**`) — DB-driven images ke liye ready.
- Settings page (`src/app/settings/page.tsx`) admin-only hai; writes browser client se
  `system_info` me `select → update/insert` karti hai, phir React Query invalidate karti hai.

### 1.6 UI/UX review findings (current public site)

Visual foundation achhi hai (dark premium theme, consistent cards, WhatsApp-first CTAs,
strong job tracking), lekin conversion/accessibility gaps hain:

| Area              | Finding                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First screen      | Home hero `min-h-[100dvh]` ([page.tsx:287](<file:///C:/next-vtech/vtech-frontend/src/app/(public)/page.tsx>)) mobile par pehla screen kha jata hai; CTA fold ke neeche ja sakta hai.                                      |
| Mobile actions    | Sirf floating WhatsApp FAB hai; Call/Directions ke liye sticky bottom bar nahi.                                                                                                                                           |
| Trust proof       | Google rating/review link nahi, images SVG placeholders (`EquipmentArt`), warranty claim ka visual badge nahi, real workshop/before-after photos nahi.                                                                    |
| Business status   | "Open now / Closed" live indicator nahi, jabki `biz_open/biz_close/biz_days` DB me hain.                                                                                                                                  |
| Contact form      | Labels `htmlFor`/input `id` se linked nahi ([contact:245](<file:///C:/next-vtech/vtech-frontend/src/app/(public)/contact/page.tsx>)); `autoComplete`/`inputMode`/`required`/`aria-invalid` missing; spam protection nahi. |
| Navigation        | Services dropdown hover-only hai ([layout:198](<file:///C:/next-vtech/vtech-frontend/src/app/(public)/layout.tsx>)) — touch/keyboard par fail; focus rings aur focus trap missing; 11px labels bahut chhote.              |
| Service pages     | Flat 12-card grid; filter (Available/Coming), grouping, per-item turnaround/price/warranty, real photo aur sticky estimate CTA nahi.                                                                                      |
| Job status        | Feature strong hai, par next-action/ETA/last-updated/skeleton missing; status color-only na ho — icon + text chahiye.                                                                                                     |
| Home length       | 3 pillars + 8 featured + 6 "why" + 4 testimonials mobile par bahut lamba; "why" detail About me shift ho sakti hai.                                                                                                       |
| Imagery           | Real dimensions/blur placeholder nahi; below-fold images ke liye lazy loading audit chahiye.                                                                                                                              |
| Sitemap           | `src/app/sitemap.ts` me sirf 4 URLs hain — **teeno service pages missing** hain (`/stage-lighting`, `/industrial`, `/power-supply`).                                                                                      |
| SEO/social        | Root metadata `robots.index:false`; JSON-LD (`LocalBusiness`/`FAQPage`/`BreadcrumbList`), canonical, per-page OG nahi.                                                                                                    |
| Legal/trust links | Footer me Privacy/Terms/Warranty policy links nahi; map/Google Business link nahi.                                                                                                                                        |

Ye findings **WS-8** me implement honge; content-side changes WS-0…WS-7 me hain.

---

## 2. Target design

### 2.1 Principles

1. **Static TSX copy = permanent default + fallback.** DB override **optional** hai. Jis
   field/section ka DB value set nahi hai, wahan current static content hi render hoga —
   site kabhi khaali ya broken nahi dikhegi. Env sirf bootstrap/rollback.
2. **Server-first.** Public shell/pages server par content load karke render karein — koi
   hydration flash nahi, SEO me bhi DB value.
3. **No schema migration.** Existing `system_info` table; naye content ke liye JSON row.
   Writes sirf admin Settings se (user action), automatic seed nahi.
4. **Safe by default.** Public loader sirf whitelisted keys padhta/return karta hai; content
   JSON validate + sanitize hota hai. Koi secret/geofence/session key kabhi public payload
   me nahi.
5. **Fallback-proof.** Key missing, JSON corrupt, ya DB unreachable → current code defaults
   render hote hain; site kabhi blank/500 nahi.

### 2.2 Content model (recommended)

Existing firm keys ko waise hi rakhein (Settings already inhe edit karti hai):

```
name, short_name, owner, tagline*, contact, whatsapp, email, address,
established_year, biz_open, biz_close, biz_days, logo, cover,
map_url, map_iframe (legacy — ignore; embed `map_url` se derive hoga),
facebook, instagram, youtube, footer_text, announcement
```

Naye keys:

| Key                       | Type                    | Purpose                                                                  |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `site_mode`               | `"full"` \| `"minimal"` | Branding switch; recommended build-time env (deployment-level), see §9   |
| `site_content`            | JSON (TEXT)             | Marketing sections ka single typed document (max 200KB)                  |
| `site_content_updated_at` | ISO string              | **Single** concurrency/cache source (`updatedAt` JSON me duplicate nahi) |

`site_content` shape (versioned, sab fields optional — missing = default):

```ts
type SiteContent = {
  version: 1;
  // updatedAt yahan nahi — single source `site_content_updated_at` DB key hai.
  home: {
    heroBadge?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    trustChips?: string[];
    stats?: { value: number; suffix: string; label: string }[];
    featured?: { art: ArtKind; title: string; desc: string }[];
    why?: { icon: string; title: string; desc: string }[];
    testimonials?: { quote: string; name: string; rating?: number }[];
    ctaTitle?: string;
    ctaSubtitle?: string;
  };
  about: {
    badge?: string;
    title?: string;
    subtitle?: string;
    stats?: { value: number; suffix: string; label: string }[];
    story?: string[];
    quote?: string;
    badges?: { label: string }[];
    emergency?: { value: string; label: string };
    why?: { icon: string; title: string; desc: string }[];
    team?: { name: string; role: string; quote: string }[];
    testimonials?: { quote: string; name: string }[];
    visitTitle?: string;
  };
  contact: {
    badge?: string;
    title?: string;
    subtitle?: string;
    serviceOptions?: string[];
    formCopy?: {
      name?: string;
      mobile?: string;
      email?: string;
      service?: string;
      message?: string;
    };
  };
  services: {
    "stage-lighting"?: ServicePageContent;
    industrial?: ServicePageContent;
    "power-supply"?: ServicePageContent;
  };
  footer?: {
    tagline?: string;
    whatsappCta?: string;
    copyrightText?: string;
  };
  seo?: { title?: string; description?: string };
};

type ServicePageContent = {
  enabled?: boolean;
  label?: string;
  desc?: string;
  art?: ArtKind;
  badge?: string;
  title?: string;
  highlight?: string;
  subtitle?: string;
  headings?: { equipment?: string; process?: string; why?: string };
  equipment?: {
    art: ArtKind;
    name: string;
    detail: string;
    badge?: "available" | "coming";
    image?: string;
  }[];
  steps?: { title: string; desc: string }[];
  points?: { title: string; desc: string }[];
  evHighlight?: {
    enabled?: boolean;
    badge?: string;
    title?: string;
    highlight?: string;
    body?: string;
    chips?: string[];
    images?: string[];
  };
};
```

`ArtKind` existing union se validate hoga (`src/app/(public)/components/equipment-art.tsx:3-29`);
unknown value → default art.

**Kyun single JSON row?**

- Load ek hi query/row me (already `system_info` full select hota hai).
- Single JSON document; section-wise alag saves nahi (multi-row true transaction nahi —
  partial failure §2.5 me honestly report hota hai).
- Defaults merge simple (`defu`-jaisa manual merge).
- Row count fixed; koi key sprawl nahi.

Trade-off: concurrent edits par last-write-wins. Single admin hone ki wajah se acceptable;
`site_content_updated_at` mismatch par 409 + reload UI. Agar future me multiple editors
chahiye to per-section keys/new table par migrate kar sakte hain — tab tak ye simplest.
JSON ke andar alag `updatedAt` **nahi** rakhenge — warna do sources drift karenge.

### 2.3 Loader (server-only)

New files:

- `src/lib/public-site-defaults.ts` — pure TS: current TSX copy ko default object me
  extract karega (no server imports). Tests isi par.
- `src/lib/public-site-content.ts` — server-only:
  ```ts
  import "server-only";
  // 1) system_info rows (service role) → whitelisted map
  // 2) JSON.parse(site_content) with try/catch
  // 3) merge(defaults, firmKeys, parsedJson) + validate/sanitize
  // 4) unstable_cache(fn, ["public-site-content"], { tags: ["site-content"], revalidate: 86400 })
  ```
  `getPublicSiteContent()` `React.cache()` se per-request dedupe bhi karega.
- `src/lib/public-site-schema.ts` — validation helpers: string length caps, URL protocol
  (`https:` ya `/` path only), phone/hours formatting, art enum, list max lengths
  (e.g. equipment ≤ 40, testimonials ≤ 12, team ≤ 12). Invalid item drop + default fallback.

Merge precedence (per field, not per object): **hardcoded static default < `site_content` JSON
< existing firm keys** (firm keys last, kyunki wahi Settings ke canonical fields hain — e.g.
`contact` phone, `name` brand).

**Fallback rules (binding):**

- DB value **non-empty + valid** ho tabhi override hota hai.
- `null`, `undefined`, `""`, whitespace-only, galat type, invalid URL/art → **static default
  use hota hai**; blank UI nahi.
- Pura `site_content` row missing ya corrupt → **poori site static defaults par** chalti hai.
- Firm keys bhi missing/blank hain (naya deployment) → static defaults hi final fallback.
- Static defaults me aaj ka behaviour hi freeze hoga: `site.ts` ke env-or-hardcoded values
  (`NEXT_PUBLIC_SITE_*` set ho to wahi, warna hardcoded) — taaki DB empty hone par current
  site bilkul same dikhe.
- Settings me field blank karna = "default par wapas jao", khaali text nahi.
- **Duplicate rows:** `meta_field` par unique constraint nahi hai, isliye loader `id`
  ascending lowest row ko deterministic pick karega aur duplicate detect hone par server
  warn karega. Save route write ke baad verify karega ki us key ki sirf ek row hai.
- **Size cap:** `site_content` JSON max 200KB; isse bada payload save reject, loader me
  invalid maan kar defaults.

Build/runtime safety: loader `try/catch` — DB/env fail → defaults. Isse build DB down hone
par bhi fail nahi hoga.

### 2.4 Rendering changes

| File                                                    | Change                                                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(public)/layout.tsx`                           | Server component banega: `const content = await getPublicSiteContent()`. Current JSX `PublicShell.tsx` (client) me move; `<PublicContentProvider value={content}>` wrap |
| `src/app/(public)/components/PublicContentProvider.tsx` | **New** client context + `usePublicSiteContent()`                                                                                                                       |
| `src/app/(public)/components/PublicShell.tsx`           | Current layout ka nav/footer/client effects; `SITE.*` → `content.*`                                                                                                     |
| `src/app/(public)/page.tsx`                             | `"use client"` retains; copy/stat arrays content se; particles/counters client hi rahenge                                                                               |
| `src/app/(public)/about/page.tsx`                       | Same                                                                                                                                                                    |
| `src/app/(public)/contact/page.tsx`                     | Same; `SERVICE_OPTIONS` content se                                                                                                                                      |
| `stage-lighting` / `industrial` / `power-supply`        | Already server: `async` page + content props; constants hatao                                                                                                           |
| `src/app/(public)/components/blocks.tsx`                | `SITE.*` → props/content; CtaBand/branded blocks content-driven                                                                                                         |
| `src/app/(public)/components/qr-share.tsx`              | `usePublicSiteContent()`                                                                                                                                                |
| `src/app/(public)/login/page.tsx`                       | Footer `SITE.name/phone` → context                                                                                                                                      |
| `src/app/(public)/site.ts`                              | Env sirf bootstrap defaults ke liye; public consumers se `SITE` imports hatayenge                                                                                       |
| `IS_BRANDED`                                            | `content.mode` se replace; env sirf migration override (Phase 7)                                                                                                        |

First paint: provider value RSC payload ke saath aata hai → client pages ko DB values
seedha milti hain. `getSiteInfo()` + `/api/system-info` client fetch chain public shell se
hata sakte hain (endpoint backward compatibility ke liye rahega).

Metadata: `(public)/layout.tsx` me `generateMetadata()` cached content se title/description
dega. Root app metadata (dashboard/PWA) abhi env-based rahega — public-only scope; agar
app-wide naam chahiye to alag decision.

### 2.5 Invalidation (save ke baad turant update)

New admin route: `POST /api/settings/site-content`

1. `requireStaffWithRole` + role check `admin|developer` (Settings jaisa); existing rate-limit
   pattern + `Cache-Control: no-store`.
2. Body validate (same schema helpers) + **size cap 200KB**; invalid → 400, koi write nahi.
3. `site_content_updated_at` se optimistic concurrency check; mismatch → 409 + reload UI.
4. Firm keys: `select id by meta_field` → update/insert (no `onConflict`); duplicate rows
   detect + single-row verify.
5. `site_content` JSON **last** write karo (validate-first). Koi bhi step fail → `revalidate`
   **nahi**, response me `partial: true` + client hard reload (multi-row true transaction
   nahi hai, isliye partial state honestly report karo).
6. Success par `revalidateTag("site-content")` + `revalidatePath("/", "layout")`.
7. `activity_logs` me audit entry (admin, action `site_content.save`, changed sections).
8. `{ ok: true, site_content_updated_at }` return.

Isse next request par static/ISR cache regenerate hota hai — user ko redeploy nahi karna
padta. Existing `/api/system-info` bhi extend karke full public payload de sakta hai
(compatibility), lekin shell usse use nahi karega; migration ke baad ise cache/rate-limit
ya deprecate karna chahiye taaki anon traffic DB par na pade.

### 2.6 Settings editor (admin)

`/settings` me naya **"Website"** section (ya `settings/website` sub-page):

Tabs/sections:

1. **Branding** — name, short name, tagline, owner, established year, mode
   (full/minimal), logo, cover.
2. **Contact** — phone, WhatsApp (separate), email, address, hours (open/close/days),
   `map_url` (embed isi se derive hoga; raw `map_iframe` edit nahi), social links.
3. **Home** — hero fields, trust chips, 4 stats, up to 8 featured items, 6 why cards,
   4 testimonials, CTA copy.
4. **About** — hero, stats, story paragraphs, quote, badges, emergency, why, team,
   testimonials, visit title.
5. **Services** — 3 tabs; enable/disable; label/desc/art; equipment list editor
   (add/remove/reorder, badge, optional image); steps; points; Power Supply EV highlight.
6. **Footer / SEO** — footer text, WhatsApp CTA, announcement (optional banner),
   meta title/description.
7. **Preview / Reset** — "Preview site" link, per-section "Reset to default".

Editor UX rules:

- List rows me drag/reorder ya up/down buttons; max caps enforced client + server.
- Image fields: URL input + reuse Settings ke existing upload flow (Supabase Storage);
  local `/public` paths bhi valid.
- Save = whole `site_content` JSON + firm keys (jo editor me hain), `site_content_updated_at`
  compare; success par toast + preview refresh.
- **Blank field = static default.** Input ke andar default value placeholder/text hint ke
  roop me dikhegi; save par blank value key se hata di jayegi (ya `null`), taaki loader
  fallback kare. Khaali text kabhi publish nahi hoga.
- "Reset to default" section/field ka DB override delete karta hai — code ka static content
  wapas active. Explicit reset se accidental wipe se bachaav.
- `art`/`icon` dropdowns existing unions se.

**MVP split (recommended):** WS-5a me sirf Branding + Contact + Home hero/stats + Footer/SEO;
About/Services/testimonials/team editors WS-5b me. Isse pehla value jaldi milta hai aur
100+ field editor ka risk kam hota hai.

### 2.7 Images

- Existing `logo`, `cover` keys public nav/footer/hero me wire honge.
- Equipment/EV images: `https://<project>.supabase.co/storage/v1/object/public/...` ya
  `/local.png`; next/image already allow karta hai.
- Upload reuse: Settings ke logo/cover upload helpers; size/type limits same.
- Invalid/expired URL → fallback `EquipmentArt` SVG (already default).

---

## 3. Implementation workstreams

Har WS ke baad gates: `tsc` + `eslint` + `vitest` + `prettier` + `build` +
`schema:drift` (agar SQL file touch ho) + unauth smoke (307 protected, 200 public).
**Koi live DB write nahi** — sirf read-only checks; save/seed user approval ke baad.
UI workstreams ke liye extra gates: Lighthouse mobile (A11y/SEO ≥ 95), axe, keyboard-only
nav, 360/768/1280 screenshots, CLS/LCP.

### WS-0 — Quick wins: already-DB keys ko actually use karo (0.5–1 din) ✅ DONE

- `/api/system-info` me `whatsapp` key ko `meta.whatsapp` se read karo (fallback `contact`).
- `established_year` Settings me add/save karo.
- Seller-full pages (home/about/services CTA) me phone/address/WhatsApp DB values se lo
  (loader/server provider; env fallback).
- Public nav/footer me `logo` (agar set ho) dikhao; `cover` ko home hero background
  (optional) me use karo.
- `footer_text`, `announcement`, social links, `map_url` ko public shell me wire karo.
- Acceptance: user Settings me phone/logo change kare → sab public pages par same value;
  koi env redeploy nahi.

### WS-1 — Content foundation (1–1.5 din) ✅ DONE

- `public-site-defaults.ts`: current copy ko typed defaults me extract (home/about/contact/
  services/footer/SEO).
- `public-site-schema.ts`: validation/sanitize + `ArtKind` allowlist + caps.
- `public-site-content.ts`: loader + merge + `unstable_cache` + `cache()`.
- Tests: merge precedence, corrupt JSON, missing keys, URL/protocol reject, art fallback,
  list caps, phone/hours format.
- Acceptance: **DB bilkul khaali hone par bhi** defaults se render current site ke barabar
  (manual diff); feature flag ke bina koi visible change nahi.

### WS-2 — Public shell + Home (1.5 din) ✅ DONE

- Server layout + `PublicContentProvider` + `PublicShell` extraction.
- Home ko content-driven karo (seller + branded variants; `mode`).
- `site.ts` imports remove; `getSiteInfo()` chain hataya.
- Acceptance: no hydration flash; static route bana rahe; desktop/mobile visual match;
  DB override ek field par test (read-only DB value).

### WS-3 — About, Contact, Login, QR (1 din) ✅ DONE

- About/contact copy, service options, branded variants.
- Login footer + QR share context.
- Acceptance: same as above + form submit regression (read-only; no live write).

### WS-4 — Service pages (1.5 din) ✅ DONE (sitemap/JSON-LD WS-6 me)

- Stage/Industrial/Power-Supply content-driven; equipment/steps/points/EV highlight.
- `blocks.tsx` shared components props-based.
- `enabled:false` service → page me `notFound()` (direct URL par 404), nav/footer/**sitemap**
  se remove; unknown slug bhi 404.
- Acceptance: 3 pages visual parity; disabled service URL 404 deta hai, sitemap me nahi aata.

### WS-5a — Settings editor MVP + save API (2–3 din) ✅ DONE

- `/api/settings/site-content` (admin, validated, size cap, concurrency, audit, partial-safe).
- Settings "Website" MVP: Branding + Contact + Home hero/stats + Footer/SEO tabs.
- `revalidateTag` + `revalidatePath` wiring.
- Tests: route auth/validation (mocked), merge on save, 409 concurrency, partial failure.
- Acceptance: save → hard refresh par turant naya content; invalid input/oversize blocked;
  staff (non-admin) blocked.

### WS-5b — Settings editor remaining sections (2–3 din) ✅ DONE

- About, Services (equipment/steps/points/EV), testimonials/team list editors.
- Drag/reorder + caps + image fields + per-section reset.
- Acceptance: saare editors se save → visual parity; reset → static default wapas.

### WS-6 — Metadata, SEO, announcement (1–1.5 din) ✅ DONE

- Public `generateMetadata` DB-driven; OG image (`cover`) + per-service OG.
- **Sitemap:** `src/app/sitemap.ts` me teeno service pages add; disabled service exclude;
  `lastModified` content se.
- **Canonical + robots:** public pages indexable (root `robots.index:false` override),
  `/job-status` noindex unchanged.
- **JSON-LD:** `LocalBusiness` (name/address/phone/hours/services),
  `BreadcrumbList` — sab whitelisted content se. `FAQPage` **deferred**: content model me
  FAQ fields nahi hain, invented Q&A whitelisted-content rule todta, isliye skip.
- `title.template` duplicate-title regression test.
- Announcement banner (optional, dismissible client-side; text DB se).
- Acceptance: browser tab/OG title DB se; sitemap me public service URLs; Rich Results
  test me JSON-LD valid; job-status noindex.

### WS-7 — Seed, rollout, verification (1 din)

- Optional seed script `scripts/seed-public-site-content.mjs` — current env/default values
  ko `site_content` me likhe; **dry-run default, `--apply` explicit**, user approval ke
  baad hi.
- Rollout: defaults pehle → shell/home → pages → editor → seed → UI polish. Har step reversible.
- Rollback flag: `NEXT_PUBLIC_SITE_CONTENT_SOURCE=code` → loader defaults return kare
  (DB read skip), ek redeploy me purana behaviour.
- Final gates + visual matrix + cache timing + static manifest check.

### WS-8 — Public UI/UX polish (6–8 din)

Content architecture se alag, conversion/accessibility workstream. Findings §1.6 me hain.

**WS-8a — Quick wins (1–2 din) — DONE (2026-11-08)**

- Mobile sticky action bar: **Call · WhatsApp · Directions** (`safe-area-inset`); desktop par
  floating WhatsApp FAB rahe.
- Live **Open now / Closed** badge `biz_open/biz_close/biz_days` se (local time).
- Hero ~75vh karo (`100dvh` nahi), H1 me local keyword (e.g. "Jabalpur"), primary CTA
  "WhatsApp par photo bhejo", secondary "Call Now".
- Contact form: `htmlFor`/`id`, `autoComplete`, `inputMode`, `required`, `aria-invalid`,
  inline errors; honeypot/Turnstile spam protection; success par reference + response-time copy.
- `sitemap.ts` me service pages add; footer me Privacy/Terms/Warranty links + map link.
- Page-specific WhatsApp prefilled text (service/equipment naam ke saath).

**WS-8b — Service-page conversion (1.5–2 din) — DONE (2026-11-08)**

- Filter chips (Available / Coming Soon), category grouping, search (optional).
- Per-item **turnaround + starting price + warranty** (optional fields, missing → hide).
- Real photo support (`image` already in model), fallback `EquipmentArt`.
- Sticky "Free estimate" CTA; home ke duplicate sections condense (3–4 "why" cards).

**WS-8c — Job-status UX (1–1.5 din) — DONE (2026-11-08)**

- Timeline default view; har status par **next action + ETA + last updated**.
- Skeleton loader; numeric input mode; token explanation; "Call about this job" + WhatsApp
  with job ID prefilled.
- Status icon + text (color-only nahi); recent jobs/print/share flow regression.

**WS-8d — Design system + accessibility (1–2 din)**

- Type scale: mobile minimum 12px labels / 16px body; 11px uppercase labels reduce.
- Gradient text restraint (hero highlight only); tabular numbers for job ID/amount; ₹ locale.
- Visible `focus-visible` rings, skip-to-content link, dropdown click + keyboard +
  `aria-expanded`, mobile menu focus trap + ESC, contrast AA.
- `prefers-reduced-motion` particles/counters par bhi; image dimensions + blur to avoid CLS.

**WS-8e — Local trust/SEO UI (1 din)**

- Google rating/review link + Google Business Profile link; map open link.
- Real workshop/before-after photos (owner-provided), no stock photos.
- FAQ section (5–6 Q: time, charge, warranty, courier/pickup, service area) — content DB se
  - `FAQPage` JSON-LD.
- Service area + pickup/courier info; analytics events for call/WhatsApp/form/job lookup.

**WS-8 acceptance:** Lighthouse mobile **Accessibility ≥ 95, SEO ≥ 95, Performance ≥ 85**;
CLS < 0.1; 360px/768px/1280px par no overflow; keyboard-only nav pass; koi fake urgency ya
stock photo nahi.

**Estimated total: 16–21 dev days** (WS-0…WS-8). Pehla shippable slice
(WS-0 + WS-1 + WS-2 + WS-5a + WS-8a) ~6–8 din me live ho sakta hai.

---

## 4. DB / data-safety rules (is plan ke liye binding)

- **Koi schema change nahi.** `system_info` me sirf naye content rows (`site_content`,
  `site_mode`, `tagline`, `established_year` etc.) — aur wo bhi jab admin Settings me save
  kare ya aap seed approve karein.
- **Zero DB content ek valid state hai.** Naye deployment me `system_info` ke content keys
  bilkul na hon — site static defaults se poori chalni chahiye. Seed karna optional hai,
  requirement nahi.
- Research/testing me **koi live DB write nahi**. Unit tests mock karenge; dev checks
  read-only DB values par.
- Agar future me anon direct reads chahiye (PWA/offline), tab RLS whitelist migration
  lagegi — is plan me **nahi** (server read se kaam chal jata hai).
- `meta_field` par unique index optional future hardening hai; **abhi select→update/insert**
  pattern (existing Settings jaisa) use hoga + loader lowest-`id` deterministic pick +
  duplicate warning. Save route write ke baad single-row verify karega. Unique index ko
  alag, explicitly approved DB migration ke roop me recommend karte hain (is plan ke
  "zero schema change" scope se bahar).
- Seed/save ke waqt `site_content_updated_at` conflict par overwrite nahi — 409 + reload.
- `site_content` payload max 200KB; bada JSON reject. Koi automatic seed/backfill nahi.

---

## 5. Security

- Public loader/payload **allowlist**: `name, short_name, tagline, owner, contact, whatsapp,
email, address, biz_*, established_year, logo, cover, map_*, social, footer_text,
announcement, site_*`. Kabhi bhi `geofence_*`, `auto_logout_*`, `log_retention`, `upi_id`,
  `signature`, `ai_*`, `csrf_token`, license keys public response me nahi.
- **No raw HTML.** Announcement/footer plain text; `map_iframe` **read nahi hoga** — sirf
  `map_url` store karo aur embed URL server-side derive karo (Google Maps host allowlist).
- URL validation: `https:` ya same-origin `/path`; `javascript:`/`data:` reject. Images sirf
  Supabase Storage host ya `/public` path.
- Save route: admin-only + `requireStaffWriter` geofence semantics + rate limit (existing
  pattern) + `Cache-Control: no-store` + 200KB payload cap + `activity_logs` audit entry.
- Public contact form: honeypot/Turnstile (WS-8a) — client-side `message_list` insert
  bot-spam ka target hai.
- JSON parse errors silently default par, lekin server log me warn (content corrupt ho to
  admin ko pata chale).
- Public API `/api/system-info` agar rakha to sirf whitelisted fields; migration ke baad
  cache/rate-limit ya deprecate karo — proxies already `/api` par `no-store` set karte hain.

---

## 6. Performance & caching

- Ek `system_info` query per cache miss (24h TTL) + `revalidateTag` on save. Per-request
  DB hit nahi.
- Public routes static/ISR rahenge (`unstable_cache`), dynamic upgrade nahi. Verification:
  build ke baad `.next/prerender-manifest.json` me 7 public routes present.
- Save ke baad pehla request cache regenerate karega (thoda slow), uske baad fast.
- Bundle: agar `site_mode` **runtime** rakha to full + minimal dono variants client bundle me
  aa sakte hain (env constant dead-code eliminate karta tha). Recommendation: branding ko
  build-time env hi rakho (deployment-level); runtime mode sirf tab jab ek deployment
  multiple brands serve kare. Target: public route JS delta `< +10KB`; measure karke agar
  zyada ho to branded variant ko alag client component + dynamic import karein.
- `getSiteInfo()` ka module-level cache hata rahe hain — open tab me purana content stuck
  nahi rahega; server cache invalidation authoritative hogi.
- Images: Supabase Storage CDN + next/image; local assets fallback; real dimensions + blur
  placeholder (CLS), below-fold lazy.
- UI budget (WS-8): mobile LCP < 2.5s, CLS < 0.1, INP < 200ms; particles/counters reduced
  motion par disable; koi nayi heavy animation library nahi.

---

## 7. Testing / verification matrix

| Area             | Check                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit             | defaults shape; merge precedence; corrupt JSON; missing keys; URL reject (`javascript:`, `data:`); art enum fallback; list caps; phone/hours formatter |
| Types            | `tsc` clean; `SiteContent` exported types Settings + loader dono use karein                                                                            |
| Build            | `npm run build` green; public routes static manifest me; env absent + DB unreachable par defaults se build pass                                        |
| Static           | 46 prerendered routes count same; no `force-dynamic` on public                                                                                         |
| Visual           | Desktop + mobile: `/`, `/about`, `/contact`, 3 service pages, `/job-status`, login footer, QR modal — before/after pixel-level parity on defaults      |
| DB override      | Read-only staging value (ya user-approved single field) change → page reflects; revert                                                                 |
| DB empty         | `site_content` + content firm keys absent → poori site current static content par (build + runtime)                                                    |
| Partial DB       | Sirf ek field set (e.g. phone) → baaki sab static default, koi blank section nahi                                                                      |
| Invalid DB       | Corrupt JSON / blank string / bad URL → us field/section ka static fallback, page render fail nahi                                                     |
| Save flow        | Admin save → hard refresh par turant update; invalid JSON/URL blocked; non-admin blocked                                                               |
| Cache            | Save ke baad `revalidateTag` effect; 24h TTL ke baad refresh                                                                                           |
| Security         | anon `/api/system-info` response me sirf whitelisted keys; koi geofence/secret leak nahi                                                               |
| Regression       | Contact form submit (read-only test), job-status tracking, WhatsApp/tel links                                                                          |
| DB safety        | `schema:drift` OK; tests me zero DB writes; seed default dry-run                                                                                       |
| Duplicate rows   | `meta_field` duplicate → loader lowest-`id` deterministic + warning; save single-row verify                                                            |
| Disabled service | `enabled:false` URL → 404; nav/footer/sitemap se absent; unknown slug 404                                                                              |
| SEO              | sitemap me teeno service URLs; canonical; JSON-LD valid (Rich Results); title duplicate nahi; job-status noindex                                       |
| A11y/UI          | axe/Lighthouse A11y ≥ 95; keyboard-only nav; focus-visible; form labels; 360/768/1280 par no overflow                                                  |
| Job status UX    | Timeline + next-action/ETA/last-updated; skeleton; status icon + text (color-only nahi)                                                                |
| Contact spam     | Honeypot/Turnstile invalid submit block; valid submit regression (read-only)                                                                           |
| CLS/LCP          | Images/fonts par layout shift nahi; mobile LCP < 2.5s, CLS < 0.1                                                                                       |

Owner-gated (aapke approval ke baad):

- Live `system_info` me content save karke public site par visual confirm.
- Public SEO indexability decision + robots/metadata change.
- Seed script `--apply` (agar current env values DB me seed karne hain).

---

## 8. Risks & mitigations

| Risk                                | Mitigation                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Content stale rahe                  | `revalidateTag` on save; TTL 24h; manual "Refresh cache" button (admin)                         |
| JSON corrupt / manual DB edit galat | try/catch + per-section validation + defaults; admin UI hi primary editor                       |
| Hydration mismatch                  | Server provider value first paint; client kabhi alag source se override na kare                 |
| Duplicate `system_info` rows        | Loader lowest-`id` pick + warning; save single-row verify; unique index alag approved migration |
| Secret leak in public payload       | Strict allowlist + tests; no `<meta>`/HTML injection                                            |
| `data:`/`javascript:` URL injection | Protocol allowlist + tests                                                                      |
| Bundle growth (dual mode)           | Build-time `site_mode` preferred; measure route JS; dynamic import if runtime mode              |
| Build fails without DB              | Loader `try/catch` → defaults; build-time env available anyway                                  |
| Save partial (firm keys + JSON)     | JSON last; failure → no revalidate + `partial: true` + hard reload (no true transaction)        |
| Env fallback drift                  | Phase 7 me env override sirf rollback flag; defaults single file                                |
| Editing UX too complex              | WS-5a/WS-5b split; section-wise tabs; list editors + reset; caps; preview                       |
| UI polish scope creep               | WS-8a quick wins pehle; har UI change visual/a11y gate ke saath                                 |
| SEO indexability galat              | Root `robots.index:false` public pages par explicit override; job-status noindex test           |

---

## 9. Decisions & open items

**Locked (2026-11-08): static content permanent fallback rahega.** Maujooda static/hardcoded
copy hatayi nahi jayegi; DB override optional hai. `system_info` me content na ho, blank ho,
ya corrupt ho — public site aaj jaisi hi render hogi.

**Recommended defaults (expert review):**

1. **`site_mode`:** build-time env hi rakho (branding deployment-level decision). DB runtime
   mode sirf tab jab ek hi deployment multiple brands serve kare.
2. **Duplicate rows:** loader lowest-`id` deterministic + warning; unique index ko alag,
   explicitly approved migration ke roop me editor se pehle recommend karte hain.
3. **Map:** sirf `map_url`; raw `map_iframe` read/store na karo, embed URL derive karo.
4. **Concurrency:** single source `site_content_updated_at`; JSON ke andar `updatedAt` nahi.
5. **Save safety:** JSON last + `partial: true` honest reporting; no true multi-row transaction.
6. **Editor rollout:** WS-5a MVP (branding/contact/home/footer) pehle, WS-5b baad me.
7. **UI rollout:** WS-8a quick wins pehle; koi fake urgency/stock photo nahi; real photos
   owner se.

Open decisions (aapke liye):

1. **Scope:** full content (recommended) ya sirf WS-0 business info pehle? First shippable
   slice: WS-0 + WS-1 + WS-2 + WS-5a + WS-8a (~6–8 din).
2. **Storage:** single `site_content` JSON (recommended) vs per-section keys vs nayi table.
3. **Env fallback:** migration ke baad `NEXT_PUBLIC_SITE_*` rollback-only (recommended) ya
   permanently hata dena?
4. **Public SEO:** public marketing pages indexable (recommended) — root `robots.index:false`
   override; job-status noindex.
5. **Images:** phase 1 `/public` + existing URLs; phase 2 Supabase Storage uploads
   (recommended). Real photos aap provide karenge?
6. **Editor access:** sirf admin/developer (recommended, current Settings jaisa) ya staff bhi?
7. **Seed:** code defaults se chalne dena (recommended; seed optional) ya env values ek baar
   DB me seed karna?
8. **UI trust:** Google rating/review link integrate karna hai? (Google Business Profile URL
   chahiye.)
9. **UI pricing:** service items par starting price/turnaround public karna hai ya sirf
   "call for quote"?
10. **Legal pages:** Privacy/Terms/Warranty content aap denge ya template draft karein?

---

## 10. File reference (research trail)

| Concern                          | File                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Env branding + service list      | `src/app/(public)/site.ts:16-53, 122-130`                                                    |
| Client DB fetch + cache          | `src/app/(public)/site.ts:63-96`                                                             |
| Public shell/nav/footer          | `src/app/(public)/layout.tsx:100-111, 187-518`                                               |
| Home content                     | `src/app/(public)/page.tsx:99-636`                                                           |
| About content                    | `src/app/(public)/about/page.tsx:67-480`                                                     |
| Contact content                  | `src/app/(public)/contact/page.tsx:17-23, 86-339`                                            |
| Service page content             | `stage-lighting/page.tsx:11-103`, `industrial/page.tsx:11-87`, `power-supply/page.tsx:13-67` |
| Shared blocks                    | `src/app/(public)/components/blocks.tsx:151-240`                                             |
| Equipment art enum               | `src/app/(public)/components/equipment-art.tsx:3-29`                                         |
| Public API (8 fields)            | `src/app/api/system-info/route.ts:26-54`                                                     |
| Settings load/save               | `src/app/settings/page.tsx:140-300`                                                          |
| RLS anon whitelist               | `supabase/migrations/20260913000000_final_full_schema_idempotent.sql:2269-2270`              |
| `system_info` schema (no unique) | same migration `:455`                                                                        |
| Supabase remote images           | `next.config.ts:66-74`                                                                       |
| Admin auth/geofence helper       | `src/lib/api-auth.ts:125`                                                                    |
| Service-role client              | `src/lib/admin-supabase.ts:1-19`                                                             |
| Static public routes             | `.next/prerender-manifest.json` (7 public routes)                                            |
| Root metadata / robots           | `src/app/layout.tsx:12-38` (title/tagline env; `robots.index:false`)                         |
| Sitemap (4 URLs only)            | `src/app/sitemap.ts:6-16` — service pages missing                                            |
| Robots rules                     | `src/app/robots.ts:3-23`                                                                     |
| Home hero / CTAs                 | `src/app/(public)/page.tsx:287-357, 591-633`                                                 |
| Navbar/dropdown/footer           | `src/app/(public)/layout.tsx:169-384, 390-535`                                               |
| Contact form fields              | `src/app/(public)/contact/page.tsx:245-315` (labels unlinked)                                |
| Job-status UX                    | `src/app/(public)/job-status/page.tsx:104-260`                                               |
| Equipment grid                   | `src/app/(public)/components/blocks.tsx:54-107`                                              |
| Equipment SVG art                | `src/app/(public)/components/equipment-art.tsx:3-29`                                         |
| globals (tokens/motion)          | `src/app/globals.css:182-210, 2540-2575`                                                     |

---

## 11. Kya abhi change hua?

**2026-11-08 — implementation (WS-0/1/2/3/4/5a, uncommitted, zero DB writes):**

- **WS-0/1/2:** `src/lib/public-site-defaults.ts` (typed defaults), `public-site-schema.ts`
  (validate/sanitize/merge + caps), `public-site-content.ts` (service-role read →
  defaults < `site_content` JSON < firm keys, `unstable_cache` tag `site-content`),
  server `(public)/layout.tsx` + `PublicContentProvider` + `PublicShell`, home content-driven,
  `site.ts` retired.
- **WS-3:** `/about`, `/contact`, `/login`, `/job-status`, QR share — sab content context se;
  contact form ke silent insert failure ko `insertError` throw se fix kiya + a11y labels.
- **WS-4:** `service-page-view.tsx` shared server view; teeno service pages thin wrappers;
  `enabled:false` → `notFound()`. `blocks.tsx` props-based.
- **WS-5a:** `GET/POST /api/settings/site-content` (admin-only, `expectedUpdatedAt` 409,
  firm-field whitelist, `sanitizeSiteContentJson`, 200 KB cap, partial-failure reporting,
  `revalidateTag("site-content","max")` + `revalidatePath("/","layout")`, audit log);
  Settings → **Website** MVP (Branding/Contact/Home/Footer+SEO, change-only save,
  reset-to-default, 409 reload). `src/app/settings/website/page.tsx` + nav links.
- **Tests:** schema 25 + route 7; full suite 643 tests / 59 files green.
- **Gates:** `tsc` clean, `eslint` clean, `prettier --check` clean (working-tree CRLF → LF
  normalize kiya, kyunki `core.autocrlf=true`), `next build` exit 0, read-only smoke:
  `/ /about /contact /stage-lighting /industrial /power-supply /job-status /login` = 200,
  `/settings/website` = 307 → `/login` (unauth), zero DB writes.

**2026-11-08 — WS-5b/WS-6 (uncommitted, zero DB writes):**

- **WS-5b:** Settings → Website ab **6 tabs** (Branding / Contact / Home / About / Services /
  SEO+Footer). `fields.tsx` primitives; list editors (`StatsEditor`, `FeaturesEditor`,
  `TestimonialsEditor`, `TeamEditor`, `StepsEditor`, `FeaturedEditor`, `EquipmentEditor`)
  caps + reorder ke saath. Services tab per-service equipment/steps/points + EV highlight
  (toggle off → `evHighlight:null`), image URL fields, per-service reset (`{services:{id:null}}`)
  aur Home/About/SEO/Footer/Contact reset. Save change-only patch + `expectedUpdatedAt`
  (409 → reload).
- **WS-5b server fix:** save route me recursive `mergeSectionPatch` — partial tab save pehle
  saved overrides ko erase nahi karta (arrays/`null` replace). Regression test added;
  `revalidatePath("/sitemap.xml")` bhi revalidate hota hai.
- **WS-6:** `src/lib/public-site-metadata.ts` (absolute titles, canonical, OG/Twitter,
  LocalBusiness + Breadcrumb JSON-LD, `serializeJsonLd` `<`→`\u003c`); `(public)/layout`
  `generateMetadata` + LocalBusiness script; `about/contact/login/job-status` layouts;
  `service-route.tsx` (`buildServiceMetadata`, `ServicePageRoute` breadcrumb) aur teeno
  service wrappers. `sitemap.ts` async: enabled services only, `lastModified` DB
  `updatedAt` se, `revalidate=3600`, `/job-status` (noindex) excluded. Announcement banner
  DB text se, sessionStorage dismiss (text change → dobara show). Login/job-status
  canonical + noindex explicit (root canonical "/" inherit nahi hota).
- **Tests:** metadata 6 + route deep-merge 1; full suite **650 tests / 60 files** green.
- **Gates:** `tsc` clean, `eslint` clean, `prettier --check` clean (CRLF→LF normalize),
  `next build` exit 0. Read-only smoke (fresh build, port 3100): `/` title
  "V-Technologies — Repair & Service Experts"; `/about` "About V-Tech-Next"; `/contact`
  "Contact V-Tech-Next"; `/stage-lighting` "Stage Lighting Repair & Service — V-Tech-Next";
  `/job-status` "Job Status" + noindex; `/login` "Staff Login" + noindex; sab canonical
  apne route ka. `/sitemap.xml` = 6 URLs (`/ /about /contact` + 3 enabled services).
  Home HTML me LocalBusiness + PostalAddress + 3 Offer; service page me BreadcrumbList.
- **Known content note:** live DB `brand.name` lamba hai, isliye page titles
  `brand.shortName` use karte hain (Settings → Branding se editable).

**2026-11-08 — WS-7/WS-8a/8b/8c (uncommitted, zero DB writes):**

- **WS-7:** `scripts/seed-public-site-content.mjs` — dry-run default, `--apply` explicit,
  `--force` existing content ke bina refuse, `--out <path>`; `.env.local`/`.env` load
  (existing env override nahi), defaults module Node 24 native TS strip se import
  (`pathToFileURL`), payload cap 200 KB, `system_info` ka `site_content` +
  `site_content_updated_at` read karke planned INSERT/UPDATE print karta hai.
  Dry-run verified: host `rklyznrc...supabase.co`, payload **14.3 KB**, 3 services on,
  28 equipment items, "no site_content row → planned INSERT", exit 0, **zero writes**.
- **WS-8a:** PublicShell — desktop header + mobile menu me live **Open now / Closed**
  badge (60s refresh, hydration-safe mount ke baad), mobile sticky action bar
  **Call · WhatsApp · Directions** (`safe-area-inset`, `md:hidden`), desktop WhatsApp FAB,
  footer **Privacy/Terms/Warranty** (`footer.legalLinks`, external/`Link` dono) + map link.
  Home hero `75dvh`, H1 me city (address se `getCityLabel`), primary CTA
  "WhatsApp par photo bhejo", "why" cards max 4. Contact form: one-pass validation,
  per-field inline errors + `aria-invalid`/`aria-describedby`, honeypot
  (`contact-company`; filled → fake success, koi insert nahi), `autoComplete`/`inputMode`,
  success copy "1 business day". Naya `/policies` page (Privacy / Repair Terms / Service
  Warranty — sirf actual data flows, invented claims nahi) + sitemap entry.
- **WS-8b:** `EquipmentExplorer` (client) — filter chips **All / Available / Coming Soon**
  counts ke saath, search, groups (Available Now / Coming Soon / Other Repairs),
  empty state, `ZoomableImage` + `EquipmentArt` fallback. `EquipmentItem` me optional
  `turnaround` / `startingPrice` / `warranty` (schema sanitize + caps; missing → row hide;
  admin ne price na daala ho to kuch invented nahi). Settings → Services tab me 3-column
  optional row. Service page par desktop sticky **Free estimate** WhatsApp CTA
  (service naam prefilled). `blocks.tsx` se purana `EquipmentGrid` hataya.
- **WS-8c:** job-status default **Timeline** view; har status (0–5 + fallback) par
  `nextAction` + `eta`; current step par "Next:" + "ETA:" box, detailed view me
  "Next step" card; **Last updated** (`date_updated`, API route bhi ab ise return karta
  hai, limited response me bhi); skeleton loader (`aria-busy` + sr-only), numeric
  `inputMode` jab `job_id`, token explanation, bottom **Call** + **WhatsApp (Job ID
  prefilled)** actions.
- **Route allowlist fix (smoke me pakda):** naya `/policies` `proxy.ts`, `RootClient`
  (2 lists), `useAppBoot` (2 lists) aur `useAppTheme` me add kiya — warna RootClient
  use private maan kar secure-boot par redirect kar deta tha aur prerendered HTML khaali
  aata tha. `proxy.test.ts` me `/policies` passthrough contract add.
- **Tests:** defaults helper 7 (open state/overnight/city/map link) + schema optional
  equipment 1 + proxy 1; full suite **659 tests / 61 files** green.
- **Gates:** `tsc` clean, `eslint` clean, `prettier --check` clean (CRLF→LF normalize),
  `next build` exit 0. Read-only smoke (fresh build, port 3100): `/ /about /contact
/policies /power-supply /industrial /stage-lighting /job-status /login /sitemap.xml`
  = 200; `/policies` prerendered HTML me H1 + `#privacy`/`#terms`/`#warranty`;
  `/sitemap.xml` = **7 URLs** (`/policies` included); service page me explorer groups +
  "Free estimate"; home me JSON-LD + mobile Directions bar.

**2026-11-08 — WS-8e FAQ + WS-8d a11y polish (uncommitted, zero DB writes):**

- **Content model:** `FaqContent` (`badge`/`title`/`subtitle`/`items[{q,a}]`) added to
  `public-site-defaults.ts` (`sharedFaq()` — 6 safe Q&A: charge/diagnosis, time, warranty,
  workshop via `{address}` token, Job ID tracking, form-data privacy) aur
  `SiteContentJson`/`PublicSiteContent`. Schema: `cleanFaqItems` (max 10; q 160, a 800),
  `mergeFaq` + `sanitizeFaq`; `{faq:null}` explicit reset.
- **UI:** naya `src/app/(public)/components/faq-section.tsx` — sticky heading + "Aur kuch
  puchna hai?" contact card, native `<details name="site-faq">` exclusive accordion
  (pehla open, numbered questions, rotating chevron, `prefers-reduced-motion` respect),
  FAQPage JSON-LD sirf visible items se. Home par dono modes me testimonials/contact ke
  baad aur CTA se pehle; footer quick link `/#faq`.
- **Settings:** Website editor me **7th tab FAQ** (badge/title/subtitle + `FaqEditor`
  cap 10, reorder/remove, change-only save, reset). Save route
  `applySectionPatch` whitelist me `faq`; seed payload me `content.faq`.
- **A11y:** PublicShell aur RootClient dono me skip-link first focusable element +
  `<main id="main-content">` target; existing focus-visible ring + `tap-target` reuse.
- **Tests:** schema FAQ merge/invalid-list/`null` reset + FAQPage JSON-LD; full suite
  **664 tests / 61 files** green.
- **Gates:** `tsc` clean, `eslint` clean, `prettier --check` clean, `next build` exit 0.
  Seed dry-run **15.5 KB**, "no site_content row → planned INSERT", zero writes.
  Read-only smoke (port 3100): public routes 200 (`/services` staff page 307 → `/login`
  expected); home HTML me `#faq`, 6× `details[name=site-faq]`, FAQPage JSON-LD
  (6 questions), skip-link aur `main#main-content`; `/sitemap.xml` 7 URLs unchanged.
- **Verification note:** visual browser screenshot nahi liya ja saka (in-app browser ka
  visible surface available nahi tha; hidden tab me loading shell hi ruka) — structural
  HTML + live DOM inspection se FAQ markup/JSON-LD verify kiya.

**2026-11-08 — GPS map/directions + location share (uncommitted, zero DB writes):**

- **Data:** `ContactInfoContent` me `latitude`/`longitude` (default `null`).
  `mergeSiteContent` geofence rows (`geofence_lat`/`geofence_lng`) ko range-validate
  karke (lat ±90, lng ±180, dono zaroori, blank → null) read-only expose karta hai —
  koi naya DB key/write nahi. Link priority: admin `map_url` → office GPS → address.
- **Links:** `formatCoordinates`, `buildMapLink` (GPS-aware), `buildDirectionsLink`
  (`/maps/dir/?api=1&destination=…`), `buildLocationShareText` (brand/address/GPS/map/
  directions/phone), `normalizeWhatsAppRecipient` (10-digit → `91…`, leading 0 → `91…`),
  `buildWhatsAppShareLink`/`buildLocationWhatsAppLink`.
- **JSON-LD:** LocalBusiness me `geo` (`GeoCoordinates`) aur `hasMap` (GPS-based) —
  sirf resolved content se.
- **UI:** Contact page Location card me selectable `GPS: lat, lng` + copy button,
  Directions + Map buttons, Share trigger. Naya `location-share.tsx` (portal modal):
  pehle recipient puchta hai — "Saved contact" (`navigator.share`, fallback WhatsApp
  chooser) ya naya number type karke `wa.me/<number>?text=…`; saath me Copy/Map/Route.
  Footer "Directions / Map" coords-based route link + "Share location"; mobile sticky
  Directions bhi directions link. Settings → Contact `map_url` hint updated.
- **Tests:** defaults/schema/metadata helpers + `LocationShare` component tests
  (typed number → `wa.me` link, invalid disabled, native share, chooser fallback,
  copy + Escape). Full suite **677 tests / 62 files** green.
- **Gates:** `tsc` clean, `eslint` clean, `prettier --check` clean, `next build` exit 0.
  Read-only smoke (port 3100): `/contact` me GPS line + coords-based Map/Directions
  hrefs; home JSON-LD me `geo` (`23.167934`, `79.935528`) + `hasMap`; public routes 200.
  Seed dry-run unchanged (coords site_content me nahi jaate).
- **Verification note:** share modal hidden-tab me click se nahi khula (wahi loading-shell
  limitation), isliye flow jsdom component tests se verify kiya.

**Pending:** WS-8d/WS-8e ke bache hue optional polish items (owner photos, Google review
link), phir authenticated Settings → Website se live save check. Seed `--apply`, koi bhi
DB write, commit/push — sab aapki explicit approval par hi.

**Plan revision (2026-11-08):** expert review ke 7 points + UI/UX review §1.6 + WS-8 add
kiye; `updatedAt` duplicate hataya; save route me audit/size-cap/partial reporting;
disabled-service 404; SEO (sitemap/JSON-LD/canonical) complete kiya; WS-5a/5b split;
estimate 16–21 dev days.

**Implementation order:** WS-0 → WS-1 → WS-2 → WS-5a → WS-8a (first shippable slice) →
WS-3/WS-4 → WS-5b → WS-6 → WS-8b…e → WS-7. Har step read-only gates ke saath; live DB
save/seed sirf aapki explicit approval par.

Agla step: WS-8d design system/a11y + WS-8e local trust/SEO UI (owner-provided photos
aur Google review link chahiye), uske baad authenticated Settings → Website se live save
check. Seed `--apply`, commit/push aur live DB writes aapki explicit approval ke baad hi.
