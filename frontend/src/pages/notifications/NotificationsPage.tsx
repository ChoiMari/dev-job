import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { createNotificationsApi, notificationSource } from '../../api/notifications';
import type { NotificationItem, NotificationPage, NotificationType } from '../../api/notifications';
import { ErrorState, LoadingState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import './notifications.css';

const notifications = createNotificationsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '알림을 처리하지 못했습니다.';
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const pageSize = 7;
type Filter = 'all' | 'unread' | 'read';

const icon: Record<NotificationType, string> = {
  INTERVIEW_REMINDER: 'calendar', TODO_REMINDER: 'checklist', NEW_JOB: 'megaphone',
  AI_JOB_RECOMMENDATION: 'star', SAVED_JOB_UPDATE: 'bookmark', DOCUMENT_ANALYSIS: 'document',
  MATCH_ANALYSIS: 'analysis', PERSONAL_JOB_ANALYSIS: 'analysis', SEMANTIC_RECOMMENDATION: 'comparison',
  LEARNING_GOAL_REMINDER: 'book', CHARACTER_ACTIVITY: 'cat', SERVICE_NOTICE: 'bell',
};
const guide: Record<NotificationType, string> = {
  INTERVIEW_REMINDER: '면접 일정과 준비할 내용을 확인해 보세요.',
  TODO_REMINDER: '기한이 다가오는 할 일을 확인해 보세요.',
  NEW_JOB: '새로 등록된 채용공고를 확인해 보세요.',
  AI_JOB_RECOMMENDATION: '기술이 일치하는 추천 공고를 살펴보세요.',
  SAVED_JOB_UPDATE: '관심 공고의 변경 내용을 확인해 보세요.',
  DOCUMENT_ANALYSIS: '완료된 문서 분석 결과를 확인해 보세요.',
  MATCH_ANALYSIS: '완료된 공고 기술 분석을 확인해 보세요.',
  PERSONAL_JOB_ANALYSIS: '완료된 직접 등록 공고의 기술 분석을 확인해 보세요.',
  SEMANTIC_RECOMMENDATION: '문서와 공고의 비교 결과를 확인해 보세요.',
  LEARNING_GOAL_REMINDER: '진행 중인 학습 목표를 확인해 보세요.',
  CHARACTER_ACTIVITY: '캐릭터 활동과 보상을 확인해 보세요.',
  SERVICE_NOTICE: '서비스의 새로운 소식을 확인해 보세요.',
};
function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}일 전`;
  return date(value);
}

export function NotificationsPage() {
  const [result, setResult] = useState<NotificationPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number>();
  const [busyAll, setBusyAll] = useState(false);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    async function load() {
      const first = await notifications.list(0, controller.signal);
      const remaining = await Promise.all(Array.from({ length: Math.ceil(first.totalElements / first.size) - 1 },
        (_, index) => notifications.list(index + 1, controller.signal)));
      if (!controller.signal.aborted) setResult({ ...first, items: [first, ...remaining].flatMap(value => value.items) });
    }
    void load().catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  async function markRead(id: number) {
    if (busy.current) return;
    busy.current = true; setBusyId(id); setActionError('');
    try {
      await notifications.markRead(id);
      if (mounted.current) {
        setResult(current => current && ({ ...current, unreadCount: Math.max(0, current.unreadCount - 1),
          items: current.items.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item) }));
        window.dispatchEvent(new Event('devjob:notifications-updated'));
      }
    } catch (failure) { if (mounted.current) setActionError(message(failure)); }
    finally { busy.current = false; if (mounted.current) setBusyId(undefined); }
  }

  async function markAllRead() {
    if (busy.current || !result) return;
    busy.current = true; setBusyAll(true); setActionError('');
    try {
      for (const item of result.items.filter(item => !item.readAt)) await notifications.markRead(item.id);
      if (mounted.current) {
        const readAt = new Date().toISOString();
        setResult(current => current && ({ ...current, unreadCount: 0,
          items: current.items.map(item => item.readAt ? item : { ...item, readAt }) }));
        window.dispatchEvent(new Event('devjob:notifications-updated'));
      }
    } catch (failure) {
      if (mounted.current) { setActionError(message(failure)); setRetry(value => value + 1); }
    } finally { busy.current = false; if (mounted.current) setBusyAll(false); }
  }

  const unread = result?.unreadCount ?? 0;
  const filtered = result?.items.filter(item => filter === 'all' || (filter === 'read' ? !!item.readAt : !item.readAt)) ?? [];
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const pageStart = Math.min(Math.max(0, currentPage - 1), Math.max(0, totalPages - 3));
  const pageNumbers = Array.from({ length: Math.min(3, totalPages) }, (_, index) => pageStart + index);
  const noticeId = Number(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('notice'));
  const selectedNotice = result?.items.find(item => item.id === noticeId && item.type === 'SERVICE_NOTICE');

  return <div className="notifications-page">
    <header className="notifications-heading">
      <span className="notification-pixel-icon" data-icon="bell" aria-hidden="true" />
      <div><h1>알림</h1><p>면접 일정, 할 일, 새 공고, 추천 결과, 분석 완료 등의 알림을 확인할 수 있어요.</p></div>
      <a className="notifications-settings" href="#/settings"><LucideIcon name="cog" /><span>알림 설정</span></a>
    </header>
    {actionError && <p role="alert" className="form-error">{actionError}</p>}
    {loading ? <LoadingState message="알림을 불러오고 있습니다." /> : error
      ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : result && <>
        <div className="notifications-toolbar">
          <div className="notifications-filters" role="group" aria-label="알림 읽음 상태 필터">
            {([['all', '전체', result.totalElements], ['unread', '읽지 않음', unread], ['read', '읽음', result.totalElements - unread]] as const).map(([key, label, count]) =>
              <button key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); setPage(0); }}>{label} ({count})</button>)}
          </div>
          <button className="notifications-mark-all" type="button" disabled={busyId !== undefined || busyAll || unread === 0} onClick={() => void markAllRead()}>
            <LucideIcon name="check" />{busyAll ? '처리 중…' : '모두 읽음'}
          </button>
        </div>
        {selectedNotice && <aside className="notifications-notice-detail" role="region" aria-label="서비스 공지 상세">
          <div><strong>서비스 공지</strong><a href="#/notifications" aria-label="서비스 공지 닫기">×</a></div>
          <h2>{selectedNotice.subject}</h2><time dateTime={selectedNotice.createdAt}>{date(selectedNotice.createdAt)}</time>
        </aside>}
        {visible.length ? <ul className="notifications-list">{visible.map((item: NotificationItem) => <li key={item.id} className={item.readAt ? 'is-read' : 'is-unread'}>
          <span className="notifications-icon-box"><span className="notification-pixel-icon" data-icon={icon[item.type]} aria-hidden="true" /></span>
          <div className="notifications-item-main">
            <div className="notifications-item-title">
              {!item.readAt && <span className="notifications-unread-dot" aria-hidden="true" />}
              <a href={item.type === 'SERVICE_NOTICE' ? `#/notifications?notice=${item.id}` : notificationSource(item)}>{item.subject}<LucideIcon name="chevronRight" /></a>
              <span className="notifications-read">{item.readAt ? '읽음' : '읽지 않음'}</span>
            </div>
            <p>{guide[item.type]}</p>
          </div>
          <time className="notifications-time" dateTime={item.createdAt} title={date(item.createdAt)}>{relativeTime(item.createdAt)}</time>
          {!item.readAt && <button className="notifications-read-button" type="button" aria-label={`${item.subject} 읽음 처리`} title="읽음 처리"
            disabled={busyId !== undefined || busyAll} onClick={() => void markRead(item.id)}><LucideIcon name="check" /></button>}
        </li>)}</ul> : <div className="notifications-empty" role="status">
          <span className="notification-pixel-icon" data-icon="bell" aria-hidden="true" />
          <strong>{filter === 'unread' ? '읽지 않은 알림이 없습니다.' : filter === 'read' ? '읽은 알림이 없습니다.' : '표시할 알림이 없습니다.'}</strong>
          <p>{filter === 'all' ? '새 알림이 생성되면 이곳에 표시됩니다.' : '다른 탭에서 알림을 확인해 보세요.'}</p>
        </div>}
        {totalPages > 1 && <nav className="notifications-pagination" aria-label="알림 페이지">
          {currentPage > 0 && <button type="button" onClick={() => setPage(currentPage - 1)}>이전</button>}
          {pageNumbers.map(number => <button key={number} type="button" aria-current={currentPage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number + 1}</button>)}
          {currentPage + 1 < totalPages && <button type="button" onClick={() => setPage(currentPage + 1)}>다음 <LucideIcon name="chevronRight" /></button>}
        </nav>}
      </>}
  </div>;
}
