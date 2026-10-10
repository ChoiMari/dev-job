import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient } from '../src/api/client.ts';
import { createCharacterApi, layersFor } from '../src/api/character.ts';

const equipment = { OUTFIT: 'MINT', HAIR: 'BOB', GLASSES: 'ROUND' };
const state = {
  baseAssetId: 'EXT-IMG-06A', slot: 'OUTFIT', equippedItemId: 'MINT', equippedAssetId: 'EXT-IMG-06C',
  equipment, layerAssetIds: layersFor(equipment), progress: { level: 2, totalExp: 110, levelExp: 10, nextLevelExp: 150 },
};
const ids = [
  ['OUTFIT', 'BASE', 'EXT-IMG-06G', 'EXT-IMG-06A', ['B09-LAYER-OUTFIT-BASE']],
  ['OUTFIT', 'MINT', 'EXT-IMG-06E', 'EXT-IMG-06C', ['B09-LAYER-OUTFIT-MINT']],
  ['OUTFIT', 'PEACH', 'EXT-IMG-06F', 'EXT-IMG-06D', ['B09-LAYER-OUTFIT-PEACH']],
  ['OUTFIT', 'BUNNY', 'B09-THUMB-OUTFIT-BUNNY', 'B09-COMPLETE-BUNNY', ['B09-COMPLETE-BUNNY']],
  ...['BEAR', 'HOMEBODY', 'INTERVIEW', 'RAINCOAT', 'ASTRONAUT'].map(id =>
    ['OUTFIT', id, `B09-THUMB-OUTFIT-${id}`, `B09-COMPLETE-${id}`, [`B09-COMPLETE-${id}`]]),
  ...['CLASSIC', 'BOB', 'PONY'].map(id => ['HAIR', id, `B09-THUMB-HAIR-${id}`, `B09-LAYER-HAIR-${id}-FRONT`,
    [`B09-LAYER-HAIR-${id}-BACK`, `B09-LAYER-HAIR-${id}-FRONT`]]),
  ['GLASSES', 'NONE', 'B09-THUMB-GLASSES-NONE', null, []],
  ...['ROUND', 'SQUARE'].map(id => ['GLASSES', id, `B09-THUMB-GLASSES-${id}`, `B09-LAYER-GLASSES-${id}`,
    [`B09-LAYER-GLASSES-${id}`]]),
];
const items = ids.map(([slot, id, thumbnailAssetId, assetId, layerAssetIds]) => ({
  slot, id, name: id, thumbnailAssetId, assetId, layerAssetIds,
  available: !['PEACH', 'BEAR', 'HOMEBODY', 'INTERVIEW', 'RAINCOAT', 'ASTRONAUT'].includes(id),
  availabilityCondition: ['PEACH', 'BEAR', 'HOMEBODY', 'INTERVIEW', 'RAINCOAT', 'ASTRONAUT'].includes(id) ? 'FUTURE_REWARD' : 'ALWAYS',
}));
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('layer order puts back hair behind body, outfit below front hair and glasses last', () => {
  assert.deepEqual(layersFor(equipment), [
    'B09-LAYER-HAIR-BOB-BACK', 'B09-LAYER-BODY', 'B09-LAYER-OUTFIT-MINT',
    'B09-LAYER-HAIR-BOB-FRONT', 'B09-LAYER-GLASSES-ROUND',
  ]);
  assert.equal(layersFor({ ...equipment, GLASSES: 'NONE' }).length, 4);
  assert.deepEqual(layersFor({ ...equipment, OUTFIT: 'BUNNY' }), ['B09-COMPLETE-BUNNY']);
  assert.deepEqual(layersFor({ ...equipment, OUTFIT: 'BEAR' }), ['B09-COMPLETE-BEAR']);
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
  assert.equal((await api.items()).length, 15);
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

test('quest claim and activity follow server progress and do not submit EXP', async () => {
  const calls = [];
  const api = createCharacterApi(createApiClient('/api', async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fresh' });
    if (url.includes('/activity')) return json({ items: [{ id: 1, activityType: 'TODO_COMPLETED', activityId: 3, expAmount: 10, earnedAt: '2026-10-09T10:00:00Z' }], page: 0, size: 20, totalElements: 1 });
    if (url.includes('/quests/TODO_1/claim')) return json({ questId: 'TODO_1', itemId: 'PEACH', claimedAt: '2026-10-09T10:00:00Z', progress: state.progress });
    return json([{ id: 'TODO_1', activityType: 'TODO_COMPLETED', targetCount: 1, progressCount: 1, rewardItemId: 'PEACH', completed: true, claimed: false, claimedAt: null }]);
  }));
  assert.equal((await api.activity()).items[0].expAmount, 10);
  assert.equal((await api.quests())[0].completed, true);
  assert.equal((await api.claim('TODO_1')).itemId, 'PEACH');
  assert.equal(calls.at(-1).options.body, undefined);
  assert.equal(calls.at(-1).options.headers['X-CSRF-TOKEN'], 'fresh');
});
