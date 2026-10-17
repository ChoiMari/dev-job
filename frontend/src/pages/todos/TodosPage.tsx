import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createTodosApi } from '../../api/todos';
import type { Todo, TodoCategory, TodoInput } from '../../api/todos';
import { LucideIcon } from '../../components/LucideIcon';
import clipboardPlus from '../../assets/redesign/todo-clipboard-check.png';
import bellIcon from '../../assets/redesign/todo-bell-icon.png';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { deviceZone, dueFromLocal, localDueInput } from './todoTime';
import { TodoCalendar } from './TodoCalendar';
import { CategoryImage, categoryIconChoices } from './todoIcons';
import type { CategoryIconKey } from './todoIcons';
import './todos.css';

const todos = createTodosApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '할 일을 처리하지 못했습니다.';
const categoryColors = [
  { key: 'blue', label: '파랑', value: '#4386f7' }, { key: 'green', label: '초록', value: '#35cf91' },
  { key: 'pink', label: '핑크', value: '#fb7aa8' }, { key: 'orange', label: '주황', value: '#ffa44f' },
  { key: 'yellow', label: '노랑', value: '#ffd166' }, { key: 'purple', label: '보라', value: '#ae79f8' },
  { key: 'sky', label: '하늘', value: '#58b4f8' }, { key: 'gray', label: '회색', value: '#9da8c8' },
];
function todayInput() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T23:59`; }

export function TodosPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/todos') return <TodoCalendar />;
  if (path === '/todos/new') return <><TodoCalendar /><TodoEditor initialManage={location.includes('?manage=1')} /></>;
  const match = /^\/todos\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? <><TodoCalendar /><TodoEditor id={id} initialEdit={location.includes('?edit=1')} /></> : <section className="card">
    <EmptyState title="할 일 주소를 확인해 주세요." /><a className="button-link" href="#/todos">할 일 달력으로</a>
  </section>;
}

function TodoEditor({ id, initialEdit = false, initialManage = false }: { id?: number; initialEdit?: boolean; initialManage?: boolean }) {
  const [todo, setTodo] = useState<Todo>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueLocal, setDueLocal] = useState(() => id ? '' : todayInput());
  const [noDue, setNoDue] = useState(false);
  const [category, setCategory] = useState('기타');
  const [reminderMinutes, setReminderMinutes] = useState<TodoInput['reminderMinutes']>(-1);
  const [customCategories, setCustomCategories] = useState<TodoCategory[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<CategoryIconKey>('briefcase');
  const [newCategoryColor, setNewCategoryColor] = useState('blue');
  const [categoryDialog, setCategoryDialog] = useState<'add' | 'manage' | null>(initialManage ? 'manage' : null);
  const [editingCategory, setEditingCategory] = useState<TodoCategory | null>(null);
  const [categoryDeleteId, setCategoryDeleteId] = useState<number | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<number | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [editing, setEditing] = useState(!id || initialEdit);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [loadStatus, setLoadStatus] = useState(0);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function accept(value: Todo) {
    setTodo(value); setTitle(value.title); setDescription(value.description ?? '');
    setDueLocal(localDueInput(value.dueAt, value.dueTimeZone ?? deviceZone));
    setNoDue(value.dueAt === null);
    setCategory(value.category); setReminderMinutes(value.reminderMinutes);
  }
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); setLoading(true); setLoadError('');
    todos.get(id, controller.signal).then(value => { if (!controller.signal.aborted) accept(value); })
      .catch(failure => { if (!controller.signal.aborted) { setLoadError(message(failure)); setLoadStatus(failure instanceof ApiError ? failure.status : 0); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  useEffect(() => {
    const controller = new AbortController();
    todos.categories(controller.signal).then(value => { if (!controller.signal.aborted) { setCustomCategories(value); if (!id) setCategory(current => value.some(item => item.name === current) ? current : value[0]?.name ?? current); } })
      .catch(failure => { if (!controller.signal.aborted) setCategoryError(message(failure)); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (categoryDialog) {
        if (initialManage) window.location.hash = '/todos';
        else setCategoryDialog(null);
      }
      else if (confirmDelete) { if (!busy) setConfirmDelete(false); }
      else window.location.hash = '/todos';
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [categoryDialog, confirmDelete, busy, initialManage]);
  function closeCategoryDialog() {
    if (initialManage) window.location.hash = '/todos';
    else setCategoryDialog(null);
  }
  function openCategoryDialog(item?: TodoCategory) {
    setEditingCategory(item ?? null);
    setCategoryName(item?.name ?? '');
    setNewCategoryIcon((item?.iconKey ?? 'briefcase') as CategoryIconKey);
    setNewCategoryColor(item?.colorKey ?? 'orange');
    setCategoryError('');
    setCategoryDialog('add');
  }
  async function saveCategory() {
    const name = categoryName.trim();
    if (!name) { setCategoryError('카테고리 이름을 입력해 주세요.'); return; }
    if (name.length > 20) { setCategoryError('카테고리 이름은 20자까지 입력할 수 있습니다.'); return; }
    if (!editingCategory && customCategories.length >= 20) { setCategoryError('카테고리는 최대 20개까지 추가할 수 있습니다.'); return; }
    setCategoryBusy(true); setCategoryError('');
    try {
      if (editingCategory) {
        const saved = await todos.updateCategory(editingCategory.id, { name, iconKey: newCategoryIcon, colorKey: newCategoryColor });
        setCustomCategories(current => current.map(item => item.id === saved.id ? saved : item));
        if (category === editingCategory.name) setCategory(saved.name);
        if (todo?.category === editingCategory.name) setTodo({ ...todo, category: saved.name });
        setCategoryDialog('manage');
      } else {
        const saved = await todos.createCategory(name, newCategoryIcon, newCategoryColor);
        setCustomCategories(current => [...current, saved]);
        setCategory(saved.name);
        setCategoryDialog(initialManage ? 'manage' : null);
      }
      setCategoryName(''); setEditingCategory(null);
    }
    catch (failure) { setCategoryError(message(failure)); }
    finally { setCategoryBusy(false); }
  }
  async function removeCategory(item: TodoCategory) {
    setCategoryBusy(true); setCategoryError('');
    try {
      await todos.deleteCategory(item.id);
      const remaining = customCategories.filter(value => value.id !== item.id);
      setCustomCategories(remaining);
      if (category === item.name) setCategory(remaining.find(value => value.name === '기타')?.name ?? remaining[0]?.name ?? '기타');
      setCategoryDeleteId(null);
    }
    catch (failure) { setCategoryError(message(failure)); }
    finally { setCategoryBusy(false); }
  }
  async function finishCategoryDrag() {
    setDraggingCategoryId(null);
    try { setCustomCategories(await todos.reorderCategories(customCategories.map(item => item.id))); }
    catch (failure) { setCategoryError(message(failure)); setCustomCategories(await todos.categories().catch(() => customCategories)); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    setError('');
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return; }
    let due: Pick<TodoInput, 'dueAt' | 'dueTimeZone'>;
    try {
      due = noDue ? { dueAt: null, dueTimeZone: null }
        : todo && dueLocal === localDueInput(todo.dueAt, todo.dueTimeZone ?? deviceZone)
        ? { dueAt: todo.dueAt, dueTimeZone: todo.dueTimeZone }
        : dueFromLocal(dueLocal);
    } catch (failure) { setError(message(failure)); return; }
    inFlight.current = true; setBusy(true);
    try {
      const input: TodoInput = { title: title.trim(), description: description.trim() || null, category, reminderMinutes, ...due };
      await (id ? todos.update(id, input) : todos.create(input));
      if (!mounted.current) return;
      if (!id) window.location.hash = '/todos';
      else { accept(await todos.get(id)); setEditing(false); }
    } catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function toggle() {
    if (!id || !todo || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await todos.complete(id, !todo.completed); if (mounted.current) accept(await todos.get(id)); }
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
  const categoryOptions = customCategories;
  return <div className={`todos-modal-backdrop${initialManage ? ' is-category-manager-route' : ''}`} onClick={event => { if (event.target === event.currentTarget) window.location.hash = '/todos'; }}>
    <section className="todos-modal" role="dialog" aria-modal="true" aria-labelledby="todos-editor-title">
    <div className="todos-list-heading"><div className="todos-editor-heading-icon"><img src={clipboardPlus} alt="" /></div><div><h2 id="todos-editor-title">{id ? '할 일 상세' : '할 일 추가'}</h2><p>{id ? '할 일의 내용을 확인하고 수정하세요.' : '새로운 할 일을 등록하세요.'}</p></div>
      <button className="todos-modal-close" type="button" aria-label="닫기" onClick={() => { window.location.hash = '/todos'; }}>×</button></div>
    {loading ? <LoadingState message="할 일을 불러오고 있습니다." /> : loadError
      ? loadStatus === 404 || loadStatus === 403 ? <EmptyState title={loadStatus === 404 ? '할 일을 찾을 수 없습니다.' : '접근 권한이 없습니다.'} message={loadError} />
        : <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
      : <>
        {error && !confirmDelete && <p role="alert" className="form-error">{error}</p>}
        {editing ? <form className="todos-form" onSubmit={save}><fieldset disabled={busy}>
          <label><span className="todos-field-label">제목 <em>*</em></span><input required maxLength={200} placeholder="할 일 제목을 입력하세요." value={title} onChange={event => setTitle(event.target.value)} /></label>
          <div className="todos-category-field"><div className="todos-category-field-heading"><strong>카테고리 <em>*</em></strong><button type="button" onClick={() => setCategoryDialog('manage')}>카테고리 관리</button></div><div className="todos-category-choices">{categoryOptions.map(item => <button type="button" key={item.id} className={`todo-category todo-tone-${item.colorKey}`} aria-pressed={category === item.name} onClick={() => setCategory(item.name)}><CategoryImage name={item.name} iconKey={item.iconKey} size={24} />{item.name}</button>)}
            <button type="button" className="todos-category-open" aria-label="카테고리 추가" disabled={categoryOptions.length >= 20} onClick={() => openCategoryDialog()}>＋</button></div></div>
          <div className="todos-date-fields"><label>날짜<input type="date" disabled={noDue} value={noDue ? '' : dueLocal.slice(0, 10)} onChange={event => setDueLocal(event.target.value ? `${event.target.value}T${dueLocal.slice(11, 16) || '23:59'}` : '')} /></label>
            <label>마감 시간 (선택)<input type="time" disabled={noDue || !dueLocal} value={noDue || dueLocal.slice(11, 16) === '23:59' ? '' : dueLocal.slice(11, 16)} onChange={event => setDueLocal(`${dueLocal.slice(0, 10)}T${event.target.value || '23:59'}`)} /></label></div>
          <label className="todos-no-due"><input type="checkbox" checked={noDue} onChange={event => { setNoDue(event.target.checked); if (event.target.checked) setReminderMinutes(-1); else if (!dueLocal) setDueLocal(todayInput()); }} />기한 없음</label>
          <p className="todos-help">시간을 따로 고르지 않으면 23:59로 저장됩니다. 기준 시간대: {deviceZone}</p>
          <label>내용 (선택)<textarea maxLength={2000} rows={4} placeholder="상세 내용을 입력하세요." value={description} onChange={event => setDescription(event.target.value)} /><small>{description.length} / 2000</small></label>
          <label className="todos-reminder-field"><span className="todos-field-label"><img src={bellIcon} alt="" />알림</span><select disabled={noDue} value={reminderMinutes} onChange={event => setReminderMinutes(Number(event.target.value) as TodoInput['reminderMinutes'])}><option value={10}>10분 전</option><option value={60}>1시간 전</option><option value={1440}>하루 전</option><option value={-1}>알림 없음</option></select></label>
        </fieldset><div className="todo-actions"><button type="button" disabled={busy} onClick={() => { if (id && todo) { accept(todo); setEditing(false); setError(''); } else window.location.hash = '/todos'; }}>취소</button><button className="button-primary" type="submit" disabled={busy}>{busy ? '저장 중…' : id ? '저장하기' : '등록하기'}</button></div></form>
          : todo && <div className="todo-detail"><div className="todo-detail-main"><h3>{todo.title}</h3>
            {todo.description && <p className="todo-description">{todo.description}</p>}</div>
            <div className="todo-detail-schedule">
              <span><LucideIcon name="calendar" />{todo.dueAt ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', timeZone: todo.dueTimeZone ?? deviceZone }).format(new Date(todo.dueAt)) : '기한 없음'}</span>
              {todo.dueAt && <span><LucideIcon name="clock" />{localDueInput(todo.dueAt, todo.dueTimeZone ?? deviceZone).slice(11)} 마감</span>}
              {todo.reminderMinutes >= 0 && <span><LucideIcon name="bell" />{todo.reminderMinutes === 10 ? '10분 전' : todo.reminderMinutes === 60 ? '1시간 전' : todo.reminderMinutes === 1440 ? '하루 전' : `${todo.reminderMinutes}분 전`} 알림</span>}
            </div>
            <div className="todo-detail-meta"><span className={`todo-detail-status${todo.completed ? ' is-done' : ''}`}><i aria-hidden="true" />{todo.completed ? '완료' : '진행 중'}</span><span className={`todo-category todo-tone-${customCategories.find(item => item.name === todo.category)?.colorKey ?? 'gray'}`}><CategoryImage name={todo.category} iconKey={customCategories.find(item => item.name === todo.category)?.iconKey} />{todo.category}</span></div>
            <div className="todo-actions"><button type="button" disabled={busy} onClick={() => void toggle()}>{busy ? '처리 중…' : todo.completed ? '완료 취소' : '완료'}</button>
              <button type="button" disabled={busy} onClick={() => { setEditing(true); setConfirmDelete(false); setError(''); }}>수정</button>
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>삭제</button></div>
          </div>}
      </>}
    </section>
    {confirmDelete && todo && <div className="todo-delete-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) setConfirmDelete(false); }}>
      <section className="todo-delete" role="dialog" aria-modal="true" aria-labelledby="todo-delete-title">
        <header><span className="todo-delete-icon"><LucideIcon name="trash" /></span><div><h2 id="todo-delete-title">할 일을 삭제할까요?</h2><p>삭제한 할 일은 목록에서 다시 볼 수 없습니다.</p></div></header>
        {error && <p className="todo-delete-error form-error" role="alert">{error}</p>}
        <footer><button type="button" autoFocus disabled={busy} onClick={() => { setConfirmDelete(false); setError(''); }}>취소</button><button className="todo-delete-confirm" type="button" disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중…' : '삭제'}</button></footer>
      </section>
    </div>}
    {categoryDialog && <div className="todos-category-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) closeCategoryDialog(); }}>
      <section className="todos-category-dialog" role="dialog" aria-modal="true" aria-labelledby="todos-category-dialog-title">
        <header><div><h2 id="todos-category-dialog-title">{categoryDialog === 'manage' ? '카테고리 관리' : editingCategory ? '카테고리 수정' : '카테고리 추가'}</h2>
          <p>{categoryDialog === 'manage' ? '할 일에 사용할 카테고리를 추가하고 관리하세요.' : '할 일에 사용할 카테고리 이름과 이미지를 선택하세요.'}</p></div>
          <button type="button" aria-label="닫기" onClick={closeCategoryDialog}>×</button></header>
        {categoryDialog === 'add' ? <>
          <label className="todos-category-name-label"><span>카테고리 이름 <em>*</em></span><input maxLength={20} autoFocus placeholder="예) 면접, 자기계발, 건강" value={categoryName} onChange={event => setCategoryName(event.target.value)} /><small>{categoryName.length}/20</small></label>
          <div className="todos-category-icon-picker" role="group" aria-label="카테고리 아이콘"><strong>카테고리 아이콘 <em>*</em></strong><p>미리 준비된 아이콘 중 하나를 선택하세요.</p><div>{categoryIconChoices.map(choice => <button type="button" key={choice.key} aria-label={`${choice.label} 아이콘`} aria-pressed={newCategoryIcon === choice.key} onClick={() => setNewCategoryIcon(choice.key)}><CategoryImage iconKey={choice.key} size={30} /></button>)}</div></div>
          <div className="todos-category-colors" role="group" aria-label="카테고리 색상"><strong>카테고리 색상 <em>*</em></strong><div>{categoryColors.map(color => <button type="button" key={color.key} aria-label={color.label} aria-pressed={newCategoryColor === color.key} style={{ backgroundColor: color.value }} onClick={() => setNewCategoryColor(color.key)} />)}</div></div>
          <p className="todos-category-limit">ⓘ 카테고리는 최대 20개까지 추가할 수 있습니다. ({categoryOptions.length}/20)</p>
          {categoryError && <p className="form-error" role="alert">{categoryError}</p>}
          <footer><button type="button" onClick={() => setCategoryDialog(editingCategory || initialManage ? 'manage' : null)}>취소</button><button type="button" className="button-primary" disabled={categoryBusy || (!editingCategory && categoryOptions.length >= 20)} onClick={() => void saveCategory()}>{categoryBusy ? '저장 중…' : editingCategory ? '저장하기' : '추가하기'}</button></footer>
        </> : <>
          <div className="todos-category-manage-summary"><p>카테고리 {categoryOptions.length} / 20개<br />아이콘과 색상을 선택해서 설정할 수 있습니다.</p><button type="button" disabled={categoryOptions.length >= 20} onClick={() => openCategoryDialog()}>＋ 새 카테고리 추가</button></div>
          <ul className="todos-category-manage-list">{categoryOptions.map(item => <li key={item.id} draggable={!categoryBusy}
            onDragStart={() => setDraggingCategoryId(item.id)}
            onDragOver={event => { event.preventDefault(); if (draggingCategoryId === null || draggingCategoryId === item.id) return; setCustomCategories(current => { const moving = current.find(value => value.id === draggingCategoryId); if (!moving) return current; const rest = current.filter(value => value.id !== draggingCategoryId); const target = rest.findIndex(value => value.id === item.id); rest.splice(target, 0, moving); return rest; }); }}
            onDrop={event => { event.preventDefault(); void finishCategoryDrag(); }} onDragEnd={() => setDraggingCategoryId(null)}>
            <span className="todos-category-drag" aria-hidden="true">⠿</span><CategoryImage name={item.name} iconKey={item.iconKey} size={24} /><strong>{item.name}</strong>
            <span className={`todos-category-color-name todo-tone-${item.colorKey}`}><i />{categoryColors.find(color => color.key === item.colorKey)?.label ?? '파랑'}</span>
            <button type="button" aria-label={`${item.name} 수정`} onClick={() => openCategoryDialog(item)}><LucideIcon name="pencil" /></button>
            {categoryDeleteId === item.id ? <button type="button" className="todos-delete-confirm" disabled={categoryBusy} onClick={() => void removeCategory(item)}>삭제 확인</button>
              : <button type="button" className="todos-delete-open" aria-label={`${item.name} 삭제`} disabled={categoryBusy || categoryOptions.length <= 1} onClick={() => setCategoryDeleteId(item.id)}><LucideIcon name="trash" /></button>}
          </li>)}</ul>
          {categoryDeleteId !== null && <p className="todos-category-delete-hint">사용 중인 카테고리는 할 일을 다른 카테고리로 옮긴 후 삭제할 수 있습니다. <button type="button" onClick={() => setCategoryDeleteId(null)}>취소</button></p>}
          {categoryError && <p className="form-error" role="alert">{categoryError}</p>}
          <footer><button type="button" onClick={closeCategoryDialog}>닫기</button></footer>
        </>}
      </section>
    </div>}
  </div>;
}
