import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api';
import { createSkillsApi } from '../api/skills';
import type { Skill, SkillPage } from '../api/skills';
import { Badge } from './PixelArt';
import { EmptyState, ErrorState, LoadingState, SuccessState } from './States';
import './ProfileSkills.css';

const skillsApi = createSkillsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '기술을 처리하지 못했습니다.';

/** Mount in S04 ProfilePage as <ProfileSkills />; independent of the profile form and its save request. */
export function ProfileSkills() {
  const [owned, setOwned] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<SkillPage>();
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchRetry, setSearchRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [success, setSuccess] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    skillsApi.list(controller.signal).then(value => { if (!controller.signal.aborted) setOwned(value); })
      .catch(error => { if (!controller.signal.aborted) setLoadError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController();
    setSearching(true); setSearchError(''); setResult(undefined);
    skillsApi.search(searched, page, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(error => { if (!controller.signal.aborted) setSearchError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    return () => controller.abort();
  }, [searched, page, searchRetry]);

  async function mutate(selection: Skill | string, remove = false) {
    if (inFlight.current || loading || loadError) return;
    inFlight.current = true; setPending(true); setMutationError(''); setSuccess('');
    try {
      if (remove && typeof selection !== 'string') {
        await skillsApi.remove(selection.id);
        if (!mounted.current) return;
        setOwned(values => values.filter(item => item.id !== selection.id));
        setSuccess(`${selection.name} 기술을 삭제했습니다.`);
      } else {
        const added = await skillsApi.add(typeof selection === 'string' ? { name: selection } : { skillId: selection.id });
        if (!mounted.current) return;
        setOwned(values => [...values.filter(item => item.id !== added.id), added].sort((a, b) => a.name.localeCompare(b.name)));
        setSuccess(`${added.name} 기술을 추가했습니다.`);
        setSearchRetry(value => value + 1);
      }
    } catch (error) { if (mounted.current) setMutationError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  const disabled = pending || loading || !!loadError;
  return <section className="card profile-skills" aria-labelledby="profile-skills-title">
    <Badge tone="primary" icon="grid">나의 기술</Badge>
    <h2 id="profile-skills-title">기술 스택</h2>
    <p>표준 기술이나 별칭으로 검색하고 보유 기술을 추가하세요. Postgres는 PostgreSQL로 저장됩니다.</p>
    {loading ? <LoadingState message="내 기술을 불러오고 있습니다." /> : loadError
      ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
      : owned.length === 0 ? <EmptyState title="등록한 기술이 없습니다." message="아래에서 첫 기술을 추가해 보세요." />
      : <ul className="profile-skills__owned" aria-label="내 기술 목록">{owned.map(item => <li key={item.id}>
        <Badge tone="success" icon="check">{item.name}</Badge>
        <button type="button" disabled={disabled} onClick={() => void mutate(item, true)} aria-label={`${item.name} 삭제`}>삭제</button>
      </li>)}</ul>}
    {success && <SuccessState title={success} compact />}
    {mutationError && <p className="form-error" role="alert">{mutationError}</p>}
    <form className="profile-skills__search" onSubmit={event => {
      event.preventDefault(); setPage(0); setSearched(query.trim()); setSearchRetry(value => value + 1);
    }}>
      <label htmlFor="skill-query">기술명 또는 별칭</label>
      <div><input id="skill-query" value={query} maxLength={100} onChange={event => setQuery(event.target.value)}
        placeholder="예: Java, Postgres" disabled={pending} aria-describedby="skill-help" />
        <button type="submit" disabled={pending || searching}>검색</button></div>
      <p id="skill-help">최대 100자. 목록에 없는 기술은 이름으로 추가할 수 있습니다. 기존 이름·별칭은 표준 기술로 연결됩니다.</p>
    </form>
    {searching ? <LoadingState message="표준 기술을 검색하고 있습니다." /> : searchError
      ? <ErrorState message={searchError} onRetry={() => setSearchRetry(value => value + 1)} /> : result && <>
        <p role="status">검색 결과 {result.totalElements}개</p>
        {result.items.length === 0 ? <p>일치하는 표준 기술이 없습니다.</p> : <ul className="profile-skills__results" aria-label="기술 검색 결과">
          {result.items.map(item => {
            const has = owned.some(value => value.id === item.id);
            return <li key={item.id}><span>{item.name}</span><button type="button" disabled={disabled || has}
              onClick={() => void mutate(item)} aria-label={`${item.name} 추가`}>{has ? '보유 중' : '추가'}</button></li>;
          })}
        </ul>}
        <div className="profile-skills__pagination">
          <button type="button" disabled={pending || page === 0} onClick={() => setPage(value => value - 1)}>이전</button>
          <span>{page + 1} 페이지</span>
          <button type="button" disabled={pending || (page + 1) * result.size >= result.totalElements}
            onClick={() => setPage(value => value + 1)}>다음</button>
        </div>
        {searched && <button type="button" disabled={disabled} onClick={() => void mutate(searched)}>
          “{searched}” 이름으로 추가
        </button>}
      </>}
    {pending && <p role="status">기술 변경을 저장하고 있습니다.</p>}
  </section>;
}
