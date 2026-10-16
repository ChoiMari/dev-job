import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi } from '../api';
import { ApiError } from '../api/client';
import type { CurrentUser } from '../api/auth';
import { PixelIcon } from '../components/PixelArt';
import { SuccessState } from '../components/States';
import authScene from '../assets/redesign/cur-01-login-scene.png';
import brandWordmark from '../assets/redesign/brand-devjob-wordmark-dark.png';
import lightWordmark from '../assets/redesign/brand-devjob-wordmark-light.png';
import './auth.css';

function FieldIcon({ name }: { name: 'mail' | 'lock' | 'eye' | 'eyeOff' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'mail' ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>
      : name === 'lock' ? <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" /></>
        : name === 'eye' ? <><path d="M2 12s3.5-5 10-5 10 5 10 5-3.5 5-10 5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>
          : <><path d="M3 3 21 21M10 7.2A12 12 0 0 1 12 7c6.5 0 10 5 10 5a14 14 0 0 1-3.2 3.1M6.4 8.5C3.5 10 2 12 2 12s3.5 5 10 5c1.1 0 2.2-.2 3.1-.5" /></>}
  </svg>;
}

export function AuthPage({ register, forgotPassword, passwordChanged, sessionExpired, onLogin }: {
  register: boolean; forgotPassword: boolean; passwordChanged: boolean; sessionExpired: boolean;
  onLogin: (user: CurrentUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

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
        window.location.hash = '/login';
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
    <aside className="f02-auth-art" aria-hidden="true">
      <img className="f02-auth-scene" src={authScene} alt="" width="1024" height="1536" />
      <div className="f02-auth-art-copy">
        <img src={lightWordmark} alt="" width="272" height="91" />
        <p>더 나은 내일을 위한<br />당신의 취업 여정 파트너입니다.</p>
      </div>
    </aside>
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="f02-auth-content">
      <a className="f02-auth-brand" href="#/"><img src={brandWordmark} alt="DevJob 홈" width="236" height="79" /></a>
      <h1 id="auth-title">{forgotPassword ? '비밀번호 찾기' : register ? '새로운 여정을 시작해요!' : '다시 만나서 반가워요!'}</h1>
      <p className="auth-intro">{forgotPassword ? '비밀번호 재설정 안내를 준비하고 있어요.' : register ? '취업 준비를 함께할 공간을 만들어 보세요.' : '오늘의 한 걸음도 DevJob과 함께해요.'}</p>
      {!register && passwordChanged && <SuccessState compact title="비밀번호가 변경되었습니다." message="새 비밀번호로 다시 로그인해 주세요." />}
      {!register && window.location.hash.includes('accountDeleted=1') && <SuccessState compact title="계정이 삭제되었습니다." message="개인 기록은 삭제되었으며 이전 계정으로 로그인할 수 없습니다." />}
      {forgotPassword ? <div className="f02-auth-forgot">
        <label htmlFor="recovery-email">이메일</label>
        <div className="f02-auth-input"><FieldIcon name="mail" />
          <input id="recovery-email" type="email" autoComplete="email" placeholder="이메일 주소를 입력하세요" value={email}
            onChange={event => setEmail(event.target.value)} />
        </div>
        <p role="status">현재 재설정 메일 전송은 제공하지 않습니다. 기능을 준비 중입니다.</p>
        <button type="button" disabled>재설정 메일 보내기 · 준비 중</button>
        <a className="f02-auth-secondary" href="#/login">로그인으로 돌아가기</a>
      </div> : <>
        <form onSubmit={submit} aria-busy={pending}>
          {!register && sessionExpired && <p className="f02-auth-session-notice" role="alert"><PixelIcon name="clock" /><span>로그인이 만료되었습니다. 다시 로그인해 주세요.</span></p>}
          <label htmlFor="email">이메일</label>
          <div className="f02-auth-input"><FieldIcon name="mail" />
            <input id="email" name="email" type="email" required maxLength={254} autoComplete="email"
              placeholder="이메일 주소를 입력하세요" value={email} onChange={event => setEmail(event.target.value)} disabled={pending} />
          </div>
          <label htmlFor="password">비밀번호</label>
          <div className="f02-auth-input"><FieldIcon name="lock" />
            <input id="password" name="password" type={passwordVisible ? 'text' : 'password'} required minLength={8} maxLength={72}
              autoComplete={register ? 'new-password' : 'current-password'} placeholder="비밀번호를 입력하세요"
              value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
            <button className="f02-auth-visibility" type="button" aria-label={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
              aria-pressed={passwordVisible} onClick={() => setPasswordVisible(value => !value)} disabled={pending}>
              <FieldIcon name={passwordVisible ? 'eyeOff' : 'eye'} />
            </button>
          </div>
          {register && <><label htmlFor="confirmation">비밀번호 확인</label>
            <div className="f02-auth-input"><FieldIcon name="lock" />
              <input id="confirmation" name="confirmation" type="password" required autoComplete="new-password"
                placeholder="비밀번호를 다시 입력하세요" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={pending} />
            </div></>}
          {!register && <a className="f02-auth-forgot-link" href="#/forgot-password">비밀번호를 잊으셨나요?</a>}
          {error && <p className="form-error" role="alert"><PixelIcon name="error" /><span>{error}</span></p>}
          <button className="f02-auth-submit" type="submit" disabled={pending}>{pending ? '처리 중…' : register ? '가입하기' : '로그인'}</button>
        </form>
        <a className="f02-auth-secondary" href={register ? '#/login' : '#/register'}>{register ? '로그인으로 돌아가기' : '회원가입'}</a>
      </>}
      </div>
    </section>
  </main>;
}
