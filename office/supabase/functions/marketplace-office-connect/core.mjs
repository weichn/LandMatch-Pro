const MARKETPLACE_ORIGIN = "https://land-match-pro.vercel.app";
const OFFICE_ORIGIN = "https://landmatch-office.vercel.app";
const ALLOWED_ORIGINS = new Set([MARKETPLACE_ORIGIN, OFFICE_ORIGIN, "https://localhost", "http://localhost"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const MAX_BODY_BYTES = 2048;

const MESSAGES = {
  origin_not_allowed: "無法從這個頁面連接工作台。",
  invalid_request: "連接資料不完整，請重新進入工作台。",
  source_forbidden: "請先使用已驗證信箱的地政士帳號登入。",
  source_additional_verification: "來源帳號需要額外驗證，請先回媒合平台完成原有驗證流程。",
  not_eligible: "事務所工作台限地政士帳號使用，請使用地政士登入入口。",
  office_account_unverified: "既有工作台帳號尚未完成信箱驗證，請先完成原帳號驗證。",
  office_additional_verification: "原工作台帳號需要額外驗證，請使用既有工作台登入完成驗證。",
  office_suspended: "工作台帳號目前無法使用，請聯絡管理員。",
  membership_suspended: "目前的事務所成員資格無法使用，請聯絡事務所管理員。",
  identity_conflict: "帳號連結無法完成，請聯絡管理員確認原工作台帳號。",
  invalid_code: "這次工作台連接已失效，請重新進入。",
  rate_limited: "連接次數過多，請稍後再試。",
  service_unavailable: "工作台連接暫時無法完成，請稍後再試。",
};

class ConnectError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function headersFor(origin) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Max-Age"] = "300";
  }
  return headers;
}

function reply(origin, status, body) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: headersFor(origin) });
}

function fail(code, status = 400) { throw new ConnectError(code, status); }

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizedEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function userIsActive(user, now) {
  if (!user || !UUID.test(user.id || "") || !user.email_confirmed_at || user.is_anonymous === true || user.deleted_at) return false;
  const email = normalizedEmail(user.email);
  if (!email || email.length > 254 || !email.includes("@")) return false;
  if (user.banned_until) {
    const until = Date.parse(user.banned_until);
    if (!Number.isFinite(until) || until > now) return false;
  }
  return true;
}

function identityIsEligible(identity) {
  return identity?.account_kind === "agent" && ["client", "agent"].includes(identity.role) ||
    identity?.role === "admin" && identity.account_kind === "admin";
}

function hasVerifiedFactor(user) {
  return Array.isArray(user?.factors) && user.factors.some((factor) => factor?.status === "verified");
}

// This is called only after Auth getUser has verified the token. Decoding a
// claim by itself never authenticates or authorizes a request.
function hasVerifiedAal2(token) {
  try {
    const payload = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).aal === "aal2";
  } catch { return false; }
}

function rpcFailure(error, fallback = "service_unavailable") {
  if (error?.code === "54000") fail("rate_limited", 429);
  if (error?.code === "23505") fail("identity_conflict", 409);
  const allowed = ["office_account_unverified", "office_suspended", "membership_suspended", "identity_conflict", "invalid_code"];
  if (allowed.includes(error?.message)) fail(error.message, error.message === "invalid_code" ? 400 : 403);
  fail(fallback, fallback === "invalid_code" ? 400 : 503);
}

async function readBody(req) {
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) fail("invalid_request", 415);
  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) fail("invalid_request", 413);
  if (!req.body) fail("invalid_request");
  const reader = req.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); fail("invalid_request", 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body = asObject(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combined)));
    if (!body) fail("invalid_request");
    return body;
  } catch { fail("invalid_request"); }
}

function exactFields(body, names) {
  if (Object.keys(body).some((key) => !names.includes(key))) fail("invalid_request");
}

export async function sha256Hex(value, cryptoImpl = globalThis.crypto) {
  const digest = new Uint8Array(await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function pkceChallenge(value, cryptoImpl = globalThis.crypto) {
  const digest = new Uint8Array(await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return base64Url(digest);
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function lookupOffice(office, sourceId, email) {
  const result = await office.rpc("office_marketplace_lookup", { p_source_id: sourceId, p_email: email });
  if (result.error) rpcFailure(result.error);
  const value = asObject(result.data);
  if (!value || !(value.office_user_id === null || UUID.test(value.office_user_id || ""))) fail("service_unavailable", 503);
  return value.office_user_id;
}

async function authorize(req, body, deps) {
  exactFields(body, ["action", "challenge"]);
  if (typeof body.challenge !== "string" || !CHALLENGE.test(body.challenge)) fail("invalid_request");
  const auth = req.headers.get("authorization") || "";
  if (auth.length > 8192) fail("source_forbidden", 401);
  const token = auth.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i)?.[1];
  if (!token) fail("source_forbidden", 401);
  const source = deps.createSourceClient(token);
  const userResult = await source.auth.getUser(token);
  const user = userResult.data?.user;
  if (userResult.error || !userIsActive(user, deps.now())) fail("source_forbidden", 401);
  if (hasVerifiedFactor(user) && !hasVerifiedAal2(token)) fail("source_additional_verification", 403);

  const identityResult = await source.rpc("get_office_identity");
  if (identityResult.error) fail("source_forbidden", 403);
  if (!Array.isArray(identityResult.data) || identityResult.data.length !== 1) fail("not_eligible", 403);
  const identity = identityResult.data[0];
  if (!identityIsEligible(identity) || identity.user_id !== user.id || normalizedEmail(identity.email) !== normalizedEmail(user.email)) fail("not_eligible", 403);

  const email = normalizedEmail(user.email);
  let officeUserId = await lookupOffice(deps.office, user.id, email);
  if (!officeUserId) {
    const created = await deps.office.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) {
      // Another request may have created the same verified email concurrently.
      if (!["email_exists", "user_already_exists"].includes(created.error.code)) fail("service_unavailable", 503);
      officeUserId = await lookupOffice(deps.office, user.id, email);
      if (!officeUserId) fail("service_unavailable", 503);
    } else {
      const createdUser = created.data?.user;
      if (!userIsActive(createdUser, deps.now()) || normalizedEmail(createdUser.email) !== email) fail("service_unavailable", 503);
      officeUserId = createdUser.id;
    }
  }

  const name = typeof identity.office_name === "string" && identity.office_name.trim()
    ? identity.office_name.trim().slice(0, 200) : "我的事務所";
  const linked = await deps.office.rpc("office_marketplace_link", {
    p_source_id: user.id, p_office_user_id: officeUserId, p_email: email, p_office_name: name,
  });
  if (linked.error) rpcFailure(linked.error);
  const link = asObject(linked.data);
  if (!link || link.office_user_id !== officeUserId || !UUID.test(link.office_id || "")) fail("service_unavailable", 503);

  const code = base64Url(deps.crypto.getRandomValues(new Uint8Array(32)));
  const issued = await deps.office.rpc("office_marketplace_issue_code", {
    p_source_id: user.id, p_office_user_id: officeUserId,
    p_code_hash: await sha256Hex(code, deps.crypto), p_challenge: body.challenge,
  });
  if (issued.error) rpcFailure(issued.error);
  if (issued.data !== true) fail("service_unavailable", 503);
  return { code };
}

async function exchange(body, deps) {
  exactFields(body, ["action", "code", "verifier"]);
  if (typeof body.code !== "string" || typeof body.verifier !== "string" ||
    !CHALLENGE.test(body.code) || !VERIFIER.test(body.verifier)) fail("invalid_code");
  const consumed = await deps.office.rpc("office_marketplace_consume_code", {
    p_code_hash: await sha256Hex(body.code, deps.crypto),
    p_challenge: await pkceChallenge(body.verifier, deps.crypto),
  });
  if (consumed.error) rpcFailure(consumed.error, "invalid_code");
  const identity = asObject(consumed.data);
  if (!identity || !UUID.test(identity.office_user_id || "") || !UUID.test(identity.source_user_id || "")) fail("invalid_code");

  const target = await deps.office.auth.admin.getUserById(identity.office_user_id);
  const user = target.data?.user;
  if (target.error || !userIsActive(user, deps.now()) || user.id !== identity.office_user_id) fail("office_suspended", 403);
  if (hasVerifiedFactor(user)) fail("office_additional_verification", 403);
  const generated = await deps.office.auth.admin.generateLink({ type: "magiclink", email: normalizedEmail(user.email) });
  if (generated.error) fail("service_unavailable", 503);
  const hash = generated.data?.properties?.hashed_token;
  // generateLink can create an account if the email changed during the request.
  // Never hand out that credential unless the returned UUID is the mapped user.
  if (generated.data?.user?.id !== identity.office_user_id || !/^[A-Za-z0-9_-]{32,512}$/.test(hash || "")) fail("identity_conflict", 409);
  return { token_hash: hash };
}

// Dependencies are request-scoped and injectable; neither this module nor its
// entrypoint logs tokens, codes, emails, credentials, SDK errors or secret values.
export function createConnectHandler({ office, createSourceClient, crypto: cryptoImpl = globalThis.crypto, now = Date.now }) {
  const deps = { office, createSourceClient, crypto: cryptoImpl, now };
  return async function handle(req) {
    const origin = req.headers.get("origin") || "";
    try {
      if (!ALLOWED_ORIGINS.has(origin)) fail("origin_not_allowed", 403);
      if (req.method === "OPTIONS") {
        if ((req.headers.get("access-control-request-method") || "POST").toUpperCase() !== "POST") fail("invalid_request", 405);
        return reply(origin, 204, null);
      }
      if (req.method !== "POST") fail("invalid_request", 405);
      if (new URL(req.url).search) fail("invalid_request");
      const body = await readBody(req);
      if (body.action !== "authorize" && body.action !== "exchange") fail("invalid_request");
      if (body.action === "exchange" && origin !== OFFICE_ORIGIN) fail("origin_not_allowed", 403);
      const payload = body.action === "authorize" ? await authorize(req, body, deps) : await exchange(body, deps);
      return reply(origin, 200, payload);
    } catch (error) {
      const safe = error instanceof ConnectError ? error : new ConnectError("service_unavailable", 503);
      return reply(origin, safe.status, { code: safe.code, error: safe.code, message: MESSAGES[safe.code] });
    }
  };
}
