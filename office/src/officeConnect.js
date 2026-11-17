export const OFFICE_CONNECT_STORAGE_KEY = 'landmatch-office-connect-v1';
export const OFFICE_CONNECT_ENDPOINT = 'https://qkwfulonscvreudtroaw.supabase.co/functions/v1/marketplace-office-connect';
const officePublishableKey = 'sb_publishable_lQ8iwMquVX8rz7fnQdlpZg_fgNQbwbO';
const marketplaceUrl = 'https://land-match-pro.vercel.app/';
const requestLifetime = 5 * 60 * 1000;
const opaqueValue = /^[A-Za-z0-9_-]{43}$/;
const verifierValue = /^[A-Za-z0-9._~-]{43,128}$/;

const messages = {
  storage_unavailable: '無法保存登入確認資料，請確認網站儲存可用後重試。',
  invalid_state: '登入確認資料已過期或不符合，請重新從地政士帳號進入。',
  invalid_code: '這次登入連結已過期或已使用，請重新登入工作台。',
  not_eligible: '請使用已完成信箱驗證的地政士帳號登入工作台。',
  source_forbidden: '地政士登入狀態已失效，請重新登入。',
  office_account_unverified: '已有同信箱的工作台帳號尚未驗證，請先完成原信箱驗證再登入。',
  office_suspended: '工作台帳號目前無法使用，請聯絡事務所管理員。',
  membership_suspended: '事務所成員資格目前無法使用，請聯絡事務所管理員。',
  office_additional_verification: '此帳號設有額外驗證，請先完成原有驗證流程。',
  source_additional_verification: '此帳號設有額外驗證，請先完成原有驗證流程。',
  identity_conflict: '帳號連結需要確認，請聯絡平台協助，原事務所資料會保留。',
  rate_limited: '登入次數較多，請稍候再試。',
  service_unavailable: '目前無法連接工作台，請稍後重試。',
};

export class OfficeConnectError extends Error {
  constructor(code = 'service_unavailable') {
    super(messages[code] || messages.service_unavailable);
    this.name = 'OfficeConnectError';
    this.code = code;
  }
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function returnTarget(value) {
  return value === 'import' ? 'import' : 'workspace';
}

function browserDefaults(options) {
  const browser = typeof window === 'undefined' ? null : window;
  let storage=options.storage;
  if(storage===undefined){
    try{storage=browser?.sessionStorage||null;}catch{storage=null;}
  }
  return {
    storage,
    location: options.location || browser?.location,
    history: options.history || browser?.history,
    cryptoProvider: options.cryptoProvider || globalThis.crypto,
    now: options.now || Date.now,
  };
}

export async function beginOfficeConnection(options = {}) {
  const { storage, location, cryptoProvider, now } = browserDefaults(options);
  if (!storage || !location || !cryptoProvider?.subtle) throw new OfficeConnectError('storage_unavailable');
  const verifier = base64url(cryptoProvider.getRandomValues(new Uint8Array(32)));
  const state = base64url(cryptoProvider.getRandomValues(new Uint8Array(32)));
  const digest = await cryptoProvider.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(digest));
  const target = returnTarget(options.returnTo);
  try {
    storage.setItem(OFFICE_CONNECT_STORAGE_KEY, JSON.stringify({ state, verifier, createdAt: now(), returnTo: target }));
  } catch { throw new OfficeConnectError('storage_unavailable'); }
  const url = new URL(marketplaceUrl);
  url.searchParams.set('office_connect', '1');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  location.assign(url.href);
  return { mode: 'redirecting', returnTo: target };
}

function clearRequest(storage) {
  try { storage?.removeItem(OFFICE_CONNECT_STORAGE_KEY); }
  catch { throw new OfficeConnectError('storage_unavailable'); }
}

function getRequest(storage, now) {
  try {
    const value = JSON.parse(storage?.getItem(OFFICE_CONNECT_STORAGE_KEY) || 'null');
    if (!value || typeof value.state!=='string' || typeof value.verifier!=='string' || !opaqueValue.test(value.state) || !verifierValue.test(value.verifier) ||
      !Number.isFinite(value.createdAt) || value.createdAt > now || now - value.createdAt >= requestLifetime ||
      !['workspace', 'import'].includes(value.returnTo)) return null;
    return value;
  } catch { return null; }
}

function cleanEntryUrl(url, history) {
  const clean = new URL(url);
  clean.hash = '';
  clean.searchParams.delete('connect');
  history.replaceState(null, '', clean.pathname + clean.search);
}

export async function prepareOfficeEntry(options = {}) {
  const { storage, location, history, cryptoProvider, now } = browserDefaults(options);
  const url = new URL(options.href || location.href);
  const callback = new URLSearchParams(url.hash.slice(1));
  if (!callback.has('office_code')) {
    const target = url.searchParams.has('import') ? 'import' : 'workspace';
    if (url.searchParams.get('connect') !== 'marketplace') return { mode: 'ready', returnTo: target };
    cleanEntryUrl(url, history);
    return beginOfficeConnection({ storage, location, cryptoProvider, now, returnTo: target });
  }

  // Remove the short-lived code before any request, rendering or third-party asset load.
  cleanEntryUrl(url, history);
  if(!storage)throw new OfficeConnectError('storage_unavailable');
  const request = getRequest(storage, now());
  clearRequest(storage);
  const code = callback.get('office_code');
  const state = callback.get('state');
  if (!request || callback.getAll('office_code').length !== 1 || callback.getAll('state').length !== 1 ||
    !opaqueValue.test(code || '') || !opaqueValue.test(state || '') || state !== request.state) {
    throw new OfficeConnectError('invalid_state');
  }
  if (!options.auth || !options.fetchImpl) throw new OfficeConnectError();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 20000);
  try {
    const response = await options.fetchImpl(OFFICE_CONNECT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: officePublishableKey },
      body: JSON.stringify({ action: 'exchange', code, verifier: request.verifier }),
      signal: abort.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    const result = await response.json();
    if (!response.ok) throw new OfficeConnectError(typeof result?.code === 'string' ? result.code : undefined);
    if (typeof result?.token_hash !== 'string' || result.token_hash.length < 16 || result.token_hash.length > 512) {
      throw new OfficeConnectError();
    }
    const verified = await options.auth.verifyOtp({ token_hash: result.token_hash, type: 'magiclink' });
    if (verified.error || !verified.data?.session?.user?.id) throw new OfficeConnectError('invalid_code');
    const target = returnTarget(request.returnTo);
    history.replaceState(null, '', target === 'import' ? '/?import=1' : '/');
    return { mode: 'ready', returnTo: target };
  } catch (error) {
    if (error instanceof OfficeConnectError) throw error;
    throw new OfficeConnectError();
  } finally { clearTimeout(timer); }
}

// Boot runs before React mounts. Calling this runner twice shares one exchange,
// including when StrictMode later remounts the application tree.
export function createOfficeEntryRunner(options) {
  let flight;
  return () => {
    if (!flight) flight = prepareOfficeEntry(options);
    return flight;
  };
}
