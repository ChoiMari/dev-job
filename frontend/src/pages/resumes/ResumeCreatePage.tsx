import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createDocumentApi } from '../../api/documents';
import { LucideIcon } from '../../components/LucideIcon';
import { ResumeGuideModal } from './ResumeEmptyState';
import './resume-workspace.css';

const api = createDocumentApi(apiRequest, 'RESUME');

export function ResumeCreatePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [count, setCount] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api.list(0, controller.signal).then(value => { if (!controller.signal.aborted) setCount(value.totalElements); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '이력서 수를 확인하지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || count === undefined || count >= 20) return;
    setBusy(true); setError('');
    try { const created = await api.create(title.trim(), content); window.location.hash = `/resumes/${created.id}`; }
    catch (failure) { setError(failure instanceof Error ? failure.message : '이력서를 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  return <div className="resume-workspace resume-create-page">
    <header className="resume-workspace-heading"><div className="resume-workspace-heading-icon"><LucideIcon name="fileText" /></div><div><h1>새 이력서 작성</h1><p>개발 경험을 정리하고 첫 번째 버전으로 저장하세요.</p></div></header>
    <div className="resume-create-toolbar"><a href="#/resumes"><LucideIcon name="arrowLeft" /> 이력서 목록</a><button type="button" onClick={() => setGuideOpen(true)}><LucideIcon name="fileText" /> 작성 가이드 보기</button></div>
    <section className="resume-create-card"><div className="resume-create-card-heading"><h2>이력서 작성</h2><p>제목과 원문을 입력해 첫 버전을 만드세요. 저장 후 원문을 덮어쓰지 않고 새 버전을 추가할 수 있습니다.</p></div>
      {loading ? <p>등록 가능한 이력서 수를 확인하는 중입니다.</p> : count === undefined ? <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p> : count >= 20 ? <p role="status">최대 20개까지 등록할 수 있습니다. 새 이력서를 만들려면 기존 이력서를 삭제해 주세요.</p> : <form onSubmit={event => void create(event)}><label>이력서 제목<input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} placeholder="예: 백엔드 개발자 이력서" required /></label><label>이력서 원문<textarea value={content} onChange={event => setContent(event.target.value)} maxLength={100000} rows={16} placeholder="기술 스택, 프로젝트, 문제 해결 경험과 성과를 구체적으로 작성해 주세요." required /></label><div className="resume-form-actions"><a href="#/resumes">취소</a><button type="submit" className="resume-primary" disabled={busy || !title.trim() || !content.trim()}>{busy ? '저장 중…' : '이력서 저장'}</button></div></form>}
      {error && count !== undefined && <p className="resume-message is-error" role="alert">{error}</p>}
    </section>
    {guideOpen && <ResumeGuideModal onClose={() => setGuideOpen(false)} />}
  </div>;
}
