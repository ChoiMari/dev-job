import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api';
import { createSkillsApi } from '../api/skills';
import type { OwnedSkill, Skill, SkillPage } from '../api/skills';
import { LucideIcon } from './LucideIcon';
import { EmptyState, ErrorState, LoadingState, SuccessState } from './States';
import { skillLevelLabel, skillLevelLabels } from './skillLevel';
import './ProfileSkills.css';

const skillsApi = createSkillsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '기술을 처리하지 못했습니다.';

/** Mount in S04 ProfilePage as <ProfileSkills />; independent of the profile form and its save request. */
export function ProfileSkills() {
  const [owned, setOwned] = useState<OwnedSkill[]>([]);
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [draftLevel, setDraftLevel] = useState('');
  const [draftMonths, setDraftMonths] = useState('');
  const [editError, setEditError] = useState('');
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
        setDeletingId(null); setEditingId(null);
        setSuccess(`${selection.name} 기술을 삭제했습니다.`);
      } else {
        const added = await skillsApi.add(typeof selection === 'string' ? { name: selection } : { skillId: selection.id });
        if (!mounted.current) return;
        setOwned(values => [...values.filter(item => item.id !== added.id),
          { ...added, proficiencyLevel: null, experienceMonths: null }].sort((a, b) => a.name.localeCompare(b.name)));
        setSuccess(`${added.name} 기술을 추가했습니다.`);
        setSearchRetry(value => value + 1);
      }
    } catch (error) { if (mounted.current) setMutationError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  function startEditing(item: OwnedSkill) {
    setEditingId(item.id); setDeletingId(null); setEditError(''); setSuccess('');
    setDraftLevel(item.proficiencyLevel === null ? '' : String(item.proficiencyLevel));
    setDraftMonths(item.experienceMonths === null ? '' : String(item.experienceMonths));
  }
  async function saveExperience(item: OwnedSkill) {
    if (inFlight.current) return;
    const proficiencyLevel = draftLevel === '' ? null : Number(draftLevel);
    const experienceMonths = draftMonths === '' ? null : Number(draftMonths);
    if (proficiencyLevel !== null && (!Number.isInteger(proficiencyLevel) || proficiencyLevel < 1 || proficiencyLevel > 5)
      || experienceMonths !== null && (!Number.isInteger(experienceMonths) || experienceMonths < 0 || experienceMonths > 600)) {
      setEditError('숙련도 또는 경험 개월 수를 확인해 주세요.'); return;
    }
    inFlight.current = true; setPending(true); setEditError(''); setSuccess('');
    try {
      const updated = await skillsApi.updateExperience(item.id, { proficiencyLevel, experienceMonths });
      if (!mounted.current) return;
      setOwned(values => values.map(value => value.id === item.id ? updated : value));
      setEditingId(null); setSuccess(`${item.name} 기술 정보를 저장했습니다.`);
    } catch (error) { if (mounted.current) setEditError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  const disabled = pending || loading || !!loadError;
  return <>
    <section className="profile-skills" aria-labelledby="profile-skills-title">
    <div className="profile-section-head"><h2 id="profile-skills-title"><LucideIcon name="cog" />보유 기술</h2>
      <button type="button" onClick={() => document.getElementById('skill-query')?.focus()}><LucideIcon name="plus" />기술 추가</button></div>
    {loading ? <LoadingState message="내 기술을 불러오고 있습니다." /> : loadError
      ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
      : owned.length === 0 ? <EmptyState title="등록한 기술이 없습니다." message="아래에서 첫 기술을 추가해 보세요." />
      : <ul className="profile-skills__owned" aria-label="내 기술 목록">{owned.map(item => <li key={item.id}>
        <div className="profile-skills__owned-heading"><span className="profile-skill-mark" aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span>
          <div className="profile-skill-summary"><strong>{item.name}</strong><small>{skillLevelLabel(item.proficiencyLevel)} · {item.experienceMonths === null ? '경험 미입력' : `${item.experienceMonths}개월`}</small></div>
          <div className="profile-skill-actions"><button type="button" disabled={disabled} onClick={() => setMenuId(current => current === item.id ? null : item.id)} aria-label={`${item.name} 메뉴`} aria-expanded={menuId === item.id}><LucideIcon name="more" /></button>
            {menuId === item.id && <div className="profile-skill-menu"><button type="button" onClick={() => { startEditing(item); setMenuId(null); }}>수정</button>
              <button type="button" onClick={() => { setDeletingId(item.id); setEditingId(null); setSuccess(''); setMenuId(null); }}>삭제</button></div>}</div>
        </div>
        {editingId === item.id ? <form className="profile-skills__editor" onSubmit={event => { event.preventDefault(); void saveExperience(item); }}>
          <label htmlFor={`skill-level-${item.id}`}>숙련도</label>
          <select id={`skill-level-${item.id}`} value={draftLevel} disabled={pending} onChange={event => setDraftLevel(event.target.value)}>
            <option value="">정보 없음</option>
            {skillLevelLabels.map((label, index) => <option value={index + 1} key={label}>{label}</option>)}
          </select>
          <label htmlFor={`skill-months-${item.id}`}>경험 (개월)</label>
          <input id={`skill-months-${item.id}`} type="number" min="0" max="600" step="1" value={draftMonths}
            disabled={pending} onChange={event => setDraftMonths(event.target.value)} placeholder="정보 없음" />
          <div className="profile-skills__editor-actions"><button type="submit" disabled={pending}>저장</button>
            <button type="button" disabled={pending} onClick={() => { setEditingId(null); setEditError(''); }}>취소</button></div>
          {editError && <p className="form-error" role="alert">{editError}</p>}
        </form> : null}
        {deletingId === item.id && <div className="profile-skills__delete-confirm">
          <p>{item.name} 기술을 삭제하면 숙련도와 경험도 함께 삭제됩니다. 다시 등록해도 복원되지 않습니다.</p>
          <button type="button" disabled={disabled} onClick={() => void mutate(item, true)}>삭제 확인</button>
          <button type="button" disabled={disabled} onClick={() => setDeletingId(null)}>취소</button>
        </div>}
      </li>)}</ul>}
    {success && <SuccessState title={success} compact />}
    {mutationError && <p className="form-error" role="alert">{mutationError}</p>}
    </section>
    <section className="profile-skill-search" aria-labelledby="profile-skill-search-title"><div className="profile-section-head"><h2 id="profile-skill-search-title"><LucideIcon name="search" />기술 검색 및 추가</h2></div>
    <form className="profile-skills__search" onSubmit={event => {
      event.preventDefault(); setPage(0); setSearched(query.trim()); setSearchRetry(value => value + 1);
    }}>
      <label htmlFor="skill-query" className="sr-only">기술명 또는 별칭</label>
      <div><input id="skill-query" value={query} maxLength={100} onChange={event => setQuery(event.target.value)}
        placeholder="기술명을 검색하세요. (예: Python, Spring, React 등)" disabled={pending} aria-describedby="skill-help" />
        <button type="submit" disabled={pending || searching}>검색</button></div>
      <p id="skill-help">목록에 없는 기술도 이름으로 추가할 수 있습니다. 기존 이름·별칭은 표준 기술로 연결됩니다.</p>
    </form>
    {searching ? <LoadingState message="표준 기술을 검색하고 있습니다." /> : searchError
      ? <ErrorState message={searchError} onRetry={() => setSearchRetry(value => value + 1)} /> : result && <>
        <p role="status">검색 결과 {result.totalElements}개</p>
        {!searched && <div className="profile-skill-suggestions"><strong>기술 목록</strong>{result.items.slice(0, 10).map(item => <button type="button" key={item.id} onClick={() => { setQuery(item.name); setSearched(item.name); setPage(0); }}>{item.name}</button>)}</div>}
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
    </section>
  </>;
}
