import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient } from '../src/api/client.ts';
import { createCharacterApi, layersFor } from '../src/api/character.ts';

const equipment = { OUTFIT: 'MINT', HAIR: 'BOB', GLASSES: 'ROUND' };
const state = {
  baseAssetId: 'EXT-IMG-06A', slot: 'OUTFIT', equippedItemId: 'MINT', equippedAssetId: 'EXT-IMG-06C',
  equipment, layerAssetIds: layersFor(equipment),
};
const ids = [
  ['OUTFIT', 'BASE', 'EXT-IMG-06G', 'EXT-IMG-06A', ['B09-LAYER-OUTFIT-BASE']],
  ['OUTFIT', 'MINT', 'EXT-IMG-06E', 'EXT-IMG-06C', ['B09-LAYER-OUTFIT-MINT']],
  ['OUTFIT', 'PEACH', 'EXT-IMG-06F', 'EXT-IMG-06D', ['B09-LAYER-OUTFIT-PEACH']],
  ...['CLASSIC', 'BOB', 'PONY'].map(id => ['HAIR', id, `B09-THUMB-HAIR-${id}`, `B09-LAYER-HAIR-${id}-FRONT`,
    [`B09-LAYER-HAIR-${id}-BACK`, `B09-LAYER-HAIR-${id}-FRONT`]]),
  ['GLASSES', 'NONE', 'B09-THUMB-GLASSES-NONE', null, []],
  ...['ROUND', 'SQUARE'].map(id => ['GLASSES', id, `B09-THUMB-GLASSES-${id}`, `B09-LAYER-GLASSES-${id}`,
    [`B09-LAYER-GLASSES-${id}`]]),
];
const items = ids.map(([slot, id, thumbnailAssetId, assetId, layerAssetIds]) => ({
  slot, id, name: id, thumbnailAssetId, assetId, layerAssetIds,
  available: id !== 'PEACH', availabilityCondition: id === 'PEACH' ? 'FUTURE_REWARD' : 'ALWAYS',
}));
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('layer order puts back hair behind body, outfit below front hair and glasses last', () => {
  assert.deepEqual(layersFor(equipment), [
    'B09-LAYER-HAIR-BOB-BACK', 'B09-LAYER-BODY', 'B09-LAYER-OUTFIT-MINT',
    'B09-LAYER-HAIR-BOB-FRONT', 'B09-LAYER-GLASSES-ROUND',
  ]);
  assert.equal(layersFor({ ...equipment, GLASSES: 'NONE' }).length, 4);
});

test('catalog, state and slot PUT use session and fresh CSRF', async () => {
  const api = createCharacterApi(createApiClient('/api', async (url, options) => {
    assert.equal(options.credentials, 'same-origin');
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    if (url === '/api/character/items') return json(items);
    if (url === '/api/me/character' && options.method === 'GET') return json(state);
    assert.equal(url, '/api/me/character/equipment/HAIR');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-CSRF-TOKEN'], 'fresh');
    assert.deepEqual(JSON.parse(options.body), { itemId: 'PONY' });
    const changed = { ...equipment, HAIR: 'PONY' };
    return json({ ...state, equipment: changed, layerAssetIds: layersFor(changed) });
  }));
  assert.equal((await api.items()).length, 9);
  assert.deepEqual((await api.state()).equipment, equipment);
  assert.equal((await api.equip('HAIR', 'PONY')).equipment.HAIR, 'PONY');
});

test('rejects malformed or mismatched layer states and wrong item slots', async () => {
  const api = createCharacterApi(async () => ({ ...state, layerAssetIds: [...state.layerAssetIds].reverse() }));
  await assert.rejects(api.state(), { code: 'INVALID_RESPONSE' });
  await assert.rejects(api.equip('GLASSES', 'BOB'), TypeError);
  const wrongCatalog = createCharacterApi(async () => [{ ...items[0], thumbnailAssetId: 'UNKNOWN' }]);
  await assert.rejects(wrongCatalog.items(), { code: 'INVALID_RESPONSE' });
});
