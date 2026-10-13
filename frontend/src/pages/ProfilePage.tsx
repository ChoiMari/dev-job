import { useEffect, useState } from 'react';
import { profileApi } from '../api';
import { ApiError } from '../api/client';
import type { Profile, ProfileInput } from '../api/profile';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/States';
import { LucideIcon } from '../components/LucideIcon';
import { PixelCharacter, PixelIcon } from '../components/PixelArt';
import profileSky from '../assets/redesign/profile-sky-banner.png';
import './profile.css';

const blank = (email: string): ProfileInput => ({ email, name: '', desiredRole: null, careerLevel: null,
  desiredLocation: null, introduction: null, education: null, certifications: null });
const optional = (value: string) => value.trim() || null;

export function ProfilePage({ email, onEmailChange }: { email: string; onEmailChange: (email: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileInput>(() => blank(email));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    profileApi.get(controller.signal).then(value => { setProfile(value); setForm(value); setEditing(false); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) { setProfile(null); setForm(blank(email)); setEditing(true); }
        else setLoadError(error instanceof Error ? error.message : '프로필을 불러오지 못했습니다.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [email, retry]);

  function change(key: keyof ProfileInput, value: string) {
    setForm(current => ({ ...current, [key]: value })); setSaved(false); setSaveError('');
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setSaveError(''); setSaved(false);
    const input: ProfileInput = { email: form.email.trim(), name: form.name.trim(),
      desiredRole: optional(form.desiredRole ?? ''), careerLevel: optional(form.careerLevel ?? ''),
      desiredLocation: optional(form.desiredLocation ?? ''), introduction: optional(form.introduction ?? ''),
      education: optional(form.education ?? ''), certifications: optional(form.certifications ?? '') };
    try {
      const value = await profileApi.put(input);
      setProfile(value); setForm(value); onEmailChange(value.email);
      try {
        const confirmed = await profileApi.get();
        setProfile(confirmed); setForm(confirmed); setEditing(false); setSaved(true);
      } catch (failure) {
        setSaveError(`프로필은 저장됐지만 재조회로 확인하지 못했습니다. ${failure instanceof Error ? failure.message : ''}`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  const details = profile ? [
    { label: '이름', value: profile.name, icon: 'userRound' },
    { label: '직무/한줄소개', value: profile.desiredRole, icon: 'star' },
    { label: '소개글', value: profile.introduction, icon: 'fileText' },
    { label: '이메일', value: profile.email, icon: 'message' },
    { label: '지역', value: profile.desiredLocation, icon: 'mapPin' },
    { label: '경력 수준', value: profile.careerLevel, icon: 'briefcase' },
    { label: '학력', value: profile.education, icon: 'fileText' },
    { label: '자격증', value: profile.certifications, icon: 'star' },
  ] as const : [];
  const openEditor = () => { setEditing(true); setSaved(false); setSaveError(''); };

  return <>
    <header className="profile-page-header">
      <span className="profile-page-header-icon"><PixelIcon name="profile" /></span>
      <div><h1>내 프로필</h1><p>나의 기본 정보와 보유 기술을 관리하세요.</p></div>
      {!loading && !loadError && profile && !editing && <button type="button" className="profile-main-edit" onClick={openEditor}><LucideIcon name="pencil" />프로필 수정</button>}
    </header>
    {loading ? <div className="profile-full-state"><LoadingState message="프로필을 불러오고 있습니다." /></div> : loadError
      ? <div className="profile-full-state"><ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} /></div>
      : <>
        {profile ? <section className="profile-banner" style={{ backgroundImage: `url(${profileSky})` }} aria-label="프로필 요약">
          <span className="profile-banner-avatar"><PixelCharacter /></span>
          <div className="profile-banner-copy"><h2>{profile.name}</h2>
            {profile.desiredRole && <strong>{profile.desiredRole}</strong>}
            {profile.introduction && <p>{profile.introduction}</p>}
            <div className="profile-banner-meta">{profile.desiredLocation && <span><LucideIcon name="mapPin" />{profile.desiredLocation}</span>}
              <span><LucideIcon name="message" />{profile.email}</span></div>
          </div>
        </section> : <div className="profile-full-state"><EmptyState title="아직 프로필이 없습니다." message="기본 정보를 입력해 첫 프로필을 저장해 주세요." /></div>}
        <section className="profile-info-card" aria-labelledby="profile-info-title">
          <div className="profile-section-head"><h2 id="profile-info-title"><LucideIcon name="fileText" />기본 정보</h2>
            {profile && !editing && <button type="button" onClick={openEditor}><LucideIcon name="pencil" />수정</button>}
          </div>
          {saved && <SuccessState compact title="프로필을 저장했습니다." message="저장된 정보를 다시 불러와 확인할 수 있습니다." />}
          {editing ? <form onSubmit={submit} className="profile-form">
          <div className="profile-grid">
            <label>이름 <span aria-hidden="true">*</span><input name="name" required maxLength={100} autoComplete="name" value={form.name} onChange={event => change('name', event.target.value)} disabled={saving} /></label>
            <label>이메일 <span aria-hidden="true">*</span><input name="email" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={event => change('email', event.target.value)} disabled={saving} /></label>
            <label>희망 직무<input name="desiredRole" maxLength={100} value={form.desiredRole ?? ''} onChange={event => change('desiredRole', event.target.value)} disabled={saving} /></label>
            <label>경력 수준<input name="careerLevel" maxLength={100} value={form.careerLevel ?? ''} onChange={event => change('careerLevel', event.target.value)} disabled={saving} /></label>
            <label>희망 지역<input name="desiredLocation" maxLength={100} value={form.desiredLocation ?? ''} onChange={event => change('desiredLocation', event.target.value)} disabled={saving} /></label>
          </div>
          <label>자기소개<textarea name="introduction" maxLength={2000} rows={4} value={form.introduction ?? ''} onChange={event => change('introduction', event.target.value)} disabled={saving} /></label>
          <label>학력<textarea name="education" maxLength={1000} rows={2} value={form.education ?? ''} onChange={event => change('education', event.target.value)} disabled={saving} /></label>
          <label>자격증<textarea name="certifications" maxLength={1000} rows={2} value={form.certifications ?? ''} onChange={event => change('certifications', event.target.value)} disabled={saving} /></label>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <div className="profile-form-actions"><button className="button-primary" type="submit" disabled={saving}>{saving ? '저장 중…' : profile ? '변경사항 저장' : '프로필 저장'}</button>
            {profile && <button type="button" disabled={saving} onClick={() => { setForm(profile); setEditing(false); setSaveError(''); }}>취소</button>}</div>
        </form> : <dl className="profile-detail-list">{details.map(item => <div key={item.label}>
          <dt><LucideIcon name={item.icon} />{item.label}</dt><dd>{item.value || '—'}</dd>
        </div>)}</dl>}
        </section>
      </>}
  </>;
}
