import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type CharacterSlot = 'OUTFIT' | 'HAIR' | 'GLASSES';
export type CharacterEquipment = Record<CharacterSlot, string>;
export type CharacterItem = {
  id: string; slot: CharacterSlot; name: string; thumbnailAssetId: string;
  assetId: string | null; layerAssetIds: string[]; available: boolean;
  availabilityCondition: 'ALWAYS' | 'FUTURE_REWARD';
};
export type CharacterState = {
  baseAssetId: string; slot: 'OUTFIT'; equippedItemId: string; equippedAssetId: string;
  equipment: CharacterEquipment; layerAssetIds: string[]; progress: CharacterProgress;
};
export type CharacterProgress = { level: number; totalExp: number; levelExp: number; nextLevelExp: number };
export type CharacterActivity = { id: number; activityType: string; activityId: number; expAmount: number; earnedAt: string };
export type CharacterActivityPage = { items: CharacterActivity[]; page: number; size: number; totalElements: number };
export type CharacterQuest = { id: string; activityType: string; targetCount: number; progressCount: number; rewardItemId: string; completed: boolean; claimed: boolean; claimedAt: string | null };
export type CharacterClaim = { questId: string; itemId: string; claimedAt: string; progress: CharacterProgress };

export const completeOutfitIds = ['BUNNY', 'BEAR', 'HOMEBODY', 'INTERVIEW', 'RAINCOAT', 'ASTRONAUT'] as const;
export const isCompleteOutfit = (id: string): boolean => completeOutfitIds.some(value => value === id);

const ids: Record<CharacterSlot, readonly string[]> = {
  OUTFIT: ['BASE', 'MINT', 'PEACH', ...completeOutfitIds], HAIR: ['CLASSIC', 'BOB', 'PONY'], GLASSES: ['NONE', 'ROUND', 'SQUARE'],
};
const slots: CharacterSlot[] = ['OUTFIT', 'HAIR', 'GLASSES'];
const knownLayers = new Set([
  'B09-LAYER-BODY', ...ids.OUTFIT.map(id => `B09-LAYER-OUTFIT-${id}`),
  ...ids.HAIR.flatMap(id => [`B09-LAYER-HAIR-${id}-BACK`, `B09-LAYER-HAIR-${id}-FRONT`]),
  'B09-LAYER-GLASSES-ROUND', 'B09-LAYER-GLASSES-SQUARE',
  ...completeOutfitIds.map(id => `B09-COMPLETE-${id}`),
]);
const knownThumbnails = new Set([
  'EXT-IMG-06G', 'EXT-IMG-06E', 'EXT-IMG-06F',
  ...completeOutfitIds.map(id => `B09-THUMB-OUTFIT-${id}`),
  ...ids.HAIR.map(id => `B09-THUMB-HAIR-${id}`),
  ...ids.GLASSES.map(id => `B09-THUMB-GLASSES-${id}`),
]);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const slot = (value: unknown): value is CharacterSlot => slots.includes(value as CharacterSlot);
const validEquipment = (value: unknown): value is CharacterEquipment => object(value)
  && slots.every(key => typeof value[key] === 'string' && ids[key].includes(value[key] as string));
export function layersFor(equipment: CharacterEquipment): string[] {
  if (isCompleteOutfit(equipment.OUTFIT)) return [`B09-COMPLETE-${equipment.OUTFIT}`];
  const hair = equipment.HAIR, glasses = equipment.GLASSES;
  return [`B09-LAYER-HAIR-${hair}-BACK`, 'B09-LAYER-BODY', `B09-LAYER-OUTFIT-${equipment.OUTFIT}`,
    `B09-LAYER-HAIR-${hair}-FRONT`, ...(glasses === 'NONE' ? [] : [`B09-LAYER-GLASSES-${glasses}`])];
}
const invalid = (): never => { throw new ApiError('캐릭터 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); };
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const isCharacterProgress = (value: unknown): value is CharacterProgress => object(value)
  && nonnegative(value.level) && value.level >= 1 && nonnegative(value.totalExp)
  && nonnegative(value.levelExp) && nonnegative(value.nextLevelExp) && value.nextLevelExp > 0
  && value.levelExp < value.nextLevelExp;
export function isCharacterState(value: unknown): value is CharacterState {
  if (!object(value) || !validEquipment(value.equipment) || !isCharacterProgress(value.progress) || !Array.isArray(value.layerAssetIds)
    || !value.layerAssetIds.every(id => typeof id === 'string' && knownLayers.has(id))) return false;
  const actual = value.layerAssetIds as string[];
  const expected = layersFor(value.equipment);
  return value.baseAssetId === 'EXT-IMG-06A' && value.slot === 'OUTFIT'
    && value.equippedItemId === value.equipment.OUTFIT
    && value.equippedAssetId === ({ BASE: 'EXT-IMG-06A', MINT: 'EXT-IMG-06C', PEACH: 'EXT-IMG-06D',
      ...Object.fromEntries(completeOutfitIds.map(id => [id, `B09-COMPLETE-${id}`])) } as Record<string, string>)[value.equipment.OUTFIT]
    && expected.length === actual.length
    && expected.every((id, index) => id === actual[index]);
}
export function isCharacterItem(value: unknown): value is CharacterItem {
  if (!object(value) || !slot(value.slot) || typeof value.id !== 'string' || !ids[value.slot].includes(value.id)
    || typeof value.name !== 'string' || !value.name.trim()
    || typeof value.thumbnailAssetId !== 'string' || !knownThumbnails.has(value.thumbnailAssetId)
    || !Array.isArray(value.layerAssetIds) || !value.layerAssetIds.every(id => typeof id === 'string' && knownLayers.has(id))
    || typeof value.available !== 'boolean'
    || (value.availabilityCondition !== 'ALWAYS' && value.availabilityCondition !== 'FUTURE_REWARD')) return false;
  if (value.slot === 'OUTFIT') return typeof value.assetId === 'string';
  return value.assetId === null || typeof value.assetId === 'string';
}
export function createCharacterApi(request: ReturnType<typeof createApiClient>) {
  const csrf = async (): Promise<string> => {
    const value = await request('/auth/csrf');
    if (!object(value) || value.headerName !== 'X-CSRF-TOKEN' || typeof value.token !== 'string' || !value.token) return invalid();
    return value.token;
  };
  return {
    state: async (signal?: AbortSignal): Promise<CharacterState> => {
      const value = await request('/me/character', { signal });
      return isCharacterState(value) ? value : invalid();
    },
    items: async (signal?: AbortSignal): Promise<CharacterItem[]> => {
      const value = await request('/character/items', { signal });
      if (!Array.isArray(value) || !value.every(isCharacterItem)
        || new Set(value.map(item => `${item.slot}:${item.id}`)).size !== value.length
        || slots.some(key => value.filter(item => item.slot === key).length < 3)) return invalid();
      return value;
    },
    equip: async (slotValue: CharacterSlot, itemId: string | null): Promise<CharacterState> => {
      if (!slot(slotValue) || (itemId !== null && !ids[slotValue].includes(itemId))) throw new TypeError('캐릭터 항목을 확인해 주세요.');
      const value = await request(`/me/character/equipment/${slotValue}`,
        { method: 'PUT', body: { itemId }, csrfToken: await csrf() });
      return isCharacterState(value) ? value : invalid();
    },
    activity: async (page = 0, signal?: AbortSignal): Promise<CharacterActivityPage> => {
      const value = await request('/me/character/activity', { query: { page, size: 20 }, signal });
      if (!object(value) || !Array.isArray(value.items) || !nonnegative(value.page) || !nonnegative(value.size)
        || !nonnegative(value.totalElements) || !value.items.every((item: unknown) => object(item)
          && nonnegative(item.id) && typeof item.activityType === 'string' && nonnegative(item.activityId)
          && nonnegative(item.expAmount) && typeof item.earnedAt === 'string')) return invalid();
      return value as CharacterActivityPage;
    },
    quests: async (signal?: AbortSignal): Promise<CharacterQuest[]> => {
      const value = await request('/me/character/quests', { signal });
      if (!Array.isArray(value) || !value.every((quest: unknown) => object(quest)
        && typeof quest.id === 'string' && typeof quest.activityType === 'string'
        && nonnegative(quest.targetCount) && nonnegative(quest.progressCount)
        && typeof quest.rewardItemId === 'string' && typeof quest.completed === 'boolean'
        && typeof quest.claimed === 'boolean' && (quest.claimedAt === null || typeof quest.claimedAt === 'string'))) return invalid();
      return value;
    },
    claim: async (questId: string): Promise<CharacterClaim> => {
      if (!/^TODO_(1|3|5|10|20|30)$/.test(questId)) throw new TypeError('퀘스트를 확인해 주세요.');
      const value = await request(`/me/character/quests/${questId}/claim`, { method: 'POST', csrfToken: await csrf() });
      if (!object(value) || value.questId !== questId || typeof value.itemId !== 'string'
        || typeof value.claimedAt !== 'string' || !isCharacterProgress(value.progress)) return invalid();
      return value as CharacterClaim;
    },
  };
}
