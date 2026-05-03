# PHP vs Next.js Updates Pending (Comparison Report)
*Updated: 03 May 2026 (based on latest PHP Git Logs)*

This document tracks the updates made in the legacy PHP software (`vtech-rsms-php`) that need to be implemented in the new Next.js software to achieve feature parity and modernization.

## 1. Unified Reports Center (High Priority 🚨)
- **Status**: ✅ Completed
- **Next.js Action**: Created `src/app/reports/page.tsx` with a premium dashboard, searchable grid, and categorized links.

## 2. Missing & Updated Reports (Porting Required)
The following reports were recently overhauled in PHP (Commit `b9fb3c2`):
- [x] **Daily Income Report** (`daily_income.php`) - ✅ Ported to `/reports/daily-income`
- [x] **Financial Report** (`financial_report.php`) - ✅ Ported to `/reports/financial-report`
- [x] **Monthly Profit Report** (`month_profit.php`) - ✅ Ported to `/reports/monthly-profit`
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

## 4. Back Office Module
- [x] **Status**: ✅ Completed
- **Action**: Created `src/app/back-office/page.tsx` as a modern Command Center.

## 5. PWA & Mobile Experience
- [ ] **Capacitor Sync**: Ensure `capacitor.config.ts` is ready for APK generation (Conversation `fb23a69d`).
- [ ] **PWA Manifest**: Finalize icons and offline support in `next-pwa`.

---
**Next Step for Developer**: 
1. Port the **Pending Jobs Report** to provide real-time workshop status.
2. Update **Loan & EMI Report** with latest tracking logic.
3. Finalize **PWA/APK** configuration for mobile deployment.
