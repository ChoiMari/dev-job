import { PixelCharacter, PixelIcon } from '../components/PixelArt';

export function CharacterPage() {
  return <div className="character-page">
    <section className="card character-welcome">
      <div><span className="eyebrow">YOUR LITTLE COMPANION</span><h2>함께 준비하는 나의 캐릭터</h2>
        <p>취업 준비의 여정에 함께하는 DevJob의 작은 동료예요. 오늘의 기록을 차근차근 쌓아보세요.</p>
        <div className="character-actions"><a className="button-link button-primary" href="#/profile">내 프로필 보기</a><a className="button-link" href="#/projects">프로젝트 기록하기</a></div>
      </div>
      <div className="character-large" role="img" aria-label="DevJob의 픽셀 캐릭터"><PixelCharacter /></div>
    </section>
    <section className="character-guide">
      <h2>다음 한 걸음</h2>
      <div className="character-guide-grid">
        <a className="card" href="#/jobs"><PixelIcon name="jobs" /><strong>기회 찾기</strong><span>지금 열려 있는 채용공고를 살펴보세요.</span></a>
        <a className="card" href="#/applications"><PixelIcon name="calendar" /><strong>진행 살피기</strong><span>지원 상태와 다음 일정을 확인하세요.</span></a>
        <a className="card" href="#/skill-gap"><PixelIcon name="spark" /><strong>역량 키우기</strong><span>목표 직무에 필요한 기술을 찾아보세요.</span></a>
      </div>
      <p className="character-notice">캐릭터 성장, 레벨, 꾸미기 기능은 아직 제공되지 않습니다. 이 화면은 현재 준비 흐름으로 이동하는 안내 역할을 합니다.</p>
    </section>
  </div>;
}
