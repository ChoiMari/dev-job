import assert from 'node:assert/strict';
import test from 'node:test';
import { skillLevelLabel, skillLevelLabels } from '../src/components/skillLevel.ts';

test('every numeric proficiency level has the agreed display label', () => {
  assert.deepEqual([...skillLevelLabels], ['입문', '초급', '중급', '숙련', '고급']);
  for (let level = 1; level <= 5; level++) assert.equal(skillLevelLabel(level), skillLevelLabels[level - 1]);
  assert.equal(skillLevelLabel(null), '정보 없음');
});
