import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi } from '../api';
import { ApiError } from '../api/client';
import type { CurrentUser } from '../api/auth';

export function AuthPage({ register, registered, onLogin }: {
  register: boolean; registered: boolean; onLogin: (user: CurrentUser) => void;
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

  return <main id="main-content" tabIndex={-1} className="auth-page">
    <section className="card auth-card">
      <a className="brand" href="#/login">DEVJOB</a>
      <span className="auth-symbol" aria-hidden="true">⌂</span>
      <h1>{register ? '회원가입' : '로그인'}</h1>
      {!register && registered && <p role="status">가입이 완료되었습니다. 로그인해 주세요.</p>}
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
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? '처리 중…' : register ? '가입하기' : '로그인'}</button>
      </form>
      <a href={register ? '#/login' : '#/register'}>{register ? '로그인으로 돌아가기' : '회원가입'}</a>
    </section>
  </main>;
}
