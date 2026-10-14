import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createInterviewsApi } from '../../api/interviews';
import type { Interview, InterviewStage, InterviewMethod } from '../../api/interviews';
import { createApplicationsApi } from '../../api/applications';
import type { Application } from '../../api/applications';
import { statusLabels } from '../../api/application-status';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import { scheduleFromLocal, scheduleLabel, zonedLocalInput } from './interviewTime';
import interviewPlannerCat from '../../assets/redesign/interview-planner-cat.png';
import interviewBuilding from '../../assets/redesign/interview-building.png';
import interviewCalendarPixel from '../../assets/redesign/interview-calendar-pixel.png';
import { InterviewOverview } from './InterviewOverview';
import './interviews.css';

const interviews = createInterviewsApi(apiRequest);
const applications = createApplicationsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '면접 일정을 처리하지 못했습니다.';
const statusLabel = (item: Interview) => item.status === 'CANCELLED' ? '취소' : item.status === 'COMPLETED' ? '완료' : Date.parse(item.startsAt) < Date.now() ? '지난 일정' : '예정';
const applicationName = (item: Application) => item.job?.company.name ?? item.personalSavedJob?.companyName ?? '회사 정보 없음';
const applicationRole = (item: Application) => item.job?.title ?? item.personalSavedJob?.title ?? '공고 제목 없음';
const stageLabels: Record<InterviewStage, string> = { FIRST: '1차', SECOND: '2차', FINAL: '최종', OTHER: '기타' };
const methodLabels: Record<InterviewMethod, string> = { IN_PERSON: '대면', ONLINE: '온라인', PHONE: '전화' };
type InterviewField = 'title' | 'schedule' | 'application' | 'stage' | 'method' | 'memo';
function fieldForError(error: string): InterviewField | null {
  if (error.includes('제목')) return 'title';
  if (error.includes('날짜') || error.includes('시간') || error.includes('시각')) return 'schedule';
  if (error.includes('지원 이력')) return 'application';
  if (error.includes('단계')) return 'stage';
  if (error.includes('방식')) return 'method';
  if (error.includes('메모')) return 'memo';
  return null;
}
export function InterviewsPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/interviews') {
    const requestedId = new URLSearchParams(location.split('?')[1] || '').get('detail');
    const detailId = requestedId && /^[1-9]\d*$/.test(requestedId) && Number.isSafeInteger(Number(requestedId)) ? Number(requestedId) : null;
    return <InterviewBoard initialDetailId={detailId} />;
  }
  if (path === '/interviews/new') {
    const requestedId = new URLSearchParams(location.split('?')[1] || '').get('applicationId');
    const applicationId = requestedId && /^[1-9]\d*$/.test(requestedId) && Number.isSafeInteger(Number(requestedId)) ? requestedId : '';
    return <InterviewEditor initialApplicationId={applicationId} />;
  }
  const match = /^\/interviews\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? <InterviewEditor id={id} startEditing={new URLSearchParams(location.split('?')[1] || '').get('edit') === '1'} /> : <section className="card">
    <EmptyState title="면접 일정 주소를 확인해 주세요." /><a className="button-link" href="#/interviews">목록으로</a>
  </section>;
}

function InterviewBoard({ initialDetailId }: { initialDetailId: number | null }) {
  const [detailId, setDetailId] = useState<number | null>(initialDetailId);
  const [refreshKey, setRefreshKey] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setDetailId(initialDetailId); }, [initialDetailId]);
  function closeDetail() {
    setDetailId(null);
    if (window.location.hash.startsWith('#/interviews?detail=')) window.location.hash = '/interviews';
  }
  useEffect(() => {
    if (detailId === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDetail(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [detailId]);
  return <><InterviewOverview onOpenDetail={setDetailId} refreshKey={refreshKey} />
    {detailId !== null && <div className="interview-detail-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeDetail(); }}>
      <div className="interview-detail-modal" role="dialog" aria-modal="true" aria-labelledby="interview-detail-modal-title">
        <header className="interview-detail-modal-toolbar"><span className="interview-detail-modal-icon"><img src={interviewCalendarPixel} alt="" aria-hidden="true" /></span><div><h2 id="interview-detail-modal-title">면접 일정 상세</h2><p>면접 일정과 연결된 지원 정보를 확인하세요.</p></div><button ref={closeRef} type="button" onClick={closeDetail} aria-label="면접 일정 상세 닫기"><LucideIcon name="close" /></button></header>
        <InterviewEditor key={detailId} id={detailId} onClose={closeDetail} onUpdated={() => setRefreshKey(value => value + 1)} />
      </div>
    </div>}
  </>;
}

function InterviewEditor({ id, initialApplicationId = '', startEditing = false, onClose, onUpdated }: {
  id?: number; initialApplicationId?: string; startEditing?: boolean; onClose?: () => void; onUpdated?: () => void;
}) {
  const [item, setItem] = useState<Interview>();
  const [title, setTitle] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [stage, setStage] = useState<InterviewStage | null>('FIRST');
  const [interviewMethod, setInterviewMethod] = useState<InterviewMethod | null>('IN_PERSON');
  const [memo, setMemo] = useState('');
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [applicationRecords, setApplicationRecords] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application>();
  const [applicationPage, setApplicationPage] = useState(0);
  const [applicationTotal, setApplicationTotal] = useState(0);
  const [applicationQuery, setApplicationQuery] = useState('');
  const [applicationOpen, setApplicationOpen] = useState(false);
  const applicationPickerRef = useRef<HTMLDivElement>(null);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState('');
  const [applicationsRetry, setApplicationsRetry] = useState(0);
  const [editing, setEditing] = useState(!id || startEditing);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [loadStatus, setLoadStatus] = useState(0);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<InterviewField | null>(null);
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!applicationOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!applicationPickerRef.current?.contains(event.target as Node)) setApplicationOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [applicationOpen]);
  function accept(value: Interview) {
    setItem(value); setTitle(value.title); setLocalTime(zonedLocalInput(value.startsAt, value.timeZone));
    setStage(value.stage); setInterviewMethod(value.interviewMethod); setMemo(value.memo ?? '');
    setApplicationId(value.applicationId === null ? '' : String(value.applicationId));
  }
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); setLoading(true); setLoadError('');
    interviews.get(id, controller.signal).then(value => { if (!controller.signal.aborted) accept(value); })
      .catch(failure => { if (!controller.signal.aborted) { setLoadError(message(failure)); setLoadStatus(failure instanceof ApiError ? failure.status : 0); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    setApplicationsLoading(true); setApplicationsError('');
    applications.list({ page: applicationPage, size: 100 }, controller.signal)
      .then(value => {
        if (controller.signal.aborted) return;
        setApplicationRecords(current => applicationPage === 0 ? value.items
          : [...current, ...value.items.filter(next => !current.some(existing => existing.id === next.id))]);
        setApplicationTotal(value.totalElements);
      })
      .catch(failure => { if (!controller.signal.aborted) setApplicationsError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setApplicationsLoading(false); });
    return () => controller.abort();
  }, [editing, applicationPage, applicationsRetry]);
  useEffect(() => {
    const selectedId = Number(applicationId);
    if (!selectedId) { setSelectedApplication(undefined); return; }
    const loaded = applicationRecords.find(value => value.id === selectedId);
    if (loaded) { setSelectedApplication(loaded); return; }
    const controller = new AbortController();
    applications.detail(selectedId, controller.signal)
      .then(value => { if (!controller.signal.aborted) setSelectedApplication(value); })
      .catch(() => { if (!controller.signal.aborted) setSelectedApplication(undefined); });
    return () => controller.abort();
  }, [applicationId, applicationRecords, editing]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    setError(''); setInvalidField(null); setSuccess('');
    const linked = applicationId.trim() ? Number(applicationId) : null;
    if (linked !== null && (!Number.isSafeInteger(linked) || linked <= 0)) { setError('연결된 지원 이력을 다시 선택해 주세요.'); setInvalidField('application'); return; }
    if (!title.trim()) { setError('면접 제목을 입력해 주세요.'); setInvalidField('title'); return; }
    let schedule: { startsAt: string; timeZone: string };
    try { schedule = item && localTime === zonedLocalInput(item.startsAt, item.timeZone)
      ? { startsAt: item.startsAt, timeZone: item.timeZone } : scheduleFromLocal(localTime); }
    catch (failure) { setError(message(failure)); setInvalidField('schedule'); return; }
    inFlight.current = true; setBusy(true);
    try {
      const input = { applicationId: linked, title: title.trim(), stage, interviewMethod, memo: memo.trim() || null, ...schedule };
      const value = id ? await interviews.update(id, input) : await interviews.create(input);
      if (!mounted.current) return;
      if (!id) window.location.hash = `/interviews?detail=${value.id}`;
      else { accept(await interviews.get(id)); setEditing(false); setSuccess('면접 일정을 저장했습니다.'); onUpdated?.(); if (startEditing) window.location.hash = `/interviews/${id}`; }
    } catch (failure) { if (mounted.current) { const detail = message(failure); setError(detail); setInvalidField(fieldForError(detail)); } }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function changeStatus(action: 'cancel' | 'complete' | 'reactivate') {
    if (!id || !item || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const value = action === 'cancel' ? await interviews.cancel(id) : action === 'complete' ? await interviews.complete(id) : await interviews.reactivate(id);
      if (mounted.current) { accept(value); setSuccess(value.status === 'CANCELLED' ? '면접 일정을 취소했습니다.' : value.status === 'COMPLETED' ? '면접 일정을 완료했습니다.' : '면접 일정을 다시 활성화했습니다.'); onUpdated?.(); }
    } catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  const availableApplications = selectedApplication && !applicationRecords.some(value => value.id === selectedApplication.id)
    ? [selectedApplication, ...applicationRecords] : applicationRecords;
  const matchingApplications = availableApplications.filter(value =>
    `${applicationName(value)} ${applicationRole(value)} ${value.id}`.toLocaleLowerCase().includes(applicationQuery.trim().toLocaleLowerCase()));
  const selectedApplicationLabel = selectedApplication
    ? `${applicationName(selectedApplication)} · ${applicationRole(selectedApplication)}`
    : applicationId ? `지원번호 #${applicationId}` : '';
  const datePart = /^\d{4}-\d{2}-\d{2}/.exec(localTime)?.[0] ?? '';
  const timePart = /T(\d{2}:\d{2})$/.exec(localTime)?.[1] ?? '';
  const previewTime = localTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localTime)
    ? new Date(localTime).toLocaleString('ko-KR', { dateStyle: 'full', timeStyle: 'short' }) : '날짜와 시간을 선택해 주세요';
  return <div className={`interviews-editor-page${id ? '' : ' interviews-editor-page--new'}`}>
    {!onClose && <section className="interviews-editor-hero">
      <a className="interviews-back" href="#/interviews" aria-label="면접 일정 목록으로"><LucideIcon name="arrowLeft" /></a>
      <div><h2>{id ? '면접 일정 상세' : '면접 일정 등록'}</h2>
        <p>지원한 기업의 면접 일정을 쉽고 빠르게 기록하세요.</p></div>
      <p className="interviews-hero-bubble" aria-hidden="true">좋은 준비가<br />좋은 결과를 만들어요!<br />화이팅! ✨</p>
      <img src={interviewPlannerCat} alt="" aria-hidden="true" />
    </section>}
    {loading ? <section className="card"><LoadingState message="면접 일정을 불러오고 있습니다." /></section> : loadError
      ? <section className="card">{loadStatus === 404 || loadStatus === 403
        ? <EmptyState title={loadStatus === 404 ? '면접 일정을 찾을 수 없습니다.' : '접근 권한이 없습니다.'} message={loadError} />
        : <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />}</section> : <>
        {success && !onClose && <SuccessState compact title={success} />}
        {error && <p className="form-error" role="alert">{error}</p>}
        {editing ? <div className="interviews-editor-grid">
          <form className="card interviews-editor-form" onSubmit={save}>
            <fieldset disabled={busy}>
              <label className="interviews-field"><span><LucideIcon name="fileText" /> 면접 제목 <em aria-hidden="true">*</em></span>
                <input required maxLength={200} aria-invalid={invalidField === 'title'} placeholder="예: 백엔드 개발자 1차 면접" value={title}
                  onChange={event => { setTitle(event.target.value); setError(''); setInvalidField(null); }} />
                {invalidField === 'title' && <small className="interviews-field-error">{error}</small>}</label>
              <div className="interviews-date-row">
                <label className="interviews-field"><span><LucideIcon name="calendar" /> 면접 날짜 <em aria-hidden="true">*</em></span><input type="date" required aria-invalid={invalidField === 'schedule'} value={datePart}
                  onChange={event => { setLocalTime(`${event.target.value}T${timePart}`); setError(''); setInvalidField(null); }} /></label>
                <label className="interviews-field"><span><LucideIcon name="clock" /> 시작 시간 <em aria-hidden="true">*</em></span><input type="time" required aria-invalid={invalidField === 'schedule'} value={timePart}
                  onChange={event => { setLocalTime(`${datePart}T${event.target.value}`); setError(''); setInvalidField(null); }} /></label>
              </div>
              {invalidField === 'schedule' && <small className="interviews-field-error">{error}</small>}
              <div className="interviews-field interviews-application-picker"><span><LucideIcon name="link" /> 연결된 지원 이력 (선택)</span>
                <p className="interviews-help">어떤 지원 건의 면접인지 연결하면 나중에 일정을 더 쉽게 관리할 수 있어요.</p>
                <div className="interviews-application-combobox" ref={applicationPickerRef}>
                  <div className="interviews-search-input"><LucideIcon name="search" /><input type="text" role="combobox" aria-label="지원 이력 검색 및 선택"
                    aria-expanded={applicationOpen} aria-controls="interviews-application-list" aria-autocomplete="list"
                    placeholder="회사명 또는 직무로 검색하세요" value={applicationOpen ? applicationQuery : selectedApplicationLabel}
                    onFocus={() => { setApplicationQuery(''); setApplicationOpen(true); }}
                    onChange={event => { setApplicationQuery(event.target.value); setApplicationOpen(true); setError(''); setInvalidField(null); }}
                    onKeyDown={event => {
                      if (event.key === 'Escape') { setApplicationOpen(false); event.currentTarget.blur(); }
                      if (event.key === 'ArrowDown') setApplicationOpen(true);
                      if (event.key === 'Enter' && applicationOpen) {
                        event.preventDefault();
                        if (matchingApplications.length) { setApplicationId(String(matchingApplications[0].id)); setApplicationOpen(false); }
                      }
                    }} /></div>
                  <button className="interviews-combobox-toggle" type="button" aria-label={applicationOpen ? '지원 이력 목록 닫기' : '지원 이력 목록 열기'}
                    aria-expanded={applicationOpen} aria-controls="interviews-application-list"
                    onClick={() => { setApplicationQuery(''); setApplicationOpen(value => !value); }}><LucideIcon name="chevronDown" /></button>
                {applicationOpen && <div id="interviews-application-list" className="interviews-application-options" role="listbox" aria-label="지원 이력">
                  {applicationId && <button type="button" role="option" aria-selected={false} className="interviews-unlink"
                    onClick={() => { setApplicationId(''); setApplicationQuery(''); setApplicationOpen(false); }}>연결하지 않기</button>}
                  {matchingApplications.map(value => <button type="button" role="option" key={value.id} className={applicationId === String(value.id) ? 'is-selected' : ''}
                    aria-selected={applicationId === String(value.id)} onClick={() => { setApplicationId(String(value.id)); setApplicationQuery(''); setApplicationOpen(false); setError(''); setInvalidField(null); }}>
                    <span className="interviews-option-building"><img src={interviewBuilding} alt="" aria-hidden="true" /></span>
                    <span className="interviews-option-copy"><strong>{applicationName(value)} · {applicationRole(value)}</strong><small>{statusLabels[value.currentStatus]} · 지원번호 #{value.id}</small></span>
                    <span className="interviews-option-check" aria-hidden="true">{applicationId === String(value.id) ? <LucideIcon name="check" /> : null}</span>
                  </button>)}
                  {applicationsLoading && <p className="interviews-help" role="status">지원 이력을 불러오는 중입니다.</p>}
                  {!applicationsLoading && applicationsError && <div role="alert"><p>{applicationsError}</p><button type="button" onClick={() => setApplicationsRetry(value => value + 1)}>다시 시도</button></div>}
                  {!applicationsLoading && !applicationsError && !matchingApplications.length && <p className="interviews-help">{applicationQuery ? '검색 결과가 없습니다.' : '등록된 지원 이력이 없습니다.'}</p>}
                  {applicationRecords.length < applicationTotal && <button className="interviews-more" type="button" disabled={applicationsLoading} onClick={() => setApplicationPage(value => value + 1)}>지원 이력 더 보기</button>}
                </div>}</div>
                {invalidField === 'application' && <small className="interviews-field-error">{error}</small>}
                <p className="interviews-help">연결해도 지원 상태와 지원 관리의 다음 일정은 자동으로 바뀌지 않습니다.</p>
              </div>
              <div className="interviews-extra"><header className="interviews-section-heading"><span className="interviews-section-icon"><LucideIcon name="sliders" /></span><div><h3>추가 정보</h3><p>면접 준비에 필요한 내용을 기록해 주세요.</p></div></header>
                <div className="interviews-date-row"><div className="interviews-field"><span><LucideIcon name="sliders" /> 면접 단계</span><div className="interviews-choice-row">{(Object.keys(stageLabels) as InterviewStage[]).map(value =>
                  <button key={value} type="button" className={stage === value ? 'is-selected' : ''} aria-pressed={stage === value}
                    onClick={() => { setStage(value); setError(''); setInvalidField(null); }}>{stageLabels[value]}</button>)}</div>
                  {invalidField === 'stage' && <small className="interviews-field-error">{error}</small>}</div>
                  <div className="interviews-field"><span><LucideIcon name="monitor" /> 면접 방식</span><div className="interviews-choice-row">{(Object.keys(methodLabels) as InterviewMethod[]).map(value =>
                    <button key={value} type="button" className={interviewMethod === value ? 'is-selected' : ''} aria-pressed={interviewMethod === value}
                      onClick={() => { setInterviewMethod(value); setError(''); setInvalidField(null); }}>{methodLabels[value]}</button>)}</div>
                    {invalidField === 'method' && <small className="interviews-field-error">{error}</small>}</div></div>
                <label className="interviews-field"><span><LucideIcon name="message" /> 메모</span><textarea maxLength={500} rows={3} aria-invalid={invalidField === 'memo'} placeholder="면접 장소, 접속 링크, 준비물 등을 기록하세요." value={memo}
                  onChange={event => { setMemo(event.target.value); setError(''); setInvalidField(null); }} />
                  {invalidField === 'memo' && <small className="interviews-field-error">{error}</small>}</label>
                <small className="interviews-memo-count">{memo.length} / 500</small>
              </div>
            </fieldset>
            <div className="interviews-actions">{id ? <button type="button" disabled={busy} onClick={() => { if (item) accept(item); setEditing(false); setError(''); if (startEditing) window.location.hash = `/interviews/${id}`; }}>취소</button>
              : <a className="button-link" href="#/interviews">취소</a>}
              <button className="button-primary" disabled={busy} type="submit"><LucideIcon name="calendar" /> {busy ? '저장 중…' : '일정 저장'}</button></div>
          </form>
          <aside className="interviews-preview-column">
            <section className="card interviews-side-card"><header className="interviews-section-heading"><span className="interviews-section-icon"><LucideIcon name="briefcase" /></span><div><h3>선택된 지원 정보</h3><p>연결할 지원 이력을 확인하세요.</p></div></header>
              {selectedApplication ? <div className="interviews-selected-application"><div className="interviews-selected-heading"><span className="interviews-option-building"><img src={interviewBuilding} alt="" aria-hidden="true" /></span>
                <div><strong>{applicationName(selectedApplication)}</strong><p>{applicationRole(selectedApplication)}</p></div><span className="interviews-status">{statusLabels[selectedApplication.currentStatus]}</span></div>
                <dl><div><dt>지원번호</dt><dd>#{selectedApplication.id}</dd></div><div><dt>상태</dt><dd>{statusLabels[selectedApplication.currentStatus]}</dd></div>
                  <div><dt>지원일</dt><dd>{selectedApplication.appliedDate ?? '지원 전'}</dd></div></dl>
                <a href={`#/applications/${selectedApplication.id}`}>지원 상세 보기 <LucideIcon name="arrowRight" /></a></div>
                : <p className="interviews-help">지원 이력을 선택하면 여기에 표시됩니다.</p>}</section>
            <section className="card interviews-side-card"><header className="interviews-section-heading"><span className="interviews-section-icon"><LucideIcon name="calendar" /></span><div><h3>등록 미리보기</h3><p>이렇게 등록됩니다.</p></div></header>
              <div className="interviews-preview"><strong><LucideIcon name="calendar" /> {title.trim() || '면접 제목을 입력해 주세요'}</strong><p><LucideIcon name="clock" /> {previewTime}</p>
                <span>{stage ? stageLabels[stage] : '단계 미지정'}</span><span>{interviewMethod ? methodLabels[interviewMethod] : '방식 미지정'}</span>
                {selectedApplication && <small>{applicationName(selectedApplication)} · {applicationRole(selectedApplication)}</small>}</div></section>
            <section className="card interviews-side-card interviews-guide"><header className="interviews-section-heading"><span className="interviews-section-icon"><LucideIcon name="lightbulb" /></span><div><h3>안내</h3><p>더 편리하게 사용해 보세요.</p></div></header>
              <p><LucideIcon name="check" /> 면접 제목은 한눈에 알아볼 수 있도록 입력해 주세요.</p>
              <p><LucideIcon name="check" /> 연결한 지원 이력은 지원 상세에서 확인할 수 있습니다.</p>
              <p><LucideIcon name="check" /> 저장한 일정은 면접 일정 목록에서 수정할 수 있습니다.</p>
              <p><LucideIcon name="check" /> 지원 상태와 다음 일정은 자동으로 변경되지 않습니다.</p></section>
          </aside>
        </div> : item && <section className="card interviews-detail">
          <div className="interviews-detail-heading"><span className={`interviews-status ${item.status === 'CANCELLED' ? 'is-cancelled' : item.status === 'COMPLETED' ? 'is-completed' : ''}`}>{statusLabel(item)}</span><h3>{item.title}</h3></div>
          <dl className="interviews-detail-grid"><div className="interviews-detail-time"><dt><LucideIcon name="calendar" /> 면접 일시</dt><dd>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full', timeStyle: 'short', timeZone: item.timeZone }).format(new Date(item.startsAt))}<small>{item.timeZone === 'Asia/Seoul' ? '한국 시간' : item.timeZone}</small></dd></div>
            {item.applicationId && <div className="interviews-detail-application"><dt><LucideIcon name="briefcase" /> 연결된 지원</dt><dd><a href={`#/applications/${item.applicationId}`}>{selectedApplication ? <span><strong>{applicationName(selectedApplication)}</strong><span>{applicationRole(selectedApplication)}</span></span> : '지원 상세 보기'} <LucideIcon name="arrowRight" /></a></dd></div>}
            {item.stage && <div><dt><LucideIcon name="sliders" /> 면접 단계</dt><dd>{stageLabels[item.stage]}</dd></div>}
            {item.interviewMethod && <div><dt><LucideIcon name="monitor" /> 면접 방식</dt><dd>{methodLabels[item.interviewMethod]}</dd></div>}
            {item.memo && <div className="interviews-detail-memo"><dt><LucideIcon name="fileText" /> 메모</dt><dd>{item.memo}</dd></div>}
            {item.cancelledAt && <div><dt><LucideIcon name="clock" /> 취소 시각</dt><dd>{scheduleLabel(item.cancelledAt, item.timeZone)}</dd></div>}
            {item.completedAt && <div><dt><LucideIcon name="clock" /> 완료 시각</dt><dd>{scheduleLabel(item.completedAt, item.timeZone)}</dd></div>}</dl>
          <div className="interviews-actions"><button type="button" disabled={busy} onClick={() => { if (onClose) window.location.hash = `/interviews/${id}?edit=1`; else { setEditing(true); setSuccess(''); } }}><LucideIcon name="pencil" /> 수정</button>
            {item.status === 'SCHEDULED' ? <><button className="interviews-detail-complete" type="button" disabled={busy} onClick={() => void changeStatus('complete')}><LucideIcon name="check" /> 완료</button><button className="interviews-detail-cancel" type="button" disabled={busy} onClick={() => void changeStatus('cancel')}>일정 취소</button></>
              : <button className="interviews-detail-reactivate" type="button" disabled={busy} onClick={() => void changeStatus('reactivate')}>{busy ? '처리 중…' : '예정으로 되돌리기'}</button>}</div>
        </section>}
      </>}
  </div>;
}
