import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { createTodosApi } from '../../api/todos';
import type { Todo, TodoCategory } from '../../api/todos';
import { ErrorState, LoadingState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import clipboardCheck from '../../assets/redesign/todo-clipboard-check.png';
import calendarIcon from '../../assets/redesign/todo-calendar-icon.png';
import checklistIcon from '../../assets/redesign/todo-checklist-icon.png';
import emptyCalendar from '../../assets/redesign/todo-empty-cat-calendar.png';
import { CategoryImage } from './todoIcons';
import { deviceZone, localDueInput } from './todoTime';

const todos = createTodosApi(apiRequest);
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
type CalendarView = 'month' | 'week' | 'day';
type StatusFilter = 'all' | 'open' | 'done';
type SortOrder = 'latest' | 'due';
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateFromKey = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const dueKey = (todo: Todo) => todo.dueAt ? localDueInput(todo.dueAt, deviceZone).slice(0, 10) : null;
const dueTime = (todo: Todo) => todo.dueAt ? localDueInput(todo.dueAt, deviceZone).slice(11, 16) : '';
const weekStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
export function TodoCalendar() {
  const [items, setItems] = useState<Todo[]>([]);
  const [customCategories, setCustomCategories] = useState<TodoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number>();
  const [menuTodoId, setMenuTodoId] = useState<number>();
  const [deleteTodoId, setDeleteTodoId] = useState<number>();
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOrder>('latest');
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
      try {
        const categories = await todos.categories(controller.signal);
        if (!controller.signal.aborted) setCustomCategories(categories);
      } catch { /* 기본 카테고리와 할 일에 저장된 태그는 계속 표시한다. */ }
    }
    void load().catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '할 일을 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  const today = keyOf(new Date());
  const selectedDate = dateFromKey(selected);
  const first = view === 'month' ? weekStart(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
    : view === 'week' ? weekStart(anchor) : selectedDate;
  const days = view === 'month' ? Math.ceil((new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay()
    + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7) * 7 : view === 'week' ? 7 : 1;
  const cells = Array.from({ length: days }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
  const dated = useMemo(() => {
    const result = new Map<string, Todo[]>();
    for (const todo of items) {
      const key = dueKey(todo);
      if (key) result.set(key, [...(result.get(key) ?? []), todo]);
    }
    return result;
  }, [items]);
  const selectedTodos = dated.get(selected) ?? [];
  const customNames = customCategories.map(item => item.name);
  const iconFor = (name: string) => customCategories.find(item => item.name === name)?.iconKey;
  const categoryClass = (name: string) => `todo-tone-${customCategories.find(item => item.name === name)?.colorKey ?? 'gray'}`;
  const categories = [...customNames.filter(name => items.some(item => item.category === name)),
    ...items.map(item => item.category).filter(name => !customNames.includes(name))]
    .filter((name, index, source) => source.indexOf(name) === index);
  useEffect(() => {
    if (category && !categories.includes(category)) setCategory(null);
  }, [category, categories]);
  const visibleCategories = categoriesExpanded ? categories : [
    ...categories.slice(0, 3), ...(category && !categories.slice(0, 3).includes(category) ? [category] : []),
  ];
  const filtered = items.filter(todo => (status === 'all' || (status === 'done') === todo.completed)
    && (category === null || todo.category === category)
    && `${todo.title} ${todo.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const ordered = [...filtered].sort((a, b) => sort === 'latest' ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
    : (a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER) - (b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER));
  const counts = { all: items.length, open: items.filter(todo => !todo.completed).length,
    done: items.filter(todo => todo.completed).length };

  function move(direction: number) {
    const next = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)
      : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + (view === 'week' ? 7 : 1) * direction);
    setAnchor(next); setSelected(keyOf(next));
  }
  async function toggle(todo: Todo) {
    if (pending.current) return;
    pending.current = true; setBusyId(todo.id); setActionError('');
    try { const updated = await todos.complete(todo.id, !todo.completed);
      setItems(current => current.map(item => item.id === updated.id ? updated : item)); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : '완료 상태를 변경하지 못했습니다.'); }
    finally { pending.current = false; setBusyId(undefined); }
  }
  async function deleteFromList(todo: Todo) {
    if (pending.current) return;
    pending.current = true; setBusyId(todo.id); setActionError('');
    try { await todos.remove(todo.id); setItems(current => current.filter(item => item.id !== todo.id)); setDeleteTodoId(undefined); setMenuTodoId(undefined); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : '할 일을 삭제하지 못했습니다.'); }
    finally { pending.current = false; setBusyId(undefined); }
  }
  const row = (todo: Todo, compact = false) => <li key={todo.id} className={`todos-task-row${todo.completed ? ' is-done' : ''}`}>
    <input type="checkbox" aria-label={`${todo.title} 완료`} checked={todo.completed} disabled={busyId !== undefined} onChange={() => void toggle(todo)} />
    <span className={`todos-task-category ${categoryClass(todo.category)}`}><CategoryImage name={todo.category} iconKey={iconFor(todo.category)} size={24} />{todo.category}</span>
    <div className="todos-task-copy"><a href={`#/todos/${todo.id}`}>{todo.title}</a>
      <small>{todo.dueAt ? compact ? dueTime(todo) : `${dueKey(todo)} ${dueTime(todo)}` : '기한 없음'}
        {todo.dueAt && todo.reminderMinutes !== -1 && <span className="todos-task-reminder" title="알림 설정됨" aria-label="알림 설정됨"><LucideIcon name="bell" /></span>}
      </small></div>
    <div className="todos-task-actions">
      <button className="todos-task-more" type="button" aria-label={`${todo.title} 메뉴`} aria-expanded={menuTodoId === todo.id} onClick={() => { setMenuTodoId(menuTodoId === todo.id ? undefined : todo.id); setDeleteTodoId(undefined); }}>⋯</button></div>
    {menuTodoId === todo.id && <div className="todos-task-menu">{deleteTodoId === todo.id ? <><span>삭제할까요?</span><button type="button" disabled={busyId !== undefined} onClick={() => void deleteFromList(todo)}>삭제 확인</button><button type="button" onClick={() => setDeleteTodoId(undefined)}>취소</button></>
      : <><a href={`#/todos/${todo.id}?edit=1`}><LucideIcon name="pencil" />수정</a><button type="button" onClick={() => setDeleteTodoId(todo.id)}><LucideIcon name="trash" />삭제</button></>}</div>}
  </li>;

  return <div className="todos-page todos-calendar-page">
    <header className="card todos-dashboard-header"><span className="todos-dashboard-icon"><img src={clipboardCheck} alt="" /></span>
      <div><h2>내 할 일</h2><p>취업 준비와 면접, 서류 마감 등 할 일을 관리하세요.</p></div>
      <a className="button-link button-primary" href="#/todos/new"><span aria-hidden="true">＋</span>할 일 추가</a></header>
    {actionError && <p role="alert" className="form-error">{actionError}</p>}
    {loading ? <LoadingState message="할 일을 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
      : <div className="todos-dashboard-grid">
        <section className="card todos-dashboard-calendar"><h3><img src={calendarIcon} alt="" /> 할 일 달력</h3>
          <div className="todos-calendar-controls"><div className="todos-calendar-period"><button className="todos-calendar-arrow" type="button" onClick={() => move(-1)} aria-label="이전 기간">‹</button>
              <strong>{anchor.getFullYear()}년 {anchor.getMonth() + 1}월</strong><button className="todos-calendar-arrow" type="button" onClick={() => move(1)} aria-label="다음 기간">›</button></div>
            <button type="button" onClick={() => { const now = new Date(); setAnchor(now); setSelected(keyOf(now)); }}>오늘</button>
            <div className="todos-view-switch" role="group" aria-label="달력 보기">{(['month', 'week', 'day'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{value === 'month' ? '월' : value === 'week' ? '주' : '일'}</button>)}</div></div>
          <div className={`todos-dashboard-calendar-grid is-${view}`}>{view !== 'day' && weekdays.map(day => <span key={day} className="todos-dashboard-weekday">{day}</span>)}
            {cells.map(date => { const key = keyOf(date); const dayItems = dated.get(key) ?? [];
              return <button type="button" key={key} className={`todos-dashboard-day${key === selected ? ' is-selected' : ''}${key === today ? ' is-today' : ''}${date.getDay() === 0 ? ' is-sunday' : date.getDay() === 6 ? ' is-saturday' : ''}${view === 'month' && date.getMonth() !== anchor.getMonth() ? ' is-outside' : ''}`}
                aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일, 할 일 ${dayItems.length}건`} aria-pressed={key === selected}
                onClick={() => { setSelected(key); if (view === 'month' && date.getMonth() !== anchor.getMonth()) setAnchor(date); }}>
                <span>{date.getDate()}</span>{dayItems.length > 0 && <span className="todos-dashboard-dots" aria-hidden="true">{dayItems.slice(0, 3).map(todo => <i key={todo.id} className={categoryClass(todo.category)} />)}</span>}</button>;
            })}</div></section>
        <section className="card todos-dashboard-selected"><div className="todos-dashboard-card-heading"><h3>{selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({weekdays[selectedDate.getDay()]}) <small>{selectedTodos.length}개의 할 일</small></h3><a className="button-link button-primary todos-dashboard-card-add" href="#/todos/new" aria-label="할 일 추가" title="할 일 추가">＋</a></div>
            {selectedTodos.length ? <ul>{selectedTodos.map(todo => row(todo, true))}</ul>
              : <div className="todos-dashboard-empty"><img className="todos-empty-illustration" src={emptyCalendar} alt="" /><strong>등록한 할 일이 없습니다.</strong><p>할 일을 등록하면 달력에 표시됩니다.</p></div>}</section>
        <section className="card todos-dashboard-list"><div className="todos-dashboard-card-heading"><h3><img src={checklistIcon} alt="" /> 전체 할 일</h3><a className="button-link button-primary todos-dashboard-card-add" href="#/todos/new" aria-label="할 일 추가" title="할 일 추가">＋</a></div>
          <div className="todos-dashboard-tabs" role="group" aria-label="완료 상태 필터">{([['all', '전체'], ['open', '진행 중'], ['done', '완료']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label} <span>{counts[value]}</span></button>)}</div>
          <div className="todos-dashboard-categories" role="group" aria-label="카테고리 필터"><button type="button" className="todos-category-all" aria-pressed={category === null} onClick={() => setCategory(null)}>All</button>{visibleCategories.map(name => <button type="button" key={name} className={categoryClass(name)} aria-pressed={category === name} onClick={() => setCategory(name)}><CategoryImage name={name} iconKey={iconFor(name)} />{name}</button>)}
            {categories.length > 3 && <button type="button" className="todos-category-expand" aria-expanded={categoriesExpanded} onClick={() => setCategoriesExpanded(value => !value)}>{categoriesExpanded ? '접기' : '⋯ 더보기'}</button>}</div>
          <div className="todos-dashboard-list-tools"><label className="todos-search-label"><span className="sr-only">할 일 검색</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="제목 또는 내용 검색" /></label><label className="todos-sort-label"><span className="sr-only">정렬</span><select value={sort} onChange={event => setSort(event.target.value as SortOrder)}><option value="latest">최신순</option><option value="due">기한순</option></select></label></div>
          {ordered.length ? <ul>{ordered.map(todo => row(todo))}</ul>
            : <div className="todos-dashboard-empty"><strong>조건에 맞는 할 일이 없습니다.</strong><p>검색어나 카테고리를 바꿔 보세요.</p></div>}
        </section>
      </div>}
  </div>;
}
