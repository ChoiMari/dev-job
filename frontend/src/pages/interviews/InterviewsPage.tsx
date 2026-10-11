import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createInterviewsApi } from '../../api/interviews';
import type { Interview, InterviewPage, InterviewStage, InterviewMethod } from '../../api/interviews';
import { createApplicationsApi } from '../../api/applications';
import type { Application } from '../../api/applications';
import { statusLabels } from '../../api/application-status';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import { scheduleFromLocal, scheduleLabel, zonedLocalInput } from './interviewTime';
import interviewArt from '../../assets/redesign/ext-img-05c-interviews.png';
import interviewPlannerCat from '../../assets/redesign/interview-planner-cat.png';
import interviewBuilding from '../../assets/redesign/interview-building.png';
import './interviews.css';

const interviews = createInterviewsApi(apiRequest);
const applications = createApplicationsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '면접 일정을 처리하지 못했습니다.';
const statusLabel = (item: Interview) => item.status === 'CANCELLED' ? '취소' : Date.parse(item.startsAt) < Date.now() ? '지난 일정' : '예정';
const applicationName = (item: Application) => item.job?.company.name ?? item.personalSavedJob?.companyName ?? '회사 정보 없음';
const applicationRole = (item: Application) => item.job?.title ?? item.personalSavedJob?.title ?? '공고 제목 없음';
const stageLabels: Record<InterviewStage, string> = { FIRST: '1차', SECOND: '2차', FINAL: '최종', OTHER: '기타' };
const methodLabels: Record<InterviewMethod, string> = { IN_PERSON: '대면', ONLINE: '온라인', PHONE: '전화' };
export function InterviewsPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/interviews') return <InterviewList />;
  if (path === '/interviews/new') {
    const requestedId = new URLSearchParams(location.split('?')[1] || '').get('applicationId');
    const applicationId = requestedId && /^[1-9]\d*$/.test(requestedId) && Number.isSafeInteger(Number(requestedId)) ? requestedId : '';
    return <InterviewEditor initialApplicationId={applicationId} />;
  }
  const match = /^\/interviews\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? <InterviewEditor id={id} /> : <section className="card">
    <EmptyState title="면접 일정 주소를 확인해 주세요." /><a className="button-link" href="#/interviews">목록으로</a>
  </section>;
}

function InterviewList() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<InterviewPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setResult(undefined);
    interviews.list(page, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  return <div className="interviews-page"><section className="card interviews-hero">
    <div><span className="eyebrow">INTERVIEW PLAN</span><h2>면접 일정</h2>
      <p>면접 일정을 별도로 기록하고 취소 상태도 보관합니다. 지원의 다음 일정은 자동으로 바뀌지 않습니다.</p>
      <a className="button-link button-primary" href="#/interviews/new">면접 일정 등록</a></div>
    <img src={interviewArt} alt="" aria-hidden="true" width="180" height="180" /></section>
    <section className="card interviews-content" aria-labelledby="interviews-list-title"><h2 id="interviews-list-title">내 일정</h2>
      {loading ? <LoadingState message="면접 일정을 불러오고 있습니다." /> : error
        ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : result && <>
          {result.items.length ? <ul className="interviews-list">{result.items.map(item => <li key={item.id}>
            <div><span className={`interviews-status ${item.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>{statusLabel(item)}</span>
              <h3><a href={`#/interviews/${item.id}`}>{item.title}</a></h3>
              <p>{scheduleLabel(item.startsAt, item.timeZone)}</p>
              {item.applicationId && <a href={`#/applications/${item.applicationId}`}>연결된 지원 #{item.applicationId}</a>}</div>
          </li>)}</ul> : <EmptyState title={page ? '이 페이지에 일정이 없습니다.' : '등록한 면접 일정이 없습니다.'} message="새 일정을 등록해 관리하세요." />}
          <div className="interviews-actions"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>이전</button>
            <span role="status">총 {result.totalElements}건 · {page + 1}페이지</span>
            <button type="button" disabled={(page + 1) * result.size >= result.totalElements} onClick={() => setPage(value => value + 1)}>다음</button></div>
        </>}
    </section></div>;
}

function InterviewEditor({ id, initialApplicationId = '' }: { id?: number; initialApplicationId?: string }) {
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
  const [editing, setEditing] = useState(!id);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [loadStatus, setLoadStatus] = useState(0);
  const [error, setError] = useState('');
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
    if (!selectedId || !editing) { setSelectedApplication(undefined); return; }
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
    setError(''); setSuccess('');
    const linked = applicationId.trim() ? Number(applicationId) : null;
    if (linked !== null && (!Number.isSafeInteger(linked) || linked <= 0)) { setError('지원 ID는 양의 정수로 입력해 주세요.'); return; }
    if (!title.trim()) { setError('면접 제목을 입력해 주세요.'); return; }
    let schedule: { startsAt: string; timeZone: string };
    try { schedule = item && localTime === zonedLocalInput(item.startsAt, item.timeZone)
      ? { startsAt: item.startsAt, timeZone: item.timeZone } : scheduleFromLocal(localTime); }
    catch (failure) { setError(message(failure)); return; }
    inFlight.current = true; setBusy(true);
    try {
      const input = { applicationId: linked, title: title.trim(), stage, interviewMethod, memo: memo.trim() || null, ...schedule };
      const value = id ? await interviews.update(id, input) : await interviews.create(input);
      if (!mounted.current) return;
      if (!id) window.location.hash = `/interviews/${value.id}`;
      else { accept(await interviews.get(id)); setEditing(false); setSuccess('면접 일정을 저장했습니다.'); }
    } catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function changeStatus() {
    if (!id || !item || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const value = item.status === 'CANCELLED' ? await interviews.reactivate(id) : await interviews.cancel(id);
      if (mounted.current) { accept(value); setSuccess(value.status === 'CANCELLED' ? '면접 일정을 취소했습니다.' : '면접 일정을 다시 활성화했습니다.'); }
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
  return <div className="interviews-editor-page">
    <section className="interviews-editor-hero">
      <a className="interviews-back" href="#/interviews" aria-label="면접 일정 목록으로"><LucideIcon name="arrowLeft" /></a>
      <div><h2>{id ? '면접 일정 상세' : '면접 일정 등록'}</h2>
        <p>지원한 기업의 면접 일정을 쉽고 빠르게 기록하세요.</p></div>
      <p className="interviews-hero-bubble" aria-hidden="true">좋은 준비가<br />좋은 결과를 만들어요!<br />화이팅! ✨</p>
      <img src={interviewPlannerCat} alt="" aria-hidden="true" />
    </section>
    {loading ? <section className="card"><LoadingState message="면접 일정을 불러오고 있습니다." /></section> : loadError
      ? <section className="card">{loadStatus === 404 || loadStatus === 403
        ? <EmptyState title={loadStatus === 404 ? '면접 일정을 찾을 수 없습니다.' : '접근 권한이 없습니다.'} message={loadError} />
        : <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />}</section> : <>
        {success && <SuccessState compact title={success} />}
        {error && <p className="form-error" role="alert">{error}</p>}
        {editing ? <div className="interviews-editor-grid">
          <form className="card interviews-editor-form" onSubmit={save}>
            <fieldset disabled={busy}>
              <header className="interviews-section-heading"><span className="interviews-section-icon"><LucideIcon name="fileText" /></span><div><h3>기본 정보</h3><p>면접 일정의 기본 정보를 입력해 주세요.</p></div></header>
              <label className="interviews-field"><span><LucideIcon name="fileText" /> 면접 제목 <em aria-hidden="true">*</em></span>
                <input required maxLength={200} placeholder="예: 백엔드 개발자 1차 면접" value={title} onChange={event => setTitle(event.target.value)} /></label>
              <div className="interviews-date-row">
                <label className="interviews-field"><span><LucideIcon name="calendar" /> 면접 날짜 <em aria-hidden="true">*</em></span><input type="date" required value={datePart}
                  onChange={event => setLocalTime(`${event.target.value}T${timePart}`)} /></label>
                <label className="interviews-field"><span><LucideIcon name="clock" /> 시작 시간 <em aria-hidden="true">*</em></span><input type="time" required value={timePart}
                  onChange={event => setLocalTime(`${datePart}T${event.target.value}`)} /></label>
              </div>
              <div className="interviews-field interviews-application-picker"><span><LucideIcon name="link" /> 연결된 지원 이력 (선택)</span>
                <p className="interviews-help">어떤 지원 건의 면접인지 연결하면 나중에 일정을 더 쉽게 관리할 수 있어요.</p>
                <div className="interviews-application-combobox" ref={applicationPickerRef}>
                  <div className="interviews-search-input"><LucideIcon name="search" /><input type="text" role="combobox" aria-label="지원 이력 검색 및 선택"
                    aria-expanded={applicationOpen} aria-controls="interviews-application-list" aria-autocomplete="list"
                    placeholder="회사명 또는 직무로 검색하세요" value={applicationOpen ? applicationQuery : selectedApplicationLabel}
                    onFocus={() => { setApplicationQuery(''); setApplicationOpen(true); }}
                    onChange={event => { setApplicationQuery(event.target.value); setApplicationOpen(true); }}
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
                    aria-selected={applicationId === String(value.id)} onClick={() => { setApplicationId(String(value.id)); setApplicationQuery(''); setApplicationOpen(false); }}>
                    <span className="interviews-option-building"><img src={interviewBuilding} alt="" aria-hidden="true" /></span>
                    <span className="interviews-option-copy"><strong>{applicationName(value)} · {applicationRole(value)}</strong><small>{statusLabels[value.currentStatus]} · 지원번호 #{value.id}</small></span>
                    <span className="interviews-option-check" aria-hidden="true">{applicationId === String(value.id) ? <LucideIcon name="check" /> : null}</span>
                  </button>)}
                  {applicationsLoading && <p className="interviews-help" role="status">지원 이력을 불러오는 중입니다.</p>}
                  {!applicationsLoading && applicationsError && <div role="alert"><p>{applicationsError}</p><button type="button" onClick={() => setApplicationsRetry(value => value + 1)}>다시 시도</button></div>}
                  {!applicationsLoading && !applicationsError && !matchingApplications.length && <p className="interviews-help">{applicationQuery ? '검색 결과가 없습니다.' : '등록된 지원 이력이 없습니다.'}</p>}
                  {applicationRecords.length < applicationTotal && <button className="interviews-more" type="button" disabled={applicationsLoading} onClick={() => setApplicationPage(value => value + 1)}>지원 이력 더 보기</button>}
                </div>}</div>
                <p className="interviews-help">연결해도 지원 상태와 지원 관리의 다음 일정은 자동으로 바뀌지 않습니다.</p>
              </div>
              <div className="interviews-extra"><header className="interviews-section-heading"><span className="interviews-section-icon"><LucideIcon name="sliders" /></span><div><h3>추가 정보</h3><p>면접 준비에 필요한 내용을 기록해 주세요.</p></div></header>
                <div className="interviews-date-row"><div className="interviews-field"><span><LucideIcon name="sliders" /> 면접 단계</span><div className="interviews-choice-row">{(Object.keys(stageLabels) as InterviewStage[]).map(value =>
                  <button key={value} type="button" className={stage === value ? 'is-selected' : ''} aria-pressed={stage === value} onClick={() => setStage(value)}>{stageLabels[value]}</button>)}</div></div>
                  <div className="interviews-field"><span><LucideIcon name="monitor" /> 면접 방식</span><div className="interviews-choice-row">{(Object.keys(methodLabels) as InterviewMethod[]).map(value =>
                    <button key={value} type="button" className={interviewMethod === value ? 'is-selected' : ''} aria-pressed={interviewMethod === value} onClick={() => setInterviewMethod(value)}>{methodLabels[value]}</button>)}</div></div></div>
                <label className="interviews-field"><span><LucideIcon name="message" /> 메모</span><textarea maxLength={500} rows={3} placeholder="면접 장소, 접속 링크, 준비물 등을 기록하세요." value={memo} onChange={event => setMemo(event.target.value)} /></label>
                <small className="interviews-memo-count">{memo.length} / 500</small>
              </div>
            </fieldset>
            <div className="interviews-actions">{id ? <button type="button" disabled={busy} onClick={() => { if (item) accept(item); setEditing(false); setError(''); }}>취소</button>
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
        </div> : item && <section className="card interviews-editor interviews-detail"><span className={`interviews-status ${item.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>{statusLabel(item)}</span>
          <h3>{item.title}</h3><dl><div><dt>시작</dt><dd>{scheduleLabel(item.startsAt, item.timeZone)}</dd></div>
            <div><dt>연결된 지원</dt><dd>{item.applicationId ? <a href={`#/applications/${item.applicationId}`}>지원 #{item.applicationId}</a> : '없음'}</dd></div>
            <div><dt>면접 단계</dt><dd>{item.stage ? stageLabels[item.stage] : '미지정'}</dd></div>
            <div><dt>면접 방식</dt><dd>{item.interviewMethod ? methodLabels[item.interviewMethod] : '미지정'}</dd></div>
            {item.memo && <div><dt>메모</dt><dd>{item.memo}</dd></div>}
            {item.cancelledAt && <div><dt>취소 시각</dt><dd>{scheduleLabel(item.cancelledAt, item.timeZone)}</dd></div>}</dl>
          <p className="interviews-help">이 일정은 지원의 다음 일정 및 지원 상태와 독립적으로 관리됩니다.</p>
          <div className="interviews-actions"><button type="button" disabled={busy} onClick={() => { setEditing(true); setSuccess(''); }}>수정</button>
            <button type="button" disabled={busy} onClick={() => void changeStatus()}>{busy ? '처리 중…' : item.status === 'CANCELLED' ? '재활성화' : '일정 취소'}</button></div>
        </section>}
      </>}
  </div>;
}
