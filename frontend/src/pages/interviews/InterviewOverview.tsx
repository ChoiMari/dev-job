import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api';
import { createInterviewsApi } from '../../api/interviews';
import type { Interview } from '../../api/interviews';
import { createApplicationsApi } from '../../api/applications';
import type { Application } from '../../api/applications';
import { statusLabels } from '../../api/application-status';
import { ErrorState, LoadingState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import { zonedLocalInput } from './interviewTime';
import building from '../../assets/redesign/interview-building.png';
import calendarArt from '../../assets/redesign/interview-calendar-pixel.png';
import emptyArt from '../../assets/redesign/interview-empty-cat-calendar.png';
import listEmptyArt from '../../assets/redesign/interview-list-empty-cat.png';
import './interviews-overview.css';

const interviews = createInterviewsApi(apiRequest);
const applications = createApplicationsApi(apiRequest);
type View = 'calendar' | 'list';
type Filter = 'all' | 'upcoming' | 'past' | 'completed' | 'cancelled';
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const two = (n: number) => String(n).padStart(2, '0');
const keyOf = (date: Date) => `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
const dateOf = (item: Interview) => zonedLocalInput(item.startsAt, item.timeZone).slice(0, 10);
const timeOf = (item: Interview) => zonedLocalInput(item.startsAt, item.timeZone).slice(11, 16);
const companyOf = (app?: Application) => app?.job?.company.name ?? app?.personalSavedJob?.companyName ?? '연결된 지원';
const roleOf = (app?: Application) => app?.job?.title ?? app?.personalSavedJob?.title ?? '';
const isUpcoming = (item: Interview) => item.status === 'SCHEDULED' && Date.parse(item.startsAt) >= Date.now();
function statusOf(item: Interview): 'upcoming' | 'past' | 'completed' | 'cancelled' {
  return item.status === 'CANCELLED' ? 'cancelled' : item.status === 'COMPLETED' ? 'completed' : isUpcoming(item) ? 'upcoming' : 'past';
}
const statusText = { upcoming: '예정', past: '지난 일정', completed: '완료', cancelled: '취소' };
const stageText = { FIRST: '1차 면접', SECOND: '2차 면접', FINAL: '최종 면접', OTHER: '기타' };
const methodText = { IN_PERSON: '대면', ONLINE: '온라인', PHONE: '전화' };

async function loadAll(signal: AbortSignal): Promise<Interview[]> {
  const first = await interviews.list(0, signal);
  const pages = Math.ceil(first.totalElements / first.size);
  if (pages <= 1) return first.items;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => interviews.list(index + 1, signal)));
  return [first, ...rest].flatMap(page => page.items);
}

async function loadApplications(signal: AbortSignal): Promise<Application[]> {
  const first = await applications.list({ page: 0, size: 100 }, signal);
  const pages = Math.ceil(first.totalElements / first.size);
  if (pages <= 1) return first.items;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => applications.list({ page: index + 1, size: 100 }, signal)));
  return [first, ...rest].flatMap(page => page.items);
}

export function InterviewOverview() {
  const [view, setView] = useState<View>('calendar');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => keyOf(new Date()));
  const [items, setItems] = useState<Interview[]>([]);
  const [applicationMap, setApplicationMap] = useState<Map<number, Application>>(new Map());
  const [applicationError, setApplicationError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.allSettled([loadAll(controller.signal), loadApplications(controller.signal)]).then(([schedule, application]) => {
      if (controller.signal.aborted) return;
      if (schedule.status === 'fulfilled') setItems(schedule.value);
      else setError(schedule.reason instanceof Error ? schedule.reason.message : '면접 일정을 불러오지 못했습니다.');
      if (application.status === 'fulfilled') {
        setApplicationMap(new Map(application.value.map(item => [item.id, item])));
        setApplicationError(false);
      } else setApplicationError(true);
      setLoading(false);
    });
    return () => controller.abort();
  }, [retry]);

  const monthKey = `${month.getFullYear()}-${two(month.getMonth() + 1)}`;
  const now = Date.now();
  const counts = useMemo(() => ({
    total: items.length,
    month: items.filter(item => dateOf(item).startsWith(monthKey)).length,
    upcoming: items.filter(item => item.status === 'SCHEDULED' && Date.parse(item.startsAt) >= now).length,
    past: items.filter(item => item.status === 'SCHEDULED' && Date.parse(item.startsAt) < now).length,
    completed: items.filter(item => item.status === 'COMPLETED').length,
    cancelled: items.filter(item => item.status === 'CANCELLED').length,
  }), [items, monthKey, now]);
  const visible = useMemo(() => items.filter(item => {
    if (filter !== 'all' && statusOf(item) !== filter) return false;
    const app = item.applicationId ? applicationMap.get(item.applicationId) : undefined;
    return `${item.title} ${companyOf(app)} ${roleOf(app)} ${item.memo ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)), [items, filter, search, applicationMap]);
  const monthItems = visible.filter(item => dateOf(item).startsWith(monthKey));
  const listEmptyTitle = items.length === 0 ? '아직 등록된 면접 일정이 없습니다.'
    : counts.month === 0 ? '이번 달에는 면접 일정이 없습니다.' : '검색 조건에 맞는 면접 일정이 없습니다.';
  const listEmptyMessage = items.length === 0 ? '면접 일정 등록 버튼으로 첫 일정을 기록해보세요.'
    : counts.month === 0 ? '다른 달을 선택해 일정을 확인해보세요.' : '검색어 또는 상태 필터를 바꿔보세요.';
  const listCounts = {
    all: items.filter(item => dateOf(item).startsWith(monthKey)).length,
    upcoming: items.filter(item => dateOf(item).startsWith(monthKey) && statusOf(item) === 'upcoming').length,
    past: items.filter(item => dateOf(item).startsWith(monthKey) && statusOf(item) === 'past').length,
    completed: items.filter(item => dateOf(item).startsWith(monthKey) && statusOf(item) === 'completed').length,
    cancelled: items.filter(item => dateOf(item).startsWith(monthKey) && statusOf(item) === 'cancelled').length,
  };
  const selectedItems = monthItems.filter(item => dateOf(item) === selected);
  const next = items.filter(isUpcoming).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1);
    return { date, key: keyOf(date), inMonth: date.getMonth() === month.getMonth() };
  });
  function changeMonth(delta: number) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(nextMonth); setSelected(keyOf(nextMonth));
  }
  async function cancel(item: Interview) {
    if (!window.confirm(`‘${item.title}’ 일정을 취소할까요? 취소 후 상세에서 다시 활성화할 수 있습니다.`)) return;
    setActionError(''); setBusyId(item.id);
    try {
      const changed = await interviews.cancel(item.id);
      setItems(current => current.map(value => value.id === changed.id ? changed : value));
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : '일정을 취소하지 못했습니다.'); }
    finally { setBusyId(null); }
  }
  async function complete(item: Interview) {
    setActionError(''); setBusyId(item.id);
    try {
      const changed = await interviews.complete(item.id);
      setItems(current => current.map(value => value.id === changed.id ? changed : value));
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : '일정을 완료하지 못했습니다.'); }
    finally { setBusyId(null); }
  }

  function details(item: Interview) {
    const app = item.applicationId ? applicationMap.get(item.applicationId) : undefined;
    return <article className="interview-overview-detail" key={item.id}>
      <div className="interview-overview-detail-head"><span className="interview-overview-building"><img src={building} alt="" /></span>
        <div><h4><a href={`#/interviews/${item.id}`}>{item.title}</a></h4><p>{app ? `${companyOf(app)} · ${roleOf(app)}` : item.applicationId ? `연결된 지원 #${item.applicationId}` : '연결된 지원 없음'}</p></div>
        <span className={`interview-overview-status is-${statusOf(item)}`}>{statusText[statusOf(item)]}</span></div>
      <dl><div><dt><LucideIcon name="clock" /> 일시</dt><dd>{dateOf(item)} {timeOf(item)} · {item.timeZone}</dd></div>
        <div><dt><LucideIcon name="briefcase" /> 면접 단계</dt><dd>{item.stage ? stageText[item.stage] : '미지정'}</dd></div>
        <div><dt><LucideIcon name="monitor" /> 면접 방식</dt><dd>{item.interviewMethod ? methodText[item.interviewMethod] : '미지정'}</dd></div>
        {item.applicationId && <div><dt><LucideIcon name="link" /> 지원 이력</dt><dd><a href={`#/applications/${item.applicationId}`}>{companyOf(app)} · 지원 #{item.applicationId}</a></dd></div>}
        {app?.appliedDate && <div><dt><LucideIcon name="fileText" /> 지원일</dt><dd>{app.appliedDate}</dd></div>}
        {app && <div><dt><LucideIcon name="info" /> 지원 상태</dt><dd>{statusLabels[app.currentStatus]}</dd></div>}
        {item.memo && <div><dt><LucideIcon name="message" /> 메모</dt><dd>{item.memo}</dd></div>}</dl>
      <div className="interview-overview-detail-actions"><a href={`#/interviews/${item.id}`}>일정 상세 <LucideIcon name="arrowRight" /></a>
        {item.status === 'SCHEDULED' && <><button className="is-complete-action" type="button" disabled={busyId === item.id} onClick={() => void complete(item)} aria-label={`${item.title} 일정 완료`}><LucideIcon name="check" /></button><button type="button" disabled={busyId === item.id} onClick={() => void cancel(item)} aria-label={`${item.title} 일정 취소`}><LucideIcon name="trash" /></button></>}</div>
    </article>;
  }

  return <div className="interview-overview">
    <header className="interview-overview-hero">
      <img src={calendarArt} alt="" aria-hidden="true" />
      <div><h1>면접 일정</h1><p>지원한 공고의 면접 일정을 관리하세요.</p></div>
    </header>
    {loading ? <section className="card"><LoadingState message="면접 일정을 불러오고 있습니다." /></section> : error
      ? <section className="card"><ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /></section> : <>
      {applicationError && <p className="interview-overview-notice" role="status">지원 정보를 불러오지 못해 회사·직무 정보가 일부 표시되지 않습니다.</p>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      <section className="interview-overview-stats" aria-label="면접 일정 현황">
        <div><span className="stat-icon is-purple"><LucideIcon name="calendar" /></span><span>전체 일정<strong>{counts.total}<small>건</small></strong></span></div>
        <div><span className="stat-icon is-orange"><LucideIcon name="clock" /></span><span>이번 달 일정<strong>{counts.month}<small>건</small></strong></span></div>
        <div><span className="stat-icon is-blue"><LucideIcon name="clock" /></span><span>예정된 일정<strong>{counts.upcoming}<small>건</small></strong></span></div>
        <div><span className="stat-icon is-green"><LucideIcon name="check" /></span><span>완료된 일정<strong>{counts.completed}<small>건</small></strong></span></div>
      </section>
      <div className="interview-overview-toolbar">
        <div className="interview-overview-view" role="group" aria-label="일정 보기 방식"><button type="button" className={view === 'calendar' ? 'is-active' : ''} aria-label="달력형" title="달력형" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><LucideIcon name="calendar" /></button><button type="button" className={view === 'list' ? 'is-active' : ''} aria-label="목록형" title="목록형" aria-pressed={view === 'list'} onClick={() => setView('list')}><LucideIcon name="list" /></button></div>
        <div className="interview-overview-month"><div className="interview-overview-month-switcher"><button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달"><LucideIcon name="chevronLeft" /></button><strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong><button type="button" onClick={() => changeMonth(1)} aria-label="다음 달"><LucideIcon name="chevronRight" /></button></div><button type="button" className="interview-overview-today" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(keyOf(today)); }}>오늘</button></div>
        <a className="button-link button-primary" href="#/interviews/new"><LucideIcon name="plus" /> 면접 일정 등록</a>
      </div>
      {view === 'calendar' ? <div className="interview-overview-calendar-layout"><section className="card interview-overview-calendar"><h3><LucideIcon name="calendar" /> {month.getFullYear()}년 {month.getMonth() + 1}월</h3><div className="interview-overview-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div><div className="interview-overview-grid">{cells.map(cell => {
        const dayItems = monthItems.filter(item => dateOf(item) === cell.key);
        return <button key={cell.key} type="button" className={`${cell.inMonth ? '' : 'is-outside'} ${selected === cell.key ? 'is-selected' : ''} ${cell.key === keyOf(new Date()) ? 'is-today' : ''}`} onClick={() => { setSelected(cell.key); if (!cell.inMonth) setMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)); }} aria-label={`${cell.key}, 면접 일정 ${dayItems.length}건`}><span className="day-number">{cell.date.getDate()}</span>{dayItems.slice(0, 2).map(item => <span key={item.id} className={`calendar-event is-${statusOf(item)}`}><span>{timeOf(item)}</span> {item.title}</span>)}{dayItems.length > 2 && <small>+{dayItems.length - 2}건</small>}</button>;
      })}</div><div className="interview-overview-legend"><span><i className="is-upcoming" />예정</span><span><i className="is-past" />지난 일정</span><span><i className="is-completed" />완료</span><span><i className="is-cancelled" />취소</span></div></section>
      <section className="card interview-overview-day"><h3><LucideIcon name="calendar" /> {selected} <small>{selectedItems.length}건</small></h3>{selectedItems.length ? selectedItems.map(details) : <div className="interview-overview-day-empty" role="status"><img src={emptyArt} alt="" aria-hidden="true" /><strong>선택한 날짜에 면접 일정이 없습니다.</strong><p>다른 날짜를 선택하거나<br />새로운 면접 일정을 추가해보세요.</p></div>}</section></div> : <>
      <section className="card interview-overview-next"><h3><LucideIcon name="calendar" /> 다가오는 면접 일정</h3>{next ? <a href={`#/interviews/${next.id}`}><strong>{dateOf(next)} · {timeOf(next)}</strong><span className="interview-overview-building"><img src={building} alt="" /></span><span>{next.title}<small>{next.applicationId ? companyOf(applicationMap.get(next.applicationId)) : '연결된 지원 없음'}</small></span><LucideIcon name="chevronRight" /></a> : <p>다가오는 면접 일정이 없습니다.</p>}</section>
      <section className="card interview-overview-table-card"><div className="interview-overview-list-tools"><div role="group" aria-label="면접 일정 필터">{([['all', '전체', listCounts.all], ['upcoming', '예정', listCounts.upcoming], ['past', '지난 일정', listCounts.past], ['completed', '완료', listCounts.completed], ['cancelled', '취소', listCounts.cancelled]] as const).map(([value, label, count]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span>{count}</span></button>)}</div><label><LucideIcon name="search" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="기업명, 직무, 제목 검색" aria-label="면접 일정 검색" /></label></div>
        {monthItems.length ? <div className="interview-overview-table-wrap"><table><thead><tr><th>일정 일시</th><th>면접 제목</th><th>기업명</th><th>지원 직무</th><th>면접 단계</th><th>진행 상태</th><th>지원 이력</th><th>장소/방식</th><th>메모</th><th>관리</th></tr></thead><tbody>{monthItems.map(item => {
          const app = item.applicationId ? applicationMap.get(item.applicationId) : undefined;
          return <tr key={item.id}><td>{dateOf(item)}<small>{timeOf(item)} · {item.timeZone}</small></td><td><a href={`#/interviews/${item.id}`}>{item.title}</a></td><td>{app && <span className="interview-overview-building"><img src={building} alt="" /></span>}{app ? companyOf(app) : '—'}</td><td>{app ? roleOf(app) : '—'}</td><td>{item.stage ? stageText[item.stage] : '—'}</td><td><span className={`interview-overview-status is-${statusOf(item)}`}>{statusText[statusOf(item)]}</span></td><td>{item.applicationId ? <a href={`#/applications/${item.applicationId}`}>#{item.applicationId}</a> : '—'}</td><td>{item.interviewMethod ? methodText[item.interviewMethod] : '—'}</td><td className="memo-cell">{item.memo || '—'}</td><td><div className="row-actions"><a href={`#/interviews/${item.id}`} aria-label={`${item.title} 상세 및 수정`}><LucideIcon name="pencil" /></a>{item.status === 'SCHEDULED' && <><button className="is-complete-action" type="button" disabled={busyId === item.id} onClick={() => void complete(item)} aria-label={`${item.title} 일정 완료`}><LucideIcon name="check" /></button><button type="button" disabled={busyId === item.id} onClick={() => void cancel(item)} aria-label={`${item.title} 일정 취소`}><LucideIcon name="trash" /></button></>}</div></td></tr>;
        })}</tbody></table></div> : <div className="interview-overview-list-empty" role="status"><img src={listEmptyArt} alt="" aria-hidden="true" /><strong>{listEmptyTitle}</strong><p>{listEmptyMessage}</p></div>}</section></>}
    </>}
  </div>;
}
