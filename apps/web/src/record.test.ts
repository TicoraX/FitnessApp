import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esRecord } from './record.ts';

test('más kilos es récord', () => {
  assert.equal(esRecord({ reps: 8, weight_kg: 60 }, { reps: 5, weight_kg: 62.5 }), true);
});

test('menos kilos no lo es, por más repeticiones que hagas', () => {
  assert.equal(esRecord({ reps: 8, weight_kg: 60 }, { reps: 20, weight_kg: 50 }), false);
});

test('a igualdad de kilos manda las repeticiones', () => {
  assert.equal(esRecord({ reps: 8, weight_kg: 60 }, { reps: 9, weight_kg: 60 }), true);
  assert.equal(esRecord({ reps: 8, weight_kg: 60 }, { reps: 8, weight_kg: 60 }), false);
});

test('sin peso agregado compara repeticiones', () => {
  assert.equal(esRecord({ reps: 12, weight_kg: null }, { reps: 13, weight_kg: null }), true);
  assert.equal(esRecord({ reps: 12, weight_kg: null }, { reps: 11, weight_kg: null }), false);
});

test('la primera vez no es un récord', () => {
  assert.equal(esRecord(null, { reps: 10, weight_kg: 100 }), false);
  assert.equal(esRecord(undefined, { reps: 10, weight_kg: 100 }), false);
});
