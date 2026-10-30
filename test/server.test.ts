import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { loadData } from '../src/seed/data.js';
import { createOperations } from '../src/seed/operations.js';
import { createApp } from '../src/app.js';
import { validateSkillGraph, skillResponse } from '../src/modules/skills/service.js';
import { validateState } from '../src/modules/progression/service.js';
import { Skill } from '../src/modules/skills/model.js';
import type { Repository, CharacterRecord } from '../src/shared/contracts.js';
import { tokenHash } from '../src/modules/accounts/password.js';
import { statFields } from '../src/shared/statFields.js';
const data=await loadData('data');
process.env.GAME_SERVER_TOKEN='test-only-secret';
const headers={'content-type':'application/json','X-Game-Server-Token':'test-only-secret','X-Account-Session':'a'.repeat(64)};
function repository(){
 const store=new Map(data.characters.map(d=>[d.id,structuredClone(d) as CharacterRecord]));
 const repo:Repository={
  account:async id=>id===1?{id:1,login:'admin',passwordHash:'unused',role:'admin',notes:'',characterLimit:7,ban:{startedAt:null,expiresAt:null,revokedAt:null,reason:'',issuedBy:0,revokedBy:0}}:null,
  sessionByHash:async hash=>hash===tokenHash('a'.repeat(64))?{tokenHash:hash,accountId:1,expiresAt:new Date(Date.now()+60000)}:null,
  character:async id=>store.get(id)??null,
  saveState:async(id,revision,value)=>{const old=store.get(id);if(!old||old.revision!==revision)return null;const next={...structuredClone(value),revision:revision+1};store.set(id,next);return next;},
  items:async()=>data.items, skills:async()=>data.skills,
  item:async id=>data.items.find(d=>d.id===id)??null,skill:async id=>data.skills.find(d=>d.id===id)??null,
  characterClass:async id=>data.classes.find(d=>d.id===id)??null,monster:async id=>data.monsters.find(d=>d.id===id)??null,
  location:async id=>data.spawns.find(d=>d.locationId===id)??null,
  actionBar:async id=>store.get(id)??null,saveActionBar:async()=>null
 };return repo;
}
async function api(run:(base:string,repo:Repository)=>Promise<void>){const repo=repository();const server=createApp(repo).listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();assert.ok(addr&&typeof addr!=='string');try{await run(`http://127.0.0.1:${addr.port}/api`,repo);}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}}
function body(s:any){return {expectedRevision:s.revision,info:s.info,progress:s.progress,actionBarSlots:s.actionBarSlots};}
test('seeds include 30-rank passive chains, modifiers, merge and empty learned state',()=>{
 assert.equal(data.skills.length,450);assert.equal(data.skills.filter(s=>s.familyId===101).length,30);
 assert.equal(data.skills.filter(s=>s.modifierOfSkill===2).length,3);
 assert.deepEqual(data.characters[0]!.progress.learned,[]);assert.equal(data.characters[0]!.progress.inventoryCapacity,64);
 for(const s of data.skills){assert.equal(Object.keys(s.stats).length,statFields.length);assert.equal('growthStats' in s,false);}
});
test('catalogue is a root array with new UE fields and no Mongo metadata',async()=>api(async base=>{
 const rows=await(await fetch(base+'/skills')).json();assert.equal(rows.length,450);
 const s=rows.find((x:any)=>x.id===1);assert.equal(s.familyId,1);assert.equal(s.prev,0);assert.equal(s.icon,null);
 for(const key of ['_id','groupId','maxLevel','baseStats','growthStats','next'])assert.equal(key in s,false);
 assert.deepEqual(await(await fetch(base+'/skills/1')).json(),s);
 const items=await(await fetch(base+'/items')).json();assert.ok(items.every((i:any)=>i.maxStack>=1&&i.inventoryTab&&!('_id'in i)));
}));
test('state requires server token, public catalogue does not',async()=>api(async base=>{
 assert.equal((await fetch(base+'/characters/1/state')).status,403);
 assert.equal((await fetch(base+'/characters/1/state',{headers:{'X-Game-Server-Token':'wrong'}})).status,403);
 assert.equal((await fetch(base+'/skills')).status,200);
 assert.equal((await fetch(base+'/characters/1/state',{headers})).status,200);
}));
test('character snapshot contains inventory, info, skill state, actionbar and class stats',async()=>api(async base=>{
 const s=await(await fetch(base+'/characters/1/state',{headers})).json();assert.equal(s.info.characterName,'Admin');assert.equal(s.baseStats.hp,150);
 assert.equal(s.progress.inventoryCapacity,64);assert.equal(s.progress.inventory.length,3);assert.deepEqual(s.progress.achievements,[]);
 assert.equal(Object.keys(s.baseStats).length,statFields.length);
}));
test('atomic save persists all changes and rejects stale version without partial writes',async()=>api(async base=>{
 const s=await(await fetch(base+'/characters/1/state',{headers})).json();const b=body(s);
 b.info.gold-=10;b.info.skillPoints-=1;b.progress.learned=[1];b.progress.inventory[0].slot=20;b.actionBarSlots=[{slotNum:0,id:1,type:'Skill'}];
 const res=await fetch(base+'/characters/1/state',{method:'PUT',headers,body:JSON.stringify(b)});assert.equal(res.status,200);const saved=await res.json();assert.equal(saved.revision,1);assert.equal(saved.info.gold,9990);
 b.info.gold=0;assert.equal((await fetch(base+'/characters/1/state',{method:'PUT',headers,body:JSON.stringify(b)})).status,409);
 const again=await(await fetch(base+'/characters/1/state',{headers})).json();assert.equal(again.info.gold,9990);assert.equal(again.progress.inventory[0].slot,20);
}));
test('inventory rejects duplicate/out-of-range slots, unknown items and stack overflow',async()=>api(async base=>{
 const s=await(await fetch(base+'/characters/1/state',{headers})).json();
 for(const inv of [[{slot:0,itemId:1,quantity:1},{slot:0,itemId:1,quantity:1}],[{slot:64,itemId:1,quantity:1}],[{slot:0,itemId:9999,quantity:1}],[{slot:0,itemId:1,quantity:2}]]){
 const b=body(structuredClone(s));b.progress.inventory=inv;assert.equal((await fetch(base+'/characters/1/state',{method:'PUT',headers,body:JSON.stringify(b)})).status,400);}
 assert.equal((await(await fetch(base+'/characters/1/state',{headers})).json()).revision,0);
}));
test('capacity may be 500, cannot be 501 or 63',async()=>api(async base=>{
 const s=await(await fetch(base+'/characters/1/state',{headers})).json();for(const n of [501,63]){const b=body(structuredClone(s));b.progress.inventoryCapacity=n;assert.equal((await fetch(base+'/characters/1/state',{method:'PUT',headers,body:JSON.stringify(b)})).status,400);}
 const b=body(s);b.progress.inventoryCapacity=500;b.progress.inventory[0].slot=499;assert.equal((await fetch(base+'/characters/1/state',{method:'PUT',headers,body:JSON.stringify(b)})).status,200);
}));
test('later merged rank suppresses source families transitively',async()=>{
 const repo=repository();const s=structuredClone(data.characters[0]!) as CharacterRecord;
 s.progress.learned=[5002,101];await assert.rejects(validateState(repo,s),/Replaced families/);
 s.progress.learned=[5002];await validateState(repo,s);
});
test('selected modifiers require learned matching family; actionbar requires learned skill',async()=>{
 const repo=repository();const s=structuredClone(data.characters[0]!) as CharacterRecord;
 s.progress.selectedModifiers=[{familyId:2,skillId:6001}];await assert.rejects(validateState(repo,s),/modifier/);
 s.progress.learned=[2];await validateState(repo,s);s.actionBarSlots=[{slotNum:0,id:1,type:'Skill'}];await assert.rejects(validateState(repo,s),/unlearned/);
});
test('graph rejects cycles, branches and replacement of a nonterminal rank',()=>{
 for(const mutate of [(s:any[])=>{s.find(x=>x.id===101).prev=20102;},(s:any[])=>{s.find(x=>x.id===20103).prev=101;},(s:any[])=>{s.find(x=>x.id===5000).replaces=[101];}]){const s=structuredClone(data.skills);mutate(s);assert.throws(()=>validateSkillGraph(s));}
});
test('condition schema supports multiple item IDs but rejects repeated keys and invalid costs',async()=>{
 await new Skill({id:1,familyId:1,requirements:[{type:'Item',id:1,amount:2},{type:'Item',id:2,amount:3}]}).validate();
 for(const fields of [{cost:[{type:'Achievement',id:1,amount:1}]},{cost:[{type:'Gold',id:0,amount:2},{type:'Gold',id:0,amount:3}]},{requirements:[{type:'Achievement',id:1,amount:2}]},{stats:{parry:2}}])await assert.rejects(async()=>new Skill({id:1,familyId:1,...fields}).validate());
});
test('skill-only seed does not write characters or run migration operations',()=>{for(const op of createOperations(data,'skills')){assert.equal(op.collection,'skills');assert.equal('$unset'in op.update,false);}});
test('old direct actionbar write is disabled',async()=>api(async base=>{assert.equal((await fetch(base+'/characters/1/action-bar',{method:'PUT',headers,body:'{"slots":[]}'})).status,410);}));
test('partial snapshots cannot reset omitted progress or metadata',async()=>api(async base=>{assert.equal((await fetch(base+'/characters/1/state',{method:'PUT',headers,body:'{"expectedRevision":0,"info":{}}'})).status,400);}));

test('action bar supports all 100 slots, roundtrip and clearing',async()=>api(async base=>{
 const s=await(await fetch(base+'/characters/1/state',{headers})).json();
 const b=body(s);b.actionBarSlots=Array.from({length:100},(_,slotNum)=>({slotNum,id:1,type:'Item'}));
 const saved=await fetch(base+'/characters/1/state',{method:'PUT',headers,body:JSON.stringify(b)});
 assert.equal(saved.status,200);const full=await saved.json();assert.equal(full.actionBarSlots.length,100);assert.equal(full.actionBarSlots[99].slotNum,99);
 const loaded=await(await fetch(base+'/characters/1/state',{headers})).json();assert.deepEqual(loaded.actionBarSlots,full.actionBarSlots);
 const cleared=body(loaded);cleared.actionBarSlots=[];
 const res=await fetch(base+'/characters/1/state',{method:'PUT',headers,body:JSON.stringify(cleared)});assert.equal(res.status,200);assert.deepEqual((await res.json()).actionBarSlots,[]);
}));
test('action bar rejects out-of-range and duplicate slots without saving',async()=>api(async base=>{
 const s=await(await fetch(base+'/characters/1/state',{headers})).json();
 for(const slots of [[{slotNum:100,id:1,type:'Item'}],[{slotNum:-1,id:1,type:'Item'}],[{slotNum:99,id:1,type:'Item'},{slotNum:99,id:2,type:'Item'}]]){
  const b=body(s);b.actionBarSlots=slots;
  const res=await fetch(base+'/characters/1/state',{method:'PUT',headers,body:JSON.stringify(b)});assert.equal(res.status,400);
 }
 assert.equal((await(await fetch(base+'/characters/1/state',{headers})).json()).revision,s.revision);
}));
