import type { Todo, TodoInput } from '../../api/todos.ts';

export const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
const two = (value: number) => String(value).padStart(2, '0');
export function dueLabel(todo: Todo) {
  if (!todo.dueAt || !todo.dueTimeZone) return '기한 없음';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: todo.dueTimeZone }).format(new Date(todo.dueAt));
}
export function localDueInput(value: string | null, zone = deviceZone) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function todoDday(dueAt: string | null, now = new Date(), zone = deviceZone) {
  if (!dueAt) return '기한 없음';
  const calendarDay = (value: string) => {
    const [year, month, day] = localDueInput(value, zone).slice(0, 10).split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const days = (calendarDay(dueAt) - calendarDay(now.toISOString())) / 86_400_000;
  return days > 0 ? `D-${days}` : days < 0 ? `D+${-days}` : 'D-Day';
}
export function dueFromLocal(value: string): Pick<TodoInput, 'dueAt' | 'dueTimeZone'> {
  if (!value) return { dueAt: null, dueTimeZone: null };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || localDueInput(date.toISOString()) !== value) throw new Error('기한 날짜와 시각을 확인해 주세요.');
  const minutes = -date.getTimezoneOffset();
  const offset = `${minutes < 0 ? '-' : '+'}${two(Math.floor(Math.abs(minutes) / 60))}:${two(Math.abs(minutes) % 60)}`;
  return { dueAt: `${value}:00${offset}`, dueTimeZone: deviceZone };
}
