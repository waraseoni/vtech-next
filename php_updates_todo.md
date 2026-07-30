# PHP vs Next.js Updates Pending (Comparison Report)
*Updated: 30 Jul 2026 (based on latest PHP Git Logs)*

This document tracks the updates made in the legacy PHP software (`vtech-rsms-php`) that need to be implemented in the new Next.js software to achieve feature parity and modernization.

## 1. AI Integration (Latest: PHP Commit `a327276`)
- **Status**: ✅ Completed (Gemini + Groq + Claude, function-calling tools, chat UI, AI floating button)
- **New in PHP**: AI Chat Assistant with DB context-aware queries
- **Next.js**: ✅ Already has AI with function-calling tools for DB queries + AI floating button in sidebar

## 2. Digital Signature (PHP Commit `678e605`, config.php)
- **Status**: ✅ Completed
- **Next.js Action**: 
  - Created API route `POST /api/settings/signature` for file upload + canvas base64 + delete
  - Added signature UI in `/settings` (file upload + canvas drawing pad)
  - Invoices (`print-bill`, `print-combined-invoice`) now display signature image if available
- **Fields**: `meta_field = "signature"` in `system_info` table

## 3. AI Settings in System Settings (PHP commits `a327276`, `1bbebc9`)
- **Status**: ✅ Completed
- **Next.js Action**: Added AI Settings section to `/settings`:
  - Provider selection (Groq/Gemini)
  - API Key input with show/hide toggle
  - Model dropdown (filtered by provider)
  - "Test API" button
  - Save AI Settings button
- **Fields**: `ai_provider`, `ai_api_key`, `ai_model` in `system_info` table

## 4. GSTIN Dynamic from DB (PHP Commit `2e21de9`)
- **Status**: ✅ Completed
- **Next.js Action**: Both `print-bill` and `print-combined-invoice` routes now fetch `gst_no`/`gstin` dynamically from `system_info` table instead of hardcoded value.
- **GST Calculation**: Already tax-exclusive (GST on top of service amount). No change needed.

## 5. Item/Device Name on Invoices (PHP Commit `2e21de9`)
- **Status**: ✅ Already present
- **Next.js**: `txn.item` already displayed on invoice as "Item/Model"

## 6. WhatsApp Message Templates (PHP Commit `d8f0088`)
- **Status**: ✅ Completed earlier
- **Next.js**: `/settings/whatsapp-templates` with 10 templates, edit/restore/history

## 7. Universal Search with Mobile Support (PHP latest TopBarNav)
- **Status**: ✅ Completed earlier
- **Next.js**: `NavbarSearch` component with Ctrl+K shortcut, cross-table search

## 8. WhatsApp Business API Integration
- **Status**: ⏳ Pending (not in PHP either — PHP uses `wa.me` links only)
- **Next.js**: Uses `wa.me` links like PHP; no WhatsApp Business API integration yet

## 9. Loan & EMI Report
- **Status**: ⏳ Pending (already marked in previous todo)
- **Next.js**: Not ported yet

## 10. Backup & Restore
- **Status**: ✅ Already done
- **Next.js**: `/backup` page exists with create/restore/dry-run

## 11. Settings: Logo, Cover, Banner Upload
- **Status**: ⏳ Not ported
- **Next.js**: `/settings` page doesn't have logo/cover/banner upload yet

---

**Next Step for Developer**:
1. ~~Port AI Chat Assistant~~ ✅ Done
2. ~~Port Digital Signature~~ ✅ Done
3. ~~Port AI Settings configuration~~ ✅ Done
4. ~~Make GSTIN dynamic~~ ✅ Done
5. Port Logo/Cover/Banner upload to settings page (medium priority)
6. Port Loan & EMI Report updated logic (low priority)
