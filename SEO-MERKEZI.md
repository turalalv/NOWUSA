# SEO Merkezi

Dashboard section: `/app?section=seo-suite`. The legacy `/app/seo-suite` URL redirects to this section. All user-facing controls use Turkish.

- **Konum takibi:** USA/English organic rank snapshots, desktop and mobile, 100-result scope. Up to 10 tracked phrases, daily history (60 snapshots). Provider data or a real CSV; unknown positions are never invented.
- **Rakip kelime farkı:** own domain and up to three competitors. Match date/provider/country/language/device before comparing. An absent keyword means absent from the supplied report, not proof of no ranking. API imports at most 1,000 rows per domain.
- **Kelime araştırması:** provider search-volume estimates and provider-specific SEO difficulty. Missing values remain unknown.
- **Backlink keşfi:** at most 1,000 provider records per refresh; explicit new/lost flags. Missing rows in a limited response are not marked lost. CSV supports explicit statuses.
- **Geniş site denetimi:** a five-step wizard controls general scope, crawler identity/delay, allow/disallow paths, query parameters, robots/nofollow behavior. Server-side safety boundaries always remain: only public No Sweat USA routes, HTTPS, no account/admin/checkout paths or external redirects. No password/CAPTCHA/WAF bypass or JavaScript rendering. Maximum 60 pages, four sitemap documents, three-minute budget. Duplicate text is exact normalized text, not semantic similarity; orphan findings are candidates within the sampled crawl.
- **Raporlar ve uyarılar:** persisted in-app alerts, daily digests, job history, CSV export. No email/Slack is sent. Decline thresholds are transparent heuristics, not proof of causation.

## Connections

`DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` are server environment variables. DataForSEO is paid, and its Backlinks API may need a separate product entitlement. Credentials never enter loader responses. No provider purchase or credit charge occurs during setup. Manual provider refresh is unavailable until credentials exist; automatic paid refresh has its own opt-in. Up to 26 tasks per complete daily run with ten phrases and three competitors. User roles permitted to manage Google also manage provider/daily settings.

Optional `PAGESPEED_API_KEY` supports homepage mobile/desktop Lighthouse requests. An API error is shown as unavailable, not a fabricated score. HTML-response duration is separately labelled and is not Core Web Vitals.

## Daily execution

`.github/workflows/seo-daily.yml` calls the existing authenticated daily endpoint at 05:23 UTC. GitHub repository secret `SEO_CRON_SECRET` must match Render `CRON_SECRET`. Public-repository schedules can be delayed or disabled by GitHub inactivity rules. Module automatic work must be enabled in **Ayarlar**. Paid provider work remains separately disabled by default. A duplicate run within 20 hours is skipped. Last results and failures are visible in the module; stale data retains its original timestamps.

## CSV

Each section provides required column headers. Files are limited to 2 MB / 2,000 rows, imported atomically, and require a source name and observation date. Backlink targets and rank URLs must belong to this store. Rank device values are `mobile` / `desktop`; ranking CSV positions are 1–100 or blank for not found. Gap CSV represents desktop organic positions 1–1,000. Backlink statuses are `active`, `new`, `lost`.

## Validation

Tests cover scope separation, unknown metrics, atomic failures, ranking devices, lookalike domains, provider task errors, alert deduplication, daily idempotency, crawl boundaries, robots rules, URL parameter normalization, redirects, duplicates and URL-list mode.

Preview: `node scripts/preview-seo-suite.mjs`, then `http://localhost:4174`. It renders empty sample state and records actions locally; it does not fetch provider data or modify the store.
