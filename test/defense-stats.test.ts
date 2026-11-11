import test from 'node:test';
import assert from 'node:assert/strict';
import { statsSchema } from '../src/shared/schemas.js';
import { readStats } from '../src/shared/statFields.js';

test('spell increase reads legacy values without overriding an explicit new zero', () => {
  assert.equal(readStats({ spellDamage: 25 }).spellDamageInc, 25);
  assert.equal(readStats({ spellDamage: 25, spellDamageInc: 0 }).spellDamageInc, 0);
  assert.equal(Object.hasOwn(readStats({ spellDamage: 25 }), 'spellDamage'), false);
  assert.ok(statsSchema.path('spellDamageInc'));
  assert.equal(statsSchema.path('spellDamage'), undefined);
});

test('reserved defense increases default to zero and preserve authored values', () => {
  const fields = ['armorInc', 'evasionInc', 'magicEvasionInc', 'magicResistInc',
    'fireResInc', 'coldResInc', 'lightningResInc', 'chaosResInc', 'spellDamageFlat'] as const;
  for (const field of fields) {
    assert.ok(statsSchema.path(field));
    assert.equal(readStats({})[field], 0);
    assert.equal(readStats({ [field]: 17 })[field], 17);
  }
  for (const field of ['quantity', 'rarity', 'exp', 'gold']) {
    assert.equal(statsSchema.path(field), undefined);
    assert.equal(Object.hasOwn(readStats({ [field]: 100 }), field), false);
  }
});
