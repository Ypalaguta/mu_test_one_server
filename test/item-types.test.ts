import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Item } from '../src/modules/items/model.js';
import { CharacterClass } from '../src/modules/classes/model.js';
import { loadData } from '../src/seed/data.js';
import { resolve } from 'node:path';

test('item defaults do not add character capacities and restrictions default empty', async () => {
 const item = new Item({id:999,name:'Test',type:'CraftingMaterial'});
 await item.validate();
 const value=item.toObject();
 assert.equal(value.weight,0);assert.equal(value.rarity,'Common');assert.equal(value.border,'None');
 assert.equal(value.modifierIcon,'');assert.equal(value.autoUsageAvailable,false);
 for(const key of ['wearRestrictions','storageRestrictions','tradeRestrictions'] as const) assert.deepEqual(value[key],[]);
 for(const key of ['maxWeight','inventorySlots','auctionSlots'] as const)assert.equal(value.stats[key],0);
 const cls=new CharacterClass({id:999,name:'Test',baseStats:{hp:100}});await cls.validate();
 assert.equal(cls.baseStats.maxWeight,40000);assert.equal(cls.baseStats.inventorySlots,64);assert.equal(cls.baseStats.auctionSlots,10);
 assert.equal(cls.growthStats.maxWeight,0);assert.equal(cls.growthStats.auctionSlots,0);
});
test('item enums and finite nonnegative weights reject invalid values', async () => {
 for(const patch of [{weight:-1},{weight:Infinity},{border:'Invalid'},{rarity:'Invalid'},{wearRestrictions:['Invalid']},{storageRestrictions:['Invalid']},{tradeRestrictions:['Invalid']}]) {
  await assert.rejects(new Item({id:999,name:'Test',type:'CraftingMaterial',...patch}).validate());
 }
 const item=new Item({id:999,name:'Test',type:'ClothArmour',weight:500,modifierIcon:'enchanted',rarity:'Rare',border:'Blue',autoUsageAvailable:true,wearRestrictions:['CannotEquipInCombat'],storageRestrictions:['NoAccountStorage'],tradeRestrictions:['NoAuction']});
 await item.validate();assert.equal(item.toObject().modifierIcon,'enchanted');
});
test('seeded classes provide limits, all item/skill bonuses remain zero by default',async()=>{
 const data=await loadData(resolve('data'));
 for(const cls of data.classes){assert.equal(cls.baseStats.maxWeight,40000);assert.equal(cls.baseStats.inventorySlots,64);assert.equal(cls.baseStats.auctionSlots,10);}
 for(const row of [...data.items,...data.skills])for(const k of ['maxWeight','inventorySlots','auctionSlots'] as const)assert.equal(row.stats[k],0);
});
