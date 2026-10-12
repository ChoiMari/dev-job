import briefcase from '../../assets/redesign/todo-category-briefcase.png';
import document from '../../assets/redesign/todo-category-document.png';
import study from '../../assets/redesign/todo-category-study.png';
import growth from '../../assets/redesign/todo-category-growth.png';
import graduation from '../../assets/redesign/todo-category-graduation.png';
import health from '../../assets/redesign/todo-category-health.png';
import travel from '../../assets/redesign/todo-category-travel.png';
import dumbbell from '../../assets/redesign/todo-category-dumbbell.png';
import coffee from '../../assets/redesign/todo-category-coffee.png';
import sun from '../../assets/redesign/todo-category-sun.png';
import home from '../../assets/redesign/todo-category-home.png';
import people from '../../assets/redesign/todo-category-people.png';
import gamepad from '../../assets/redesign/todo-category-gamepad.png';
import music from '../../assets/redesign/todo-category-music.png';
import calendar from '../../assets/redesign/todo-category-calendar.png';
import lightbulb from '../../assets/redesign/todo-category-lightbulb.png';
import star from '../../assets/redesign/todo-category-star.png';
import flag from '../../assets/redesign/todo-category-flag.png';
import laptop from '../../assets/redesign/todo-category-laptop.png';
import leaf from '../../assets/redesign/todo-category-leaf.png';
import gift from '../../assets/redesign/todo-category-gift.png';
import trophy from '../../assets/redesign/todo-category-trophy.png';
import mail from '../../assets/redesign/todo-category-mail.png';
import camera from '../../assets/redesign/todo-category-camera.png';
import target from '../../assets/redesign/todo-category-target.png';
import puzzle from '../../assets/redesign/todo-category-puzzle.png';
import pencil from '../../assets/redesign/todo-category-pencil.png';
import clock from '../../assets/redesign/todo-category-clock.png';

export const categoryIconChoices = [
  { key: 'briefcase', label: '직장' }, { key: 'document', label: '서류' },
  { key: 'study', label: '공부' }, { key: 'growth', label: '자기계발' },
  { key: 'graduation', label: '학습' }, { key: 'health', label: '건강' },
  { key: 'travel', label: '여행' }, { key: 'dumbbell', label: '운동' },
  { key: 'coffee', label: '휴식' }, { key: 'sun', label: '날씨' },
  { key: 'home', label: '일상' }, { key: 'people', label: '모임' },
  { key: 'gamepad', label: '취미' }, { key: 'music', label: '음악' },
  { key: 'calendar', label: '달력' }, { key: 'lightbulb', label: '아이디어' },
  { key: 'star', label: '목표' }, { key: 'flag', label: '계획' },
  { key: 'laptop', label: '컴퓨터' }, { key: 'leaf', label: '환경' },
  { key: 'gift', label: '선물' }, { key: 'trophy', label: '성과' },
  { key: 'mail', label: '메일' }, { key: 'camera', label: '사진' },
  { key: 'target', label: '집중' }, { key: 'puzzle', label: '기타' },
  { key: 'pencil', label: '작성' }, { key: 'clock', label: '시간' },
] as const;
export type CategoryIconKey = typeof categoryIconChoices[number]['key'] | 'interview' | 'other';

const builtInIcons: Record<string, CategoryIconKey> = {
  서류: 'document', 면접: 'interview', 공부: 'study', 자기계발: 'growth', 기타: 'other',
};
const images: Record<string, string> = {
  briefcase, document, study, growth, graduation, health, travel,
  dumbbell, coffee, sun, home, people, gamepad, music, calendar,
  lightbulb, star, flag, laptop, leaf, gift, trophy, mail, camera,
  target, puzzle, pencil, clock,
};
// Each generated PNG has different transparent padding. Bounds are measured from visible pixels.
const bounds: Record<string, readonly [number, number, number, number, number, number]> = {
  briefcase: [1254, 1254, 275, 332, 979, 924],
  document: [1254, 1254, 321, 270, 933, 1011],
  study: [1254, 1254, 264, 380, 990, 874],
  growth: [1254, 1254, 263, 315, 991, 996],
  graduation: [1254, 1254, 446, 489, 812, 776],
  health: [1254, 1254, 444, 500, 810, 811],
  travel: [1254, 1254, 425, 445, 846, 845],
  dumbbell: [1254, 1254, 384, 507, 870, 760],
  coffee: [1254, 1254, 472, 427, 850, 852],
  sun: [1254, 1254, 396, 395, 859, 856],
  home: [1287, 1222, 474, 459, 813, 762],
  people: [1374, 1145, 446, 410, 929, 768],
  gamepad: [1254, 1254, 363, 480, 891, 806],
  music: [1254, 1254, 454, 470, 800, 816],
  calendar: [1254, 1254, 455, 467, 800, 817],
  lightbulb: [1254, 1254, 473, 444, 781, 835],
  star: [1254, 1254, 467, 474, 787, 780],
  flag: [1254, 1254, 485, 482, 770, 790],
  laptop: [1254, 1254, 423, 486, 831, 792],
  leaf: [1254, 1254, 486, 483, 785, 797],
  gift: [1254, 1254, 435, 473, 819, 818],
  trophy: [1262, 1246, 386, 411, 877, 858],
  mail: [1330, 1182, 499, 472, 831, 716],
  camera: [1261, 1247, 435, 466, 826, 787],
  target: [1278, 1230, 485, 464, 823, 800],
  puzzle: [1381, 1139, 524, 339, 955, 850],
  pencil: [1292, 1217, 452, 409, 871, 826],
  clock: [1273, 1236, 463, 442, 809, 789],
};

export function CategoryImage({ name, iconKey, size = 20 }: { name?: string; iconKey?: string; size?: number }) {
  const requested = iconKey ?? builtInIcons[name ?? ''] ?? 'other';
  const key = requested === 'interview' ? 'people' : requested === 'other' ? 'puzzle' : requested;
  const [width, height, left, top, right, bottom] = bounds[key] ?? bounds.puzzle;
  const scale = size * .78 / Math.max(right - left, bottom - top);
  return <span className="todo-category-image" aria-hidden="true" style={{ width: size, height: size }}>
    <img src={images[key] ?? puzzle} alt="" style={{
      width: width * scale, height: height * scale,
      left: size / 2 - (left + right) / 2 * scale,
      top: size / 2 - (top + bottom) / 2 * scale,
    }} />
  </span>;
}
