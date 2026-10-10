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
import type { RecommendationItem, RecommendationPage, RecommendationRequest } from '../../api/recommendations';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import analysisArt from '../../assets/redesign/ext-img-08-ai-analysis.png';
import thoughtfulArt from '../../assets/redesign/cur-12-character-thoughtful.png';
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
  const [selected, setSelected] = useState<JobCandidate[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RecommendationPage>();
  const [resultLoading, setResultLoading] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (resultId === null) return;
    if (!Number.isSafeInteger(resultId) || resultId < 1) { setError('추천 결과 주소를 확인해 주세요.'); return; }
    const controller = new AbortController();
    setResultLoading(true); setError('');
    recommendations.get(resultId, 0, 20, controller.signal).then(value => {
      if (!controller.signal.aborted) setResult(value);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof ApiError && failure.status === 404
      ? '추천 결과가 없거나 접근할 수 없습니다.' : message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setResultLoading(false); });
    return () => controller.abort();
  }, [resultId, reload]);

  function toggle(candidate: JobCandidate) {
    setError('');
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

  return <div className="recommendations-page">
    <header className="card recommendations-hero"><div><span className="eyebrow">SEMANTIC COMPARISON</span>
      <h2>의미 기반 공고 비교</h2><p>내 문서의 불변 버전과 직접 고른 공고만 비교합니다. 순위와 설명은 참고용이며 결과의 사실성을 원문과 대조해 주세요.</p>
      {resultId !== null && <a href="#/recommendations">새 비교 준비</a>}</div><img src={analysisArt} alt="" aria-hidden="true" /></header>
    {resultId !== null ? <>
      {resultLoading ? <LoadingState message="저장된 비교 결과를 조회하고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setReload(v => v + 1)} />
        : result && <RecommendationResult result={result} onRefresh={() => setReload(v => v + 1)} />}
    </> : <>
      <section className="card"><h3>1. 문서 버전 선택</h3><p>이력서나 자기소개서 중 하나 이상을 선택하세요. 비교에는 선택한 버전의 원문이 사용됩니다.</p>
        <div className="recommendations-document-grid">
          <DocumentPicker type="RESUME" value={resumeVersionId} onChange={setResumeVersionId} />
          <DocumentPicker type="COVER_LETTER" value={coverLetterVersionId} onChange={setCoverLetterVersionId} />
        </div></section>
      <section className="card"><h3>2. 공고 선택</h3><p>선택 {selected.length}/20개 · 0개 선택도 요청할 수 있습니다. 수집 공고 ID와 직접 등록 공고 ID는 서로 다른 범위입니다.</p>
        {selected.length > 0 && <div className="recommendations-chips" aria-label="선택한 공고">
          {selected.map(item => <button key={key(item)} type="button" onClick={() => toggle(item)}>
            {item.kind === 'COLLECTED' ? '수집' : '직접 등록'} #{item.id} 제거</button>)}
        </div>}
        <div className="recommendations-candidate-grid">
          <CollectedPicker selected={selected} onToggle={toggle} />
          <SavedPicker selected={selected} onToggle={toggle} />
        </div></section>
      <section className="card recommendations-submit"><div><h3>3. 외부 비교 동의</h3>
        <p>선택한 문서 원문과 공고 본문에서 개인정보 형식을 일부 제거한 뒤 외부 AI 서비스로 전송합니다. 자유 형식 개인정보는 완전히 제거되지 않을 수 있으며, 문서와 공고 본문은 길이에 따라 잘릴 수 있습니다.</p>
        <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> 이 요청의 외부 비교에 동의합니다.</label>
        {error && <p role="alert" className="recommendations-error">{error}</p>}
        <button type="button" className="button-primary" disabled={busy || !consent || (!resumeVersionId && !coverLetterVersionId)} onClick={() => void submit()}>
          {busy ? '요청 중…' : `선택한 ${selected.length}개 공고 비교 요청`}</button></div><img src={thoughtfulArt} alt="" aria-hidden="true" /></section>
    </>}
  </div>;
}

function DocumentPicker({ type, value, onChange }: { type: DocumentType; value: number | null; onChange: (id: number | null) => void }) {
  const api = createDocumentApi(apiRequest, type);
  const label = type === 'RESUME' ? '이력서' : '자기소개서';
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api.list(page, controller.signal).then(v => { if (!controller.signal.aborted) { setDocuments(v.items); setTotal(v.totalElements); } })
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
  return <div className="recommendations-picker"><h4>{label}</h4>
    <label>문서<select value={documentId ?? ''} onChange={event => { setVersions([]); setDocumentId(event.target.value ? Number(event.target.value) : null); onChange(null); }}>
      <option value="">선택 안 함</option>{documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
    {documentId !== null && <label>불변 버전<select value={value ?? ''} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
      <option value="">버전 선택</option>{versions.map(v => <option key={v.id} value={v.id}>버전 {v.versionNumber} · {date(v.createdAt)}</option>)}</select></label>}
    {loading && <LoadingState message={`${label} 목록을 불러오고 있습니다.`} />}
    {error && <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />}
    {!loading && !error && documents.length === 0 && <p>저장된 {label}가 없습니다. <a href={type === 'RESUME' ? '#/resumes' : '#/cover-letters'}>문서 만들기</a></p>}
    <div className="recommendations-pagination"><button type="button" disabled={page === 0 || loading} onClick={() => { setPage(v => v - 1); setDocumentId(null); onChange(null); }}>이전</button>
      <span>{page + 1} / {Math.max(1, Math.ceil(total / 20))}</span><button type="button" disabled={loading || (page + 1) * 20 >= total} onClick={() => { setPage(v => v + 1); setDocumentId(null); onChange(null); }}>다음</button></div>
  </div>;
}

function CollectedPicker({ selected, onToggle }: { selected: JobCandidate[]; onToggle: (v: JobCandidate) => void }) {
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
  return <div className="recommendations-picker"><h4>수집 공고</h4>
    <form className="recommendations-search" onSubmit={event => { event.preventDefault(); setPage(0); setSearch(query.trim()); }}>
      <label>공고 검색<input value={query} onChange={event => setQuery(event.target.value)} /></label><button type="submit">검색</button></form>
    {loading ? <LoadingState message="수집 공고를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
      : items.length === 0 ? <p>검색된 공고가 없습니다.</p> : <ul className="recommendations-options">{items.map(item => {
        const candidate: JobCandidate = { kind: 'COLLECTED', id: item.id };
        const checked = selected.some(v => key(v) === key(candidate));
        return <li key={item.id}><label><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 20} onChange={() => onToggle(candidate)} />
          <span>{item.title}<small>{item.company.name} · 수집 #{item.id}</small></span></label></li>;
      })}</ul>}
    <div className="recommendations-pagination"><button type="button" disabled={page === 0 || loading} onClick={() => setPage(v => v - 1)}>이전</button>
      <span>{page + 1} / {Math.max(1, Math.ceil(total / 10))}</span><button type="button" disabled={loading || (page + 1) * 10 >= total} onClick={() => setPage(v => v + 1)}>다음</button></div>
  </div>;
}

function SavedPicker({ selected, onToggle }: { selected: JobCandidate[]; onToggle: (v: JobCandidate) => void }) {
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
  return <div className="recommendations-picker"><h4>관심공고 · 직접 등록</h4><p>수집 공고는 공용 공고 ID, 직접 등록 공고는 개인 공고 ID를 사용합니다.</p>
    {loading ? <LoadingState message="관심공고를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
      : items.length === 0 ? <p>저장된 관심공고가 없습니다.</p> : <ul className="recommendations-options">{items.map(item => {
        const candidate = recommendationCandidate(item);
        const checked = selected.some(v => key(v) === key(candidate));
        return <li key={`${item.kind}-${item.id}`}><label><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 20}
          onChange={() => onToggle(candidate)} /><span>{item.title}<small>{item.companyName} · {item.kind === 'MANUAL' ? '직접 등록' : '수집'} #{candidate.id}</small></span></label></li>;
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
  return <section className="card recommendations-result" aria-live="polite"><div className="recommendations-result-heading"><div><h3>저장된 비교 #{result.id}</h3>
    <p>요청 {date(result.consentedAt)} · 이력서 버전 #{result.resumeVersionId ?? '선택 안 함'} · 자기소개서 버전 #{result.coverLetterVersionId ?? '선택 안 함'}</p>
    <p>후보 {result.candidateCount}개 · 정책 {result.policyVersion} · 모델 {result.modelName}</p></div><button type="button" onClick={onRefresh}>저장 상태 다시 조회</button></div>
    <p className="recommendations-status">요청 상태: {result.status === 'PENDING' ? '처리 대기' : result.status === 'COMPLETED' ? '비교 완료' : '비교 실패'}
      {result.stale && ' · 오래된 결과'}</p>
    {result.stale && <p>문서 새 버전, 공고 내용, 마감 또는 지원 상태가 바뀌었습니다. 현재 조건을 다시 확인해 주세요.</p>}
    {result.status === 'PENDING' && <p>비교가 진행 중입니다. 잠시 후 저장 상태를 다시 조회해 주세요.</p>}
    {result.status === 'FAILED' && <p role="alert">{result.failureReason || '비교에 실패했습니다.'}</p>}
    {result.limitation && <div className="recommendations-limitation"><h4>결과의 한계</h4><p>{result.limitation}</p></div>}
    {result.status === 'COMPLETED' && result.items.length === 0 && <EmptyState title="비교된 공고가 없습니다." message="선택한 후보가 0개였거나 표시할 결과가 없습니다." />}
    {result.items.length > 0 && <ol className="recommendations-results">{result.items.map(item => <li key={key(item)}>
      <div className="recommendations-item-heading"><h4>{item.title}</h4><span>{itemStatus[item.status]}{item.rank !== null ? ` · ${item.rank}순위` : ''}</span></div>
      <p>{item.kind === 'COLLECTED' ? '수집 공고' : '직접 등록 공고'} #{item.id}</p>
      {item.reason && <p>사유: {reason[item.reason] ?? item.reason}</p>}
      {item.status === 'FAILED' && !item.reason && <p>이 공고의 비교에 실패했습니다.</p>}
      {item.evidence.length > 0 && <div><h5>비교 근거</h5><ul>{item.evidence.map((e, i) => <li key={i}>
        <p>문서: “{e.documentQuote}”</p><p>공고: “{e.jobQuote}”</p><p>{e.explanation}</p></li>)}</ul></div>}
      {item.limitations.length > 0 && <div><h5>이 공고의 한계</h5><ul>{item.limitations.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
    </li>)}</ol>}
    <p>총 {result.totalElements}개 결과 · {result.page + 1}페이지</p>
  </section>;
}
