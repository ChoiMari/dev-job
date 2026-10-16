import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import MDEditor from '@uiw/react-md-editor/nohighlight';
import * as editorCommands from '@uiw/react-md-editor/commands';
import rehypeSanitize from 'rehype-sanitize';
import { apiRequest, profileApi } from '../../api';
import { ApiError } from '../../api/client';
import { createDocumentApi } from '../../api/documents';
import { createResumeDraftApi } from '../../api/resume-draft';
import { createCharacterApi } from '../../api/character';
import type { CharacterState } from '../../api/character';
import { createProjectsApi } from '../../api/projects';
import type { Project as SavedProject } from '../../api/projects';
import { createSkillsApi } from '../../api/skills';
import { LucideIcon } from '../../components/LucideIcon';
import { characterAppearanceUrl } from '../../components/CharacterLayers';
import { PixelIcon } from '../../components/PixelArt';
import { ResumeGuideModal } from './ResumeEmptyState';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import './resume-workspace.css';
import './resume-create-form.css';

type Education = { school: string; major: string; degree: string; start: string; end: string };
type Project = { name: string; start: string; end: string; description: string; role: string; skills: string; work: string };
type Experience = { company: string; start: string; end: string; current: boolean; role: string; work: string };
type Certificate = { name: string; date: string; issuer: string };
type Training = { name: string; provider: string; start: string; end: string; content: string };
export type Template = {
  name: string; phone: string; email: string; birth: string; desiredRole: string; location: string;
  employment: string; introduction: string; education: Education[]; skills: string[];
  projects: Project[]; experience: Experience[]; certificates: Certificate[]; training: Training[];
  link: string; blog: string; links: string[]; extra: string;
};
type Draft = { version: 1; mode: 'free' | 'template'; title: string; content: string; form: Template };
type VersionDraft = Omit<Draft, 'version'> & { version: 2; purpose: 'version-new' | 'version-edit'; resumeId: number; versionId?: number; description: string };
type VersionEditor = { kind: 'new'; resumeId: number } | { kind: 'edit'; resumeId: number; versionId: number };
type NewVersionPlan = { sourceVersionId: number; title: string; description: string; mode: 'copy' | 'blank' };
type ErrorTarget = 'title' | 'content' | 'name' | 'email' | 'desiredRole' | 'general';
const documents = createDocumentApi(apiRequest, 'RESUME');
const drafts = createResumeDraftApi(apiRequest);
const characters = createCharacterApi(apiRequest);
const projectsApi = createProjectsApi(apiRequest);
const skillsApi = createSkillsApi(apiRequest);
const emptyEducation = (): Education => ({ school: '', major: '', degree: '', start: '', end: '' });
const emptyProject = (): Project => ({ name: '', start: '', end: '', description: '', role: '', skills: '', work: '' });
const emptyExperience = (): Experience => ({ company: '', start: '', end: '', current: false, role: '', work: '' });
const emptyCertificate = (): Certificate => ({ name: '', date: '', issuer: '' });
const emptyTraining = (): Training => ({ name: '', provider: '', start: '', end: '', content: '' });
const emptyTemplate = (): Template => ({
  name: '', phone: '', email: '', birth: '', desiredRole: '', location: '', employment: '',
  introduction: '', education: [emptyEducation()], skills: [], projects: [emptyProject()],
  experience: [emptyExperience()], certificates: [emptyCertificate()], training: [emptyTraining()], link: '', blog: '', links: [], extra: '',
});
const emptyDraft = (): Draft => ({ version: 1, mode: 'template', title: '', content: '', form: emptyTemplate() });
const saveableDraft = (draft: Draft): Draft => ({
  version: draft.version, mode: draft.mode, title: draft.title, content: draft.content, form: draft.form,
});
const unsupportedControl = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
const resumeEditorCommands = [
  editorCommands.title2, editorCommands.bold, editorCommands.italic, editorCommands.unorderedListCommand,
  editorCommands.orderedListCommand, editorCommands.link, editorCommands.quote,
];
function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<Draft>;
  return draft.version === 1 && (draft.mode === 'free' || draft.mode === 'template')
    && typeof draft.title === 'string' && typeof draft.content === 'string'
    && !!draft.form && Array.isArray(draft.form.education) && Array.isArray(draft.form.skills)
    && Array.isArray(draft.form.projects) && Array.isArray(draft.form.experience)
    && Array.isArray(draft.form.certificates)
    && (draft.form.training === undefined || Array.isArray(draft.form.training))
    && (draft.form.blog === undefined || typeof draft.form.blog === 'string')
    && (draft.form.links === undefined || (Array.isArray(draft.form.links) && draft.form.links.every(item => typeof item === 'string')));
}
const validTemplate = (value: unknown): value is Template => validDraft({ version: 1, mode: 'template', title: '', content: '', form: value })
  && typeof (value as Template).name === 'string' && typeof (value as Template).email === 'string'
  && typeof (value as Template).desiredRole === 'string';
function validVersionDraft(value: unknown): value is VersionDraft {
  if (!value || typeof value !== 'object') return false;
  const saved = value as Partial<VersionDraft>;
  return saved.version === 2 && validDraft({ ...saved, version: 1 })
    && (saved.purpose === 'version-new' || saved.purpose === 'version-edit')
    && Number.isSafeInteger(saved.resumeId) && (saved.resumeId ?? 0) > 0
    && (saved.purpose === 'version-new' ? saved.versionId === undefined : Number.isSafeInteger(saved.versionId) && (saved.versionId ?? 0) > 0)
    && typeof saved.description === 'string';
}
function validVersionPlan(value: unknown): value is NewVersionPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<NewVersionPlan>;
  return Number.isSafeInteger(plan.sourceVersionId) && (plan.sourceVersionId ?? 0) > 0
    && typeof plan.title === 'string' && !!plan.title.trim() && plan.title.length <= 50
    && typeof plan.description === 'string' && plan.description.length <= 200
    && (plan.mode === 'copy' || plan.mode === 'blank');
}
const valueOr = (current: string, incoming: string | null | undefined) => current.trim() ? current : incoming ?? '';
const lines = (text: string) => text.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
const filled = (values: Array<string | null | undefined>) => values.some(value => !!value?.trim());
const previewDetail = (...values: Array<string | false | undefined>) => values.filter(Boolean).join('\n');
const previewPeriod = (start: string, end: string) => [start, end].filter(Boolean).join(' ~ ');
export function resumeText(form: Template): string {
  const output: string[] = [];
  const block = (heading: string, values: string[]) => { if (values.length) output.push(heading, ...values, ''); };
  block('기본 정보', [
    form.name && `이름: ${form.name}`, form.phone && `연락처: ${form.phone}`,
    form.email && `이메일: ${form.email}`, form.birth && `생년월일: ${form.birth}`,
  ].filter(Boolean));
  block('희망 직무', [
    form.desiredRole && `직무: ${form.desiredRole}`, form.location && `희망 지역: ${form.location}`,
    form.employment && `고용 형태: ${form.employment}`, form.introduction && `한 줄 소개: ${form.introduction}`,
  ].filter(Boolean));
  block('학력', form.education.filter(item => filled([item.school, item.major, item.degree, item.start, item.end]))
    .flatMap(item => [[item.school, item.major, item.degree, [item.start, item.end].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '), '']));
  block('기술 스택', form.skills.map(item => `- ${item}`));
  block('프로젝트', form.projects.filter(item => filled([item.name, item.start, item.end, item.description, item.role, item.skills, item.work]))
    .flatMap(item => [
      [item.name, [item.start, item.end].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '),
      item.description && `설명: ${item.description}`, item.role && `역할: ${item.role}`,
      item.skills && `기술: ${item.skills}`, item.work && `주요 작업:\n${item.work}`, '',
    ].filter(Boolean)));
  block('경력 / 인턴', form.experience.filter(item => filled([item.company, item.start, item.end, item.current ? '재직 중' : '', item.role, item.work]))
    .flatMap(item => [
      [item.company, [item.start, item.current ? '재직 중' : item.end].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '),
      item.role && `직무: ${item.role}`, item.work && `주요 업무:\n${item.work}`, '',
    ].filter(Boolean)));
  block('자격증 / 수상', form.certificates.filter(item => filled([item.name, item.date, item.issuer]))
    .flatMap(item => [[item.name, item.date, item.issuer].filter(Boolean).join(' · '), '']));
  block('교육', form.training.filter(item => filled([item.name, item.provider, item.start, item.end, item.content]))
    .flatMap(item => [
      [item.name, item.provider, [item.start, item.end].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '),
      item.content && `이수 내용: ${item.content}`, '',
    ].filter(Boolean)));
  block('기타', [form.link && `포트폴리오 / 링크: ${form.link}`, form.blog && `기술 블로그: ${form.blog}`,
    ...form.links.filter(Boolean).map(link => `추가 링크: ${link}`), form.extra].filter(Boolean));
  return output.join('\n').trim();
}
const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export function ResumeCreatePage({ userId, draftId, versionEditor }: { userId: number; draftId?: number; versionEditor?: VersionEditor }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [currentDraftId, setCurrentDraftId] = useState<number | undefined>(draftId);
  const [draftCount, setDraftCount] = useState(0);
  const [count, setCount] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [error, setError] = useState('');
  const [errorMode, setErrorMode] = useState<Draft['mode'] | null>(null);
  const [errorTarget, setErrorTarget] = useState<ErrorTarget>('general');
  const [notice, setNotice] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'layout' | 'source'>('layout');
  const [character, setCharacter] = useState<CharacterState>();
  const [retry, setRetry] = useState(0);
  const savedDraft = useRef(JSON.stringify(emptyDraft()));
  const savedVersionDescription = useRef('');
  const approvedNavigation = useRef(false);
  const form = draft.form;
  const editorKind = versionEditor?.kind;
  const editorResumeId = versionEditor?.resumeId;
  const editorVersionId = versionEditor?.kind === 'edit' ? versionEditor.versionId : undefined;
  const editorPath = versionEditor ? `/resumes/${versionEditor.resumeId}/versions/${versionEditor.kind === 'edit' ? `${versionEditor.versionId}/edit` : 'new'}` : '/resumes/new';
  useEffect(() => {
    const controller = new AbortController();
    characters.state(controller.signal).then(value => { if (!controller.signal.aborted) setCharacter(value); })
      .catch(() => { if (!controller.signal.aborted) setCharacter(undefined); });
    const update = (event: Event) => setCharacter((event as CustomEvent<CharacterState>).detail);
    window.addEventListener('devjob:character-updated', update);
    return () => { controller.abort(); window.removeEventListener('devjob:character-updated', update); };
  }, [userId]);
  const updateDraft = (patch: Partial<Draft>) => { setDraft(current => ({ ...current, ...patch })); setNotice(''); setError(''); };
  const updateForm = (patch: Partial<Template>) => { setDraft(current => ({ ...current, form: { ...current.form, ...patch } })); setNotice(''); setError(''); };
  const showFormError = (message: string, mode: Draft['mode'], target: ErrorTarget = 'general') => {
    setError(message); setErrorMode(mode); setErrorTarget(target);
  };
  const updateItem = <K extends 'education' | 'projects' | 'experience' | 'certificates' | 'training'>(
    key: K, index: number, patch: Partial<Template[K][number]>,
  ) => updateForm({ [key]: form[key].map((item, position) => position === index ? { ...item, ...patch } : item) });
  const addItem = <K extends 'education' | 'projects' | 'experience' | 'certificates' | 'training'>(key: K, item: Template[K][number]) =>
    updateForm({ [key]: [...form[key], item] });
  const removeItem = (key: 'education' | 'projects' | 'experience' | 'certificates' | 'training', index: number) =>
    updateForm({ [key]: form[key].filter((_, position) => position !== index) });

  useEffect(() => {
    const hasUnsavedChanges = () => JSON.stringify(saveableDraft(draft)) !== savedDraft.current
      || (versionEditor !== undefined && versionDescription !== savedVersionDescription.current);
    const warning = '저장하지 않은 작성 내용은 사라질 수 있습니다. 이 페이지를 벗어날까요?';
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges() || approvedNavigation.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const click = (event: MouseEvent) => {
      if (!hasUnsavedChanges() || event.defaultPrevented) return;
      const target = event.target;
      const link = target instanceof Element ? target.closest('a[href]') : null;
      if (!link || link.getAttribute('href') === `#${editorPath}`) return;
      if (!window.confirm(warning)) { event.preventDefault(); event.stopImmediatePropagation(); }
      else approvedNavigation.current = true;
    };
    const hashChange = (event: HashChangeEvent) => {
      if (approvedNavigation.current) { approvedNavigation.current = false; return; }
      if (window.location.hash === `#${editorPath}` || !hasUnsavedChanges()) return;
      if (!window.confirm(warning)) {
        event.stopImmediatePropagation();
        approvedNavigation.current = true;
        window.location.hash = editorPath;
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    window.addEventListener('hashchange', hashChange, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true);
      window.removeEventListener('hashchange', hashChange, true);
    };
  }, [draft, editorPath, versionDescription, versionEditor]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setErrorMode(null); setHasAnalysis(false);
    if (editorKind && editorResumeId !== undefined) {
      let plan: NewVersionPlan | undefined;
      if (editorKind === 'new') {
        try {
          const value: unknown = JSON.parse(window.sessionStorage.getItem(`resume-version-new:${editorResumeId}`) ?? 'null');
          if (validVersionPlan(value)) plan = value;
        } catch { /* Invalid session data is handled below. */ }
      }
      if (editorKind === 'new' && !plan && draftId === undefined) {
        setCount(undefined); setError('새 버전 작성 정보가 없습니다. 이력서 상세에서 다시 시작해 주세요.'); setLoading(false);
        return () => controller.abort();
      }
      const sourceVersionId = editorKind === 'edit' ? editorVersionId! : plan?.sourceVersionId;
      Promise.all([documents.get(editorResumeId, controller.signal), documents.versions(editorResumeId, controller.signal),
        sourceVersionId === undefined ? Promise.resolve(null) : documents.version(editorResumeId, sourceVersionId, controller.signal),
        drafts.list(controller.signal), draftId === undefined ? Promise.resolve(null) : drafts.get(draftId, controller.signal)])
        .then(([resume, versions, source, draftList, saved]) => {
          if (controller.signal.aborted) return;
          if (editorKind === 'new' && versions.length >= 10) throw new Error('이력서당 버전은 최대 10개까지 저장할 수 있습니다.');
          if (saved !== null && (!validVersionDraft(saved) || saved.resumeId !== editorResumeId
            || saved.purpose !== (editorKind === 'new' ? 'version-new' : 'version-edit')
            || (editorKind === 'edit' && saved.versionId !== editorVersionId)))
            throw new ApiError('저장된 버전 임시저장 형식을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
          const sourceForm = source && validTemplate(source.form) ? { ...emptyTemplate(), ...source.form } : undefined;
          const restored: Draft = {
            version: 1, mode: saved ? saved.mode : sourceForm ? 'template' : 'free',
            title: saved ? saved.title : editorKind === 'edit' ? (source?.title ?? resume.title).slice(0, 50) : plan!.title,
            content: saved ? saved.content : editorKind === 'new' && plan!.mode === 'blank' ? '' : source?.content ?? '',
            form: saved ? { ...emptyTemplate(), ...saved.form } : editorKind === 'new' && plan!.mode === 'blank' ? emptyTemplate() : sourceForm ?? emptyTemplate(),
          };
          const description = saved ? saved.description : editorKind === 'edit' ? source?.description ?? '' : plan!.description;
          savedDraft.current = JSON.stringify(restored);
          savedVersionDescription.current = description;
          setDraft(restored); setVersionDescription(description); setCount(versions.length);
          setCurrentDraftId(draftId); setDraftCount(draftList.length);
        })
        .catch(failure => { if (!controller.signal.aborted) { setCount(undefined); setError(errorText(failure, '버전 작성 정보를 불러오지 못했습니다.')); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
      if (editorKind === 'edit') {
        documents.analysis({ documentType: 'RESUME', documentId: editorResumeId, versionId: sourceVersionId! }, controller.signal)
          .then(() => { if (!controller.signal.aborted) setHasAnalysis(true); })
          .catch(failure => { if (!controller.signal.aborted && !(failure instanceof ApiError && failure.status === 404)) setError(errorText(failure, '분석 상태를 불러오지 못했습니다.')); });
      }
      return () => controller.abort();
    }
    Promise.all([documents.list(0, controller.signal), drafts.list(controller.signal),
      draftId === undefined ? Promise.resolve(null) : drafts.get(draftId, controller.signal)])
      .then(([list, draftList, saved]) => {
        if (controller.signal.aborted) return;
        if (saved !== null && !validDraft(saved)) throw new ApiError('저장된 임시저장 형식을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
        setCount(list.totalElements);
        setDraftCount(draftList.length);
        setCurrentDraftId(draftId);
        const restored: Draft = saved ? {
          version: saved.version, mode: saved.mode, title: saved.title, content: saved.content,
          form: { ...saved.form, training: saved.form.training ?? [emptyTraining()], blog: saved.form.blog ?? '', links: saved.form.links ?? [] },
        } : emptyDraft();
        savedDraft.current = JSON.stringify(restored);
        setDraft(restored);
      })
      .catch(failure => { if (!controller.signal.aborted) { setCount(undefined); setError(errorText(failure, '이력서 작성 정보를 불러오지 못했습니다.')); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, userId, draftId, editorKind, editorResumeId, editorVersionId]);

  async function saveDraft() {
    if (busy || loading) return;
    const mode = draft.mode;
    const payload = versionEditor ? {
      ...saveableDraft(draft), version: 2 as const,
      purpose: versionEditor.kind === 'new' ? 'version-new' as const : 'version-edit' as const,
      resumeId: versionEditor.resumeId, ...(versionEditor.kind === 'edit' ? { versionId: versionEditor.versionId } : {}),
      description: versionDescription,
    } : saveableDraft(draft);
    if (payload.title.length > (versionEditor ? 50 : 200)) { showFormError('제목이 너무 깁니다.', mode, versionEditor || mode === 'free' ? 'title' : 'general'); return; }
    if (payload.content.length > 100000) { showFormError('이력서 원문은 100,000자까지 임시저장할 수 있습니다.', mode, mode === 'free' ? 'content' : 'general'); return; }
    if (unsupportedControl.test(payload.title)) { showFormError('이력서 제목에 저장할 수 없는 제어 문자가 있습니다.', mode, versionEditor || mode === 'free' ? 'title' : 'general'); return; }
    if (unsupportedControl.test(payload.content)) { showFormError('이력서 원문에 저장할 수 없는 제어 문자가 있습니다.', mode, mode === 'free' ? 'content' : 'general'); return; }
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 262144) {
      showFormError('임시저장할 전체 내용이 너무 깁니다. 작성 내용을 줄여 주세요.', mode); return;
    }
    if (currentDraftId === undefined && draftCount >= 20) {
      showFormError('임시저장 이력서는 최대 20개까지 저장할 수 있습니다. 목록에서 기존 초안을 삭제해 주세요.', mode); return;
    }
    setBusy(true); setError('');
    try {
      const saved = await drafts.save(payload, currentDraftId);
      savedDraft.current = JSON.stringify(saveableDraft(draft));
      savedVersionDescription.current = versionDescription;
      if (currentDraftId === undefined) {
        setCurrentDraftId(saved.id); setDraftCount(value => value + 1);
        window.location.hash = `${editorPath}?draft=${saved.id}`;
      }
      setNotice('임시저장했습니다.');
    }
    catch (failure) { showFormError(failure instanceof ApiError && failure.status === 400
      ? '임시저장 데이터 형식이 맞지 않습니다. 입력한 내용을 복사해 둔 뒤 페이지를 새로고침하고 다시 시도해 주세요.'
      : errorText(failure, '임시저장에 실패했습니다.'), mode); }
    finally { setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || count === undefined || (versionEditor?.kind === 'new' ? count >= 10 : !versionEditor && count >= 20)) return;
    const title = versionEditor ? draft.title.trim() : draft.mode === 'free' ? draft.title.trim() : `${form.name.trim()} ${form.desiredRole.trim() || '개발자'} 이력서`.trim();
    const content = draft.mode === 'free' ? draft.content.trim() : resumeText(form);
    if (draft.mode === 'template' && (!form.name.trim() || !form.email.trim() || !form.desiredRole.trim())) {
      const target = !form.name.trim() ? 'name' : !form.email.trim() ? 'email' : 'desiredRole';
      showFormError(`${target === 'name' ? '이름' : target === 'email' ? '이메일' : '희망 직무'}을(를) 입력해 주세요.`, draft.mode, target); return;
    }
    if (!title || !content) {
      showFormError(!title ? `${versionEditor ? '버전' : '이력서'} 제목을 입력해 주세요.` : '이력서 원문을 입력해 주세요.',
        draft.mode, !title && (versionEditor || draft.mode === 'free') ? 'title' : draft.mode === 'free' ? 'content' : 'general'); return;
    }
    if (content.length > 100000) { showFormError('이력서 내용은 100,000자까지 저장할 수 있습니다.', draft.mode, draft.mode === 'free' ? 'content' : 'general'); return; }
    if (unsupportedControl.test(title)) { showFormError('제목에 저장할 수 없는 제어 문자가 있습니다.', draft.mode, versionEditor || draft.mode === 'free' ? 'title' : 'general'); return; }
    if (unsupportedControl.test(content)) { showFormError('이력서 원문에 저장할 수 없는 제어 문자가 있습니다.', draft.mode, draft.mode === 'free' ? 'content' : 'general'); return; }
    if (new TextEncoder().encode(content).length > 262144) {
      showFormError('이력서 원문 용량이 256KB를 넘었습니다. 내용을 줄여 주세요.', draft.mode, draft.mode === 'free' ? 'content' : 'general'); return;
    }
    if (versionEditor?.kind === 'edit' && !window.confirm(hasAnalysis
      ? '수정 시 기존 분석 결과와 공고 비교 결과가 초기화됩니다. 계속할까요?'
      : '수정 시 연결된 공고 비교 결과가 초기화될 수 있습니다. 계속할까요?')) return;
    setBusy(true); setError('');
    try {
      if (versionEditor) {
        const metadata = { title: title.slice(0, 50), description: versionDescription.trim(),
          ...(draft.mode === 'template' ? { form } : {}), ...(currentDraftId === undefined ? {} : { draftId: currentDraftId }) };
        const saved = versionEditor.kind === 'new'
          ? await documents.addVersion(versionEditor.resumeId, content, metadata)
          : await documents.editVersion(versionEditor.resumeId, versionEditor.versionId, content, metadata);
        if (versionEditor.kind === 'new') window.sessionStorage.removeItem(`resume-version-new:${versionEditor.resumeId}`);
        approvedNavigation.current = true;
        window.location.hash = `/resumes/${versionEditor.resumeId}/versions/${saved.id}`;
        return;
      }
      const created = await documents.create(title.slice(0, 200), content, currentDraftId, draft.mode === 'template' ? form : undefined);
      approvedNavigation.current = true;
      window.location.hash = `/resumes/${created.id}`;
    } catch (failure) { showFormError(errorText(failure, '이력서를 저장하지 못했습니다.'), draft.mode); }
    finally { setBusy(false); }
  }
  async function importSection(section: 'basic' | 'certificates' | 'skills') {
    setImporting(section); setError(''); setNotice('');
    try {
      if (section === 'skills') {
        const [owned, custom] = await Promise.all([skillsApi.list(), skillsApi.listCustom()]);
        const skills = [...new Set([...form.skills, ...owned.map(item => item.name), ...custom.map(item => item.name)])];
        updateForm({ skills }); setNotice(skills.length ? '내 기술을 가져왔습니다.' : '등록된 기술이 없습니다. 직접 입력할 수 있습니다.');
      } else {
        const profile = await profileApi.get();
        if (section === 'basic') updateForm({
          email: valueOr(form.email, profile.email),
          introduction: valueOr(form.introduction, profile.introduction),
          desiredRole: valueOr(form.desiredRole, profile.desiredRole),
          location: valueOr(form.location, profile.desiredLocation),
        });
        if (section === 'certificates') updateForm({
          certificates: form.certificates.some(item => item.name.trim()) ? form.certificates
            : lines(profile.certifications ?? '').map(name => ({ ...emptyCertificate(), name })),
        });
        if (section === 'certificates') setNotice('프로필의 자격증을 가져왔습니다.');
      }
    } catch (failure) {
      showFormError(failure instanceof ApiError && failure.status === 404
        ? '저장된 프로필이 없습니다. 직접 입력하거나 프로필 페이지에서 먼저 등록해 주세요.'
        : errorText(failure, '프로필 정보를 가져오지 못했습니다.'), 'template');
    } finally { setImporting(''); }
  }
  function importProjects(selected: SavedProject[]) {
    const existing = form.projects.filter(item => filled([item.name, item.description, item.work]));
    const next = selected.filter(item => !existing.some(entry => entry.name === item.name && entry.start === item.startDate.slice(0, 7)))
      .map(item => ({
        name: item.name, start: item.startDate.slice(0, 7), end: item.endDate?.slice(0, 7) ?? '',
        description: item.description ?? '', role: item.role ?? '', skills: item.skills.map(skill => skill.name).join(', '),
        work: [item.keyFeatures, item.outcome].filter(Boolean).join('\n'),
      }));
    if (next.length) updateForm({ projects: [...existing, ...next] });
    setProjectPickerOpen(false);
  }
  function addSkill() {
    const skill = skillInput.trim();
    if (skill && !form.skills.some(item => item.toLowerCase() === skill.toLowerCase())) updateForm({ skills: [...form.skills, skill] });
    setSkillInput('');
  }
  const previewName = form.name.trim() || '이름을 입력해 주세요';
  const characterPortrait = character && characterAppearanceUrl(character.equipment);
  const activeError = errorMode === draft.mode ? error : '';
  const fieldError = (target: ErrorTarget) => activeError && errorTarget === target
    ? <span className="resume-field-error" role="alert">{activeError}</span> : null;
  return <div className="resume-workspace resume-create-page">
    <header className="resume-workspace-heading"><span className="resume-workspace-heading-icon"><LucideIcon name="fileText" /></span><div><h1>{versionEditor?.kind === 'new' ? '새 버전 작성' : versionEditor?.kind === 'edit' ? '버전 수정' : '이력서 작성'}</h1><p>개발 경험과 강점을 정리해 보세요.</p></div></header>
    <div className="resume-create-toolbar"><a href={versionEditor ? `#/resumes/${versionEditor.resumeId}` : '#/resumes'}><LucideIcon name="arrowLeft" /> {versionEditor ? '이력서 상세' : '이력서 목록'}</a><button type="button" onClick={() => setGuideOpen(true)}><LucideIcon name="fileText" /> 작성 가이드 보기</button></div>
    <div className="resume-create-tabs" role="tablist" aria-label="이력서 입력 방식">
      <button type="button" role="tab" aria-selected={draft.mode === 'free'} className={draft.mode === 'free' ? 'is-active' : ''} onClick={() => updateDraft({ mode: 'free' })}><LucideIcon name="fileText" /> 자유 입력</button>
      <button type="button" role="tab" aria-selected={draft.mode === 'template'} className={draft.mode === 'template' ? 'is-active' : ''} onClick={() => updateDraft({ mode: 'template' })}><LucideIcon name="clipboardList" /> 양식 입력</button>
    </div>
    {loading ? <p>작성 정보를 불러오는 중입니다.</p> : count === undefined ? <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p> : versionEditor?.kind === 'new' && count >= 10 ? <p role="status">이력서당 버전은 최대 10개까지 저장할 수 있습니다.</p> : !versionEditor && count >= 20 ? <p role="status">최대 20개까지 등록할 수 있습니다. 새 이력서를 만들려면 기존 이력서를 삭제해 주세요.</p> : <>
      <form className={`resume-create-form${draft.mode === 'free' ? ' is-free' : ''}`} onSubmit={event => void create(event)}>
        {versionEditor && <div className="resume-create-version-meta"><label>버전 제목<input value={draft.title} onChange={event => updateDraft({ title: event.target.value })} maxLength={50} required />{fieldError('title')}</label><label>버전 설명 (선택)<textarea value={versionDescription} onChange={event => setVersionDescription(event.target.value)} maxLength={200} rows={2} /></label></div>}
        {draft.mode === 'free' ? <section className="resume-create-card"><div className="resume-create-card-heading"><h2>자유 입력</h2><p>{versionEditor ? '이력서 원문을 작성하세요.' : '제목과 본문을 작성하세요.'}</p></div>
          {!versionEditor && <label>이력서 제목<input value={draft.title} onChange={event => updateDraft({ title: event.target.value })} maxLength={200} placeholder="예: 백엔드 개발자 이력서" required />{fieldError('title')}</label>}
          <div className="resume-create-editor-field" data-color-mode="light">
            <label htmlFor="resume-free-content">이력서 원문</label>
            <MDEditor
              value={draft.content}
              onChange={value => updateDraft({ content: (value ?? '').slice(0, 100000) })}
              commands={resumeEditorCommands}
              extraCommands={[]}
              previewOptions={{ rehypePlugins: [[rehypeSanitize]] }}
              textareaProps={{ id: 'resume-free-content', maxLength: 100000, placeholder: '기술 스택, 프로젝트, 문제 해결 경험과 성과를 구체적으로 작성해 주세요.' }}
              height={360}
            />
            {fieldError('content')}
          </div>
          {fieldError('general')}
        </section> : <div className="resume-template-layout">
          <div className="resume-template-fields">
            {fieldError('general')}
            <section className="resume-template-section">
              <SectionHeading number="1" title="기본 정보" action="프로필에서 가져오기" onAction={() => void importSection('basic')} busy={importing === 'basic'} />
              <div className="resume-template-grid">
                <label>이름 <em>*</em><input value={form.name} onChange={event => updateForm({ name: event.target.value })} maxLength={100} placeholder="홍길동" required />{fieldError('name')}</label>
                <label>연락처<input value={form.phone} onChange={event => updateForm({ phone: event.target.value })} maxLength={50} placeholder="010-1234-5678" /></label>
                <label>이메일 <em>*</em><input type="email" value={form.email} onChange={event => updateForm({ email: event.target.value })} maxLength={200} placeholder="hong@example.com" required />{fieldError('email')}</label>
                <label>생년월일<input type="date" value={form.birth} onChange={event => updateForm({ birth: event.target.value })} /></label>
              </div>
              <label>한 줄 소개<input value={form.introduction} onChange={event => updateForm({ introduction: event.target.value })} maxLength={200} placeholder="어떤 개발자인지 한 문장으로 소개해 주세요." /></label>
            </section>
            <section className="resume-template-section">
              <SectionHeading number="2" title="희망 직무" />
              <div className="resume-template-grid">
                <label>희망 직무 <em>*</em><input value={form.desiredRole} onChange={event => updateForm({ desiredRole: event.target.value })} maxLength={100} placeholder="백엔드 개발자" required />{fieldError('desiredRole')}</label>
                <label>희망 근무 지역<input value={form.location} onChange={event => updateForm({ location: event.target.value })} maxLength={100} placeholder="서울특별시" /></label>
                <label>고용 형태<select value={form.employment} onChange={event => updateForm({ employment: event.target.value })}><option value="">선택 안 함</option><option>정규직</option><option>계약직</option><option>인턴</option><option>프리랜서</option></select></label>
              </div>
            </section>
            <section className="resume-template-section">
              <SectionHeading number="3" title="학력" />
              {form.education.map((item, index) => <div className="resume-template-entry" key={index}>
                <div className="resume-template-entry-top"><strong>학력 {index + 1}</strong><button type="button" onClick={() => removeItem('education', index)}>삭제</button></div>
                <div className="resume-template-grid"><label>학교명<input value={item.school} onChange={event => updateItem('education', index, { school: event.target.value })} placeholder="학교명" /></label><label>전공<input value={item.major} onChange={event => updateItem('education', index, { major: event.target.value })} placeholder="컴퓨터공학과" /></label><label>학위<select value={item.degree} onChange={event => updateItem('education', index, { degree: event.target.value })}><option value="">선택 안 함</option><option>고졸</option><option>전문학사</option><option>학사</option><option>석사</option><option>박사</option></select></label><label>입학<input type="month" value={item.start} onChange={event => updateItem('education', index, { start: event.target.value })} /></label><label>졸업<input type="month" value={item.end} onChange={event => updateItem('education', index, { end: event.target.value })} /></label></div>
              </div>)}
              <button type="button" className="resume-template-add" aria-label="학력 추가" onClick={() => addItem('education', emptyEducation())}>+ 추가</button>
            </section>
            <section className="resume-template-section">
              <SectionHeading number="4" title="기술 스택" action="내 기술 가져오기" onAction={() => void importSection('skills')} busy={importing === 'skills'} />
              <div className="resume-template-skill-input"><input aria-label="기술 검색 또는 직접 입력" value={skillInput} onChange={event => setSkillInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }} placeholder="기술 입력 (예: Java, Spring Boot)" /><button type="button" onClick={addSkill}><LucideIcon name="plus" /> 직접 추가</button></div>
              <div className="resume-template-tags">{form.skills.map(skill => <button type="button" key={skill} onClick={() => updateForm({ skills: form.skills.filter(item => item !== skill) })}>{skill} <span aria-hidden="true">×</span><span className="sr-only"> 삭제</span></button>)}</div>
            </section>
            <section className="resume-template-section">
              <SectionHeading number="5" title="프로젝트" action="내 프로젝트 가져오기" onAction={() => setProjectPickerOpen(true)} />
              {form.projects.map((item, index) => <div className="resume-template-entry" key={index}>
                <div className="resume-template-entry-top"><strong>프로젝트 {index + 1}</strong><button type="button" onClick={() => removeItem('projects', index)}>삭제</button></div>
                <div className="resume-template-grid"><label>프로젝트명<input value={item.name} onChange={event => updateItem('projects', index, { name: event.target.value })} placeholder="프로젝트명" /></label><label>시작<input type="month" value={item.start} onChange={event => updateItem('projects', index, { start: event.target.value })} /></label><label>종료<input type="month" value={item.end} onChange={event => updateItem('projects', index, { end: event.target.value })} /></label><label>주요 역할<input value={item.role} onChange={event => updateItem('projects', index, { role: event.target.value })} placeholder="팀원 · 백엔드" /></label></div>
                <label>프로젝트 설명<textarea value={item.description} onChange={event => updateItem('projects', index, { description: event.target.value })} rows={2} placeholder="프로젝트 목적과 내용을 적어 주세요." /></label>
                <label>기술 스택<input value={item.skills} onChange={event => updateItem('projects', index, { skills: event.target.value })} placeholder="Java, Spring Boot, MySQL" /></label>
                <label>주요 작업<textarea value={item.work} onChange={event => updateItem('projects', index, { work: event.target.value })} rows={4} placeholder="담당한 구현과 확인된 결과를 구체적으로 적어 주세요." /></label>
              </div>)}
              <button type="button" className="resume-template-add" aria-label="프로젝트 추가" onClick={() => addItem('projects', emptyProject())}>+ 추가</button>
            </section>
            <section className="resume-template-section">
              <SectionHeading number="6" title="경력 / 인턴 경험" />
              {form.experience.map((item, index) => <div className="resume-template-entry" key={index}>
                <div className="resume-template-entry-top"><strong>경험 {index + 1}</strong><button type="button" onClick={() => removeItem('experience', index)}>삭제</button></div>
                <div className="resume-template-grid"><label>회사명<input value={item.company} onChange={event => updateItem('experience', index, { company: event.target.value })} placeholder="회사명" /></label><label>시작<input type="month" value={item.start} onChange={event => updateItem('experience', index, { start: event.target.value })} /></label><label>종료<input type="month" value={item.end} disabled={item.current} onChange={event => updateItem('experience', index, { end: event.target.value })} /></label><label>직무<input value={item.role} onChange={event => updateItem('experience', index, { role: event.target.value })} placeholder="개발 인턴" /></label></div>
                <label className="resume-template-checkbox"><input type="checkbox" checked={item.current} onChange={event => updateItem('experience', index, { current: event.target.checked, end: event.target.checked ? '' : item.end })} /><span>재직 중</span></label>
                <label>주요 업무<textarea value={item.work} onChange={event => updateItem('experience', index, { work: event.target.value })} rows={3} placeholder="담당한 업무와 성과를 적어 주세요." /></label>
              </div>)}
              <button type="button" className="resume-template-add" aria-label="경력 / 인턴 추가" onClick={() => addItem('experience', emptyExperience())}>+ 추가</button>
            </section>
            <section className="resume-template-section">
              <SectionHeading number="7" title="자격증 / 수상" action="프로필에서 가져오기" onAction={() => void importSection('certificates')} busy={importing === 'certificates'} />
              {form.certificates.map((item, index) => <div className="resume-template-entry" key={index}><div className="resume-template-entry-top"><strong>항목 {index + 1}</strong><button type="button" onClick={() => removeItem('certificates', index)}>삭제</button></div><div className="resume-template-grid"><label>자격증 / 수상명<input value={item.name} onChange={event => updateItem('certificates', index, { name: event.target.value })} placeholder="정보처리기사" /></label><label>취득 / 수상일<input type="date" value={item.date} onChange={event => updateItem('certificates', index, { date: event.target.value })} /></label><label>발급 기관<input value={item.issuer} onChange={event => updateItem('certificates', index, { issuer: event.target.value })} placeholder="한국산업인력공단" /></label></div></div>)}
              <button type="button" className="resume-template-add" aria-label="자격증 / 수상 추가" onClick={() => addItem('certificates', emptyCertificate())}>+ 추가</button>
            </section>
            <section className="resume-template-section">
              <SectionHeading number="8" title="교육" />
              {form.training.map((item, index) => <div className="resume-template-entry" key={index}>
                <div className="resume-template-entry-top"><strong>교육 {index + 1}</strong><button type="button" onClick={() => removeItem('training', index)}>삭제</button></div>
                <div className="resume-template-grid">
                  <label>교육명<input value={item.name} onChange={event => updateItem('training', index, { name: event.target.value })} placeholder="교육명" /></label>
                  <label>교육기관<input value={item.provider} onChange={event => updateItem('training', index, { provider: event.target.value })} placeholder="교육기관" /></label>
                  <label>기간 시작<input type="month" value={item.start} onChange={event => updateItem('training', index, { start: event.target.value })} /></label>
                  <label>기간 종료<input type="month" value={item.end} onChange={event => updateItem('training', index, { end: event.target.value })} /></label>
                </div>
                <label>이수내용(선택)<textarea value={item.content} onChange={event => updateItem('training', index, { content: event.target.value })} rows={3} placeholder="배운 내용과 수행한 활동을 적어 주세요." /></label>
              </div>)}
              <button type="button" className="resume-template-add" aria-label="교육 추가" onClick={() => addItem('training', emptyTraining())}>+ 추가</button>
            </section>
            <section className="resume-template-section">
              <SectionHeading number="9" title="기타 사항" />
              <label>포트폴리오 / 링크<input value={form.link} onChange={event => updateForm({ link: event.target.value })} maxLength={2000} placeholder="https://github.com/..." /></label>
              <label>기술 블로그<input type="url" value={form.blog} onChange={event => updateForm({ blog: event.target.value })} maxLength={2000} placeholder="https://blog.example.com" /></label>
              {form.links.map((link, index) => <div className="resume-template-extra-link" key={index}><label>추가 링크 {index + 1}<input type="url" value={link} onChange={event => updateForm({ links: form.links.map((item, position) => position === index ? event.target.value : item) })} maxLength={2000} placeholder="https://..." /></label><button type="button" aria-label={`추가 링크 ${index + 1} 삭제`} onClick={() => updateForm({ links: form.links.filter((_, position) => position !== index) })}>삭제</button></div>)}
              <button type="button" className="resume-template-add" onClick={() => updateForm({ links: [...form.links, ''] })}>+ 링크 추가</button>
              <label>기타 어필 사항<textarea value={form.extra} onChange={event => updateForm({ extra: event.target.value })} maxLength={3000} rows={3} placeholder="추가로 소개하고 싶은 내용을 적어 주세요." /></label>
            </section>
          </div>
          <aside className="resume-template-preview" aria-label="이력서 미리보기"><h2><LucideIcon name="fileText" /> 미리보기</h2><div className="resume-template-preview-tabs" role="tablist" aria-label="미리보기 형식"><button type="button" role="tab" aria-selected={previewMode === 'layout'} className={previewMode === 'layout' ? 'is-active' : ''} onClick={() => setPreviewMode('layout')}>기본형</button><button type="button" role="tab" aria-selected={previewMode === 'source'} className={previewMode === 'source' ? 'is-active' : ''} onClick={() => setPreviewMode('source')}>원문 미리보기</button></div>{previewMode === 'source' ? <pre className="resume-template-preview-source">{resumeText(form) || '양식을 작성하면 저장할 원문이 여기에 표시됩니다.'}</pre> : <div className="resume-template-preview-paper">
            <div className="resume-template-preview-person"><span className="resume-template-preview-avatar">{characterPortrait
              ? <img src={characterPortrait} alt="내 캐릭터 상반신" draggable={false} />
              : <PixelIcon name="profile" />}</span><div><strong>{previewName}</strong>{form.phone && <p>연락처: {form.phone}</p>}{form.email && <p>이메일: {form.email}</p>}{form.birth && <p>생년월일: {form.birth}</p>}</div></div>
            {form.introduction && <p className="resume-template-preview-intro">{form.introduction}</p>}
            <PreviewSection title="희망 직무" items={[previewDetail(
              form.desiredRole && `직무: ${form.desiredRole}`,
              form.location && `희망 지역: ${form.location}`,
              form.employment && `고용 형태: ${form.employment}`,
            )].filter(Boolean)} />
            <PreviewGroupSection title="학력" entries={form.education.filter(item => filled([item.school, item.major, item.degree, item.start, item.end]))
              .map(item => ({ heading: item.school || '학교명 미입력', detail: previewDetail(item.major && `전공: ${item.major}`,
                item.degree && `학위: ${item.degree}`, previewPeriod(item.start, item.end) && `기간: ${previewPeriod(item.start, item.end)}`) }))} />
            <PreviewSection title="기술 스택" items={form.skills} tags />
            <PreviewGroupSection title="프로젝트" entries={form.projects.filter(item => filled([item.name, item.start, item.end, item.description, item.role, item.skills, item.work]))
              .map(item => ({ heading: item.name || '프로젝트명 미입력', detail: previewDetail(
                previewPeriod(item.start, item.end) && `기간: ${previewPeriod(item.start, item.end)}`,
                item.description && `설명: ${item.description}`, item.role && `주요 역할: ${item.role}`,
                item.skills && `기술 스택: ${item.skills}`, item.work && `주요 작업: ${item.work}`) }))} />
            <PreviewGroupSection title="경력 / 인턴" entries={form.experience.filter(item => filled([item.company, item.start, item.end, item.current ? '재직 중' : '', item.role, item.work]))
              .map(item => ({ heading: item.company || '회사명 미입력', detail: previewDetail(
                (item.start || item.end || item.current) && `기간: ${previewPeriod(item.start, item.current ? '재직 중' : item.end)}`,
                item.role && `직무: ${item.role}`, item.work && `주요 업무: ${item.work}`) }))} />
            <PreviewGroupSection title="자격증 / 수상" entries={form.certificates.filter(item => filled([item.name, item.date, item.issuer]))
              .map(item => ({ heading: item.name || '명칭 미입력', detail: previewDetail(item.date && `취득 / 수상일: ${item.date}`,
                item.issuer && `발급 기관: ${item.issuer}`) }))} />
            <PreviewGroupSection title="교육" entries={form.training.filter(item => filled([item.name, item.provider, item.start, item.end, item.content]))
              .map(item => ({ heading: item.name || '교육명 미입력', detail: previewDetail(item.provider && `교육기관: ${item.provider}`,
                previewPeriod(item.start, item.end) && `기간: ${previewPeriod(item.start, item.end)}`,
                item.content && `이수내용: ${item.content}`) }))} />
            <PreviewSection title="기타" items={[
              form.link && `포트폴리오 / 링크: ${form.link}`, form.blog && `기술 블로그: ${form.blog}`,
              ...form.links.map((link, index) => link && `추가 링크 ${index + 1}: ${link}`),
              form.extra && `기타 어필 사항: ${form.extra}`,
            ].filter(Boolean)} />
            {!resumeText(form) && <p className="resume-template-preview-empty">왼쪽 양식을 작성하면 이곳에 미리보기가 표시됩니다.</p>}
          </div>}<p className="resume-template-preview-note"><LucideIcon name="info" /> 미리보기는 입력 내용을 바탕으로 구성됩니다. 저장 후에는 원문을 덮어쓰지 않고 새 버전을 추가할 수 있습니다.</p></aside>
        </div>}
        {notice === '임시저장했습니다.' && <p className="resume-create-save-status" role="status"><LucideIcon name="check" /> {notice}</p>}
        <div className="resume-create-footer"><div className="resume-create-footer-actions"><button type="button" onClick={() => void saveDraft()} disabled={busy}>임시저장</button><button type="submit" className="resume-primary" disabled={busy}>{busy ? '저장 중…' : versionEditor?.kind === 'new' ? '새 버전 생성' : versionEditor?.kind === 'edit' ? '저장' : '이력서 저장'}</button></div></div>
      </form>
    </>}
    {notice && notice !== '임시저장했습니다.' && <p className="resume-message" role="status">{notice}</p>}
    {guideOpen && <ResumeGuideModal onClose={() => setGuideOpen(false)} />}
    {projectPickerOpen && <ProjectPickerModal onClose={() => setProjectPickerOpen(false)} onImport={importProjects} />}
  </div>;
}

function SectionHeading({ number, title, action, onAction, busy }: { number: string; title: string; action?: string; onAction?: () => void; busy?: boolean }) {
  return <div className="resume-template-section-heading"><div><span>{number}</span><h2>{title}</h2></div>{action && <button type="button" disabled={busy} onClick={onAction}><LucideIcon name="plus" /> {busy ? '불러오는 중…' : action}</button>}</div>;
}
function PreviewSection({ title, items, tags = false }: { title: string; items: string[]; tags?: boolean }) {
  if (!items.length) return null;
  return <section className="resume-template-preview-section"><h3>{title}</h3><div className={tags ? 'resume-template-preview-tags' : ''}>{items.map((item, index) => tags ? <span key={index}>{item}</span> : <p key={index}>{item}</p>)}</div></section>;
}

function PreviewGroupSection({ title, entries }: { title: string; entries: { heading: string; detail: string }[] }) {
  if (!entries.length) return null;
  return <section className="resume-template-preview-section"><h3>{title}</h3><div className="resume-template-preview-entries">
    {entries.map((entry, index) => <article className="resume-template-preview-entry" key={index}>
      <h4>{entry.heading}</h4>{entry.detail && <p>{entry.detail}</p>}
    </article>)}
  </div></section>;
}

function ProjectPickerModal({ onClose, onImport }: { onClose: () => void; onImport: (projects: SavedProject[]) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<SavedProject[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const load = async () => {
      const all: SavedProject[] = [];
      let page = 0;
      let total = 0;
      do {
        const result = await projectsApi.list(page++, controller.signal);
        all.push(...result.items);
        total = result.totalElements;
        if (!result.items.length) break;
      } while (all.length < total);
      if (!controller.signal.aborted) setItems(all);
    };
    void load().catch(failure => { if (!controller.signal.aborted) setError(errorText(failure, '프로젝트 목록을 불러오지 못했습니다.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  const toggle = (id: number) => setSelected(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <div className="resume-guide-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="resume-project-picker" role="dialog" aria-modal="true" aria-labelledby="resume-project-picker-title">
      <header><div><h2 id="resume-project-picker-title">내 프로젝트 가져오기</h2><p>이력서에 넣을 프로젝트를 여러 개 선택할 수 있습니다.</p></div><button ref={closeRef} type="button" aria-label="프로젝트 목록 닫기" onClick={onClose}><LucideIcon name="close" /></button></header>
      <div className="resume-project-picker-list">
        {loading ? <p role="status">프로젝트를 불러오는 중입니다.</p> : error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p>
          : items.length === 0 ? <p>등록된 프로젝트가 없습니다. 직접 입력할 수 있습니다.</p>
            : items.map(item => <label className="resume-project-picker-item" key={item.id}><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /><span><strong>{item.name}</strong><small>{item.startDate} ~ {item.endDate || '진행 중'}</small>{item.description && <span>{item.description}</span>}</span></label>)}
      </div>
      <footer><button type="button" onClick={onClose}>취소</button><button type="button" className="resume-primary" disabled={loading || !!error || selected.size === 0} onClick={() => onImport(items.filter(item => selected.has(item.id)))}>선택한 프로젝트 {selected.size}개 가져오기</button></footer>
    </section>
  </div>;
}
