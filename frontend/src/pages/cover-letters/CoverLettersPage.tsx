import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest } from '../../api';
import { createDocumentApi } from '../../api/documents';
import type { DocumentSummary } from '../../api/documents';
import { createCoverLetterDraftApi } from '../../api/cover-letter-draft';
import type { CoverLetterDraftSummary } from '../../api/cover-letter-draft';
import { LucideIcon } from '../../components/LucideIcon';
import { DocumentPage } from '../resumes/DocumentPage';
import banner from '../../assets/illustrations/cover-letter-banner-pixel.png';
import empty from '../../assets/illustrations/cover-letter-empty-pixel.png';
import titleArt from '../../assets/illustrations/cover-letter-title-pixel.png';
import './cover-letters.css';

const api = createDocumentApi(apiRequest, 'COVER_LETTER');
const draftsApi = createCoverLetterDraftApi(apiRequest);
const errorText = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
const date = (value: string) => new Date(value).toLocaleDateString('ko-KR');

export function CoverLettersPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/cover-letters/new') return <CoverLetterEditor location={location} />;
  if (path !== '/cover-letters') return <DocumentPage type="COVER_LETTER" location={location} />;
  return <CoverLetterWorkspace />;
}

function CoverLetterWorkspace() {
  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [drafts, setDrafts] = useState<CoverLetterDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftLoadError, setDraftLoadError] = useState('');
  const [draftActionError, setDraftActionError] = useState('');
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'oldest'>('recent');
  const [busyId, setBusyId] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setDraftLoadError('');
    Promise.allSettled([api.list(0, controller.signal), draftsApi.list(controller.signal)]).then(([saved, pending]) => {
      if (controller.signal.aborted) return;
      if (saved.status === 'fulfilled') setItems(saved.value.items);
      else setError(errorText(saved.reason));
      if (pending.status === 'fulfilled') setDrafts(pending.value);
      else setDraftLoadError(errorText(pending.reason));
      setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);
  const query = search.trim().toLocaleLowerCase();
  const savedRows = items.filter(v => v.title.toLocaleLowerCase().includes(query))
    .sort((a, b) => (sort === 'recent' ? -1 : 1) * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)));
  const draftRows = drafts.filter(v => v.title.toLocaleLowerCase().includes(query))
    .sort((a, b) => (sort === 'recent' ? -1 : 1) * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)));
  async function removeDraft(id: number) {
    if (!window.confirm('임시저장한 자기소개서를 삭제할까요?')) return;
    setBusyId(id); setDraftActionError('');
    try { await draftsApi.remove(id); setDrafts(rows => rows.filter(row => row.id !== id)); }
    catch (cause) { setDraftActionError(errorText(cause)); }
    finally { setBusyId(null); }
  }
  return <div className="cover-page">
    <header className="cover-banner" style={{ backgroundImage: `linear-gradient(90deg, #e1d9f2 0%, #e1d9f2 var(--cover-fade-start), rgba(225, 217, 242, .82) var(--cover-fade-middle), transparent var(--cover-fade-end)), url(${banner})` }}>
      <div className="cover-banner__copy"><div className="cover-banner__title"><span className="cover-banner__icon"><img src={titleArt} alt="" aria-hidden="true" /></span>
        <h1>자기소개서</h1></div><p>나의 자기소개서를 관리하고, AI 분석을 통해 더 나은 지원서를 준비해보세요.</p>
      </div>
    </header>
    <section className="cover-panel" aria-labelledby="cover-overview-title">
      <div className="cover-panel__heading"><span className="cover-icon"><LucideIcon name="fileText" /></span>
        <div><h2 id="cover-overview-title">{loading || error ? '자기소개서' : `총 ${items.length}개의 자기소개서`}</h2><p>지금까지 작성한 자기소개서를 확인하고 버전을 관리해 보세요.</p></div>
        <a className="cover-button cover-button--primary" href={items.length >= 20 ? undefined : '#/cover-letters/new'} aria-disabled={items.length >= 20}><LucideIcon name="plus" /> 자기소개서 작성하기</a>
      </div>
      {!loading && !error && items.length >= 20 && <p className="cover-status" role="status">최대 20개까지 등록할 수 있습니다. 새 문서를 만들려면 기존 문서를 삭제해 주세요.</p>}
      {loading ? <p className="cover-status" role="status">자기소개서를 불러오는 중입니다.</p> : error ? <div className="cover-status" role="alert">{error} <button onClick={() => setReload(n => n + 1)}>다시 시도</button></div>
        : items.length === 0 && <div className="cover-empty"><img src={empty} alt="" aria-hidden="true" /><h3>등록한 자기소개서가 없습니다.</h3>
          <p>첫 자기소개서를 작성하고 버전별로 관리해 보세요.</p></div>}
      <div className="cover-columns">
        <section className="cover-list" aria-labelledby="cover-saved-title"><div className="cover-list__heading"><h3 id="cover-saved-title"><LucideIcon name="fileText" /><span>자기소개서 목록 ({items.length})</span></h3></div>
          <div className="cover-list__filters"><label><LucideIcon name="search" /><span className="sr-only">자기소개서 제목 검색</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="제목을 검색해 보세요..." /></label>
            <select value={sort} onChange={e => setSort(e.target.value as 'recent' | 'oldest')} aria-label="자기소개서 정렬"><option value="recent">최신순</option><option value="oldest">오래된순</option></select></div>
          {loading ? <p className="cover-list__placeholder">불러오는 중입니다.</p> : error ? <p className="cover-list__placeholder">목록을 불러오지 못했습니다.</p> : savedRows.length === 0 ? <p className="cover-list__placeholder">{query ? '검색 결과가 없습니다.' : '작성한 자기소개서가 없습니다.'}</p>
            : <ul>{savedRows.map(item => <li key={item.id}><a href={`#/cover-letters/${item.id}`}><span className="cover-row-icon"><LucideIcon name="fileText" /></span><span><strong>{item.title}</strong><small>수정 {date(item.updatedAt)} · 버전 {item.latestVersionNumber}</small></span><LucideIcon name="chevronRight" /></a></li>)}</ul>}
        </section>
        <section className="cover-list" aria-labelledby="cover-drafts-title"><div className="cover-list__heading"><h3 id="cover-drafts-title"><LucideIcon name="clock" /><span>임시저장 목록 ({drafts.length})</span></h3></div>
          {draftActionError && <p className="cover-inline-error" role="alert">{draftActionError}</p>}
          {loading ? <p className="cover-list__placeholder">불러오는 중입니다.</p> : draftLoadError ? <div className="cover-list__error" role="alert"><LucideIcon name="info" /><div><strong>임시저장을 불러오지 못했습니다.</strong><p>{draftLoadError}</p></div><button type="button" className="cover-button cover-button--quiet" onClick={() => setReload(n => n + 1)}>다시 시도</button></div> : draftRows.length === 0 ? <p className="cover-list__placeholder">{query ? '검색 결과가 없습니다.' : '임시저장한 자기소개서가 없습니다.'}</p>
            : <ul>{draftRows.map(item => <li key={item.id}><span className="cover-row-icon"><LucideIcon name="fileText" /></span><span className="cover-row-copy"><strong>{item.title}</strong><small>마지막 저장 {date(item.updatedAt)}</small></span>
              <a className="cover-button cover-button--quiet" href={`#/cover-letters/new?draft=${item.id}`}><LucideIcon name="pencil" /> 이어 작성</a><button className="cover-delete" disabled={busyId === item.id} onClick={() => void removeDraft(item.id)} aria-label={`${item.title} 임시저장 삭제`}><LucideIcon name="trash" /></button></li>)}</ul>}
        </section>
      </div>
    </section>
  </div>;
}

function CoverLetterEditor({ location }: { location: string }) {
  const parsed = Number(new URLSearchParams(location.split('?')[1] ?? '').get('draft'));
  const initialDraftId = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
  const [draftId, setDraftId] = useState(initialDraftId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(!!initialDraftId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  useEffect(() => {
    if (!initialDraftId) return;
    const controller = new AbortController();
    draftsApi.get(initialDraftId, controller.signal).then(value => {
      if (!controller.signal.aborted) { setTitle(value.title === '제목 없는 임시저장 자기소개서' ? '' : value.title); setContent(value.content); setLoading(false); }
    }).catch(cause => { if (!controller.signal.aborted) { setError(errorText(cause)); setDraftLoadFailed(true); setLoading(false); } });
    return () => controller.abort();
  }, [initialDraftId]);
  async function saveDraft() {
    setBusy(true); setError(''); setNotice('');
    try { const result = await draftsApi.save(title, content, draftId); setDraftId(result.id); setNotice('임시저장했습니다.'); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  async function publish(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const result = await api.create(title.trim(), content, draftId); window.location.hash = `#/cover-letters/${result.id}`; }
    catch (cause) { setError(errorText(cause)); setBusy(false); }
  }
  return <div className="cover-page cover-editor"><a href="#/cover-letters" className="cover-back"><LucideIcon name="arrowLeft" /> 자기소개서 목록</a>
    <div className="cover-editor__heading"><h1>{draftId ? '자기소개서 이어 작성' : '새 자기소개서 작성'}</h1><p>제목과 원문을 작성한 뒤 저장하세요. 작성 중에는 임시저장할 수 있습니다.</p></div>
    {loading ? <p role="status">임시저장을 불러오는 중입니다.</p> : draftLoadFailed ? <p>임시저장을 열지 못했습니다. 목록에서 다시 선택해 주세요.</p> : <form onSubmit={event => void publish(event)} className="cover-editor__form">
      <label>제목<input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} required /></label>
      <label>원문<textarea value={content} maxLength={100000} rows={18} onChange={e => setContent(e.target.value)} required /></label>
      <div className="cover-editor__actions"><button type="button" className="cover-button cover-button--quiet" disabled={busy} onClick={() => void saveDraft()}>임시저장</button>
        <button type="submit" className="cover-button cover-button--primary" disabled={busy || !title.trim() || !content.trim()}>자기소개서 등록</button></div>
    </form>}{error && <p className="cover-inline-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </div>;
}
