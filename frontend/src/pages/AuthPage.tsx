import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi } from '../api';
import { ApiError } from '../api/client';
import type { CurrentUser } from '../api/auth';
import { PixelIcon } from '../components/PixelArt';
import { SuccessState } from '../components/States';
import authScene from '../assets/redesign/cur-01-login-scene.png';
import './auth.css';

export function AuthPage({ register, registered, passwordChanged, sessionExpired, onLogin }: {
  register: boolean; registered: boolean; passwordChanged: boolean; sessionExpired: boolean;
  onLogin: (user: CurrentUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    if (new TextEncoder().encode(password).length > 72) {
      setError('비밀번호는 UTF-8 기준 72바이트 이내로 입력해 주세요.'); return;
    }
    if (register && password !== confirmation) {
      setError('비밀번호 확인이 일치하지 않습니다.'); return;
    }
    setPending(true);
    try {
      if (register) {
        await authApi.register(email, password);
        window.location.hash = '/login?registered=1';
      } else onLogin(await authApi.login(email, password));
      setPassword(''); setConfirmation('');
    } catch (failure) {
      setPassword(''); setConfirmation('');
      setError(failure instanceof ApiError
        ? failure.status === 401 ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : failure.status === 409 ? '이미 가입된 이메일입니다.' : failure.message
        : '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
    } finally { setPending(false); }
  }

  return <main id="main-content" tabIndex={-1} className="auth-page f02-auth-page">
    <aside className="f02-auth-art" aria-hidden="true"><img src={authScene} alt="" width="1024" height="1536" /></aside>
    <section className="card auth-card">
      <a className="brand" href="#/">DEVJOB</a>
      <h1>{register ? '회원가입' : '로그인'}</h1>
      <p className="auth-intro">{register ? '취업 준비를 함께할 공간을 만들어 보세요.' : '나의 다음 기회를 준비하는 공간'}</p>
      {!register && registered && <SuccessState compact title="가입이 완료되었습니다." message="로그인해 주세요." />}
      {!register && passwordChanged && <SuccessState compact title="비밀번호가 변경되었습니다." message="새 비밀번호로 다시 로그인해 주세요." />}
      {!register && window.location.hash.includes('accountDeleted=1') && <SuccessState compact title="계정이 삭제되었습니다." message="개인 기록은 삭제되었으며 이전 계정으로 로그인할 수 없습니다." />}
      {!register && sessionExpired && <p className="form-error" role="alert">로그인이 만료되었습니다. 다시 로그인해 주세요.</p>}
      <form onSubmit={submit} aria-busy={pending}>
        <label htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email"
          value={email} onChange={event => setEmail(event.target.value)} disabled={pending} />
        <label htmlFor="password">비밀번호</label>
        <input id="password" name="password" type="password" required minLength={8} maxLength={72}
          autoComplete={register ? 'new-password' : 'current-password'} aria-describedby="password-help"
          value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
        <p id="password-help" className="field-help">8자 이상, UTF-8 기준 72바이트 이내로 입력해 주세요.</p>
        {register && <><label htmlFor="confirmation">비밀번호 확인</label>
          <input id="confirmation" name="confirmation" type="password" required autoComplete="new-password"
            value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={pending} /></>}
        {error && <p className="form-error" role="alert"><PixelIcon name="error" /><span>{error}</span></p>}
        <button type="submit" disabled={pending}>{pending ? '처리 중…' : register ? '가입하기' : '로그인'}</button>
      </form>
      <a href={register ? '#/login' : '#/register'}>{register ? '로그인으로 돌아가기' : '회원가입'}</a>
      <a className="f02-auth-home-link" href="#/">공개 홈으로 돌아가기</a>
    </section>
  </main>;
}
