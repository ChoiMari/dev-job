import { useEffect, useState } from 'react';
import { authApi, profileApi } from './api';
import { ApiError } from './api/client';
import { anonymousRoute, sessionFailureKind } from './session';
import type { CurrentUser } from './api/auth';
import { Layout } from './components/Layout';
import { EmptyState, ErrorState, LoadingState } from './components/States';
import { AuthPage } from './pages/AuthPage';
import { PublicHome } from './pages/PublicHome';
import { StatePreview } from './pages/StatePreview';
import { ProfilePage } from './pages/ProfilePage';
import { ProfileSkills } from './components/ProfileSkills';
import { JobsPage } from './pages/jobs/JobsPage';
import { JobDetailPage } from './pages/jobs/JobDetailPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { CompaniesPage } from './pages/companies/CompaniesPage';
import { BookmarksPage } from './pages/jobs/BookmarksPage';
import { ApplicationsPage, ApplicationDetailPage } from './pages/applications/ApplicationsPage';
import { MarketAnalyticsPage } from './pages/analytics/MarketAnalyticsPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { TodosPage } from './pages/todos/TodosPage';
import { CharacterPage } from './pages/CharacterPage';
import { SettingsPage } from './pages/SettingsPage';
import { ManualJobDetailPage } from './pages/jobs/ManualJobDetailPage';
import { ManualJobFormPage } from './pages/jobs/ManualJobFormPage';
import { InterviewsPage } from './pages/interviews/InterviewsPage';
import { LearningGoalsPage } from './pages/learning-goals/LearningGoalsPage';
import { ResumesPage } from './pages/resumes/ResumesPage';
import { CoverLettersPage } from './pages/cover-letters/CoverLettersPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { RecommendationsPage } from './pages/recommendations/RecommendationsPage';
import { AlioBatchPage } from './pages/admin/AlioBatchPage';

const getPath = () => window.location.hash.slice(1) || '/';

export function App() {
  const [location, setLocation] = useState(getPath);
  const path = location.split('?')[0];
  const [user, setUser] = useState<CurrentUser | null>();
  const [nickname, setNickname] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [retry, setRetry] = useState(0);
  const publicPath = path === '/login' || path === '/register' || path === '/forgot-password';
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
      // Keep the current view during a background focus check. Initial checks and
      // explicit retries are gated by `checking` below.
      authApi.me(signal).then(value => { if (!signal.aborted) { setUser(value); setError(''); } })
        .catch(failure => {
          if (signal.aborted) return;
          if (sessionFailureKind(failure) === 'anonymous') { setUser(null); setError(''); }
          else setError(failure instanceof Error ? failure.message : '인증 상태를 확인하지 못했습니다.');
        }).finally(() => { if (!signal.aborted) setChecking(false); });
    }
    const expired = () => {
      setUser(null);
      const currentPath = getPath().split('?')[0];
      if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/forgot-password')
        window.location.hash = '/login?sessionExpired=1';
    };
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
    if (!user && anonymousRoute(path) === 'login') window.location.hash = '/login';
    if (user && publicPath) window.location.hash = '/';
  }, [checking, error, user, publicPath, path]);
  useEffect(() => {
    if (!user) { setNickname(null); return; }
    const controller = new AbortController();
    profileApi.get(controller.signal).then(profile => { if (!controller.signal.aborted) setNickname(profile.nickname); })
      .catch(() => { if (!controller.signal.aborted) setNickname(null); });
    return () => controller.abort();
  }, [user?.id]);

  const title = publicPath ? path === '/register' ? '회원가입' : path === '/forgot-password' ? '비밀번호 찾기' : '로그인'
    : path === '/' ? user ? '대시보드' : '홈' : path === '/profile' ? '내 프로필' : path === '/states' ? '공통 상태 확인'
      : path === '/projects' || path.startsWith('/projects/') ? '프로젝트 관리'
      : path === '/todos' || path.startsWith('/todos/') ? '내 할 일'
      : path === '/companies' || path.startsWith('/companies/') ? '기업 관리'

      : path === '/jobs' ? '채용공고' : path === '/bookmarks' || path.startsWith('/bookmarks/') ? '관심 공고'
      : path.startsWith('/jobs/') ? '공고 상세'
      : path === '/applications' || path.startsWith('/applications/') ? '지원 관리'
      : path === '/analytics/skills' ? '채용시장 분석'
      : path === '/character' ? '내 캐릭터' : path === '/settings' ? '설정'
      : path === '/interviews' || path.startsWith('/interviews/') ? '면접 일정'
      : path === '/learning-goals' || path.startsWith('/learning-goals/') ? '역량 분석 기반 학습'
      : path === '/resumes' || path.startsWith('/resumes/') ? '이력서'
      : path === '/cover-letters' || path.startsWith('/cover-letters/') ? '자기소개서'
      : path === '/notifications' ? '알림'
      : path === '/recommendations' || path.startsWith('/recommendations/') ? '의미 기반 추천'
      : path === '/admin/alio' ? 'ALIO 배치' : '화면을 찾을 수 없습니다';
  useEffect(() => {
    document.title = `${title} · DevJob`;
    window.scrollTo(0, 0);
    document.getElementById('main-content')?.focus({ preventScroll: true });
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
  if (error) return <main id="main-content" className="auth-page">
    <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
  </main>;
  if (user && publicPath) return <main id="main-content" className="auth-page"><LoadingState message="대시보드로 이동하고 있습니다." /></main>;
  if (!user && anonymousRoute(path) === 'home') return <PublicHome />;
  if (!user && anonymousRoute(path) === 'login') return <main id="main-content" className="auth-page"><LoadingState message="로그인 화면으로 이동하고 있습니다." /></main>;
  if (!user) return <AuthPage key={path} register={path === '/register'} forgotPassword={path === '/forgot-password'}
    passwordChanged={location === '/login?passwordChanged=1'}
    sessionExpired={location === '/login?sessionExpired=1'}
    onLogin={value => { setUser(value); window.location.hash = '/'; }} />;

  return <Layout title={title} path={path} user={user} nickname={nickname} onLogout={logout} loggingOut={loggingOut}>
    {path === '/' ? <DashboardPage key={user.id} user={user} /> : path === '/profile' ? <div className="profile-page">
      <ProfilePage key={`profile-${user.id}`} email={user.email} onProfileSaved={profile => {
        setNickname(profile.nickname);
        setUser(current => current ? { ...current, email: profile.email } : current);
      }} />
      <ProfileSkills key={`skills-${user.id}`} />
    </div> : path === '/projects' || path.startsWith('/projects/') ? <ProjectsPage key={`${user.id}:${path}`} location={location} />
      : path === '/todos' || path.startsWith('/todos/') ? <TodosPage key={`${user.id}:${path}`} location={location} />
      : path === '/companies' || path.startsWith('/companies/') ? <CompaniesPage key={user.id + ':' + path} location={location} />

      : path === '/states' ? <StatePreview /> : path === '/jobs' ? <JobsPage location={location} />
      : path === '/bookmarks' ? <BookmarksPage location={location} />
      : path === '/bookmarks/new' || /^\/bookmarks\/[1-9]\d*\/edit$/.test(path) ? <ManualJobFormPage key={path} location={location} />
      : path.startsWith('/bookmarks/') ? <ManualJobDetailPage key={`${user.id}:${path}`} location={location} userId={user.id} />
      : path.startsWith('/jobs/') ? <JobDetailPage location={location} userId={user.id} />
      : path === '/applications' ? <ApplicationsPage location={location} />
      : path === '/analytics/skills' ? <MarketAnalyticsPage location={location} />
      : path === '/learning-goals' || path.startsWith('/learning-goals/') ? <LearningGoalsPage key={path} location={location} />
      : path === '/interviews' || path.startsWith('/interviews/') ? <InterviewsPage key={path} location={location} />
      : path === '/resumes' || path.startsWith('/resumes/') ? <ResumesPage key={path} location={location} />
      : path === '/cover-letters' || path.startsWith('/cover-letters/') ? <CoverLettersPage key={path} location={location} />
      : path === '/notifications' ? <NotificationsPage />
      : path === '/recommendations' || path.startsWith('/recommendations/') ? <RecommendationsPage key={path} location={location} />
      : path === '/admin/alio' ? <AlioBatchPage />
      : path === '/character' ? <CharacterPage />
      : path === '/settings' ? <SettingsPage user={user} onLogout={logout} loggingOut={loggingOut}
        onPasswordChanged={() => { setUser(null); window.location.hash = '/login?passwordChanged=1'; }}
        onSessionExpired={() => { setUser(null); window.location.hash = '/login?sessionExpired=1'; }} />
      : path.startsWith('/applications/') ? <ApplicationDetailPage key={path} location={location} /> : <section className="card">
      <EmptyState title="화면을 찾을 수 없습니다." message="주소를 확인하거나 기본 화면으로 돌아가 주세요." />
      <a className="button-link" href="#/">기본 화면으로</a>
    </section>}
  </Layout>;
}
