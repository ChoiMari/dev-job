import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api';
import { createCharacterApi, isCompleteOutfit } from '../api/character';
import type { CharacterActivityPage, CharacterEquipment, CharacterItem, CharacterQuest, CharacterSlot, CharacterState } from '../api/character';
import { CharacterAppearance, characterAssetUrl } from '../components/CharacterLayers';
import { LucideIcon } from '../components/LucideIcon';
import { characterThemeImage, characterThemeKey, characterThemes, savedCharacterTheme } from '../components/characterThemes';
import type { CharacterThemeId } from '../components/characterThemes';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import welcomeCat from '../assets/illustrations/character-welcome-cat-head-first.png';
import tabGiftIcon from '../assets/illustrations/character-tab-gift.png';
import journalBanner from '../assets/illustrations/character-journal-banner.png';
import rewardsEmpty from '../assets/illustrations/character-rewards-empty.png';
import activityEmpty from '../assets/illustrations/character-activity-empty.png';
import questTodo from '../assets/illustrations/quest-todo.png';
import questBookmark from '../assets/illustrations/quest-bookmark.png';
import questResume from '../assets/illustrations/quest-resume.png';
import questApplication from '../assets/illustrations/quest-application.png';
import questLearning from '../assets/illustrations/quest-learning.png';
import questAnalysis from '../assets/illustrations/quest-analysis.png';
import trophyIcon from '../assets/illustrations/character-journal-trophy.png';
import './character.css';

const characters = createCharacterApi(apiRequest);
const slots: { key: CharacterSlot; title: string }[] = [
  { key: 'OUTFIT', title: '의상' }, { key: 'HAIR', title: '헤어' }, { key: 'GLASSES', title: '안경' },
];
const slotDescriptions: Record<CharacterSlot, string> = {
  OUTFIT: '다양한 의상을 모아 나만의 스타일을 꾸며보세요. 일부 의상은 퀘스트 달성 시 획득할 수 있습니다.',
  HAIR: '마음에 드는 헤어스타일을 선택해 보세요.',
  GLASSES: '안경을 골라 캐릭터의 인상을 바꿔 보세요.',
};
const questDetails: Record<string, { title: string; description: string; href: string; action: string }> = {
  TODO_1: { title: '첫 할 일 완료하기', description: '개인 할 일을 1개 완료해 보세요.', href: '#/todos', action: '할 일 보기' },
  BOOKMARK_3: { title: '관심 공고 저장하기', description: '관심 공고를 3개 저장해 보세요.', href: '#/jobs', action: '공고 보기' },
  RESUME_1: { title: '이력서 작성하기', description: '이력서를 1개 작성해 보세요.', href: '#/resumes', action: '이력서 보기' },
  APPLICATION_1: { title: '지원 기록 남기기', description: '지원 기록을 1개 등록해 보세요.', href: '#/applications', action: '지원 보기' },
  LEARNING_1: { title: '학습 목표 달성하기', description: '학습 목표를 1개 완료해 보세요.', href: '#/learning-goals', action: '학습 목표 보기' },
  ANALYSIS_1: { title: 'AI 분석 요청하기', description: '이력서 또는 자기소개서 분석을 1회 요청해 보세요.', href: '#/resumes', action: '문서 보기' },
};
const questIcons: Record<string, string> = {
  TODO_1: questTodo, BOOKMARK_3: questBookmark, RESUME_1: questResume,
  APPLICATION_1: questApplication, LEARNING_1: questLearning, ANALYSIS_1: questAnalysis,
};
const activityDetails: Record<string, { title: string; icon: string }> = {
  TODO_COMPLETED: { title: '첫 할 일 완료', icon: questTodo },
  BOOKMARK_SAVED: { title: '관심 공고 저장', icon: questBookmark },
  RESUME_CREATED: { title: '이력서 작성 완료', icon: questResume },
  APPLICATION_CREATED: { title: '지원 기록 등록', icon: questApplication },
  LEARNING_GOAL_COMPLETED: { title: '학습 목표 달성', icon: questLearning },
  DOCUMENT_ANALYSIS_REQUESTED: { title: 'AI 분석 요청', icon: questAnalysis },
};
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '캐릭터 상태를 저장하지 못했습니다.';

export function CharacterPage({ userId }: { userId: number }) {
  const [state, setState] = useState<CharacterState>();
  const [draft, setDraft] = useState<CharacterEquipment>();
  const [items, setItems] = useState<CharacterItem[]>([]);
  const [quests, setQuests] = useState<CharacterQuest[]>([]);
  const [activity, setActivity] = useState<CharacterActivityPage>();
  const [activityPage, setActivityPage] = useState(0);
  const [extraError, setExtraError] = useState('');
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [claiming, setClaiming] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [themeDraft, setThemeDraft] = useState<CharacterThemeId>(() => savedCharacterTheme(userId));
  const [activeSlot, setActiveSlot] = useState<CharacterSlot>('OUTFIT');
  const [activeJournal, setActiveJournal] = useState<'quests' | 'activity' | 'rewards'>('quests');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const selected = savedCharacterTheme(userId);
    setThemeDraft(selected);
  }, [userId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setState(undefined); setDraft(undefined);
    Promise.all([characters.state(controller.signal), characters.items(controller.signal)])
      .then(([current, catalog]) => {
        if (controller.signal.aborted) return;
        setState(current); setDraft(current.equipment); setItems(catalog);
      }).catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController(); setExtraError(''); setExtrasLoading(true);
    Promise.all([characters.quests(controller.signal), characters.activity(activityPage, controller.signal)])
      .then(([q, a]) => { if (!controller.signal.aborted) { setQuests(q); setActivity(a); } })
      .catch(failure => { if (!controller.signal.aborted) setExtraError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setExtrasLoading(false); });
    return () => controller.abort();
  }, [retry, activityPage]);

  async function claim(questId: string) {
    if (claiming || saving) return;
    setClaiming(questId); setActionError('');
    try {
      await characters.claim(questId);
      const [current, catalog, newQuests] = await Promise.all([characters.state(), characters.items(), characters.quests()]);
      if (!mounted.current) return;
      setState(current); setDraft(current.equipment); setItems(catalog); setQuests(newQuests);
      window.dispatchEvent(new CustomEvent('devjob:character-updated', { detail: current }));
    } catch (failure) { if (mounted.current) setActionError(errorMessage(failure)); }
    finally { if (mounted.current) setClaiming(''); }
  }

  async function select(item: CharacterItem) {
    if (!item.available || !state || !draft || inFlight.current || draft[item.slot] === item.id
      || (isCompleteOutfit(draft.OUTFIT) && item.slot !== 'OUTFIT')) return;
    inFlight.current = true; setSaving(true); setActionError('');
    setDraft({ ...draft, [item.slot]: item.id });
    try {
      const saved = await characters.equip(item.slot, item.id);
      if (!mounted.current) return;
      if (saved.equipment[item.slot] !== item.id) throw new Error('저장된 캐릭터 상태가 선택한 항목과 다릅니다.');
      setState(saved); setDraft(saved.equipment);
      window.dispatchEvent(new CustomEvent('devjob:character-updated', { detail: saved }));
    } catch (failure) {
      if (mounted.current) { setDraft(state.equipment); setActionError(errorMessage(failure)); }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const previewLabel = draft && isCompleteOutfit(draft.OUTFIT) ? `캐릭터 미리보기: ${items.find(item => item.slot === 'OUTFIT' && item.id === draft.OUTFIT)?.name ?? draft.OUTFIT}` : draft ? `캐릭터 미리보기: ${slots.map(slot =>
    items.find(item => item.slot === slot.key && item.id === draft[slot.key])?.name ?? draft[slot.key]).join(', ')}` : '';
  function selectTheme(id: CharacterThemeId) {
    try {
      window.localStorage.setItem(characterThemeKey(userId), id);
      setThemeDraft(id);
      setActionError('');
    } catch { setActionError('테마를 적용할 수 없습니다. 브라우저 저장소를 확인해 주세요.'); }
  }
  const outfitItems = items.filter(item => item.slot === 'OUTFIT');
  const claimedQuests = quests.filter(quest => quest.claimed);
  const pendingQuests = quests.filter(quest => !quest.claimed);
  return <div className="character-page">
    <header className="character-welcome">
      <span className="character-welcome-icon" aria-hidden="true"><img src={welcomeCat} alt="" /></span>
      <div><h1>내 캐릭터 꾸미기</h1><p>배경 테마와 의상·헤어·안경을 골라 나만의 캐릭터를 꾸며 보세요.</p></div>
      <button className="character-refresh-button" type="button" disabled={saving || !!claiming || loading} onClick={() => setRetry(v => v + 1)}><LucideIcon name="rotateCcw" />최신 정보 불러오기</button>
    </header>

    <section className="character-theme-section" aria-labelledby="character-theme-title">
      <div className="character-section-heading"><h2 id="character-theme-title">프로필 테마</h2><p>캐릭터 카드에 표시할 배경을 선택하세요. 이미지 비율은 유지됩니다.</p></div>
      <div className="character-theme-grid">{characterThemes.map(theme => <button key={theme.id} type="button"
        className={`character-theme${themeDraft === theme.id ? ' is-selected' : ''}`} aria-pressed={themeDraft === theme.id}
        onClick={() => selectTheme(theme.id)}>
        <img src={theme.image} alt="" /><span>{theme.label}</span>{themeDraft === theme.id && <b aria-hidden="true">✓</b>}
      </button>)}</div>
    </section>

    <section className="card character-customize" aria-labelledby="character-customize-title">
      <div className="character-preview-panel">
        <h2 id="character-customize-title">내 캐릭터</h2>
        {loading ? <LoadingState message="캐릭터를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
          : draft && state ? <>
            <div className="character-preview-scene" style={{ backgroundImage: `url(${characterThemeImage(themeDraft)})` }}>
              <CharacterAppearance equipment={draft} label={previewLabel} />
            </div>
            <div className="character-progress"><div className="character-progress-heading"><strong>레벨 {state.progress.level} <span className="character-level-help" title="할 일을 처음 완료하면 EXP를 얻습니다." aria-label="첫 할 일 완료 시 EXP 획득">?</span></strong><span>누적 {state.progress.totalExp} EXP</span></div>
              <progress value={state.progress.levelExp} max={state.progress.nextLevelExp} aria-label="다음 레벨까지의 경험치" />
              <small>{state.progress.levelExp} / {state.progress.nextLevelExp} EXP</small></div>
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
          </> : <EmptyState title="캐릭터 상태가 없습니다." />}
      </div>
      {!loading && !error && draft && <div className="character-catalog">
        <div className="character-section-heading"><h2>{slots.find(slot => slot.key === activeSlot)?.title} 선택</h2><p>{slotDescriptions[activeSlot]}</p></div>
        <div className="character-slot-tabs" role="tablist" aria-label="꾸미기 종류">{slots.map(slot => <button key={slot.key} type="button"
          role="tab" aria-selected={activeSlot === slot.key} onClick={() => setActiveSlot(slot.key)}><LucideIcon name={slot.key === 'OUTFIT' ? 'shirt' : slot.key === 'HAIR' ? 'hair' : 'glasses'} />{slot.title}</button>)}</div>
        {slots.filter(slot => slot.key === activeSlot).map(slot => <section key={slot.key} className="character-slot" aria-label={`${slot.title} 목록`}>
          <div className="character-item-grid">
            {items.filter(item => item.slot === slot.key).map(item => {
              const thumbnail = characterAssetUrl(item.thumbnailAssetId);
              const selected = draft[item.slot] === item.id;
              return <button key={item.id} type="button" className={`character-item${selected ? ' is-selected' : ''}${!item.available ? ' is-locked' : ''}`}
                aria-pressed={selected} disabled={!item.available || saving || !thumbnail || (isCompleteOutfit(draft.OUTFIT) && slot.key !== 'OUTFIT')}
                onClick={() => void select(item)}>
                {selected && <b className="character-item-check" aria-hidden="true">✓</b>}
                {thumbnail && <img src={thumbnail} alt="" width="88" height="88" />}
                <span>{item.name}</span>
                <small>{isCompleteOutfit(draft.OUTFIT) && slot.key !== 'OUTFIT' ? selected ? '벗으면 다시 적용' : '전체 의상 착용 중 잠김'
                  : item.available ? selected ? '선택됨' : '선택 가능'
                  : item.availabilityCondition === 'FUTURE_REWARD' ? <><LucideIcon name="lock" />퀘스트 보상</> : '아직 사용 불가'}</small>
              </button>;
            })}
          </div>
        </section>)}
      </div>}
    </section>

    <div className="character-journal" role="region" aria-labelledby="character-journal-title">
      <div className="character-journal-hero" style={{ backgroundImage: `url(${journalBanner})` }}>
        <div className="character-journal-hero-copy"><img src={trophyIcon} alt="" />
          <div><h2 id="character-journal-title">활동과 보상</h2><p>실제 취업 준비 기록으로 퀘스트를 달성하고 의상을 받아 보세요.</p></div>
        </div>
      </div>
      <div className="character-journal-tabs" role="tablist" aria-label="활동과 보상 보기">
        <button type="button" role="tab" aria-selected={activeJournal === 'quests'} onClick={() => setActiveJournal('quests')}><LucideIcon name="target" />퀘스트</button>
        <button type="button" role="tab" aria-selected={activeJournal === 'activity'} onClick={() => setActiveJournal('activity')}><LucideIcon name="fileText" />활동 내역</button>
        <button type="button" role="tab" aria-selected={activeJournal === 'rewards'} onClick={() => setActiveJournal('rewards')}><img src={tabGiftIcon} alt="" />보상 수령 내역</button>
      </div>
      <div className="character-journal-content">
        {extraError && <ErrorState message={extraError} onRetry={() => setRetry(v => v + 1)} />}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {extrasLoading && <LoadingState />}
        {!extrasLoading && !extraError && activeJournal === 'quests' && <div className="character-quest-list">{quests.map(quest => {
          const detail = questDetails[quest.id];
          const reward = items.find(item => item.id === quest.rewardItemId && item.slot === 'OUTFIT');
          return <div className="character-quest" key={quest.id}>
            <span className="character-quest-icon" aria-hidden="true"><img src={questIcons[quest.id] ?? questTodo} alt="" /></span>
            <div className="character-quest-body"><strong>{detail?.title ?? quest.id}</strong><p>{detail?.description ?? quest.activityType}</p></div>
            <div className="character-quest-progress"><progress value={quest.progressCount} max={quest.targetCount} aria-label={`${detail?.title ?? quest.id} 진행도`} /><span>{quest.progressCount} / {quest.targetCount}</span></div>
            <div className="character-quest-reward">{reward?.thumbnailAssetId && <img src={characterAssetUrl(reward.thumbnailAssetId)} alt="" />}
              <div><span>보상</span><strong>{reward?.name ?? quest.rewardItemId}</strong></div></div>
            <div className="character-quest-action">{quest.completed && !quest.claimed ? <button className="button-primary" type="button" disabled={!!claiming || saving} onClick={() => void claim(quest.id)}>{claiming === quest.id ? '수령 중…' : '보상 받기'}</button>
              : quest.claimed ? <span className="character-quest-done"><LucideIcon name="check" />수령 완료</span>
                : detail ? <a href={detail.href}>{detail.action}</a> : <span>진행 중</span>}</div>
          </div>;
        })}</div>}
        {!extrasLoading && !extraError && activeJournal === 'activity' && <div className="character-activity">{activity?.items.length ? <ul>{activity.items.map(row => {
          const detail = activityDetails[row.activityType];
          return <li key={row.id}><span className="character-activity-icon"><img src={detail?.icon ?? questTodo} alt="" /></span>
            <strong>{detail?.title ?? row.activityType}</strong><span className="character-activity-exp">+{row.expAmount} EXP</span>
            <time dateTime={row.earnedAt}><LucideIcon name="clock" />{new Date(row.earnedAt).toLocaleString('ko-KR')}</time></li>;
        })}</ul> : <div className="character-activity-empty" role="status">
          <img src={activityEmpty} alt="" aria-hidden="true" />
          <h3>아직 EXP 활동이 없습니다.</h3>
          <p>할 일을 완료하거나 다양한 활동을 통해 EXP를 쌓아보세요!</p>
        </div>}
          {!!activity?.totalElements && <div className="character-activity-pages"><button disabled={activityPage === 0} onClick={() => setActivityPage(p => p - 1)}>이전</button><span>{activityPage + 1}</span><button disabled={!activity || (activityPage + 1) * activity.size >= activity.totalElements} onClick={() => setActivityPage(p => p + 1)}>다음</button></div>}</div>}
        {!extrasLoading && !extraError && activeJournal === 'rewards' && <div className="character-reward-history">
          <div className="character-reward-summary"><div className="character-reward-summary-title"><img src={tabGiftIcon} alt="" /><div><h3>보상 수령 내역</h3><p>퀘스트를 달성하고 획득한 의상 보상을 확인해 보세요.</p></div></div>
            <div className="character-reward-stats"><span><LucideIcon name="shirt" />보유한 의상 <strong>{state ? `${outfitItems.filter(item => item.available).length} / ${outfitItems.length}` : '—'}</strong></span><span>누적 획득 EXP <strong>{state?.progress.totalExp ?? '—'}</strong></span></div></div>
          {claimedQuests.length ? <><h3 className="character-reward-group-title">획득한 보상 <span>{claimedQuests.length}개</span></h3><div className="character-reward-grid is-acquired">{claimedQuests.map(quest => {
            const reward = outfitItems.find(item => item.id === quest.rewardItemId);
            return <div className="character-reward-card is-claimed" key={quest.id}><span className="character-reward-check"><LucideIcon name="check" /></span>
              {reward?.thumbnailAssetId && <img src={characterAssetUrl(reward.thumbnailAssetId)} alt="" />}
              <strong>{reward?.name ?? quest.rewardItemId}</strong>{quest.claimedAt && <time dateTime={quest.claimedAt}>{new Date(quest.claimedAt).toLocaleDateString('ko-KR')} 수령</time>}</div>;
          })}{Array.from({ length: Math.max(0, 6 - claimedQuests.length) }, (_, index) => <div className="character-reward-card is-placeholder" key={`empty-${index}`}><LucideIcon name="smile" /><span>아직 받은 보상이<br />없습니다.</span></div>)}</div>{pendingQuests.length > 0 && <><h3 className="character-reward-group-title">진행 중인 보상 <span>{pendingQuests.length}개</span></h3><div className="character-reward-grid is-pending">{pendingQuests.map(quest => {
            const reward = outfitItems.find(item => item.id === quest.rewardItemId);
            return <div className="character-reward-card is-pending" key={quest.id}>{reward?.thumbnailAssetId && <img src={characterAssetUrl(reward.thumbnailAssetId)} alt="" />}
              <strong>{reward?.name ?? quest.rewardItemId}</strong><div className="character-reward-progress"><progress value={quest.progressCount} max={quest.targetCount} aria-label={`${reward?.name ?? quest.rewardItemId} 진행도`} /><span>{quest.progressCount} / {quest.targetCount}</span></div></div>;
          })}</div></>}</> : <div className="character-rewards-empty"><img src={rewardsEmpty} alt="" /><h3>아직 받은 보상이 없습니다.</h3><p>퀘스트를 달성하고 다양한 의상 보상을 받아 보세요!</p></div>}
        </div>}
      </div>
    </div>
  </div>;
}
