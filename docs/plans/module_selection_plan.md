# Module Selection System — Seller-Driven

**Status:** ✅ COMPLETE (2026-09-15)
**Date:** 2026-08-21
**Scope:** Seller chooses which modules each client gets. Client sees only enabled modules in sidebar.

---

## Architecture

```
Seller Portal                    Central Supabase                 Client App
┌──────────────┐                ┌──────────────┐                ┌──────────────┐
│ New/Edit     │─── PATCH ────→│ licenses     │←── RPC call ──│ /api/license │
│ License      │                │ .enabled_    │   check_license│ /status      │
│ Modal        │                │  modules     │───────────────→│              │
│ (checkboxes) │                │ (text[])     │  returns       │ stores in    │
└──────────────┘                └──────────────┘  modules[]    │ system_info  │
                                                                 └──────┬───────┘
                                                                        │
                                                                 RootClient.tsx
                                                                 SidebarNav
                                                                 filters by
                                                                 enabled_modules
                                                                + Route Guard
                                                                (direct URL block)
```

## Module Keys

| Key | Label | Notes |
|-----|-------|-------|
| `dashboard` | Dashboard | Always enabled, not toggleable |
| `jobs` | Jobs / Repairs | |
| `sales` | Direct Sales | |
| `clients` | Clients | |
| `inventory` | Inventory | Covers: Stock, Products, Suppliers, POs, Locations, Spare Finder |
| `finance` | Finance | Covers: Overview, Payments, Expenses, Salary, Advance, Ledger, Loans, Lenders |
| `people` | People / Staff | Covers: Staff, Commission, Service Catalog |
| `reports` | Reports | Covers: All 16+ report pages |

**Always-on (no toggle):** Dashboard, Attendance, Enquiries, System, Developer

## Plan-Based Defaults

| Plan | Default Modules |
|------|----------------|
| `standard` | dashboard, jobs, clients, sales |
| `premium` | dashboard, jobs, sales, clients, inventory, finance, people, reports |
| `lifetime` | dashboard, jobs, sales, clients, inventory, finance, people, reports |

Seller ko "one-click apply standard template" ka option mile. Customize bhi kar sakta hai.

---

## Implementation Steps

### 1. `src/lib/modules.ts` — NEW FILE
- `ALL_MODULES` array with key, label, always flag
- `PLAN_DEFAULTS` — standard/premium/lifetime ke liye default modules
- `ModuleKey` type
- `isModuleEnabled(enabledModules, key)` helper
- `MODULE_TO_ROUTE` — module key se related routes ka mapping (route guard ke liye)

### 2. Central SQL Migration
```sql
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS enabled_modules text[]
  DEFAULT '{dashboard,jobs,sales,clients,inventory,finance,people,reports}';
```
- Update `check_license` RPC: return `enabled_modules`
- Update `activate_license` RPC: return `enabled_modules`

### 3. `src/lib/license.ts`
- Add `enabledModules?: string[]` to `LicenseStatus` type
- Update `activateRemoteLicense()` return to include `enabledModules`
- Update `checkRemoteLicense()` return to include `enabledModules`

### 4. `src/lib/license-admin.ts`
- Add `enabled_modules?: string[]` to `LicenseRow` type
- Add `enabled_modules?: string[]` to `LicenseInput` type
- Update `createLicense()` insert to include `enabled_modules`
- Update `updateLicense()` patch to include `enabled_modules`

### 5. `src/app/api/license/activate/route.ts`
- On activation success, save `enabledModules` in the `license_status` JSON in system_info

### 6. `src/app/api/license/status/route.ts`
- Include `enabledModules` in the returned `LicenseStatus` object
- Carry forward from remote check result or local parsed status

### 7. `src/app/api/seller/licenses/route.ts`
- Validate `enabled_modules` array in POST body
- Filter against VALID_MODULES list
- Pass to `createLicense()`

### 8. `src/app/api/seller/licenses/[id]/route.ts`
- Validate `enabled_modules` array in PATCH body
- Filter against VALID_MODULES list
- Pass to `updateLicense()`

### 9. `src/app/seller/page.tsx`
- **NewLicenseModal**: Module checkboxes + plan-based preset dropdown + Select All toggle
- **EditLicenseModal**: Same checkboxes, pre-fill from license data
- **Table**: "Modules" column showing count of active modules

### 10. `src/app/seller/client/[id]/page.tsx`
- Show enabled modules as badges in the License info card (read-only)

### 11. `src/app/RootClient.tsx`
- Pass `enabledModules` prop to `SidebarNav`
- Filter sidebar sections: Inventory, Finance, People, Reports, Jobs, Sales, Clients
- Each section checks `isModuleEnabled(enabledModules, sectionKey)` before rendering

### 12. Route Guard — `src/app/RootClient.tsx`
- In RootClient, after license check, check if current pathname belongs to a disabled module
- If disabled module → show "Module not available" inline message (not redirect, not 404)
- Uses `MODULE_TO_ROUTE` mapping from modules.ts
- Dashboard/Attendance/Enquiries/System pages bypass guard (always-on)

---

## Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Existing license (no column) | RPC returns null → all modules enabled |
| New license, all checked | Full array → all enabled |
| Some unchecked | Reduced array → only selected visible |
| All unchecked | Only dashboard visible (always-on) |
| Migration not run yet | RPC returns null → client treats as all enabled |
| Module disabled after data exists | Data preserved, re-enable anytime |

---

## Files Changed

| # | File | Change Type |
|---|------|-------------|
| 1 | `src/lib/modules.ts` | NEW |
| 2 | `docs/licensing/central-project.sql` | UPDATE |
| 3 | `src/lib/license.ts` | UPDATE |
| 4 | `src/lib/license-admin.ts` | UPDATE |
| 5 | `src/app/api/license/activate/route.ts` | UPDATE |
| 6 | `src/app/api/license/status/route.ts` | UPDATE |
| 7 | `src/app/api/seller/licenses/route.ts` | UPDATE |
| 8 | `src/app/api/seller/licenses/[id]/route.ts` | UPDATE |
| 9 | `src/app/seller/page.tsx` | UPDATE |
| 10 | `src/app/seller/client/[id]/page.tsx` | UPDATE |
| 11 | `src/app/RootClient.tsx` | UPDATE |
| 12 | `src/app/RootClient.tsx` (route guard) | UPDATE (same file) |

## Implementation Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

## PRERELEASE STATUS (2026-09-15) — all 12 steps verified in code ✅

| # | Step | Location |
|---|------|----------|
| 1 | `src/lib/modules.ts` | `ALL_MODULES`, `MODULE_TO_ROUTE`, `PLAN_DEFAULTS`, `TOGGLEABLE_KEYS`, `isModuleEnabled`, `isRouteDisabled` — all present |
| 2 | SQL (central project) | `docs/licensing/central-project.sql` L36 column + L104/119/168/175 RPC returns; L251-253 `ALTER ... ADD COLUMN IF NOT EXISTS` migration for existing central DBs |
| 3 | `src/lib/license.ts` | `enabledModules` in `LicenseStatus` (58/74/98) + remote-call returns (112/131) |
| 4 | `src/lib/license-admin.ts` | `LicenseRow`/`LicenseInput` + create/update pass-through |
| 5 | `api/license/activate` | saves `enabledModules` in `license_status` JSON → `system_info` (L82) |
| 6 | `api/license/status` | includes `enabledModules` in response + carry-forward (L125-126/187) |
| 7 | `api/seller/licenses` POST | `VALID_MODULES` filter (L80-97 body map) |
| 8 | `api/seller/licenses/[id]` PATCH | `VALID_MODULES` filter (L101-108) |
| 9 | `src/app/seller/page.tsx` | `ModuleSelect` checkboxes + plan preset dropdown + Modules table column |
| 10 | `src/app/seller/client/[id]` | Enabled Modules badges in License card (read-only, `always` dimmed) |
| 11 | `src/app/RootClient.tsx` | sidebar gates via `isModuleEnabled` (jobs/sales/clients/inventory/finance/people/reports) |
| 12 | `src/app/RootClient.tsx` guard | `isRouteDisabled` → "Module Not Available" inline (1654); LITE_MODE guard separate |

Verified: `tsc --noEmit` clean, eslint clean. Backward-compat (null-enabled_modules = all enabled) intact.
**Remaining deployment action (not code):** central-License DB par `ALTER TABLE licenses ADD COLUMN IF NOT EXISTS enabled_modules text[]` chala dena agar abhi tak nahi — `docs/licensing/central-project.sql` L251-253 (idempotent).
