import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createInterviewsApi } from '../../api/interviews';
import type { Interview, InterviewPage } from '../../api/interviews';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import { deviceTimeZone, scheduleFromLocal, scheduleLabel, zonedLocalInput } from './interviewTime';
import interviewArt from '../../assets/redesign/ext-img-05c-interviews.png';
import './interviews.css';

const interviews = createInterviewsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '면접 일정을 처리하지 못했습니다.';
const statusLabel = (item: Interview) => item.status === 'CANCELLED' ? '취소' : Date.parse(item.startsAt) < Date.now() ? '지난 일정' : '예정';
export function InterviewsPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/interviews') return <InterviewList />;
  if (path === '/interviews/new') return <InterviewEditor />;
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

function InterviewEditor({ id }: { id?: number }) {
  const [item, setItem] = useState<Interview>();
  const [title, setTitle] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [applicationId, setApplicationId] = useState('');
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
  function accept(value: Interview) {
    setItem(value); setTitle(value.title); setLocalTime(zonedLocalInput(value.startsAt, value.timeZone));
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
      const input = { applicationId: linked, title: title.trim(), ...schedule };
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
  return <section className="card interviews-editor"><a className="button-link" href="#/interviews">← 면접 일정 목록</a>
    <h2>{id ? '면접 일정 상세' : '면접 일정 등록'}</h2>
    {loading ? <LoadingState message="면접 일정을 불러오고 있습니다." /> : loadError
      ? loadStatus === 404 || loadStatus === 403 ? <EmptyState title={loadStatus === 404 ? '면접 일정을 찾을 수 없습니다.' : '접근 권한이 없습니다.'} message={loadError} />
        : <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} /> : <>
        {success && <SuccessState compact title={success} />}
        {error && <p className="form-error" role="alert">{error}</p>}
        {editing ? <form className="interviews-form" onSubmit={save}><fieldset disabled={busy}>
          <label>면접 제목 *<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label>시작 날짜와 시각 *<input type="datetime-local" required value={localTime} onChange={event => setLocalTime(event.target.value)} /></label>
          <p className="interviews-help">새로 입력한 시각은 현재 기기 시간대({deviceTimeZone})로 저장합니다.{item && ` 현재 저장 시간대: ${item.timeZone}.`}</p>
          <label>연결할 지원 ID · 선택<input type="number" min="1" step="1" value={applicationId} onChange={event => setApplicationId(event.target.value)} /></label>
          <p className="interviews-help">본인 지원만 연결할 수 있습니다. 비워 두면 연결하지 않습니다. 지원 상태와 다음 일정은 바뀌지 않습니다.</p>
        </fieldset><div className="interviews-actions"><button className="button-primary" disabled={busy} type="submit">{busy ? '저장 중…' : '일정 저장'}</button>
          {id && <button type="button" disabled={busy} onClick={() => { if (item) accept(item); setEditing(false); setError(''); }}>수정 취소</button>}</div></form>
          : item && <div className="interviews-detail"><span className={`interviews-status ${item.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>{statusLabel(item)}</span>
            <h3>{item.title}</h3><dl><div><dt>시작</dt><dd>{scheduleLabel(item.startsAt, item.timeZone)}</dd></div>
              <div><dt>연결된 지원</dt><dd>{item.applicationId ? <a href={`#/applications/${item.applicationId}`}>지원 #{item.applicationId}</a> : '없음'}</dd></div>
              {item.cancelledAt && <div><dt>취소 시각</dt><dd>{scheduleLabel(item.cancelledAt, item.timeZone)}</dd></div>}</dl>
            <p className="interviews-help">이 일정은 지원의 다음 일정 및 지원 상태와 독립적으로 관리됩니다.</p>
            <div className="interviews-actions"><button type="button" disabled={busy} onClick={() => { setEditing(true); setSuccess(''); }}>수정</button>
              <button type="button" disabled={busy} onClick={() => void changeStatus()}>{busy ? '처리 중…' : item.status === 'CANCELLED' ? '재활성화' : '일정 취소'}</button></div>
          </div>}
      </>}
  </section>;
}
