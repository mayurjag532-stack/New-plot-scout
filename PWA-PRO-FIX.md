# Plot Scout — PWA + PRO fix

- ROOT CAUSE of stale deploy: api/overpass-proxy.ts + .js had the same name -> Vercel "conflicting paths" build error -> every deploy failed, old build stayed live. .ts removed.
- Check after deploy: https://YOUR-DOMAIN/version.json must show the new build time.
- PRO is forced everywhere: `src/entitlements.ts` (FORCE_PRO), plus `App.tsx` and `Settings.tsx` state pinned to "PRO" (no localStorage/Supabase/env involved).
- PWA: manifest (192/512 any + maskable), `favicon.ico`, SW cache `v6`, SW registered with `updateViaCache:none` + auto-reload on update, Vercel headers for `sw.js` / manifest.
- Private/demo use only: disable FORCE_PRO before a commercial multi-user launch.

## Map Intelligence reliability
- `api/overpass-proxy.js`: hedged mirrors (private.coffee -> overpass-api.de -> maps.mail.ru; next starts after 2.5s or instantly on failure), 9s per mirror, 10s hard cap, response validation. Dead kumi.systems mirror removed.
- `src/utils/overpass.ts`: proxy attempt 11s, absolute client budget 12.5s, server query timeout 10s, cache capped at 12 entries, stale-safe fallback to cached result. Failures are never cached.
- `vercel.json`: maxDuration 15 for the proxy.
