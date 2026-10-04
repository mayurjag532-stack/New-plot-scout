# Plot Scout — Mayur continuation handoff

## Base
Built from the user-supplied `plot-scout-handoff.zip` (Claude checkpoint) and retained all existing product/data logic.

## This pass
- Reduced mobile New Visit spatial hero from a dominant map to a compact ~32–34dvh hero so the dossier/information area gets the majority of the viewport.
- Added first-screen Light/Dark toggle in the main app header.
- Brightened daylight theme toward white/graphite for better outdoor readability.
- Lifted dark theme from near-black graphite to a brighter forest-graphite palette; kept Fraunces + Inter unchanged.
- Added selective glass treatment to secondary/link controls while keeping primary CTAs solid.
- Added explicit `Result not found` state and retry action for Map Intelligence failures.
- Added a Vite local proxy and Vercel serverless proxy path for Overpass, plus a smaller query footprint and an additional mirror/GET fallback.
- Added Esri ArcGIS tile host to production CSP so satellite/hybrid imagery is not blocked by the app's own CSP.
- Radar now clearly reports `Result not found` when no verified sale signals are returned or the discovery endpoint is not connected; it never fabricates leads.
- Added `Download PDF report` to the property export menu. It opens the existing print-ready decision report so the browser can Save as PDF.

## Important limitation
This environment cannot reach external network hosts, so live Overpass/Esri verification and a full production build could not be executed here. TS/TSX syntax transpilation was checked successfully. The user's local environment has already installed the app dependencies and was running Vite successfully before this handoff.

## Next verification on the user's machine
1. `npm run dev`
2. New Visit: confirm map occupies roughly one-third of mobile viewport and information remains primary.
3. Run Map Intelligence; confirm proxy returns data when Overpass is reachable. If no data, show `Result not found` rather than a generic error.
4. Toggle Light/Dark from the first screen; confirm outdoor-light readability and brighter dark mode.
5. Test Map / Satellite / Hybrid. Production CSP now permits Esri tiles.
6. Open property > More > Download PDF report; use browser Save as PDF.
7. Radar: run a search. If provider returns no verified sale signals, UI says `Result not found`; no fake leads.

## Preserve
Do not change fonts, scoring rules, evidence semantics, location/legal-boundary claims, or invent cadastral/sale data.
