# Weekly SEO reports

The **Haftalık raporlar** section adds stored calendar-week reports, week-over-week Google comparisons, observed changes before/after applied SEO edits, Shopify organic-search landing-page attribution, downloadable PDFs, and optional PDF email delivery. Reports are visible only to the store owner or users explicitly delegated with `GOOGLE_MANAGER_USERS` (the same authenticated manager check used for Google settings).

## Report definitions

- A week is Monday–Sunday in `America/Los_Angeles`, matching Search Console dates. The latest week must end at least three Pacific calendar days before generation. A Wednesday Pacific run can first report the preceding Sunday. The adjacent preceding week is the comparator.
- The report fetches fresh Google Web/all-device property totals and page rows, separately for all countries and USA. Calendar-week fetching does not overwrite the interactive 7/28/90-day selection. Nine API report requests plus pagination are needed. Each page/daily result is bounded to 10,000 rows; limits are shown. Saved page tables retain the top 200, PDF summaries the top 10. Missing previous page rows remain unknown rather than zero.
- SEO edit observations reuse the existing seven-day-before/seven-day-after comparison, excluding the edit day. A fresh 42-day USA page/date report supplies coverage. Missing coverage, truncation and overlapping edits are reported. This is observational comparison, not causal attribution. Applied changes from the application only are included; changes made elsewhere are not detectable.
- Shopify orders are filtered to these same Pacific dates. Test, cancelled and unpaid orders are excluded. Each order is counted once. Attribution uses only a ready `customerJourneySummary.lastVisit` with `sourceType: SEO` and a store landing URL. This includes all organic search engines and all countries, independently of the Google country selector. Ads and unknown sources are never guessed to be SEO. Only aggregate paths/counts/amounts are persisted; raw orders, IDs, customer details, referrers and landing URL query strings are not saved.
- Amount is `currentTotalPriceSet.shopMoney`, observed at report generation, including applicable shipping/tax; it is neither net profit nor a Shopify Analytics revenue replica. Currencies are kept separate. Later changes/refunds require regeneration. Read limit: 2,000 orders per run; capped reports are marked incomplete. Google clicks are not joined to individual customers, and no conversion rate is calculated by dividing unmatched populations.
- Keep the latest 26 weekly snapshots. Manual generation refreshes the latest eligible week. Historical snapshots remain as observed at generation time. Sales read errors produce an explicit unavailable section, not fabricated zero sales. Google failure preserves previous snapshots.

## Activation

1. Deploy the application build and both the SQLite/PostgreSQL migration as appropriate (`npm run setup` already runs migrations at startup). `read_orders` is configured as an optional Shopify scope; keep it out of required host `SCOPES` so PDF/Google reporting does not block staff without Orders permission. Sales attribution remains unavailable until the store owner grants this optional scope. Any required customer journey/protected-data access must also be granted. Shopify uses the last 60 days by default; these reports need only two recent weeks.
2. Keep a working Search Console connection/property (or the existing configured service account). Enable **Her hafta otomatik rapor hazırla** in the new section. Automation defaults off.
3. The existing authenticated `/jobs/daily` scheduler now creates the latest report once when weekly automation is enabled. `?task=weekly` runs just reporting. The GitHub daily workflow already calls the unfiltered endpoint. The Vercel schedule adds a separate daily reporting call. For sales, the scheduled route loads the app's offline Shopify session; if unavailable, the report clearly marks sales unavailable. A new Google report is not recreated on every daily tick.
4. PDF export needs no email service. The font under `public/fonts` is deployed with the app and includes its DejaVu license.
5. Optional email: configure `RESEND_API_KEY` and `REPORT_EMAIL_FROM` with a verified sender. Save the intended recipient in report settings. Enable automatic email explicitly or use the manual confirmation. No email is sent merely by deploying or saving a recipient. Both automatic report and automatic email toggles must be enabled for scheduled delivery.

Each week/recipient has a durable delivery reservation and provider idempotency key. Successful sends are not repeated. Network/server errors or an interrupted send are recorded as unknown/pending and are not blindly retried; verify such a delivery in Resend. Definitively rejected requests can be retried. Delivery status means accepted by the provider, not confirmed inbox delivery. Delivery records are deleted on uninstall with the workspace.

## Sources

- [Shopify CustomerJourneySummary](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/CustomerJourneySummary)
- [Shopify MarketingTactic](https://shopify.dev/docs/api/admin-graphql/2026-07/enums/MarketingTactic)
- [Resend email API](https://resend.com/docs/api-reference/emails/send-email)

Production activation still requires the new Shopify permission and the email host settings/recipient. Local tests use synthetic data and a stubbed email provider.
