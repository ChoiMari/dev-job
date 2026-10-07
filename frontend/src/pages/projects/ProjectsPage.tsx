import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createProjectsApi, projectLink } from '../../api/projects';
import type { Project, ProjectInput, ProjectPage } from '../../api/projects';
import { createSkillsApi } from '../../api/skills';
import type { Skill, SkillPage } from '../../api/skills';
import { Badge } from '../../components/PixelArt';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import './projects.css';
import projectFolderArt from '../../assets/illustrations/project-folder.png';

const projects = createProjectsApi(apiRequest);
const skills = createSkillsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '프로젝트를 처리하지 못했습니다.';
const blank: ProjectInput = { name: '', description: null, startDate: '', endDate: null, role: null,
  keyFeatures: null, outcome: null, projectUrl: null, skillIds: [] };

export function ProjectsPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/projects') return <ProjectList />;
  if (path === '/projects/new') return <ProjectEditor />;
  const match = /^\/projects\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? <ProjectEditor id={id} /> : <section className="card">
    <EmptyState title="프로젝트 주소를 확인해 주세요." /><a className="button-link" href="#/projects">프로젝트 목록으로</a>
  </section>;
}

function ProjectList() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ProjectPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setResult(undefined);
    projects.list(page, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(error => { if (!controller.signal.aborted) setError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  return <section className="card projects-page">
    <div className="project-intro"><div><h2>프로젝트 관리</h2><p>프로젝트에서 사용한 기술과 역할, 성과를 기록하세요.</p></div><img src={projectFolderArt} alt="" aria-hidden="true" width="96" height="96" /></div>
    <div className="project-actions"><Badge tone="primary" icon="grid">나의 경험</Badge><a className="button-link button-primary" href="#/projects/new">프로젝트 추가</a></div>
    {loading || (!!result && result.page !== page) ? <LoadingState message="프로젝트를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
      : result && <>
        {result.items.length === 0 ? <EmptyState title={page === 0 ? '등록한 프로젝트가 없습니다.' : '이 페이지에 프로젝트가 없습니다.'}
          message="프로젝트 추가 버튼으로 첫 경험을 기록해 보세요." /> : <ul className="project-list" aria-label="내 프로젝트 목록">
          {result.items.map(item => <li key={item.id}><h2><a href={`#/projects/${item.id}`}>{item.name}</a></h2>
            <p>{item.startDate} ~ {item.endDate ?? '진행 중'}{item.role && ` · ${item.role}`}</p>
            {item.description && <p className="project-text">{item.description}</p>}
            <div className="project-badges">{item.skills.map(skill => <Badge key={skill.id} tone="success" icon="check">{skill.name}</Badge>)}</div>
          </li>)}
        </ul>}
        <div className="project-actions"><button disabled={page === 0} onClick={() => setPage(v => v - 1)}>이전</button>
          <span role="status">총 {result.totalElements}건 · {page + 1}페이지</span>
          <button disabled={(page + 1) * result.size >= result.totalElements} onClick={() => setPage(v => v + 1)}>다음</button></div>
      </>}
  </section>;
}

function ProjectEditor({ id }: { id?: number }) {
  const [project, setProject] = useState<Project>();
  const [form, setForm] = useState<ProjectInput>(blank);
  const [selected, setSelected] = useState<Skill[]>([]);
  const [editing, setEditing] = useState(!id);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [loadStatus, setLoadStatus] = useState(0);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function accept(value: Project) {
    const { id: _id, skills: selectedSkills, ...fields } = value;
    setProject(value); setSelected(selectedSkills); setForm({ ...fields, skillIds: selectedSkills.map(skill => skill.id) });
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
      const input = { ...form, name: form.name.trim(), skillIds: selected.map(skill => skill.id) };
      const value = id ? await projects.update(id, input) : await projects.create(input);
      if (!mounted.current) return;
      if (!id) window.location.hash = `/projects/${value.id}`;
      else { accept(value); setEditing(false); setSuccess('프로젝트를 저장했습니다.'); }
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
  function change(key: keyof ProjectInput, value: string) {
    setForm(current => ({ ...current, [key]: key === 'name' || key === 'startDate' ? value : value || null })); setError('');
  }
  return <section className="card projects-page">
    <a className="button-link" href="#/projects">← 프로젝트 목록</a>
    <div className="project-intro"><h2>{id ? '프로젝트 상세' : '새 프로젝트'}</h2><img src={projectFolderArt} alt="" aria-hidden="true" width="96" height="96" /></div>
    {loading ? <LoadingState message="프로젝트를 불러오고 있습니다." /> : loadError
      ? loadStatus === 404 || loadStatus === 403 ? <EmptyState title={loadStatus === 404 ? '프로젝트를 찾을 수 없습니다.' : '접근 권한이 없습니다.'} message={loadError} />
        : <ErrorState message={loadError} onRetry={() => setRetry(v => v + 1)} />
      : <>
        {success && <SuccessState title={success} compact />}
        {error && <p role="alert" className="form-error">{error}</p>}
        {editing ? <form className="project-form" onSubmit={save}>
          <h2>{id ? '프로젝트 수정' : '프로젝트 등록'}</h2>
          <fieldset disabled={busy}>
            <label>프로젝트명 *<input name="name" required maxLength={100} value={form.name} onChange={e => change('name', e.target.value)} /></label>
            <div className="project-grid">
              <label>시작일 *<input name="startDate" type="date" required value={form.startDate} onChange={e => change('startDate', e.target.value)} /></label>
              <label>종료일<input name="endDate" type="date" min={form.startDate || undefined} value={form.endDate ?? ''} onChange={e => change('endDate', e.target.value)} /></label>
            </div>
            <p>종료일이 없으면 진행 중으로 표시합니다.</p>
            <label>역할<input name="role" maxLength={100} value={form.role ?? ''} onChange={e => change('role', e.target.value)} /></label>
            {([['description', '프로젝트 설명'], ['keyFeatures', '주요 기능'], ['outcome', '성과']] as const).map(([key, label]) =>
              <label key={key}>{label}<textarea name={key} maxLength={2000} rows={3} value={form[key] ?? ''} onChange={e => change(key, e.target.value)} /></label>)}
            <label>프로젝트 URL<input name="projectUrl" type="url" maxLength={2000} placeholder="https://github.com/..." value={form.projectUrl ?? ''} onChange={e => change('projectUrl', e.target.value)} /></label>
            <ProjectSkillPicker selected={selected} onChange={setSelected} disabled={busy} />
          </fieldset>
          <div className="project-actions"><button className="button-primary" type="submit" disabled={busy}>{busy ? '저장 중…' : '프로젝트 저장'}</button>
            {id && <button type="button" disabled={busy} onClick={() => { if (project) accept(project); setEditing(false); setError(''); }}>수정 취소</button>}</div>
        </form> : project && <>
          <h2>{project.name}</h2><p>{project.startDate} ~ {project.endDate ?? '진행 중'}</p>
          <dl className="project-detail">{([['role', '역할'], ['description', '프로젝트 설명'], ['keyFeatures', '주요 기능'], ['outcome', '성과']] as const).map(([key, label]) =>
            <div key={key}><dt>{label}</dt><dd className="project-text">{project[key] ?? '정보 없음'}</dd></div>)}
            <div><dt>사용 기술</dt><dd className="project-badges">{project.skills.length ? project.skills.map(skill => <Badge key={skill.id} tone="success" icon="check">{skill.name}</Badge>) : '등록한 기술 없음'}</dd></div>
          </dl>
          {projectLink(project.projectUrl) && <a className="button-link" href={projectLink(project.projectUrl)} target="_blank" rel="noopener noreferrer">프로젝트 URL 보기 (새 창)</a>}
          <div className="project-actions"><button disabled={busy} onClick={() => { setEditing(true); setConfirmDelete(false); setSuccess(''); setError(''); }}>프로젝트 수정</button>
            <button disabled={busy} onClick={() => setConfirmDelete(true)}>프로젝트 삭제</button></div>
          {confirmDelete && <div className="project-delete" role="group" aria-label="프로젝트 삭제 확인"><p>“{project.name}” 프로젝트와 연결된 기술을 삭제할까요?</p>
            <div className="project-actions"><button disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중…' : '삭제 확인'}</button>
              <button disabled={busy} onClick={() => setConfirmDelete(false)}>삭제 취소</button></div></div>}
        </>}
      </>}
  </section>;
}

function ProjectSkillPicker({ selected, onChange, disabled }: { selected: Skill[]; onChange: (value: Skill[]) => void; disabled: boolean }) {
  const [query, setQuery] = useState(''); const [searched, setSearched] = useState('');
  const [page, setPage] = useState(0); const [result, setResult] = useState<SkillPage>();
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setResult(undefined);
    skills.search(searched, page, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(error => { if (!controller.signal.aborted) setError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [searched, page, retry]);
  return <section aria-labelledby="project-skills-title" className="project-skills">
    <h3 id="project-skills-title">사용 기술</h3><p>표준 기술이나 별칭으로 검색해 선택하세요. 보유 기술 목록과 독립적으로 저장됩니다.</p>
    <ul className="project-selected" aria-label="선택한 프로젝트 기술">{selected.map(skill => <li key={skill.id}>
      <Badge tone="success" icon="check">{skill.name}</Badge><button type="button" disabled={disabled} onClick={() => onChange(selected.filter(item => item.id !== skill.id))} aria-label={`${skill.name} 선택 해제`}>해제</button></li>)}</ul>
    <label>기술명 또는 별칭<input maxLength={100} value={query} onChange={e => setQuery(e.target.value)} /></label>
    <button type="button" disabled={disabled || loading} onClick={() => { setSearched(query.trim()); setPage(0); setRetry(v => v + 1); }}>기술 검색</button>
    {loading ? <LoadingState message="표준 기술을 검색하고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
      : result && <><ul className="project-skill-results" aria-label="프로젝트 기술 검색 결과">{result.items.map(skill => <li key={skill.id}>
        <span>{skill.name}</span><button type="button" disabled={disabled || selected.some(item => item.id === skill.id)} onClick={() => onChange([...selected, skill])} aria-label={`${skill.name} 선택`}>{selected.some(item => item.id === skill.id) ? '선택됨' : '선택'}</button></li>)}</ul>
        {!result.items.length && <p>검색 결과가 없습니다. 기술 없이도 프로젝트를 저장할 수 있습니다.</p>}
        <div className="project-actions"><button type="button" disabled={disabled || page === 0} onClick={() => setPage(v => v - 1)}>기술 이전</button>
          <span>{page + 1}페이지</span><button type="button" disabled={disabled || (page + 1) * result.size >= result.totalElements} onClick={() => setPage(v => v + 1)}>기술 다음</button></div>
      </>}
  </section>;
}
