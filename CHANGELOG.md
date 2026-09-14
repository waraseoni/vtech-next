# CHANGELOG

## [1.17.0](https://github.com/waraseoni/vtech-next/compare/v1.16.1...v1.17.0) (2026-09-14)

### Features

* **clients:** show pending 'Done' (status 2) repair totals on view + list ([f6d1e80](https://github.com/waraseoni/vtech-next/commit/f6d1e803c1241e2554407957a5d0bd1e4a4adece))

## [1.16.1](https://github.com/waraseoni/vtech-next/compare/v1.16.0...v1.16.1) (2026-09-14)

### Bug Fixes

* **license:** transient central RPC errors must not invalidate license; gate Refresh forces live recheck ([387af0b](https://github.com/waraseoni/vtech-next/commit/387af0b5e9fc055a21d3034e6d0de8c1b77e7d16))

## [1.16.0](https://github.com/waraseoni/vtech-next/compare/v1.15.2...v1.16.0) (2026-09-14)

### Features

* **suppliers:** contact persons model + person-linked POs/payments & PO detail page ([411cc77](https://github.com/waraseoni/vtech-next/commit/411cc77f4f54d71e613b18b488058e0701661466))

## [1.15.2](https://github.com/waraseoni/vtech-next/compare/v1.15.1...v1.15.2) (2026-09-13)

### Bug Fixes

* **ci:** shorten vercel.json ignoreCommand to <=256 chars ([d8a2fa5](https://github.com/waraseoni/vtech-next/commit/d8a2fa5c4e71e94c4b57d07082bf42605d641e05))

## [1.15.1](https://github.com/waraseoni/vtech-next/compare/v1.15.0...v1.15.1) (2026-09-13)

### Performance Improvements

* **app:** faster boot + lighter eager load; add NEXT_PUBLIC_LITE_MODE build ([c26e800](https://github.com/waraseoni/vtech-next/commit/c26e800836cad6cd077ab9d53e41397edd3c30da))

## [1.15.0](https://github.com/waraseoni/vtech-next/compare/v1.14.0...v1.15.0) (2026-09-12)

### Features

* **reports:** stock valuation report with per-category valuation breakdown ([85e9ccf](https://github.com/waraseoni/vtech-next/commit/85e9ccf13e3c68880b9f4ce5f1ec7858627c9f83))
* **suppliers:** mobile-first card redesign + active call/WhatsApp/mail links ([32f3081](https://github.com/waraseoni/vtech-next/commit/32f30818bb06b743a356db360370e55819f1a050))

## [1.14.0](https://github.com/waraseoni/vtech-next/compare/v1.13.0...v1.14.0) (2026-09-12)

### Features

* **reports:** supplier spending / purchase report page ([1a0ad01](https://github.com/waraseoni/vtech-next/commit/1a0ad010383c6c3d0ae7f13aad10f3cb904d47c0))

## [1.13.0](https://github.com/waraseoni/vtech-next/compare/v1.12.0...v1.13.0) (2026-09-12)

### Features

* **suppliers:** GST/bank/credit-terms supplier form enrichment ([b168495](https://github.com/waraseoni/vtech-next/commit/b168495bfd3e50e87403a9f5fbfbfb6e6ea5801d))

## [1.12.0](https://github.com/waraseoni/vtech-next/compare/v1.11.0...v1.12.0) (2026-09-12)

### Features

* **parts:** required-parts to PO conversion bridge ([45cb463](https://github.com/waraseoni/vtech-next/commit/45cb4634f9c9ace56d20e65142ab658f1d6337c1))

## [1.11.0](https://github.com/waraseoni/vtech-next/compare/v1.10.0...v1.11.0) (2026-09-12)

### Features

* **images:** crop/rotate editor for all avatar sites (1:1) ([4f8fbc7](https://github.com/waraseoni/vtech-next/commit/4f8fbc720765c88103a08b87c83778e67373d7f0))

## [1.10.0](https://github.com/waraseoni/vtech-next/compare/v1.9.0...v1.10.0) (2026-09-12)

### Features

* **images:** crop/rotate editor on upload — visiting card + product pilot ([00185f0](https://github.com/waraseoni/vtech-next/commit/00185f029ff5b42e143ecd16ab51dd3e8b2cd264))

## [1.9.0](https://github.com/waraseoni/vtech-next/compare/v1.8.3...v1.9.0) (2026-09-12)

### Features

* **suppliers:** fix PO status display + supplier payments/dues ledger ([34bb8e0](https://github.com/waraseoni/vtech-next/commit/34bb8e04e8ed9d20917231b370f09c76016c2523))

## [1.8.3](https://github.com/waraseoni/vtech-next/compare/v1.8.2...v1.8.3) (2026-09-12)

### Bug Fixes

* **jobs:** don't reset status to pending when editing a job ([5911330](https://github.com/waraseoni/vtech-next/commit/59113300330d5871ed9574f724fe4fb017557801))

## [1.8.2](https://github.com/waraseoni/vtech-next/compare/v1.8.1...v1.8.2) (2026-09-12)

### Bug Fixes

* **jobs:** commission on services only (exclude spare parts); link job number to job view ([bbae555](https://github.com/waraseoni/vtech-next/commit/bbae555a3f26d0eb18ac4d0575e45a88f0dae491))

## [1.8.1](https://github.com/waraseoni/vtech-next/compare/v1.8.0...v1.8.1) (2026-09-12)

### Bug Fixes

* **suppliers:** prevent null email/address crash + bigger visiting card preview ([a99c34f](https://github.com/waraseoni/vtech-next/commit/a99c34fd4cef615c989dc8fe5bcff67693ff8911))

## [1.8.0](https://github.com/waraseoni/vtech-next/compare/v1.7.2...v1.8.0) (2026-09-11)

### Features

* **suppliers:** visiting card + multi-contact + WhatsApp + global image zoom + image manager ([9f9735e](https://github.com/waraseoni/vtech-next/commit/9f9735ede17125d2e58d5edd39da518079dc2209))

## [1.7.2](https://github.com/waraseoni/vtech-next/compare/v1.7.1...v1.7.2) (2026-09-11)

### Bug Fixes

* **jobs:** preview-only job-id peek, claim at save (no id waste on page open) ([05b4022](https://github.com/waraseoni/vtech-next/commit/05b4022f4b7f5327cd6d89b2bcfdf100dc02ca4d))

## [1.7.1](https://github.com/waraseoni/vtech-next/compare/v1.7.0...v1.7.1) (2026-09-11)

### Bug Fixes

* **jobs:** atomic job-id claim + double-submit guard (duplicate rows race) ([d263094](https://github.com/waraseoni/vtech-next/commit/d263094df7e2f6b7a50fe23dc8e175e199087602))

## [1.7.0](https://github.com/waraseoni/vtech-next/compare/v1.6.0...v1.7.0) (2026-09-05)

### Features

* **inventory:** box labels print/preview parity + card UI overhaul ([1d6b821](https://github.com/waraseoni/vtech-next/commit/1d6b821b45ca89b63320fb1f1ae98e36fc9f3e9d))

## [1.6.0](https://github.com/waraseoni/vtech-next/compare/v1.5.1...v1.6.0) (2026-09-05)

### Features

* **db:** backport job_required_parts + transaction_products PK rework into final idempotent schema ([23feab3](https://github.com/waraseoni/vtech-next/commit/23feab3dedf4b4d02320a139e868b9a408d15d35))
* **jobs:** photo attach option in required spare add form ([d6b570b](https://github.com/waraseoni/vtech-next/commit/d6b570b0afe24aa07a34a87ce3d7f19a546bfa48))
* **jobs:** required parts / waiting for spare purchase tracking ([a147034](https://github.com/waraseoni/vtech-next/commit/a1470344d35d4f11fa605e5eb7f1e30b00a5e7b4))
* **jobs:** waiting-parts badge + bucket cleanup on part delete ([268e9fe](https://github.com/waraseoni/vtech-next/commit/268e9febe95f4bbbb7b6e09add53e6766f5d6b0a))
* **parts:** dashboard waiting-parts summary card + sidebar link ([ac12312](https://github.com/waraseoni/vtech-next/commit/ac12312af12a7939bafea07b5efa21dcc66466d4))

### Bug Fixes

* **jobs:** rework transaction_products PK to allow nullable product_id ([569d579](https://github.com/waraseoni/vtech-next/commit/569d579ae7ed74bb239a177f364e134e4146e2b8))

## [1.5.1](https://github.com/waraseoni/vtech-next/compare/v1.5.0...v1.5.1) (2026-09-05)

### Bug Fixes

* **box-labels:** rigid print layout with auto-fit content font ([eaced73](https://github.com/waraseoni/vtech-next/commit/eaced732fb4c35b1dd9f2bbc1fbb41898d113e56))

## [1.5.0](https://github.com/waraseoni/vtech-next/compare/v1.4.0...v1.5.0) (2026-09-05)

### Features

* **jobs:** per-row spot set/change on jobs list page ([683b204](https://github.com/waraseoni/vtech-next/commit/683b2048b708aa2f95c1e7e2c241a565a1e26e85))

## [1.4.0](https://github.com/waraseoni/vtech-next/compare/v1.3.0...v1.4.0) (2026-09-05)

### Features

* **locations:** cascading parent-tree picker for racks/bins/boxes; reparent on edit ([743041f](https://github.com/waraseoni/vtech-next/commit/743041f351cb6c10b116a17f9d47e6a295b492aa))

## [1.2.0](https://github.com/waraseoni/vtech-next/compare/v1.1.0...v1.2.0) (2026-09-05)

### Features

* **settings,ui:** configurable auto-logoff timing; dynamic sidebar build version ([1a2f655](https://github.com/waraseoni/vtech-next/commit/1a2f655d380285c5705f55b562f71d8e327dc5ed))

## [1.1.0](https://github.com/waraseoni/vtech-next/compare/v1.0.2...v1.1.0) (2026-09-05)

### Features

* **reports:** redesign sales & service report UI; fix custom report date filtering ([8aace59](https://github.com/waraseoni/vtech-next/commit/8aace598a11c8d98001e53a6e8486b5763dbc177))

## [1.0.2](https://github.com/waraseoni/vtech-next/compare/v1.0.1...v1.0.2) (2026-09-05)

### Bug Fixes

* **reports:** drop non-existent payment_mode column from expense_list select ([7fb6438](https://github.com/waraseoni/vtech-next/commit/7fb6438008bf56acbc5f00410fcc18ac221aac7c))

This file is maintained automatically by [semantic-release](https://semantic-release.gitbook.io/) —
do not edit by hand. Version bumps follow [Conventional Commits](https://www.conventionalcommits.org/).

## [1.0.0](https://github.com/waraseoni/vtech-next/releases/tag/v1.0.0) (2026-09-04)

### Features

- Version control setup: build-time app version (`NEXT_PUBLIC_APP_VERSION`) with badges on the
  login page and Settings header.
- Version helper (`src/lib/app-version.ts`), release scripts, and initial `v1.0.0` git tag.
- Existing features up to this point: salary/ledger 1000-row cap fix, box labels, suppliers,
  universal search locations, AI chat links, requirement-list, and more.
