# Backlink tracking design QA

Source: live Backlinkler screen, /tmp/backlinks-before.png (994 × 684), captured and inspected in this audit. Current implementation: /tmp/backlinks-final-desktop.png (1185 × 1595) and /tmp/backlinks-final-mobile.png (360 × 2303).
Desktop viewport 1200 × 900 CSS px; mobile 375 × 812. CSS-density captures exclude the 15 px scrollbar. Source includes Shopify chrome and empty data; local captures omit that chrome and use five clearly labeled fixture records. Comparison is an intentional redesign, not a pixel-match. Only the app-owned area is compared, with no claims about changed live data.

## Audit steps and findings

1. Open Backlinkler: original screen had no source summary; long explanatory copy and opportunity queries dominated the first view (P2). Existing URL labels and check controls were clear.
2. Review sources: original separate sections made results difficult to scan as a list. Added source counts, five explicit statuses, search/filter, dates, pagination and expandable details.
3. Find opportunities: original raw search queries consumed primary space (P2). Moved to an accessible native details section with link cards.

Screenshots opened together in the same comparison call. Typography retains Inter/system and the dashboard blue-gray palette; 12–14 px labels, 20 px section heading and 27 px metric values. Cards use consistent 12 px radii, 16–20 px padding and restrained borders. Real Polaris icons are used; no raster assets required. Turkish copy distinguishes source-page counts from backlink totals and HTML absence from confirmed loss.

## Iteration

Initial after-mobile capture /tmp/backlinks-after-mobile.png showed clipped status/action columns (P2). Changed rows to stacked mobile source cards; recaptured /tmp/backlinks-final-mobile.png and inspected with source and final desktop. All statuses, dates and remove controls now visible at 375 px. Removed unrelated catalog export/sync actions from this tab. Final desktop table remains intact.

Focused inspection: summary, input labels, status text and source details are readable in full-resolution captures. No further crops needed. No remaining actionable P0/P1/P2 findings.

## Verification

Local fixture only: status filter returned 1 of 5 records; unmatched search displayed a clear empty state; reset restored all 5; source details expanded; valid URL submit dispatched the unchanged backlink-add action and exact URL. Opportunity links expand in native details. Invalid/empty URL leaves add disabled. Production source mutations were not made for design testing.
Document widths: 1185 <= 1200, 360 <= 375. Keyboard-focusable table region, native summaries, input labels, descriptive remove label and non-color-only status text checked; no claim of comprehensive screen-reader compliance.
Console inspected: extension-origin errors/wallet warnings only. TypeScript, ESLint, production build and Shopify Toolkit component validation passed. Backend behavior unchanged.

final result: passed
