import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api';
import { createCharacterApi, isCompleteOutfit } from '../api/character';
import type { CharacterActivityPage, CharacterEquipment, CharacterItem, CharacterQuest, CharacterSlot, CharacterState } from '../api/character';
import { CharacterAppearance, characterAssetUrl } from '../components/CharacterLayers';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import backdrop from '../assets/redesign/cur-13-character-backdrop.png';
import celebration from '../assets/redesign/ext-img-06b-growth-celebration.png';
import './character.css';

const characters = createCharacterApi(apiRequest);
const slots: { key: CharacterSlot; title: string }[] = [
  { key: 'OUTFIT', title: '의상' }, { key: 'HAIR', title: '헤어' }, { key: 'GLASSES', title: '안경' },
];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '캐릭터 상태를 저장하지 못했습니다.';

export function CharacterPage() {
  const [state, setState] = useState<CharacterState>();
  const [draft, setDraft] = useState<CharacterEquipment>();
  const [items, setItems] = useState<CharacterItem[]>([]);
  const [quests, setQuests] = useState<CharacterQuest[]>([]);
  const [activity, setActivity] = useState<CharacterActivityPage>();
  const [activityPage, setActivityPage] = useState(0);
  const [extraError, setExtraError] = useState('');
  const [claiming, setClaiming] = useState('');
  const [claimed, setClaimed] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
    const controller = new AbortController(); setExtraError('');
    Promise.all([characters.quests(controller.signal), characters.activity(activityPage, controller.signal)])
      .then(([q, a]) => { if (!controller.signal.aborted) { setQuests(q); setActivity(a); } })
      .catch(failure => { if (!controller.signal.aborted) setExtraError(errorMessage(failure)); });
    return () => controller.abort();
  }, [retry, activityPage]);

  async function claim(questId: string) {
    if (claiming || saving) return;
    setClaiming(questId); setActionError(''); setClaimed('');
    try {
      const result = await characters.claim(questId);
      const [current, catalog, newQuests] = await Promise.all([characters.state(), characters.items(), characters.quests()]);
      if (!mounted.current) return;
      setState(current); setDraft(current.equipment); setItems(catalog); setQuests(newQuests);
      window.dispatchEvent(new CustomEvent('devjob:character-updated', { detail: current }));
      setClaimed(`${catalog.find(item => item.id === result.itemId)?.name ?? result.itemId} 보상을 받았습니다.`);
    } catch (failure) { if (mounted.current) setActionError(errorMessage(failure)); }
    finally { if (mounted.current) setClaiming(''); }
  }

  async function select(item: CharacterItem) {
    if (!item.available || !state || !draft || inFlight.current || draft[item.slot] === item.id
      || (isCompleteOutfit(draft.OUTFIT) && item.slot !== 'OUTFIT')) return;
    inFlight.current = true; setSaving(true); setActionError(''); setSavedMessage('');
    setDraft({ ...draft, [item.slot]: item.id });
    try {
      const saved = await characters.equip(item.slot, item.id);
      if (!mounted.current) return;
      if (saved.equipment[item.slot] !== item.id) throw new Error('저장된 캐릭터 상태가 선택한 항목과 다릅니다.');
      setState(saved); setDraft(saved.equipment); setSavedMessage(`${item.name} 적용을 저장했습니다.`);
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
  return <div className="character-page">
    <section className="card character-welcome">
      <div><span className="eyebrow">YOUR LITTLE COMPANION</span><h2>함께 준비하는 나의 캐릭터</h2>
        <p>의상, 헤어, 안경을 골라 나만의 캐릭터를 꾸며 보세요. 전체 의상은 착용 중 헤어·안경 선택을 잠급니다.</p>
        <div className="character-actions"><button type="button" disabled={saving || !!claiming} onClick={() => setRetry(v => v + 1)}>서버 상태 다시 조회</button><a className="button-link button-primary" href="#/todos">할 일 보기</a></div>
      </div>
      <img className="character-backdrop" src={backdrop} alt="" />
    </section>

    <section className="card character-customize" aria-labelledby="character-customize-title">
      <div className="character-preview-panel">
        <h2 id="character-customize-title">내 캐릭터</h2>
        {loading ? <LoadingState message="캐릭터를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
          : draft && state ? <>
            <CharacterAppearance equipment={draft} label={previewLabel} />
            <p className="character-preview-status" role="status">{saving ? '저장 중…' : savedMessage || '현재 선택한 모습'}</p>
            <div className="character-progress"><strong>레벨 {state.progress.level}</strong><span>누적 {state.progress.totalExp} EXP</span>
              <progress value={state.progress.levelExp} max={state.progress.nextLevelExp} aria-label="다음 레벨까지의 경험치" />
              <small>{state.progress.levelExp} / {state.progress.nextLevelExp} EXP</small></div>
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
          </> : <EmptyState title="캐릭터 상태가 없습니다." />}
      </div>
      {!loading && !error && draft && <div className="character-catalog">
        {slots.map(slot => <section key={slot.key} className="character-slot" aria-labelledby={`character-slot-${slot.key}`}>
          <h3 id={`character-slot-${slot.key}`}>{slot.title}</h3>
          {isCompleteOutfit(draft.OUTFIT) && slot.key !== 'OUTFIT' &&
            <p className="character-slot-note">전체 의상을 벗으면 기존 {slot.title}가 다시 적용됩니다.</p>}
          <div className="character-item-grid">
            {items.filter(item => item.slot === slot.key).map(item => {
              const thumbnail = characterAssetUrl(item.thumbnailAssetId);
              const selected = draft[item.slot] === item.id;
              return <button key={item.id} type="button" className={`character-item${selected ? ' is-selected' : ''}`}
                aria-pressed={selected} disabled={!item.available || saving || !thumbnail || (isCompleteOutfit(draft.OUTFIT) && slot.key !== 'OUTFIT')}
                onClick={() => void select(item)}>
                {thumbnail && <img src={thumbnail} alt="" width="88" height="88" />}
                <span>{item.name}</span>
                <small>{isCompleteOutfit(draft.OUTFIT) && slot.key !== 'OUTFIT' ? selected ? '벗으면 다시 적용' : '전체 의상 착용 중 잠김'
                  : item.available ? selected ? '선택됨' : '선택 가능'
                  : item.availabilityCondition === 'FUTURE_REWARD' ? '퀘스트 보상으로 잠김' : '아직 사용 불가'}</small>
              </button>;
            })}
          </div>
        </section>)}
      </div>}
    </section>

    <section className="card character-rewards"><div><h2>퀘스트와 보상</h2><p>개인 할 일의 첫 완료만 10 EXP를 지급합니다. 달성 후 보상을 직접 받아야 의상을 사용할 수 있습니다.</p></div>
      {claimed && <div className="character-celebration" role="status"><img src={celebration} alt="" /><span>{claimed}</span></div>}
      {extraError && <ErrorState message={extraError} onRetry={() => setRetry(v => v + 1)} />}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      <div className="character-quest-grid">{quests.map(quest => <div className="character-quest" key={quest.id}><strong>{items.find(item => item.id === quest.rewardItemId)?.name ?? quest.rewardItemId}</strong>
        <span>할 일 완료 {quest.progressCount} / {quest.targetCount}</span>
        <button disabled={!quest.completed || quest.claimed || !!claiming || saving} onClick={() => void claim(quest.id)}>{quest.claimed ? '수령 완료' : claiming === quest.id ? '수령 중…' : quest.completed ? '보상 받기' : '진행 중'}</button></div>)}</div>
    </section>
    <section className="card character-activity"><h2>EXP 활동 내역</h2>{activity?.items.length ? <ul>{activity.items.map(row => <li key={row.id}>개인 할 일 첫 완료 · +{row.expAmount} EXP <time dateTime={row.earnedAt}>{new Date(row.earnedAt).toLocaleString('ko-KR')}</time></li>)}</ul> : <EmptyState title="아직 EXP 활동이 없습니다." />}
      <div className="character-activity-pages"><button disabled={activityPage === 0} onClick={() => setActivityPage(p => p - 1)}>이전</button><span>{activityPage + 1}페이지</span><button disabled={!activity || (activityPage + 1) * activity.size >= activity.totalElements} onClick={() => setActivityPage(p => p + 1)}>다음</button></div></section>
  </div>;
}
