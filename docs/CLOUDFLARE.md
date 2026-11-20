# Cloudflare deployment readiness

StatFlow is prepared as a static Vite SPA for Cloudflare Workers Static Assets.

## Current configuration

`wrangler.jsonc` contains only repository-safe settings:

- Worker name: `statflow`
- compatibility date: `2026-11-20`
- static assets: `./dist/`
- SPA fallback: `single-page-application`

No Cloudflare account ID, route, custom domain, API token, or secret is committed.

## Validation

CI runs:

```bash
npm install
npm test
npm run build
npx wrangler deploy --dry-run
```

A successful dry run proves the repository can be packaged by Wrangler. It does **not** prove a live Cloudflare account, route, custom domain, or production deployment is configured.

## Live deployment gate

Do not perform the first live deployment until these values are verified from the actual Cloudflare account:

1. target Cloudflare account
2. Worker/service name to use in that account
3. whether the initial deployment should use workers.dev
4. whether a custom domain/route will be attached
5. whether preview/production environments should be separated

Do not guess account IDs, routes, or production URLs.

## Product posture

StatFlow remains local-first in this phase. Uploaded CSV/XLSX data is parsed and analyzed in the browser; the Cloudflare deployment serves the app assets only.
