# Visitor analytics

The **Ziyaretçi analitiği** section reads aggregate GA4 reports for the store's web traffic: direct, search, social, paid campaigns and referrals. This connection is separate from Search Console and needs no new Shopify scope.

## Connect

Enable Google Analytics Admin API and Google Analytics Data API in the OAuth/service-account Cloud project. The existing Google OAuth client and `/google/callback` redirect are reused; the user separately grants `analytics.readonly`. Only properties with a `nosweatusa.com`, `www.nosweatusa.com` or the authorized Shopify shop web stream can be selected. If the OAuth consent app is in testing, add the merchant as a test user; expiring testing-mode refresh tokens require reconnecting.

Alternatively, grant the existing `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` account the Viewer role on the relevant GA4 property, then enter its numeric property ID under service account settings. Never put keys in the browser. The manager-only UI displays only the service account email, not credentials. No invitation email is sent by this application.

GA4 tagging must already collect the store's page views. The existing public storefront tag observed during setup is `G-1RNRQ9B96E`; this measurement ID is not a numeric property ID and does not grant reporting access. Do not install another tracker on top of the existing tag. Historical reports exist only for data GA4 actually collected.

## Definitions and limits

- Today, yesterday, last seven completed days and the preceding seven days use the GA4 property's timezone. Each has an adjacent comparison period. Today is partial; recent days may change as Google processes events.
- Site-wide sessions, users and page views are queried independently of detail tables. Daily users or per-source users are not summed into unique period visitors.
- Source, medium, campaign and channel are GA4 **session** attribution. Country is GA4's approximate activity country. Direct can include unattributed traffic. Unknown is kept separate. Instagram/TikTok traffic is only labelled paid when the channel/medium says so; missing UTMs cannot be reconstructed.
- Product views are `screenPageViews` for `/products/` and `/product-page/` paths, not purchases or unique product viewers. Repeated views count. Product/country/source are returned together by GA4; separate datasets are never joined to invent user journeys. Catalog title/image matching uses exact product path.
- Every request filters `hostName` to the store's known domains, even when its GA4 property contains other streams.
- Each report paginates up to 10,000 rows. Pagination caps, privacy thresholds, sampling and `(other)` aggregation are flagged. Detail tables show the first 200 matching rows. PDF summaries show the first 20 and always cover all countries/sources; UI detail filters do not change PDF totals.
- Four period snapshots are kept in the workspace. Refresh failures preserve the previous report. Stored data is aggregated; no client IDs, raw IPs, emails or individual browsing histories are collected by this feature.
- Country flag icons load from flagcdn.com without a referrer. Country name/code remain visible if icons fail.

## Automation and access

Enable daily refresh in the section to have the existing authenticated `/jobs/daily` workflow refresh the last seven completed days. `?task=traffic` runs only this task. OAuth/service-account access must remain valid. PDF is on demand; no email provider is required. Store owner/explicit `GOOGLE_MANAGER_USERS` delegates can view and manage these reports. Disconnect clears the stored reports and connection; uninstall deletes connection and pending OAuth records.

Sources: [GA4 schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [runReport](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport), [Admin data streams](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams/list).
