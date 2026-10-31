import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { beginOfficeConnection, prepareOfficeEntry, createOfficeEntryRunner, OFFICE_CONNECT_STORAGE_KEY, OFFICE_CONNECT_ENDPOINT, OfficeConnectError } from './officeConnect.js';

const now=1800000000000;
const code='C'.repeat(43),state='S'.repeat(43),verifier='V'.repeat(43);
function storageFixture(request){
 const values=new Map(request?[[OFFICE_CONNECT_STORAGE_KEY,JSON.stringify(request)]]:[]);
 return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
function callbackFixture(overrides={}){
 const calls=[];
 const storage=storageFixture({state,verifier,createdAt:now-1000,returnTo:'workspace'});
 const options={storage,now:()=>now,href:`https://landmatch-office.vercel.app/#office_code=${code}&state=${state}`,
  history:{replaceState:(_a,_b,url)=>calls.push(['history',url])},
  fetchImpl:async(url,init)=>{calls.push(['fetch',url,init]);return {ok:true,json:async()=>({token_hash:'fixture_hash_not_an_auth_secret'})};},
  auth:{verifyOtp:async params=>{calls.push(['auth',params]);return {data:{session:{user:{id:'office-user'}}},error:null};}},
  ...overrides};
 return {calls,storage,options};
}

test('Office creates fresh PKCE state locally and sends only public challenge/state to the fixed marketplace',async()=>{
 const storage=storageFixture(),assigned=[];
 const result=await beginOfficeConnection({storage,cryptoProvider:webcrypto,location:{assign:url=>assigned.push(url)},now:()=>now,returnTo:'import'});
 const saved=JSON.parse(storage.getItem(OFFICE_CONNECT_STORAGE_KEY));
 const url=new URL(assigned[0]);
 assert.equal(result.mode,'redirecting');assert.equal(saved.returnTo,'import');assert.equal(saved.createdAt,now);
 assert.match(saved.state,/^[A-Za-z0-9_-]{43}$/);assert.match(saved.verifier,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(saved.state,saved.verifier);
 assert.equal(url.origin,'https://land-match-pro.vercel.app');assert.equal(url.pathname,'/');assert.equal(url.searchParams.get('office_connect'),'1');assert.equal(url.searchParams.get('state'),saved.state);
 const challenge=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(saved.verifier))).toString('base64url');
 assert.equal(url.searchParams.get('code_challenge'),challenge);
 assert.deepEqual([...url.searchParams.keys()].sort(),['code_challenge','office_connect','state']);
 assert(!url.href.includes(saved.verifier));assert.equal(url.hash,'');
});

test('callback removes code immediately, exchanges with local verifier, then creates only the Office session',async()=>{
 const f=callbackFixture();
 f.storage.setItem(OFFICE_CONNECT_STORAGE_KEY,JSON.stringify({state,verifier,createdAt:now-1000,returnTo:'import'}));
 const result=await prepareOfficeEntry(f.options);
 assert.deepEqual(result,{mode:'ready',returnTo:'import'});
 assert.deepEqual(f.calls[0],['history','/']);
 assert.equal(f.calls[1][0],'fetch');assert.equal(f.calls[1][1],OFFICE_CONNECT_ENDPOINT);
 const request=f.calls[1][2];
 assert.equal(request.method,'POST');assert.equal(request.credentials,'omit');assert.equal(request.cache,'no-store');
 assert.deepEqual(JSON.parse(request.body),{action:'exchange',code,verifier});
 assert(!('Authorization' in request.headers));
 assert.deepEqual(f.calls[2],['auth',{token_hash:'fixture_hash_not_an_auth_secret',type:'magiclink'}]);
 assert.deepEqual(f.calls[3],['history','/?import=1']);assert.equal(f.storage.getItem(OFFICE_CONNECT_STORAGE_KEY),null);
 for(const call of f.calls.filter(call=>call[0]==='history'))assert(!call[1].includes('office_code')&&!call[1].includes('token'));
});

test('wrong, expired, future or malformed state never contacts exchange or Office Auth',async()=>{
 for(const alter of [
  request=>({...request,state:'W'.repeat(43)}),
  request=>({...request,createdAt:now-300000}),
  request=>({...request,createdAt:now+1}),
  request=>({...request,verifier:'short'}),
  request=>({...request,returnTo:'https://attacker.invalid/'}),
 ]){
  const f=callbackFixture();f.storage.setItem(OFFICE_CONNECT_STORAGE_KEY,JSON.stringify(alter({state,verifier,createdAt:now-1000,returnTo:'workspace'})));
  await assert.rejects(prepareOfficeEntry(f.options),error=>error instanceof OfficeConnectError&&error.code==='invalid_state');
  assert.deepEqual(f.calls,[['history','/']]);assert.equal(f.storage.getItem(OFFICE_CONNECT_STORAGE_KEY),null);
 }
 for(const hash of [`#office_code=bad&state=${state}`,`#office_code=${code}&state=${state}&state=${state}`,`#office_code=${code}`]){
  const f=callbackFixture({href:`https://landmatch-office.vercel.app/${hash}`});
  await assert.rejects(prepareOfficeEntry(f.options),{code:'invalid_state'});assert.equal(f.calls.length,1);
 }
});

test('single-flight boot exchanges once and a replay without local request is rejected',async()=>{
 const f=callbackFixture();const run=createOfficeEntryRunner(f.options);
 const first=run(),second=run();assert.strictEqual(first,second);
 await Promise.all([first,second,run()]);
 assert.equal(f.calls.filter(call=>call[0]==='fetch').length,1);assert.equal(f.calls.filter(call=>call[0]==='auth').length,1);
 await assert.rejects(prepareOfficeEntry(f.options),{code:'invalid_state'});
 assert.equal(f.calls.filter(call=>call[0]==='fetch').length,1);
});

test('failed exchange and OTP validation fail closed with controlled messages and no retained request',async()=>{
 const f=callbackFixture({fetchImpl:async()=>({ok:false,json:async()=>({code:'office_account_unverified',message:'Bearer private_token email@example.invalid'})})});
 await assert.rejects(prepareOfficeEntry(f.options),error=>error.code==='office_account_unverified'&&!error.message.includes('private_token')&&!error.message.includes('@'));
 assert.equal(f.calls.some(call=>call[0]==='auth'),false);assert.equal(f.storage.getItem(OFFICE_CONNECT_STORAGE_KEY),null);
 const network=callbackFixture({fetchImpl:async()=>{throw new Error('Bearer private_token');}});
 await assert.rejects(prepareOfficeEntry(network.options),error=>error.code==='service_unavailable'&&!error.message.includes('private_token'));
 const otp=callbackFixture({auth:{verifyOtp:async()=>({data:{session:null},error:new Error('do not render')})}});
 await assert.rejects(prepareOfficeEntry(otp.options),{code:'invalid_code'});
});

test('normal workspace and local transcript imports still work when browser session storage is blocked',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'window');
 try{
  for(const suffix of ['','?import=1']){
   const location={href:`https://landmatch-office.vercel.app/${suffix}`};
   Object.defineProperty(globalThis,'window',{configurable:true,value:{location,get sessionStorage(){throw new Error('blocked');}}});
   assert.deepEqual(await prepareOfficeEntry(),{mode:'ready',returnTo:suffix?'import':'workspace'});
  }
 }finally{if(original)Object.defineProperty(globalThis,'window',original);else delete globalThis.window;}
 const assigned=[];
 await assert.rejects(beginOfficeConnection({storage:{setItem(){throw new Error('blocked');}},location:{assign:url=>assigned.push(url)},cryptoProvider:webcrypto}),{code:'storage_unavailable'});
 assert.equal(assigned.length,0);
});

test('explicit connect starts before mounting any existing workspace and retains only an allowed return target',async()=>{
 const storage=storageFixture(),calls=[];
 const result=await prepareOfficeEntry({href:'https://landmatch-office.vercel.app/?import=1&connect=marketplace',storage,cryptoProvider:webcrypto,now:()=>now,
  location:{assign:url=>calls.push(['assign',url])},history:{replaceState:(_a,_b,url)=>calls.push(['history',url])}});
 assert.equal(result.mode,'redirecting');assert.deepEqual(calls[0],['history','/?import=1']);assert.equal(calls[1][0],'assign');
 assert.equal(JSON.parse(storage.getItem(OFFICE_CONNECT_STORAGE_KEY)).returnTo,'import');
});
