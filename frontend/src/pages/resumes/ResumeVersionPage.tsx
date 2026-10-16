import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createDocumentApi } from '../../api/documents';
import type { DocumentAnalysis, DocumentSummary, DocumentVersion } from '../../api/documents';
import { LucideIcon } from '../../components/LucideIcon';
import { resumeText } from './ResumeCreatePage';
import type { Template } from './ResumeCreatePage';
import './resume-workspace.css';
import './resume-version-page.css';

const api = createDocumentApi(apiRequest, 'RESUME');
const message = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
export const validForm = (value: unknown): value is Template => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const form = value as Partial<Template>;
  return typeof form.name === 'string' && typeof form.email === 'string' && typeof form.desiredRole === 'string'
    && Array.isArray(form.education) && Array.isArray(form.skills) && Array.isArray(form.projects)
    && Array.isArray(form.experience) && Array.isArray(form.certificates) && Array.isArray(form.training)
    && Array.isArray(form.links);
};

export function ResumeVersionPage({ resumeId, versionId }: { resumeId: number; versionId: number }) {
  const [resume, setResume] = useState<DocumentSummary>();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [version, setVersion] = useState<DocumentVersion>();
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(window.location.hash.includes('?edit=1'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [form, setForm] = useState<Template>();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [analysisReset, setAnalysisReset] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([api.get(resumeId, controller.signal), api.versions(resumeId, controller.signal), api.version(resumeId, versionId, controller.signal)])
      .then(([resumeValue, versionList, detail]) => {
        if (controller.signal.aborted) return;
        setResume(resumeValue); setVersions(versionList); setVersion(detail);
        setTitle((detail.title ?? resumeValue.title).slice(0, 50)); setDescription(detail.description ?? ''); setContent(detail.content ?? '');
        setForm(validForm(detail.form) ? detail.form : undefined);
      })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    api.analysis({ documentType: 'RESUME', documentId: resumeId, versionId }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setAnalysis(value); })
      .catch(failure => { if (!controller.signal.aborted && !(failure instanceof ApiError && failure.status === 404)) setError(message(failure)); });
    return () => controller.abort();
  }, [resumeId, versionId, reload]);

  const save = async () => {
    if (!version || busy || !title.trim()) return;
    if (form && (!form.name.trim() || !form.email.trim() || !form.desiredRole.trim())) {
      setError('양식의 이름, 이메일, 희망 직무를 입력해 주세요.'); return;
    }
    const nextContent = form ? resumeText(form) : content.trim();
    if (!nextContent) { setError('이력서 원문을 입력해 주세요.'); return; }
    if (nextContent.length > 100000 || new TextEncoder().encode(nextContent).length > 262144) {
      setError('이력서 원문은 100,000자와 256KB 이내로 작성해 주세요.'); return;
    }
    if (!window.confirm(analysis
      ? '수정 시 기존 분석 결과와 공고 비교 결과가 초기화됩니다. 계속할까요?'
      : '수정 시 연결된 공고 비교 결과가 초기화될 수 있습니다. 계속할까요?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.editVersion(resumeId, versionId, nextContent, { title: title.trim(), description: description.trim(), ...(form ? { form } : {}) });
      setAnalysisReset(!!analysis); setAnalysis(null); setEditing(false); setNotice('버전을 수정했습니다.'); setReload(value => value + 1);
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (versions.length <= 1 || busy || !window.confirm('이 버전과 연결된 분석 결과 및 공고 비교 결과를 삭제할까요? 삭제 후 복구할 수 없습니다.')) return;
    setBusy(true); setError('');
    try { await api.removeVersion(resumeId, versionId); window.location.hash = `/resumes/${resumeId}`; }
    catch (failure) { setError(message(failure)); setBusy(false); }
  };
  const analyze = async () => {
    if (!consent || busy) return;
    setBusy(true); setError('');
    try {
      const result = await api.analyze({ documentType: 'RESUME', documentId: resumeId, versionId });
      setAnalysis(result); setAnalysisReset(false); setConsent(false); setNotice('분석을 요청했습니다.');
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  };

  return <div className="resume-workspace resume-version-page">
    <a className="resume-version-back-link" href={`#/resumes/${resumeId}`} aria-label="이력서 상세로 돌아가기" title="이력서 상세로 돌아가기"><LucideIcon name="arrowLeft" /></a>
    {loading ? <p>버전을 불러오는 중입니다.</p> : !version || !resume ? <p role="alert">{error || '버전을 찾을 수 없습니다.'} <button type="button" onClick={() => setReload(value => value + 1)}>다시 시도</button></p> : <>
      <header className="resume-version-page-heading"><div><p>{resume.title} · V{version.versionNumber}</p><h1>{editing ? '버전 수정' : version.title || resume.title}</h1><small>작성일 {new Date(version.createdAt).toLocaleDateString('ko-KR')}</small></div><div className="resume-version-page-actions">{!editing && <a href={`#/resumes/${resumeId}/versions/${versionId}/edit`}><LucideIcon name="pencil" /> 수정</a>}<button type="button" className="is-danger" disabled={busy || versions.length <= 1} title={versions.length <= 1 ? '마지막 버전은 삭제할 수 없습니다.' : undefined} onClick={() => void remove()}><LucideIcon name="trash" /> 삭제</button></div></header>
      {editing ? <section className="resume-version-page-card"><label className="resume-version-page-label">버전 제목<input value={title} onChange={event => setTitle(event.target.value)} maxLength={50} required /></label><label className="resume-version-page-label">버전 설명<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={200} rows={2} /></label>{form ? <ResumeTemplateDetails form={form} onChange={setForm} /> : <label className="resume-version-page-label">이력서 원문<textarea value={content} onChange={event => setContent(event.target.value)} maxLength={100000} rows={18} /></label>}<div className="resume-version-page-edit-actions"><button type="button" onClick={() => { setEditing(false); setTitle((version.title ?? resume.title).slice(0, 50)); setDescription(version.description ?? ''); setContent(version.content ?? ''); setForm(validForm(version.form) ? version.form : undefined); }}>취소</button><button type="button" className="resume-primary" disabled={busy || !title.trim()} onClick={() => void save()}>{busy ? '저장 중…' : '저장'}</button></div></section>
        : <><section className="resume-version-page-card">{version.description && <p className="resume-version-page-description">{version.description}</p>}{form ? <ResumeTemplateDetails form={form} /> : <LegacyTemplateDetails content={version.content ?? ''} />}</section><section className="resume-version-page-card resume-version-page-analysis"><h2>AI 분석 결과</h2>{analysis ? <p>상태: {analysis.status === 'COMPLETED' ? '분석 완료' : analysis.status === 'PENDING' ? '분석 중' : '분석 실패'}</p> : <p>{analysisReset ? '수정으로 기존 분석 결과가 초기화되었습니다.' : '저장된 분석 결과가 없습니다.'}</p>}{analysis?.status === 'COMPLETED' && analysis.result && <div className="resume-version-page-analysis-results"><div><strong>기술</strong><ul>{analysis.result.skills.map((item, index) => <li key={index}>{item}</li>)}</ul></div><div><strong>강점</strong><ul>{analysis.result.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></div><div><strong>개선 제안</strong><ul>{analysis.result.improvements.map((item, index) => <li key={index}>{item}</li>)}</ul></div></div>}{analysis?.status !== 'PENDING' && analysis?.status !== 'COMPLETED' && <div className="resume-version-page-reanalyze"><label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> 원문을 외부 AI 서비스에 전송하는 데 동의합니다.</label><button type="button" className="resume-primary" disabled={!consent || busy} onClick={() => void analyze()}>{analysisReset ? '다시 분석하기' : analysis?.status === 'FAILED' ? '분석 재시도' : '분석 요청'}</button></div>}</section></>}
      {error && <p className="resume-message is-error" role="alert">{error}</p>}{notice && <p className="resume-message" role="status">{notice}</p>}
    </>}
  </div>;
}

const legacyHeadings = new Set(['기본 정보', '희망 직무', '학력', '기술 스택', '프로젝트', '경력 / 인턴', '자격증 / 수상', '교육', '기타']);
function LegacyTemplateDetails({ content }: { content: string }) {
  const blocks: Array<{ title: string; lines: string[] }> = [];
  for (const line of content.split('\n')) {
    if (legacyHeadings.has(line.trim())) blocks.push({ title: line.trim(), lines: [] });
    else if (blocks.length) blocks.at(-1)!.lines.push(line);
  }
  if (!blocks.length || blocks[0].title !== '기본 정보') return <pre className="resume-version-page-source">{content}</pre>;
  return <div className="resume-version-template">{blocks.map((block, index) => <section className="resume-version-template-section" key={`${block.title}-${index}`}><h2>{block.title}</h2><pre className="resume-version-page-source">{block.lines.join('\n').trim()}</pre></section>)}</div>;
}

export function ResumeTemplateDetails({ form, onChange }: { form: Template; onChange?: (form: Template) => void }) {
  const editing = !!onChange;
  const [skillsText, setSkillsText] = useState(form.skills.join(', '));
  const set = <K extends keyof Template>(key: K, value: Template[K]) => onChange?.({ ...form, [key]: value });
  const field = (label: string, key: keyof Template, multiline = false) => {
    const value = String(form[key] ?? '');
    return <label key={key} className="resume-version-page-label">{label}{editing ? multiline
      ? <textarea value={value} onChange={event => set(key, event.target.value as never)} rows={3} />
      : <input value={value} onChange={event => set(key, event.target.value as never)} /> : <span>{value || '—'}</span>}</label>;
  };
  const group = <K extends 'education' | 'projects' | 'experience' | 'certificates' | 'training'>(key: K, heading: string, fields: Array<[string, string, boolean?]>, blank: Template[K][number]) => <section className="resume-version-template-section" key={key}><h2>{heading}</h2>{form[key].map((entry, index) => <div className="resume-version-template-entry" key={index}><strong>{heading} {index + 1}</strong>{fields.map(([label, property, multiline]) => {
    const value = entry[property as keyof typeof entry];
    return <label className="resume-version-page-label" key={property}>{label}{editing && property === 'current'
      ? <input type="checkbox" checked={Boolean(value)} onChange={event => set(key, form[key].map((item, position) => position === index ? { ...item, current: event.target.checked } : item) as Template[K])} />
      : editing ? multiline
      ? <textarea value={String(value ?? '')} onChange={event => set(key, form[key].map((item, position) => position === index ? { ...item, [property]: event.target.value } : item) as Template[K])} rows={3} />
      : <input value={typeof value === 'boolean' ? String(value) : String(value ?? '')} onChange={event => set(key, form[key].map((item, position) => position === index ? { ...item, [property]: property === 'current' ? event.target.value === 'true' : event.target.value } : item) as Template[K])} />
      : <span>{typeof value === 'boolean' ? value ? '예' : '아니요' : String(value || '—')}</span>}</label>;
  })}{editing && <button type="button" className="resume-version-template-remove" onClick={() => set(key, form[key].filter((_, position) => position !== index) as Template[K])}>이 항목 삭제</button>}</div>)}{editing && <button type="button" className="resume-version-template-add" onClick={() => set(key, [...form[key], blank] as Template[K])}>+ {heading} 추가</button>}</section>;
  return <div className="resume-version-template"><section className="resume-version-template-section"><h2>기본 정보</h2><div className="resume-version-template-grid">{field('이름', 'name')}{field('연락처', 'phone')}{field('이메일', 'email')}{field('생년월일', 'birth')}</div>{field('한 줄 소개', 'introduction')}</section><section className="resume-version-template-section"><h2>희망 직무</h2><div className="resume-version-template-grid">{field('희망 직무', 'desiredRole')}{field('희망 근무 지역', 'location')}{field('고용 형태', 'employment')}</div></section>
    {group('education', '학력', [['학교명', 'school'], ['전공', 'major'], ['학위', 'degree'], ['입학', 'start'], ['졸업', 'end']], { school: '', major: '', degree: '', start: '', end: '' })}
    <section className="resume-version-template-section"><h2>기술 스택</h2>{editing ? <label className="resume-version-page-label">기술명 (쉼표로 구분)<input value={skillsText} onChange={event => setSkillsText(event.target.value)} onBlur={() => set('skills', skillsText.split(',').map(item => item.trim()).filter(Boolean))} /></label> : <div className="resume-version-template-tags">{form.skills.length ? form.skills.map((item, index) => <span key={index}>{item}</span>) : '—'}</div>}</section>
    {group('projects', '프로젝트', [['프로젝트명', 'name'], ['시작', 'start'], ['종료', 'end'], ['설명', 'description', true], ['역할', 'role'], ['기술', 'skills'], ['주요 작업', 'work', true]], { name: '', start: '', end: '', description: '', role: '', skills: '', work: '' })}
    {group('experience', '경력 / 인턴', [['회사명', 'company'], ['시작', 'start'], ['종료', 'end'], ['재직 중', 'current'], ['직무', 'role'], ['주요 업무', 'work', true]], { company: '', start: '', end: '', current: false, role: '', work: '' })}
    {group('certificates', '자격증 / 수상', [['명칭', 'name'], ['취득 / 수상일', 'date'], ['발급 기관', 'issuer']], { name: '', date: '', issuer: '' })}
    {group('training', '교육', [['교육명', 'name'], ['교육기관', 'provider'], ['시작', 'start'], ['종료', 'end'], ['이수 내용', 'content', true]], { name: '', provider: '', start: '', end: '', content: '' })}
    <section className="resume-version-template-section"><h2>기타 사항</h2>{field('포트폴리오 / 링크', 'link')}{field('기술 블로그', 'blog')}{editing ? <label className="resume-version-page-label">추가 링크 (줄바꿈으로 구분)<textarea value={form.links.join('\n')} onChange={event => set('links', event.target.value.split('\n'))} rows={3} /></label> : form.links.map((link, index) => <p key={index}>{link}</p>)}{field('기타 어필 사항', 'extra', true)}</section>
  </div>;
}
