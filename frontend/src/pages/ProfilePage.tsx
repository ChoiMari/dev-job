import { useEffect, useState } from 'react';
import { profileApi } from '../api';
import { ApiError } from '../api/client';
import type { Profile, ProfileInput } from '../api/profile';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/States';
import profileCardArt from '../assets/illustrations/profile-card.png';

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
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    profileApi.get(controller.signal).then(value => { setProfile(value); setForm(value); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) { setProfile(null); setForm(blank(email)); }
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
      setProfile(value); setForm(value); setSaved(true); onEmailChange(value.email);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  return <section className="card profile-card">
    {loading ? <LoadingState message="프로필을 불러오고 있습니다." /> : loadError
      ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
      : <>
        {!profile && <EmptyState title="아직 프로필이 없습니다." message="기본 정보를 입력해 첫 프로필을 저장해 주세요." />}
        <div className="profile-intro-art"><p className="profile-intro">{profile ? '저장된 취업 정보를 수정할 수 있습니다.' : '이름과 이메일을 입력하고 필요한 취업 정보를 추가하세요.'}</p><img src={profileCardArt} alt="" aria-hidden="true" width="96" height="96" /></div>
        {saved && <SuccessState compact title="프로필을 저장했습니다." message="저장된 정보를 다시 불러와 확인할 수 있습니다." />}
        <form onSubmit={submit} className="profile-form">
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
          <button className="button-primary" type="submit" disabled={saving}>{saving ? '저장 중…' : profile ? '변경사항 저장' : '프로필 저장'}</button>
        </form>
      </>}
  </section>;
}
