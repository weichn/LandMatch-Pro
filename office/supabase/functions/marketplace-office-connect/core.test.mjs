import test from "node:test";
import assert from "node:assert/strict";
import { createConnectHandler, pkceChallenge, sha256Hex } from "./core.mjs";

const SOURCE = "41000000-0000-4000-8000-000000000001";
const OFFICE_USER = "41000000-0000-4000-8000-000000000002";
const OFFICE = "41000000-0000-4000-8000-000000000003";
const OTHER = "41000000-0000-4000-8000-000000000004";
const MARKETPLACE_ORIGIN = "https://land-match-pro.vercel.app";
const OFFICE_ORIGIN = "https://landmatch-office.vercel.app";
const VERIFIER = "a".repeat(64);
const TOKEN_HASH = "dummy-office-token-hash-not-an-access-or-refresh-token";
const NOW = Date.parse("2026-10-30T00:00:00Z");

function activeUser(id, email = "professional@example.invalid") {
  return { id, email, email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function fixture(options = {}) {
  const calls = [];
  const codes = new Map();
  let officeUserId = options.existing === false ? null : OFFICE_USER;
  let lookupCount = 0;
  const sourceUser = { ...activeUser(SOURCE), ...options.sourceUser };
  const sourceIdentity = { user_id: SOURCE, email: sourceUser.email, name: "來源專業會員", office_name: "來源事務所", role: "client", account_kind: "agent", ...options.identity };
  const source = {
    auth: { async getUser(token) { calls.push(["getUser", token]); return options.sourceError ? { error: options.sourceError } : { data: { user: sourceUser } }; } },
    async rpc(name) { calls.push(["sourceRpc", name]); return options.identityError ? { error: options.identityError } : { data: options.identityRows ?? [sourceIdentity] }; },
  };
  const office = {
    auth: { admin: {
      async createUser(attributes) {
        calls.push(["createUser", attributes]);
        if (options.createError) return { error: options.createError };
        officeUserId = OFFICE_USER;
        return { data: { user: activeUser(OFFICE_USER, attributes.email) } };
      },
      async getUserById(id) { calls.push(["getUserById", id]); return { data: { user: { ...activeUser(id, options.officeEmail), ...options.officeUser } } }; },
      async generateLink(attributes) { calls.push(["generateLink", attributes]); return options.generateError ? { error: options.generateError } : { data: { user: { id: options.generatedUserId || OFFICE_USER }, properties: { hashed_token: TOKEN_HASH } } }; },
    } },
    async rpc(name, args) {
      calls.push(["officeRpc", name, args]);
      if (options.rpcErrors?.[name]) return { error: options.rpcErrors[name] };
      if (name === "office_marketplace_lookup") {
        lookupCount++;
        if (options.createRace && lookupCount > 1) officeUserId = OFFICE_USER;
        return { data: { office_user_id: officeUserId } };
      }
      if (name === "office_marketplace_link") return { data: { office_user_id: options.linkedUserId || officeUserId, office_id: OFFICE } };
      if (name === "office_marketplace_issue_code") {
        codes.set(args.p_code_hash, { challenge: args.p_challenge, consumed: false });
        return { data: true };
      }
      if (name === "office_marketplace_consume_code") {
        const item = codes.get(args.p_code_hash);
        if (!item || item.consumed || item.challenge !== args.p_challenge || options.expired) return { error: { code: "42501", message: "invalid_code" } };
        item.consumed = true;
        return { data: { office_user_id: OFFICE_USER, source_user_id: SOURCE } };
      }
      throw new Error("Unexpected RPC");
    },
  };
  const handler = createConnectHandler({
    office, createSourceClient(token) { calls.push(["sourceClient", token]); return source; },
    now: () => NOW,
  });
  return { calls, codes, handler };
}

function request(body, origin = MARKETPLACE_ORIGIN, extra = {}) {
  return new Request("https://qkwfulonscvreudtroaw.supabase.co/functions/v1/marketplace-office-connect", {
    method: "POST", headers: { origin, "content-type": "application/json", authorization: "Bearer header.payload.signature", ...extra }, body: JSON.stringify(body),
  });
}

async function issue(f) {
  const response = await f.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["code"]);
  assert.match(body.code, /^[A-Za-z0-9_-]{43}$/);
  return body.code;
}

test("a confirmed professional applicant is provisioned once without copying a password or sending email", async () => {
  const f = fixture({ existing: false });
  const code = await issue(f);
  assert.deepEqual(f.calls.find(([name]) => name === "createUser")[1], { email: "professional@example.invalid", email_confirm: true });
  assert.equal(f.calls.some(([name]) => name === "generateLink"), false);
  const issued = f.calls.find((call) => call[1] === "office_marketplace_issue_code")[2];
  assert.equal(issued.p_source_id, SOURCE);
  assert.equal(issued.p_office_user_id, OFFICE_USER);
  assert.equal(issued.p_code_hash, await sha256Hex(code));
  assert.notEqual(issued.p_code_hash, code);
  assert.equal(issued.p_challenge, await pkceChallenge(VERIFIER));
  assert.equal(f.calls.some(([name]) => /invite|signUp|signInWithOtp/.test(name)), false);
});

test("existing mapped identities keep their UUID even after the source email changes", async () => {
  const f = fixture({ sourceUser: { email: "changed@example.invalid" }, officeEmail: "original@example.invalid" });
  const code = await issue(f);
  assert.equal(f.calls.some(([name]) => name === "createUser"), false);
  const response = await f.handler(request({ action: "exchange", code, verifier: VERIFIER }, OFFICE_ORIGIN));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { token_hash: TOKEN_HASH });
  assert.deepEqual(f.calls.find(([name]) => name === "generateLink")[1], { type: "magiclink", email: "original@example.invalid" });
});

test("untrusted source users and an ordinary citizen are denied before Office access", async (t) => {
  const variants = [
    { sourceError: { message: "not a valid JWT" } },
    { sourceUser: { email_confirmed_at: null } },
    { sourceUser: { is_anonymous: true } },
    { sourceUser: { banned_until: "2027-01-01T00:00:00Z" } },
    { sourceUser: { deleted_at: "2026-01-01T00:00:00Z" } },
    { identity: { role: "client", account_kind: "public" } },
    { identity: { user_id: OTHER } },
    { identity: { email: "other@example.invalid" } },
    { identityRows: [] },
  ];
  for (const [index, options] of variants.entries()) {
    await t.test(`denial ${index + 1}`, async () => {
      const f = fixture(options);
      const response = await f.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }));
      assert([401, 403].includes(response.status));
      assert.equal(f.calls.some(([name]) => name === "officeRpc" || name === "createUser" || name === "generateLink"), false);
      const body = await response.json();
      assert(["source_forbidden", "not_eligible"].includes(body.code));
    });
  }
});

test("only explicit professional or administrator identity pairs may authorize", async () => {
  for (const identity of [{ role: "agent", account_kind: "agent" }, { role: "admin", account_kind: "admin" }]) {
    await issue(fixture({ identity }));
  }
  for (const identity of [{ role: "agent", account_kind: "public" }, { role: "admin", account_kind: "agent" }, { role: "client", account_kind: "admin" }]) {
    const f = fixture({ identity });
    const response = await f.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }));
    assert.equal(response.status, 403);
    assert.equal(f.calls.some(([name]) => name === "officeRpc"), false);
  }
});

test("a source eligibility failure after Auth verification cannot provision or issue an Office login", async () => {
  const f = fixture({ identityError: { code: "42501", message: "source session no longer active" } });
  const response = await f.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "source_forbidden");
  assert.equal(f.calls.some(([name]) => name === "getUser"), true);
  assert.equal(f.calls.some(([name]) => name === "sourceRpc"), true);
  assert.equal(f.calls.some(([name]) => name === "officeRpc" || name === "createUser" || name === "generateLink"), false);
});

test("source MFA requires an Auth-verified AAL2 token and destination MFA cannot be bypassed", async () => {
  const factors = [{ id: "mfa", status: "verified", factor_type: "totp" }];
  const jwt = (aal) => `header.${Buffer.from(JSON.stringify({ sub: SOURCE, aal })).toString("base64url")}.signature`;
  for (const token of ["header.payload.signature", jwt("aal1")]) {
    const f = fixture({ sourceUser: { factors } });
    const denied = await f.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }, MARKETPLACE_ORIGIN, { authorization: `Bearer ${token}` }));
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, "source_additional_verification");
    assert.equal(f.calls.some(([name]) => name === "officeRpc"), false);
  }
  const verified = fixture({ sourceUser: { factors } });
  assert.equal((await verified.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }, MARKETPLACE_ORIGIN, { authorization: `Bearer ${jwt("aal2")}` }))).status, 200);
  const forged = fixture({ sourceUser: { factors }, sourceError: { message: "Invalid signature" } });
  const invalid = await forged.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }, MARKETPLACE_ORIGIN, { authorization: `Bearer ${jwt("aal2")}` }));
  assert.equal(invalid.status, 401);
  assert.equal(forged.calls.some(([name]) => name === "sourceRpc"), false);
  const destination = fixture({ officeUser: { factors } });
  const code = await issue(destination);
  const denied = await destination.handler(request({ action: "exchange", code, verifier: VERIFIER }, OFFICE_ORIGIN));
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "office_additional_verification");
  assert.equal(destination.calls.some(([name]) => name === "generateLink"), false);
});

test("PKCE exchange consumes its code once and cannot replay or use another verifier", async () => {
  const f = fixture();
  const code = await issue(f);
  const wrong = await f.handler(request({ action: "exchange", code, verifier: "b".repeat(64) }, OFFICE_ORIGIN));
  assert.equal(wrong.status, 400);
  assert.equal((await wrong.json()).code, "invalid_code");
  assert.equal(f.calls.some(([name]) => name === "generateLink"), false);
  const first = await f.handler(request({ action: "exchange", code, verifier: VERIFIER }, OFFICE_ORIGIN));
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { token_hash: TOKEN_HASH });
  assert.equal(first.headers.get("cache-control"), "no-store");
  const replay = await f.handler(request({ action: "exchange", code, verifier: VERIFIER }, OFFICE_ORIGIN));
  assert.equal(replay.status, 400);
  assert.equal(f.calls.filter(([name]) => name === "generateLink").length, 1);
  const expiredFixture = fixture({ expired: true });
  const expiredCode = await issue(expiredFixture);
  assert.equal((await expiredFixture.handler(request({ action: "exchange", code: expiredCode, verifier: VERIFIER }, OFFICE_ORIGIN))).status, 400);
});

test("unknown origins, query credentials, malformed requests and oversized bodies cannot reach the backends", async () => {
  const f = fixture();
  const challenge = await pkceChallenge(VERIFIER);
  const evil = await f.handler(request({ action: "authorize", challenge }, "https://landmatch-office.vercel.app.evil.invalid"));
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.has("access-control-allow-origin"), false);
  assert.equal((await f.handler(request({ action: "exchange", code: "a".repeat(43), verifier: VERIFIER }))).status, 403);
  assert.equal((await f.handler(request({ action: "authorize", challenge, email: "attacker@example.invalid" }))).status, 400);
  assert.equal((await f.handler(request({ action: "unknown" }))).status, 400);
  assert.equal((await f.handler(request({ action: "authorize", challenge: "short" }))).status, 400);
  assert.equal((await f.handler(request({ action: "authorize", challenge: [challenge] }))).status, 400);
  assert.equal((await f.handler(request({ action: "exchange", code: ["a".repeat(43)], verifier: VERIFIER }, OFFICE_ORIGIN))).status, 400);
  assert.equal((await f.handler(request({ action: "authorize", challenge }, MARKETPLACE_ORIGIN, { authorization: "Bearer invalid" }))).status, 401);
  assert.equal((await f.handler(new Request("https://example.invalid/?access_token=blocked", { method: "POST", headers: { origin: MARKETPLACE_ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ action: "authorize", challenge }) }))).status, 400);
  assert.equal((await f.handler(request({ action: "authorize", challenge, excess: "x".repeat(3000) }, MARKETPLACE_ORIGIN, { "content-length": "1" }))).status, 413);
  const get = await f.handler(new Request("https://example.invalid/", { headers: { origin: MARKETPLACE_ORIGIN } }));
  assert.equal(get.status, 405);
  assert.equal(f.calls.length, 0);
});

test("CORS preflight is fixed-origin and does not call or reveal backend services", async () => {
  const f = fixture();
  for (const origin of [MARKETPLACE_ORIGIN, OFFICE_ORIGIN, "https://localhost", "http://localhost"]) {
    const response = await f.handler(new Request("https://example.invalid/", { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST" } }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(f.calls.length, 0);
});

test("a concurrent email creation retries only the verified lookup and keeps the mapped user", async () => {
  const f = fixture({ existing: false, createRace: true, createError: { code: "email_exists" } });
  await issue(f);
  assert.equal(f.calls.filter((call) => call[1] === "office_marketplace_lookup").length, 2);
  assert.equal(f.calls.filter(([name]) => name === "createUser").length, 1);
  assert.equal(f.calls.find((call) => call[1] === "office_marketplace_link")[2].p_office_user_id, OFFICE_USER);
});

test("private account denials and rate limits use only controlled response codes", async () => {
  for (const code of ["office_account_unverified", "office_suspended", "membership_suspended", "identity_conflict"]) {
    const f = fixture({ rpcErrors: { office_marketplace_lookup: { code: "42501", message: code } } });
    const response = await f.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, code);
    assert.equal(f.calls.some(([name]) => name === "createUser"), false);
  }
  const f = fixture({ rpcErrors: { office_marketplace_issue_code: { code: "54000", message: "rate_limited" } } });
  const limited = await f.handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }));
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "rate_limited");
});

test("a changed Office account or generated-link UUID cannot produce another user's credential", async () => {
  const banned = fixture({ officeUser: { banned_until: "2027-01-01T00:00:00Z" } });
  const bannedCode = await issue(banned);
  const denied = await banned.handler(request({ action: "exchange", code: bannedCode, verifier: VERIFIER }, OFFICE_ORIGIN));
  assert.equal(denied.status, 403);
  assert.equal(banned.calls.some(([name]) => name === "generateLink"), false);
  const mismatch = fixture({ generatedUserId: OTHER });
  const mismatchCode = await issue(mismatch);
  const conflict = await mismatch.handler(request({ action: "exchange", code: mismatchCode, verifier: VERIFIER }, OFFICE_ORIGIN));
  assert.equal(conflict.status, 409);
  const body = await conflict.text();
  assert(!body.includes(TOKEN_HASH));
  assert(!body.includes(OTHER));
});

test("unhandled service failures never return SDK details or emit credential-bearing logs", async () => {
  const events = [];
  const originals = [console.log, console.error, console.warn];
  console.log = (...args) => events.push(args);
  console.error = (...args) => events.push(args);
  console.warn = (...args) => events.push(args);
  try {
    const handler = createConnectHandler({ office: {}, createSourceClient() { throw new Error("private@example.invalid secret-access-token secret-service-key"); } });
    const response = await handler(request({ action: "authorize", challenge: await pkceChallenge(VERIFIER) }));
    assert.equal(response.status, 503);
    const text = await response.text();
    assert(!text.includes("private@example.invalid"));
    assert(!text.includes("secret-access-token"));
    assert(!text.includes("secret-service-key"));
    assert.deepEqual(events, []);
  } finally { [console.log, console.error, console.warn] = originals; }
});
