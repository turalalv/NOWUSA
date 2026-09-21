# Verification — 2026-09-21

- Prisma client generation and both SQLite migrations: passed.
- Project TypeScript check: passed.
- Production client/server build: passed.
- 34 embedded-app tests: passed (10 core, 3 technical, 6 persistent workspace, 9 integrations, 6 growth).
- 11 preserved local-prototype tests: passed.
- Chromium UI smoke test: passed. Real Polaris CDN; sample product; title/description input, image draft, technical action, navigation, desktop and 390px mobile layout; no page errors or horizontal overflow.
- Screenshots: `desktop-preview.png`, `mobile-preview.png`, labelled test data.
- Eleven extracted GraphQL operations: schema-valid against Shopify Admin API 2026-07. The deprecated collectionUpdate `input` argument is still supported.
- Official standalone Polaris validator: premium components pass. Main dashboard encounters the validator's older JavaScript standard library (`String.replaceAll` missing), despite the application's ES2022 TypeScript check and real browser test passing. No claim that all toolkit checks passed.
- Registered No Sweat SEO Client ID linked through Shopify CLI. Configuration validation returned valid=true, issues=[]. Hosting URLs remain placeholders; this is not an installation or runtime test.
- Live OAuth, authenticated catalog load, live mutations, webhook delivery, production host and store installation: not verified; require registered app and hosting. No live store writes performed.

## Integration additions

Implemented Google read-only OAuth + encrypted refresh tokens, direct Search Console API reports and an authenticated scheduler endpoint; image compression previews/backups and confirmed file replacements; backlink monitoring and opportunity search links. Added eight integration tests. New image source/replacement operations and the new integration UI pass the official Shopify validators. Google consent, live API data, live image replacement and hosting scheduler still require external setup and are not claimed as verified. Automatic external backlink placement remains unspecified and is not implemented.

## USA panel additions

USA-only opportunity selection, weighted query aliases, manual readiness, persisted weekly completion, draft-only outreach and Pacific before/after windows are covered by tests. Mocked Google sync verifies six scoped report requests and preservation on a partial failure. Project typecheck, production build and official standalone Polaris validation for GrowthPanel pass. Preview images use labelled sample data, not store performance. Live registration, Google consent and hosting remain unverified.
