export const skillLevelLabels = ['입문', '초급', '중급', '숙련', '고급'] as const;

export function skillLevelLabel(level: number | null): string {
  return level === null ? '정보 없음' : skillLevelLabels[level - 1];
}
