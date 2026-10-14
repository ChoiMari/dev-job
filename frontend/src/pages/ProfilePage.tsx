import { useEffect, useState } from 'react';
import { apiRequest, profileApi } from '../api';
import { ApiError } from '../api/client';
import { createCharacterApi } from '../api/character';
import type { CharacterState } from '../api/character';
import type { Profile, ProfileInput } from '../api/profile';
import { ErrorState, LoadingState } from '../components/States';
import { LucideIcon } from '../components/LucideIcon';
import { PixelCharacter } from '../components/PixelArt';
import { characterAppearanceUrl } from '../components/CharacterLayers';
import { characterThemeImage, savedCharacterTheme } from '../components/characterThemes';
import profileHeader from '../assets/illustrations/profile-cat-header.png';
import './profile.css';

const blank = (email: string): ProfileInput => ({ email, nickname: '', desiredRole: null, careerLevel: null,
  desiredLocation: null, introduction: null, education: null, certifications: null });
const optional = (value: string) => value.trim() || null;
const introLimit = 100;
const roleOptions = ['백엔드 개발자', '프론트엔드 개발자', '풀스택 개발자', '데이터 분석가', 'AI 개발자', '보안 엔지니어', '클라우드 엔지니어', '전산/IT 운영'];
const careerOptions = ['경력 없음', '신입', '경력 1년', '경력 2~3년', '경력 5년 이상'];
const educationOptions = ['고졸', '전문학사', '학사', '석사', '박사', '기타'];
const locationOptions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '전국', '해외'];
const certificateItems = (value: string | null) => (value ?? '').split(/[,\n]/).map(item => item.trim()).filter(Boolean);
const characterApi = createCharacterApi(apiRequest);

export function ProfilePage({ userId, email, onProfileSaved }: { userId: number; email: string; onProfileSaved: (profile: Profile) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileInput>(() => blank(email));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [certificateDraft, setCertificateDraft] = useState('');
  const [character, setCharacter] = useState<CharacterState>();
  useEffect(() => {
    const controller = new AbortController();
    characterApi.state(controller.signal).then(value => { if (!controller.signal.aborted) setCharacter(value); })
      .catch(() => { if (!controller.signal.aborted) setCharacter(undefined); });
    const update = (event: Event) => setCharacter((event as CustomEvent<CharacterState>).detail);
    window.addEventListener('devjob:character-updated', update);
    return () => { controller.abort(); window.removeEventListener('devjob:character-updated', update); };
  }, [email]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    profileApi.get(controller.signal).then(value => { setProfile(value); setForm(value); setCertificateDraft(''); setEditing(false); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) { setProfile(null); setForm(blank(email)); setEditing(true); }
        else setLoadError(error instanceof Error ? error.message : '프로필을 불러오지 못했습니다.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [email, retry]);

  function change(key: keyof ProfileInput, value: string) {
    setForm(current => ({ ...current, [key]: value })); setSaveError('');
  }
  function addCertificate() {
    const next = certificateDraft.trim();
    if (!next) return;
    const items = certificateItems(form.certifications);
    if (items.includes(next)) { setSaveError('이미 추가한 자격증입니다.'); return; }
    const joined = [...items, next].join('\n');
    if (joined.length > 1000) { setSaveError('자격증은 모두 합쳐 1000자까지 입력할 수 있습니다.'); return; }
    change('certifications', joined);
    setCertificateDraft('');
  }
  function removeCertificate(name: string) {
    change('certifications', certificateItems(form.certifications).filter(item => item !== name).join('\n'));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setSaveError('');
    const pendingCertificate = certificateDraft.trim();
    const certificates = certificateItems(form.certifications);
    if (pendingCertificate && !certificates.includes(pendingCertificate)) certificates.push(pendingCertificate);
    const joinedCertificates = certificates.join('\n');
    if (joinedCertificates.length > 1000) { setSaveError('자격증은 모두 합쳐 1000자까지 입력할 수 있습니다.'); setSaving(false); return; }
    const input: ProfileInput = { email: form.email.trim(), nickname: form.nickname.trim(),
      desiredRole: optional(form.desiredRole ?? ''), careerLevel: optional(form.careerLevel ?? ''),
      desiredLocation: optional(form.desiredLocation ?? ''), introduction: optional(form.introduction ?? ''),
      education: optional(form.education ?? ''), certifications: optional(joinedCertificates) };
    try {
      const value = await profileApi.put(input);
      setProfile(value); setForm(value); setCertificateDraft(''); onProfileSaved(value);
      try {
        const confirmed = await profileApi.get();
        setProfile(confirmed); setForm(confirmed); onProfileSaved(confirmed); setEditing(false);
      } catch (failure) {
        setSaveError(`프로필은 저장됐지만 재조회로 확인하지 못했습니다. ${failure instanceof Error ? failure.message : ''}`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  const details = profile ? [
    { label: '닉네임', value: profile.nickname, icon: 'userRound' },
    { label: '취업 희망 직무', value: profile.desiredRole, icon: 'star' },
    { label: '한 줄 소개', value: profile.introduction, icon: 'fileText' },
    { label: '이메일', value: profile.email, icon: 'message' },
    { label: '취업 희망 지역', value: profile.desiredLocation, icon: 'mapPin' },
    { label: '경력 수준', value: profile.careerLevel, icon: 'briefcase' },
    { label: '학력', value: profile.education, icon: 'fileText' },
    { label: '자격증', value: profile.certifications, icon: 'star' },
  ] as const : [];
  const openEditor = () => { setEditing(true); setSaveError(''); };
  const appearance = character && characterAppearanceUrl(character.equipment);

  return <>
    <header className="profile-page-header">
      <img className="profile-page-header-art" src={profileHeader} alt="" />
      <div><h1>내 프로필</h1><p>내 정보를 관리하고, 보유한 기술을 추가해보세요.</p></div>
    </header>
    {loading ? <div className="profile-full-state"><LoadingState message="프로필을 불러오고 있습니다." /></div> : loadError
      ? <div className="profile-full-state"><ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} /></div>
      : <>
        {profile ? <section className="profile-banner" aria-label="프로필 요약" style={{ backgroundImage: `url(${characterThemeImage(savedCharacterTheme(userId))})` }}>
          <span className="profile-banner-avatar">{appearance
            ? <img src={appearance} alt="" /> : <PixelCharacter />}</span>
          <div className="profile-banner-copy"><h2>{profile.nickname}</h2>
            {profile.desiredRole && <div className="profile-banner-role"><span>취업 희망 직무</span><strong>{profile.desiredRole}</strong></div>}
            {profile.introduction && <p>{profile.introduction}</p>}
            <div className="profile-banner-meta">{profile.desiredLocation && <span><LucideIcon name="mapPin" />{profile.desiredLocation}</span>}
              <span><LucideIcon name="message" />{profile.email}</span></div>
          </div>
        </section> : null}
        <section className="profile-info-card" aria-labelledby="profile-info-title">
          <div className="profile-section-head"><h2 id="profile-info-title"><LucideIcon name="fileText" />기본 정보</h2>
            {profile && !editing && <button type="button" onClick={openEditor}><LucideIcon name="pencil" />수정</button>}
          </div>
          {editing ? <form onSubmit={submit} className="profile-form">
          <div className="profile-grid">
            <label><span className="profile-field-label">닉네임 <em aria-hidden="true">*</em></span><input name="nickname" required maxLength={100} autoComplete="nickname" value={form.nickname} onChange={event => change('nickname', event.target.value)} disabled={saving} /></label>
            <label><span className="profile-field-label">이메일 <em aria-hidden="true">*</em></span><input name="email" type="email" required maxLength={254} autoComplete="email" value={form.email} readOnly aria-readonly="true" title="로그인 ID로 사용하므로 변경할 수 없습니다." /></label>
            <label>희망 직무<input name="desiredRole" list="profile-role-options" maxLength={100} value={form.desiredRole ?? ''} onChange={event => change('desiredRole', event.target.value)} disabled={saving} /><datalist id="profile-role-options">{roleOptions.map(role => <option key={role} value={role} />)}</datalist></label>
            <label>경력 수준<select name="careerLevel" value={form.careerLevel ?? ''} onChange={event => change('careerLevel', event.target.value)} disabled={saving}><option value="">선택 안 함</option>{form.careerLevel && !careerOptions.includes(form.careerLevel) && <option value={form.careerLevel}>{form.careerLevel}</option>}{careerOptions.map(level => <option key={level} value={level}>{level}</option>)}</select></label>
            <label>취업 희망 지역<select name="desiredLocation" value={form.desiredLocation ?? ''} onChange={event => change('desiredLocation', event.target.value)} disabled={saving}><option value="">선택 안 함</option>{form.desiredLocation && !locationOptions.includes(form.desiredLocation) && <option value={form.desiredLocation}>{form.desiredLocation}</option>}{locationOptions.map(location => <option key={location} value={location}>{location}</option>)}</select></label>
            <label>학력<select name="education" value={form.education ?? ''} onChange={event => change('education', event.target.value)} disabled={saving}><option value="">선택 안 함</option>{form.education && !educationOptions.includes(form.education) && <option value={form.education}>{form.education}</option>}{educationOptions.map(education => <option key={education} value={education}>{education}</option>)}</select></label>
          </div>
          <label>한 줄 소개<input name="introduction" maxLength={introLimit} value={form.introduction ?? ''} onChange={event => change('introduction', event.target.value.replace(/[\r\n]+/g, ' '))} disabled={saving} /><small className="profile-character-count">{(form.introduction ?? '').length}/{introLimit}자</small></label>
          <div className="profile-certifications"><label htmlFor="profile-certificate-input">자격증</label><div className="profile-certificate-entry"><input id="profile-certificate-input" value={certificateDraft} maxLength={100} disabled={saving} placeholder="자격증 입력 후 Enter" onChange={event => setCertificateDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCertificate(); } }} /><button type="button" disabled={saving || !certificateDraft.trim()} onClick={addCertificate}>추가</button></div><div className="profile-certificate-tags">{certificateItems(form.certifications).map(name => <span key={name}>{name}<button type="button" disabled={saving} onClick={() => removeCertificate(name)} aria-label={`${name} 삭제`}>×</button></span>)}</div></div>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <div className="profile-form-actions"><button className="button-primary" type="submit" disabled={saving}>{saving ? '저장 중…' : profile ? '변경사항 저장' : '프로필 저장'}</button>
            {profile && <button type="button" disabled={saving} onClick={() => { setForm(profile); setCertificateDraft(''); setEditing(false); setSaveError(''); }}>취소</button>}</div>
        </form> : <dl className="profile-detail-list">{details.map(item => <div key={item.label}>
          <dt><LucideIcon name={item.icon} />{item.label}</dt><dd>{item.value || '—'}</dd>
        </div>)}</dl>}
        </section>
      </>}
  </>;
}
