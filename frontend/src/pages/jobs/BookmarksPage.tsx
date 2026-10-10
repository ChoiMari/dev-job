import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createSavedJobsApi } from '../../api/saved-jobs';
import type { ManualSavedJobInput, SavedJob, SavedJobsPage } from '../../api/saved-jobs';
import { createBookmarksApi } from '../../api/bookmarks';
import { createAnalysisApi } from '../../api/analysis';
import { ApiError } from '../../api/client';
import { ApplicationRegistration } from '../../components/ApplicationRegistration';
import { Badge } from '../../components/PixelArt';
import { ApplicationStatusBadge } from '../../components/ApplicationStatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import './jobs.css';
import savedJobsArt from '../../assets/redesign/cur-05-saved-jobs.png';
import { ManualJobDetailPage } from './ManualJobDetailPage';

const savedJobs = createSavedJobsApi(apiRequest);
const bookmarks = createBookmarksApi(apiRequest);
const roleLabels: Record<string, string> = { DEVELOPMENT: '개발', DATA_AI: '데이터·AI', SECURITY: '보안',
  INFRA: '클라우드·인프라', IT_OPERATIONS: '전산·IT 운영' };
const optional = (form: FormData, name: string) => String(form.get(name) || '').trim() || null;
function formInput(form: FormData): ManualSavedJobInput {
  return { url: String(form.get('url') || '').trim(), companyName: String(form.get('companyName') || '').trim(),
    title: String(form.get('title') || '').trim(), role: optional(form, 'role'), careerLevel: optional(form, 'careerLevel'),
    location: optional(form, 'location'), employmentType: optional(form, 'employmentType'),
    deadlineDate: optional(form, 'deadlineDate'), note: optional(form, 'note'), description: optional(form, 'description') };
}
export function BookmarksPage({ location }: { location: string }) {
  const search = location.split('?')[1] || '';
  const params = new URLSearchParams(search);
  const page = Number(params.get('page') || 0);
  const size = 20;
  const [data, setData] = useState<SavedJobsPage>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<SavedJob | null>(null);
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedManual, setSelectedManual] = useState<SavedJob | null>(null);
  const navigatePage = (next: number) => { window.location.hash = `/bookmarks?page=${next}`; };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setData(undefined);
    if (!Number.isSafeInteger(page) || page < 0 || page * size > 2147483647) {
      setError('관심공고 페이지 주소를 확인해 주세요.'); setLoading(false); return;
    }
    savedJobs.list(page, size, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '관심공고를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  if (selectedManual) return <ManualJobDetailPage location={`/bookmarks/${selectedManual.id}`}
    initialApplicationStatus={selectedManual.applicationStatus} onBack={() => setSelectedManual(null)} />;
  return <div className="jobs-page"><a className="button-link" href="#/jobs">채용공고 찾아보기</a>
    <section className="card" aria-label="관심 공고 목록" aria-busy={loading}>
      <div className="job-search-heading job-hero"><div><p className="job-eyebrow">MY SAVED JOBS</p><h2>내 관심공고</h2><p>수집 공고 북마크와 직접 등록한 개인 공고를 한곳에서 관리합니다.</p>
        <button type="button" className="button-primary" onClick={() => { setEditing(null); setFormError(''); setShowForm(true); }}>+ 관심공고 직접 등록</button></div><img src={savedJobsArt} alt="" aria-hidden="true" /></div>
      {showForm && <form className="application-form" key={editing?.id || 'new'} onSubmit={async event => {
        event.preventDefault(); if (saving) return;
        const input = formInput(new FormData(event.currentTarget)); setSaving(true); setFormError('');
        try {
          if (editing) await savedJobs.update(editing.id, input); else await savedJobs.create(input);
          setShowForm(false); setEditing(null); setRetry(value => value + 1);
          if (!editing && page > 0) navigatePage(0);
        } catch (failure) { setFormError(failure instanceof ApiError && failure.status === 409
          ? '이미 저장한 URL입니다.' : failure instanceof Error ? failure.message : '저장하지 못했습니다.'); }
        finally { setSaving(false); }
      }}><fieldset disabled={saving}><legend>{editing ? '직접 등록 공고 수정' : '관심공고 직접 등록'}</legend>
        <label>채용공고 URL *<input name="url" type="url" required maxLength={2048} defaultValue={editing?.url || ''} /></label>
        <label>기업명 *<input name="companyName" required maxLength={200} defaultValue={editing?.companyName || ''} /></label>
        <label>채용공고 제목 *<input name="title" required maxLength={300} defaultValue={editing?.title || ''} /></label>
        <label>직무<input name="role" maxLength={120} defaultValue={editing?.role || ''} /></label>
        <label>경력<input name="careerLevel" maxLength={120} defaultValue={editing?.careerLevel || ''} /></label>
        <label>근무지역<input name="location" maxLength={200} defaultValue={editing?.location || ''} /></label>
        <label>고용형태<input name="employmentType" maxLength={120} defaultValue={editing?.employmentType || ''} /></label>
        <label>마감일<input name="deadlineDate" type="date" defaultValue={editing?.deadlineDate || ''} /></label>
        <label>메모<textarea name="note" maxLength={2000} rows={3} defaultValue={editing?.note || ''} /></label>
        <label>공고 본문 (AI 분석 입력)<textarea name="description" maxLength={12000} rows={8} defaultValue={editing?.description || ''} /></label>
        {formError && <ErrorState message={formError} />}
        <div className="job-actions"><button className="button-primary" type="submit">{saving ? '저장 중…' : '저장'}</button>
          <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}>취소</button></div>
      </fieldset></form>}
      {actionError && <ErrorState message={actionError} onRetry={() => { setActionError(''); setRetry(value => value + 1); }} />}
      {loading ? <LoadingState message="관심공고를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : data && <>
        <p role="status">총 {data.totalElements}건 · {data.page + 1}페이지</p>
        {data.items.length === 0 ? <EmptyState title="저장한 관심공고가 없습니다." message="채용공고를 저장하거나 직접 등록해 보세요." />
          : <ul className="job-list">{data.items.map(item => <li className="job-card" key={`${item.kind}-${item.id}`}>
            <Badge icon="check" tone="success">{item.kind === 'MANUAL' ? '직접 등록' : item.source === 'ALIO_RECRUITMENT' ? '공공기관 수집' : '수집 공고'}</Badge>
            {item.applicationStatus && <ApplicationStatusBadge status={item.applicationStatus} />}
            <p className="job-company">{item.companyName}</p><h2>{item.kind === 'COLLECTED' && item.jobId
              ? <a href={`#/jobs/${item.jobId}?origin=bookmarks`}>{item.title}</a> : <button className="job-title-button" type="button" onClick={() => setSelectedManual(item)}>{item.title}</button>}</h2>
            <p>직무: {item.role ? roleLabels[item.role] || item.role : '정보 없음'} · 경력: {item.careerLevel || '정보 없음'} · 지역: {item.location || '정보 없음'}</p>
            <p>고용형태: {item.employmentType || '정보 없음'} · 마감일: {item.deadlineDate || '정보 없음'}</p>
            <p>저장일: {new Date(item.createdAt).toLocaleDateString('ko-KR')}</p>
            <SavedAnalysis item={item} onUpdated={() => setRetry(value => value + 1)} />
            <div className="job-actions"><a className="button-link" href={item.url} target="_blank" rel="noopener noreferrer">외부 원문 열기</a>
              {item.kind === 'MANUAL' ? <><button type="button" onClick={() => { setEditing(item); setShowForm(true); window.scrollTo(0, 0); }}>수정</button>
                <button type="button" onClick={async () => {
                  if (!window.confirm('이 관심공고를 삭제할까요? 지원 기록은 유지됩니다.')) return;
                  setActionError('');
                  try { await savedJobs.delete(item.id); setRetry(value => value + 1); }
                  catch (failure) { setActionError(failure instanceof Error ? failure.message : '삭제하지 못했습니다.'); }
                }}>삭제</button></> : <button type="button" onClick={async () => {
                  try { await bookmarks.remove(item.jobId!); setRetry(value => value + 1); }
                  catch (failure) { setActionError(failure instanceof Error ? failure.message : '관심공고를 해제하지 못했습니다.'); }
                }}>관심 해제</button>}</div>
            {item.kind === 'MANUAL' && <ApplicationRegistration personalSavedJobId={item.id} status={item.applicationStatus}
              onCreated={() => setRetry(value => value + 1)} />}
            {item.kind === 'COLLECTED' && item.applicationStatus && <a className="button-link" href="#/applications">지원관리</a>}
          </li>)}</ul>}
        <nav className="job-actions job-pagination" aria-label="관심공고 페이지"><button disabled={page === 0} onClick={() => navigatePage(page - 1)}>이전 페이지</button>
          <button disabled={(page + 1) * size >= data.totalElements} onClick={() => navigatePage(page + 1)}>다음 페이지</button></nav>
      </>}
    </section></div>;
}

type Preview = { status: string; requiredSkills: string[]; preferredSkills: string[]; failureReason: string | null };
function SavedAnalysis({ item, onUpdated }: { item: SavedJob; onUpdated: () => void }) {
  const [analysis, setAnalysis] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!item.analysisStatus) { setAnalysis(null); return; }
    let active = true;
    let timer: number | null = null;
    const fetchPreview = (): Promise<Preview> => item.kind === 'MANUAL' ? savedJobs.analysis(item.id).then(manualAnalysis)
      : createAnalysisApi(apiRequest).get(item.jobId!).then(value => ({
        status: value.status, requiredSkills: value.requiredSkills.map(skill => skill.name),
        preferredSkills: value.preferredSkills.map(skill => skill.name), failureReason: value.failureReason,
      }));
    fetchPreview().then(value => {
      if (active) { setAnalysis(value); setError(''); if (value.status !== 'PENDING' && timer !== null) window.clearInterval(timer); }
    }).catch(() => { if (active) setError('분석 결과를 불러오지 못했습니다.'); });
    timer = item.analysisStatus === 'PENDING' ? window.setInterval(() => {
      fetchPreview().then(value => { if (active) { setAnalysis(value); setError('');
        if (value.status !== 'PENDING' && timer !== null) window.clearInterval(timer); } })
        .catch(() => { if (active) setError('분석 결과를 불러오지 못했습니다.'); });
    }, 2000) : null;
    return () => { active = false; if (timer !== null) window.clearInterval(timer); };
  }, [item.kind, item.id, item.jobId, item.analysisStatus]);
  const run = async () => {
    setBusy(true); setError('');
    try { setAnalysis(manualAnalysis(await savedJobs.requestAnalysis(item.id))); onUpdated(); }
    catch (failure) { setError(failure instanceof ApiError && failure.status === 503
      ? 'AI 분석 서버 설정을 확인해 주세요.' : failure instanceof ApiError && failure.status === 400
        ? '공고 본문을 먼저 입력해 주세요.' : failure instanceof Error ? failure.message : '분석에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  return <div className="job-analysis" aria-live="polite"><h3>AI 공고 분석</h3>
    {item.kind === 'MANUAL' && <><p>직접 붙여넣은 공고 본문에서 기술을 추출합니다.</p>
      {analysis?.status !== 'COMPLETED' && <button type="button" disabled={busy || !item.description} onClick={run}>
        {busy ? '분석 중…' : analysis?.status === 'FAILED' ? '다시 분석하기' : 'AI 공고분석'}</button>}
      {!item.description && <p>수정에서 공고 본문을 입력하면 분석할 수 있습니다.</p>}</>}
    {analysis?.status === 'COMPLETED' && <><p>분석 완료</p>
      <p>필수 기술: {analysis.requiredSkills.length ? analysis.requiredSkills.join(', ') : '추출된 기술 없음'}</p>
      <p>우대 기술: {analysis.preferredSkills.length ? analysis.preferredSkills.join(', ') : '추출된 기술 없음'}</p></>}
    {analysis?.status === 'PENDING' && <p>분석 중입니다.</p>}
    {analysis?.status === 'FAILED' && <p>{analysis.failureReason || '분석에 실패했습니다.'}</p>}
    {error && <ErrorState message={error} />}
  </div>;
}
function manualAnalysis(value: unknown): Preview {
  if (!value || typeof value !== 'object') throw new Error('분석 응답을 확인할 수 없습니다.');
  const candidate = value as Record<string, unknown>;
  if (!['COMPLETED', 'FAILED'].includes(String(candidate.status))
    || !Array.isArray(candidate.requiredSkills) || !candidate.requiredSkills.every(value => typeof value === 'string')
    || !Array.isArray(candidate.preferredSkills) || !candidate.preferredSkills.every(value => typeof value === 'string'))
    throw new Error('분석 응답을 확인할 수 없습니다.');
  return candidate as Preview;
}
