import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createProjectsApi, projectLink } from '../../api/projects';
import type { Project, ProjectImage, ProjectInput, ProjectPage } from '../../api/projects';
import { createSkillsApi } from '../../api/skills';
import type { Skill, SkillPage } from '../../api/skills';
import { LucideIcon } from '../../components/LucideIcon';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import { ProjectDetailView } from './ProjectDetailView';
import './projects.css';
import projectEmptyArt from '../../assets/illustrations/project-empty-pixel.png';
import projectBannerArt from '../../assets/illustrations/project-list-banner-pixel.png';
import projectTitleArt from '../../assets/illustrations/project-list-title-pixel.png';
import projectDefault1 from '../../assets/illustrations/project-default-1.png';
import projectDefault2 from '../../assets/illustrations/project-default-2.png';
import projectDefault3 from '../../assets/illustrations/project-default-3.png';
import projectDefault4 from '../../assets/illustrations/project-default-4.png';
import projectDefault5 from '../../assets/illustrations/project-default-5.png';

const projects = createProjectsApi(apiRequest);
const skills = createSkillsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '프로젝트를 처리하지 못했습니다.';
const blank: ProjectInput = { name: '', projectType: 'PERSONAL', description: null, startDate: '', endDate: null, role: null,
  keyFeatures: null, outcome: null, projectUrl: null, skillIds: [], summary: null, category: null, teamSize: null,
  problemSolving: null, featureItems: [], achievementItems: [], demoUrl: null, githubUrl: null,
  presentationUrl: null, contributionPercent: null, responsibilities: null, troubleshooting: null,
  metricItems: [], skillUsages: [], contributionItems: [], troubleshootingItems: [], customSkills: [] };
const roles = ['풀스택', '프론트엔드', '백엔드', 'AI/ML', '데이터', 'DevOps/인프라', 'UI/UX', 'PM', '기획자'];
const categories = ['웹 애플리케이션', '모바일 애플리케이션', 'AI/머신러닝', '데이터 분석', '데스크톱 애플리케이션', '게임', 'IoT/임베디드', '자동화 도구', 'API/백엔드 서비스'];
const projectDefaults = [projectDefault1, projectDefault2, projectDefault3, projectDefault4, projectDefault5];
const monthLabel = (date: string) => date.slice(0, 7).replace('-', '.');
function projectDuration(start: string, end: string | null) {
  if (!end) return '진행 중';
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  return `${(endYear - startYear) * 12 + endMonth - startMonth + 1}개월`;
}
function projectStatus(item: Project): 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  return item.startDate > today ? 'PLANNED' : item.endDate && item.endDate < today ? 'COMPLETED' : 'IN_PROGRESS';
}

export function ProjectsPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/projects') return <ProjectList />;
  if (path === '/projects/new') return <ProjectEditor />;
  const match = /^\/projects\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? <ProjectEditor id={id} initialEdit={new URLSearchParams(location.split('?')[1] ?? '').get('edit') === '1'} /> : <section className="card">
    <EmptyState title="프로젝트 주소를 확인해 주세요." /><a className="button-link" href="#/projects">프로젝트 목록으로</a>
  </section>;
}

function ProjectList() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ProjectPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searched, setSearched] = useState('');
  const [projectType, setProjectType] = useState<'' | 'PERSONAL' | 'TEAM'>('');
  const [status, setStatus] = useState<'' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'>('');
  const [sort, setSort] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearched(searchInput.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setResult(undefined);
    projects.list(page, controller.signal, { q: searched || undefined, projectType: projectType || undefined,
      status: status || undefined, sort })
      .then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(error => { if (!controller.signal.aborted) setError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, searched, projectType, status, sort, retry]);
  useEffect(() => {
    if (!result?.items.length) return;
    let active = true;
    setThumbnailUrls({});
    void projects.imageStorageAvailable().then(async available => {
      if (!available || !active) return;
      const thumbnails = await Promise.all(result.items.map(async item => {
        try { return [item.id, (await projects.images(item.id)).find(image => image.kind === 'THUMBNAIL')?.viewUrl] as const; }
        catch { return [item.id, undefined] as const; }
      }));
      if (active) setThumbnailUrls(Object.fromEntries(thumbnails.filter((entry): entry is readonly [number, string] => !!entry[1])));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [result]);
  async function deleteProject(id: number) {
    setDeletingId(id); setDeleteError('');
    try {
      await projects.remove(id);
      setConfirmDeleteId(null);
      if (result?.items.length === 1 && page > 0) setPage(page - 1);
      else setRetry(value => value + 1);
    } catch (cause) { setDeleteError(message(cause)); }
    finally { setDeletingId(null); }
  }
  const filtered = !!(searched || projectType || status);
  return <section className="project-list-page">
    <header className="project-list-banner" style={{ backgroundImage: `linear-gradient(90deg, #e5e3ff 0%, #e5e3ff 24%, rgba(229, 227, 255, .92) 35%, transparent 57%), url(${projectBannerArt})` }}>
      <div className="project-list-banner__copy"><div className="project-list-banner__title">
        <img src={projectTitleArt} alt="" aria-hidden="true" /><h1>프로젝트 관리</h1>
      </div><p>지금까지의 개발 경험을 정리하고,<br />나만의 성장을 기록해보세요.</p></div>
    </header>
    <div className="project-list-toolbar">
      <label className="project-list-search"><LucideIcon name="search" />
        <input aria-label="프로젝트 검색" value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={100} placeholder="프로젝트명 또는 기술 스택으로 검색..." /></label>
      <select aria-label="프로젝트 유형" value={projectType} onChange={event => { setProjectType(event.target.value as typeof projectType); setPage(0); }}>
        <option value="">전체</option><option value="PERSONAL">개인</option><option value="TEAM">팀</option></select>
      <select aria-label="진행 상태" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(0); }}>
        <option value="">진행 상태</option><option value="PLANNED">시작 전</option><option value="IN_PROGRESS">진행 중</option><option value="COMPLETED">완료</option></select>
      <select aria-label="정렬" value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(0); }}>
        <option value="NEWEST">↕ 최신순</option><option value="OLDEST">↕ 오래된순</option></select>
      <a className="button-link button-primary project-list-add" href="#/projects/new"><span aria-hidden="true">＋</span> 프로젝트 등록</a>
    </div>
    {loading || (!!result && result.page !== page) ? <LoadingState message="프로젝트를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
      : result && <>
        {result.items.length === 0 ? <div className="project-list-empty" role="status">
          <img src={projectEmptyArt} alt="" aria-hidden="true" />
          <h2>{page > 0 ? '이 페이지에 프로젝트가 없습니다.' : filtered ? '검색 결과가 없습니다.' : '등록한 프로젝트가 없습니다.'}</h2>
          <p>{filtered ? '검색어나 필터를 변경해 보세요.' : '프로젝트 추가 버튼으로 첫 경험을 기록해 보세요.'}</p>
        </div> : <ul className="project-list" aria-label="내 프로젝트 목록">
          {result.items.map(item => {
            const state = projectStatus(item);
            const typeLabel = item.projectType === 'PERSONAL' ? '개인 프로젝트' : item.projectType === 'TEAM' ? '팀 프로젝트' : '유형 미지정';
            return <li className="project-list-card" key={item.id}>
              <a className="project-list-card__thumbnail" href={`#/projects/${item.id}`} aria-label={`${item.name} 상세 보기`}>
                <img src={thumbnailUrls[item.id] ?? projectDefaults[(item.id - 1) % projectDefaults.length]} alt=""
                  onError={event => { event.currentTarget.src = projectDefaults[(item.id - 1) % projectDefaults.length]; }} />
                <span>{typeLabel}</span>
              </a>
              <div className="project-list-card__body">
                <h2><a href={`#/projects/${item.id}`}>{item.name}</a></h2>
                <p className="project-list-card__summary">{item.summary || item.description || '프로젝트 설명이 없습니다.'}</p>
                <div className="project-list-card__meta"><span><LucideIcon name="clock" />{monthLabel(item.startDate)} ~ {item.endDate ? monthLabel(item.endDate) : '진행 중'}{item.endDate && ` (${projectDuration(item.startDate, item.endDate)})`}</span>
                  <span><LucideIcon name="userRound" />{item.role ? `${item.role} · ` : ''}{typeLabel}</span></div>
                <div className="project-list-card__skills">{item.skills.map(skill => <span key={skill.id}>{skill.name}</span>)}
                  {item.customSkills.map(skill => <span key={skill.name}>{skill.name}</span>)}</div>
              </div>
              <div className="project-list-card__actions">
                <span className={`project-list-card__status project-list-card__status--${state.toLowerCase()}`}>{state === 'COMPLETED' ? '완료' : state === 'PLANNED' ? '시작 전' : '진행 중'}</span>
                <a href={`#/projects/${item.id}?edit=1`} aria-label={`${item.name} 수정`} title="프로젝트 수정"><LucideIcon name="pencil" /></a>
                <button type="button" aria-label={`${item.name} 삭제`} title="프로젝트 삭제" disabled={deletingId !== null} onClick={() => { setConfirmDeleteId(item.id); setDeleteError(''); }}><LucideIcon name="trash" /></button>
              </div>
              {confirmDeleteId === item.id && <div className="project-list-card__confirm" role="group" aria-label={`${item.name} 삭제 확인`}>
                <span>“{item.name}” 프로젝트를 삭제할까요?</span>
                {deleteError && <span role="alert">{deleteError}</span>}
                <button type="button" disabled={deletingId !== null} onClick={() => void deleteProject(item.id)}>{deletingId === item.id ? '삭제 중…' : '삭제 확인'}</button>
                <button type="button" disabled={deletingId !== null} onClick={() => { setConfirmDeleteId(null); setDeleteError(''); }}>취소</button>
              </div>}
            </li>;
          })}
        </ul>}
        {result.totalElements > result.size && <div className="project-actions"><button disabled={page === 0} onClick={() => setPage(v => v - 1)}>이전</button>
          <span role="status">총 {result.totalElements}건 · {page + 1}페이지</span>
          <button disabled={(page + 1) * result.size >= result.totalElements} onClick={() => setPage(v => v + 1)}>다음</button></div>}
      </>}
  </section>;
}

function ProjectEditor({ id, initialEdit = false }: { id?: number; initialEdit?: boolean }) {
  const [project, setProject] = useState<Project>();
  const [form, setForm] = useState<ProjectInput>(blank);
  const [selected, setSelected] = useState<Skill[]>([]);
  const [editing, setEditing] = useState(!id || initialEdit);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [loadStatus, setLoadStatus] = useState(0);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedId, setSavedId] = useState<number>();
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [uploadFiles, setUploadFiles] = useState<{ kind: ProjectImage['kind']; file: File }[]>([]);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { projects.imageStorageAvailable().then(setStorageAvailable).catch(() => setStorageAvailable(false)); }, []);
  useEffect(() => { if (id && storageAvailable) projects.images(id).then(setImages).catch(() => setImages([])); }, [id, storageAvailable]);
  function accept(value: Project) {
    const { id: _id, skills: selectedSkills, ...fields } = value;
    setProject(value); setSelected(selectedSkills); setForm({ ...fields, skillIds: selectedSkills.map(skill => skill.id) });
  }
  function finishEditing() {
    setEditing(false);
    if (id && initialEdit) window.history.replaceState(window.history.state, '', `#/projects/${id}`);
  }
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); setLoading(true); setLoadError('');
    projects.get(id, controller.signal).then(value => { if (!controller.signal.aborted) accept(value); })
      .catch(error => { if (!controller.signal.aborted) { setLoadError(message(error)); setLoadStatus(error instanceof ApiError ? error.status : 0); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    setError(''); setSuccess('');
    if (!form.name.trim()) { setError('프로젝트명을 입력해 주세요.'); return; }
    if (form.endDate && form.endDate < form.startDate) { setError('종료일은 시작일보다 빠를 수 없습니다.'); return; }
    if (form.projectUrl && !projectLink(form.projectUrl.trim())) { setError('프로젝트 URL은 http 또는 https 주소로 입력해 주세요.'); return; }
    inFlight.current = true; setBusy(true);
    try {
      const input = { ...form, name: form.name.trim(), skillIds: selected.map(skill => skill.id),
        featureItems: form.featureItems.map(value => value.trim()).filter(Boolean),
        achievementItems: form.achievementItems.map(value => value.trim()).filter(Boolean),
        metricItems: form.metricItems.map(value => value.trim()).filter(Boolean),
        teamSize: form.projectType === 'TEAM' ? form.teamSize : null,
        contributionPercent: form.contributionItems.length ? null : form.contributionPercent,
        responsibilities: form.contributionItems.length ? null : form.responsibilities,
        troubleshooting: null,
        contributionItems: form.contributionItems.filter(item => item.responsibility.trim()).map(item => ({ ...item, responsibility: item.responsibility.trim() })),
        troubleshootingItems: form.troubleshootingItems.map(value => value.trim()).filter(Boolean),
        skillUsages: form.skillUsages.filter(item => selected.some(skill => skill.id === item.skillId)),
        customSkills: form.customSkills.map(item => ({ name: item.name.trim(), usage: item.usage?.trim() || null })) };
      const targetId = id ?? savedId;
      const value = targetId ? await projects.update(targetId, input) : await projects.create(input);
      if (!mounted.current) return;
      if (!id) setSavedId(value.id);
      for (const entry of uploadFiles) {
        const uploaded = await projects.uploadImage(value.id, entry.kind, entry.file);
        if (!mounted.current) return;
        setImages(current => [...current, uploaded]);
        setUploadFiles(current => current.filter(item => item !== entry));
      }
      if (!id) window.location.hash = `/projects/${value.id}`;
      else { accept(value); finishEditing(); setSuccess('프로젝트를 저장했습니다.'); }
    } catch (error) { if (mounted.current) setError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (!id || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setSuccess('');
    try { await projects.remove(id); if (mounted.current) window.location.hash = '/projects'; }
    catch (error) { if (mounted.current) setError(message(error)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function removeImage(imageId: number) {
    const targetId = id ?? savedId;
    if (!targetId || busy) return;
    setBusy(true); setError('');
    try { await projects.removeImage(targetId, imageId); setImages(current => current.filter(item => item.id !== imageId)); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }
  function change(key: keyof ProjectInput, value: string) {
    setForm(current => ({ ...current, [key]: key === 'name' || key === 'startDate' ? value : value || null })); setError('');
  }
  return <div className="projects-page project-editor-page">
    <div className="project-view-toolbar"><a className="project-editor-back" href="#/projects"><LucideIcon name="arrowLeft" /> 목록으로 돌아가기</a>
      {!editing && project && !loading && !loadError && <div className="project-view-toolbar-actions">
        <button type="button" disabled={busy} onClick={() => { setEditing(true); setConfirmDelete(false); setSuccess(''); setError(''); }}><LucideIcon name="pencil" /> 수정</button>
        <button type="button" className="project-view-delete-button" disabled={busy} onClick={() => setConfirmDelete(true)}><LucideIcon name="trash" /> 삭제</button>
      </div>}</div>
    {loading ? <LoadingState message="프로젝트를 불러오고 있습니다." /> : loadError
      ? loadStatus === 404 || loadStatus === 403 ? <EmptyState title={loadStatus === 404 ? '프로젝트를 찾을 수 없습니다.' : '접근 권한이 없습니다.'} message={loadError} />
        : <ErrorState message={loadError} onRetry={() => setRetry(v => v + 1)} />
      : <>
        {success && <SuccessState title={success} compact />}
        {error && <p role="alert" className="form-error">{error}</p>}
        {editing ? <form className="project-form" onSubmit={save}>
          <fieldset disabled={busy}><ProjectFields form={form} setForm={setForm} change={change} selected={selected} setSelected={setSelected} busy={busy}
            storageAvailable={storageAvailable} images={images} uploadFiles={uploadFiles} setUploadFiles={setUploadFiles} removeImage={removeImage} /></fieldset>
          <div className="project-actions project-editor-actions">{id
            ? <button type="button" disabled={busy} onClick={() => { if (project) accept(project); finishEditing(); setError(''); }}>취소</button>
            : <a className="button-link" href="#/projects">취소</a>}
            <button className="button-primary" type="submit" disabled={busy}>{busy ? '저장 중…' : '프로젝트 저장'}</button></div>
        </form> : project && <>
          {confirmDelete && <div className="project-delete" role="group" aria-label="프로젝트 삭제 확인"><p>“{project.name}” 프로젝트와 프로젝트 기술 연결을 삭제할까요? 보유 기술은 유지됩니다.</p>
            <div className="project-actions"><button disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중…' : '삭제 확인'}</button>
              <button disabled={busy} onClick={() => setConfirmDelete(false)}>삭제 취소</button></div></div>}
          <ProjectDetailView project={project} images={images} />
        </>}
      </>}
  </div>;
}

function ProjectFields({ form, setForm, change, selected, setSelected, busy, storageAvailable, images, uploadFiles, setUploadFiles, removeImage }: {
  form: ProjectInput; setForm: React.Dispatch<React.SetStateAction<ProjectInput>>;
  change: (key: keyof ProjectInput, value: string) => void;
  selected: Skill[]; setSelected: (value: Skill[]) => void; busy: boolean;
  storageAvailable: boolean; images: ProjectImage[];
  uploadFiles: { kind: ProjectImage['kind']; file: File }[];
  setUploadFiles: React.Dispatch<React.SetStateAction<{ kind: ProjectImage['kind']; file: File }[]>>;
  removeImage: (imageId: number) => Promise<void>;
}) {
  const [ongoing, setOngoing] = useState(!form.endDate);
  const customRole = !!form.role && !roles.includes(form.role);
  const customCategory = !!form.category && !categories.includes(form.category);
  function setList(key: 'featureItems' | 'achievementItems' | 'metricItems' | 'troubleshootingItems', value: string[]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  function textList(key: 'featureItems' | 'achievementItems' | 'metricItems' | 'troubleshootingItems', label: string, placeholder: string, max: number) {
    return <label className="project-repeatable">{label}
      {(form[key].length ? form[key] : ['']).map((value, index) => <span className="project-repeatable-row" key={`${key}-${index}`}>
        <textarea rows={3} required={key === 'featureItems' && index === 0} maxLength={max} value={value} placeholder={placeholder} onChange={e => {
          const next = [...(form[key].length ? form[key] : [''])]; next[index] = e.target.value; setList(key, next);
        }} />
        {form[key].length > 1 && <button type="button" onClick={() => setList(key, form[key].filter((_, i) => i !== index))} aria-label={`${label} ${index + 1} 삭제`}>×</button>}
      </span>)}
      <button className="project-dashed-add" type="button" disabled={form[key].length >= 10} onClick={() => setList(key, [...(form[key].length ? form[key] : ['']), ''])}>＋ 추가하기</button>
    </label>;
  }
  return <>
    <div className="project-editor-section"><div className="project-section-head"><span><LucideIcon name="clipboardList" /></span><h2>기본 정보</h2></div>
      <div className="project-fields-grid">
        <label>프로젝트명 *<input name="name" required maxLength={100} value={form.name} placeholder="프로젝트명을 입력해 주세요." onChange={e => change('name', e.target.value)} /></label>
        <label>한 줄 소개 *<input name="summary" required maxLength={200} value={form.summary ?? ''} placeholder="프로젝트를 한 줄로 소개해 주세요." onChange={e => change('summary', e.target.value)} /></label>
        <div className="project-field"><span>프로젝트 유형 *</span><div className="project-type-options">
          {([['PERSONAL', '개인 프로젝트'], ['TEAM', '팀 프로젝트']] as const).map(([value, title]) =>
            <label className="project-type-option" key={value}><input type="radio" name="projectType" checked={form.projectType === value} onChange={() => setForm(current => ({ ...current, projectType: value }))} /><span><strong>{title}</strong></span></label>)}
        </div></div>
        <div className="project-fields-grid project-fields-grid--nested">
          <label>역할 *<select required value={customRole ? '기타' : (form.role ?? '')} onChange={e => change('role', e.target.value === '기타' ? '기타' : e.target.value)}><option value="">역할을 선택해 주세요.</option>{roles.map(value => <option key={value}>{value}</option>)}<option>기타</option></select>
            {customRole && <input aria-label="기타 역할 직접 입력" required maxLength={100} value={form.role === '기타' ? '' : form.role ?? ''} onChange={e => change('role', e.target.value || '기타')} placeholder="역할을 직접 입력해 주세요." />}</label>
          <label>팀원 수<input type="number" min={1} max={99} value={form.teamSize ?? ''} placeholder="1" onChange={e => setForm(current => ({ ...current, teamSize: e.target.value ? Number(e.target.value) : null }))} disabled={form.projectType !== 'TEAM'} /></label>
        </div>
        <label>카테고리 *<select required value={customCategory ? '기타' : (form.category ?? '')} onChange={e => change('category', e.target.value)}><option value="">카테고리를 선택해 주세요.</option>{categories.map(value => <option key={value}>{value}</option>)}<option>기타</option></select>
          {customCategory && <input aria-label="기타 카테고리 직접 입력" required maxLength={100} value={form.category === '기타' ? '' : form.category ?? ''} onChange={e => change('category', e.target.value || '기타')} placeholder="카테고리를 직접 입력해 주세요." />}</label>
        <div className="project-field"><div className="project-date-head"><span>진행 기간 *</span><label className="project-ongoing"><input type="checkbox" checked={ongoing} onChange={e => { setOngoing(e.target.checked); if (e.target.checked) setForm(current => ({ ...current, endDate: null })); }} />진행 중 (종료일 미정)</label></div>
          <div className="project-date-range"><input aria-label="시작일" name="startDate" type="date" required value={form.startDate} onChange={e => change('startDate', e.target.value)} /><span>~</span><input aria-label="종료일" name="endDate" type="date" min={form.startDate || undefined} required={!ongoing} disabled={ongoing} value={form.endDate ?? ''} onChange={e => change('endDate', e.target.value)} /></div></div>
      </div>
    </div>
    <div className="project-editor-section"><div className="project-section-head"><span><LucideIcon name="fileText" /></span><h2>프로젝트 설명</h2><p>프로젝트에 대해 자세히 설명해 주세요.</p></div>
      <div className="project-fields-grid">
        <label>프로젝트 설명 *<textarea required name="description" maxLength={2000} rows={5} value={form.description ?? ''} placeholder="프로젝트를 자세히 설명해 주세요. 어떤 서비스를 만들었는지, 어떤 문제를 가지고 있는지 자유롭게 작성해 주세요." onChange={e => change('description', e.target.value)} /></label>
        <label>해결하려는 문제 / 기획 배경<textarea name="problemSolving" maxLength={1000} rows={5} value={form.problemSolving ?? ''} placeholder="이 프로젝트를 진행한 동기 배경과 해결하고자 했던 문제를 설명해 주세요." onChange={e => change('problemSolving', e.target.value)} /></label>
        {textList('featureItems', '주요 기능 *', '프로젝트의 주요 기능을 작성해 주세요.', 2000)}
        {textList('achievementItems', '성과 / 배운 점', '프로젝트를 통해 어떤 성과를 얻었고, 어떤 점을 배웠는지 작성해 주세요.', 2000)}
      </div>
    </div>
    <div className="project-editor-section"><div className="project-section-head"><span><LucideIcon name="monitor" /></span><h2>사용 기술</h2><p>사용한 기술 스택과 활용 내용을 작성해 주세요.</p></div>
      <ProjectSkillPicker selected={selected} onChange={setSelected} customSkills={form.customSkills}
        onCustomSkillsChange={value => setForm(current => ({ ...current, customSkills: value }))} disabled={busy} />
      {(selected.length > 0 || form.customSkills.length > 0) && <div className="project-skill-usage-list">
        {selected.map(skill => <div className="project-skill-usage" key={skill.id}><strong>{skill.name}</strong>
          <div className="project-skill-usage-content"><div className="project-skill-usage-head">
            <label htmlFor={`project-skill-usage-${skill.id}`}>프로젝트에서 활용한 내용 (선택)</label>
            <button type="button" aria-label={`${skill.name} 기술 삭제`} title={`${skill.name} 기술 삭제`} onClick={() => {
              setSelected(selected.filter(item => item.id !== skill.id));
              setForm(current => ({ ...current, skillUsages: current.skillUsages.filter(item => item.skillId !== skill.id) }));
            }}><LucideIcon name="close" /></button>
          </div>
            <textarea id={`project-skill-usage-${skill.id}`} rows={2} maxLength={1000} value={form.skillUsages.find(item => item.skillId === skill.id)?.usage ?? ''} placeholder="이 기술을 선택한 이유와 프로젝트에서 어떻게 활용했는지 작성해 주세요." onChange={e => setForm(current => ({ ...current, skillUsages: [...current.skillUsages.filter(item => item.skillId !== skill.id), { skillId: skill.id, usage: e.target.value || null }] }))} />
          </div>
        </div>)}
        {form.customSkills.map((skill, index) => <div className="project-skill-usage" key={skill.name}><strong>{skill.name}</strong>
          <div className="project-skill-usage-content"><div className="project-skill-usage-head">
            <label htmlFor={`project-custom-skill-usage-${index}`}>프로젝트에서 활용한 내용 (선택)</label>
            <button type="button" aria-label={`${skill.name} 기술 삭제`} title={`${skill.name} 기술 삭제`} onClick={() => setForm(current => ({ ...current, customSkills: current.customSkills.filter(item => item.name !== skill.name) }))}><LucideIcon name="close" /></button>
          </div>
            <textarea id={`project-custom-skill-usage-${index}`} rows={2} maxLength={1000} value={skill.usage ?? ''} placeholder="이 기술을 선택한 이유와 프로젝트에서 어떻게 활용했는지 작성해 주세요."
              onChange={event => setForm(current => ({ ...current, customSkills: current.customSkills.map(item => item.name === skill.name ? { ...item, usage: event.target.value || null } : item) }))} />
          </div>
        </div>)}
      </div>}
    </div>
    <div className="project-editor-section"><div className="project-section-head"><span><LucideIcon name="link" /></span><h2>링크 및 파일</h2><p>프로젝트와 관련된 링크와 파일을 첨부해 주세요.</p></div>
      <div className="project-fields-grid">
        <label>프로젝트 URL<input name="projectUrl" type="url" maxLength={2000} placeholder="배포 URL을 입력해 주세요." value={form.projectUrl ?? ''} onChange={e => change('projectUrl', e.target.value)} /></label>
        <label>시연 영상 URL<input name="demoUrl" type="url" maxLength={2000} placeholder="유튜브 링크를 입력해 주세요." value={form.demoUrl ?? ''} onChange={e => change('demoUrl', e.target.value)} /></label>
        <label>GitHub URL<input name="githubUrl" type="url" maxLength={2000} placeholder="GitHub 저장소 URL을 입력해 주세요." value={form.githubUrl ?? ''} onChange={e => change('githubUrl', e.target.value)} /></label>
        <label>발표 자료 / 문서 URL<input name="presentationUrl" type="url" maxLength={2000} placeholder="발표 자료나 문서 링크를 입력해 주세요." value={form.presentationUrl ?? ''} onChange={e => change('presentationUrl', e.target.value)} /></label>
      </div>
      <div className="project-upload-grid">
        {(['THUMBNAIL', 'ADDITIONAL'] as const).map(kind => <label className="project-upload-box" key={kind}>
          {kind === 'THUMBNAIL' ? '프로젝트 썸네일' : '추가 이미지 (스크린샷)'}
          <span>＋ {kind === 'THUMBNAIL' ? '썸네일 업로드' : '이미지 추가하기'}</span>
          <small>JPG, PNG 파일당 최대 5MB{kind === 'ADDITIONAL' ? ' · 최대 2장' : ''}</small>
          <input type="file" accept="image/jpeg,image/png" disabled={busy || !storageAvailable || images.filter(item => item.kind === kind).length + uploadFiles.filter(item => item.kind === kind).length >= (kind === 'THUMBNAIL' ? 1 : 2)}
            onChange={e => { const file = e.target.files?.[0]; if (file && file.size <= 5 * 1024 * 1024 && ['image/jpeg', 'image/png'].includes(file.type)) setUploadFiles(current => [...current, { kind, file }]); e.target.value = ''; }} />
          {images.filter(item => item.kind === kind).map(item => <small key={item.id}>{item.fileName} <button type="button" disabled={busy} onClick={event => { event.preventDefault(); void removeImage(item.id); }} aria-label={`${item.fileName} 삭제`}>×</button></small>)}
          {uploadFiles.filter(item => item.kind === kind).map((item, index) => <small key={`${item.file.name}-${index}`}>{item.file.name} <button type="button" disabled={busy} onClick={event => { event.preventDefault(); setUploadFiles(current => current.filter(entry => entry !== item)); }} aria-label={`${item.file.name} 선택 취소`}>×</button></small>)}
        </label>)}
      </div>
      {!storageAvailable && <p className="project-upload-note">S3 버킷이 아직 연결되지 않아 이미지 업로드를 사용할 수 없습니다. 프로젝트 내용은 저장할 수 있습니다.</p>}
    </div>
    <div className="project-editor-section"><div className="project-section-head"><span><LucideIcon name="chartBar" /></span><h2>프로젝트의 강조 정보</h2><p>프로젝트의 결과와 기여도를 자세히 작성해 주세요.</p></div>
      <div className="project-fields-grid">
        <div className="project-contribution-list"><span>담당 기능별 기여도</span>{(form.contributionItems.length ? form.contributionItems : [{ responsibility: '', percent: 70 }]).map((item, index) =>
          <div className="project-contribution-item" key={index}>
            <span className="project-contribution"><input aria-label={`담당 기능 ${index + 1} 기여도`} type="range" min={0} max={100} value={item.percent} onChange={e => setForm(current => { const next = [...(current.contributionItems.length ? current.contributionItems : [{ responsibility: '', percent: 70 }])]; next[index] = { ...next[index], percent: Number(e.target.value) }; return { ...current, contributionItems: next }; })} /><output>{item.percent}%</output></span>
            {form.contributionItems.length > 1 && <button type="button" onClick={() => setForm(current => ({ ...current, contributionItems: current.contributionItems.filter((_, i) => i !== index) }))} aria-label={`담당 기능 ${index + 1} 삭제`}><LucideIcon name="close" /></button>}
            <input aria-label={`담당 기능 ${index + 1}`} maxLength={1000} value={item.responsibility} placeholder="담당 기능이나 업무를 입력해 주세요." onChange={e => setForm(current => { const next = [...(current.contributionItems.length ? current.contributionItems : [{ responsibility: '', percent: 70 }])]; next[index] = { ...next[index], responsibility: e.target.value }; return { ...current, contributionItems: next }; })} /></div>)}
          <button className="project-dashed-add" type="button" disabled={form.contributionItems.length >= 10} onClick={() => setForm(current => ({ ...current, contributionItems: [...(current.contributionItems.length ? current.contributionItems : [{ responsibility: '', percent: 70 }]), { responsibility: '', percent: 70 }] }))}>＋ 추가하기</button></div>
        {textList('troubleshootingItems', '트러블슈팅 / 개선 경험', '개발 과정에서 겪었던 문제와 이를 어떻게 해결했는지 작성해 주세요.', 1000)}
        {textList('metricItems', '성능 개선 또는 결과 지표', '프로젝트를 통해 얻은 정량적인 성과를 작성해 주세요.', 1000)}
      </div>
    </div>
  </>;
}

function ProjectSkillPicker({ selected, onChange, customSkills, onCustomSkillsChange, disabled }: {
  selected: Skill[]; onChange: (value: Skill[]) => void;
  customSkills: ProjectInput['customSkills']; onCustomSkillsChange: (value: ProjectInput['customSkills']) => void; disabled: boolean;
}) {
  const [query, setQuery] = useState(''); const [searched, setSearched] = useState('');
  const [result, setResult] = useState<SkillPage>();
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearched(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setResult(undefined);
    if (!searched) { setLoading(false); setResult(undefined); return () => controller.abort(); }
    skills.search(searched, 0, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(error => { if (!controller.signal.aborted) setError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [searched]);
  return <section aria-labelledby="project-skills-title" className="project-skills">
    <h3 id="project-skills-title">사용 기술</h3>
    <div className="project-skill-controls">
      <div className="project-skill-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <LucideIcon name="search" />
        <input aria-label="기술 스택 검색" aria-autocomplete="list" aria-expanded={open && !!query.trim()} aria-controls="project-skill-suggestions"
          placeholder="사용한 기술 스택 검색(예: React, Spring, ...)" maxLength={100} value={query} disabled={disabled}
          onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }} />
        {open && query.trim() && <div className="project-skill-suggestions" id="project-skill-suggestions">
          {query.trim() !== searched || loading ? <p role="status">검색 중...</p> : error ? <p role="alert">{error}</p>
            : result && (result.items.length ? <ul aria-label="프로젝트 기술 검색 결과">{result.items.map(skill => {
              const alreadySelected = selected.some(item => item.id === skill.id);
              return <li key={skill.id}><button type="button" disabled={disabled || alreadySelected} onClick={() => {
                onChange([...selected, skill]); setQuery(''); setOpen(false);
              }}><span>{skill.name}</span>{alreadySelected && <small>선택됨</small>}</button></li>;
            })}</ul> : <div className="project-skill-custom-add"><p>검색 결과가 없습니다.</p>
              <button type="button" disabled={disabled || customSkills.length >= 20
                || customSkills.some(skill => skill.name.normalize('NFKC').trim().toLowerCase() === query.normalize('NFKC').trim().toLowerCase())}
                onClick={() => { onCustomSkillsChange([...customSkills, { name: query.trim(), usage: null }]); setQuery(''); setOpen(false); }}>
                “{query.trim()}” 직접 추가</button></div>)}
        </div>}
      </div>
      <div className="project-selected-summary"><span>선택한 기술 ({selected.length + customSkills.length}개)</span>
        {selected.length + customSkills.length === 0 ? <div className="project-selected-empty">
          <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" focusable="false"><rect x="5" y="8" width="26" height="21" rx="3" /><path d="M5 14h26M13 19l-3 3 3 3m10-6 3 3-3 3m-5-6-2 7" /></svg>
          <strong>선택한 기술이 없습니다.</strong>
          <p>왼쪽 검색창에서 프로젝트에 사용한 기술을<br />추가해 주세요.</p>
        </div> : <ul className="project-selected" aria-label="선택한 프로젝트 기술">{selected.map(skill => <li key={skill.id}>
          <button className="project-selected-chip" type="button" disabled={disabled} onClick={() => onChange(selected.filter(item => item.id !== skill.id))} aria-label={`${skill.name} 선택 해제`}>
            {skill.name}<LucideIcon name="close" /></button></li>)}
          {customSkills.map(skill => <li key={skill.name}><button className="project-selected-chip" type="button" disabled={disabled}
            onClick={() => onCustomSkillsChange(customSkills.filter(item => item.name !== skill.name))} aria-label={`${skill.name} 선택 해제`}>
            {skill.name}<LucideIcon name="close" /></button></li>)}</ul>}</div>
    </div>
  </section>;
}
