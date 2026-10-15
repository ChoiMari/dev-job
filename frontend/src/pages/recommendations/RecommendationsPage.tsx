import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createDocumentApi } from '../../api/documents';
import type { DocumentSummary, DocumentType, DocumentVersion } from '../../api/documents';
import { createJobsApi } from '../../api/jobs';
import type { JobSummary } from '../../api/jobs';
import { recommendationCandidate, createSavedJobsApi } from '../../api/saved-jobs';
import type { JobCandidate, SavedJob } from '../../api/saved-jobs';
import { createRecommendationsApi } from '../../api/recommendations';
import type { RecommendationHistoryPage, RecommendationItem, RecommendationPage, RecommendationRequest } from '../../api/recommendations';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import heroArt from '../../assets/illustrations/recommendations-hero.png';
import pendingArt from '../../assets/illustrations/recommendations-pending.png';
import './recommendations.css';

const recommendations = createRecommendationsApi(apiRequest);
const jobs = createJobsApi(apiRequest);
const savedJobs = createSavedJobsApi(apiRequest);
const key = (v: JobCandidate) => `${v.kind}:${v.id}`;
const message = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
const date = (value: string) => new Date(value).toLocaleString('ko-KR');

export function RecommendationsPage({ location }: { location: string }) {
  const rawId = location.split('?')[0].replace(/^\/recommendations\/?/, '');
  const routeId = rawId ? Number(rawId) : null;
  const resultId = routeId;
  const [resumeVersionId, setResumeVersionId] = useState<number | null>(null);
  const [coverLetterVersionId, setCoverLetterVersionId] = useState<number | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Partial<Record<DocumentType, { id: number; title: string }>>>({});
  const [selected, setSelected] = useState<JobCandidate[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, { title: string; company: string }>>({});
  const [step, setStep] = useState(1);
  const [jobTab, setJobTab] = useState<'collected' | 'saved'>('collected');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RecommendationPage>();
  const [resultLoading, setResultLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (resultId === null) return;
    if (!Number.isSafeInteger(resultId) || resultId < 1) { setError('추천 결과 주소를 확인해 주세요.'); return; }
    const controller = new AbortController();
    if (!result) setResultLoading(true);
    setError('');
    recommendations.getById(resultId, 0, 20, controller.signal).then(value => {
      if (!controller.signal.aborted) setResult(value);
    }).catch(failure => { if (!controller.signal.aborted) {
      if (failure instanceof ApiError && failure.status === 404) setResult(undefined);
      setError(failure instanceof ApiError && failure.status === 404
        ? '추천 결과가 없거나 접근할 수 없습니다.' : message(failure));
    } })
      .finally(() => { if (!controller.signal.aborted) setResultLoading(false); });
    return () => controller.abort();
  }, [resultId, reload]);
  useEffect(() => {
    if (resultId === null || result?.status !== 'PENDING') return;
    const timer = window.setTimeout(() => setReload(value => value + 1), document.hidden ? 15000 : 5000);
    const refreshOnReturn = () => { if (!document.hidden) setReload(value => value + 1); };
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', refreshOnReturn); };
  }, [resultId, result?.status, reload]);

  function toggle(candidate: JobCandidate, detail?: { title: string; company: string }) {
    setError('');
    if (detail) setSelectedDetails(current => ({ ...current, [key(candidate)]: detail }));
    setSelected(current => current.some(v => key(v) === key(candidate))
      ? current.filter(v => key(v) !== key(candidate))
      : current.length >= 20 ? current : [...current, candidate]);
  }

  async function submit() {
    if (busy) return;
    setError('');
    const input: RecommendationRequest = { resumeVersionId, coverLetterVersionId, candidates: selected,
      consentToExternalComparison: true };
    if (!resumeVersionId && !coverLetterVersionId) { setError('이력서 또는 자기소개서 버전을 하나 이상 선택해 주세요.'); return; }
    if (!consent) { setError('외부 비교에 동의해 주세요.'); return; }
    setBusy(true);
    try {
      const created = await recommendations.create(input);
      setConsent(false);
      window.location.hash = `/recommendations/${created.id}`;
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 404 ? '선택한 문서 버전이나 공고를 찾을 수 없습니다. 목록을 다시 확인해 주세요.'
        : failure instanceof ApiError && failure.status === 503 ? '외부 비교 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.' : message(failure));
    } finally { setBusy(false); }
  }

  const activeStep = resultId !== null ? 4 : step;
  const steps = ['비교할 문서 선택', '비교할 공고 선택', '외부 비교 동의', '추천 결과'];
  return <div className="recommendations-page">
    <header className="recommendations-hero"><div><h1>AI 공고 비교</h1><p>이력서와 자기소개서 내용을 기반으로 공고를 비교하고, 나와 잘 맞는 공고를 찾아보세요.</p></div><img src={heroArt} alt="" aria-hidden="true" /></header>
    <nav className="recommendations-stepper" aria-label="AI 공고 비교 단계">{steps.map((title, index) => <div key={title} className={`recommendations-step ${activeStep === index + 1 ? 'is-active' : ''} ${activeStep > index + 1 ? 'is-done' : ''}`} aria-current={activeStep === index + 1 ? 'step' : undefined}>
      <span className="recommendations-step-number">{index + 1}</span><span><strong>{title}</strong><small>{['이력서와 자기소개서를 선택해 주세요.', '비교할 공고를 선택해 주세요.', '전송 내용을 확인하고 동의해 주세요.', '비교 결과를 확인해 보세요.'][index]}</small></span></div>)}</nav>
    <section className="recommendations-history"><button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen(value => !value)}>지난 비교 내역 <LucideIcon name={historyOpen ? 'chevronUp' : 'chevronDown'} /></button>
      {historyOpen && <RecommendationHistory />}</section>
    {resultId !== null ? <>
      {resultLoading && !result ? <LoadingState message="저장된 비교 결과를 조회하고 있습니다." /> : error && !result ? <ErrorState message={error} onRetry={() => setReload(v => v + 1)} />
        : result && <>{error && <p className="recommendations-error" role="alert">{result.status === 'PENDING' ? '상태 조회에 실패했습니다. 자동으로 다시 확인합니다.' : '최신 상태를 확인하지 못했습니다. 다시 조회해 주세요.'} {error}</p>}<RecommendationResult result={result} onRefresh={() => setReload(v => v + 1)} /></>}
    </> : <>
      {step === 1 && <section className="recommendations-stage"><div className="recommendations-stage-heading"><h2>비교할 문서 선택</h2><p>이력서나 자기소개서 중 하나 이상을 선택하세요. 비교에는 선택한 버전의 원문이 사용됩니다.</p></div>
        <div className="recommendations-document-grid">
          <DocumentPicker type="RESUME" value={resumeVersionId} onChange={setResumeVersionId} documentId={selectedDocuments.RESUME?.id ?? null} onDocumentChange={document => setSelectedDocuments(current => ({ ...current, RESUME: document ?? undefined }))} />
          <DocumentPicker type="COVER_LETTER" value={coverLetterVersionId} onChange={setCoverLetterVersionId} documentId={selectedDocuments.COVER_LETTER?.id ?? null} onDocumentChange={document => setSelectedDocuments(current => ({ ...current, COVER_LETTER: document ?? undefined }))} />
        </div></section>}
      {step === 2 && <section className="recommendations-stage"><div className="recommendations-stage-heading"><h2>비교할 공고 선택</h2><p>수집 공고와 저장·직접 등록 공고 중 최대 20개를 선택할 수 있습니다.</p></div>
        <div className="recommendations-job-tabs" role="tablist" aria-label="공고 종류"><button type="button" role="tab" aria-selected={jobTab === 'collected'} className={jobTab === 'collected' ? 'is-active' : ''} onClick={() => setJobTab('collected')}>수집 공고</button><button type="button" role="tab" aria-selected={jobTab === 'saved'} className={jobTab === 'saved' ? 'is-active' : ''} onClick={() => setJobTab('saved')}>저장·직접 등록 공고</button></div>
        <div className="recommendations-candidate-grid">
          {jobTab === 'collected' ? <CollectedPicker selected={selected} onToggle={toggle} /> : <SavedPicker selected={selected} onToggle={toggle} />}
        </div>
        {selected.length > 0 && <div className="recommendations-chips" aria-label="선택한 공고">
          {selected.map(item => <button key={key(item)} type="button" onClick={() => toggle(item)}>
            {selectedDetails[key(item)]?.company && <strong>{selectedDetails[key(item)].company}</strong>} {selectedDetails[key(item)]?.title ?? `${item.kind === 'COLLECTED' ? '수집' : '직접 등록'} 공고 #${item.id}`} <span aria-hidden="true">×</span></button>)}
        </div>}
        <p className="recommendations-selection-count">선택한 공고 <strong>{selected.length} / 20</strong> · 선택하지 않아도 비교 요청할 수 있습니다.</p>
      </section>}
      {step === 3 && <section className="recommendations-stage"><div className="recommendations-stage-heading"><h2>선택한 항목 확인</h2><p>AI 비교 요청 전에 문서와 공고를 확인해 주세요.</p></div>
        <div className="recommendations-review-grid"><div className="recommendations-review-card"><h3>선택한 문서</h3>{resumeVersionId && <p>이력서 · {selectedDocuments.RESUME?.title} · 버전 #{resumeVersionId}</p>}{coverLetterVersionId && <p>자기소개서 · {selectedDocuments.COVER_LETTER?.title} · 버전 #{coverLetterVersionId}</p>}<button type="button" onClick={() => setStep(1)}>문서 변경</button></div>
          <div className="recommendations-review-card"><h3>선택한 공고 ({selected.length}개)</h3>{selected.length ? selected.map(item => <p key={key(item)}>{selectedDetails[key(item)]?.title ?? `${item.kind === 'COLLECTED' ? '수집' : '직접 등록'} 공고 #${item.id}`}</p>) : <p>선택한 공고가 없습니다.</p>}<button type="button" onClick={() => setStep(2)}>공고 변경</button></div></div>
        <div className="recommendations-consent"><h3>외부 AI 서비스 비교 동의</h3><p>선택한 문서 원문과 공고 본문에서 개인정보 형식을 일부 제거한 뒤 외부 AI 서비스로 전송합니다. 자유 형식 개인정보는 완전히 제거되지 않을 수 있으며, 문서와 공고 본문은 길이에 따라 잘릴 수 있습니다.</p>
          <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> 이 요청의 외부 비교에 동의합니다.</label></div></section>}
      {error && <p role="alert" className="recommendations-error">{error}</p>}
      <footer className="recommendations-footer"><div><strong>선택한 항목</strong><span>문서 {[resumeVersionId, coverLetterVersionId].filter(Boolean).length}개 · 공고 {selected.length}개</span></div>
        <div className="recommendations-footer-actions">{step > 1 && <button type="button" onClick={() => { setError(''); setStep(v => v - 1); }}>이전 단계</button>}
          {step < 3 ? <button type="button" className="button-primary" disabled={step === 1 && !resumeVersionId && !coverLetterVersionId} onClick={() => { setError(''); setStep(v => v + 1); }}>다음 단계 →</button>
            : <button type="button" className="button-primary" disabled={busy || !consent} onClick={() => void submit()}>{busy ? '요청 중…' : `선택한 ${selected.length}개 공고 비교 요청`}</button>}</div></footer>
    </>}
  </div>;
}

function RecommendationHistory() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<RecommendationHistoryPage>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined); setError('');
    recommendations.history(page, 10, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure)); });
    return () => controller.abort();
  }, [page, retry]);
  return <div className="recommendations-history-panel">
    {error && <ErrorState message={error} onRetry={() => { setError(''); setRetry(value => value + 1); }} />}
    {!error && !data && <LoadingState message="이전 비교 내역을 불러오고 있습니다." />}
    {!error && data?.items.length === 0 && <p>이전 AI 공고 비교 결과가 없습니다.</p>}
    {!error && data && data.items.length > 0 && <><ul>{data.items.map(item => <li key={item.id}><a href={`#/recommendations/${item.id}`}>
      <span className="recommendations-history-details"><span className="recommendations-history-topline"><time dateTime={item.consentedAt}>{date(item.consentedAt)} 요청</time><span className={`recommendations-history-status is-${item.status.toLowerCase()}`}>{item.status === 'PENDING' ? '분석 중' : item.status === 'COMPLETED' ? '완료' : '실패'}</span></span>
        <span className="recommendations-history-summary">선택 문서: {[item.resumeVersionId && '이력서', item.coverLetterVersionId && '자기소개서'].filter(Boolean).join(' · ')}<span aria-hidden="true">·</span>공고 {item.candidateCount}개</span></span><LucideIcon name="chevronRight" />
    </a></li>)}</ul>{data.totalElements > 10 && <div className="recommendations-history-pages"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>이전</button><span>{page + 1} / {Math.max(1, Math.ceil(data.totalElements / 10))}</span><button type="button" disabled={(page + 1) * 10 >= data.totalElements} onClick={() => setPage(value => value + 1)}>다음</button></div>}</>}
  </div>;
}

function DocumentPicker({ type, value, onChange, documentId, onDocumentChange }: { type: DocumentType; value: number | null; onChange: (id: number | null) => void; documentId: number | null; onDocumentChange: (document: { id: number; title: string } | null) => void }) {
  const api = createDocumentApi(apiRequest, type);
  const label = type === 'RESUME' ? '이력서' : '자기소개서';
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api.list(page, controller.signal).then(v => { if (!controller.signal.aborted) { setDocuments(current => page === 0 ? v.items : [...current, ...v.items.filter(item => !current.some(existing => existing.id === item.id))]); setTotal(v.totalElements); } })
      .catch(e => { if (!controller.signal.aborted) setError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, page, retry]);
  useEffect(() => {
    if (documentId === null) { setVersions([]); return; }
    const controller = new AbortController(); setLoading(true); setError('');
    api.versions(documentId, controller.signal).then(v => { if (!controller.signal.aborted) setVersions(v); })
      .catch(e => { if (!controller.signal.aborted) setError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, documentId, retry]);
  useEffect(() => {
    if (documentId === null || value === null) { setPreview(''); return; }
    const controller = new AbortController(); setPreview('');
    api.version(documentId, value, controller.signal).then(v => { if (!controller.signal.aborted) setPreview(v.content ?? ''); })
      .catch(() => { if (!controller.signal.aborted) setPreview(''); });
    return () => controller.abort();
  }, [type, documentId, value]);
  return <div className="recommendations-picker"><div className="recommendations-picker-heading"><h3><LucideIcon name={type === 'RESUME' ? 'fileText' : 'pencil'} />{label} 선택</h3><div>{documentId !== null && <button type="button" onClick={() => { onDocumentChange(null); onChange(null); }}>선택 해제</button>}{total < 20 && <a href={type === 'RESUME' ? '#/resumes' : '#/cover-letters'}>+ 새 {label} 작성</a>}</div></div><p>비교에 사용할 {label}를 선택하고, 버전을 지정해 주세요.</p>
    {loading && <LoadingState message={`${label} 목록을 불러오고 있습니다.`} />}
    {error && <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />}
    {!loading && !error && documents.length === 0 && <p>저장된 {label}가 없습니다.</p>}
    {!error && <div className="recommendations-document-list" onScroll={event => { const element = event.currentTarget; if (!loading && documents.length < total && element.scrollTop + element.clientHeight >= element.scrollHeight - 24) { setLoading(true); setPage(value => value + 1); } }}>{documents.map(d => <div className={`recommendations-document-row ${documentId === d.id ? 'is-selected' : ''}`} key={d.id}>
      <label><input type="radio" name={`recommendation-${type}`} checked={documentId === d.id} onChange={() => { onDocumentChange({ id: d.id, title: d.title }); setVersions([]); onChange(d.latestVersionId); }} /><span className="recommendations-document-icon" aria-hidden="true">▤</span><span><strong>{d.title}</strong><small>최근 수정 {date(d.updatedAt)}</small></span></label>
      <select aria-label={`${d.title} 버전`} disabled={documentId !== d.id} value={documentId === d.id ? value ?? '' : d.latestVersionId} onChange={event => onChange(Number(event.target.value))}>
        {documentId === d.id && versions.length > 0 ? versions.map(v => <option key={v.id} value={v.id}>v{v.versionNumber} · {date(v.createdAt)}</option>) : <option value={d.latestVersionId}>v{d.latestVersionNumber} · {date(d.latestVersionCreatedAt)}</option>}
      </select></div>)}</div>}
    {documentId !== null && value !== null && <div className="recommendations-document-preview"><strong>선택한 {label} 버전</strong><p>{preview ? `${preview.slice(0, 220)}${preview.length > 220 ? '…' : ''}` : '원문 미리보기를 불러오는 중이거나 표시할 내용이 없습니다.'}</p></div>}
  </div>;
}

function CollectedPicker({ selected, onToggle }: { selected: JobCandidate[]; onToggle: (v: JobCandidate, detail: { title: string; company: string }) => void }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<JobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    jobs.list({ q: search || undefined, page, size: 10, sort: 'latest' }, controller.signal)
      .then(v => { if (!controller.signal.aborted) { setItems(v.items); setTotal(v.totalElements); } })
      .catch(e => { if (!controller.signal.aborted) setError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, page, retry]);
  return <div className="recommendations-picker recommendations-job-picker">
    <form className="recommendations-search" onSubmit={event => { event.preventDefault(); setPage(0); setSearch(query.trim()); }}>
      <label>공고 검색<input value={query} onChange={event => setQuery(event.target.value)} /></label><button type="submit">검색</button></form>
    {loading ? <LoadingState message="수집 공고를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
      : items.length === 0 ? <p>검색된 공고가 없습니다.</p> : <ul className="recommendations-options">{items.map(item => {
        const candidate: JobCandidate = { kind: 'COLLECTED', id: item.id };
        const checked = selected.some(v => key(v) === key(candidate));
        return <li key={item.id}><label><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 20} onChange={() => onToggle(candidate, { title: item.title, company: item.company.name })} />
          <span className="recommendations-company-mark" aria-hidden="true">{item.company.name.charAt(0)}</span><span className="recommendations-job-company">{item.company.name}</span><span className="recommendations-job-title"><strong>{item.title}</strong><small>{[item.location, item.careerRequirement].filter(Boolean).join(' · ')}</small></span><span className="recommendations-job-source">수집 공고</span></label></li>;
      })}</ul>}
    <div className="recommendations-pagination"><button type="button" disabled={page === 0 || loading} onClick={() => setPage(v => v - 1)}>이전</button>
      <span>{page + 1} / {Math.max(1, Math.ceil(total / 10))}</span><button type="button" disabled={loading || (page + 1) * 10 >= total} onClick={() => setPage(v => v + 1)}>다음</button></div>
  </div>;
}

function SavedPicker({ selected, onToggle }: { selected: JobCandidate[]; onToggle: (v: JobCandidate, detail: { title: string; company: string }) => void }) {
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<SavedJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    savedJobs.list(page, 20, controller.signal).then(v => { if (!controller.signal.aborted) { setItems(v.items); setTotal(v.totalElements); } })
      .catch(e => { if (!controller.signal.aborted) setError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  return <div className="recommendations-picker recommendations-job-picker"><p>관심 공고와 직접 등록한 공고입니다. 현재 목록은 페이지 단위로 표시됩니다.</p>
    {loading ? <LoadingState message="관심공고를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
      : items.length === 0 ? <p>저장된 관심공고가 없습니다.</p> : <ul className="recommendations-options">{items.map(item => {
        const candidate = recommendationCandidate(item);
        const checked = selected.some(v => key(v) === key(candidate));
        return <li key={`${item.kind}-${item.id}`}><label><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 20}
          onChange={() => onToggle(candidate, { title: item.title, company: item.companyName })} /><span className="recommendations-company-mark" aria-hidden="true">{item.companyName.charAt(0)}</span><span className="recommendations-job-company">{item.companyName}</span><span className="recommendations-job-title"><strong>{item.title}</strong><small>{[item.location, item.employmentType].filter(Boolean).join(' · ')}</small></span><span className="recommendations-job-source">{item.kind === 'MANUAL' ? '직접 등록' : '수집 공고'}</span></label></li>;
      })}</ul>}
    <div className="recommendations-pagination"><button type="button" disabled={page === 0 || loading} onClick={() => setPage(v => v - 1)}>이전</button>
      <span>{page + 1} / {Math.max(1, Math.ceil(total / 20))}</span><button type="button" disabled={loading || (page + 1) * 20 >= total} onClick={() => setPage(v => v + 1)}>다음</button></div>
  </div>;
}

const itemStatus: Record<RecommendationItem['status'], string> = {
  PENDING: '처리 대기', COMPLETED: '비교 완료', FAILED: '비교 실패', INSUFFICIENT_INPUT: '입력 부족', EXCLUDED: '비교 제외',
};
const reason: Record<string, string> = { ALREADY_APPLIED: '이미 지원한 공고', EXPIRED: '마감된 공고', INSUFFICIENT_INPUT: '공고 본문이 없음' };
function RecommendationResult({ result, onRefresh }: { result: RecommendationPage; onRefresh: () => void }) {
  if (result.status === 'PENDING') return <section className="recommendations-pending" aria-live="polite"><div className="recommendations-pending-card"><img src={pendingArt} alt="" aria-hidden="true" /><div className="recommendations-pending-copy"><span className="recommendations-pending-pill">◌ AI 비교 분석 중</span><h2>공고와 문서를 비교하고 있어요!</h2><p>선택한 문서와 공고 내용을 AI가 분석하고 있습니다.<br />완료되면 이 화면이 자동으로 결과로 바뀝니다.</p><div className="recommendations-pending-counts"><span>▤ 문서 {[result.resumeVersionId, result.coverLetterVersionId].filter(Boolean).length}개</span><span>▤ 공고 {result.candidateCount}개</span></div><button type="button" onClick={onRefresh}>↻ 저장 상태 다시 조회</button><small>페이지를 닫거나 다른 화면으로 이동해도 분석은 계속 진행됩니다.</small></div></div>
    <div className="recommendations-pending-selected"><h3>선택한 항목</h3><div><section><h4>선택한 문서</h4>{result.resumeVersionId && <p>이력서 버전 #{result.resumeVersionId}</p>}{result.coverLetterVersionId && <p>자기소개서 버전 #{result.coverLetterVersionId}</p>}</section><section><h4>선택한 공고 ({result.candidateCount}개)</h4>{result.items.length ? result.items.map(item => <p key={key(item)}>{item.companyName && `${item.companyName} · `}{item.title}</p>) : <p>선택한 공고가 없습니다.</p>}</section></div></div><a className="recommendations-pending-back" href="#/recommendations">← 새 비교 만들기</a></section>;
  return <section className="recommendations-result" aria-live="polite"><div className="recommendations-result-heading"><div><h2>비교 결과 <span className="recommendations-result-badge">{result.status === 'COMPLETED' ? '완료' : '실패'}</span></h2>
    <p>요청 {date(result.consentedAt)} · 비교한 공고 {result.candidateCount}개 · 이력서 버전 #{result.resumeVersionId ?? '선택 안 함'} · 자기소개서 버전 #{result.coverLetterVersionId ?? '선택 안 함'}</p></div><button type="button" onClick={onRefresh}>↻ 저장 상태 다시 조회</button></div>
    <p className="recommendations-status">요청 상태: {result.status === 'COMPLETED' ? '비교 완료' : '비교 실패'}
      {result.stale && ' · 오래된 결과'}</p>
    {result.stale && <p>문서 새 버전, 공고 내용, 마감 또는 지원 상태가 바뀌었습니다. 현재 조건을 다시 확인해 주세요.</p>}
    {result.status === 'FAILED' && <p role="alert">{result.failureReason || '비교에 실패했습니다.'}</p>}
    {result.limitation && <div className="recommendations-limitation"><h4>결과의 한계</h4><p>{result.limitation}</p></div>}
    {result.status === 'COMPLETED' && result.items.length === 0 && <EmptyState title="비교된 공고가 없습니다." message="선택한 후보가 0개였거나 표시할 결과가 없습니다." />}
    {result.items.length > 0 && <ol className="recommendations-results">{result.items.map(item => <li key={key(item)}>
      <div className="recommendations-item-heading"><span className="recommendations-rank">{item.rank ?? '–'}</span><div><h3>{item.title} {item.companyName && <small>{item.companyName}</small>}</h3><p>{[item.location, item.deadlineDate ? `마감 ${item.deadlineDate}` : null, item.kind === 'COLLECTED' ? '수집 공고' : '직접 등록 공고'].filter(Boolean).join(' · ')}</p></div><span className="recommendations-item-status">{itemStatus[item.status]}</span><a href={item.kind === 'COLLECTED' ? `#/jobs/${item.id}` : `#/bookmarks/${item.id}`}>공고 상세보기 →</a></div>
      {item.skillTags.length > 0 && <div className="recommendations-skill-tags" aria-label="AI 분석된 공고 기술">{item.skillTags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      {item.reason && <p>사유: {reason[item.reason] ?? item.reason}</p>}
      {item.status === 'FAILED' && !item.reason && <p>이 공고의 비교에 실패했습니다.</p>}
      {item.evidence.length > 0 && <div className="recommendations-evidence">{item.evidence.map((e, i) => <div className="recommendations-evidence-row" key={i}>
        <div><h4>▤ 문서에서 인용한 문장</h4><p>“{e.documentQuote}”</p></div><div><h4>▤ 공고에서 인용한 문장</h4><p>“{e.jobQuote}”</p></div><div><h4>✦ 관련성 설명</h4><p>{e.explanation}</p></div></div>)}</div>}
      {item.limitations.length > 0 && <div className="recommendations-item-limitations"><h4>! 판단의 한계</h4><ul>{item.limitations.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
      {item.preparationTips.length > 0 && <div className="recommendations-preparation"><h4>◎ 지원 전에 무엇을 확인하거나 보완할까요?</h4><ul>{item.preparationTips.map((tip, i) => <li key={i}><strong>{tip.type === 'CHECK' ? '확인' : '보완'}</strong> {tip.text}</li>)}</ul></div>}
    </li>)}</ol>}
    <div className="recommendations-result-footer"><span>총 {result.totalElements}개 결과 · {result.page + 1}페이지</span><a href="#/recommendations">다른 공고 다시 비교하기 →</a></div>
  </section>;
}
