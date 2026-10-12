import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { createSavedJobsApi } from '../../api/saved-jobs';
import type { SavedJob, SavedJobsPage } from '../../api/saved-jobs';
import { createBookmarksApi } from '../../api/bookmarks';
import { createAnalysisApi } from '../../api/analysis';
import { ApiError } from '../../api/client';
import { ApplicationRegistration } from '../../components/ApplicationRegistration';
import { ApplicationStatusBadge } from '../../components/ApplicationStatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import './jobs.css';
import './job-detail.css';
import './bookmarks.css';
import savedBookmarkArt from '../../assets/jobs/saved-bookmark-filled.png';
import cardBookmarkArt from '../../assets/jobs/saved-card-bookmark-filled.png';
import emptyBookmarkArt from '../../assets/jobs/saved-card-bookmark-outline.png';
import savedTrashArt from '../../assets/jobs/saved-trash-pixel.png';
import savedHeartArt from '../../assets/jobs/saved-heart.png';
import analysisRobot from '../../assets/jobs/saved-analysis-robot-v3.png';
import savedEmptyCat from '../../assets/jobs/saved-empty-cat.png';

const savedJobs = createSavedJobsApi(apiRequest);
const bookmarks = createBookmarksApi(apiRequest);
const roleLabels: Record<string, string> = { DEVELOPMENT: '개발', DATA_AI: '데이터·AI', SECURITY: '보안',
  INFRA: '클라우드·인프라', IT_OPERATIONS: '전산·IT 운영' };
function deadlineLabel(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return `마감 ${value}`;
  const today = new Date();
  const days = Math.round((Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  return days > 0 ? `D-${days}` : days === 0 ? 'D-Day' : '마감';
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
  const [actionError, setActionError] = useState('');
  const [view, setView] = useState<'ALL' | 'COLLECTED' | 'MANUAL'>('ALL');
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const [unbookmarkedIds, setUnbookmarkedIds] = useState<number[]>([]);
  const [pendingUnbookmarkIds, setPendingUnbookmarkIds] = useState<number[]>([]);
  const [bookmarkBusyIds, setBookmarkBusyIds] = useState<number[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [deleteBusyIds, setDeleteBusyIds] = useState<number[]>([]);
  const [registeredManualIds, setRegisteredManualIds] = useState<number[]>([]);
  const savedCount = data ? data.totalElements - unbookmarkedIds.length : 0;
  const isUnbookmarked = (item: SavedJob) => item.kind === 'COLLECTED' && unbookmarkedIds.includes(item.jobId!);
  const visibleItems = data?.items.filter(item => (view === 'ALL' || item.kind === view)
    && `${item.companyName} ${item.title} ${item.role || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => (order === 'newest' ? -1 : 1) * (Date.parse(a.createdAt) - Date.parse(b.createdAt))) || [];
  const navigatePage = (next: number) => { window.location.hash = `/bookmarks?page=${next}`; };
  const openCreate = () => { window.location.hash = '/bookmarks/new'; };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setData(undefined);
    if (!Number.isSafeInteger(page) || page < 0 || page * size > 2147483647) {
      setError('관심공고 페이지 주소를 확인해 주세요.'); setLoading(false); return;
    }
    savedJobs.list(page, size, controller.signal).then(value => { if (!controller.signal.aborted) {
      setData(value);
      setUnbookmarkedIds(ids => ids.filter(id => value.items.some(item => item.kind === 'COLLECTED' && item.jobId === id)));
    } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '관심공고를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  return <div className="jobs-page jobs-page--saved">
    <section className="saved-page-header" aria-label="관심 공고">
      <img src={savedBookmarkArt} alt="" aria-hidden="true" />
      <div className="saved-page-heading"><h1>관심 공고</h1><p>저장한 채용공고를 관리하고 AI 분석을 확인하세요.</p></div>
      <div className="saved-page-heading-actions"><span className="saved-total"><img src={savedHeartArt} alt="" aria-hidden="true" /> {data ? `${savedCount}개 저장됨` : '저장한 공고'}</span>
        <a className="saved-create" href="#/bookmarks/new"><LucideIcon name="plus" />공고 직접 등록</a></div>
    </section>
    <section className="card saved-page-content" aria-label="관심 공고 목록" aria-busy={loading}>
      <div className="saved-toolbar"><div className="saved-tabs" role="group" aria-label="공고 종류">
        {([{ value: 'ALL', label: '전체' }, { value: 'COLLECTED', label: '저장한 공고' }, { value: 'MANUAL', label: '직접 등록' }] as const).map(option =>
          <button key={option.value} type="button" aria-pressed={view === option.value} onClick={() => setView(option.value)}>{option.label}{data && (option.value === 'ALL' || data.totalElements <= size)
            ? ` (${option.value === 'ALL' ? savedCount : data.items.filter(item => item.kind === option.value && !isUnbookmarked(item)).length})` : ''}</button>)}</div>
        <div className="saved-toolbar-search"><label className="saved-visually-hidden" htmlFor="saved-query">현재 페이지에서 검색</label><LucideIcon name="search" />
          <input id="saved-query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="현재 페이지에서 회사명·공고명·직무 검색" />
          <label className="saved-visually-hidden" htmlFor="saved-order">현재 페이지 정렬</label><select id="saved-order" value={order} onChange={event => setOrder(event.target.value as 'newest' | 'oldest')}>
            <option value="newest">최근 저장순</option><option value="oldest">오래된 저장순</option></select></div></div>
      {actionError && <ErrorState message={actionError} onRetry={() => { setActionError(''); setRetry(value => value + 1); }} />}
      {loading ? <LoadingState message="관심공고를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : data && <>
        <p className="saved-page-summary" role="status">총 {savedCount}건 · {data.page + 1}페이지{data.totalElements > size && ' · 검색·분류는 현재 페이지에 적용됩니다.'}</p>
        {data.items.length === 0 ? <SavedEmpty hasItems={false} onCreate={openCreate} />
          : visibleItems.length === 0 ? <SavedEmpty hasItems onCreate={openCreate} />
          : <ul className="job-list saved-list">{visibleItems.map(item => <li className={`job-card saved-card${pendingDeleteIds.includes(item.id) && item.kind === 'MANUAL' ? ' saved-card--delete-pending' : ''}${item.kind === 'COLLECTED' && pendingUnbookmarkIds.includes(item.jobId!) ? ' saved-card--unbookmark-pending' : ''}`} key={`${item.kind}-${item.id}`}>
            <div className="saved-card-top"><span className="saved-company-icon"><LucideIcon name="building" /></span>
              <div className="saved-card-copy"><div className="saved-card-labels"><strong>{item.companyName}</strong>
                <span className={`saved-kind saved-kind--${pendingDeleteIds.includes(item.id) && item.kind === 'MANUAL' ? 'pending' : item.kind === 'COLLECTED' && pendingUnbookmarkIds.includes(item.jobId!) ? 'pending-unbookmark' : isUnbookmarked(item) ? 'unbookmarked' : item.kind.toLowerCase()}`}>{pendingDeleteIds.includes(item.id) && item.kind === 'MANUAL' ? '삭제 예정' : item.kind === 'COLLECTED' && pendingUnbookmarkIds.includes(item.jobId!) ? '관심 해제 예정' : isUnbookmarked(item) ? '관심 해제됨' : item.kind === 'MANUAL' ? '직접 등록' : '저장한 공고'}</span>
                {item.applicationStatus && <span className={`saved-card-application-status--${item.applicationStatus.toLowerCase()}`}><ApplicationStatusBadge status={item.applicationStatus} /></span>}</div>
                <h2>{item.kind === 'COLLECTED' && item.jobId
                  ? <a href={`#/jobs/${item.jobId}?origin=bookmarks`}>{item.title} <LucideIcon name="chevronRight" /></a>
                  : <a href={`#/bookmarks/${item.id}`}>{item.title} <LucideIcon name="chevronRight" /></a>}</h2>
                <div className="saved-card-meta">{item.location && <span>{item.location}</span>}{item.careerLevel && <span>{item.careerLevel}</span>}
                  {item.employmentType && <span>{item.employmentType}</span>}</div>
                {item.role && <span className="saved-role">{roleLabels[item.role] || item.role}</span>}</div>
              <div className="saved-card-side">{item.kind === 'MANUAL' ? <button type="button" className="saved-remove saved-manual-delete" aria-label={`${item.title} ${pendingDeleteIds.includes(item.id) ? '삭제 취소' : '삭제 예정으로 표시'}`}
                aria-pressed={pendingDeleteIds.includes(item.id)} disabled={deleteBusyIds.includes(item.id)}
                title={pendingDeleteIds.includes(item.id) ? '삭제 예정 취소' : '삭제 예정으로 표시'}
                onClick={() => setPendingDeleteIds(ids => ids.includes(item.id) ? ids.filter(id => id !== item.id) : [...ids, item.id])}>
                <img src={savedTrashArt} alt="" aria-hidden="true" /></button> : <button type="button" className="saved-remove"
                aria-label={`${item.title} ${isUnbookmarked(item) ? '다시 관심 등록' : pendingUnbookmarkIds.includes(item.jobId!) ? '관심 해제 취소' : '관심 해제 예정으로 표시'}`}
                aria-pressed={!isUnbookmarked(item)} disabled={bookmarkBusyIds.includes(item.jobId!)}
                title={isUnbookmarked(item) ? '다시 관심 공고로 등록' : pendingUnbookmarkIds.includes(item.jobId!) ? '관심 해제 취소' : '관심 해제 예정으로 표시'}
                onClick={async () => {
                  if (bookmarkBusyIds.includes(item.jobId!)) return;
                  if (!isUnbookmarked(item)) {
                    setPendingUnbookmarkIds(ids => ids.includes(item.jobId!) ? ids.filter(id => id !== item.jobId) : [...ids, item.jobId!]);
                    return;
                  }
                  setBookmarkBusyIds(ids => [...ids, item.jobId!]); setActionError('');
                  try {
                    await bookmarks.add(item.jobId!);
                    setUnbookmarkedIds(ids => ids.filter(id => id !== item.jobId));
                    setRetry(value => value + 1);
                  } catch (failure) { setActionError(failure instanceof Error ? failure.message : '관심 공고를 변경하지 못했습니다.'); }
                  finally { setBookmarkBusyIds(ids => ids.filter(id => id !== item.jobId)); }
                }}><img src={isUnbookmarked(item) ? emptyBookmarkArt : cardBookmarkArt} alt="" aria-hidden="true" /></button>}
                <small title={item.deadlineDate ? `마감일 ${item.deadlineDate}` : undefined}>{item.deadlineDate ? deadlineLabel(item.deadlineDate) : `저장 ${new Date(item.createdAt).toLocaleDateString('ko-KR')}`}</small></div></div>
            <SavedAnalysis item={item} onUpdated={() => { if (!isUnbookmarked(item)) setRetry(value => value + 1); }} />
            <div className="saved-card-actions"><a href={item.url} target="_blank" rel="noopener noreferrer">외부 원문 열기 <LucideIcon name="arrowRight" /></a>
              {item.kind === 'MANUAL' && <a href={`#/bookmarks/${item.id}/edit`}>공고 수정</a>}
              {item.kind === 'COLLECTED' && item.applicationStatus && <a href="#/applications">지원관리 <LucideIcon name="arrowRight" /></a>}</div>
            {item.kind === 'COLLECTED' && pendingUnbookmarkIds.includes(item.jobId!) && <div className="saved-unbookmark-confirm" role="status">
              <p>관심 해제 예정입니다. 확정하면 저장 목록에서 제거됩니다. 이 화면에서는 다시 관심 등록할 수 있습니다.</p>
              <button type="button" onClick={() => setPendingUnbookmarkIds(ids => ids.filter(id => id !== item.jobId))}>해제 취소</button>
              <button type="button" className="saved-unbookmark-commit" disabled={bookmarkBusyIds.includes(item.jobId!)} onClick={async () => {
                setBookmarkBusyIds(ids => [...ids, item.jobId!]); setActionError('');
                try {
                  await bookmarks.remove(item.jobId!);
                  setUnbookmarkedIds(ids => [...ids, item.jobId!]);
                  setPendingUnbookmarkIds(ids => ids.filter(id => id !== item.jobId));
                } catch (failure) { setActionError(failure instanceof Error ? failure.message : '관심 공고를 해제하지 못했습니다.'); }
                finally { setBookmarkBusyIds(ids => ids.filter(id => id !== item.jobId)); }
              }}>{bookmarkBusyIds.includes(item.jobId!) ? '해제 중…' : '관심 해제 확정'}</button>
            </div>}
            {item.kind === 'MANUAL' && pendingDeleteIds.includes(item.id) && <div className="saved-delete-confirm" role="status">
              <p>삭제 예정입니다. 확정 전에는 공고와 지원 기록이 그대로 유지됩니다.</p>
              <button type="button" onClick={() => setPendingDeleteIds(ids => ids.filter(id => id !== item.id))}>삭제 취소</button>
              <button type="button" className="saved-delete-commit" disabled={deleteBusyIds.includes(item.id)} onClick={async () => {
                setDeleteBusyIds(ids => [...ids, item.id]); setActionError('');
                try { await savedJobs.delete(item.id); setPendingDeleteIds(ids => ids.filter(id => id !== item.id)); setRetry(value => value + 1); }
                catch (failure) { setActionError(failure instanceof Error ? failure.message : '삭제하지 못했습니다.'); }
                finally { setDeleteBusyIds(ids => ids.filter(id => id !== item.id)); }
              }}>{deleteBusyIds.includes(item.id) ? '삭제 중…' : '삭제 확정'}</button>
            </div>}
            {item.kind === 'MANUAL' && !item.applicationStatus && !registeredManualIds.includes(item.id) && <div className="job-detail-tab-panel saved-card-application"><ApplicationRegistration
              personalSavedJobId={item.id} status={item.applicationStatus} buttonStatusPicker
              onCreated={() => { setRegisteredManualIds(ids => [...ids, item.id]); setRetry(value => value + 1); }} /></div>}
          </li>)}</ul>}
        <nav className="job-actions job-pagination" aria-label="관심공고 페이지"><button disabled={page === 0} onClick={() => navigatePage(page - 1)}>이전 페이지</button>
          <button disabled={(page + 1) * size >= data.totalElements} onClick={() => navigatePage(page + 1)}>다음 페이지</button></nav>
      </>}
    </section></div>;
}

function SavedEmpty({ hasItems, onCreate }: { hasItems: boolean; onCreate: () => void }) {
  return <div className="saved-empty" role="status">
    <img src={savedEmptyCat} alt="" aria-hidden="true" />
    <h2>{hasItems ? '이 페이지에 일치하는 공고가 없습니다.' : '아직 저장한 관심공고가 없습니다.'}</h2>
    <p>{hasItems ? <>검색 조건을 다시 확인해보거나,<br />관심 있는 공고를 직접 등록해보세요.</>
      : <>관심 있는 채용공고를 저장하거나<br />직접 등록해보세요.</>}</p>
    <button type="button" className="saved-create" onClick={onCreate}><LucideIcon name="plus" />공고 직접 등록</button>
  </div>;
}

type Preview = { status: string; requiredSkills: string[]; preferredSkills: string[]; failureReason: string | null };
function SavedAnalysis({ item, onUpdated }: { item: SavedJob; onUpdated: () => void }) {
  const [analysis, setAnalysis] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!showDetails) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [showDetails]);
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
    try {
      if (item.kind === 'MANUAL') setAnalysis(manualAnalysis(await savedJobs.requestAnalysis(item.id)));
      else {
        const value = await createAnalysisApi(apiRequest).request(item.jobId!);
        setAnalysis({ status: value.status, requiredSkills: value.requiredSkills.map(skill => skill.name),
          preferredSkills: value.preferredSkills.map(skill => skill.name), failureReason: value.failureReason });
      }
      onUpdated();
    }
    catch (failure) { setError(failure instanceof ApiError && failure.status === 503
      ? 'AI 분석 서버 설정을 확인해 주세요.' : failure instanceof ApiError && failure.status === 400
        ? '공고 본문을 먼저 입력해 주세요.' : failure instanceof Error ? failure.message : '분석에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  const status = analysis?.status || item.analysisStatus;
  const skills = analysis?.status === 'COMPLETED' ? [...analysis.requiredSkills, ...analysis.preferredSkills] : [];
  const completed = status === 'COMPLETED';
  const detailsId = `saved-analysis-details-${item.kind.toLowerCase()}-${item.id}`;
  return <><div className={`saved-analysis${completed ? ' saved-analysis--interactive' : ''}`} aria-live="polite"
    role={completed ? 'button' : undefined} tabIndex={completed ? 0 : undefined}
    aria-haspopup={completed ? 'dialog' : undefined} aria-label={completed ? `${item.companyName} AI 분석 상세 보기` : undefined}
    onClick={completed ? () => setShowDetails(true) : undefined}
    onKeyDown={completed ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setShowDetails(true); } } : undefined}>
    <img src={analysisRobot} alt="" aria-hidden="true" />
    <div className="saved-analysis-copy"><div className="saved-analysis-heading"><strong>AI 분석</strong><span className={`saved-analysis-status saved-analysis-status--${(status || 'NONE').toLowerCase()}`}>
      {status === 'COMPLETED' ? '분석 완료' : status === 'PENDING' ? '분석 중' : status === 'FAILED' ? '분석 실패' : '미분석'}</span></div>
      <p>{status === 'COMPLETED' ? !analysis ? '분석 결과를 불러오는 중입니다.' : skills.length ? `추출된 기술 ${skills.length}개` : '추출된 기술이 없습니다.'
        : status === 'PENDING' ? '공고를 분석하고 있습니다.' : status === 'FAILED' ? analysis?.failureReason || '분석을 다시 시도해 주세요.'
          : item.kind === 'MANUAL' && !item.description ? '공고 본문을 입력하면 AI 분석을 요청할 수 있습니다.' : '공고의 필수·우대 기술을 확인해 보세요.'}</p>
      {skills.length > 0 && <div className="saved-analysis-skills">{skills.slice(0, 5).map((skill, index) => <span key={`${skill}-${index}`}>{skill}</span>)}
        {skills.length > 5 && <span>외 {skills.length - 5}개</span>}</div>}
      {error && <p className="saved-analysis-error" role="alert">{error}</p>}</div>
    {completed ? <span className="saved-analysis-detail-hint">상세 보기 <LucideIcon name="chevronRight" /></span>
      : <button className="saved-analysis-action" type="button" disabled={busy || (item.kind === 'MANUAL' && !item.description) || status === 'PENDING'} onClick={run}>
        {busy || status === 'PENDING' ? '분석 중…' : status === 'FAILED' ? '다시 분석하기' : 'AI 분석하기'}</button>
    }
  </div>
    {showDetails && <dialog ref={dialogRef} className="saved-analysis-dialog" aria-labelledby={detailsId}
      onClose={() => setShowDetails(false)} onClick={event => { if (event.target === event.currentTarget) setShowDetails(false); }}>
      <div className="saved-analysis-dialog-heading"><div><span>AI 분석 결과</span><h2 id={detailsId}>{item.title}</h2></div>
        <button type="button" className="saved-analysis-dialog-close" aria-label="분석 상세 닫기" onClick={() => setShowDetails(false)}>×</button></div>
      <div className="saved-analysis-dialog-body">
        {analysis?.status === 'COMPLETED' ? <><section><h3>필수 기술 <small>{analysis.requiredSkills.length}개</small></h3>
          {analysis.requiredSkills.length ? <ul>{analysis.requiredSkills.map((skill, index) => <li key={`${skill}-${index}`}>{skill}</li>)}</ul> : <p>추출된 필수 기술이 없습니다.</p>}</section>
          <section><h3>우대 기술 <small>{analysis.preferredSkills.length}개</small></h3>
            {analysis.preferredSkills.length ? <ul>{analysis.preferredSkills.map((skill, index) => <li key={`${skill}-${index}`}>{skill}</li>)}</ul> : <p>추출된 우대 기술이 없습니다.</p>}</section></>
          : <p>{error || '분석 결과를 불러오고 있습니다.'}</p>}
      </div>
    </dialog>}
  </>;
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
