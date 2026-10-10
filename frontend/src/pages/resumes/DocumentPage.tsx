import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createDocumentApi } from '../../api/documents';
import type { DocumentAnalysis, DocumentSummary, DocumentType, DocumentVersion, DocumentVersionSelection } from '../../api/documents';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import resumesImage from '../../assets/redesign/ext-img-05b-resumes.png';
import analysisImage from '../../assets/redesign/ext-img-08-ai-analysis.png';
import './documents.css';

const message = (e: unknown) => e instanceof Error ? e.message : '요청을 처리하지 못했습니다.';
const date = (v: string) => new Date(v).toLocaleString('ko-KR');
export function DocumentPage({ type, location }: { type: DocumentType; location: string }) {
  const api = createDocumentApi(apiRequest, type);
  const base = type === 'RESUME' ? '/resumes' : '/cover-letters';
  const label = type === 'RESUME' ? '이력서' : '자기소개서';
  const part = location.split('?')[0].slice(base.length).split('/').filter(Boolean)[0];
  const documentId = part ? Number(part) : null;
  const valid = documentId !== null && Number.isSafeInteger(documentId) && documentId > 0;
  const [page, setPage] = useState(0);
  const [list, setList] = useState<DocumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [document, setDocument] = useState<DocumentSummary>();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selected, setSelected] = useState<number>();
  const [detail, setDetail] = useState<DocumentVersion>();
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const selection: DocumentVersionSelection | null = valid && selected ? { documentType: type, documentId, versionId: selected } : null;
  useEffect(() => {
    const c = new AbortController(); setLoading(true); setError('');
    if (documentId === null) api.list(page, c.signal).then(v => { if (!c.signal.aborted) { setList(v.items); setTotal(v.totalElements); } })
      .catch(e => { if (!c.signal.aborted) setError(message(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    else if (valid) Promise.all([api.get(documentId, c.signal), api.versions(documentId, c.signal)])
      .then(([d, v]) => { if (!c.signal.aborted) { setDocument(d); setTitle(d.title); setVersions(v); setSelected(old => v.some(x => x.id === old) ? old : v[0]?.id); } })
      .catch(e => { if (!c.signal.aborted) setError(message(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    else { setError('문서 주소를 확인해 주세요.'); setLoading(false); }
    return () => c.abort();
  }, [type, documentId, valid, page, reload]);
  useEffect(() => {
    if (!selection) return;
    const c = new AbortController(); setDetail(undefined); setAnalysis(null); setDetailLoading(true); setActionError('');
    api.version(selection.documentId, selection.versionId, c.signal)
      .then(v => { if (!c.signal.aborted) { setDetail(v); setDetailLoading(false); } })
      .catch(e => { if (!c.signal.aborted) { setActionError(message(e)); setDetailLoading(false); } });
    api.analysis(selection, c.signal).then(a => { if (!c.signal.aborted) setAnalysis(a); })
      .catch(e => { if (!c.signal.aborted && !(e instanceof ApiError && e.status === 404)) setActionError(message(e)); });
    return () => c.abort();
  }, [type, documentId, selected, reload]);
  async function run(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setActionError(''); setNotice('');
    try { await action(); } catch (e) { setActionError(message(e)); } finally { setBusy(false); }
  }
  return <div className="documents-page">
    <header className="card documents-hero"><div><span className="eyebrow">DOCUMENTS</span><h2>내 {label}</h2><p>원문은 선택한 버전에서만 조회합니다. 새 버전은 기존 원문을 변경하지 않습니다.</p>{valid && <a href={`#${base}`}>← {label} 목록</a>}</div><img src={type === 'RESUME' ? resumesImage : analysisImage} alt="" /></header>
    {error ? <ErrorState message={error} onRetry={() => setReload(v => v + 1)} /> : loading ? <LoadingState message={`${label}를 불러오고 있습니다.`} /> : documentId === null ? <>
      <section className="card documents-form"><h3>새 {label}</h3><form onSubmit={e => { e.preventDefault(); void run(async () => { const d = await api.create(title.trim(), content); setTitle(''); setContent(''); window.location.hash = `${base}/${d.id}`; }); }}><label>제목<input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label><label>원문<textarea value={content} onChange={e => setContent(e.target.value)} maxLength={100000} rows={7} required /></label><button disabled={busy || !title.trim() || !content.trim()}>생성</button></form></section>
      <section className="card"><h3>저장된 {label}</h3>{list.length === 0 ? <EmptyState title={`저장된 ${label}가 없습니다.`} /> : <ul className="documents-list">{list.map(d => <li key={d.id}><a href={`#${base}/${d.id}`}>{d.title}</a><small>최신 버전 {d.latestVersionNumber} · {date(d.latestVersionCreatedAt)}</small></li>)}</ul>}<div className="documents-pagination"><button disabled={page === 0} onClick={() => setPage(v => v - 1)}>이전</button><span>{page + 1} / {Math.max(1, Math.ceil(total / 20))}</span><button disabled={(page + 1) * 20 >= total} onClick={() => setPage(v => v + 1)}>다음</button></div></section>
    </> : document && <>
      <section className="card documents-form"><h3>제목과 삭제</h3><form onSubmit={e => { e.preventDefault(); void run(async () => { setDocument(await api.rename(documentId, title.trim())); setNotice('제목을 변경했습니다. 버전 원문은 그대로입니다.'); }); }}><label>제목<input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label><button disabled={busy || !title.trim()}>제목 저장</button></form><button className="documents-danger" disabled={busy} onClick={() => { if (window.confirm(`${label}와 모든 버전 및 분석 결과를 삭제할까요?`)) void run(async () => { await api.remove(documentId); window.location.hash = base; }); }}>문서 삭제</button></section>
      <section className="card documents-form"><h3>새 불변 버전</h3><form onSubmit={e => { e.preventDefault(); void run(async () => { const v = await api.addVersion(documentId, content); setContent(''); setSelected(v.id); setReload(n => n + 1); setNotice(`버전 ${v.versionNumber}을 추가했습니다.`); }); }}><label>새 원문<textarea value={content} onChange={e => setContent(e.target.value)} maxLength={100000} rows={7} required /></label><button disabled={busy || !content.trim()}>새 버전 추가</button></form></section>
      <section className="card"><h3>버전</h3><div className="documents-versions">{versions.map(v => <button key={v.id} aria-pressed={selected === v.id} onClick={() => setSelected(v.id)}>버전 {v.versionNumber}<small>{date(v.createdAt)}</small></button>)}</div>{detailLoading ? <LoadingState message="선택한 버전을 불러오고 있습니다." /> : detail && <div className="documents-source"><h4>버전 {detail.versionNumber} 원문</h4><pre>{detail.content}</pre></div>}</section>
      {selection && !detailLoading && detail && <section className="card documents-analysis"><img src={analysisImage} alt="" /><div><h3>버전 {detail.versionNumber} AI 분석</h3><p>분석 시 원문의 개인정보 형식을 일부 제거한 뒤 외부 AI 서비스로 전송합니다. 자유 형식 개인정보는 완전히 제거되지 않을 수 있으니 원문을 확인해 주세요.</p><label className="documents-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> 이 버전의 외부 AI 분석에 동의합니다.</label><div className="documents-actions"><button disabled={busy || !consent || analysis?.status === 'COMPLETED'} onClick={() => void run(async () => { setAnalysis(await api.analyze(selection)); setConsent(false); setNotice('분석 요청 상태를 저장했습니다.'); })}>{analysis?.status === 'FAILED' ? '동의 후 다시 요청' : '동의 후 분석 요청'}</button><button disabled={busy || !analysis} onClick={() => void run(async () => { setAnalysis(await api.analysis(selection)); setNotice('저장된 분석 상태를 다시 조회했습니다.'); })}>저장 상태 다시 조회</button>{analysis && <button disabled={busy} onClick={() => { if (window.confirm('이 버전의 저장된 분석 결과를 삭제할까요?')) void run(async () => { await api.removeAnalysis(selection); setAnalysis(null); setConsent(false); setNotice('저장된 분석 결과를 삭제했습니다.'); }); }}>결과 삭제</button>}</div>
        {!analysis ? <p>이 버전에 저장된 분석이 없습니다.</p> : <div role="status"><p>상태: {analysis.status}{analysis.stale ? ' · 오래된 결과 (새 버전 존재)' : ''}</p>{analysis.status === 'PENDING' && <p>처리 중입니다. 잠시 후 저장 상태를 다시 조회해 주세요.</p>}{analysis.status === 'FAILED' && <p>{analysis.failureReason ?? '분석에 실패했습니다.'}</p>}{analysis.status === 'COMPLETED' && analysis.result && <><h4>기술</h4><ul>{analysis.result.skills.map((v, i) => <li key={i}>{v}</li>)}</ul><h4>강점</h4><ul>{analysis.result.strengths.map((v, i) => <li key={i}>{v}</li>)}</ul><h4>개선 제안</h4><ul>{analysis.result.improvements.map((v, i) => <li key={i}>{v}</li>)}</ul></>}</div>}</div></section>}
    </>}
    {actionError && <p className="form-error" role="alert">{actionError}</p>}{notice && <p role="status">{notice}</p>}
  </div>;
}
