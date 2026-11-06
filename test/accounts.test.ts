import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { loadData } from '../src/seed/data.js';
import { login, authenticate, register, validateRoster, isBanned } from '../src/modules/accounts/service.js';
import { hashPassword, verifyPassword, tokenHash } from '../src/modules/accounts/password.js';
import { addItem } from '../src/modules/accounts/admin.js';
import type { Repository, CharacterRecord } from '../src/shared/contracts.js';
import type { AccountRecord, SessionRecord } from '../src/modules/accounts/types.js';
const data=await loadData('data');
const password='development-test-password';const passwordHash=await hashPassword(password);
function fixture(role='admin') {
 const account:AccountRecord={id:1,login:'tester',passwordHash,role,notes:'PRIVATE NOTE',characterLimit:7,
  ban:{startedAt:null,expiresAt:null,revokedAt:null,reason:'PRIVATE BAN',issuedBy:0,revokedBy:0}};
 const rows=new Map<number,CharacterRecord>([[1,structuredClone(data.characters[0]!) as CharacterRecord]]);
 const sessions=new Map<string,SessionRecord>();let writes=0;
 const repo:Repository={
  account:async id=>id===1?account:id===2?{...account,id:2,role:'player'}:null,
  accountByLogin:async name=>name===account.login?account:null,
  accountCharacters:async id=>[...rows.values()].filter(c=>c.accountId===id),
  createSession:async s=>{sessions.clear();sessions.set(s.tokenHash,s);},
  sessionByHash:async h=>sessions.get(h)??null,
  deleteSession:async h=>{sessions.delete(h);},
  createAccountWithCharacter:async(name,hash,charName,classId)=>{
   assert.notEqual(hash,password);return {...account,id:3,login:name,passwordHash:hash,role:'player'};
  },
  character:async id=>rows.get(id)??null,
  saveState:async(id,revision,value)=>{const old=rows.get(id);if(!old||old.revision!==revision)return null;const next={...structuredClone(value),revision:revision+1};rows.set(id,next);writes++;return next;},
  items:async()=>data.items,skills:async()=>data.skills,item:async id=>data.items.find(x=>x.id===id)??null,
  skill:async id=>data.skills.find(x=>x.id===id)??null,characterClass:async id=>data.classes.find(x=>x.id===id)??null,
  monster:async id=>data.monsters.find(x=>x.id===id)??null,location:async id=>data.spawns.find(x=>x.locationId===id)??null,
  actionBar:async()=>null,saveActionBar:async()=>null
 };return {repo,account,rows,sessions,writes:()=>writes};
}
test('password hashes are salted and verified without storing plaintext',async()=>{
 assert.ok(await verifyPassword(password,passwordHash));assert.equal(await verifyPassword('wrong password',passwordHash),false);
 assert.notEqual(await hashPassword(password),passwordHash);assert.equal(passwordHash.includes(password),false);
});
test('login returns safe account and complete owned snapshots in one response',async()=>{
 const f=fixture();const r=await login(f.repo,{login:' TESTER ',password});
 assert.equal(r.account.role,'admin');assert.equal(r.characters.length,1);
 assert.equal(r.serverNotice.id,'welcome-2026-11');assert.equal(r.serverNotice.enabled,true);
 assert.equal(r.characters[0]!.isMain,true);assert.equal(r.characters[0]!.isActive,true);
 assert.equal(r.characters[0]!.accountId,1);assert.equal(r.characters[0]!.baseStats.hp,150);
 assert.equal(r.characters[0]!.progress.inventoryCapacity,64);assert.deepEqual(r.characters[0]!.aiSettings,{allowedSkillIds:[]});
 const json=JSON.stringify(r);for(const secret of ['PRIVATE NOTE','PRIVATE BAN','passwordHash',passwordHash])assert.equal(json.includes(secret),false);
 assert.equal(f.sessions.has(r.sessionToken),false);assert.equal(f.sessions.has(tokenHash(r.sessionToken)),true);
});
test('invalid password, unknown login and active ban cannot create a session',async()=>{
 const f=fixture();await assert.rejects(login(f.repo,{login:'tester',password:'wrong password'}),/Invalid login or password/);
 await assert.rejects(login(f.repo,{login:'unknown',password}),/Invalid login or password/);
 f.account.ban.startedAt=new Date(Date.now()-1000);await assert.rejects(login(f.repo,{login:'tester',password}),/banned/);
 assert.equal(f.sessions.size,0);
 f.account.ban.expiresAt=new Date(Date.now()-1);assert.equal(isBanned(f.account),false);await login(f.repo,{login:'tester',password});
 f.account.ban.expiresAt=null;f.account.ban.revokedAt=new Date();assert.equal(isBanned(f.account),false);
});
test('roster enforces seven total, five active and exactly one active main',()=>{
 const base=structuredClone(data.characters[0]!) as CharacterRecord;
 const rows=Array.from({length:7},(_,i)=>({...structuredClone(base),id:i+1,isActive:i<5,isMain:i===0}));validateRoster(rows);
 for(const mutate of [(a:CharacterRecord[])=>a.push({...base,id:8}),(a:CharacterRecord[])=>{a[5]!.isActive=true;},
  (a:CharacterRecord[])=>{a[1]!.isMain=true;},(a:CharacterRecord[])=>{a[0]!.isActive=false;},(a:CharacterRecord[])=>{a[0]!.isMain=false;}]){
  const a=structuredClone(rows);mutate(a);assert.throws(()=>validateRoster(a));
 }
});
test('expired/replaced/revoked sessions and bans block future operations',async()=>{
 const f=fixture();const first=await login(f.repo,{login:'tester',password});await authenticate(f.repo,first.sessionToken);
 const second=await login(f.repo,{login:'tester',password});await assert.rejects(authenticate(f.repo,first.sessionToken),/Log in again/);
 f.sessions.get(tokenHash(second.sessionToken))!.expiresAt=new Date(0);await assert.rejects(authenticate(f.repo,second.sessionToken),/Log in again/);
 const third=await login(f.repo,{login:'tester',password});f.account.ban.startedAt=new Date(0);await assert.rejects(authenticate(f.repo,third.sessionToken),/banned/);
});
test('registration does not allow role injection and never returns password hash',async()=>{
 const f=fixture();await assert.rejects(register(f.repo,{login:'newuser',password,role:'admin'}),/Unknown field/);
 const r=await register(f.repo,{login:'newuser',password,characterName:'NewHero',classId:1});
 assert.equal(r.account.role,'player');assert.equal('passwordHash' in r.account,false);
});
test('registration rejects whitespace in character names before creating accounts',async()=>{
 const f=fixture();let created=0;
 const create=f.repo.createAccountWithCharacter!;
 f.repo.createAccountWithCharacter=async(...args)=>{created++;return create(...args);};
 for(const characterName of ['Two Words',' Leading','Trailing ','Tab\tName','Line\nName','No\u00a0Break',''])
  await assert.rejects(register(f.repo,{login:'newuser',password,characterName,classId:1}),/without whitespace/);
 assert.equal(created,0);
 await register(f.repo,{login:'newuser',password,characterName:'Knight_One',classId:1});
 assert.equal(created,1);
});
test('admin grants stack items, preserve ownership and refuse full inventories atomically',async()=>{
 const f=fixture();const r=await login(f.repo,{login:'tester',password});
 const saved=await addItem(f.repo,r.sessionToken,1,{itemId:1,quantity:2,expectedRevision:0});
 assert.equal(saved.accountId,1);assert.equal(saved.isMain,true);assert.equal(saved.progress.inventory.filter(x=>x.itemId===1).length,3);
 const c=f.rows.get(1)!;c.progress.inventory=Array.from({length:64},(_,slot)=>({slot,itemId:1,quantity:1}));
 await assert.rejects(addItem(f.repo,r.sessionToken,1,{itemId:1,quantity:1,expectedRevision:1}),/Not enough space/);assert.equal(f.writes(),1);
});
test('player cannot grant items; gm cannot grant to another privileged account',async()=>{
 const f=fixture('player');const r=await login(f.repo,{login:'tester',password});
 await assert.rejects(addItem(f.repo,r.sessionToken,1,{itemId:1,quantity:1,expectedRevision:0}),/permission/);
 f.account.role='gm';f.rows.set(2,{...structuredClone(f.rows.get(1)!),id:2,accountId:2});
 f.repo.account=async id=>id===1?f.account:{...f.account,id:2,role:'admin'};
 await assert.rejects(addItem(f.repo,r.sessionToken,2,{itemId:1,quantity:1,expectedRevision:0}),/protected/);
 assert.equal(f.writes(),0);
});
test('HTTP login requires game token; normal snapshots require session and ownership; old admin routes are stubs',async()=>{
 process.env.GAME_SERVER_TOKEN='account-test-token';const f=fixture();
 f.rows.set(2,{...structuredClone(f.rows.get(1)!),id:2,accountId:2});
 const server=createApp(f.repo).listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();assert.ok(addr&&typeof addr!=='string');
 const url=`http://127.0.0.1:${addr.port}/api`;const h={'content-type':'application/json','X-Game-Server-Token':'account-test-token'};
 try{
  assert.equal((await fetch(url+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:'tester',password})})).status,403);
  const response=await fetch(url+'/auth/login',{method:'POST',headers:h,body:JSON.stringify({login:'tester',password})});assert.equal(response.status,200);
  const r=await response.json();const authorized={...h,'X-Account-Session':r.sessionToken};
  assert.equal((await fetch(url+'/characters/1/state',{headers:h})).status,401);
  assert.equal((await fetch(url+'/characters/1/state',{headers:authorized})).status,200);
  assert.equal((await fetch(url+'/characters/2/state',{headers:authorized})).status,403);
  assert.equal((await fetch(url+'/admin/spawns/forest',{method:'PUT',headers:authorized,body:'{}'})).status,501);
  assert.equal((await fetch(url+'/auth/logout',{method:'POST',headers:authorized,body:'{}'})).status,200);
  assert.equal((await fetch(url+'/characters/1/state',{headers:authorized})).status,401);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
