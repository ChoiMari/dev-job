import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createApplicationsApi } from '../../api/applications';
import { createJobsApi } from '../../api/jobs';
import { createSavedJobsApi } from '../../api/saved-jobs';
import { newApplicationStatuses, scheduleInput, statusLabels } from '../../api/application-status';
import type { ApplicationStatus } from '../../api/application-status';
import { LucideIcon } from '../../components/LucideIcon';
import applicationAddArt from '../../assets/redesign/application-add-pixel.png';

const applications = createApplicationsApi(apiRequest);
const jobs = createJobsApi(apiRequest);
const savedJobs = createSavedJobsApi(apiRequest);
type Candidate = { kind: 'COLLECTED' | 'MANUAL'; id: number; company: string; title: string; location: string | null; applicationStatus: string | null };
type NewStatus = Extract<ApplicationStatus, typeof newApplicationStatuses[number]>;

export function AddApplicationModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [tab, setTab] = useState<'saved' | 'all'>('saved');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<NewStatus>('APPLIED');
  const requiresAppliedDate = status !== 'PLANNED' && status !== 'WITHDRAWN';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = window.setTimeout(() => {
      const task = tab === 'saved'
        ? savedJobs.list(page, 20, controller.signal).then(value => ({ items: value.items.filter(item => `${item.companyName} ${item.title}`.toLowerCase().includes(query.toLowerCase())).map(item => ({ kind: item.kind, id: item.kind === 'COLLECTED' ? item.jobId! : item.id, company: item.companyName, title: item.title, location: item.location, applicationStatus: item.applicationStatus })), more: (page + 1) * value.size < value.totalElements }))
        : jobs.list({ q: query || undefined, page, size: 20 }, controller.signal).then(value => ({ items: value.items.map(item => ({ kind: 'COLLECTED' as const, id: item.id, company: item.company.name, title: item.title, location: item.location, applicationStatus: item.applicationStatus })), more: (page + 1) * value.size < value.totalElements }));
      task.then(value => { if (!controller.signal.aborted) { setItems(previous => page ? [...previous, ...value.items] : value.items); setMore(value.more); } })
        .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '공고를 불러오지 못했습니다.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [tab, query, page]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="application-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="application-modal" role="dialog" aria-modal="true" aria-labelledby="add-application-title">
      <header className="application-modal-head"><img src={applicationAddArt} alt="" aria-hidden="true" /><div><h2 id="add-application-title">지원 내역 추가</h2><p>지원한 공고의 정보와 상태를 기록하세요.</p></div><button type="button" className="application-icon-button" aria-label="닫기" onClick={onClose}><LucideIcon name="close" /></button></header>
      <form id="add-application-form" onSubmit={async event => {
        event.preventDefault(); if (!selected || busy) return;
        setBusy(true); setError('');
        const values = new FormData(event.currentTarget);
        try {
          await applications.create({ ...(selected.kind === 'MANUAL' ? { personalSavedJobId: selected.id } : { jobId: selected.id }), status,
            appliedDate: status === 'PLANNED' ? null : String(values.get('appliedDate') || '') || null,
            nextScheduleAt: scheduleInput(String(values.get('nextScheduleAt') || '')),
            note: String(values.get('note') || '') || null });
          onAdded();
        } catch (failure) { setError(failure instanceof Error ? failure.message : '지원 내역을 추가하지 못했습니다.'); }
        finally { setBusy(false); }
      }}>
        <p className="application-modal-label">채용공고 선택 <span aria-hidden="true">*</span></p>
        <div className="application-modal-tabs" role="tablist" aria-label="공고 종류"><button type="button" role="tab" aria-selected={tab === 'saved'} onClick={() => { setTab('saved'); setPage(0); setItems([]); setSelected(null); }}>관심 공고</button><button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => { setTab('all'); setPage(0); setItems([]); setSelected(null); }}>전체 공고</button></div>
        <label className="application-modal-search"><LucideIcon name="search" /><input aria-label="회사명 또는 공고명 검색" placeholder="회사명, 공고명으로 검색하세요." value={query} onChange={event => { setQuery(event.target.value); setPage(0); setItems([]); }} /></label>
        <div className="application-candidate-list" role="radiogroup" aria-label="채용공고">{items.map(item => <button type="button" role="radio" aria-checked={selected?.kind === item.kind && selected.id === item.id} className={selected?.kind === item.kind && selected.id === item.id ? 'is-selected' : ''} key={`${item.kind}-${item.id}`} disabled={!!item.applicationStatus} onClick={() => setSelected(item)}><span className="application-candidate-mark" aria-hidden="true">{selected?.kind === item.kind && selected.id === item.id ? '●' : '○'}</span><span className="application-candidate-copy"><strong>{item.company}</strong><span className="application-candidate-title">{item.title}</span><small>{item.location || '지역 미정'}{item.applicationStatus ? ' · 이미 등록된 공고' : ''}</small></span></button>)}
          {!loading && items.length === 0 && <p className="application-candidate-empty">일치하는 공고가 없습니다.</p>}
          {loading && <p className="application-candidate-empty">공고를 불러오는 중…</p>}
        </div>
        {more && <button type="button" className="application-more" disabled={loading} onClick={() => setPage(value => value + 1)}>공고 더 보기</button>}
        <a className="application-new-job" href="#/bookmarks/new"><LucideIcon name="plus" /> 목록에 없나요? 새 공고 등록하기</a>
        <div className="application-modal-fields"><label><span className="application-field-title">지원일{requiresAppliedDate && <b aria-hidden="true"> *</b>}</span><input name="appliedDate" type="date" required={requiresAppliedDate} disabled={status === 'PLANNED'} /><small>{status === 'PLANNED' ? '지원 예정 상태에서는 입력하지 않습니다.' : status === 'WITHDRAWN' ? '실제 지원했다면 날짜를 입력해 주세요.' : '실제 지원한 날짜를 선택해 주세요.'}</small></label><label><span className="application-field-title">진행 상태 <b aria-hidden="true">*</b></span><select value={status} onChange={event => setStatus(event.target.value as NewStatus)}>{newApplicationStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><label className="application-modal-wide">다음 확인 일정 (선택)<input name="nextScheduleAt" type="datetime-local" /></label><label className="application-modal-wide">메모 (선택)<textarea name="note" maxLength={2000} rows={3} placeholder="지원 경로, 확인할 내용 등을 기록하세요." /></label></div>
        {error && <p className="application-modal-error" role="alert">{error}</p>}
      </form>
      <footer className="application-modal-footer"><button type="button" onClick={onClose}>취소</button><button type="submit" form="add-application-form" className="button-primary" disabled={!selected || busy}>{busy ? '추가 중…' : '지원 내역 추가'}</button></footer>
    </section>
  </div>;
}
