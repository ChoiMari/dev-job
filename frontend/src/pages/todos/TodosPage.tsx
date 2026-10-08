import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createTodosApi } from '../../api/todos';
import type { Todo, TodoFilter, TodoInput, TodoPage } from '../../api/todos';
import { Badge } from '../../components/PixelArt';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import todoArt from '../../assets/redesign/ext-img-03-personal-todos.png';
import './todos.css';

const todos = createTodosApi(apiRequest);
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
const message = (error: unknown) => error instanceof Error ? error.message : '할 일을 처리하지 못했습니다.';
const two = (value: number) => String(value).padStart(2, '0');
export function dueLabel(todo: Todo) {
  if (!todo.dueAt || !todo.dueTimeZone) return '기한 없음';
  return `${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: todo.dueTimeZone }).format(new Date(todo.dueAt))} · ${todo.dueTimeZone}`;
}
export function localDueInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}
export function dueFromLocal(value: string): Pick<TodoInput, 'dueAt' | 'dueTimeZone'> {
  if (!value) return { dueAt: null, dueTimeZone: null };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || localDueInput(date.toISOString()) !== value) throw new Error('기한 날짜와 시각을 확인해 주세요.');
  const minutes = -date.getTimezoneOffset();
  const offset = `${minutes < 0 ? '-' : '+'}${two(Math.floor(Math.abs(minutes) / 60))}:${two(Math.abs(minutes) % 60)}`;
  return { dueAt: `${value}:00${offset}`, dueTimeZone: deviceZone };
}

export function TodosPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/todos') return <TodoList />;
  if (path === '/todos/new') return <TodoEditor />;
  const match = /^\/todos\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? <TodoEditor id={id} /> : <section className="card">
    <EmptyState title="할 일 주소를 확인해 주세요." /><a className="button-link" href="#/todos">할 일 목록으로</a>
  </section>;
}

function TodoList() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<TodoFilter>('open');
  const [result, setResult] = useState<TodoPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number>();
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setResult(undefined);
    todos.list(page, filter, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      if (page > 0 && !value.items.length && value.totalElements <= page * value.size) setPage(Math.max(0, page - 1));
      else setResult(value);
    }).catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, filter, retry]);
  async function toggle(todo: Todo) {
    if (busy.current) return;
    busy.current = true; setBusyId(todo.id); setActionError('');
    try { await todos.complete(todo.id, !todo.completed); setRetry(value => value + 1); }
    catch (failure) { setActionError(message(failure)); }
    finally { busy.current = false; setBusyId(undefined); }
  }
  return <div className="todos-page">
    <section className="card todos-intro"><div><span className="eyebrow">MY NEXT STEP</span><h2>내가 등록한 할 일</h2>
      <p>취업 준비를 작은 할 일로 나눠 기록하세요. 지원 기록에서 나온 다음 행동과 따로 관리됩니다.</p>
      <a className="button-link button-primary" href="#/todos/new">할 일 등록</a></div>
      <img src={todoArt} alt="" aria-hidden="true" width="180" height="180" /></section>
    <section className="card todos-list-card" aria-labelledby="todos-list-title">
      <div className="todos-list-heading"><h2 id="todos-list-title">할 일 목록</h2><span>기한이 빠른 순</span></div>
      <div className="todos-filters" role="group" aria-label="완료 상태 필터">
        {([['open', '미완료'], ['done', '완료'], ['all', '전체']] as const).map(([value, label]) =>
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); setActionError(''); }}>{label}</button>)}
      </div>
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
      {loading ? <LoadingState message="할 일을 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
        : result && <>
          {result.items.length ? <ul className="todos-list">{result.items.map(todo => <li key={todo.id} className={todo.completed ? 'is-done' : ''}>
            <div className="todo-main"><a href={`#/todos/${todo.id}`}>{todo.title}</a><span>{dueLabel(todo)}</span></div>
            <div className="todo-actions"><Badge tone={todo.completed ? 'success' : 'primary'} icon={todo.completed ? 'check' : 'clock'}>{todo.completed ? '완료' : '진행 중'}</Badge>
              <button type="button" disabled={busyId !== undefined} onClick={() => void toggle(todo)}>{busyId === todo.id ? '처리 중…' : todo.completed ? '완료 취소' : '완료'}</button></div>
          </li>)}</ul> : <EmptyState title={page ? '이 페이지에 할 일이 없습니다.' : filter === 'done' ? '완료한 할 일이 없습니다.' : '표시할 할 일이 없습니다.'}
            message={filter === 'open' ? '할 일을 등록하거나 완료한 항목은 완료 탭에서 확인하세요.' : undefined} />}
          <div className="todos-pagination"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>이전</button>
            <span role="status">총 {result.totalElements}건 · {page + 1}페이지</span>
            <button type="button" disabled={(page + 1) * result.size >= result.totalElements} onClick={() => setPage(value => value + 1)}>다음</button></div>
        </>}
    </section>
  </div>;
}

function TodoEditor({ id }: { id?: number }) {
  const [todo, setTodo] = useState<Todo>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueLocal, setDueLocal] = useState('');
  const [editing, setEditing] = useState(!id);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [loadStatus, setLoadStatus] = useState(0);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function accept(value: Todo) {
    setTodo(value); setTitle(value.title); setDescription(value.description ?? ''); setDueLocal(localDueInput(value.dueAt));
  }
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); setLoading(true); setLoadError('');
    todos.get(id, controller.signal).then(value => { if (!controller.signal.aborted) accept(value); })
      .catch(failure => { if (!controller.signal.aborted) { setLoadError(message(failure)); setLoadStatus(failure instanceof ApiError ? failure.status : 0); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    setError(''); setSuccess('');
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return; }
    let due: Pick<TodoInput, 'dueAt' | 'dueTimeZone'>;
    try {
      due = todo && dueLocal === localDueInput(todo.dueAt)
        ? { dueAt: todo.dueAt, dueTimeZone: todo.dueTimeZone }
        : dueFromLocal(dueLocal);
    } catch (failure) { setError(message(failure)); return; }
    inFlight.current = true; setBusy(true);
    try {
      const input: TodoInput = { title: title.trim(), description: description.trim() || null, ...due };
      const saved = id ? await todos.update(id, input) : await todos.create(input);
      if (!mounted.current) return;
      if (!id) window.location.hash = `/todos/${saved.id}`;
      else { accept(await todos.get(id)); setEditing(false); setSuccess('할 일을 저장했습니다.'); }
    } catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function toggle() {
    if (!id || !todo || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setSuccess('');
    try { await todos.complete(id, !todo.completed); if (mounted.current) { accept(await todos.get(id)); setSuccess(todo.completed ? '완료를 취소했습니다.' : '할 일을 완료했습니다.'); } }
    catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (!id || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await todos.remove(id); if (mounted.current) window.location.hash = '/todos'; }
    catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="card todos-editor">
    <a className="button-link" href="#/todos">← 할 일 목록</a>
    <div className="todos-list-heading"><div><span className="eyebrow">MY TASK</span><h2>{id ? '할 일 상세' : '새 할 일'}</h2></div></div>
    {loading ? <LoadingState message="할 일을 불러오고 있습니다." /> : loadError
      ? loadStatus === 404 || loadStatus === 403 ? <EmptyState title={loadStatus === 404 ? '할 일을 찾을 수 없습니다.' : '접근 권한이 없습니다.'} message={loadError} />
        : <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
      : <>
        {success && <SuccessState title={success} compact />}
        {error && <p role="alert" className="form-error">{error}</p>}
        {editing ? <form className="todos-form" onSubmit={save}><fieldset disabled={busy}>
          <label>제목 *<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label>설명<textarea maxLength={2000} rows={4} value={description} onChange={event => setDescription(event.target.value)} /></label>
          <label>기한 · 선택<input type="datetime-local" value={dueLocal} onChange={event => setDueLocal(event.target.value)} /></label>
          <p className="todos-help">기한은 현재 기기 시간대({deviceZone})로 저장합니다. 비워 두면 기한이 없습니다.</p>
        </fieldset><div className="todo-actions"><button className="button-primary" type="submit" disabled={busy}>{busy ? '저장 중…' : '할 일 저장'}</button>
          {id && <button type="button" disabled={busy} onClick={() => { if (todo) accept(todo); setEditing(false); setError(''); }}>수정 취소</button>}</div></form>
          : todo && <div className="todo-detail"><h3>{todo.title}</h3>
            <div className="todo-detail-meta"><Badge tone={todo.completed ? 'success' : 'primary'} icon={todo.completed ? 'check' : 'clock'}>{todo.completed ? '완료' : '진행 중'}</Badge><span>{dueLabel(todo)}</span></div>
            {todo.description && <p className="todo-description">{todo.description}</p>}
            <div className="todo-actions"><button type="button" disabled={busy} onClick={() => void toggle()}>{busy ? '처리 중…' : todo.completed ? '완료 취소' : '완료'}</button>
              <button type="button" disabled={busy} onClick={() => { setEditing(true); setConfirmDelete(false); setSuccess(''); setError(''); }}>수정</button>
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>삭제</button></div>
            {confirmDelete && <div className="todo-delete" role="group" aria-label="할 일 삭제 확인"><p>“{todo.title}” 할 일을 목록에서 삭제할까요? 삭제 후 다시 볼 수 없습니다.</p>
              <div className="todo-actions"><button type="button" disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중…' : '삭제 확인'}</button>
                <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>삭제 취소</button></div></div>}
          </div>}
      </>}
  </section>;
}
