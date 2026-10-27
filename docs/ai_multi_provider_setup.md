# AI Multi-Provider Setup — Groq + Gemini dono keys saath me

Created: 2026-10-28
Status: **CODE DONE — migration apply karna USER ACTION hai**
Related: `src/lib/ai-settings.ts`, `src/lib/ai-crypto.ts`, `src/lib/ai-provider-catalog.ts`,
`src/app/api/ai/providers/route.ts`, `supabase/migrations/20261028000000_ai_providers.sql`

---

## 1. Pehle kya problem thi

`system_info` table key-value store hai, aur AI settings ke liye sirf **ek** row thi:

```
ai_provider = "groq"
ai_api_key  = "gsk_...."   ← sirf ek slot
ai_model    = "openai/gpt-oss-120b"
```

Isse 4 dikkatein aati thi:

| #   | Problem                | Kaise                                                                                                                                                        |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Silent stale key**   | provider Gemini kiya par key field khaali chhoda → `ai_api_key` Groq ki hi rahi → Gemini call "API key not valid"                                            |
| 2   | **Key permanent loss** | Gemini key daali → `ai_api_key` overwrite → Groq key kahin backup nahi                                                                                       |
| 3   | **Model mismatch**     | `ai_model` bhi single slot → provider ke saath model mismatch (404 model not found)                                                                          |
| 4   | **UI override**        | `/ai` page ke apne dropdown ne `provider` body me bheja → Settings ki DB choice override                                                                     |
| 5   | **Secret exposure**    | Settings page poora `system_info` padhta tha, aur `hardening_sysinfo_staff` policy (FOR clause ke bina) `ai_api_key` row admin browser tak pahuncha deti thi |

## 2. Ab kya hai (design)

```
ai_providers  (nayi table, service-role only)
  provider        text  PK        'groq' | 'gemini' | future...
  label           text
  model           text
  api_key_cipher  text            v1:<iv>:<tag>:<ciphertext>  (AES-256-GCM)
  key_hint        text            ••••4f2a  (browser ko sirf yeh)
  is_active       boolean         partial unique index → ek hi active
  updated_at      timestamptz
```

- **Dono providers ki keys parallel** — switch karne par kuch delete nahi hota.
- **Ek active provider** — wahi AI assistant use karta hai (`getAiSettings()`).
- **Key browser ko kabhi nahi** — sirf `keyHint` (last 4) + `keySource` (`db` / `legacy` / `env` / `none`).
- **RLS**: `ai_providers` par koi policy nahi + `revoke all from anon, authenticated` → direct REST read band.
- **Provider resolution**: DB active → legacy `system_info` (migration pending) → env (`GROQ_API_KEY` / `GEMINI_API_KEY`).
- **Models per provider**: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.6-27b` · `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`.

## 3. USER ACTION — migration apply

Supabase → SQL Editor → `supabase/migrations/20261028000000_ai_providers.sql` ka content run karein.

Migration idempotent hai (dobara chalane par kuch nahi bigadta). Ye karta hai:

1. `ai_providers` table + `ai_providers_single_active` unique index
2. RLS enable + anon/authenticated se revoke
3. Default rows (`groq`, `gemini`) insert
4. Legacy `ai_provider` ko active banata hai (agar koi active nahi)

> Migration apply hone tak app **legacy mode** me chalta rahega (crash nahi) — Settings card me
> amber warning dikhegi aur purani single-key setting use hogi.

## 4. USER ACTION (recommended) — encryption secret

```bash
# naya 32-byte secret generate karo
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`.env.local` (aur host env) me:

```
AI_KEY_ENC_SECRET=<generated value>
```

- Ye na ho to app `SUPABASE_SERVICE_ROLE_KEY` se key derive karti hai (kaam chalta hai, par service-role rotate hone par saved keys decrypt nahi hongi).
- Secret badalne par purani saved keys decrypt nahi hongi — admin ko key dobara save karni padegi (Settings → provider card → API Key → Save).

## 5. Key kaise migrate hoti hai

`ai_api_key` (plaintext, system_info) → `ai_providers.api_key_cipher` (encrypted):

- Trigger: **admin** jab Settings page kholta hai (`GET /api/ai/providers`).
- Migration ke baad `system_info.ai_api_key` blank (`''`) kar diya jaata hai.
- Isi ke saath pichhla RLS exposure bhi khatam ho jaata hai (row me secret hi nahi bachta).
- Idempotent: dobara chalane par kuch nahi hota.

## 6. API

| Method  | Route               | Access | Body / Response                                       |
| ------- | ------------------- | ------ | ----------------------------------------------------- |
| `GET`   | `/api/ai/providers` | staff  | `{ providers: [...masked], ready }`                   |
| `PATCH` | `/api/ai/providers` | admin  | `{ provider, model?, apiKey?, clearKey?, isActive? }` |

- `PATCH` me `apiKey` plaintext aata hai (HTTPS), DB me encrypted jaata hai.
- `clearKey: true` → encrypted key + legacy plaintext dono saaf.
- `isActive: true` → baaki providers off, ye on (partial unique index safe order).

## 7. Staff ke liye provider switching (failover + session selector)

Admin Settings me **default** provider set karta hai. Staff ke paas 2 safe raaste hain:

### 7.1 Automatic failover (default behaviour)

```
1. body.provider          (staff ka session selection, "auto" ho to skip)
2. ai_providers.is_active (admin ka default)
3. retryable error par dusra configured provider (ek retry)
4. env keys               (last resort)
```

Retryable = key missing/invalid, 401/403, 429/quota, model not found, timeout, 5xx, empty response.
**Nahi** retry hota = content safety, invalid argument, malformed request (`400`) — kyunki dusra
provider bhi wahi galat request bhejega.

Response me `provider` (kisne jawab diya) aur failover hua to `failoverFrom` aata hai. `/ai` page
chhota toast dikhata hai: _"Groq (Free) se jawab nahi aaya — Google Gemini se aa gaya."_

### 7.2 Per-session selector (staff)

`/ai` page ke header me chip: `Auto (Groq (Free)) ▾` — sirf woh providers jo **configured** hain
(`hasKey = true`). Selection `localStorage` me sirf us browser ke liye; **global active provider
nahi badalta** (wo admin ka decision hai, WhatsApp auto-replies par bhi asar padta hai).

### 7.3 Settings "Test API"

Test request `test: true` bhejta hai → **failover band**, taaki galat key ka failure chhup na jaye.
Khaali key field par saved/env key test hoti hai; typed key unsaved test hoti hai.

---

## 8. Rollback

```sql
-- table hatao; app automatic legacy mode me chala jayega
drop table if exists public.ai_providers;
```

Legacy key tab tak `system_info` me hai jab tak admin Settings na khole (uske baad blank ho jaati hai
aur sirf encrypted copy bachti hai — rollback se pehle key note kar lein).

## 9. Verification checklist

- [ ] Migration SQL Editor me run hui (table + index + 2 rows)
- [ ] Settings page par dono cards dikh rahe hain, purani key "Key set ••••xxxx (legacy/db)" me hai
- [ ] Groq card → Test API → ✅ Working
- [ ] Gemini key save → "Isse use karo" → `/ai` page par "Auto (Gemini)" + reply aaye
- [ ] Wapas Groq activate → Groq key **abhi bhi** maujood (delete nahi hui)
- [ ] `/ai` page selector: Auto default, sirf configured providers listed, koi key visible nahi
- [ ] Failover: active provider ki key temporarily galat karo → chat par jawab aata hai + toast
      "…se jawab nahi aaya — …se aa gaya"; Test API usi key par ❌ dikhata hai (failover band)
- [ ] `select meta_field, meta_value from system_info where meta_field = 'ai_api_key'` → khaali
- [ ] `npm run schema:drift` → OK

## 10. AI UI behaviour (Oct 2026 polish)

Yahan kuch chhoti par user-facing baatein hain jo code me deliberate hain — agla koi
"fix" kare to pehle ye padhe.

### 10.1 `/ai` full page

| Cheez          | Behaviour                               | Kyun                                                                                                                                                  |
| -------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Back button    | Header me left (`/dashboard`)           | `/ai` par app ka topbar aur mobile bottom bar dono hidden hain — bina iske mobile par wapas jaane ka rasta nahi                                       |
| Refresh button | Header ke right me — conversation reset | Purana trash icon **replace** kiya (dono ka kaam ek hi tha). Reset = messages clear + input clear + chal rahi request abort + alerts/provider refresh |
| Bottom tab bar | `/ai` par **nahi** dikhta               | Composer screen ke bottom par hota hai; tab bar uske upar aa kar send button / chips daba deta tha (`MobileBottomTab` pathname check)                 |
| Alerts banner  | Default **collapsed**                   | 6 groups ka banner 300px+ le leta tha, chat ke liye jagah nahi bachti thi. Count header row me dikhta hai                                             |
| Height         | `h-[100dvh]` + body padding reset       | Pehle `min-h-screen` + 76px padding se page scroll hota tha aur sticky header upar chhup jata tha (drawer/iframe me)                                  |

### 10.2 Drawer (`RootClient`, desktop + mobile)

| Cheez          | Behaviour                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Width          | Mobile par **92%** (`max-w-[420px]`) — 8% strip se bahar tap karke band hota hai. Pehle full width tha, isliye "bahar click" ka koi area hi nahi tha                         |
| Refresh        | Header me X ke saath — andar ke `/ai` page ko `postMessage({type:"vtech:ai-reset"})` bhejta hai. Page ne ready signal (`vtech:ai-ready`) nahi diya to iframe reload hota hai |
| Escape         | Drawer band (desktop)                                                                                                                                                        |
| Background     | Drawer khula ho to body scroll lock                                                                                                                                          |
| Brand          | Drawer me `/ai` ka "V-Tech Copilot" title/logo hidden (parent header me "AI Assistant" already hai) — sirf provider chip + role badge                                        |
| Bottom tab bar | Andar ke iframe me bhi nahi (same pathname check)                                                                                                                            |

### 10.3 Light theme me text invisible — asli wajah

`globals.css` me purana rule hai:

```css
[class*="bg-grad-"] {
  color: #ffffff !important;
}
```

`bg-gradient-to-r` class isse match ho jati hai, isliye gradient **text**
(`text-transparent bg-clip-text bg-gradient-to-r …`) ka color white ho jata tha —
aur light theme me white-on-white = invisible (title "V-Tech Copilot", markdown `#`
headings).

Fix: AI heading ke liye dedicated class `.ai-gradient-text` (background-clip: text +
`-webkit-text-fill-color: transparent`), jo `bg-grad-*` pattern match nahi karta.
Naya gradient-text likhne se pehle isi class ka use karo.

Aur ek legacy trap: `html[data-theme="light"] select` rule har select par border +
native arrow lagata hai (specificity `0,1,2`). Chip ke andar select ko reset karne
ke liye `html[data-theme] select.ai-provider-select` (specificity `0,2,1`) chahiye —
warna `border: 0 !important` bhi harta hai.
