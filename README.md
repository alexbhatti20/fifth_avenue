# Landing Pages Security, Performance, and Secrets Audit

Audit date: 2026-04-01

## Scope

All landing routes under `app/(landing)` were reviewed:

- `app/(landing)/page.tsx`
- `app/(landing)/book-online/page.tsx`
- `app/(landing)/cart/page.tsx`
- `app/(landing)/contact/page.tsx`
- `app/(landing)/features/page.tsx`
- `app/(landing)/favorites/page.tsx`
- `app/(landing)/loyalty/page.tsx`
- `app/(landing)/menu/page.tsx`
- `app/(landing)/menu/[slug]/page.tsx`
- `app/(landing)/offers/page.tsx`
- `app/(landing)/orders/page.tsx`
- `app/(landing)/orders/[id]/page.tsx`
- `app/(landing)/orders/history/page.tsx`
- `app/(landing)/orders/track/page.tsx`
- `app/(landing)/payments/page.tsx`
- `app/(landing)/privacy/page.tsx`
- `app/(landing)/reviews/page.tsx`
- `app/(landing)/settings/page.tsx`
- `app/(landing)/terms/page.tsx`

Related landing UI wrappers/components were also sampled (for example `components/landing/*`).

## Summary

- High: 2
- Medium: 4
- Low: 2

The most important risks are client token usage from `localStorage` and unvalidated external proof URLs opened in a new tab.

## Findings

### 1) High - Auth token is read from localStorage in landing checkout flow

- Location: `app/(landing)/cart/page.tsx:186`, `app/(landing)/cart/page.tsx:308`
- Evidence: `localStorage.getItem("auth_token")` is used to build `Authorization: Bearer ...` headers in client-side requests.
- Why this matters: if any XSS lands in the app, `localStorage` tokens are directly readable and can be exfiltrated.
- Recommendation:
	- Move auth token handling to secure, HttpOnly cookies only.
	- Stop attaching bearer tokens from browser storage in client components.
	- Prefer server-side session validation on API routes.

### 2) High - Unvalidated payment proof URL rendered and opened via window.open

- Location: `app/(landing)/payments/PaymentsClient.tsx:420`, `app/(landing)/payments/PaymentsClient.tsx:429`
- Evidence:
	- `<img src={selectedProof} ... />`
	- `window.open(selectedProof, "_blank")`
- Why this matters: if `selectedProof` is attacker-controlled or not tightly validated server-side, this can become an open redirect/phishing vector and unsafe external content load.
- Recommendation:
	- Enforce allowlist validation for proof URLs (trusted storage domain only).
	- Reject `javascript:`, `data:`, and non-HTTPS schemes.
	- Use `window.open(url, "_blank", "noopener,noreferrer")`.

### 3) Medium - Direct DOM mutation via innerHTML in order detail page

- Location: `app/(landing)/orders/[id]/OrderDetailClient.tsx:363`
- Evidence: fallback image handler writes HTML with `parent.innerHTML = ...`.
- Why this matters: currently static HTML is injected, but this is a brittle anti-pattern and bypasses React rendering guarantees.
- Recommendation:
	- Replace direct DOM mutation with React state-based fallback rendering.

### 4) Medium - Raw img elements on landing pages reduce performance and optimization coverage

- Location examples:
	- `app/(landing)/menu/[slug]/page.tsx:75`
	- `app/(landing)/cart/page.tsx:480`
	- `app/(landing)/menu/MenuClient.tsx:681`
	- `app/(landing)/menu/MenuClient.tsx:1445`
	- `app/(landing)/payments/PaymentsClient.tsx:420`
- Why this matters: plain `<img>` skips Next image optimization pipeline, can hurt LCP/bandwidth, and weakens consistent image-domain controls.
- Recommendation:
	- Migrate to `next/image` where possible.
	- Keep remote image domains strictly allowlisted.
	- Add `sizes`, lazy loading behavior, and priority only for LCP assets.

### 5) Medium - Heavy animation workload on features page can degrade low-end devices

- Location: `app/(landing)/features/page.tsx:125`, `app/(landing)/features/page.tsx:277`
- Evidence: `requestAnimationFrame` particle loop and interval-driven animated counters.
- Current mitigation: performance gating exists via `usePerformanceMode()` and `canUseWebGL`.
- Remaining risk: high-end effects still increase CPU/GPU usage and battery draw.
- Recommendation:
	- Add stricter caps for active particles and animation durations.
	- Auto-disable expensive effects after inactivity/background tab.

### 6) Medium - Secrets present in local .env file

- Location: `.env`
- Evidence: real-looking values are present for:
	- `UPSTASH_REDIS_REST_TOKEN`
	- `BREVO_API_KEY`
	- `COOKIE_SIGNING_SECRET`
	- `VAPID_PRIVATE_KEY`
- Git status check: `.env` is currently not tracked by git, and `.gitignore` includes `.env`.
- Why this matters: leakage can still occur via local sharing, logs, screenshots, backups, or accidental commits.
- Recommendation:
	- Rotate sensitive keys that may have been exposed.
	- Add pre-commit secret scanning (for example gitleaks/trufflehog).
	- Keep production secrets only in deployment secret manager.

### 7) Low - Backup/original files inside landing folder increase maintenance and accidental risk

- Location examples:
	- `app/(landing)/reviews/page.tsx.backup`
	- `app/(landing)/reviews/page.tsx.original`
	- `app/(landing)/loyalty/page.tsx.backup`
	- `app/(landing)/orders/page.tsx.backup`
- Why this matters: not runtime-critical, but increases confusion and risk of stale code reuse.
- Recommendation:
	- Remove backup/original artifacts from source tree or move to a non-runtime docs/archive folder.

### 8) Low - Positive checks (no issue)

- No use of `dangerouslySetInnerHTML` or `eval/new Function` was found in active landing route files.
- `target="_blank"` usage sampled in landing pages includes `rel="noopener noreferrer"` where present.

## Priority Remediation Plan

1. Replace client `localStorage` bearer token usage with HttpOnly cookie session flow.
2. Validate and allowlist proof URLs before rendering/opening; add `noopener,noreferrer` in `window.open`.
3. Remove `innerHTML` fallback in order details.
4. Convert remaining landing-page `<img>` to `next/image` where feasible.
5. Rotate sensitive keys and add automated secret scanning in CI and pre-commit.
6. Clean backup/original files from the landing route tree.

## Optional Validation Steps After Fixes

- Run Lighthouse for `/`, `/menu`, `/features`, `/offers`, `/contact` on mobile profile.
- Run dependency and secret scan in CI.
- Add an integration test for payment-proof URL validation behavior.
