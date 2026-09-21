# NOWUSA

No Sweat SEO Studio — Shopify embedded app

Private, single-merchant app for **No Sweat USA**, rendered inside Shopify Admin → Apps. Storefront: `https://nosweatusa.com`; public storefront identifies the shop as `iyhxfe-mw.myshopify.com`.

**Status (2026-09-21):** deployed to [Render Free](https://nowusa.onrender.com) with Neon Free PostgreSQL and installed in No Sweat USA. Shopify version `no-sweat-seo-2` is active. Startup migrations, HTTP health checks, embedded authentication and the initial catalog import (6 products, 2 collections) passed. Google Search Console OAuth and the initial API sync passed. Google OAuth remains in Testing mode (refresh tokens expire after 7 days); scheduled jobs and live product/image edits have not been verified. Production secrets are stored in Render, not in Git. The screenshots in `artifacts/` use explicitly labelled sample data.

## Included

- Product and collection SEO audit: missing/duplicate text, editorial length hints, image alt text, keyword mapping, internal-link suggestions, CSV export.
- Individual and bulk SEO drafts, Google snippet preview, exact-draft confirmation, live source recheck, persisted before/after history and reviewed rollback drafts.
- Up to 100 bulk draft suggestions per request, derived from existing product copy; up to 25 confirmed SEO writes. A failed write stops the remaining batch; earlier successful writes remain applied.
- Product image alt-text editor using Shopify MediaImage/fileUpdate. Image writes require separate review. Shared files affect every page referencing them.
- Public HTML checks for H1, canonical presence, meta noindex and JSON-LD parsing; bounded internal-link checks for 404/410; robots.txt and sitemap availability.
- Search Console OAuth connection using read-only access, encrypted refresh tokens, direct API reports for two 28-day periods, and optional daily refresh; CSV import remains available.
- JPEG/WebP/PNG compression with source-byte checks, side-by-side previews, original backups, explicit live confirmation and asynchronous Shopify processing verification.
- Backlink source tracking, link attribute checks, unlinked brand mention detection and generated search queries for opportunity research. Optional daily source checks.
- Prisma persistence, per-shop mutation lock, online merchant sessions and authenticated uninstall cleanup.

External account creation, automatic placement of backlinks, AI content generation, automatic schema injection and ranking guarantees are not included. Backlink opportunity searches open in Google; results are not scraped or automatically purchased. JSON-LD presence/syntax is not full rich-result validation. Existing theme schema is preserved. Audit scores are this app's checklist, not a Google metric.

## Connect and run

**Free trial deployment:** follow **[DEPLOY-RENDER.md](DEPLOY-RENDER.md)** for Render Free + Neon Free. The included `render.yaml` configures a free Node web service, persistent PostgreSQL storage and startup migrations. Open the installed app in [Shopify Admin](https://admin.shopify.com/store/iyhxfe-mw/apps/no-sweat-seo/app). Free hosting sleeps when idle; webhook delivery and cold-start authentication still require verification. No paid resources or daily scheduler are created by this blueprint.

For Vercel with Neon PostgreSQL, follow **[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)**. The app selects the database client from `DATABASE_URL`; local SQLite remains supported. `npm run db:generate` generates both clients and `npm run db:migrate` selects the matching migration directory. Cloud builds do not migrate databases automatically.

Node 22.12+ or Node 24, npm and Shopify CLI are required. Use Shopify Dev Dashboard to register the app for custom distribution to this store. This app is hosted by you; Shopify CLI deploy does **not** deploy the web server.

1. `npm ci`
2. Copy `.env.example` to `.env`; fill `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and the actual HTTPS `SHOPIFY_APP_URL`. Keep credentials out of chat and Git.
3. `shopify app config link --client-id YOUR_APP_CLIENT_ID` (the CLI may prompt for Shopify sign-in).
4. Confirm the linked TOML keeps `embedded = true`, scopes `read_products,write_products,read_files,write_files`, API version `2026-07`, and both app webhooks. Set the real application URL and `/auth/callback` redirect URL. Keep `ALLOWED_SHOP=iyhxfe-mw.myshopify.com` in the server environment.
5. `npm run setup`, then test with `shopify app dev --store YOUR-DEVELOPMENT-STORE.myshopify.com` on an eligible development or Plus sandbox store. The live No Sweat USA store needs the hosted production app and its installation flow; CLI dev does not target ordinary production stores. Follow Shopify's installation/permission screen and open the app through Shopify Admin.
6. Click **Kataloqu yoxla**. Draft changes are local to the app until you explicitly confirm a live update. Review Shopify staff permissions too; online tokens act as the current staff member.

The current deployment uses Render + Neon and the live URLs in `shopify.app.toml`. An alternative SQLite deployment can use the Dockerfile on an HTTPS host with a persistent volume at `/data`; container startup runs migrations. Use one application instance with SQLite and back up the volume. Multiple replicas require a shared database and migration/locking changes. Protect backups as they include Shopify sessions.

## Turkish dashboard

The interface and application messages use Turkish (`tr-TR`). The compact overview uses real catalog values with Chart.js, an icon sidebar and collapsible findings. Missing Search Console data is shown as an empty state. Run `node scripts/preview-dashboard.mjs` for a local preview with explicitly labeled sample data at `http://localhost:4173`. See `design-qa.md` for browser checks.

## Enable Google, compression and daily checks

1. Generate **INTEGRATION_ENCRYPTION_KEY** once as 64 random hex characters (see `.env.example`). Store it in the host's secret manager and back it up separately. It encrypts Google tokens and signs short-lived image delivery URLs. Changing it invalidates existing Google connections and signed image URLs.
2. In Google Cloud, enable **Search Console API**, configure the OAuth consent screen, and create a **Web application** OAuth client. Register the exact callback `https://YOUR-APP-HOST/google/callback`; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server. If the Google app is in Testing, add the store owner's Google account as a test user; Google may expire testing-mode refresh tokens after seven days. Complete Google's publishing/verification requirements for the intended use.
3. As the Shopify store owner or an explicitly delegated user, open **Google nəticələri → Google bağlantısını başlat**, follow the generated link in a new window, approve read-only access, and return to refresh connection status. The Google account must have access to a root Search Console property for `nosweatusa.com`. Select the property and click **Google hesabatını gətir**. Reports filter web search to USA, all devices, with finalized data ending three days before the current Pacific date. Each of two consecutive 28-day periods requests page, query–page and page–date reports (six report requests, plus pagination). No CSV is needed.
   To delegate Google connection management, set `GOOGLE_MANAGER_USERS` on the server to comma-separated `shop.myshopify.com:ShopifyUserId` entries. Only authenticated online sessions for the exact shop and user qualify; removing an entry revokes that delegation. Shopify role names and app-wide API scopes are not treated as Google-management permission.
4. For scheduled refresh, generate a separate random **CRON_SECRET** of at least 32 characters. On the host, schedule `npm run sync:daily` once per day with `SHOPIFY_APP_URL` and `CRON_SECRET` in its environment; alternatively configure a scheduler to **POST `/jobs/daily` with `Authorization: Bearer <CRON_SECRET>`**. Allow up to seven minutes for bounded network checks. Turn on the relevant daily checkbox inside the app. Nothing runs daily until the host scheduler is configured. Google refresh is skipped if the last successful sync was under 20 hours ago.
5. **Şəkil sıxılması** reads authoritative original bytes from Shopify, creates a smaller same-format preview when possible and stores the original in SQLite. Compare full-size images before confirmation. JPEG/WebP use quality 82; PNG is lossless. Dimensions and ICC profile are preserved; orientation is applied and other metadata may be stripped. No automatic live compression occurs. Limits: 20 MB, 40 million pixels, still images only, 10 stored compression jobs. Original backup links expire within 24 hours; opening the app generates fresh links. Download backups before deletion or uninstall. File bytes are served through signed capability URLs so Shopify can fetch them; don't share those URLs.
6. Shopify processes replacement images asynchronously. **Emal vəziyyətini yoxla** verifies the current original bytes against the prepared file. Different bytes are reported as unconfirmed rather than successful. Shopify may recompress originals; a differing result needs manual review. Backup restoration is manual using the downloaded original. The listed savings concern prepared file bytes, not measured page speed.
7. **Backlinklər** accepts up to 25 external source-page HTTPS URLs. It checks HTML links to the store and reports `nofollow`, `sponsored`, `ugc` values. Unlinked mentions are opportunities to review, not automatically sent outreach. 403/429/network failures produce unknown status, never proof of a lost link. Requests use public IPv4 DNS validation, address pinning, bounded response sizes, redirect revalidation and no credentials. IPv6-only sites aren't supported. No external messages or profile registrations are made.

Sources: [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [Shopify fileUpdate](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/fileUpdate), [Sharp output options](https://sharp.pixelplumbing.com/api-output/).

## Verification

```sh
npm run setup
npm run typecheck
npm test
npm run build
shopify app config validate --json
```

`test/` also covers OAuth state/replay, encryption context, Google pagination/failure preservation, image source changes and byte verification, signed assets, private IP rejection and backlink result interpretation. It covers draft review hashes, stale live values, partial bulk results, empty-value rollback, image updates, persistent locking, import math and crawler limits using mocks and temporary SQLite databases. These tests perform no live Shopify writes.

Optional UI smoke test: `PLAYWRIGHT_PATH=/absolute/path/to/playwright/index.mjs node scripts/browser-check.mjs`. Uses a temporary local server, the real Shopify Polaris CDN and labelled sample data, without bypassing authentication in the shipped application.

`scripts/collect-operations.mjs` extracts the application's exact GraphQL requests to `artifacts/operations/` without contacting Shopify, for official schema validation. API validation passed against 2026-07; collectionUpdate's supported `input` argument carries a deprecation warning. Main UI TypeScript and browser checks pass. The standalone toolkit component validator validates the premium components but reports an outdated standard-library error for `String.replaceAll` in the main dashboard; the actual project targets ES2022.

## Operational limits

- Catalog import is bounded to 5,000 resources; each product includes at most 100 media nodes and reports truncation. Collection URLs are inferred from handles; verify their public HTTP status with the technical checker.
- Technical audit: first 30 public page candidates and 60 internal links per run; no JS rendering, external URLs, X-Robots-Tag, Search Console index verification or Core Web Vitals.
- Source checks reduce accidental overwrites, but Shopify SEO/file mutations have no atomic compare-and-swap here. Avoid simultaneous editing of the same fields in other apps. A timeout after a write can leave an unconfirmed outcome: refresh and inspect history before retrying.
- Rollback creates a new reviewed draft only if live SEO still equals the recorded change. Alt-text restoration uses the image editor and recorded history.
- Search Console exports need matching property, dates, country/device/search-type filters. Imported row totals may differ from Google's headline totals. No causal traffic attribution is claimed.
- Keep the app host running to use the embedded app. Uninstall removes its stored sessions, workspace and history; it does not reverse previously applied store changes.

## USA customer panel

The default **ABŞ müştəriləri** tab provides:

- Click opportunities using real USA Search Console rows: at least 100 impressions, average position 3–20 and CTR below 3%. These are editorial filters, not a promised traffic increase. Existing source-based SEO drafts require review and explicit confirmation before application.
- Observed query–product matches with manually selected target phrases. The editor shows the selected phrase for review; it does not invent product claims.
- Product purchase-readiness checks: catalog image/description presence plus explicitly manual shipping, returns, claims, reviews and mobile checks.
- English outreach drafts for tracked source pages and selected catalog targets. Drafts are editable and copied manually; the app sends no messages.
- Three prioritized weekly tasks, completion and reopening. At most one task per product appears in the active top three.
- Observed USA metrics for seven days before and after an applied SEO change, excluding the change day in Pacific time. Missing coverage, capped reports and overlapping edits prevent a misleading comparison. No causal attribution or sales measurement is claimed.

Page reports are capped at 50,000 rows per period; query and daily reports at 10,000 each. Detailed reports retain the latest two periods. Google can omit rows even below these caps. Global reports and CSV imports cannot masquerade as USA API data. No paid SEO or AI API is required for this panel. Google OAuth setup and live app installation remain necessary.

## Competitor SEO import

### Backlink CSV comparison

The **Backlink müqayisəsi** menu opens `/app/backlink-import`. It is also available in the local preview at `http://localhost:8790`. Upload a comma-separated UTF-8 CSV for the selected target domain: SweatBlock, Certain Dri or No Sweat USA. Maximum 2.5 MB / 5000 rows per domain. Required headers are `source_url,target_url`; optional headers are `anchor,rel,nofollow`. Normalized aliases include `Referring page URL`, `Target URL`, `Anchor text` and `NoFollow`. Other provider layouts must be mapped to these columns before import. A blank template can be downloaded from the panel.

Imports are atomic, remove exact duplicate links and replace only the selected domain's prior report. A source hostname comparison prioritizes sources absent from the supplied own-site report and sources shared by competitors. This is neither a domain-quality score nor proof that a backlink is missing. Hostnames are compared, not registrable domains. Imported links are unverified provider claims; no live source requests, API subscription, automatic backlink discovery or placement occurs. Rel flags are preserved when supplied; unknown nofollow remains unknown. The full selected report and source comparison can be exported with spreadsheet-safe CSV cells. Use real provider exports to populate the initially empty panel. The existing live backlink checker remains a separate feature.

The SEO page detail now includes internal links (up to 500 per page). Previously saved reports need reimport to populate them. Google index status remains explicitly unverified.

Local preview: `npm run preview:competitors`, then open `http://localhost:8790`. This uses the same panel component with real saved crawler results and supports local JSON imports. No Shopify login or hosting is needed. Imports remain in memory until restart. It does not test Shopify authentication, database persistence, or live API actions. Internet is required to load the Polaris CDN. Stop with Ctrl+C. Set `PREVIEW_PORT` if port 8790 is occupied.

The **Rəqib SEO** navigation item opens `/app/competitors`. Import one `pages.json` file from `sweatblock-seo-scraper/output/sweatblock/` or `output/certaindri/` at a time (up to 2.5 MB and 500 pages). Each import replaces that domain’s prior report under the existing per-shop workspace lock. The panel displays titles, descriptions, H1, meta keywords, crawl timestamps, audit notes, and searchable phrase frequencies. These are extracted text phrases, not search-volume, ranking, or backlink-index data. The importer makes no network requests or Shopify catalog changes. Run the crawler separately; scheduled crawling is not wired into this panel.

Local TypeScript, tests, and production build pass for this integration; live installation and hosting remain unverified. The current TOML has a client ID, but its application and callback URLs are still placeholders.

### Search Console reports

Use **Google ile bağlan**, select an authorized store property from Google, then **Google raporunu getir**. No domain entry is needed for OAuth. Reports separate **Tüm ülkeler** and **ABD**, with current and previous finalized 28-day periods. Headline metrics use ungrouped `byProperty` totals; page, query/page and daily/page detail tables retain their separate aggregation. API privacy and row limits are shown; missing reports are not presented as zeros. This private app lists properties belonging to the connected No Sweat USA store. CSV import remains under an optional disclosure.
