import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../src/seed/data.js';
import { fitsEquipment, equipmentError } from '../src/modules/items/equipment.js';
import { equipmentSlots } from '../src/modules/items/types.js';
import { saveSnapshot, snapshot } from '../src/modules/progression/service.js';
import { Character } from '../src/modules/characters/model.js';
import { Item } from '../src/modules/items/model.js';
import type { Repository, CharacterRecord } from '../src/shared/contracts.js';

const data = await loadData('data');
const items = new Map(data.items.map(i => [i.id, i]));
function harness() {
  let state = structuredClone(data.characters[0]!) as CharacterRecord;
  let writes = 0;
  const repo = {
    character: async () => structuredClone(state),
    characterClass: async () => data.classes[0],
    items: async () => data.items, skills: async () => data.skills,
    saveState: async (_id: number, revision: number, next: CharacterRecord) => {
      if (revision !== state.revision) return null;
      state = structuredClone({...next, revision: revision + 1}); ++writes; return state;
    }
  } as unknown as Repository;
  return {repo, getState: () => structuredClone(state), writes: () => writes};
}
function body(s: CharacterRecord) {
  return {expectedRevision:s.revision, info:s.info, progress:s.progress, actionBarSlots:s.actionBarSlots};
}
test('17 equipment destinations support paired slots, dual wield and separate amulet/necklace', () => {
  assert.equal(equipmentSlots.length, 17);
  for (const slot of ['MainHand','OffHand']) assert.ok(fitsEquipment(items.get(1)!,slot));
  for (const slot of ['Ring1','Ring2']) assert.ok(fitsEquipment(items.get(3001)!,slot));
  assert.ok(fitsEquipment(items.get(3004)!,'Amulet'));
  assert.ok(!fitsEquipment(items.get(3004)!,'Necklace'));
  assert.ok(fitsEquipment(items.get(3006)!,'Necklace'));
  for (const slot of ['Accessory1','Accessory2']) assert.ok(fitsEquipment({slot:'Accessory',maxStack:1},slot));
  for (const slot of ['Earring1','Earring2']) assert.ok(fitsEquipment({slot:'Earring',maxStack:1},slot));
});
test('two-handed item is stored once and conflicts with every off-hand item', () => {
  assert.equal(equipmentError([{slot:'MainHand',itemId:2}],items),null);
  for (const itemId of [1,2,5,1051]) assert.ok(equipmentError([{slot:'MainHand',itemId:2},{slot:'OffHand',itemId}],items));
  assert.ok(!fitsEquipment(items.get(2)!,'OffHand'));
  assert.equal(equipmentError([{slot:'MainHand',itemId:1},{slot:'OffHand',itemId:1}],items),null);
});
test('wrong destinations, duplicate slots, unknown items and stackable gear are rejected', () => {
  assert.ok(equipmentError([{slot:'Helm',itemId:1}],items));
  assert.ok(equipmentError([{slot:'Ring1',itemId:3001},{slot:'Ring1',itemId:3002}],items));
  assert.ok(equipmentError([{slot:'MainHand',itemId:999999}],items));
  assert.ok(equipmentError([{slot:'Unknown',itemId:1}],items));
  assert.ok(!fitsEquipment({slot:'OneHand',maxStack:2},'MainHand'));
  assert.ok(!fitsEquipment({slot:'None',maxStack:1},'MainHand'));
});
test('equipment and bag persist atomically and survive login snapshot reload', async () => {
  const h=harness(),s=h.getState();
  s.progress.equipment=[{slot:'MainHand',itemId:1},{slot:'OffHand',itemId:5}];
  s.progress.inventory=[{slot:3,itemId:3,quantity:1}];
  const saved=await saveSnapshot(h.repo,s.id,body(s));
  assert.deepEqual(saved.progress.equipment,s.progress.equipment);
  const loaded=await snapshot(h.repo,s.id);
  assert.deepEqual(loaded.progress.inventory,s.progress.inventory);
  assert.deepEqual(loaded.progress.equipment,s.progress.equipment);
  assert.equal(h.writes(),1);
  await assert.rejects(saveSnapshot(h.repo,s.id,body(s)),/Reload character/);
  assert.equal(h.writes(),1);
});
test('loot receipt and both potions survive reload as one revision', async () => {
  const h = harness();
  const state = h.getState();
  state.progress.lastLootReceipt = 'df125396eaab41c6802b656143d931de';
  state.progress.inventory = [{slot: 0, itemId: 4001, quantity: 2}];
  await saveSnapshot(h.repo, state.id, body(state));
  await assert.rejects(saveSnapshot(h.repo, state.id, body(state)), /Reload character/);
  const loaded = await snapshot(h.repo, state.id);
  assert.equal(loaded.progress.lastLootReceipt, state.progress.lastLootReceipt);
  assert.deepEqual(loaded.progress.inventory, state.progress.inventory);
  assert.equal(h.writes(), 1);
});
test('invalid equipment cannot partially overwrite the inventory', async () => {
  const h=harness(),original=h.getState(),s=h.getState();
  s.progress.inventory=[];
  s.progress.equipment=[{slot:'MainHand',itemId:2},{slot:'OffHand',itemId:5}];
  await assert.rejects(saveSnapshot(h.repo,s.id,body(s)),/both hands/);
  assert.equal(h.writes(),0);
  assert.deepEqual(h.getState(),original);
});
test('omitting equipment on save is rejected instead of silently unequipping everything', async () => {
  const h=harness(),s=h.getState();
  const payload=body(s) as any;
  delete payload.progress.equipment;
  await assert.rejects(saveSnapshot(h.repo,s.id,payload),/must not be omitted/);
  assert.equal(h.writes(),0);
});
test('old stored character without equipment loads empty and can be saved without migration', async () => {
  const h=harness();
  const legacy=h.getState() as any;
  delete legacy.progress.equipment;
  const repo={...h.repo,character:async()=>legacy};
  const loaded=await snapshot(repo,legacy.id);
  assert.deepEqual(loaded.progress.equipment,[]);
  await saveSnapshot(repo,legacy.id,body(loaded));
});
test('new character defaults empty; item enums reject legacy strings and invalid slots', async () => {
  const c=new Character({id:99,accountId:1});await c.validate();
  assert.deepEqual(c.toObject().progress.equipment,[]);
  for(const patch of [{type:'weapon'},{slot:'mainHand'},{slot:'Invalid'}])
    await assert.rejects(new Item({id:99,name:'Test',type:'Sword',slot:'OneHand',...patch}).validate());
});
