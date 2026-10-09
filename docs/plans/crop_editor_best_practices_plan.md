# Crop Editor Plan — 4-side resize + best practices (selection improvement)

> **Status: PLAN ONLY (2026-10-09) — implementation gated, user approval pending.**
> User feedback (2026-10-09): crop feature abhi sudharne ki zaroorat hai —
> **selection area "charo or se" resize hona chahiye** (4 side/corner handles se
> selected area theek se define kar sake) — "jo abhi nahi ho raha". Plan banao,
> **bad me theek karenge**. **Abhi koi code nahi.**

---

## 1. Current state (facts)

| Fact                                 | Detail                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Library                              | `react-easy-crop@6.2.3` andar `src/components/ImageCropperModal.tsx` (225 lines)                                                                                                                                                                                                     |
| Contract                             | `useImageUpload` hook → `openCropper(file, { aspect?, title?, maxDim? }) → Promise<File \| null>` — **10+ call sites isi API par depend**                                                                                                                                            |
| Call sites                           | Pre-existing 6 (profile, users edit, mechanics, clients view, ProductFormModal, SupplierFormModal) + naye: jobs item photos (multi-file), required-parts row + form, settings logo/cover + **edit-existing flows** (Lightbox Edit button)                                            |
| Abhi available                       | Rotate ±90°, zoom buttons 1–4x, Fixed/Free toggle (jab aspect diya ho), "Original rakho" passthrough, maxDim output cap, busy/error states, blob URL lifecycle (hook revoke)                                                                                                         |
| Handle reality (to verify — Phase 0) | react-easy-crop ke docs/source ke hisaab se **sirf 4 CORNER handles** milte hain — **edge/side handles nahi**. Isliye "charo taraf se resize" ki expectation isi se toot-ti hai. Config bug bhi ho sakta hai (handles hain par kaam nahi rahe) — dono cases Phase 0 me confirm honge |
| Free vs fixed                        | `aspect = 0` (free) par behavior config-dependent; fixed ratio me corner-drag sirf ratio maintain karte hain                                                                                                                                                                         |
| Output flow                          | Crop → blob → `File` → caller `compressImage` (jobs ≤100KB rule) → upload/save. **Ye pipeline change nahi karna**                                                                                                                                                                    |
| Kyun abhi theek nahi                 | User tested (jobs/spare/cover) — selection rectangle ko side se (edge) grip karke size/position define nahi kar pate                                                                                                                                                                 |

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

- [ ] `ImageCropperModal` ka cropper area swap/fix (contract `openCropper` same)
- [ ] **8 handles**: 4 corner + 4 edge; min crop size clamp (display ~48px) —
      selection kabhi zero na ho
- [ ] Handle styling: white ring + dark shadow halo; visible hit area ≥14px,
      touch target ≥44px; hover/active feedback
- [ ] Move: selection ke andar drag = rectangle move (image nahi) — expected UX
- [ ] Ratio: Free (default) + caller-fixed (cover) lock + existing Fixed/Free
      toggle banaye rakho; **bonus (open Q1)** presets row: 1:1 / 4:3 / 16:9
- [ ] Live size label: `800 × 600 px` (selection ke saath)
- [ ] **Esc = Cancel** (abhi cropper me Esc kuch nahi karta; close-first design
      ki wajah se lightbox ke saath conflict nahi)
- [ ] Reset button — crop position + zoom + rotation ek click me
- [ ] Keyboard a11y: arrows = move, shift+arrows = resize (library support ho toh)
- [ ] Parity: rotate ±90, zoom buttons, "Original rakho" (`null`), busy spinner,
      error banner — sab waise hi
- [ ] Blob URL revoke = `useImageUpload` ka existing lifecycle (modal src koi
      create kare toh wahi revoke kare)

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

## 9. Open questions (user se)

1. **Presets row** chahiye (Free / 1:1 / 4:3 / 16:9) ya sirf Free + caller-fixed
   ratio (current behavior) kaafi hai?
2. Fine rotate (±1°) kabhi zaroorat ya ±90° enough?
3. Implement **kab** — abhi, ya salary P4/P5 plan ke baad (priority order)?
4. Confirm device: shop ka actual phone kaunsa hai (iOS/Android) — usi par
   final acceptance.

---

**Next step:** user ka "go" → Phase 0 investigation → Option A/B decide →
Phase 1–3 execute → ye file me status update (PLAN → DONE date).
