import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createDocumentApi } from '../../api/documents';
import { createResumeDraftApi } from '../../api/resume-draft';
import type { ResumeDraftSummary } from '../../api/resume-draft';
import type { DocumentAnalysis, DocumentSummary, DocumentVersion } from '../../api/documents';
import { LucideIcon } from '../../components/LucideIcon';
import resumeAnalysisArt from '../../assets/illustrations/resume-analysis-purple.png';
import { ResumeDraftList, ResumeEmptyState } from './ResumeEmptyState';
import './resume-workspace.css';
import resumeHeadingDocument from '../../assets/illustrations/resume-heading-document.png';

const api = createDocumentApi(apiRequest, 'RESUME');
const draftApi = createResumeDraftApi(apiRequest);
const formatDate = (value: string) => new Date(value).toLocaleDateString('ko-KR');
const errorText = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
const resumeDeleteMessage = '이력서를 삭제하면 목록에서 즉시 사라지고, 연결된 분석 결과는 함께 삭제됩니다.\n이력서와 버전 데이터는 삭제 후 30일이 지나면 정리 작업에서 DB에서도 제거됩니다.\n\n삭제할까요?';

export function ResumeWorkspace({ location }: { location: string }) {
  const segment = location.split('?')[0].replace(/^\/resumes\/?/, '').split('/')[0];
  const routeId = segment ? Number(segment) : null;
  const invalidRoute = routeId !== null && (!Number.isSafeInteger(routeId) || routeId < 1);
  const [list, setList] = useState<DocumentSummary[]>([]);
  const [drafts, setDrafts] = useState<ResumeDraftSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [listReload, setListReload] = useState(0);
  const [draftError, setDraftError] = useState('');
  const [document, setDocument] = useState<DocumentSummary>();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [detail, setDetail] = useState<DocumentVersion>();
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [tab, setTab] = useState<'versions' | 'source' | 'analysis'>('versions');
  const [title, setTitle] = useState('');
  const [consent, setConsent] = useState(false);
  const [reload, setReload] = useState(0);
  const activeId = invalidRoute ? null : routeId ?? list[0]?.id ?? null;

  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true); setListError('');
    api.list(0, controller.signal).then(value => { if (!controller.signal.aborted) setList(value.items); })
      .catch(error => { if (!controller.signal.aborted) setListError(errorText(error)); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [listReload]);

  useEffect(() => {
    const controller = new AbortController();
    setDraftError('');
    draftApi.list(controller.signal).then(value => { if (!controller.signal.aborted) setDrafts(value); })
      .catch(error => { if (!controller.signal.aborted) setDraftError(errorText(error)); });
    return () => controller.abort();
  }, [listReload]);

  async function removeDraft(id: number) {
    if (!window.confirm('이 임시저장 이력서를 삭제할까요?')) return;
    try { await draftApi.remove(id); setDrafts(current => current.filter(item => item.id !== id)); }
    catch (error) { setDraftError(errorText(error)); }
  }

  useEffect(() => {
    if (activeId === null) { setDocument(undefined); setVersions([]); return; }
    const controller = new AbortController();
    setDocumentLoading(true); setDetailError(''); setDocument(undefined); setVersions([]);
    Promise.all([api.get(activeId, controller.signal), api.versions(activeId, controller.signal)])
      .then(([value, loadedVersions]) => { if (!controller.signal.aborted) { setDocument(value); setVersions(loadedVersions); setSelectedId(loadedVersions[0]?.id); setTitle(value.title); } })
      .catch(error => { if (!controller.signal.aborted) setDetailError(errorText(error)); })
      .finally(() => { if (!controller.signal.aborted) setDocumentLoading(false); });
    return () => controller.abort();
  }, [activeId, reload]);

  useEffect(() => {
    if (activeId === null || !selectedId) { setDetail(undefined); setAnalysis(null); return; }
    const controller = new AbortController();
    setVersionLoading(true); setDetail(undefined); setAnalysis(null);
    api.version(activeId, selectedId, controller.signal)
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(error => { if (!controller.signal.aborted) setDetailError(errorText(error)); })
      .finally(() => { if (!controller.signal.aborted) setVersionLoading(false); });
    api.analysis({ documentType: 'RESUME', documentId: activeId, versionId: selectedId }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setAnalysis(value); })
      .catch(error => { if (!controller.signal.aborted && !(error instanceof ApiError && error.status === 404)) setDetailError(errorText(error)); });
    return () => controller.abort();
  }, [activeId, selectedId, reload]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setDetailError(''); setNotice('');
    try { await action(); } catch (error) { setDetailError(errorText(error)); } finally { setBusy(false); }
  }

  async function copySource() {
    if (versionLoading || !detail?.content || detail.id !== selectedId) return;
    setNotice(''); setDetailError('');
    try {
      await navigator.clipboard.writeText(detail.content);
      setNotice('원문을 복사했습니다.');
    } catch {
      setDetailError('원문을 복사하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  const selectedVersion = versions.find(version => version.id === selectedId);
  const selection = activeId !== null && selectedId ? { documentType: 'RESUME' as const, documentId: activeId, versionId: selectedId } : null;
  return <div className="resume-workspace">
    <header className="resume-workspace-heading"><span className="resume-workspace-heading-icon"><img src={resumeHeadingDocument} alt="" aria-hidden="true" /></span><div><h1>이력서</h1><p>나의 이력서를 관리하고, AI 분석을 통해 더 나은 취업 준비를 해보세요.</p></div>{!listLoading && list.length === 0 && <a className="resume-primary resume-heading-create" href="#/resumes/new">＋ 이력서 작성하기</a>}</header>
    {!listLoading && !listError && list.length === 0 && routeId === null ? <ResumeEmptyState drafts={drafts} draftError={draftError} onDelete={removeDraft} onRetry={() => setListReload(value => value + 1)} /> : <div className="resume-workspace-layout">
      <aside className="resume-workspace-list" aria-label="이력서 목록">
        <div className="resume-workspace-list-top"><span>이력서 {list.length}/20개</span>{list.length < 20 && <a className="resume-primary" href="#/resumes/new">＋ 이력서 작성하기</a>}</div>
        {listLoading ? <p>이력서 목록을 불러오는 중입니다.</p> : listError ? <p role="alert">{listError} <button type="button" onClick={() => setListReload(value => value + 1)}>다시 시도</button></p> : <ul>{list.map(item => <li key={item.id}><a className={activeId === item.id ? 'is-active' : ''} href={`#/resumes/${item.id}`} onClick={() => { setTab('versions'); setShowRename(false); setShowVersionModal(false); }}><span className="resume-list-icon"><LucideIcon name="fileText" /></span><span className="resume-list-copy"><strong>{item.title}</strong><small>작성일 {formatDate(item.createdAt)} <span aria-hidden="true">·</span> 버전 {item.versionCount ?? item.latestVersionNumber}개</small></span><LucideIcon name="chevronRight" /></a></li>)}</ul>}
      </aside>
      <section className="resume-workspace-detail" aria-label="이력서 상세">
        {invalidRoute ? <p role="alert">이력서 주소를 확인해 주세요.</p> : documentLoading || listLoading ? <p>이력서를 불러오는 중입니다.</p> : detailError && !document ? <p role="alert">{detailError} <button type="button" onClick={() => setReload(value => value + 1)}>다시 시도</button></p> : document && <>
            <div className="resume-detail-heading"><span className="resume-detail-icon"><LucideIcon name="fileText" /></span><div><div className="resume-detail-title"><h2>{document.title}</h2><button type="button" aria-label="이력서 제목 수정" onClick={() => setShowRename(value => !value)}><LucideIcon name="pencil" /></button></div><p>최신 작성일 {formatDate(document.latestVersionCreatedAt)} <span aria-hidden="true">|</span> 버전 {versions.length}/10개</p></div><button type="button" className="resume-delete" disabled={busy} onClick={() => { if (window.confirm(resumeDeleteMessage)) void run(async () => { await api.remove(document.id); setListReload(value => value + 1); window.location.hash = '/resumes'; }); }}><LucideIcon name="trash" /> 삭제</button></div>
            {showRename && <form className="resume-rename" onSubmit={event => { event.preventDefault(); void run(async () => { setDocument(await api.rename(document.id, title.trim())); setShowRename(false); setListReload(value => value + 1); setNotice('제목을 변경했습니다.'); }); }}><label>이력서 제목<input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} required /></label><button className="resume-primary" disabled={busy || !title.trim()}>저장</button></form>}
            <nav className="resume-tabs" aria-label="이력서 정보">{([['versions', '버전 관리'], ['source', '원문 보기'], ['analysis', 'AI 분석 결과']] as const).map(([key, text]) => <button key={key} type="button" className={tab === key ? 'is-active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{text}</button>)}</nav>
            {tab === 'versions' && <><section className="resume-version-panel"><div className="resume-section-title"><h3>버전 목록</h3><button type="button" className="resume-primary" disabled={versionLoading || !detail || versions.length >= 10} title={versions.length >= 10 ? '이력서당 버전은 최대 10개까지 저장할 수 있습니다.' : undefined} onClick={() => setShowVersionModal(true)}>+ 새 버전 추가</button></div>
              <div className="resume-version-list">{versions.map(version => <div className={`resume-version-row ${selectedId === version.id ? 'is-selected' : ''}`} key={version.id}><span className="resume-version-icon">V{version.versionNumber}</span><span><a className="resume-version-title-link" href={`#/resumes/${document.id}/versions/${version.id}`}>{version.title || document.title} ({version.versionNumber === document.latestVersionNumber ? '최신' : '기본'} 버전)</a>{version.description && <span className="resume-version-description">{version.description}</span>}<small>작성일 {formatDate(version.createdAt)}</small></span><div className="resume-version-row-actions"><button type="button" onClick={() => { setSelectedId(version.id); setTab('source'); }}><LucideIcon name="eye" /> 원문</button><a href={`#/resumes/${document.id}/versions/${version.id}/edit`}><LucideIcon name="pencil" /> 수정</a><button type="button" className="is-danger" disabled={busy || versions.length <= 1} title={versions.length <= 1 ? '마지막 버전은 삭제할 수 없습니다.' : undefined} onClick={() => { if (window.confirm('이 버전과 연결된 분석 결과 및 공고 비교 결과를 삭제할까요? 삭제 후 복구할 수 없습니다.')) void run(async () => { await api.removeVersion(document.id, version.id); setReload(value => value + 1); setNotice('버전을 삭제했습니다.'); }); }}><LucideIcon name="trash" /> 삭제</button></div></div>)}</div></section>
              <section className="resume-analysis-preview"><div className="resume-section-title"><h3><LucideIcon name="star" /> AI 분석 결과</h3>{analysis && <span className={`resume-analysis-status is-${analysis.status.toLowerCase()}`}>{analysis.status === 'COMPLETED' ? '분석 완료' : analysis.status === 'PENDING' ? '분석 중' : '분석 실패'}</span>}</div><div className="resume-analysis-preview-body"><img src={resumeAnalysisArt} alt="" aria-hidden="true" /><div><strong>{analysis?.status === 'COMPLETED' ? '이력서 분석이 완료되었습니다!' : analysis?.status === 'PENDING' ? '이력서를 분석하고 있어요.' : 'AI로 이력서를 분석해 보세요.'}</strong><p>{analysis?.status === 'COMPLETED' ? '선택한 이력서의 강점과 보완점을 확인할 수 있습니다.' : '선택한 버전의 분석 상태와 결과를 확인할 수 있습니다.'}</p><button type="button" onClick={() => setTab('analysis')}>분석 결과 보기 <LucideIcon name="chevronRight" /></button></div></div><p className="resume-analysis-note">분석 결과는 저장된 버전에 연결되며, 삭제 시 복구할 수 없습니다.</p></section>
              <aside className="resume-tip"><LucideIcon name="lightbulb" /><div><strong>이력서 관리 팁</strong><p>새 버전을 추가하면 기존 버전은 유지됩니다. 버전별 원문을 확인하고, 필요한 경우 AI 분석을 요청해 보세요.</p></div></aside></>}
            {tab === 'source' && <section className="resume-source-panel"><div className="resume-section-title"><h3>{selectedVersion ? `V${selectedVersion.versionNumber} 원문` : '원문'}</h3><div className="resume-source-actions"><select aria-label="원문 버전 선택" value={selectedId ?? ''} onChange={event => setSelectedId(Number(event.target.value))}>{versions.map(version => <option key={version.id} value={version.id}>버전 {version.versionNumber} · {formatDate(version.createdAt)}</option>)}</select><button type="button" className="resume-source-copy" aria-label="원문 복사하기" title="원문 복사하기" disabled={versionLoading || !detail?.content || detail.id !== selectedId} onClick={() => void copySource()}><LucideIcon name="copy" /></button></div></div>{versionLoading ? <p>원문을 불러오는 중입니다.</p> : <pre>{detail?.content ?? ''}</pre>}{notice === '원문을 복사했습니다.' && <p className="resume-message resume-source-notice" role="status">{notice}</p>}</section>}
            {tab === 'analysis' && <section className="resume-analysis-panel"><div className="resume-section-title"><h3>AI 분석 결과</h3><select aria-label="분석 버전 선택" value={selectedId ?? ''} onChange={event => setSelectedId(Number(event.target.value))}>{versions.map(version => <option key={version.id} value={version.id}>버전 {version.versionNumber}</option>)}</select></div><div className="resume-analysis-intro"><img src={resumeAnalysisArt} alt="" aria-hidden="true" /><div><strong>{analysis?.status === 'COMPLETED' ? '이력서 분석이 완료되었습니다!' : '이력서를 AI로 분석해 보세요.'}</strong><p>선택한 버전의 기술·강점·개선 제안을 확인합니다.</p></div></div>{analysis?.status === 'COMPLETED' && analysis.result ? <><div className="resume-analysis-results">{([['기술', analysis.result.skills], ['강점', analysis.result.strengths], ['개선 제안', analysis.result.improvements]] as const).map(([heading, values]) => <div key={heading}><h4>{heading}</h4>{values.length ? <ul>{values.map((value, index) => <li key={index}>{value}</li>)}</ul> : <p>추출된 내용이 없습니다.</p>}</div>)}</div><button type="button" className="resume-delete" disabled={busy} onClick={() => { if (selection && window.confirm('이 버전의 저장된 분석 결과를 삭제할까요?')) void run(async () => { await api.removeAnalysis(selection); setAnalysis(null); setNotice('분석 결과를 삭제했습니다.'); }); }}>분석 결과 삭제</button></> : <><p>{analysis?.status === 'PENDING' ? '분석 중입니다. 저장 상태를 다시 조회해 주세요.' : analysis?.status === 'FAILED' ? analysis.failureReason ?? '분석에 실패했습니다.' : '저장된 분석 결과가 없습니다.'}</p><p>분석 시 개인정보 형식을 일부 제거한 뒤 원문을 외부 AI 서비스로 전송합니다. 자유 형식 개인정보는 완전히 제거되지 않을 수 있습니다.</p><label className="resume-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> 이 버전의 외부 AI 분석에 동의합니다.</label><div className="resume-form-actions"><button type="button" disabled={busy || !analysis || !selection} onClick={() => { if (selection) void run(async () => { setAnalysis(await api.analysis(selection)); setNotice('분석 상태를 다시 조회했습니다.'); }); }}>상태 다시 조회</button><button type="button" className="resume-primary" disabled={busy || !consent || !selection || analysis?.status === 'PENDING'} onClick={() => { if (selection) void run(async () => { setAnalysis(await api.analyze(selection)); setConsent(false); setNotice('분석을 요청했습니다.'); }); }}>분석 요청</button></div></>}</section>}
            {tab === 'analysis' && analysis && analysis.status !== 'COMPLETED' && <button type="button" className="resume-delete" disabled={busy} onClick={() => { if (selection && window.confirm('이 버전의 저장된 분석 결과를 삭제할까요?')) void run(async () => { await api.removeAnalysis(selection); setAnalysis(null); setNotice('분석 결과를 삭제했습니다.'); }); }}>분석 결과 삭제</button>}
          </>}
        {detailError && document && <p className="resume-message is-error" role="alert">{detailError}</p>}{notice && notice !== '원문을 복사했습니다.' && <p className="resume-message" role="status">{notice}</p>}
      </section>
    </div>}
    {!listLoading && list.length > 0 && drafts.length > 0 && <div className="resume-drafts-below"><ResumeDraftList drafts={drafts} onDelete={removeDraft} searchable /></div>}
    {!listLoading && list.length > 0 && draftError && <p className="resume-message is-error" role="alert">{draftError}</p>}
    {showVersionModal && document && detail && <ResumeVersionModal
      documentTitle={document.title}
      resumeId={document.id}
      sourceVersionId={detail.id}
      onClose={() => setShowVersionModal(false)}
    />}
  </div>;
}

function ResumeVersionModal({ documentTitle, resumeId, sourceVersionId, onClose }: {
  documentTitle: string;
  resumeId: number;
  sourceVersionId: number;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(documentTitle.slice(0, 50));
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'copy' | 'blank'>('copy');

  useEffect(() => {
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    window.sessionStorage.setItem(`resume-version-new:${resumeId}`, JSON.stringify({ sourceVersionId, title: title.trim(), description: description.trim(), mode }));
    window.location.hash = `/resumes/${resumeId}/versions/new`;
  };

  return <div className="resume-version-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="resume-version-modal" role="dialog" aria-modal="true" aria-labelledby="resume-version-modal-title" aria-describedby="resume-version-modal-description">
      <header><div className="resume-version-modal-heading"><LucideIcon name="fileText" /><div><h2 id="resume-version-modal-title">새 버전 추가</h2><p id="resume-version-modal-description">작성 방식을 고른 뒤 이력서 작성 화면에서 내용을 입력합니다.</p></div></div><button type="button" aria-label="새 버전 창 닫기" onClick={onClose}><LucideIcon name="close" /></button></header>
      <form onSubmit={submit}>
        <div className="resume-version-modal-body">
          <p className="resume-version-modal-note"><LucideIcon name="info" /> 기존 버전은 유지됩니다. 작성 화면에서 저장하면 새 버전이 생성됩니다.</p>
          <label className="resume-version-modal-field"><span>버전 제목 <em aria-hidden="true">*</em></span><input ref={titleRef} value={title} onChange={event => setTitle(event.target.value)} maxLength={50} required placeholder="버전을 구분할 제목을 입력하세요" /><small>{title.length}/50</small></label>
          <label className="resume-version-modal-field">버전 설명 (선택)<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={200} rows={3} placeholder="이번 버전에서 변경한 내용을 적어 주세요." /><small>{description.length}/200</small></label>
          <fieldset className="resume-version-modal-options"><legend><LucideIcon name="lightbulb" /> 어떤 방법으로 새 버전을 만들까요?</legend><label><input type="radio" name="resume-version-mode" checked={mode === 'copy'} onChange={() => setMode('copy')} /><span><strong>현재 버전을 복사해서 시작하기</strong><small>선택한 버전의 내용을 채운 작성 화면으로 이동합니다.</small></span></label><label><input type="radio" name="resume-version-mode" checked={mode === 'blank'} onChange={() => setMode('blank')} /><span><strong>빈 양식으로 새로 작성하기</strong><small>같은 입력 방식의 빈 작성 화면으로 이동합니다.</small></span></label></fieldset>
        </div>
        <footer><button type="button" onClick={onClose}>취소</button><button type="submit" className="resume-primary" disabled={!title.trim()}>작성 화면으로</button></footer>
      </form>
    </div>
  </div>;
}
