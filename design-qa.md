# Organic Rankings design QA

Source visual: /tmp/semrush-organic-reference.png (1200 × 548), user reference: https://www.unite.ai/wp-content/uploads/2023/12/6-semrush-organic-research.png.
Implementation screenshots: /tmp/organic-final-desktop.png (1185 × 2267), /tmp/organic-final-mobile.png (360 × 3669).
CSS viewport: desktop 1200 × 900, mobile 375 × 812. CSS density captures exclude the 15 px scrollbar. The source is cropped; implementation captures the full page.
State: overview with explicitly marked local fixtures, two dates and three keywords. No fixture written to the live store.

## Comparison

Source and final implementation screenshots opened together in the same comparison tool call. App-owned overview compared, accounting for existing NOWUSA header/navigation. This adapts the reference to the existing app, without Semrush branding or its database. Source ends at Top Keywords / Keywords by Intent headings; lower cards follow existing app table styles.

- Typography: existing Inter/system, compact 12–14 px labels/tables and 24 px metrics; readable hierarchy and wrapping.
- Layout: tabs above contiguous metrics, full-width stacked history chart, two-column keyword/intent cards. Mobile stacks cards and scrolls tables internally. Document scroll widths 1185 <= 1200 and 360 <= 375.
- Colors: white cards, gray borders, blue navigation/chart, orange Top 3 series. Signed green/red change text.
- Assets: advertisement and Semrush logo outside requested module omitted. Chart.js renders actual structured data; no raster asset needed for the analysis panels.
- Copy: Turkish, source scope and unknown states explicit. Four supported metrics; unsupported branded/non-branded traffic not invented. Query SERP features do not claim domain ownership.

Comparison history: initial /tmp/organic-reference-desktop.png showed overly wide bars with two snapshots (P2). Limited bar thickness to 28 px. Re-captured /tmp/organic-final-desktop.png and compared with source; thin stacked bars resolved the issue. No actionable P0/P1/P2 issues remain within this adaptation.
Focused check: metric strip, chart legend and keyword cells inspected at readable full resolution; additional crops unnecessary.

## Verification

Top Keywords opens positions. Search narrows three rows to one. Returning through “Tüm kelimeler” clears stale filters and restores three rows. Chart metric switching works. Desktop and mobile cards render. Missing values remain unknown. Console checked: extension-origin MutationObserver and wallet warnings only; no application errors.
TypeScript, ESLint, production build, organic report tests and Shopify Toolkit validation passed.

## Follow-up polish

Existing dashboard header/setup notice make the module taller than the source crop, retained for consistency. Live reports have different chart density from the reference multi-year history.

final result: passed
