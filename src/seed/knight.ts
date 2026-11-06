// One-time development catalogue replacement. Stop Node API and UE servers first.
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { connectDatabase } from '../shared/database.js';
import { loadData } from './data.js';
import { createOperations, applyOperations } from './operations.js';
export function resetSkillFields(classId: number, families: number[]) {
  return {'progress.accessible':classId===1?families:[], 'progress.learned':[],
    'progress.selectedModifiers':[], 'aiSettings.allowedSkillIds':[]};
}
// Exactly the 216 per-rank books from the previous Knight seed; no broad ID-range deletion.
export const legacyBookIds = Array.from({length:24},(_,family)=>
  Array.from({length:9},(_,rank)=>70002+family*10+rank)).flat();
export function resetCharacterUpdate(classId: number, families: number[]) {
 return {$set:resetSkillFields(classId,families),$pull:{
   actionBarSlots:{$or:[{type:'Skill'},{type:'Item',id:{$in:legacyBookIds}}]},
   'progress.inventory':{itemId:{$in:legacyBookIds}}
 },$inc:{revision:1}};
}
async function main() {
 const data=await loadData(resolve(process.env.SEED_DIR || 'data'));
 const families=[...new Set(data.skills.map(s=>s.familyId))];
 if(families.length!==36 || families.some(id=>id<2001 || id>2036) || data.skills.some(s=>s.modifierOfSkill))
   throw new Error('Expected the 36-family Knight catalogue. No writes performed.');
 console.log('Replace skill catalogue; reset ALL characters learned skills/modifiers/AI skills and skill action-bar entries. No refunds. Remove the previous 216 rank-book definitions, their inventory stacks and Item action-bar references. Preserve other inventory, equipment, gold, skill points, accounts and Action/other Item bar entries.');
 if(!process.argv.includes('--apply')) { console.log('Preview only. Run with --apply while all game/API processes are stopped.'); return; }
 try {
  await connectDatabase();
  const db=mongoose.connection;
  // Normalized catalogue upserts are idempotent. Rerunning this reset clears new learning too.
  for(const mode of ['items','skills'] as const)
   await applyOperations(createOperations(data,mode),{write:async op=>{await db.collection(op.collection).updateOne(op.filter,op.update,{upsert:true});}});
  await db.collection('skills').deleteMany({id:{$nin:data.skills.map(s=>s.id)}});
  for(const cls of data.classes)
   await db.collection('classes').updateOne({id:cls.id},{$set:{skillIds:cls.skillIds,...(cls.id===1?{name:'Knight'}:{})}});
  await db.collection('monsters').updateMany({},{$set:{skillIds:[]}});
  for(const knight of [true,false])
   await db.collection('characters').updateMany({'info.classId':knight?1:{$ne:1}},
    resetCharacterUpdate(knight?1:0,families) as any);
  await db.collection('items').deleteMany({id:{$in:legacyBookIds}});
  console.log('Knight catalogue installed. Restart API and UE/PIE to reload catalogues.');
 } finally {await mongoose.disconnect();}
}
// Keep pure reset planning importable by tests.
if(process.argv[1]?.replaceAll('\\','/').endsWith('/knight.ts') || process.argv[1]?.replaceAll('\\','/').endsWith('/knight.js')) await main();
