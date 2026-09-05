# CHANGELOG

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
