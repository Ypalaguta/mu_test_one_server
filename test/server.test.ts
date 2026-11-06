import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { loadData } from '../src/seed/data.js';
import { createOperations } from '../src/seed/operations.js';
import { createApp } from '../src/app.js';
import { validateSkillGraph, skillResponse } from '../src/modules/skills/service.js';
import { validateState, saveSnapshot } from '../src/modules/progression/service.js';
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
test('renaming rejects whitespace but unchanged legacy names remain saveable', async()=>{
 const repo=repository();const existing=(await repo.character(1))!;
 const invalid=body(structuredClone(existing));invalid.info.characterName='Two Words';
 await assert.rejects(saveSnapshot(repo,1,invalid),/without whitespace/);
 assert.equal((await repo.character(1))!.revision,existing.revision);
 const legacy={...structuredClone(existing),info:{...existing.info,characterName:'Legacy Name'}};
 const originalRead=repo.character;repo.character=async id=>id===1?legacy:originalRead(id);
 const saved=await saveSnapshot(repo,1,body(legacy));
 assert.equal(saved.info.characterName,'Legacy Name');
});
test('seeds include staggered Knight chains and empty learned state',()=>{
 assert.equal(data.skills.length,248);assert.equal(data.skills.filter(s=>s.familyId===2001).length,11);
 assert.equal(data.skills.filter(s=>s.modifierOfSkill>0).length,0);
 assert.deepEqual(data.characters[0]!.progress.learned,[]);assert.equal(data.characters[0]!.progress.inventoryCapacity,64);
 for(const s of data.skills){assert.equal(Object.keys(s.stats).length,statFields.length);assert.equal('growthStats' in s,false);}
});
test('catalogue is a root array with new UE fields and no Mongo metadata',async()=>api(async base=>{
 const rows=await(await fetch(base+'/skills')).json();assert.equal(rows.length,248);
 const s=rows.find((x:any)=>x.id===20001);assert.equal(s.familyId,2001);assert.equal(s.prev,0);assert.equal(s.icon,null);
 for(const key of ['_id','groupId','maxLevel','baseStats','growthStats','next'])assert.equal(key in s,false);
 assert.deepEqual(await(await fetch(base+'/skills/20001')).json(),s);
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
 b.info.gold-=10;b.info.skillPoints-=1;b.progress.learned=[20001];b.progress.inventory[0].slot=20;b.actionBarSlots=[{slotNum:0,id:20001,type:'Skill'}];
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
test('graph and state still support modifiers and merges using isolated definitions',async()=>{
 const defs=[{id:1,familyId:1},{id:2,familyId:1,prev:1},{id:3,familyId:2,replaces:[2]},
 {id:4,familyId:2,prev:3},{id:5,modifierOfSkill:2}].map(x=>new Skill(x).toObject({flattenMaps:true}));
 validateSkillGraph(defs);
 const repo=repository();repo.skills=async()=>defs;repo.skill=async id=>defs.find(s=>s.id===id)??null;
 const state=structuredClone(data.characters[0]!) as CharacterRecord;state.progress.accessible=[1,2];
 state.progress.learned=[4,1];await assert.rejects(validateState(repo,state),/Replaced families/);
 state.progress.learned=[4];await validateState(repo,state);
 state.progress.selectedModifiers=[{familyId:2,skillId:5}];await validateState(repo,state);
 state.progress.learned=[1];await assert.rejects(validateState(repo,state),/modifier/);
 state.progress.selectedModifiers=[];state.actionBarSlots=[{slotNum:0,id:4,type:'Skill'}];await assert.rejects(validateState(repo,state),/unlearned/);
 for(const mutate of [(s:any[])=>{s[0].prev=2;},(s:any[])=>{s[3].familyId=1;s[3].prev=1;},(s:any[])=>{s[2].replaces=[1];}]){
 const copy=structuredClone(defs);mutate(copy);assert.throws(()=>validateSkillGraph(copy));}
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
