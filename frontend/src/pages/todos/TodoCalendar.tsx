import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { createTodosApi } from '../../api/todos';
import type { Todo } from '../../api/todos';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { PixelIcon } from '../../components/PixelArt';
import todoArt from '../../assets/redesign/cur-24-todo-checklist-companion.png';
import { deviceZone, localDueInput } from './todoTime';

const todos = createTodosApi(apiRequest);
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
type CalendarFilter = 'all' | 'today' | 'week' | 'late' | 'done';
type CalendarView = 'month' | 'week';
const filterTitles: Record<Exclude<CalendarFilter, 'all'>, string> = { today: '오늘 할 일', week: '이번 주 할 일', late: '지연된 할 일', done: '완료한 할 일' };
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dueKey = (todo: Todo) => todo.dueAt ? localDueInput(todo.dueAt, deviceZone).slice(0, 10) : null;
const dueTime = (todo: Todo) => todo.dueAt ? localDueInput(todo.dueAt, deviceZone).slice(11, 16) : '';
const weekStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
const dateFromKey = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));

export function TodoCalendar() {
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number>();
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => keyOf(new Date()));
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    async function load() {
      const loaded: Todo[] = [];
      for (let page = 0; ; page += 1) {
        const result = await todos.list(page, 'all', controller.signal, 100);
        loaded.push(...result.items);
        if (result.items.length === 0 || (page + 1) * result.size >= result.totalElements) break;
      }
      if (!controller.signal.aborted) setItems([...new Map(loaded.map(todo => [todo.id, todo])).values()]);
    }
    void load().catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '할 일을 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  const today = keyOf(new Date());
  const thisWeekStart = keyOf(weekStart(new Date()));
  const thisWeekEnd = keyOf(new Date(dateFromKey(thisWeekStart).getFullYear(), dateFromKey(thisWeekStart).getMonth(), dateFromKey(thisWeekStart).getDate() + 6));
  const searched = useMemo(() => items.filter(todo => `${todo.title} ${todo.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [items, query]);
  const isLate = (todo: Todo) => !todo.completed && !!todo.dueAt && new Date(todo.dueAt).getTime() < Date.now();
  const matches = (todo: Todo, active: CalendarFilter) => active === 'all' || (active === 'done' ? todo.completed
    : active === 'late' ? isLate(todo) : (active === 'today' ? dueKey(todo) === today
      : !!dueKey(todo) && dueKey(todo)! >= thisWeekStart && dueKey(todo)! <= thisWeekEnd));
  const visible = searched.filter(todo => matches(todo, filter));
  const counts: Record<CalendarFilter, number> = {
    all: searched.length, today: searched.filter(todo => matches(todo, 'today')).length,
    week: searched.filter(todo => matches(todo, 'week')).length,
    late: searched.filter(todo => matches(todo, 'late')).length,
    done: searched.filter(todo => matches(todo, 'done')).length,
  };
  const first = view === 'month' ? weekStart(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) : weekStart(anchor);
  const days = view === 'month' ? Math.ceil((new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay() + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7) * 7 : 7;
  const cells = Array.from({ length: days }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
  const dated = new Map<string, Todo[]>();
  for (const todo of visible) {
    const key = dueKey(todo);
    if (key) dated.set(key, [...(dated.get(key) ?? []), todo]);
  }
  const selectedTodos = dated.get(selected) ?? [];
  const undated = visible.filter(todo => !todo.dueAt);
  const selectedDate = dateFromKey(selected);

  function move(direction: number) {
    const next = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)
      : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * direction);
    setAnchor(next); setSelected(keyOf(next));
  }
  function selectFilter(value: CalendarFilter) {
    setFilter(value);
    if (value === 'today' || value === 'week') { setAnchor(new Date()); setSelected(today); }
  }
  async function toggle(todo: Todo) {
    if (pending.current) return;
    pending.current = true; setBusyId(todo.id); setActionError('');
    try {
      const updated = await todos.complete(todo.id, !todo.completed);
      setItems(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : '완료 상태를 변경하지 못했습니다.'); }
    finally { pending.current = false; setBusyId(undefined); }
  }

  return <div className="todos-page todos-calendar-page">
    <section className="card todos-intro todos-calendar-intro"><img src={todoArt} alt="" aria-hidden="true" />
      <div className="todos-calendar-intro-copy"><h2><PixelIcon name="calendar" /> 할 일 관리</h2>
        <p>오늘도 목표에 조금 더 가까워져요.<br />작은 할 일을 하나씩 체크해 보세요.</p></div>
      <a className="button-link button-primary todos-calendar-intro-add" href="#/todos/new">+ 할 일 추가</a></section>
    <section className="card todos-calendar-card" aria-label={filter === 'all' ? '할 일 달력' : '할 일 목록'}>
      <div className="todos-calendar-toolbar"><div className="todos-calendar-filters" role="group" aria-label="할 일 필터">
        {([['all', '전체'], ['today', '오늘'], ['week', '이번 주'], ['late', '지연'], ['done', '완료']] as const).map(([value, label]) =>
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => selectFilter(value)}>{label} {!loading && !error && <span>{counts[value]}</span>}</button>)}
      </div><label className="todos-calendar-search"><span className="sr-only">할 일 검색</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="제목 또는 내용 검색" /></label></div>
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
      {loading ? <LoadingState message="할 일을 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : <>
        {filter === 'all' ? <div className="todos-calendar-layout"><div className="todos-calendar-main">
          <div className="todos-calendar-navigation"><div className="todos-calendar-title"><h3>{view === 'month' ? `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월` : `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일 주간`}</h3><span>기기 시간대 · {deviceZone}</span></div>
            <div className="todos-calendar-controls"><button type="button" onClick={() => move(-1)} aria-label={view === 'month' ? '이전 달' : '이전 주'}>‹</button>
              <button type="button" onClick={() => { setAnchor(new Date()); setSelected(today); }}>오늘</button>
              <button type="button" onClick={() => move(1)} aria-label={view === 'month' ? '다음 달' : '다음 주'}>›</button>
              <div className="todos-view-switch" role="group" aria-label="달력 보기"><button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>주</button><button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>월</button></div></div></div>
          <div className="todos-calendar-grid">{weekdays.map(day => <div key={day} className="todos-calendar-weekday">{day}</div>)}
            {cells.map(date => { const key = keyOf(date); const dayTodos = dated.get(key) ?? []; const shown = dayTodos.slice(0, view === 'week' ? 5 : 3);
              return <div key={key} className={`todos-calendar-day${date.getMonth() !== anchor.getMonth() && view === 'month' ? ' is-outside' : ''}${key === today ? ' is-today' : ''}${key === selected ? ' is-selected' : ''}`}>
                <button type="button" className="todos-day-number" aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 선택`} aria-pressed={key === selected} onClick={() => setSelected(key)}>{date.getDate()}</button>
                <div className="todos-day-items">{shown.map(todo => <a key={todo.id} href={`#/todos/${todo.id}`} className={`todos-day-item${todo.completed ? ' is-done' : isLate(todo) ? ' is-late' : ''}`} title={todo.title}><span>{todo.title}</span><small>{dueTime(todo)}</small></a>)}</div>
                {dayTodos.length > shown.length && <button type="button" className="todos-day-more" onClick={() => setSelected(key)}>+{dayTodos.length - shown.length}개 더 보기</button>}
              </div>;
            })}</div>
        </div><aside className="todos-calendar-aside"><div className="todos-side-panel"><div className="todos-side-heading"><h3>{selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 할 일</h3><span>{selectedTodos.length}건</span></div>
          {selectedTodos.length ? <ul className="todos-side-list">{selectedTodos.map(todo => <li key={todo.id} className={todo.completed ? 'is-done' : ''}><input type="checkbox" aria-label={`${todo.title} 완료`} checked={todo.completed} disabled={busyId !== undefined} onChange={() => void toggle(todo)} /><div><a href={`#/todos/${todo.id}`}>{todo.title}</a><small>{dueTime(todo)}{todo.completed ? ' · 완료' : ''}</small></div></li>)}</ul>
            : <p className="todos-side-empty">이 날짜에 표시할 할 일이 없습니다.</p>}</div>
          <div className="todos-side-panel"><div className="todos-side-heading"><h3>기한 없는 할 일</h3><span>{undated.length}건</span></div>
            {undated.length ? <ul className="todos-side-list">{undated.map(todo => <li key={todo.id} className={todo.completed ? 'is-done' : ''}><input type="checkbox" aria-label={`${todo.title} 완료`} checked={todo.completed} disabled={busyId !== undefined} onChange={() => void toggle(todo)} /><div><a href={`#/todos/${todo.id}`}>{todo.title}</a><small>{todo.completed ? '완료' : '기한 없음'}</small></div></li>)}</ul>
              : <p className="todos-side-empty">기한 없는 할 일이 없습니다.</p>}</div></aside></div>
          : <div className="todos-filter-list"><div className="todos-filter-list-heading"><h3>{filterTitles[filter]}</h3><span>{visible.length}건</span></div>
            {visible.length ? <ul>{visible.map(todo => <li key={todo.id} className={todo.completed ? 'is-done' : ''}>
              <input type="checkbox" aria-label={`${todo.title} 완료`} checked={todo.completed} disabled={busyId !== undefined} onChange={() => void toggle(todo)} />
              <div className="todos-filter-list-main"><a href={`#/todos/${todo.id}`}>{todo.title}</a>{todo.description && <p>{todo.description}</p>}</div>
              <span className="todos-filter-list-due">{todo.dueAt ? `${dueKey(todo)} ${dueTime(todo)}` : '기한 없음'}</span>
              <span className={`todos-filter-list-status${todo.completed ? ' is-done' : isLate(todo) ? ' is-late' : ''}`}>{todo.completed ? '완료' : isLate(todo) ? '지연' : '진행 중'}</span>
            </li>)}</ul> : <EmptyState title={`${filterTitles[filter]}이 없습니다.`} message="다른 조건을 선택하거나 할 일을 등록해 주세요." />}</div>}
        {filter === 'all' && !items.length && <EmptyState title="등록한 할 일이 없습니다." message="할 일을 등록하면 달력에 표시됩니다." />}
      </>}
    </section>
  </div>;
}
