import skyTheme from '../assets/illustrations/profile-banner-pixel-sky.png';
import flowerTheme from '../assets/illustrations/profile-banner-pixel-lavender.png';
import forestTheme from '../assets/illustrations/profile-banner-pixel-mint.png';
import nightTheme from '../assets/illustrations/character-theme-night.png';
import autumnTheme from '../assets/illustrations/character-theme-autumn.png';
import snowTheme from '../assets/illustrations/character-theme-snow.png';
import seaTheme from '../assets/illustrations/character-theme-sea.png';

export const characterThemes = [
  { id: 'sky', label: '하늘', image: skyTheme },
  { id: 'flowers', label: '꽃밭', image: flowerTheme },
  { id: 'forest', label: '숲', image: forestTheme },
  { id: 'night', label: '달빛 마을', image: nightTheme },
  { id: 'autumn', label: '가을 숲', image: autumnTheme },
  { id: 'snow', label: '눈 내린 마을', image: snowTheme },
  { id: 'sea', label: '바닷가', image: seaTheme },
] as const;
export type CharacterThemeId = (typeof characterThemes)[number]['id'];
export const characterThemeKey = (userId: number) => `devjob:character-theme:${userId}`;
export function savedCharacterTheme(userId: number): CharacterThemeId {
  try {
    const value = window.localStorage.getItem(characterThemeKey(userId));
    return characterThemes.find(theme => theme.id === value)?.id ?? 'forest';
  } catch { return 'forest'; }
}
export function characterThemeImage(id: CharacterThemeId): string {
  return characterThemes.find(theme => theme.id === id)?.image ?? forestTheme;
}
