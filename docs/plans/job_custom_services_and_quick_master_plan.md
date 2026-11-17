# Job Edit & Intake: Custom Services, Quick Master Creation & Billing Realtime Plan

> **Scope**: `src/app/jobs/[id]/edit/page.tsx` and `src/app/jobs/new/page.tsx`
> **Core Objective**:
> 1. Services box me **Custom Service add karne ka option** dena (bilkul Custom Spares ki tarah) taaki ad-hoc repair labor charges add ho sakein.
> 2. Products aur Services dono ke search select me **"Quick Add to Master Catalog"** modal / button dena taaki bina page chhodhe naya product/service ban sake.
> 3. Realtime dynamic billing total calculation: $\text{Total Bill} = \sum \text{Services} + \sum \text{Products}$ (live auto-sync).
> 4. Database integrity: `transaction_services` aur `transaction_products` me non-breaking schema/handling.

---

## Progress Tracker & Status Log

| Phase | Milestone / Task | Status | Completion Note |
|---|---|---|---|
| **Phase 1** | Architecture, Data Models & DB Strategy | 🟢 COMPLETED | Custom service PK handling, commission calculation rule documented. |
| **Phase 2** | Custom Service UI & State in `[id]/edit/page.tsx` | 🟢 COMPLETED | Added `showCustomService`, `customServiceName`, `customServicePrice`, auto-negative synthetic PKs (`-1`, `-2`). |
| **Phase 3** | Quick-Create Master Modals (Product & Service) | 🟢 COMPLETED | Modals added in both Edit & New Job flows with instant insert & auto-select. |
| **Phase 4** | Billing Amount Auto-Sync & Save Flow Verification | 🟢 COMPLETED | Realtime `serviceTotal + productTotal = grandTotal` formula working. Mechanic commission automatically incorporates custom services. |
| **Phase 5** | Sync with `jobs/new/page.tsx` & CI Check | 🟢 COMPLETED | `tsc --noEmit` passed cleanly; Prettier formatting checked and verified. |

---

## 1. Features Implemented & Verification

### A. Custom Service Add Karna (Ad-hoc Labor / Non-Catalog)
- **Button**: `[ + Custom service add karo (ad-hoc / non-catalog) ]` (Dashed blue button in Services box)
- **Inputs**:
  - `Service ka naam *` (e.g., Panel Dent Repair, Custom Wiring, etc.)
  - `Charge (₹)` (e.g., ₹450)
- **Working Mechanism**:
  - `service_id` ko negative synthetic IDs (`-1, -2, -3...`) assign hoti hain jo composite PK `(transaction_id, service_id)` ko hamesha unique rakhti hain bina existing DB schema ko change kiye.
  - Delete / Trash icon se remove ho sakti hai.
  - Edit mode me live amount change karne par instantly Grand Total recalculate hota hai.

### B. Master Catalog Me Nayi Service Banane Ka Option ("Master me banayein")
- **Header Link**: Services box ke header me `[ + Master me banayein ]`
- **Modal Popup**:
  - Name (Required)
  - Labor Price (Required)
  - HSN / SAC Code (e.g. 9987)
  - Description (Optional)
- **Action**: Supabase `service_list` me save hota hai, local master list me add hota hai aur current job me turant select ho jata hai!

### C. Master Catalog Me Naya Product Banane Ka Option ("Master me banayein")
- **Header Link**: Products box ke header me `[ + Master me banayein ]`
- **Modal Popup**:
  - Product Name (Required)
  - Selling Price (Required)
  - Cost Price
  - HSN Code
  - Alert Quantity (Default 5)
  - Description (Optional)
- **Action**: Supabase `product_list` me insert hota hai, inventory list me add hota hai aur job me turant product row me add ho jata hai!

### D. Billing Amount Realtime Calculation
$$\text{Grand Total} = \sum (\text{Catalog Services} + \text{Custom Services}) + \sum (\text{Inventory Products} + \text{Custom Spares})$$
- Realtime UI updates live without delay.
- Mechanic commission rate auto-calculates on total services (catalog + custom).

---

## 2. Test & Quality Audit
- **TypeScript**: `tsc --noEmit` passed with 0 errors.
- **Prettier**: Prettier check passed on both files.
- **Backward Compatibility**: Fully backward compatible with legacy transactions.
