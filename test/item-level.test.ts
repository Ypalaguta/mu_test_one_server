import test from 'node:test';
import assert from 'node:assert/strict';
import { Item } from '../src/modules/items/model.js';
import { loadData } from '../src/seed/data.js';

test('itemLevel defaults to 1 and rejects fractional, nonpositive and nonfinite levels', async () => {
  const item = new Item({id:999,name:'Test',type:'Sword',slot:'OneHand'});
  await item.validate(); assert.equal(item.toObject().itemLevel,1);
  for (const itemLevel of [0,-1,1.5,Infinity,NaN,2147483648])
    await assert.rejects(new Item({id:999,name:'Test',type:'Sword',slot:'OneHand',itemLevel}).validate());
});

test('seed levels keep starters at 1 and equipment tiers at 10/20/30 independently of requirements', async () => {
  const data=await loadData('data');
  const byId=new Map(data.items.map(i=>[i.id,i]));
  for(let id=1;id<=9;id++) assert.equal(byId.get(id)?.itemLevel,1);
  for(const [id,level] of [[1001,10],[1101,20],[1201,30],[2001,10],[2101,20],[2201,30],[3001,10],[3101,20],[3201,30]])
    assert.equal(byId.get(id!)?.itemLevel,level);
  assert.ok(data.items.every(i=>[1,10,20,30].includes(i.itemLevel)));
  assert.equal(byId.get(1)?.requirements.level,1);
});
