import { useEffect, useRef, useState } from 'react';
import { LucideIcon } from '../../components/LucideIcon';
import emptyArt from '../../assets/illustrations/resume-empty.png';
import techArt from '../../assets/illustrations/resume-guide-tech.png';
import projectArt from '../../assets/illustrations/resume-guide-project.png';
import problemArt from '../../assets/illustrations/resume-guide-problem.png';
import performanceArt from '../../assets/illustrations/resume-guide-performance.png';
import githubArt from '../../assets/illustrations/resume-guide-github.png';

const topics = [
  { title: '기술 스택', detail: '사용 가능한 기술과 숙련도', image: techArt },
  { title: '프로젝트 경험', detail: '주요 프로젝트와 담당 역할', image: projectArt },
  { title: '문제 해결 경험', detail: '기술적 문제를 어떻게 해결했는지', image: problemArt },
  { title: '성능 개선 성과', detail: '수치로 보여주는 개선 결과', image: performanceArt },
  { title: 'GitHub 링크', detail: '코드로 증명하는 나의 역량', image: githubArt },
];

export function ResumeEmptyState() {
  const [guideOpen, setGuideOpen] = useState(false);
  return <section className="resume-empty" aria-labelledby="resume-empty-title">
    <div className="resume-empty-count"><span className="resume-empty-count-icon"><LucideIcon name="fileText" /></span><div><strong>총 0개의 이력서</strong><p>이력서를 작성하고 버전을 관리해 보세요.</p></div></div>
    <div className="resume-empty-center"><img src={emptyArt} alt="" aria-hidden="true" /><h2 id="resume-empty-title">아직 작성한 이력서가 없습니다.</h2><p>개발자 취업에 맞춘 이력서를 작성하고 버전을 관리해 보세요.</p><div className="resume-empty-actions"><a className="resume-primary" href="#/resumes/new">＋ 첫 이력서 작성하기</a><button type="button" onClick={() => setGuideOpen(true)}><LucideIcon name="fileText" /> 작성 가이드 보기</button></div></div>
    <div className="resume-empty-bottom"><div className="resume-empty-tip"><LucideIcon name="star" /><div><strong>이력서에 이런 내용을 포함해 보세요</strong><p>AI가 더 정확한 분석을 할 수 있고, 기업에 더 잘 어필할 수 있어요.</p></div></div><div className="resume-empty-topics">{topics.map(topic => <div key={topic.title}><img src={topic.image} alt="" aria-hidden="true" /><strong>{topic.title}</strong><p>{topic.detail}</p></div>)}</div></div>
    {guideOpen && <ResumeGuideModal onClose={() => setGuideOpen(false)} />}
  </section>;
}

export function ResumeGuideModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="resume-guide-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="resume-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="resume-guide-title" aria-describedby="resume-guide-description">
      <header><div><h2 id="resume-guide-title">개발자 이력서 작성 가이드</h2><p id="resume-guide-description">기술 이름보다 문제를 해결한 근거가 보이도록 작성해 보세요.</p></div><button ref={closeRef} type="button" aria-label="가이드 닫기" onClick={onClose}><LucideIcon name="close" /></button></header>
      <div className="resume-guide-content">
        <section><h3>1. 기술 스택</h3><p>실제로 사용한 언어·프레임워크·DB·도구를 적고, 어느 프로젝트에서 어떤 용도로 썼는지 연결하세요. 숙련도를 임의의 점수로 매기기보다 구현 범위를 보여주는 편이 명확합니다.</p><p className="resume-guide-example">예: Spring Boot와 PostgreSQL로 지원 기록 API를 구현하고, 입력 검증과 사용자별 소유권 검사를 적용했습니다.</p></section>
        <section><h3>2. 프로젝트 경험</h3><p>프로젝트 목적, 본인 역할, 사용 기술, 구현한 핵심 기능, 협업 방식과 결과를 분리해 적으세요. 팀 프로젝트라면 직접 맡은 부분을 구체적으로 밝히세요.</p><p className="resume-guide-example">예: 채용공고 수집 프로젝트에서 중복 판별과 실패 재시도 흐름을 담당했습니다. 관련 코드와 실행 방법은 저장소 README에 정리했습니다.</p></section>
        <section><h3>3. 문제 해결 경험</h3><p>발생한 문제 → 원인 확인 → 선택한 해결 방법 → 검증 결과 순서로 씁니다. 시도했다가 효과가 없었던 방법이 있다면 판단 근거를 짧게 덧붙여도 좋습니다.</p><p className="resume-guide-example">예: 대량 조회에서 응답이 늦어 SQL 실행 계획을 확인했고, 실제 필터 조건에 맞는 인덱스를 추가한 뒤 같은 조건으로 다시 측정했습니다.</p></section>
        <section><h3>4. 성능 개선 성과</h3><p>측정한 경우에만 개선 전후 수치, 데이터 규모, 측정 환경을 함께 적으세요. 측정하지 않았다면 숫자를 만들어 넣지 말고 안정성·사용성·유지보수 측면에서 확인한 변화를 설명하세요.</p><p className="resume-guide-example">예: 동일한 테스트 데이터와 환경에서 API 응답 중앙값을 측정해 개선 전후 결과를 비교했습니다. 수치는 실제 측정값으로 교체하세요.</p></section>
        <section><h3>5. GitHub 링크</h3><p>대표 저장소 링크와 함께 README에 실행 방법, 핵심 기능, 아키텍처, 본인이 맡은 부분, 테스트 방법을 정리하세요. 공개 전에는 비밀키와 개인정보가 포함되지 않았는지 확인하세요.</p><p className="resume-guide-example">예: GitHub: https://github.com/사용자명/프로젝트명 · README에서 실행 방법과 주요 설계 결정을 볼 수 있습니다.</p></section>
        <aside><strong>제출 전 확인</strong><p>지원할 공고에 맞는 경험을 앞에 배치하고, 날짜·기술명·링크가 정확한지 확인하세요. AI 분석은 문장 다듬기에 참고하되 실제 경험과 측정 결과는 직접 검증하세요.</p></aside>
      </div>
      <footer><button type="button" className="resume-primary" onClick={onClose}>확인</button></footer>
    </section>
  </div>;
}
