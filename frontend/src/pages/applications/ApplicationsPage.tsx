import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createApplicationsApi } from '../../api/applications';
import type { Application, ApplicationPage, ApplicationHistory } from '../../api/applications';
import { applicationStatuses, statusLabels, nextStatuses, isApplicationStatus, localSchedule, scheduleInput } from '../../api/application-status';
import type { ApplicationStatus } from '../../api/application-status';
import { ApplicationStatusBadge } from '../../components/ApplicationStatusBadge';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import './applications.css';

const api = createApplicationsApi(apiRequest);
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString() : '일정 없음';
const failureMessage = (failure: unknown) => failure instanceof Error ? failure.message : '지원 정보를 불러오지 못했습니다.';

export function ApplicationsPage({ location }: { location: string }) {
  const search = location.split('?')[1] || '';
  const params = new URLSearchParams(search);
  const page = Number(params.get('page') || 0);
  const filter = params.get('status');
  const valid = Number.isSafeInteger(page) && page >= 0 && page * 20 <= 2147483647 && (filter === null || isApplicationStatus(filter));
  const [data, setData] = useState<ApplicationPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined); setError(''); setLoading(true);
    if (!valid) { setLoading(false); setError('지원 목록의 페이지·상태값을 확인해 주세요.'); return; }
    api.list({ page, size: 20, status: filter as ApplicationStatus | undefined || undefined }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failureMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, filter, valid, retry]);
  function navigate(next: number) {
    const query = new URLSearchParams(search); query.set('page', String(next)); window.location.hash = `/applications?${query}`;
  }
  const backQuery = new URLSearchParams({ from: search });
  return <div className="applications-page">
    <section className="card">
      <div className="application-actions"><label>지원 상태 필터<select value={filter || ''} onChange={event => {
        const query = new URLSearchParams(); if (event.target.value) query.set('status', event.target.value);
        query.set('page', '0'); window.location.hash = `/applications?${query}`;
      }}><option value="">전체 상태</option>{applicationStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <a className="button-link" href="#/jobs">공고에서 지원 등록</a></div>
      <p>각 지원 건의 상세에서 다음 단계, 메모와 일정을 관리하세요.</p>
    </section>
    <section className="card application-results" aria-busy={loading} aria-label="지원 현황">
      {loading ? <LoadingState message="지원 목록을 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : data && <>
        <p role="status">총 {data.totalElements}건 · {data.page + 1}페이지 · 현재 페이지 {data.items.length}건</p>
        {data.items.length === 0 ? <><EmptyState title="지원 기록이 없습니다." message={page > 0 ? '첫 페이지에서 지원 기록을 확인해 주세요.' : filter ? '다른 상태를 선택하거나 공고에서 지원을 등록하세요.' : '공고 상세에서 관심·지원 예정·지원 완료를 등록해 보세요.'} />
          {page > 0 && <button onClick={() => navigate(0)}>첫 페이지로</button>}</> : <div className="application-board">
          {(filter ? [filter as ApplicationStatus] : applicationStatuses).map(status => <section className="application-column" key={status} aria-label={statusLabels[status]}>
            <h2><ApplicationStatusBadge status={status} /></h2>
            <ul>{data.items.filter(item => item.currentStatus === status).map(item => <li className="application-card" key={item.id}>
              <p>{item.job.company.name}</p><h3><a href={`#/applications/${item.id}?${backQuery}`}>{item.job.title}</a></h3>
              <dl><div><dt>지원일</dt><dd>{item.appliedDate || '지원 전'}</dd></div>
                <div><dt>다음 일정</dt><dd>{dateTime(item.nextScheduleAt)}</dd></div>
                <div><dt>메모</dt><dd className="application-note">{item.note || '메모 없음'}</dd></div></dl>
              <a className="button-link" href={`#/applications/${item.id}?${backQuery}`}>지원 상세</a>
            </li>)}</ul>
            {!data.items.some(item => item.currentStatus === status) && <p>이 페이지에 기록이 없습니다.</p>}
          </section>)}
        </div>}
        <nav className="application-actions" aria-label="지원 페이지"><button disabled={page === 0} onClick={() => navigate(page - 1)}>이전 페이지</button>
          <button disabled={(page + 1) * 20 >= data.totalElements} onClick={() => navigate(page + 1)}>다음 페이지</button></nav>
      </>}
    </section>
  </div>;
}

export function ApplicationDetailPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  const id = Number(path.slice('/applications/'.length));
  const valid = /^\/applications\/[1-9]\d*$/.test(path) && Number.isSafeInteger(id);
  const from = new URLSearchParams(location.split('?')[1]).get('from') || '';
  const [data, setData] = useState<Application>();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState<ApplicationHistory[]>();
  const [historyError, setHistoryError] = useState('');
  const [historyRetry, setHistoryRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined); setLoading(true); setMissing(false); setError('');
    if (!valid) { setError('지원 주소를 확인해 주세요.'); setLoading(false); return; }
    api.detail(id, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => {
        if (controller.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 404) setMissing(true);
        else setError(failureMessage(failure));
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, valid, retry]);
  useEffect(() => {
    if (!data) return;
    const controller = new AbortController(); setHistory(undefined); setHistoryError('');
    api.history(id, controller.signal).then(value => { if (!controller.signal.aborted) setHistory(value); })
      .catch(failure => { if (!controller.signal.aborted) setHistoryError(failureMessage(failure)); });
    return () => controller.abort();
  }, [id, data?.updatedAt, historyRetry]);
  async function save(action: () => Promise<Application>, message: string) {
    if (busy) return;
    setBusy(true); setSaveError(''); setSuccess('');
    try { setData(await action()); setSuccess(message); setHistoryRetry(value => value + 1); }
    catch (failure) { setSaveError(failure instanceof ApiError && failure.status === 409
      ? '상태가 변경되었거나 허용되지 않은 전이입니다. 최신 정보를 다시 확인해 주세요.' : failureMessage(failure)); }
    finally { setBusy(false); }
  }
  return <div className="applications-page">
    <a className="button-link" href={`#/applications${from ? `?${from}` : ''}`}>← 지원 목록</a>
    <section className="card" aria-busy={loading}>
      {loading ? <LoadingState message="지원 상세를 불러오고 있습니다." /> : missing ? <EmptyState title="지원 기록을 찾을 수 없습니다." message="목록에서 지원 기록을 다시 선택해 주세요." />
        : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : data && <>
          <p>{data.job.company.name}</p><h2>{data.job.title}</h2><ApplicationStatusBadge status={data.currentStatus} />
          <p>지원일: {data.appliedDate || '지원 전'}</p><a className="button-link" href={`#/jobs/${data.job.id}`}>공고 상세 보기</a>
          {success && <SuccessState message={success} compact />}
          {saveError && <><ErrorState message={saveError} /><button type="button" disabled={busy} onClick={() => {
            setRetry(value => value + 1); setSaveError(''); setSuccess('');
          }}>최신 지원 정보 불러오기</button></>}
          <ApplicationEditor key={data.id} data={data} busy={busy} save={save} />
        </>}
    </section>
    {data && <section className="card"><h2>상태 변경 이력</h2>
      {historyError ? <ErrorState message={historyError} onRetry={() => setHistoryRetry(value => value + 1)} />
        : !history ? <LoadingState message="상태 이력을 불러오고 있습니다." /> : <ol className="application-history">{history.map(item => <li key={item.id}>
          <span>{item.fromStatus ? statusLabels[item.fromStatus] : '최초 등록'} → {statusLabels[item.toStatus]}</span>
          <time dateTime={item.changedAt}>{dateTime(item.changedAt)}</time>
        </li>)}</ol>}
    </section>}
  </div>;
}

function ApplicationEditor({ data, busy, save }: {
  data: Application; busy: boolean; save: (action: () => Promise<Application>, message: string) => Promise<void>;
}) {
  const allowed = nextStatuses[data.currentStatus];
  const [next, setNext] = useState<ApplicationStatus | ''>('');
  const selected = next && allowed.includes(next) ? next : allowed[0] || '';
  return <div className="application-editor">
    <form className="application-form" key={data.updatedAt} onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      // Preserve an existing instant, including seconds, when only the note changes.
      const schedule = String(values.get('nextScheduleAt') || '');
      const input = { note: String(values.get('note') || '') || null,
        ...(schedule !== localSchedule(data.nextScheduleAt) ? { nextScheduleAt: scheduleInput(schedule) } : {}) };
      void save(() => api.update(data.id, input), '메모와 일정을 저장했습니다.');
    }}>
      <fieldset disabled={busy}><legend>메모·일정 수정</legend>
        <label>다음 일정 (내 시간대)<input name="nextScheduleAt" type="datetime-local" defaultValue={localSchedule(data.nextScheduleAt)} /></label>
        <label htmlFor="application-note">메모</label>
        <textarea id="application-note" name="note" defaultValue={data.note || ''} rows={5} maxLength={2000} />
        <button type="submit" className="button-primary">{busy ? '처리 중…' : '메모·일정 저장'}</button>
      </fieldset>
    </form>
    <form className="application-form" onSubmit={event => {
      event.preventDefault(); if (!selected) return;
      const values = new FormData(event.currentTarget);
      void save(() => api.changeStatus(data.id, { status: selected,
        appliedDate: selected === 'APPLIED' ? String(values.get('appliedDate')) : null }), '지원 상태를 변경했습니다.');
    }}>
      <fieldset disabled={busy || !selected}><legend>지원 상태 변경</legend>
        {selected ? <><label>다음 상태<select value={selected} onChange={event => setNext(event.target.value as ApplicationStatus)}>
          {allowed.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          {selected === 'APPLIED' && <label>지원일<input name="appliedDate" type="date" required /></label>}
          <button type="submit">상태 변경 저장</button></> : <p>종료된 지원 기록입니다.</p>}
      </fieldset>
    </form>
  </div>;
}
