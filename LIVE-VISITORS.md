# Live visitors

The Visitor analytics screen includes a first-party event feed alongside the separate GA4 historical reports. No GA4 connection is required for the feed.

## Install once

1. In the app, choose **Ziyaret takibini hazırla / aç**, then **Piksel kodunu indir**.
2. Shopify Settings → Customer events → Add custom pixel, named **No Sweat Visitors**.
3. Paste the downloaded JavaScript, set **Permission required: Analytics only**, **Data sale: does not qualify**, save and connect. Do not install duplicate copies.
4. Open the storefront with analytics consent, browse a product, and check the feed. “Tracking enabled” only means the collector accepts events; it is not proof the pixel was installed. The first actual event verifies installation.

The manager can pause new collection from the app. Shopify can also disconnect the pixel. Uninstalling the app removes both tracker settings and visitor records.

## Measurement

- Standard Shopify `page_viewed` and `product_viewed` events. Products count product events, while page views count page events, so receiving both does not double page totals.
- A random tab session expires after 30 minutes idle or UTC day rollover. The server stores only keyed hashes, rotated daily. Visits are not unique people. Same visitor in two tabs can be two visits.
- Source/medium/campaign are the entry values, retained while navigating: UTM first, Google/TikTok click parameter presence, external referrer hostname, otherwise Direct/unknown. Click identifiers themselves are not sent. Facebook click IDs do not prove a paid ad and are not treated as paid. Instagram/TikTok links should carry UTM tags to distinguish ads reliably.
- Five-minute activity counts recent page/product events, not connected sockets or confirmed presence. Dashboard polls every 15 seconds only while visible.
- Today/yesterday/last seven days (including today), in GA4 property's timezone if connected, otherwise America/New_York. GA4's own periods and identity rules remain distinct.
- Device labels separate iOS/Android mobile/tablet and desktop using the browser user-agent. Older events retain mobile/tablet/desktop. User-agent masking or iPad desktop mode can limit accuracy; raw user-agent is not stored.
- Countries are approximate IP locations from a local database. VPN/proxy use affects accuracy. Unknown stays unknown; market/language is never substituted for location.
- Raw IPs are read transiently from Render's forwarded header (Vercel's dedicated header when hosted there). No IPs are stored in application tables or sent to an external geolocation API. Hosting infrastructure may retain its own request logs.
- Only allowlisted public catalog/editorial paths are retained. No account, checkout, order, search, full referrer URL, raw user-agent, contact fields, query strings or fragments. The customer privacy API gates dispatch and clears session state after analytics consent is withdrawn.
- Detail records expire after 30 days, via hourly collector cleanup plus the authenticated daily job. Reports read at most 30,000 recent events and show a limit warning. Feed shows 100 visits and 30 most recent path entries per visit. Daily ingestion cap is 50,000; rate guards are per instance (300/IP/minute and 3,000 total/minute).
- The public collection key is an identifier, not a secret. Origin/host validation, body/path constraints, bot filtering, deduplication and rate guards reduce invalid data; they cannot establish that public browser events are authentic. Do not use this data for billing or security decisions.

## Sources and database attribution

- [Shopify page_viewed](https://shopify.dev/docs/api/web-pixels-api/standard-events/page_viewed)
- [Shopify product_viewed](https://shopify.dev/docs/api/web-pixels-api/standard-events/product_viewed)
- [Shopify pixel privacy](https://shopify.dev/docs/api/web-pixels-api/pixel-privacy)
- [Shopify custom pixel setup](https://help.shopify.com/en/manual/promoting-marketing/pixels/custom-pixels/manage)
- [geoip-country](https://github.com/sapics/geoip-country), pinned database package; refresh the dependency during maintenance to keep country mappings current. This product includes GeoLite2 data created by MaxMind, available from [MaxMind](https://www.maxmind.com). Database license is supplied with the package.
- Country flag images load from flagcdn.com without a referrer header, as in the GA4 report.

Tests execute the generated pixel in a sandbox and use isolated SQLite/PostgreSQL schemas for real collector persistence, replay/deduplication, permission gates, sanitization, retention, and reporting.
