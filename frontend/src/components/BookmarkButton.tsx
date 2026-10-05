import { useRef, useState } from 'react';
import { apiRequest } from '../api';
import { ApiError } from '../api/client';
import { createBookmarksApi } from '../api/bookmarks';
import { createJobsApi } from '../api/jobs';
import { PixelIcon } from './PixelArt';

const bookmarks = createBookmarksApi(apiRequest);
const jobs = createJobsApi(apiRequest);
export function BookmarkButton({ jobId, saved, onChange }: {
  jobId: number; saved: boolean; onChange: (saved: boolean) => void;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function toggle() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage(''); setError('');
    try {
      if (saved) await bookmarks.remove(jobId);
      else await bookmarks.add(jobId);
      onChange(!saved);
      setMessage(saved ? '관심 공고에서 해제했습니다.' : '관심 공고에 저장했습니다.');
    } catch (failure) {
      if (failure instanceof ApiError && ((!saved && failure.status === 409) || (saved && failure.status === 404))) {
        try {
          const latest = await jobs.detail(jobId);
          onChange(latest.bookmarked);
          setMessage(latest.bookmarked ? '이미 저장된 공고입니다.' : '이미 해제된 공고입니다.');
        } catch { setError('저장 상태를 확인하지 못했습니다. 다시 시도해 주세요.'); }
      } else setError(failure instanceof Error ? failure.message : '저장 상태를 변경하지 못했습니다. 다시 시도해 주세요.');
    } finally { pending.current = false; setBusy(false); }
  }
  return <div className="bookmark-control">
    <button type="button" aria-pressed={saved} disabled={busy} onClick={toggle}>
      <PixelIcon name={saved ? 'check' : 'empty'} />{busy ? '처리 중…' : saved ? '저장 해제' : '관심 공고 저장'}
    </button>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
