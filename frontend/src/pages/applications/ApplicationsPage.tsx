import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createApplicationsApi } from '../../api/applications';
import type { Application, ApplicationPage } from '../../api/applications';
import { applicationStatuses, statusLabels, nextStatuses, statusChangeInput, localSchedule, scheduleInput } from '../../api/application-status';
import type { ApplicationStatus } from '../../api/application-status';
import { JobStatusLabel } from '../../components/JobStatusLabel';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import './applications.css';
import { AddApplicationModal } from './AddApplicationModal';
import { LucideIcon } from '../../components/LucideIcon';
import applicationClipboardArt from '../../assets/redesign/application-clipboard-pixel.png';
import applicationDetailArt from '../../assets/redesign/application-detail-pixel.png';

const api = createApplicationsApi(apiRequest);
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString() : '일정 없음';
const failureMessage = (failure: unknown) => failure instanceof Error ? failure.message : '지원 정보를 불러오지 못했습니다.';
const boardStatuses = applicationStatuses.filter(status => status !== 'INTERESTED');

export function ApplicationsPage({ location }: { location: string }) {
  const [data, setData] = useState<Record<ApplicationStatus, ApplicationPage>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moveError, setMoveError] = useState('');
  const [retry, setRetry] = useState(0);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Application | null>(null);
  const [moving, setMoving] = useState<{ item: Application; target: ApplicationStatus; chooseOther: boolean } | null>(null);
  const [moveTarget, setMoveTarget] = useState<ApplicationStatus>('PLANNED');
  const [busy, setBusy] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const groups: { key: string; label: string; statuses: ApplicationStatus[]; target: ApplicationStatus }[] = [
    { key: 'applied', label: '서류 접수', statuses: ['APPLIED'], target: 'APPLIED' },
    { key: 'passed', label: '서류 합격', statuses: ['DOCUMENT_PASSED'], target: 'DOCUMENT_PASSED' },
    { key: 'interview', label: '면접', statuses: ['INTERVIEW'], target: 'INTERVIEW' },
    { key: 'final', label: '최종 합격', statuses: ['FINAL_PASSED'], target: 'FINAL_PASSED' },
    { key: 'rejected', label: '불합격', statuses: ['REJECTED'], target: 'REJECTED' },
    { key: 'other', label: '기타', statuses: ['PLANNED', 'WITHDRAWN'], target: 'PLANNED' },
  ];
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setLoading(true);
    Promise.all(boardStatuses.map(status => api.list({ page: 0, size: 100, status }, controller.signal)))
      .then(pages => { if (!controller.signal.aborted) setData(Object.fromEntries(boardStatuses.map((status, index) => [status, pages[index]])) as Record<ApplicationStatus, ApplicationPage>); })
      .catch(failure => { if (!controller.signal.aborted) setError(failureMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  async function loadMore(status: ApplicationStatus) {
    if (!data || moreBusy) return;
    setMoreBusy(true);
    try {
      const page = await api.list({ status, page: data[status].page + 1, size: 100 });
      setData(current => current && ({ ...current, [status]: { ...page, items: [...current[status].items, ...page.items] } }));
    } catch (failure) { setError(failureMessage(failure)); }
    finally { setMoreBusy(false); }
  }
  function requestMove(item: Application, target: ApplicationStatus, chooseOther = false) {
    if (item.currentStatus === target) return;
    setMoving({ item, target, chooseOther }); setMoveTarget(target); setMoveError('');
  }
  const backQuery = new URLSearchParams({ from: location.split('?')[1] || '' });
  return <div className="applications-page applications-page--board">
    <header className="application-board-header"><div className="application-board-heading"><img src={applicationClipboardArt} alt="" aria-hidden="true" className="size-14! [image-rendering:auto]! contrast-125 saturate-125" /><div><h1>지원 관리</h1><p>지원한 공고의 상태와 일정을 관리하세요.</p></div></div><div className="application-board-header-actions"><span className="application-board-total">{data ? `총 ${boardStatuses.reduce((sum, status) => sum + data[status].totalElements, 0)}건` : '지원 내역'}</span><button type="button" className="button-primary" onClick={() => setAdding(true)}><LucideIcon name="plus" /> 지원 내역 추가</button></div></header>
    {error && <div className="application-board-error" role="alert"><span><LucideIcon name="info" />{error}</span><button type="button" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div>}
    {loading && !data ? <LoadingState message="지원 내역을 불러오는 중입니다." /> : data && <div className="application-kanban-scroll"><div className="application-kanban">{groups.map(group => {
      const items = group.statuses.flatMap(status => data[status].items).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const count = group.statuses.reduce((sum, status) => sum + data[status].totalElements, 0);
      return <section key={group.key} className={`application-kanban-column application-kanban-column--${group.key}`} aria-label={`${group.label} ${count}건`} onDragOver={event => event.preventDefault()} onDrop={event => { if (!event.dataTransfer.types.includes('application/x-devjob')) return; event.preventDefault(); const id = Number(event.dataTransfer.getData('application/x-devjob')); const item = boardStatuses.flatMap(status => data[status].items).find(value => value.id === id); if (item) requestMove(item, group.key === 'other' && item.currentStatus === 'PLANNED' ? 'WITHDRAWN' : group.target, group.key === 'other'); }}>
        <h2>{group.label}<span>{count}</span></h2><div className="application-kanban-cards">{items.map(item => <article key={item.id} className={`application-kanban-card${group.key === 'other' ? ` application-kanban-card--${item.currentStatus.toLowerCase()}` : ''}`} draggable onDragStart={event => event.dataTransfer.setData('application/x-devjob', String(item.id))}>
          <div className="application-kanban-card-top"><div className="application-kanban-labels"><span className={`application-kind application-kind--${item.job ? 'collected' : 'manual'}`}>{item.job ? '수집 공고' : '직접 등록'}</span>{group.key === 'other' && <span className={`application-other-status application-other-status--${item.currentStatus.toLowerCase()}`}>{statusLabels[item.currentStatus]}</span>}</div><div className="application-card-menu-wrap"><button type="button" className="application-icon-button" aria-label={`${item.job?.title ?? item.personalSavedJob?.title} 메뉴`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)}>···</button>{menu === item.id && <div className="application-card-menu"><a href={`#/applications/${item.id}?${backQuery}&edit=1`}><LucideIcon name="pencil" /><span>수정</span></a><button type="button" onClick={() => { setDeleting(item); setMenu(null); }}><LucideIcon name="trash" /><span>삭제</span></button></div>}</div></div>
          <strong>{item.job?.company.name ?? item.personalSavedJob?.companyName}</strong><h3><a href={`#/applications/${item.id}?${backQuery}`}>{item.job?.title ?? item.personalSavedJob?.title}</a></h3><p className="application-kanban-meta">{item.job?.location ?? item.personalSavedJob?.location ?? '지역 미정'}</p>
          {item.appliedDate && <p className="application-kanban-date"><LucideIcon name="calendar" /> 지원일 {item.appliedDate}</p>}{item.nextScheduleAt && <p className="application-kanban-schedule"><LucideIcon name="clock" /> 다음 일정 {dateTime(item.nextScheduleAt)}</p>}{item.note && <p className="application-kanban-note">{item.note}</p>}
        </article>)}{items.length === 0 && <p className="application-kanban-empty">아직 지원 내역이 없습니다.</p>}
        {group.statuses.filter(status => data[status].items.length < data[status].totalElements).map(status => <button key={status} type="button" className="application-more" disabled={moreBusy} onClick={() => loadMore(status)}>{group.statuses.length > 1 ? `${statusLabels[status]} 더 보기` : '더 보기'}</button>)}</div>
      </section>;
    })}</div></div>}
    {adding && <AddApplicationModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); setRetry(value => value + 1); }} />}
    {deleting && <div className="application-modal-backdrop"><section className="application-confirm" role="dialog" aria-modal="true" aria-labelledby="application-delete-title"><header className="application-confirm-head"><span className="application-confirm-icon application-confirm-icon--danger"><LucideIcon name="trash" /></span><div><h2 id="application-delete-title">지원 내역을 삭제할까요?</h2><p>삭제한 내역은 지원 관리에서 보이지 않습니다.</p></div></header><div className="application-confirm-content"><strong>{deleting.job?.title ?? deleting.personalSavedJob?.title}</strong></div><footer className="application-confirm-actions"><button type="button" disabled={busy} onClick={() => setDeleting(null)}>취소</button><button type="button" className="application-danger-button" disabled={busy} onClick={async () => { setBusy(true); try { await api.delete(deleting.id); setDeleting(null); setRetry(value => value + 1); } catch (failure) { setError(failureMessage(failure)); } finally { setBusy(false); } }}>삭제</button></footer></section></div>}
    {moving && <div className="application-modal-backdrop"><form className="application-confirm" role="dialog" aria-modal="true" aria-labelledby="application-move-title" onSubmit={async event => {
      event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true);
      try { await api.changeStatus(moving.item.id, statusChangeInput(moveTarget, moving.item.appliedDate, String(values.get('appliedDate') || ''))); setMoving(null); setRetry(value => value + 1); }
      catch (failure) { setMoveError(failureMessage(failure)); } finally { setBusy(false); }
    }}><header className="application-confirm-head"><span className="application-confirm-icon"><LucideIcon name="arrowRight" /></span><div><h2 id="application-move-title">상태를 변경할까요?</h2><p>지원 내역의 진행 상태를 변경합니다.</p></div></header>
      <div className="application-confirm-content"><p className="application-confirm-transition"><span>{statusLabels[moving.item.currentStatus]}</span><LucideIcon name="arrowRight" /><strong>{statusLabels[moveTarget]}</strong></p>
        {moveError && <p className="application-modal-error" role="alert">{moveError}</p>}
        {moving.chooseOther && <label>기타 상태<select value={moveTarget} onChange={event => setMoveTarget(event.target.value as ApplicationStatus)}>{(['PLANNED', 'WITHDRAWN'] as const).filter(status => status !== moving.item.currentStatus).map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>}
        {moveTarget === 'PLANNED' && moving.item.appliedDate && <p className="application-confirm-hint">지원 예정으로 변경하면 기존 지원일이 지워집니다.</p>}
        {!moving.item.appliedDate && moveTarget !== 'PLANNED' && <label>지원일 {moveTarget === 'WITHDRAWN' ? '(선택)' : ''}<input name="appliedDate" type="date" required={moveTarget !== 'WITHDRAWN'} /></label>}
      </div><footer className="application-confirm-actions"><button type="button" disabled={busy} onClick={() => setMoving(null)}>취소</button><button type="submit" className="button-primary" disabled={busy}>변경</button></footer></form></div>}
  </div>;
}

export function ApplicationDetailPage({ location, modalOnly = false, onClose, onUpdated, onDeleted }: {
  location: string; modalOnly?: boolean; onClose?: () => void; onUpdated?: (application: Application) => void; onDeleted?: () => void;
}) {
  const path = location.split('?')[0];
  const id = Number(path.slice('/applications/'.length));
  const valid = /^\/applications\/[1-9]\d*$/.test(path) && Number.isSafeInteger(id);
  const from = new URLSearchParams(location.split('?')[1]).get('from') || '';
  const [editing, setEditing] = useState(new URLSearchParams(location.split('?')[1]).get('edit') === '1');
  const [data, setData] = useState<Application>();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
  async function save(action: () => Promise<Application>, message: string) {
    if (busy) return;
    setBusy(true); setSaveError(''); setSuccess('');
    try { const updated = await action(); setData(updated); onUpdated?.(updated); setSuccess(message); }
    catch (failure) { setSaveError(failure instanceof ApiError && failure.status === 409
      ? '상태가 변경되었거나 허용되지 않은 전이입니다. 최신 정보를 다시 확인해 주세요.' : failureMessage(failure)); }
    finally { setBusy(false); }
  }
  const boardHref = `#/applications${from ? `?${from}` : ''}`;
  return <>{!modalOnly && <ApplicationsPage location="/applications" />}<div className="application-modal-backdrop application-detail-backdrop">
    <div className="application-detail-modal" role="dialog" aria-modal="true" aria-labelledby="application-detail-title">
    <header className="application-detail-modal-head"><img src={applicationDetailArt} alt="" aria-hidden="true" /><div><h2 id="application-detail-title">지원 상세</h2><p>지원한 공고의 정보와 진행 상태를 확인하세요.</p></div><div className="application-detail-head-actions">{data && <><button type="button" className="application-detail-edit" onClick={() => setEditing(value => !value)}><LucideIcon name="pencil" /> {editing ? '보기' : '수정'}</button><button type="button" className="application-detail-delete" onClick={() => { setDeleteError(''); setDeleting(true); }}><LucideIcon name="trash" /> 삭제</button></>}{modalOnly ? <button type="button" className="application-detail-close" aria-label="닫기" onClick={onClose}><LucideIcon name="close" /></button> : <a href={boardHref} aria-label="닫기"><LucideIcon name="close" /></a>}</div></header>
    <div className="application-detail-modal-body" aria-busy={loading}>
      {loading ? <LoadingState message="지원 상세를 불러오고 있습니다." /> : missing ? <EmptyState title="지원 기록을 찾을 수 없습니다." message="목록에서 지원 기록을 다시 선택해 주세요." />
        : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : data && <>
          <div className="application-detail-job"><div className="application-detail-job-top"><span className={`application-kind application-kind--${data.job ? 'collected' : 'manual'}`}>{data.job ? '수집 공고' : '직접 등록'}</span>
            {data.job ? !modalOnly && <a href={`#/jobs/${data.job.id}`}>공고 상세 보기</a>
              : data.personalSavedJob && <a href={data.personalSavedJob.url} target="_blank" rel="noopener noreferrer">외부 원문 열기</a>}</div>
            <p>{data.job?.company.name ?? data.personalSavedJob?.companyName}</p><h3>{data.job?.title ?? data.personalSavedJob?.title}</h3></div>
          <div className="application-detail-facts"><div><span><LucideIcon name="fileText" /> 진행 상태</span><JobStatusLabel status={data.currentStatus} /></div><div><span><LucideIcon name="calendar" /> 지원일</span><strong>{data.appliedDate || '지원 전'}</strong></div>
            {(data.job?.location || data.personalSavedJob?.location) && <div><span><LucideIcon name="building" /> 지역</span><strong>{data.job?.location ?? data.personalSavedJob?.location}</strong></div>}
            {data.nextScheduleAt && <div><span><LucideIcon name="clock" /> 다음 확인 일정</span><strong>{dateTime(data.nextScheduleAt)}</strong></div>}
            {data.note && <div className="application-detail-note"><span><LucideIcon name="message" /> 메모</span><strong>{data.note}</strong></div>}</div>
          {!['FINAL_PASSED', 'REJECTED', 'WITHDRAWN'].includes(data.currentStatus) &&
            <div className="application-detail-interviews"><a href={`#/interviews/new?applicationId=${data.id}`}><LucideIcon name="calendar" /> 면접 일정 등록</a><a href="#/interviews">면접 일정 보기 <LucideIcon name="arrowRight" /></a></div>}
          {success && <SuccessState message={success} compact />}
          {saveError && <><ErrorState message={saveError} /><button type="button" disabled={busy} onClick={() => {
            setRetry(value => value + 1); setSaveError(''); setSuccess('');
          }}>최신 지원 정보 불러오기</button></>}
          {editing && <ApplicationEditor key={data.id} data={data} busy={busy} save={save} />}
        </>}
    </div></div></div>
    {deleting && <div className="application-modal-backdrop application-detail-delete-backdrop"><section className="application-confirm" role="dialog" aria-modal="true" aria-labelledby="application-detail-delete-title"><header className="application-confirm-head"><span className="application-confirm-icon application-confirm-icon--danger"><LucideIcon name="trash" /></span><div><h2 id="application-detail-delete-title">지원 내역을 삭제할까요?</h2><p>삭제한 내역은 지원 관리에서 보이지 않습니다.</p></div></header><div className="application-confirm-content"><strong>{data?.job?.title ?? data?.personalSavedJob?.title}</strong>{deleteError && <p className="application-modal-error" role="alert">{deleteError}</p>}</div><footer className="application-confirm-actions"><button type="button" disabled={busy} onClick={() => setDeleting(false)}>취소</button><button type="button" className="application-danger-button" disabled={busy || !data} onClick={async () => { if (!data) return; setBusy(true); setDeleteError(''); try { await api.delete(data.id); if (modalOnly) { onDeleted?.(); onClose?.(); } else window.location.hash = boardHref.slice(1); } catch (failure) { setDeleteError(failureMessage(failure)); } finally { setBusy(false); } }}>삭제</button></footer></section></div>}
  </>;
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
        <textarea id="application-note" name="note" defaultValue={data.note || ''} rows={3} maxLength={2000} />
        <button type="submit" className="button-primary">{busy ? '처리 중…' : '메모·일정 저장'}</button>
      </fieldset>
    </form>
    <form className="application-form" onSubmit={event => {
      event.preventDefault(); if (!selected) return;
      const values = new FormData(event.currentTarget);
      void save(() => api.changeStatus(data.id, statusChangeInput(selected, data.appliedDate, String(values.get('appliedDate') || ''))), '지원 상태를 변경했습니다.');
    }}>
      <fieldset disabled={busy || !selected}><legend>지원 상태 변경</legend>
        {selected ? <><label>다음 상태<select value={selected} onChange={event => setNext(event.target.value as ApplicationStatus)}>
          {allowed.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          {selected === 'PLANNED' && data.appliedDate && <p>지원 예정으로 변경하면 기존 지원일이 지워집니다.</p>}
          {!data.appliedDate && selected !== 'PLANNED' && <label>지원일 {selected === 'WITHDRAWN' ? '(선택)' : ''}<input name="appliedDate" type="date" required={selected !== 'WITHDRAWN'} /></label>}
          <button type="submit">상태 변경 저장</button></> : <p>종료된 지원 기록입니다.</p>}
      </fieldset>
    </form>
  </div>;
}
