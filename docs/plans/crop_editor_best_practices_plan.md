# Crop Editor Plan — 4-side resize + best practices (selection improvement)

> **Status: DONE (2026-10-11) — implement ho chuka hai, Phase 3 manual matrix
> user device test pending.** Gates green (prettier/eslint 0 errors/tsc/vitest
> 321/321). `react-easy-crop` hata ke `react-image-crop@11.1.2` laga; contract
> `openCropper` frozen — 10+ call sites zero change.
>
> User feedback (2026-10-09): crop feature abhi sudharne ki zaroorat hai —
> **selection area "charo or se" resize hona chahiye** (4 side/corner handles se
> selected area theek se define kar sake) — "jo abhi nahi ho raha".
> Plan approved via "aapki recommendation ke anusar chaliye" (2026-10-11).

## 0. Implementation log (2026-10-11)

**Phase 0 findings (source-verified):**

- `react-easy-crop@6.2.3` me crop area ka **koi resize mechanism hi nahi** —
  na corner handles, na edge handles (CSS me handle elements hain hi nahi;
  JS me sirf image drag/`onDragStart` + pinch; crop rect `getCropSize()` se
  fixed). Yaani user ki shikayat 100% sahi thi — "charo or se" ka scope hi
  nahi tha. → **Option A (config fix) ruled out**, Option B confirmed.
- `advanced-cropper` = 2 saal stale + beta warning → reject.
  **`react-image-crop@11.1.2`** chuna: 4 mahine pehle release, 2.3M weekly
  downloads, 0 dependencies, <5KB gzip, ISC/OSI, touch + **full keyboard
  a11y** (arrow-key nudge/resize + aria labels — bonus).
- **Mobile library bug mila**: `(pointer: coarse)` media query
  `.ReactCrop .ord-n/e/s/w { display:none }` drag-bar ke saath selector
  collision karta hai → edge **handles bhi** chhup jaate the (phone par sirf
  4 corner). Fix: app override in `globals.css` section 7 (specificity 0,3,0),
  sirf handles wapas (6px drag-bars touch par intentional hidden).

**Kya bana (Phase 1):**

- `ImageCropperModal.tsx` rewrite: `ReactCrop` 8 handles (4 corner + 4 edge,
  free mode), min crop 40px display, touch handles 44px (CSS var override),
  desktop 16px, rule-of-thirds grid, move = selection andar drag.
- State **percent me** (display-scaling se independent) → output par
  natural dims se convert + clamp → `cropImage` (pari space = original image).
- **Rotate ±90 = pre-rotate**: canvas se naya objectURL (JPEG 0.98), revoke
  lifecycle session cleanup me; reset/original par wapas session src.
  `cropImage` se rotation param + `Area` react-easy-crop type hataya — util
  ab self-contained (defensive clamp, single encode).
- **Reset button** (crop/rotation/ratio default par), **Esc = Cancel**,
  **live size label** (`800 × 600 px`), error banner/spinner parity.
- Ratio: caller-fixed (cover) = Fixed/Free toggle same; free callers = nayi
  **presets row Free/1:1/4:3/16:9** (§9-Q1 haan).
- **Zoom buttons hata diye** — fixed-rect ka crutch the; ab resizable selection
  hi zoom ka kaam karta hai. Session-per-`key={src}` pattern se manual reset
  code bhi gaya.
- `react-easy-crop` uninstall kiya (dependency 1 kam).

**Deferred (Phase 2 — alag story):** EXIF explicit normalize (browsers
auto-apply `image-orientation: from-image`, parity with old flow), PNG alpha
output (aaj bhi JPEG export — pre-existing behavior, logo bhi isi se jaata
tha), >2048px decode cap. **§9-Q4 device acceptance = user ka phone test
Phase 3 matrix par (abhi pending).**

---

## 1. Current state (facts)

| Fact                                | Detail                                                                                                                                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library                             | `react-easy-crop@6.2.3` andar `src/components/ImageCropperModal.tsx` (225 lines)                                                                                                                                                          |
| Contract                            | `useImageUpload` hook → `openCropper(file, { aspect?, title?, maxDim? }) → Promise<File \| null>` — **10+ call sites isi API par depend**                                                                                                 |
| Call sites                          | Pre-existing 6 (profile, users edit, mechanics, clients view, ProductFormModal, SupplierFormModal) + naye: jobs item photos (multi-file), required-parts row + form, settings logo/cover + **edit-existing flows** (Lightbox Edit button) |
| Abhi available                      | Rotate ±90°, zoom buttons 1–4x, Fixed/Free toggle (jab aspect diya ho), "Original rakho" passthrough, maxDim output cap, busy/error states, blob URL lifecycle (hook revoke)                                                              |
| Handle reality (Phase 0 me confirm) | ~~sirf 4 corner~~ → **asal finding: koi resize handle the hi nahi** (react-easy-crop crop rect fixed deta hai). Detail §0 Implementation log me                                                                                           |
| Free vs fixed                       | `aspect = 0` (free) par behavior config-dependent; fixed ratio me corner-drag sirf ratio maintain karte hain                                                                                                                              |
| Output flow                         | Crop → blob → `File` → caller `compressImage` (jobs ≤100KB rule) → upload/save. **Ye pipeline change nahi karna**                                                                                                                         |
| Kyun abhi theek nahi                | User tested (jobs/spare/cover) — selection rectangle ko side se (edge) grip karke size/position define nahi kar pate                                                                                                                      |

**Ek fix = 10+ jagah impact** (sab isi modal+hook ko use karte hain) — isi liye
contract (`openCropper` API) ko **frozen** rakhna hai, sirf modal internals badalne hain.

---

## 2. Goals / Non-goals

**Goals**

- G1: Selection rectangle **8 handles** se resize ho — **4 corners + 4 edges (sides)**, plus andar drag karke move.
- G2: `useImageUpload` ka `openCropper(file, opts) → Promise<File | null>` contract **same** — call sites **zero change**.
- G3: Free mode + fixed-aspect mode dono chalte rahein (cover = 260:112 caller-fixed; jobs/spare/logo = free).
- G4: Handles **visible on any background** (white ring + dark halo) aur **touch target ≥44px** (shop = mobile-first).
- G5: Output parity: `maxDim` cap, "Original rakho" (= `null` passthrough), PNG alpha (logo) preserve, jobs ≤100KB rule.
- G6: Gates green (prettier/eslint/tsc/vitest) + manual device matrix pass.

**Non-goals (abhi)**

- Fine-grained rotation (±1°) — ±90° enough hai zaroorat pade toh alag story.
- Filters, annotations, draw/markup, undo history.
- Server-side crop / DB me crop metadata.
- Purane photos batch-edit.

---

## 3. Options (research → decide)

### Option A — Config fix inside react-easy-crop (sasta, pehle try)

- Agar handles **maujood** hain par behave nahi kar rahe → root cause config/layout
  me hoga. Suspects: `aspect=0` free-mode quirk, `cropSize` unset,
  `restrictPosition`, `objectFit`, container/overlay (controls bar cropper area
  toh nahi dhaak rahi), `touch-none` pointer-capture conflicts, `minZoom=1`.
- **Effort: < 1 din. Dep change: 0. Risk: low.**
- Limitation: agar library me edge handles hai hi nahi (likely) → ye option fail,
  seedha Option B.

### Option B — Library swap, sirf `ImageCropperModal` ke andar (recommended fallback)

| Library                           | Handles           | Notes                                                                       |
| --------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| **`advanced-cropper` (react)** ⭐ | 4 corner + 4 edge | Modern, free/fixed stencil, rotation, TS, MIT, maintained — pehla candidate |
| `react-image-crop`                | 4 corner + 4 edge | Lightweight, stable, thoda purana UI                                        |
| `cropperjs` v2                    | 4 corner + 4 edge | Framework-agnostic, imperative (ref wrapper), classic                       |

- Sabse bada point: **modal internals swap** — `openCropper` contract same,
  `useImageUpload` same, **10+ call sites untouched**.
- **Effort: 1–2 din** (UI parity: rotate/zoom/Original/busy/error/labels).
- Bundle size note: react-easy-crop ≈ 10kb gzip → advanced-cropper ~50-80kb gzip
  (Phase 0 me exact check) — is app ke liye acceptable.

### Option C — Custom canvas cropper

- Full control (8 handles, snap presets, touch tuning) par **3–5 din** — pointer
  math, pinch, accessibility sab khud likhna. Sirf agar A + B fail ho jayein.

**Recommendation:** Phase 0 me **A ka investigation pehle** (30 min — config se
solve ho jaye toh best), warna **B + `advanced-cropper`**.

---

## 4. Phase 0 — Investigation (jab implement karein, sabse pehle)

1. **Repro matrix**: free mode (jobs item photo, spare photo, logo) vs fixed
   (settings cover 260:112) — desktop mouse **aur** phone touch, dono par.
2. **Handle truth confirm**: react-easy-crop v6.2.3 source/docs — corner-only ya
   edge handles bhi hain? (agar corner bhi respond nahi kar rahe → config bug,
   Option A.)
3. **Config suspects** ek-ek karke: `aspect=0`, `cropSize`, `restrictPosition`,
   overlay stacking, touch-action, ancestors me `transform/will-change`.
4. **User ka actual device** (jo phone shop me use hota hai) par final verify —
   mobile par hi rejection aayi hai.

---

## 5. Phase 1 — Implementation checklist

- [x] `ImageCropperModal` ka cropper area swap/fix (contract `openCropper` same)
- [x] **8 handles**: 4 corner + 4 edge (free mode); min crop size clamp
      (display 40px) — selection kabhi zero nahi hoti
- [x] Handle styling: library default (dark fill + white border — any bg par
      visible); touch target 44px (CSS var), desktop 16px
- [x] Move: selection ke andar drag = rectangle move (image nahi)
- [x] Ratio: Free (default) + caller-fixed (cover) ka Fixed/Free toggle +
      presets row Free/1:1/4:3/16:9 (free callers ke liye — Q1 haan)
- [x] Live size label: `800 × 600 px` (selection ke saath)
- [x] **Esc = Cancel**
- [x] Reset button — crop position + rotation + ratio default par (rotate
      pre-rotate hai isliye rotation wapas original src par reset hota hai)
- [x] Keyboard a11y: arrows = move/resize (library built-in, aria labels ke
      saath)
- [x] Parity: rotate ±90, "Original rakho" (`null`), busy spinner, error
      banner — zoom buttons **jaan-bujh kar nahi** (fixed-rect ka crutch the;
      resizable selection unki jagah le raha hai)
- [x] Blob URL revoke = generate kiye hue rotate URLs session cleanup me;
      `useImageUpload` ka existing lifecycle unchanged

**Touch note:** library ka mobile query edge handles chhupata tha →
`globals.css` §7 override. Fixed-aspect mode me corner-only (desktop parity —
aspect JS maintain karta hai).

---

## 6. Phase 2 — Output pipeline hardening

- **EXIF orientation**: mobile camera photos rotate aane par canvas draw
  normalize kare (`createImageBitmap(..., { imageOrientation: "from-image" })`
  ya lib) — Phase 0 me current behavior check.
- **PNG alpha**: logo SVG nahi hai par PNG transparent ho sakti hai — output type
  `blob.type` se decide (JPEG mat banao agar alpha ho).
- **Decode cap**: >2048px source ko editor me aane se pehle downscale (phone par
  smooth pointer input ke liye).
- Size ladder waise hi: crop → `compressImage` (logo maxDim 512, jobs 1600,
  default 1200) → jobs ≤100KB re-check.
- Remote-URL edit flow (fetch → blob): supabase CORS ok, data-URL ok, **SVG
  guard** (toast) already exists — regression check.

---

## 7. Phase 3 — Verification

**Gates:** `prettier --check` touched files, `eslint` touched (0 errors, 10
pre-existing warnings), `tsc --noEmit`, `vitest run` (321+).

**Manual matrix:**

| Flow                                                                   | Check                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Jobs add (multi-photo)                                                 | free crop, 8 handles, cancel = baaki skip, ≤100KB rule |
| Jobs **Edit** (lightwbox → ✂)                                          | crop → replace → lightbox wapas updated photo          |
| Required parts row + form                                              | crop → replace/draft update                            |
| Settings logo (free) / cover (260:112 fixed)                           | ratio lock, Free toggle, SVG toast, auto-save          |
| Pre-existing 6 (profile, users, mechanics, clients, product, supplier) | regression — pick → crop → save                        |
| Phone touch                                                            | pinch zoom + edge/corner drag + tap targets            |

---

## 8. Risks

| Risk                                   | Mitigation                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Library swap se 10+ flows regress      | Contract frozen + manual matrix + gates                                                   |
| Bundle growth                          | Pre-check gzip size; `advanced-cropper` tree-shake; accept ya `react-image-crop` fallback |
| Mobile pointer events (Android vs iOS) | Pointer Events base lib choose karo; do devices par test                                  |
| EXIF/PNG regressions                   | Phase 2 checks + real camera se test photo                                                |

---

## 9. Open questions (user se) — resolved

1. **Presets row** → **YES** (implemented: Free / 1:1 / 4:3 / 16:9, sirf free
   callers ke liye; cover jaise caller-fixed ratio par sirf Fixed/Free toggle).
2. Fine rotate (±1°) → **NO** (±90° enough).
3. Implement kab → **abhi** (salary P4/P5 plan ke pehle; user approved).
4. Device acceptance → **user ka actual phone** Phase 3 matrix par — abhi
   pending (gates green, UI/user device test baaki).

---

**Next step:** user Phase 3 manual matrix chalaye (§7 — jobs add/edit, parts,
settings logo/cover, pre-existing 6, phone touch) → issues aayein toh fix
sweep; sab clean ho toh ye file me "device verified" note.
