export const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
const two = (value: number) => String(value).padStart(2, '0');

export function zonedLocalInput(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function scheduleFromLocal(value: string): { startsAt: string; timeZone: string } {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('면접 날짜와 시각을 확인해 주세요.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || zonedLocalInput(date.toISOString(), deviceTimeZone) !== value)
    throw new Error('현재 시간대에 존재하지 않는 면접 시각입니다.');
  const minutes = -date.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const offset = `${sign}${two(Math.floor(Math.abs(minutes) / 60))}:${two(Math.abs(minutes) % 60)}`;
  return { startsAt: `${value}:00${offset}`, timeZone: deviceTimeZone };
}

export function scheduleLabel(value: string, timeZone: string): string {
  return `${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value))} · ${timeZone}`;
}
