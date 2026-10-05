import { useEffect, useState } from 'react';
import { authApi } from './api';
import { ApiError } from './api/client';
import type { CurrentUser } from './api/auth';
import { Layout } from './components/Layout';
import { EmptyState, ErrorState, LoadingState } from './components/States';
import { AuthPage } from './pages/AuthPage';
import { StatePreview } from './pages/StatePreview';
import { ProfilePage } from './pages/ProfilePage';
import { Badge, PixelCharacter } from './components/PixelArt';
import { ProfileSkills } from './components/ProfileSkills';
import { JobsPage, JobDetailPage } from './pages/jobs/JobsPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';

const getPath = () => window.location.hash.slice(1) || '/';

export function App() {
  const [location, setLocation] = useState(getPath);
  const path = location.split('?')[0];
  const [user, setUser] = useState<CurrentUser | null>();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [retry, setRetry] = useState(0);
  const publicPath = path === '/login' || path === '/register';
  useEffect(() => {
    const onNavigation = () => setLocation(getPath());
    window.addEventListener('hashchange', onNavigation);
    return () => window.removeEventListener('hashchange', onNavigation);
  }, []);
  useEffect(() => {
    let controller: AbortController | undefined;
    function check() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setError('');
      authApi.me(signal).then(value => { if (!signal.aborted) setUser(value); })
        .catch(failure => {
          if (signal.aborted) return;
          if (failure instanceof ApiError && failure.status === 401) setUser(null);
          else setError(failure instanceof Error ? failure.message : '인증 상태를 확인하지 못했습니다.');
        }).finally(() => { if (!signal.aborted) setChecking(false); });
    }
    const expired = () => { setUser(null); };
    const visible = () => { if (document.visibilityState === 'visible') check(); };
    setChecking(true);
    check();
    window.addEventListener('devjob:unauthorized', expired);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    return () => {
      controller?.abort();
      window.removeEventListener('devjob:unauthorized', expired);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [retry]);
  useEffect(() => {
    if (checking || error) return;
    if (!user && !publicPath) window.location.hash = '/login';
    if (user && publicPath) window.location.hash = '/';
  }, [checking, error, user, publicPath]);

  const title = publicPath ? path === '/register' ? '회원가입' : '로그인'
    : path === '/' ? '기본 화면' : path === '/profile' ? '내 프로필' : path === '/states' ? '공통 상태 확인' : path === '/projects' || path.startsWith('/projects/') ? '프로젝트 관리' : path === '/jobs' ? '채용공고' : path.startsWith('/jobs/') ? '공고 상세' : '화면을 찾을 수 없습니다';
  useEffect(() => {
    document.title = `${title} · DevJob`;
    document.getElementById('main-content')?.focus();
  }, [path, title, checking]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true); setError('');
    try { await authApi.logout(); setUser(null); window.location.hash = '/login'; }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        setUser(null); window.location.hash = '/login';
      } else setError(failure instanceof Error ? failure.message : '로그아웃하지 못했습니다. 다시 시도해 주세요.');
    } finally { setLoggingOut(false); }
  }

  if (checking) return <main id="main-content" className="auth-page"><LoadingState message="인증 상태를 확인하고 있습니다." /></main>;
  if (error && !user) return <main id="main-content" className="auth-page">
    <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
  </main>;
  if (!user) return <AuthPage key={path} register={path === '/register'}
    registered={location === '/login?registered=1'} onLogin={value => { setUser(value); window.location.hash = '/'; }} />;

  return <Layout title={title} path={path} user={user} onLogout={logout} loggingOut={loggingOut}>
    {error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />}
    {path === '/' ? <section className="card welcome-card">
      <div className="welcome-copy">
        <Badge tone="primary" icon="home">나의 준비 공간</Badge>
        <h2>취업 준비를 위한 시작 공간</h2>
        <p>{user.email} 계정으로 로그인했습니다.</p>
        <a className="button-link button-primary" href="#/states">공통 상태 확인하기</a>
      </div>
      <div className="welcome-companion"><span className="character-stage"><PixelCharacter /></span><p>함께 준비해요</p></div>
    </section> : path === '/profile' ? <>
      <ProfilePage key={user.id} email={user.email} onEmailChange={email => setUser(current => current ? { ...current, email } : current)} />
      <ProfileSkills key={user.id} />
    </> : path === '/projects' || path.startsWith('/projects/') ? <ProjectsPage key={`${user.id}:${path}`} location={location} />
      : path === '/states' ? <StatePreview /> : path === '/jobs' ? <JobsPage location={location} />
      : path.startsWith('/jobs/') ? <JobDetailPage location={location} /> : <section className="card">
      <EmptyState title="화면을 찾을 수 없습니다." message="주소를 확인하거나 기본 화면으로 돌아가 주세요." />
      <a className="button-link" href="#/">기본 화면으로</a>
    </section>}
  </Layout>;
}
