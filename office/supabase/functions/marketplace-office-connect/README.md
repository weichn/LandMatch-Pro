# Marketplace → Office connection

Deploy only to Office project `qkwfulonscvreudtroaw`. The Edge gateway setting is `verify_jwt=false`: this function verifies the Marketplace token itself for authorization, and an atomic single-use S256-PKCE handoff for exchange. It does not accept arbitrary project URLs, redirect URLs, user IDs or tenant IDs from a browser.

The runtime reads only its standard `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Service credentials never leave the Edge runtime. Marketplace calls use its existing publishable key and the caller's token.

Authorization also requires the Marketplace `get_office_identity()` self-only RPC. Its database check binds the token's `session_id` to an active `auth.sessions` row for the same user, so a still-unexpired JWT from a revoked session cannot issue a new Office login.

## Protocol

- `POST {action:"authorize",challenge}` with the Marketplace bearer token. After server-verified professional eligibility, safely reuse or create the Office user and their initial workspace. Return only `{code}`. The Office database stores a SHA-256 digest of the 32-byte code for 120 seconds, bound to the PKCE challenge.
- `POST {action:"exchange",code,verifier}` from the fixed Office origin. Atomically consume a matching unexpired ticket. Fetch the mapped Office user, generate a magic-link credential without emailing it, verify the returned user UUID, and return only `{token_hash}`. Office performs `verifyOtp` to establish its own session.
- `OPTIONS` supports only the fixed Marketplace, Office and two Capacitor localhost origins; exchange is restricted further to the Office origin.

The caller must check its own `state` and retain its PKCE verifier before exchange. No access token, refresh token or password is put into a URL. The one-time handoff code is passed in a fragment and cleared by the receiving UI before async work.

## Errors

Responses contain fixed `code`, `error` and localized `message` fields. Raw SDK/database messages are never copied into a response or logged. The meaningful codes are `source_forbidden`, `source_additional_verification`, `not_eligible`, `office_account_unverified`, `office_additional_verification`, `office_suspended`, `membership_suspended`, `identity_conflict`, `invalid_code`, `rate_limited`, `invalid_request`, `origin_not_allowed` and `service_unavailable`.

An existing verified source MFA factor requires an AAL2 claim from the Auth-verified token. Existing verified destination MFA factors deny this new login shortcut; the existing Office verification flow must be used instead.

## Verification

Run `node --test office/supabase/functions/marketplace-office-connect/core.test.mjs` from the project root. Tests use injected source/admin/RPC clients, create no real Auth users, send no email and make no external calls. Deployment includes only `index.ts`, `core.mjs` and `deno.json`.
