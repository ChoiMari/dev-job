import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api';
import { createSkillsApi } from '../api/skills';
import { ApiError } from '../api/client';
import type { AiSkillCandidate, CustomSkill, OwnedSkill, Skill, SkillPage } from '../api/skills';
import { LucideIcon } from './LucideIcon';
import { FixedSkillImage } from './FixedSkillImage';
import { ErrorState, LoadingState } from './States';
import { skillLevelLabel, skillLevelLabels } from './skillLevel';
import skillsEmptyArt from '../assets/illustrations/profile-skills-empty.png';
import aiCandidatesEmptyArt from '../assets/illustrations/profile-ai-candidates-empty.png';
import './ProfileSkills.css';

const skillsApi = createSkillsApi(apiRequest);
const message = (error: unknown) => error instanceof ApiError && error.status === 409
  ? '이미 등록된 기술입니다.' : error instanceof Error ? error.message : '기술을 처리하지 못했습니다.';

/** Mount in S04 ProfilePage as <ProfileSkills />; independent of the profile form and its save request. */
export function ProfileSkills() {
  const [owned, setOwned] = useState<OwnedSkill[]>([]);
  const [custom, setCustom] = useState<CustomSkill[]>([]);
  const [candidates, setCandidates] = useState<AiSkillCandidate[]>([]);
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [draftLevel, setDraftLevel] = useState('');
  const [legacyDraftName, setLegacyDraftName] = useState('');
  const [editError, setEditError] = useState('');
  const [editingCustomId, setEditingCustomId] = useState<number | null>(null);
  const [customDraftName, setCustomDraftName] = useState('');
  const [customDraftLevel, setCustomDraftLevel] = useState('');
  const [adding, setAdding] = useState<Skill | string | null>(null);
  const [addLevel, setAddLevel] = useState('');
  const [customMenuId, setCustomMenuId] = useState<number | null>(null);
  const [deletingCustomId, setDeletingCustomId] = useState<number | null>(null);
  const addDialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (adding === null || !addDialog.current) return;
    const dialog = addDialog.current;
    dialog.showModal();
    dialog.querySelector('select')?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, [adding]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    Promise.all([skillsApi.list(controller.signal), skillsApi.listCustom(controller.signal),
      skillsApi.listCandidates(controller.signal)]).then(([standard, personal, ai]) => {
      if (!controller.signal.aborted) { setOwned(standard); setCustom(personal); setCandidates(ai); }
    })
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

  async function mutate(selection: Skill | string, remove = false, level: number | null = null) {
    if (inFlight.current || loading || loadError) return;
    inFlight.current = true; setPending(true); setMutationError('');
    try {
      if (remove && typeof selection !== 'string') {
        await skillsApi.remove(selection.id);
        if (!mounted.current) return;
        setOwned(values => values.filter(item => item.id !== selection.id));
        setDeletingId(null); setEditingId(null);
      } else {
        if (typeof selection === 'string') {
          try {
            const added = await skillsApi.add({ name: selection });
            const ownedSkill = level === null ? { ...added, proficiencyLevel: null, experienceMonths: null, system: true }
              : await skillsApi.updateExperience(added.id, { proficiencyLevel: level });
            if (!mounted.current) return;
            setOwned(values => [...values.filter(item => item.id !== added.id), ownedSkill].sort((a, b) => a.name.localeCompare(b.name)));
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 404) throw error;
            const created = await skillsApi.createCustom(selection);
            const added = level === null ? created : await skillsApi.updateCustom(created.id, created.name, level);
            if (!mounted.current) return;
            setCustom(values => [...values.filter(item => item.id !== added.id), added].sort((a, b) => a.name.localeCompare(b.name)));
          }
        } else {
          const added = await skillsApi.add({ skillId: selection.id });
          const ownedSkill = level === null ? { ...added, proficiencyLevel: null, experienceMonths: null, system: true }
            : await skillsApi.updateExperience(added.id, { proficiencyLevel: level });
          if (!mounted.current) return;
          setOwned(values => [...values.filter(item => item.id !== added.id), ownedSkill].sort((a, b) => a.name.localeCompare(b.name)));
        }
        if (!mounted.current) return;
        setAdding(null); setAddLevel('');
        setSearchRetry(value => value + 1);
      }
    } catch (error) { if (mounted.current) setMutationError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  function startEditing(item: OwnedSkill) {
    setEditingId(item.id); setDeletingId(null); setEditError('');
    setDraftLevel(item.proficiencyLevel === null ? '' : String(item.proficiencyLevel));
    setLegacyDraftName(item.name);
  }
  async function saveExperience(item: OwnedSkill) {
    if (inFlight.current) return;
    const proficiencyLevel = draftLevel === '' ? null : Number(draftLevel);
    if (proficiencyLevel !== null && (!Number.isInteger(proficiencyLevel) || proficiencyLevel < 1 || proficiencyLevel > 5)) {
      setEditError('숙련도를 확인해 주세요.'); return;
    }
    inFlight.current = true; setPending(true); setEditError('');
    try {
      if (!item.system) {
        const converted = await skillsApi.convertLegacy(item.id, legacyDraftName.trim(), proficiencyLevel);
        if (!mounted.current) return;
        setOwned(values => values.filter(value => value.id !== item.id));
        setCustom(values => [...values, converted].sort((a, b) => a.name.localeCompare(b.name)));
        setEditingId(null);
        return;
      }
      const updated = await skillsApi.updateExperience(item.id, { proficiencyLevel });
      if (!mounted.current) return;
      setOwned(values => values.map(value => value.id === item.id ? updated : value));
      setEditingId(null);
    } catch (error) { if (mounted.current) setEditError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  async function saveCustom(item: CustomSkill) {
    if (inFlight.current || !customDraftName.trim()) return;
    const proficiencyLevel = customDraftLevel === '' ? null : Number(customDraftLevel);
    inFlight.current = true; setPending(true); setEditError('');
    try {
      const updated = await skillsApi.updateCustom(item.id, customDraftName.trim(), proficiencyLevel);
      if (!mounted.current) return;
      setCustom(values => values.map(value => value.id === item.id ? updated : value)
        .sort((a, b) => a.name.localeCompare(b.name)));
      setEditingCustomId(null);
    } catch (error) { if (mounted.current) setEditError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  async function removeCustom(id: number) {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setMutationError('');
    try {
      await skillsApi.removeCustom(id);
      if (mounted.current) setCustom(values => values.filter(value => value.id !== id));
    } catch (error) { if (mounted.current) setMutationError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  async function removeCandidate(id: number) {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setMutationError('');
    try {
      await skillsApi.removeCandidate(id);
      if (mounted.current) setCandidates(values => values.filter(value => value.id !== id));
    } catch (error) { if (mounted.current) setMutationError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  const disabled = pending || loading || !!loadError;
  return <>
    <section className="profile-skills" aria-labelledby="profile-skills-title">
    <div className="profile-section-head"><h2 id="profile-skills-title"><LucideIcon name="cog" />보유 기술</h2></div>
    {loading ? <LoadingState message="내 기술을 불러오고 있습니다." /> : loadError
      ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
      : owned.length === 0 && custom.length === 0 ? <div className="profile-skills__empty" role="status"><img src={skillsEmptyArt} alt="" /><strong>등록한 기술이 없습니다.</strong><p>아래에서 첫 기술을 추가해 보세요.</p></div>
      : <><ul className="profile-skills__owned" aria-label="내 기술 목록">{owned.map(item => <li key={item.id}>
        <div className="profile-skills__owned-heading"><FixedSkillImage name={item.name} />
          <div className="profile-skill-summary"><strong>{item.name}</strong><small>숙련도: {skillLevelLabel(item.proficiencyLevel)}</small></div>
          <div className="profile-skill-actions"><button type="button" disabled={disabled} onClick={() => setMenuId(current => current === item.id ? null : item.id)} aria-label={`${item.name} 메뉴`} aria-expanded={menuId === item.id}><LucideIcon name="more" /></button>
            {menuId === item.id && <div className="profile-skill-menu"><button type="button" onClick={() => { startEditing(item); setMenuId(null); }}>수정</button>
              <button type="button" onClick={() => { setDeletingId(item.id); setEditingId(null); setMenuId(null); }}>삭제</button></div>}</div>
        </div>
        {editingId === item.id ? <form className="profile-skills__editor" onSubmit={event => { event.preventDefault(); void saveExperience(item); }}>
          {!item.system && <><label htmlFor={`skill-name-${item.id}`}>기술명</label>
            <input id={`skill-name-${item.id}`} maxLength={100} value={legacyDraftName} disabled={pending}
              onChange={event => setLegacyDraftName(event.target.value)} /></>}
          <label htmlFor={`skill-level-${item.id}`}>숙련도</label>
          <select id={`skill-level-${item.id}`} value={draftLevel} disabled={pending} onChange={event => setDraftLevel(event.target.value)}>
            <option value="">정보 없음</option>
            {skillLevelLabels.map((label, index) => <option value={index + 1} key={label}>{label}</option>)}
          </select>
          <div className="profile-skills__editor-actions"><button type="submit" disabled={pending}>저장</button>
            <button type="button" disabled={pending} onClick={() => { setEditingId(null); setEditError(''); }}>취소</button></div>
          {editError && <p className="form-error" role="alert">{editError}</p>}
        </form> : null}
        {deletingId === item.id && <div className="profile-skills__delete-confirm">
          <button type="button" disabled={disabled} onClick={() => void mutate(item, true)}>삭제 확인</button>
          <button type="button" disabled={disabled} onClick={() => setDeletingId(null)}>취소</button>
        </div>}
      </li>)}</ul>
      {custom.length > 0 && <div className="profile-custom-skills"><h3>직접 등록한 기술</h3><ul className="profile-skills__owned">{custom.map(item => <li key={item.id}>
        <div className="profile-skills__owned-heading"><FixedSkillImage name={item.name} />
          <div className="profile-skill-summary"><strong>{item.name}</strong><small>숙련도: {skillLevelLabel(item.proficiencyLevel)}</small></div>
          <div className="profile-skill-actions"><button type="button" disabled={disabled} onClick={() => setCustomMenuId(current => current === item.id ? null : item.id)} aria-label={`${item.name} 메뉴`} aria-expanded={customMenuId === item.id}><LucideIcon name="more" /></button>
            {customMenuId === item.id && <div className="profile-skill-menu"><button type="button" onClick={() => {
              setEditingCustomId(item.id); setCustomDraftName(item.name);
              setCustomDraftLevel(item.proficiencyLevel === null ? '' : String(item.proficiencyLevel)); setEditError(''); setCustomMenuId(null);
            }}>수정</button><button type="button" onClick={() => { setDeletingCustomId(item.id); setCustomMenuId(null); }}>삭제</button></div>}</div>
        </div>
        {editingCustomId === item.id && <form className="profile-skills__editor" onSubmit={event => { event.preventDefault(); void saveCustom(item); }}>
          <label htmlFor={`custom-skill-name-${item.id}`}>기술명</label><input id={`custom-skill-name-${item.id}`} maxLength={100} value={customDraftName} disabled={pending} onChange={event => setCustomDraftName(event.target.value)} />
          <label htmlFor={`custom-skill-level-${item.id}`}>숙련도</label><select id={`custom-skill-level-${item.id}`} value={customDraftLevel} disabled={pending} onChange={event => setCustomDraftLevel(event.target.value)}>
            <option value="">정보 없음</option>{skillLevelLabels.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </select><div className="profile-skills__editor-actions"><button type="submit" disabled={pending || !customDraftName.trim()}>저장</button>
          <button type="button" onClick={() => setEditingCustomId(null)}>취소</button></div>
          {editError && <p className="form-error" role="alert">{editError}</p>}
        </form>}
        {deletingCustomId === item.id && <div className="profile-skills__delete-confirm"><button type="button" disabled={disabled} onClick={() => { void removeCustom(item.id); setDeletingCustomId(null); }}>삭제 확인</button><button type="button" disabled={disabled} onClick={() => setDeletingCustomId(null)}>취소</button></div>}
      </li>)}</ul></div>}</>}
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
      <p id="skill-help">고정 기술은 시스템 목록에서 선택하세요. 목록에 없는 기술은 내 계정에만 등록됩니다.</p>
    </form>
    {searching ? <LoadingState message="표준 기술을 검색하고 있습니다." /> : searchError
      ? <ErrorState message={searchError} onRetry={() => setSearchRetry(value => value + 1)} /> : result && <>
        <p role="status">검색 결과 {result.totalElements}개</p>
        {!searched && <div className="profile-skill-suggestions"><strong>기술 목록</strong>{result.items.slice(0, 10).map(item => <button type="button" key={item.id} onClick={() => { setQuery(item.name); setSearched(item.name); setPage(0); }}><FixedSkillImage name={item.name} />{item.name}</button>)}</div>}
        {result.items.length === 0 ? <p>일치하는 표준 기술이 없습니다.</p> : <ul className="profile-skills__results" aria-label="기술 검색 결과">
          {result.items.map(item => {
            const has = owned.some(value => value.id === item.id);
            return <li key={item.id}><FixedSkillImage name={item.name} /><span title={item.name}>{item.name}</span><button type="button" disabled={disabled || has}
              className="inline-flex! size-7! min-h-0! items-center! justify-center! p-1!"
              onClick={() => { setAdding(item); setAddLevel(''); }} aria-label={has ? `${item.name} 보유 중` : `${item.name} 추가`}
              title={has ? '보유 중' : '추가'}><LucideIcon name={has ? 'check' : 'plus'} /></button></li>;
          })}
        </ul>}
        <div className="profile-skills__pagination">
          <button type="button" disabled={pending || page === 0} onClick={() => setPage(value => value - 1)}>이전</button>
          <span>{page + 1} 페이지</span>
          <button type="button" disabled={pending || (page + 1) * result.size >= result.totalElements}
            onClick={() => setPage(value => value + 1)}>다음</button>
        </div>
        {searched && <button type="button" disabled={disabled} onClick={() => { setAdding(searched); setAddLevel(''); }}>
          “{searched}” 이름으로 추가
        </button>}
      </>}
    {pending && <p role="status">기술 변경을 저장하고 있습니다.</p>}
    </section>
    <section className="profile-ai-candidates" aria-labelledby="profile-ai-candidates-title">
      <div className="profile-section-head"><h2 id="profile-ai-candidates-title"><LucideIcon name="star" />AI 발견 기술 후보</h2>
        <button type="button" className="profile-icon-button" aria-label="AI 발견 기술 후보 새로고침" title="새로고침"
          disabled={loading || pending} onClick={() => setRetry(value => value + 1)}><LucideIcon name="rotateCcw" /></button></div>
      <p>관심 공고의 AI 분석에서 찾은 기술입니다. 보유 기술로 자동 등록되지 않습니다.</p>
      {loading ? <LoadingState message="AI 기술 후보를 불러오고 있습니다." /> : loadError
        ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
        : candidates.length === 0 ? <div className="profile-ai-candidates__empty"><img src={aiCandidatesEmptyArt} alt="" /><strong>아직 AI 기술 후보가 없습니다.</strong><p>관심 공고에서 AI 분석하기를 누르면 이 계정의 후보 목록에 모입니다.</p></div>
        : <ul>{candidates.map(item => <li key={item.id}><span className="profile-ai-badge">AI</span><FixedSkillImage name={item.name} />
          <span className="profile-ai-candidate-name" title={item.name}>{item.name}</span><button type="button" className="profile-icon-button" aria-label={`${item.name} 보유 기술로 추가`} title="보유 기술로 추가" disabled={disabled || owned.some(skill => skill.name.toLowerCase() === item.name.toLowerCase())
            || custom.some(skill => skill.name.toLowerCase() === item.name.toLowerCase())}
            onClick={() => { setAdding(item.name); setAddLevel(''); }}><LucideIcon name="plus" /></button>
          <button type="button" className="profile-icon-button" disabled={disabled} onClick={() => void removeCandidate(item.id)} aria-label={`${item.name} 후보 삭제`} title="삭제"><LucideIcon name="trash" /></button>
        </li>)}</ul>}
    </section>
    {adding !== null && <dialog ref={addDialog} className="profile-skill-dialog" aria-labelledby="profile-skill-dialog-title"
      onCancel={event => { event.preventDefault(); if (!pending) setAdding(null); }}>
      <form onSubmit={event => { event.preventDefault(); void mutate(adding, false, addLevel ? Number(addLevel) : null); }}>
        <h2 id="profile-skill-dialog-title">{typeof adding === 'string' ? adding : adding.name} 추가</h2>
        <p>등록할 기술의 숙련도를 선택해 주세요.</p>
        <label htmlFor="new-skill-level">숙련도</label>
        <select id="new-skill-level" value={addLevel} disabled={disabled} onChange={event => setAddLevel(event.target.value)}>
          <option value="">정보 없음</option>{skillLevelLabels.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
        </select>
        {mutationError && <p className="form-error" role="alert">{mutationError}</p>}
        <div className="profile-skill-dialog__actions"><button type="button" disabled={disabled} onClick={() => setAdding(null)}>취소</button>
          <button type="submit" disabled={disabled}>등록</button></div>
      </form>
    </dialog>}
  </>;
}
