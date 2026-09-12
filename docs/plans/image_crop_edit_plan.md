# Plan: Image Crop / Edit on Upload

> Status: **PHASE 1 DONE (2026-09-12)** — crop editor + hook + 2 pilot sites.
> Created: 2026-09-17 · User request: "images ko crop ya edit ka feature" (plan only)

---

## 1. Goal

Upload ke waqt koi bhi image ko **crop/rotate** karke upload kar sakein — before compression. Photo lete hi ek editor modal khule: drag-to-move, pinch/zoom, rotate, aspect-ratio preset. Confirm par cropped output compress hokar upload hoga (existing 100KB cap jaise hai).

---

## 2. Current state (verified 2026-09-17)

- **8 upload flows**, sab ek hi util se jate hain:
  - `compressImage(file, maxDim?)` in `src/lib/imageCompression.ts` — canvas draw → JPEG ∥ WebP, ≤100 KB
  - `openCamera()` (Capacitor native) picks file → same `compressImage`
- Call sites (`grep compressImage|openCamera`):
  1. `profile/page.tsx:65` — profile avatar
  2. `users/[id]/edit/page.tsx:77` — user avatar
  3. `clients/[id]/view/page.tsx:403` — client photo
  4. `mechanics/[id]/page.tsx:216` — mechanic photo
  5. `components/ProductFormModal.tsx:152` — product photo
  6. `components/SupplierFormModal.tsx:127` — visiting card (maxDim 1400)
  7. `jobs/[id]/view/page.tsx:371` — job repair photos (batch `Promise.all`)
  8. `settings/page.tsx` — logo/cover/signature (openCamera only, no compress)
- **No crop library installed.** Dependencies me कोई `react-easy-crop` / `react-image-crop` nahi hai.
- Dark UI + mobile-first (Capacitor app) — editor modal ko bhi same look follow karna hai.

---

## 3. Library decision

### Option A — `react-easy-crop` (RECOMMENDED)
- Touch-native (gesture zoom/pan) — mobile/camera flow ke liye perfect
- Headless — hum apna dark UI modal banate hain (codebase style match)
- React 19 compatible, zod nahi/kaam nahi — small (~6KB gzip)
- Rotation + area output built-in

### Option B — `react-image-crop`
- Classic draggable crop box, bahut stable
- Desktop-first feel; mobile par thoda clunky
- Extra styling needed for dark theme

### Option C — Hand-rolled canvas crop (no dependency)
- Zero naye dep (codebase ka canvas approach match)
- Par drag/resize/zoom/touch math khud likhna — effort 3–4×, bugs ka risk
- **Sirf chuno agar "no new dependency" hi must ho**

**Recommendation: Option A** (react-easy-crop) — feature-rich, mobile-ready, humara modal control.

---

## 4. Design

### 4.1 New pieces (1 dep + 3 files)

```text
package.json            + react-easy-crop   (~6KB gzip)
src/lib/imageCropper.ts    → cropImage(dataUrl, crop, rotation, outW, outH) → Blob/File (canvas; compressImage jaisi shape)
src/components/ImageCropperModal.tsx  → full-screen dark editor modal
src/lib/useImageUpload.ts   → hook: pick → crop modal → compress → CompressedImage
```

Flow (har upload site ke liye same):

```
file picked (gallery / camera)
   → show crop modal (preview + draggable area + zoom + rotate 90° L/R)
   → "Crop" → canvas crop (aspect preset se)
   → compressImage(croppedFile, maxDim)   [existing, untouched]
   → upload / state (preview dikhta hai as before)
```

### 4.2 Aspect-ratio presets per site (phase 2)

| Upload site | Aspect | Rasa |
|---|---|---|
| Profile / user avatar | 1:1 crop | circle thumb |
| Client photo | 1:1 | square thumb grid |
| Mechanic photo | 1:1 | square thumb table |
| Product photo | 1:1 (ya free) | inventory thumb |
| Supplier visiting card | 3:2 landscape (free allowed) | card shape |
| Job repair photos | 4:3 (free allowed) | gallery grid |
| Settings logo | **free — crop nahi** (transparency chahiye) | logo na bado |
| Settings cover / signature | free (cover) · free tight (signature) | — |

- Har site crop modal par `aspect` prop dega; `free` par user ratio khol sakta hai.
- Logo case me "Skip crop / Use original" toggle — PNG transparency na ghataye.

### 4.3 Editor modal features

- Move (drag) · Zoom (pinch/wheel) · Rotate 90° (L/R buttons)
- Aspect preset badge (1:1/3:2/4:3/free) — toggle on the fly
- "Crop & Done" + "Cancel" (original file discard)
- Dark glass UI, lucide icons (existing pattern)
- Portrait/landscape camera output handle hota hai (react-easy-crop orientation-safe)

### 4.4 Integration

- Phase 1: **wiring point = `useImageUpload` hook** + crop modal → **2 pilot sites** (Product photo + Visiting card)
- Phase 2: rollout baaki 6 sites (sirf call replace, aspect preset set)
- Phase 3 (optional): brightness/contrast slider (canvas filters), "re-edit" after upload

---

## 5. Files touched

| File | Change |
|---|---|
| `package.json` | + `react-easy-crop` |
| `src/lib/imageCropper.ts` | new |
| `src/components/ImageCropperModal.tsx` | new |
| `src/lib/useImageUpload.ts` | new (orchestrator) |
| 8 upload call sites | replace `compressImage(file)` → `useImageUpload(file, {aspect})` |
| `src/lib/nativeCamera.ts` | unchanged (crop flow usi se jude) |

**No DB / schema / migration changes.**

---

## 6. Risks & notes

- **Logo transparency:** JPEG export alpha drop karta hai — logo flow me original/image keep karna (skip-crop toggle).
- **EXIF rotation:** react-easy-crop handles it; humara canvas output normalized JPEG.
- **Batch photos (job):** sab crop nahi karwate — sirf "edit" button per thumbnail bhi de sakte hain (phase 2 decision).
- **Mobile perf:** source file pehle hi resize hota hai (small canvas) — koi bottleneck nahi.
- **Bundle:** +~6KB gzip — negligible.

---

## 7. Estimate

| Phase | Work | Effort |
|---|---|---|
| P1 | dep + crop lib + modal + hook + 2 pilot sites | 1 beta session |
| P2 | baaki 6 sites + aspect tilt | 0.5–1 session |
| P3 | contrast/redo (optional) | 0.5 session |

---

## 8. Open questions (user decide karne par)

1. Crop editor **har photo pe** khule (default), ya sirf pehli baar + "Edit" button?
2. Aspect defaults table (4.2) ok?
3. Logo/canvas transparency wala edge-case — crop skip toggle theek hai?
4. Phase 1 me kaunsa pilot site pehle — **Product** ya **Visiting card**?

---

## 9. EXPERT RECOMMENDATION (2026-09-17)

### Verdict
Feature **banao, par slim banao** — crop + rotate hi hai jo iska 80% value hai. Full "image editor" (brightness/contrast/filters) **NAHI banao** — repair shop flow me iska business use case nahi hai, sirf complexity badhegi. Isliye:
- ✅ Crop + move + zoom + rotate 90° (Phase 1 + 2)
- ❌ Phase 3 (contrast/brightness/redo) — **drop karo**, kabhi zaroorat lage to baad me.

### Kaunse sites pe sabse zyada value hai (ROI order)
1. **Visiting card (Supplier)** — ⭐ sabse high. Camera se bade/angled photos ane wale hain; crop+rotate ki zaroorat ROZ hoti hai.
2. **Client / Mechanic / Profile / User avatar** — 1:1 crop useful (circle/thumb quality).
3. **Product photo** — moderate (mostly studio-ish photos).
4. **Job repair photos** — low value. Fault capture hai, crop se kuch nahi badalta; default crop box hi non-destructive rakhna.
5. **Logo / Cover / Signature (Settings)** — **crop mat karna at all.** Ye user ki prepared images hain; PNG transparency + aspect > crop. Inhe editor se bahar rakho.

### 4 expert design points
1. **"Use as is" fail-safe:** Har photo par auto-open mat karo sirf — modal me ek **prominent "Original rakho / Continue"** button lo. Jo photo already theek hai use ek tap me skip ho jaye, warna user ko 'extra step' feel hoga. (react-easy-crop default zooms-to-fit, isliye bina skip-button ke har photo recrop-feel degi.)
2. **Rotation > fancy crop box:** Camera photos ko sabse zyada 90° fix chahiye. Rotate ko hamesha 1-tap rakho. Crop box auto (smart) nahi chahiye.
3. **Aspect presets ko default-do, lock mat karo:** 1:1/3:2 free toggle. Jabardasti box band mat karo (jaise visiting card me bill bhi aa jata hai, free chahiye).
4. **Dependency — react-easy-crop correct choice hai:** Mobile-first app hai; touch gesture crop khud likhna notorious-fiddly hai (drag math, pinch zoom, boundary clamp). Ek known-good lib se polish shorcut milega. Codebase already canvas par hai — crop phir compress, **resize free hai**, koi downward par sabse chota upload.

### Priority (what I'd actually ship)
- **Phase 1:** react-easy-crop + `imageCropper.ts` + dark modal + `useImageUpload` hook → **pilot = Visiting Card** (highest ROI) + Product photo.
- **Phase 2:** baaki 4 avatar sites (1:1 preset). Logo/cover/signature **chhodo**.
- **Koi Phase 3 nahi.** Jo phir miss lage usko us time decide karenge.

### Answers to open questions (meri recommendation)
- Q1 → Auto-open har photo par, **"Use original" button ke saath**.
- Q2 → Table 4.2 ok, except logo/cover/signature ko "free/crop-nahi" karo (hamesha original).
- Q3 → Skip toggle ki jagah better: un 3 settings-wale sites ko editor se **completely exclude** karo.
- Q4 → **Visiting card pehle**.

---

## 10. SHIPPED — Phase 1 + Phase 2 (2026-09-12)

**Phase 1:**
- ✅ `react-easy-crop@6.2.3` installed → `Cropper` component (CSS auto-inject, koi global-css import nahi chahiye — Next App Router safe)
- ✅ `src/lib/imageCropper.ts` — `cropImage(src, pixelCrop, rotation, maxDim?)` canvas util (rotateSize + bbox rotated draw + crop-extract; official easy-crop approach, 90°-steps)
- ✅ `src/components/ImageCropperModal.tsx` — full-screen dark editor: crop/move/zoom (pinch+wheel+buttons), 90° L/R rotate, Fixed↔Free aspect toggle, **"Original rakho"** one-tap skip, "Crop Karo" confirm (ref render-access lint rule safe — `cropReady` state)
- ✅ `src/lib/useImageUpload.tsx` — `openCropper(file, {aspect,title,maxDim}) → Promise<File|null>` (null = cancelled); cropped blob → File, "original" → as-is File; blob-URL revoke cleanup

**Phase 2 (avatars — 1:1 preset):**
- ✅ **ProductFormModal** (1:1) + **SupplierFormModal visiting card** (3:2) — camera & gallery dono flows editor se hoke jate hain
- ✅ **Profile avatar** (`profile/page.tsx`) — 1:1
- ✅ **User avatar** (`users/[id]/edit/page.tsx`) — 1:1
- ✅ **Client photo** (`clients/[id]/view/page.tsx`) — 1:1
- ✅ **Mechanic photo** (`mechanics/[id]/page.tsx`) — 1:1
- Logo/cover/signature (settings) crop flow me NAHI — plan ke hisaab se excluded

Upload compression unchanged (crop → `compressImage` → ≤100 KB)
- Verify: tsc ✅ · eslint ✅ (new files 0 issues) · vitest 101 ✅ · `npm run build` ✅