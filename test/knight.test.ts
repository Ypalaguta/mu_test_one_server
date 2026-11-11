import test from 'node:test';
import assert from 'node:assert/strict';
import {loadData} from '../src/seed/data.js';
import {Skill,skillTags} from '../src/modules/skills/model.js';
import {skillResponse} from '../src/modules/skills/service.js';
import {resetSkillFields,resetCharacterUpdate,legacyBookIds} from '../src/seed/knight.js';
const data=await loadData('data');
const chains=Array.from({length:36},(_,i)=>data.skills.filter(s=>s.familyId===2001+i).sort((a,b)=>a.level-b.level));
const unlock=(s:typeof data.skills[number])=>s.requirements.find(c=>c.type==='CharacterLevel')!.amount;
const tier=(level:number)=>level<=40?0:level<=90?1:2;
test('36 complete linear families cover every level 1–120 with different rank counts',()=>{
 assert.equal(data.skills.length,248);
 assert.deepEqual([...new Set(data.skills.map(unlock))].sort((a,b)=>a-b),Array.from({length:120},(_,i)=>i+1));
 assert.ok(new Set(chains.map(c=>c.length)).size>=4);
 for(const chain of chains) {
  assert.ok(chain.length>=3);
  for(const [i,s] of chain.entries()) {
   assert.equal(s.level,i+1);assert.equal(s.prev,i?chain[i-1]!.id:0);
   assert.equal(s.replaces.length,0);assert.equal(s.modifierOfSkill,0);
   if(i) assert.ok(unlock(s)>unlock(chain[i-1]!));
   assert.ok(s.upgradeDescription.length>0);
  }
 }
});
test('named books only open post-40/90 stages; six doctrines pay later ranks',()=>{
 const named=new Set<number>();const common=new Set<number>();
 for(const chain of chains) {
  const seen=new Set<number>();
  for(const s of chain) {
   const t=tier(unlock(s)),first=!seen.has(t);seen.add(t);
   assert.ok(s.cost.find(c=>c.type==='Gold')!.amount>0);
   assert.ok(s.cost.find(c=>c.type==='SkillPoints')!.amount>0);
   const cost=s.cost.find(c=>c.type==='Item');
   if(!t){assert.equal(cost,undefined);continue;}
   assert.ok(cost);assert.equal(cost.amount,1);
   const item=data.items.find(i=>i.id===cost.id)!;assert.ok(item);
   assert.equal(item.slot,'None');assert.equal(item.maxStack,99);
   if(first){assert.ok(cost.id>=81000);assert.ok(!named.has(cost.id));named.add(cost.id);assert.ok(item.name.includes(s.name));assert.ok(!item.name.includes('Rank'));}
   else {assert.ok(cost.id>=80001+(t-1)*3 && cost.id<=80003+(t-1)*3);common.add(cost.id);}
  }
 }
 assert.equal(named.size,68);assert.equal(common.size,6);
 assert.equal(data.items.filter(i=>i.id>=80000 && i.iconName==='Knight_SkillBook').length,74);
 assert.ok(data.items.every(i=>!legacyBookIds.includes(i.id)));
});
test('snapshots preserve prior bonuses; resource variants appear progressively after level 40',()=>{
 const resourcePrefixes=['fortitude','retribution','resonance'];
 for(const chain of chains) for(const [i,s] of chain.entries()) {
  const p=s.effectParameters;
  if(unlock(s)<=40)assert.ok(Object.keys(p).every(k=>!resourcePrefixes.some(r=>k.startsWith(r))));
  for(const r of resourcePrefixes)if(p[r+'VariantEnabled']){
   assert.equal(p[r+'VariantEnabled'],1);assert.equal(p[r+'Threshold'],30);assert.equal(p[r+'Cost'],20);
  }
  if(i)for(const [key,value] of Object.entries(chain[i-1]!.effectParameters)){
   assert.ok(key in p,`${s.id} dropped ${key}`);assert.ok(p[key]!>=value,`${s.id} lost ${key}`);
  }
 }
 const strikes=chains[0]!;
 assert.equal(strikes.find(s=>unlock(s)===41)!.effectParameters.fortitudeVariantEnabled,1);
 assert.equal(strikes.find(s=>unlock(s)===41)!.effectParameters.retributionVariantEnabled,undefined);
 assert.ok(strikes.at(-1)!.effectParameters.resonanceVariantEnabled);
 // Defense and offense upgrades alternate, rather than increasing every number on every rank.
 assert.ok(strikes.some(s=>s.upgradeDescription.includes('fortitudeBarrier +')));
 assert.ok(strikes.some(s=>s.upgradeDescription.includes('damageMultiplier +')));
});
test('special combat contracts retain stage gates and casting constraints',()=>{
 for(const s of data.skills.filter(s=>s.executionId==='knight.spell_reflection')){
  assert.equal(s.effectParameters.friendlyFire,1);
  assert.equal(Boolean(s.effectParameters.targetedSpellReflection),unlock(s)>=91);
 }
 const byExec=(id:string)=>data.skills.filter(s=>s.executionId==='knight.'+id);
 assert.ok(byExec('guardians_oath').every(s=>unlock(s)>=91 && s.effectParameters.markJumps!>=2));
 assert.ok(byExec('spell_intercession').every(s=>unlock(s)>=91));
 assert.ok(byExec('sanctuary').every(s=>s.skillUseType==='Channel' && !s.canWalkDuringActivation));
 assert.ok(byExec('mass_arrest').every(s=>s.skillUseType==='Channel' && !s.canWalkDuringActivation));
 assert.ok(byExec('blood_covenant').every(s=>s.skillUseType==='Toggle'));
 assert.ok(byExec('shield_throw').every(s=>s.effectParameters.interruptCast===1 && s.activationRequirements.requiresShield));
 assert.ok(byExec('last_stand').every(s=>s.activationRequirements.healthBelowPercent===30 && s.effectParameters.healingBlocked===1));
 assert.ok(byExec('resource_exchange').every(s=>s.effectParameters.targetGain!<s.effectParameters.sourceCost!));
});
test('existing direct stat passives still use the supported resolver path',()=>{
 for(const s of data.skills.filter(s=>[2018,2021,2023].includes(s.familyId))) {
  assert.equal(s.executionId,'');assert.ok(Object.values(s.stats).some(v=>v>0));
 }
 for(const s of chains[23]!)assert.equal(s.executionId,'knight.shield_mastery');
});
test('UE tags preserve old numeric order; new field defaults and JSON maps are compatible',async()=>{
 assert.deepEqual(skillTags.slice(0,9),['None','Skill','Melee','Ranged','Spell','AoE','Target','Projectile','Passive']);
 const raw=JSON.parse(JSON.stringify(skillResponse(data.skills[0]!)));
 assert.equal(raw.effectParameters.damageMultiplier,1.1);assert.equal(raw.activationRequirements.requiresSword,true);
 assert.ok(raw.upgradeDescription);
 const doc=new Skill({id:1,familyId:1});await doc.validate();assert.equal(doc.upgradeDescription,'');
 assert.equal(doc.duration,0);assert.equal(doc.activationRequirements.healthBelowPercent,0);
 await assert.rejects(new Skill({id:1,familyId:1,tags:['Misspelled']}).validate());
 await assert.rejects(new Skill({id:1,familyId:1,effectParameters:{damage:Infinity}}).validate());
 for(const hp of [-1,101])await assert.rejects(new Skill({id:1,familyId:1,activationRequirements:{healthBelowPercent:hp}}).validate());
});
test('class access uses all roots, other archetypes wait for their own catalogues',()=>{
 assert.deepEqual(data.classes.find(c=>c.id===1)!.skillIds,chains.map(c=>c[0]!.id));
 assert.equal(data.characters[0]!.progress.accessible.length,36);
 assert.ok(data.classes.filter(c=>c.id!==1).every(c=>c.skillIds.length===0));
 assert.ok(data.monsters.every(m=>m.skillIds.length===0));
});
test('reset removes only old skill references and exactly the retired rank books',()=>{
 assert.equal(legacyBookIds.length,216);assert.equal(new Set(legacyBookIds).size,216);
 assert.ok(!legacyBookIds.includes(70001));assert.ok(!legacyBookIds.includes(80001));
 assert.deepEqual(Object.keys(resetSkillFields(1,[2001])).sort(),['aiSettings.allowedSkillIds','progress.accessible','progress.learned','progress.selectedModifiers']);
 assert.deepEqual(resetSkillFields(2,[2001])['progress.accessible'],[]);
 const update=resetCharacterUpdate(1,[2001]);
 assert.deepEqual(update.$pull['progress.inventory'],{itemId:{$in:legacyBookIds}});
 assert.deepEqual(update.$pull.actionBarSlots,{$or:[{type:'Skill'},{type:'Item',id:{$in:legacyBookIds}}]});
 assert.equal(update.$inc.revision,1);
 assert.ok(!('progress.equipment' in update.$set));
});
