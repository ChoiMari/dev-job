import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api';
import { createCharacterApi } from '../api/character';
import type { CharacterEquipment, CharacterItem, CharacterSlot, CharacterState } from '../api/character';
import { CharacterAppearance, characterAssetUrl } from '../components/CharacterLayers';
import { PixelIcon } from '../components/PixelArt';
import { EmptyState, ErrorState, LoadingState } from '../components/States';

const characters = createCharacterApi(apiRequest);
const slots: { key: CharacterSlot; title: string }[] = [
  { key: 'OUTFIT', title: '의상' }, { key: 'HAIR', title: '헤어' }, { key: 'GLASSES', title: '안경' },
];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '캐릭터 상태를 저장하지 못했습니다.';

export function CharacterPage() {
  const [state, setState] = useState<CharacterState>();
  const [draft, setDraft] = useState<CharacterEquipment>();
  const [items, setItems] = useState<CharacterItem[]>([]);
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

  async function select(item: CharacterItem) {
    if (!item.available || !state || !draft || inFlight.current || draft[item.slot] === item.id) return;
    inFlight.current = true; setSaving(true); setActionError(''); setSavedMessage('');
    setDraft({ ...draft, [item.slot]: item.id });
    try {
      const saved = await characters.equip(item.slot, item.id);
      if (!mounted.current) return;
      if (saved.equipment[item.slot] !== item.id) throw new Error('저장된 캐릭터 상태가 선택한 항목과 다릅니다.');
      setState(saved); setDraft(saved.equipment); setSavedMessage(`${item.name} 적용을 저장했습니다.`);
    } catch (failure) {
      if (mounted.current) { setDraft(state.equipment); setActionError(errorMessage(failure)); }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const previewLabel = draft ? `캐릭터 미리보기: ${slots.map(slot =>
    items.find(item => item.slot === slot.key && item.id === draft[slot.key])?.name ?? draft[slot.key]).join(', ')}` : '';
  return <div className="character-page">
    <section className="card character-welcome">
      <div><span className="eyebrow">YOUR LITTLE COMPANION</span><h2>함께 준비하는 나의 캐릭터</h2>
        <p>의상, 헤어, 안경을 골라 나만의 캐릭터를 꾸며 보세요. 선택하면 미리보기에 바로 적용되고 계정에 저장됩니다.</p>
        <div className="character-actions"><a className="button-link button-primary" href="#/profile">내 프로필 보기</a><a className="button-link" href="#/projects">프로젝트 기록하기</a></div>
      </div>
      <div className="character-welcome-symbol" aria-hidden="true"><PixelIcon name="spark" /></div>
    </section>

    <section className="card character-customize" aria-labelledby="character-customize-title">
      <div className="character-preview-panel">
        <h2 id="character-customize-title">내 캐릭터</h2>
        {loading ? <LoadingState message="캐릭터를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
          : draft && state ? <>
            <CharacterAppearance equipment={draft} label={previewLabel} />
            <p className="character-preview-status" role="status">{saving ? '저장 중…' : savedMessage || '현재 선택한 모습'}</p>
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
          </> : <EmptyState title="캐릭터 상태가 없습니다." />}
      </div>
      {!loading && !error && draft && <div className="character-catalog">
        {slots.map(slot => <section key={slot.key} className="character-slot" aria-labelledby={`character-slot-${slot.key}`}>
          <h3 id={`character-slot-${slot.key}`}>{slot.title}</h3>
          <div className="character-item-grid">
            {items.filter(item => item.slot === slot.key).map(item => {
              const thumbnail = characterAssetUrl(item.thumbnailAssetId);
              const selected = draft[item.slot] === item.id;
              return <button key={item.id} type="button" className={`character-item${selected ? ' is-selected' : ''}`}
                aria-pressed={selected} disabled={!item.available || saving || !thumbnail}
                onClick={() => void select(item)}>
                {thumbnail && <img src={thumbnail} alt="" width="88" height="88" />}
                <span>{item.name}</span>
                <small>{item.available ? selected ? '선택됨' : '선택 가능'
                  : item.availabilityCondition === 'FUTURE_REWARD' ? '보상 기능 준비 중' : '아직 사용 불가'}</small>
              </button>;
            })}
          </div>
        </section>)}
      </div>}
    </section>

    <section className="character-guide">
      <h2>다음 한 걸음</h2>
      <div className="character-guide-grid">
        <a className="card" href="#/jobs"><PixelIcon name="jobs" /><strong>기회 찾기</strong><span>지금 열려 있는 채용공고를 살펴보세요.</span></a>
        <a className="card" href="#/applications"><PixelIcon name="calendar" /><strong>진행 살피기</strong><span>지원 상태와 다음 일정을 확인하세요.</span></a>
        <a className="card" href="#/skill-gap"><PixelIcon name="spark" /><strong>역량 키우기</strong><span>목표 직무에 필요한 기술을 찾아보세요.</span></a>
      </div>
      <p className="character-notice">성장·EXP·보상 기능은 아직 제공되지 않습니다.</p>
    </section>
  </div>;
}
