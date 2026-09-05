# CHANGELOG

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
