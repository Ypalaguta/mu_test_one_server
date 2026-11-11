import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadData } from '../src/seed/data.js';
import { createOperations } from '../src/seed/operations.js';

test('item-only seed includes starter gear without writing characters or other catalogues', async () => {
  const data = await loadData(resolve('data'));
  const operations = createOperations(data, 'items');
  assert.equal(data.items.length, 262);
  const gold = data.items.find(item => item.id === 900000)!;
  assert.equal(gold.type, 'Currency');
  assert.equal(gold.maxStack, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(gold.tradeRestrictions, []);
  assert.equal(operations.length, data.items.length);
  assert.ok(operations.every(op => op.collection === 'items' && op.update.$set));
  for (const id of [4, 5, 6, 7, 8, 9]) {
    const item = data.items.find(row => row.id === id)!;
    assert.ok(item);
    assert.equal(item.iconName, `Item_${id}`);
    assert.equal(item.maxStack, 1);
    assert.equal(item.inventoryTab, 'Equipment');
    assert.equal(item.requirements.level, 1);
  }
  assert.equal(data.items.find(row => row.id === 3)?.name, 'Cloth Armor');
});
