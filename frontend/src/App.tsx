import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { EmptyState } from './components/States';
import { StatePreview } from './pages/StatePreview';

const getPath = () => window.location.hash.slice(1) || '/';

export function App() {
  const [path, setPath] = useState(getPath);
  useEffect(() => {
    const onNavigation = () => setPath(getPath());
    window.addEventListener('hashchange', onNavigation);
    return () => window.removeEventListener('hashchange', onNavigation);
  }, []);
  const title = path === '/' ? '기본 화면' : path === '/states' ? '공통 상태 확인' : '화면을 찾을 수 없습니다';
  useEffect(() => {
    document.title = `${title} · DevJob`;
    document.getElementById('main-content')?.focus();
  }, [path, title]);

  return <Layout title={title} path={path}>
    {path === '/' ? <section className="card">
      <p className="eyebrow">DevJob</p>
      <h2>취업 준비를 위한 시작 공간</h2>
      <p>지금은 기본 화면과 공통 상태를 확인할 수 있습니다.</p>
      <a className="button-link" href="#/states">공통 상태 확인하기</a>
    </section> : path === '/states' ? <StatePreview /> : <section className="card">
      <EmptyState title="화면을 찾을 수 없습니다." message="주소를 확인하거나 기본 화면으로 돌아가 주세요." />
      <a className="button-link" href="#/">기본 화면으로</a>
    </section>}
  </Layout>;
}
