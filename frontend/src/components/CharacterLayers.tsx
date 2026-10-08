import { completeOutfitIds, isCompleteOutfit } from '../api/character';
import type { CharacterEquipment } from '../api/character';

const files = import.meta.glob('../assets/character/{character-*,thumb-*,ext-img-*}.png',
  { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const assetNames: Record<string, string> = {
  'EXT-IMG-06G': 'ext-img-06g-outfit-base.png',
  'EXT-IMG-06E': 'ext-img-06e-outfit-mint.png',
  'EXT-IMG-06F': 'ext-img-06f-outfit-peach.png',
};
for (const id of completeOutfitIds) {
  assetNames[`B09-THUMB-OUTFIT-${id}`] = `thumb-outfit-${id.toLowerCase()}.png`;
}
for (const hair of ['CLASSIC', 'BOB', 'PONY']) {
  assetNames[`B09-THUMB-HAIR-${hair}`] = `thumb-hair-${hair.toLowerCase()}.png`;
}
for (const glasses of ['ROUND', 'SQUARE']) {
  assetNames[`B09-THUMB-GLASSES-${glasses}`] = `thumb-glasses-${glasses.toLowerCase()}.png`;
}
assetNames['B09-THUMB-GLASSES-NONE'] = 'thumb-glasses-none.png';

export function characterAssetUrl(id: string): string | undefined {
  const name = assetNames[id];
  return name ? files[`../assets/character/${name}`] : undefined;
}

export function characterAppearanceUrl(equipment: CharacterEquipment): string | undefined {
  const name = isCompleteOutfit(equipment.OUTFIT) ? `character-${equipment.OUTFIT.toLowerCase()}.png`
    : `character-${equipment.OUTFIT.toLowerCase()}-${equipment.HAIR.toLowerCase()}-${equipment.GLASSES.toLowerCase()}.png`;
  return files[`../assets/character/${name}`];
}

export function CharacterAppearance({ equipment, label }: { equipment: CharacterEquipment; label: string }) {
  const url = characterAppearanceUrl(equipment);
  return <div className="character-layers" role="img" aria-label={label}>
    {url && <img src={url} alt="" aria-hidden="true" draggable={false} />}
  </div>;
}
