import type { Project, ProjectImage } from '../../api/projects';
import { projectLink } from '../../api/projects';
import { LucideIcon } from '../../components/LucideIcon';
import projectDefault1 from '../../assets/illustrations/project-default-1.png';
import projectDefault2 from '../../assets/illustrations/project-default-2.png';
import projectDefault3 from '../../assets/illustrations/project-default-3.png';
import projectDefault4 from '../../assets/illustrations/project-default-4.png';
import projectDefault5 from '../../assets/illustrations/project-default-5.png';
import './project-detail.css';

const projectDefaults = [projectDefault1, projectDefault2, projectDefault3, projectDefault4, projectDefault5];
const projectType = (value: Project['projectType']) => value === 'PERSONAL' ? '개인 프로젝트' : value === 'TEAM' ? '팀 프로젝트' : '유형 미지정';
const orEmpty = (value: string | null, empty: string) => value?.trim() || empty;
function distinctSummary(value: string | null, items: string[]) {
  const normalize = (line: string) => line.replace(/\s+/g, ' ').trim();
  const itemSet = new Set(items.map(normalize));
  return value?.split(/\r?\n/).filter(line => normalize(line) && !itemSet.has(normalize(line))).join('\n') ?? '';
}

function DetailSection({ title, icon, children, className = '' }: { title: string; icon: 'fileText' | 'lightbulb' | 'list' | 'chartBar' | 'star' | 'link' | 'monitor' | 'cog'; children: React.ReactNode; className?: string }) {
  return <section className={`project-view-section ${className}`}>
    <h3><LucideIcon name={icon} />{title}</h3>{children}
  </section>;
}

function TextList({ items }: { items: string[] }) {
  return items.length ? <ul className="project-view-checklist">{items.map((item, index) => <li key={`${index}-${item}`}><LucideIcon name="check" /><span>{item}</span></li>)}</ul> : null;
}

export function ProjectDetailView({ project, images }: { project: Project; images: ProjectImage[] }) {
  const thumbnail = images.find(image => image.kind === 'THUMBNAIL') ?? images[0];
  const defaultThumbnail = projectDefaults[(project.id - 1) % projectDefaults.length];
  const keyFeatureSummary = distinctSummary(project.keyFeatures, project.featureItems);
  const outcomeSummary = distinctSummary(project.outcome, project.achievementItems);
  const allSkills = [...project.skills.map(skill => skill.name), ...project.customSkills.map(skill => skill.name)];
  const links = [
    { label: '프로젝트 URL', value: project.projectUrl, empty: '프로젝트 URL이 등록되지 않았습니다.' },
    { label: 'GitHub URL', value: project.githubUrl, empty: 'GitHub URL이 등록되지 않았습니다.' },
    { label: '시연 영상 URL', value: project.demoUrl, empty: '시연 영상 URL이 등록되지 않았습니다.' },
    { label: '발표 자료 / 문서 URL', value: project.presentationUrl, empty: '발표 자료나 문서 URL이 등록되지 않았습니다.' },
  ];
  const skillUsages = [
    ...project.skills.map(skill => ({ name: skill.name, usage: project.skillUsages.find(item => item.skillId === skill.id)?.usage ?? null })),
    ...project.skillUsages.filter(item => !project.skills.some(skill => skill.id === item.skillId)).map(item => ({ name: `기술 #${item.skillId}`, usage: item.usage })),
    ...project.customSkills.map(skill => ({ name: skill.name, usage: skill.usage })),
  ];
  return <div className="project-view">
    <section className="project-view-hero" aria-labelledby="project-view-name">
      <div className="project-view-hero-image"><img src={thumbnail?.viewUrl ?? defaultThumbnail} alt={thumbnail?.fileName ?? ''}
        onError={event => { event.currentTarget.src = defaultThumbnail; }} />
        <span className="project-view-hero-type">{projectType(project.projectType)}</span></div>
      <div className="project-view-hero-content">
        <h2 id="project-view-name">{project.name}</h2>
        <p className="project-view-summary">{orEmpty(project.summary, '한 줄 소개가 등록되지 않았습니다.')}</p>
        <div className="project-view-facts">
          <div><LucideIcon name="folderKanban" /><span><small>프로젝트 유형</small><strong>{projectType(project.projectType)}</strong></span></div>
          <div><LucideIcon name="userRound" /><span><small>역할</small><strong>{orEmpty(project.role, '역할 정보가 없습니다.')}</strong></span></div>
          <div><LucideIcon name="calendar" /><span><small>기간</small><strong>{project.startDate} ~ {project.endDate ?? '진행 중'}</strong></span></div>
          <div><LucideIcon name="userRound" /><span><small>팀 인원</small><strong>{project.teamSize == null ? '팀 인원이 등록되지 않았습니다.' : `${project.teamSize}명`}</strong></span></div>
          <div><LucideIcon name="tag" /><span><small>카테고리</small><strong>{orEmpty(project.category, '카테고리가 등록되지 않았습니다.')}</strong></span></div>
        </div>
      </div>
    </section>

    <DetailSection title="사용 기술" icon="cog" className="project-view-skills">
      {allSkills.length ? <div className="project-view-chips">{allSkills.map((skill, index) => <span key={`${index}-${skill}`}>{skill}</span>)}</div>
        : <p className="project-view-empty">등록된 사용 기술이 없습니다.</p>}
    </DetailSection>

    <div className="project-view-grid">
      <DetailSection title="프로젝트 설명" icon="fileText"><p className="project-view-copy">{orEmpty(project.description, '프로젝트 설명이 등록되지 않았습니다.')}</p></DetailSection>
      <DetailSection title="해결하려는 문제 / 기획 배경" icon="lightbulb"><p className="project-view-copy">{orEmpty(project.problemSolving, '기획 배경이 등록되지 않았습니다.')}</p></DetailSection>
      <DetailSection title="주요 기능" icon="list">
        {keyFeatureSummary && <p className="project-view-copy">{keyFeatureSummary}</p>}
        <TextList items={project.featureItems} />
        {!keyFeatureSummary && project.featureItems.length === 0 && <p className="project-view-empty">주요 기능이 등록되지 않았습니다.</p>}
      </DetailSection>
      <DetailSection title="성과 / 배운 점" icon="chartBar">
        {outcomeSummary && <p className="project-view-copy">{outcomeSummary}</p>}
        <TextList items={project.achievementItems} />
        {!outcomeSummary && project.achievementItems.length === 0 && <p className="project-view-empty">성과가 등록되지 않았습니다.</p>}
      </DetailSection>
    </div>

    <DetailSection title="프로젝트의 강조 정보" icon="star" className="project-view-highlights">
      <div className="project-view-highlight-grid">
        <div className="project-view-highlight"><h4>주요 기여도</h4>
          {project.contributionPercent != null && <div className="project-view-contribution"><div className="project-view-contribution-label"><span>전체 기여도</span><strong>{project.contributionPercent}%</strong></div><div className="project-view-progress"><span style={{ width: `${project.contributionPercent}%` }} /></div></div>}
          {project.contributionItems.map((item, index) => <div className="project-view-contribution" key={`${index}-${item.responsibility}`}><div className="project-view-contribution-label"><span>{item.responsibility}</span><strong>{item.percent}%</strong></div><div className="project-view-progress"><span style={{ width: `${item.percent}%` }} /></div></div>)}
          {project.contributionPercent == null && project.contributionItems.length === 0 && <p className="project-view-empty">기여도가 등록되지 않았습니다.</p>}
        </div>
        <div className="project-view-highlight"><h4>담당 업무 상세</h4><p className="project-view-copy">{orEmpty(project.responsibilities, '담당 업무가 등록되지 않았습니다.')}</p></div>
        <div className="project-view-highlight"><h4>트러블슈팅 / 개선 경험</h4>
          {project.troubleshooting?.trim() && <p className="project-view-copy">{project.troubleshooting}</p>}
          <TextList items={project.troubleshootingItems} />
          {!project.troubleshooting?.trim() && project.troubleshootingItems.length === 0 && <p className="project-view-empty">개선 경험이 등록되지 않았습니다.</p>}
        </div>
        <div className="project-view-highlight"><h4>성과 지표</h4><TextList items={project.metricItems} />{project.metricItems.length === 0 && <p className="project-view-empty">성과 지표가 등록되지 않았습니다.</p>}</div>
      </div>
    </DetailSection>

    <DetailSection title="링크 및 파일" icon="link" className="project-view-links">
      <div className="project-view-link-grid">{links.map(link => {
        const href = projectLink(link.value);
        return <div key={link.label}><strong>{link.label}</strong>{href
          ? <a href={href} target="_blank" rel="noopener noreferrer"><span>{href}</span><LucideIcon name="external" /></a>
          : <p className="project-view-empty">{link.empty}</p>}</div>;
      })}</div>
    </DetailSection>

    <DetailSection title="프로젝트 썸네일 및 추가 이미지" icon="monitor" className="project-view-images">
      {images.length ? <div className="project-view-gallery">
        {images.map(image => <figure key={image.id}><img src={image.viewUrl} alt={image.fileName} /><figcaption>{image.kind === 'THUMBNAIL' ? '썸네일' : '추가 이미지'} · {image.fileName}</figcaption></figure>)}
      </div> : <p className="project-view-image-empty">등록된 이미지가 없습니다.</p>}
    </DetailSection>

    <DetailSection title="프로젝트에서 활용한 기술" icon="cog" className="project-view-usage">
      {skillUsages.length ? <div className="project-view-usage-grid">
        {skillUsages.map((item, index) => <div key={`${index}-${item.name}`}><strong>{item.name}</strong><p className="project-view-copy">{orEmpty(item.usage, '활용 내용이 등록되지 않았습니다.')}</p></div>)}
      </div> : <p className="project-view-empty">기술별 활용 내용이 등록되지 않았습니다.</p>}
    </DetailSection>
  </div>;
}
