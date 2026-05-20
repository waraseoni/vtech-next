# PHP vs Next.js Updates Pending (Comparison Report)
*Updated: 06 May 2026 (based on latest PHP Git Logs)*

This document tracks the updates made in the legacy PHP software (`vtech-rsms-php`) that need to be implemented in the new Next.js software to achieve feature parity and modernization.

## 1. Unified Reports Center (High Priority 🚨)
- **Status**: ✅ Completed
- **Next.js Action**: Created `src/app/reports/page.tsx` with a premium dashboard, searchable grid, and categorized links.

## 2. Missing & Updated Reports (Porting Required)
The following reports were recently overhauled in PHP (Commits `df79d38`, `c54f168`, `8921466`):
- [x] **Daily Income Report** (`daily_income.php`) - ✅ Ported to `/reports/daily-income`. *Includes interactive drill-down modals.*
- [x] **Financial Report** (`financial_report.php`) - ✅ Ported to `/reports/financial-report`
- [x] **Monthly Profit Report** (`month_profit.php`) - ✅ Ported to `/reports/monthly-profit` with interactive drill-down modals.
- [x] **Business Summary** (`business.php`) - ✅ Integrated into `/reports/vyapar-darpan`
- [x] **Vyapar Darpan** (`vyapar_darpan.php`) - ✅ Ported to `/reports/vyapar-darpan`
- [x] **Pending Jobs Report** (`pending_jobs.php`) - ✅ Ported to `/reports/pending-jobs`
- [ ] **Loan & EMI Report** (`loan_report.php`) - *Updated logic pending.*
- [x] **Balance Sheet** (`balancesheet.php`) - ✅ Existing/Updated

## 3. Commission & Salary Management (Major Update)
Recent PHP commits (`9f5628a`, `b0ebac6`) introduced significant changes to how mechanic commissions are tracked.
- [x] **Commission Master**: ✅ Implemented unified tabbed system in `/mechanics/commission`.
- [x] **Commission History**: ✅ Integrated into the unified Commission page.
- [x] **Mechanic Ledger**: ✅ Ported to `/mechanics/ledger/[id]` and modal integration.
- [x] **Salary Management**: ✅ Logic verified and fixed in `src/app/salary`.

## 4. Client & Operations Management
- [x] **Client List Exports** (`export_clients.php`): ✅ Ported to `/clients` with Excel/PDF exports.
- [x] **View Client Payment**: ✅ Synced responsive table styling and layout logic (`view_client.php`, `edit_payment.php`) with NextJS.
- [x] **Activity Log**: ✅ Reviewed and ported to `/activity-logs` with mobile-responsive view.

## 5. Back Office Module
- [x] **Status**: ✅ Completed
- **Action**: Created `src/app/back-office/page.tsx` as a modern Command Center.

## 6. PWA & Mobile Experience
- [x] **Capacitor Sync**: ✅ Ensured `capacitor.config.ts` is ready for APK generation.
- [x] **PWA Manifest**: ✅ Finalized icons and offline support in `next-pwa` and `manifest.json`.

---
**Next Step for Developer**: 
1. ~~Port the **Monthly Profit Drill-downs**~~ ✅ Done
2. ~~Port **Client List Export** functionality.~~ ✅ Done
3. ~~Review and sync the **Daily Income Report** layout updates.~~ ✅ Done
4. ~~Finalize **PWA/APK** configuration for mobile deployment.~~ ✅ Done
