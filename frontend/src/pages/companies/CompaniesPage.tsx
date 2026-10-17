import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { companyLink, createCompaniesApi } from '../../api/companies';
import type { CompanyFilters, CompanyInput, CompanyPage, CompanySize, CompanyStatus, CompanyTag,
  InterestLevel, InterestedCompany } from '../../api/companies';
import { LucideIcon } from '../../components/LucideIcon';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import buildingIcon from '../../assets/redesign/company-building-new.png';
import detailBuildingIcon from '../../assets/redesign/company-detail-building.png';
import detailIcons from '../../assets/redesign/company-detail-icons.png';
import emptyCat from '../../assets/redesign/company-empty-cat.png';
import './companies.css';

const companies = createCompaniesApi(apiRequest);
const blank: CompanyInput = { name: '', websiteUrl: null, note: null, status: 'INTERESTED',
  industry: null, companySize: null, region: null, interestLevel: 'MEDIUM', favorite: false, tags: [] };
const statusLabels: Record<CompanyStatus, string> = { INTERESTED: '관심', RESEARCHING: '조사 중', ARCHIVED: '보관' };
const sizeLabels: Record<CompanySize, string> = { STARTUP: '스타트업', SMALL: '중소기업', MEDIUM: '중견기업', LARGE: '대기업' };
const interestLabels: Record<InterestLevel, string> = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' };
const industries = ['IT·서비스', '제조·자동차', '금융', '유통·커머스', '교육', '헬스케어', '콘텐츠', '기타'];
const regions = ['서울', '경기', '인천', '부산', '대전', '대구', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '해외'];
const tagColors = ['blue', 'green', 'pink', 'yellow', 'purple', 'sky', 'orange', 'red', 'mint', 'gray'] as const;
const tagColorLabels: Record<string, string> = { blue: '파랑', green: '초록', pink: '핑크', yellow: '노랑',
  purple: '보라', sky: '하늘', orange: '주황', red: '빨강', mint: '민트', gray: '회색' };
const desktopFilterClass = 'lg:min-h-9! lg:text-[13px]!';
const desktopTagClass = 'lg:min-h-9! lg:px-3! lg:text-sm!';
const message = (error: unknown) => error instanceof Error ? error.message : '기업 기록을 처리하지 못했습니다.';
const tagMessage = (error: unknown) => error instanceof ApiError && error.status === 404
  ? '태그 정보를 불러오지 못했습니다. 다시 시도해 주세요.' : message(error);
const displayDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
const tagTone = (tag: string) => `company-tag--${Math.abs([...tag].reduce((value, char) => value + char.codePointAt(0)!, 0)) % 6}`;
const tagClass = (name: string, tags: CompanyTag[]) => {
  const color = tags.find(tag => tag.name === name)?.colorKey;
  return color && tagColors.includes(color as typeof tagColors[number]) ? `company-color--${color}` : tagTone(name);
};
const inputFrom = (item: InterestedCompany): CompanyInput => ({ name: item.name, websiteUrl: item.websiteUrl,
  note: item.note, status: item.status, industry: item.industry, companySize: item.companySize,
  region: item.region, interestLevel: item.interestLevel, favorite: item.favorite, tags: item.tags });

function DetailSprite({ index, className = '' }: { index: number; className?: string }) {
  return <span aria-hidden="true" className={`block shrink-0 bg-no-repeat [background-size:400%_200%] ${className}`}
    style={{ backgroundImage: `url(${detailIcons})`, backgroundPosition: `${index % 4 * 100 / 3}% ${Math.floor(index / 4) * 100}%` }} />;
}

export function CompaniesPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  const match = /^\/companies\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : undefined;
  const valid = path === '/companies' || path === '/companies/new' || (id && Number.isSafeInteger(id));
  if (!valid) return <section className="card"><EmptyState title="기업 주소를 확인해 주세요." /><a className="button-link" href="#/companies">기업 목록으로</a></section>;
  return <div className="companies-shell"><CompanyList />
    {path !== '/companies' && <div className="company-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) window.location.hash = '/companies'; }}>
      <CompanyEditor id={id} initialEdit={location.includes('edit=1')} />
    </div>}
  </div>;
}

function CompanyList() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<CompanyPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CompanyFilters>({ order: 'latest' });
  const [customTags, setCustomTags] = useState<CompanyTag[]>([]);
  const [tagDialog, setTagDialog] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<InterestedCompany | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(0); }, 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    companies.list(page, controller.signal, { ...filters, q: search || undefined })
      .then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, filters, search, retry]);
  function loadTags() { companies.listTags().then(value => { setCustomTags(value); setActionError(''); })
    .catch(failure => setActionError(tagMessage(failure))); }
  useEffect(() => { loadTags(); }, []);
  function choose(patch: CompanyFilters) { setFilters(current => ({ ...current, ...patch })); setPage(0); }
  async function favorite(item: InterestedCompany) {
    if (busyId !== null) return;
    setBusyId(item.id); setActionError('');
    try { await companies.update(item.id, { ...inputFrom(item), favorite: !item.favorite }); setRetry(value => value + 1); }
    catch (failure) { setActionError(message(failure)); }
    finally { setBusyId(null); }
  }
  async function remove() {
    if (!deleting || busyId !== null) return;
    setBusyId(deleting.id); setActionError('');
    try { await companies.remove(deleting.id); setDeleting(null); setRetry(value => value + 1); }
    catch (failure) { setActionError(message(failure)); }
    finally { setBusyId(null); }
  }
  const tags = customTags.map(tag => tag.name);
  const shownTags = showAllTags ? tags : tags.slice(0, 7);
  return <section className="companies-page" aria-label="기업 관리">
    <header className="company-page-header"><div className="company-page-title"><img src={buildingIcon} alt="" /><div><h1 className="lg:text-[1.75rem]!">기업 관리</h1><p className="lg:text-sm!">관심 있는 기업을 등록하고 관리하세요.</p></div></div>
      <a className="company-primary lg:min-h-11! lg:px-5! lg:text-sm!" href="#/companies/new"><LucideIcon name="plus" /> 관심 기업 등록</a></header>
    <div className="company-search"><LucideIcon name="search" /><input type="search" className="lg:min-h-10! lg:text-sm!" value={query} onChange={event => setQuery(event.target.value)} placeholder="기업명, 키워드, 태그로 검색하세요." aria-label="기업 검색" /></div>
    <div className="company-filters"><select className={desktopFilterClass} aria-label="산업 분야" value={filters.industry ?? ''} onChange={event => choose({ industry: event.target.value || undefined })}><option value="">산업 분야</option>{industries.map(value => <option key={value}>{value}</option>)}</select>
      <select className={desktopFilterClass} aria-label="기업 규모" value={filters.companySize ?? ''} onChange={event => choose({ companySize: event.target.value as CompanySize || undefined })}><option value="">기업 규모</option>{Object.entries(sizeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select className={desktopFilterClass} aria-label="지역" value={filters.region ?? ''} onChange={event => choose({ region: event.target.value || undefined })}><option value="">지역</option>{regions.map(value => <option key={value}>{value}</option>)}</select>
      <select className={desktopFilterClass} aria-label="관심도" value={filters.interestLevel ?? ''} onChange={event => choose({ interestLevel: event.target.value as InterestLevel || undefined })}><option value="">관심도</option>{Object.entries(interestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select className={desktopFilterClass} aria-label="정렬" value={filters.order ?? 'latest'} onChange={event => choose({ order: event.target.value as CompanyFilters['order'] })}><option value="latest">최신순</option><option value="oldest">오래된순</option><option value="name">이름순</option></select></div>
    <div className="company-tag-heading"><strong className="lg:text-base!">태그로 검색</strong><button type="button" onClick={() => setTagDialog(true)} aria-label="태그 관리" title="태그 관리"><LucideIcon name="settings" /></button></div>
    <div className="company-tag-filters"><button type="button" className={`${filters.tag ? '' : 'is-active'} ${desktopTagClass}`} onClick={() => choose({ tag: undefined })}>전체</button>{shownTags.map(tag => <button type="button" key={tag} className={`${tagClass(tag, customTags)}${filters.tag === tag ? ' is-active' : ''} ${desktopTagClass}`} onClick={() => choose({ tag: filters.tag === tag ? undefined : tag })}>{tag}</button>)}
      {tags.length > 7 && <button type="button" className={desktopTagClass} onClick={() => setShowAllTags(value => !value)}>{showAllTags ? '접기' : '더보기'}</button>}</div>
    {actionError && <p className="mt-3! inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs! text-amber-800!" role="alert"><LucideIcon name="info" className="size-4 shrink-0" />{actionError}</p>}
    <div className="company-count lg:text-sm!">목록 {result?.totalElements ?? '—'}개</div>
    {loading ? <LoadingState message="기업 목록을 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
      : result && (result.items.length === 0 ? <div className="company-empty" role="status"><img src={emptyCat} alt="" /><h2 className="lg:text-xl!">{!search && !filters.industry && !filters.companySize && !filters.region && !filters.interestLevel && !filters.tag && !page ? '등록한 관심 기업이 없습니다.' : '조건에 맞는 관심 기업이 없습니다.'}</h2><p className="lg:text-base!">{!search && !filters.industry && !filters.companySize && !filters.region && !filters.interestLevel && !filters.tag && !page ? '관심 기업 등록 버튼으로 첫 기업을 기록해 보세요.' : '검색 조건을 바꾸거나 관심 기업을 등록해 주세요.'}</p></div>
        : <ul className="company-grid" aria-label="내 관심 기업 목록">{result.items.map(item => <li key={item.id} className="company-card relative gap-2.5! bg-white! p-3! lg:p-4!">
          <div className="company-card-top gap-1!"><span className={`company-logo company-logo--${item.id % 6} size-10! flex-[0_0_2.5rem]! rounded-[5px]! border-2! ${item.id % 6 === 1 ? 'border-[#a8e5cc]!' : 'border-[#dce2f2]!'} text-[1.35rem]! shadow-[inset_2px_2px_0_#ffffffb8,2px_2px_0_#dfe7f1]! lg:size-11! lg:flex-[0_0_2.75rem]!`}>{item.name.slice(0, 1)}</span><div className="company-card-title ml-2!"><a className="text-sm! font-black! tracking-tight lg:text-base!" href={`#/companies/${item.id}`}>{item.name}</a>{item.websiteUrl && <a href={item.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={`${item.name} 웹사이트 (새 창)`}><LucideIcon name="external" /></a>}</div>
            <button type="button" className={`company-favorite bg-transparent! hover:bg-transparent! focus:bg-transparent! active:bg-transparent! [&_.lucide-icon]:size-[18px]!${item.favorite ? ' is-active' : ''}`} disabled={busyId !== null} aria-label={`${item.name} ${item.favorite ? '즐겨찾기 해제' : '즐겨찾기'}`} aria-pressed={item.favorite} onClick={() => void favorite(item)}><LucideIcon name="star" /></button>
            <div className="company-menu-wrap"><button type="button" className="company-menu-button" aria-label={`${item.name} 메뉴`} aria-expanded={menuId === item.id} onClick={() => setMenuId(menuId === item.id ? null : item.id)}><LucideIcon name="more" /></button>{menuId === item.id && <div className="company-menu"><a href={`#/companies/${item.id}?edit=1`}>수정</a><button type="button" onClick={() => { setDeleting(item); setMenuId(null); }}>삭제</button></div>}</div></div>
          <div className="company-card-tags gap-1.5!">{item.tags.map(tag => <span key={tag} className={`${tagClass(tag, customTags)} min-h-6! rounded-[5px]! border-2! px-2! text-[11px]! shadow-[inset_1px_1px_0_#ffffffb8,1px_2px_0_#e4e9f1]! lg:min-h-7! lg:px-2! lg:text-xs!`} style={{ borderColor: 'color-mix(in srgb, var(--tag-ink) 30%, white)' }}>{tag}</span>)}{item.status !== 'INTERESTED' && <span className="company-status min-h-6! rounded-[5px]! border-2! border-[#dce1ef]! px-2! text-[11px]! lg:min-h-7! lg:px-2! lg:text-xs!">{statusLabels[item.status]}</span>}</div>
          <p className="company-card-note min-h-10! text-xs! leading-5! lg:text-sm!">{item.note || '등록된 메모가 없습니다.'}</p>
          <div className="company-card-meta mt-1 border-t-2 border-[#e9ecfb] pt-2 text-[10px]! lg:text-xs!"><span><LucideIcon name="building" />{item.industry || '산업 미입력'}</span><span><LucideIcon name="briefcase" />{item.companySize ? sizeLabels[item.companySize] : '규모 미입력'}</span><span><LucideIcon name="mapPin" />{item.region || '지역 미입력'}</span></div>
        </li>)}</ul>)}
    {result && result.totalElements > result.size && <nav className="company-pagination" aria-label="기업 목록 페이지"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>이전</button><span>{page + 1} / {Math.ceil(result.totalElements / result.size)}</span><button type="button" disabled={(page + 1) * result.size >= result.totalElements} onClick={() => setPage(value => value + 1)}>다음</button></nav>}
    {tagDialog && <TagManager onClose={() => { setTagDialog(false); companies.listTags().then(value => {
      setCustomTags(value); setActionError(''); if (filters.tag && !value.some(tag => tag.name === filters.tag)) choose({ tag: undefined });
      setRetry(current => current + 1);
    }).catch(failure => setActionError(tagMessage(failure))); }} />}
    {deleting && <div className="company-confirm-backdrop"><section className="company-confirm" role="dialog" aria-modal="true" aria-labelledby="company-delete-title"><h2 id="company-delete-title">기업 기록을 삭제할까요?</h2><p>“{deleting.name}”의 기록을 삭제합니다. 채용공고와 지원 기록은 유지됩니다.</p><div><button type="button" onClick={() => setDeleting(null)}>취소</button><button type="button" className="company-danger" disabled={busyId !== null} onClick={() => void remove()}>{busyId ? '삭제 중…' : '삭제 확인'}</button></div></section></div>}
  </section>;
}

function TagManager({ onClose }: { onClose: () => void }) {
  const [tags, setTags] = useState<CompanyTag[]>([]);
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<string>('blue');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dragId = useRef<number | null>(null);
  useEffect(() => { companies.listTags().then(value => { setTags(value); setError(''); })
    .catch(failure => setError(tagMessage(failure))); }, []);
  function resetForm() { setEditingId(null); setName(''); setColorKey('blue'); }
  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const value = editingId === null ? await companies.createTag(name.trim(), colorKey)
        : await companies.updateTag(editingId, name.trim(), colorKey);
      setTags(current => editingId === null ? [...current, value]
        : current.map(tag => tag.id === editingId ? value : tag));
      resetForm();
    }
    catch (failure) { setError(tagMessage(failure)); }
    finally { setBusy(false); }
  }
  function edit(tag: CompanyTag) { setEditingId(tag.id); setName(tag.name); setColorKey(tag.colorKey); }
  async function remove(tag: CompanyTag) {
    setBusy(true); setError('');
    try { await companies.removeTag(tag.id); setTags(current => current.filter(item => item.id !== tag.id)); if (editingId === tag.id) resetForm(); }
    catch (failure) { setError(tagMessage(failure)); }
    finally { setBusy(false); }
  }
  async function drop(targetId: number) {
    const sourceId = dragId.current; dragId.current = null;
    if (sourceId === null || sourceId === targetId || busy) return;
    const ordered = [...tags]; const from = ordered.findIndex(tag => tag.id === sourceId);
    const to = ordered.findIndex(tag => tag.id === targetId);
    if (from < 0 || to < 0) return;
    ordered.splice(to, 0, ...ordered.splice(from, 1));
    setBusy(true); setError('');
    try { setTags(await companies.reorderTags(ordered.map(tag => tag.id))); }
    catch (failure) { setError(tagMessage(failure)); }
    finally { setBusy(false); }
  }
  return <div className="company-tag-modal-backdrop fixed inset-0 z-[1300] grid place-items-center overflow-y-auto bg-[#1d244a91] p-3"><section className="company-tag-modal box-border max-h-[calc(100dvh-24px)] w-full max-w-[820px] overflow-y-auto rounded-xl border border-[#d8ddf5] bg-white p-4 text-[#182052] shadow-[0_18px_50px_#161c4670]" role="dialog" aria-modal="true" aria-labelledby="company-tag-title">
    <header className="flex items-start justify-between gap-3 border-b border-[#e3e7fa] pb-3"><div className="flex items-center gap-2.5"><LucideIcon name="tag" className="size-7 text-[#6650ef]" /><div><h2 id="company-tag-title" className="m-0 text-base! font-bold">태그 관리</h2><p className="m-0 mt-0.5 text-xs! text-[#65749f]!">관심 기업에 사용할 태그를 관리하세요.</p></div></div><button type="button" className="min-h-0! border-0! bg-transparent! p-1! text-[#28317d]!" onClick={onClose} aria-label="닫기"><LucideIcon name="close" className="size-5" /></button></header>
    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><div className="min-w-0">
      <div className="flex min-h-10 items-center gap-2 rounded-md border border-[#dce5ff] bg-[#f3f6ff] px-2.5 py-1.5 text-[11px] text-[#324eab]"><LucideIcon name="info" className="size-4 shrink-0 text-[#286bf0]" /><span>최대 30개의 태그를 추가할 수 있습니다.</span><strong className="ml-auto whitespace-nowrap">{tags.length} / 30개 사용 중</strong></div>
      {error && <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800" role="alert"><LucideIcon name="info" className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}
      {tags.length === 0 ? <div className="mt-2 rounded-md border border-dashed border-[#dce5ff] px-3 py-6 text-center text-xs text-[#7180a7]">태그를 추가하면 이곳에 목록이 표시됩니다.</div>
        : <div className="mt-2 overflow-x-auto rounded-md border border-[#dce5ff]"><table className="w-full border-collapse text-left text-xs text-[#1d285a]"><thead className="bg-[#f3f6ff] text-[11px] text-[#65749f]"><tr><th className="w-12 px-2 py-2">순서</th><th className="px-2 py-2">태그 이름</th><th className="w-12 px-2 py-2">색상</th><th className="w-20 px-2 py-2">관리</th></tr></thead><tbody>{tags.map(tag => <tr key={tag.id} draggable={!busy} onDragStart={() => { dragId.current = tag.id; }} onDragEnd={() => { dragId.current = null; }} onDragOver={event => event.preventDefault()} onDrop={() => void drop(tag.id)} className="border-t border-[#e5eafa]">
        <td className="px-2 py-1.5 text-[#8ca1cb]"><LucideIcon name="grip" className="size-4" /></td><td className="px-2 py-1.5 font-semibold">{tag.name}</td><td className="px-2 py-1.5"><span className={`company-color--${tag.colorKey} inline-block size-4 rounded-full bg-[var(--tag-solid)] align-middle`} title={tagColorLabels[tag.colorKey] || tag.colorKey} /></td><td className="px-2 py-1.5"><div className="flex gap-1"><button type="button" disabled={busy} onClick={() => edit(tag)} aria-label={`${tag.name} 수정`} className="min-h-0! border-[#dce5ff]! bg-white! p-1.5! text-[#4562bb]!"><LucideIcon name="pencil" className="size-3.5" /></button><button type="button" disabled={busy || tags.length <= 1} onClick={() => void remove(tag)} aria-label={`${tag.name} 삭제`} className="min-h-0! border-rose-200! bg-rose-50! p-1.5! text-rose-600!"><LucideIcon name="trash" className="size-3.5" /></button></div></td>
      </tr>)}</tbody></table></div>}
    </div>
      <div className="company-tag-create flex min-w-0 flex-col gap-4 rounded-md border border-[#dce5ff] p-4"><div className="flex items-center justify-between"><h3 className="m-0 text-sm font-bold">{editingId === null ? '태그 추가' : '태그 수정'}</h3><button type="button" className="min-h-0! border-0! bg-transparent! p-1! text-[#28317d]!" onClick={editingId === null ? onClose : resetForm} aria-label={editingId === null ? '닫기' : '수정 취소'}><LucideIcon name="close" className="size-4.5" /></button></div>
        <label className="block text-xs font-semibold text-[#263568]"><span className="inline-flex items-center gap-0.5">태그 이름 <span className="text-rose-500">*</span></span><input maxLength={20} value={name} onChange={event => setName(event.target.value)} placeholder="예) AI, 빅데이터, 프론트엔드, 데이터, 임베디드" className="mt-2 block min-h-10 w-full rounded-md border border-[#d8ddf5] bg-white px-2.5 py-2 text-xs text-[#1c275b] outline-none focus:border-[#6650ef] focus:ring-2 focus:ring-[#6650ef]/20" /><span className="mt-1 block text-right text-[11px] font-normal text-[#7180a7]">{name.length}/20</span></label>
        <div className="pb-3"><div className="mb-4 text-xs font-semibold text-[#263568]">색상 선택 <span className="text-rose-500">*</span></div><div className="grid grid-cols-5 justify-items-center gap-x-2 gap-y-3" role="group" aria-label="태그 색상">{tagColors.map(value => <button type="button" key={value} className={`company-color--${value} box-border! aspect-square! size-9! min-h-0! shrink-0! rounded-full! border-2! border-white! bg-[var(--tag-solid)]! p-0! shadow-[0_0_0_1px_#dce5ff]!${colorKey === value ? ' ring-2! ring-[#386bff]! ring-offset-2!' : ''}`} aria-label={tagColorLabels[value]} aria-pressed={colorKey === value} onClick={() => setColorKey(value)} />)}</div></div>
        <footer className="mt-auto flex justify-end gap-2 pt-4"><button type="button" onClick={resetForm} className="min-h-8! border-[#d8ddf5]! bg-white! px-3! py-1.5! text-xs! text-[#5541c0]!">취소</button><button type="button" disabled={busy || !name.trim() || (editingId === null && tags.length >= 30)} onClick={() => void save()} className="min-h-8! border-[#436df2]! bg-[#436df2]! px-3! py-1.5! text-xs! text-white! disabled:opacity-50!">{editingId === null ? '추가하기' : '저장하기'}</button></footer>
      </div></div></section></div>;
}

function CompanyEditor({ id, initialEdit = false }: { id?: number; initialEdit?: boolean }) {
  const [company, setCompany] = useState<InterestedCompany>();
  const [form, setForm] = useState<CompanyInput>(blank);
  const [editing, setEditing] = useState(!id || initialEdit);
  const [tab, setTab] = useState<'basic' | 'extra'>('basic');
  const [tags, setTags] = useState<CompanyTag[]>([]);
  const [tagDialog, setTagDialog] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { companies.listTags().then(setTags).catch(failure => setError(tagMessage(failure))); }, []);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); setLoading(true); setLoadError('');
    companies.get(id, controller.signal).then(value => { if (!controller.signal.aborted) { setCompany(value); setForm(inputFrom(value)); } })
      .catch(failure => { if (!controller.signal.aborted) setLoadError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  function change<K extends keyof CompanyInput>(key: K, value: CompanyInput[K]) { setForm(current => ({ ...current, [key]: value })); }
  function toggleTag(tag: string) {
    setForm(current => { const selected = current.tags ?? []; return { ...current, tags: selected.includes(tag) ? selected.filter(value => value !== tag)
      : selected.length < 5 ? [...selected, tag] : selected }; });
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    setError('');
    const name = form.name.trim(); if (!name) { setError('기업명을 입력해 주세요.'); setTab('basic'); return; }
    const websiteUrl = form.websiteUrl?.trim() || null;
    if (websiteUrl && !companyLink(websiteUrl)) { setError('웹사이트 주소를 확인해 주세요.'); setTab('basic'); return; }
    inFlight.current = true; setBusy(true);
    try {
      const input = { ...form, name, websiteUrl, note: form.note?.trim() || null };
      const value = id ? await companies.update(id, input) : await companies.create(input);
      if (!mounted.current) return;
      if (!id) window.location.hash = `/companies/${value.id}`;
      else { setCompany(value); setForm(inputFrom(value)); setEditing(false); }
    } catch (failure) { if (mounted.current) setError(failure instanceof ApiError && failure.status === 409
      ? '이 웹사이트는 내 관심 기업에 이미 등록되어 있습니다.' : message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (!id || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await companies.remove(id); if (mounted.current) window.location.hash = '/companies'; }
    catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  const allTags = [...new Set([...tags.map(value => value.name), ...(form.tags ?? [])])];
  return <><section className={`company-editor${editing ? '' : ' w-[min(100%,760px)]!'}`} role="dialog" aria-modal="true" aria-labelledby="company-editor-title">{editing
    ? <header className="company-editor-header"><img src={buildingIcon} alt="" /><div><h2 id="company-editor-title">{id ? '기업 수정' : '기업 추가'}</h2><p>{id ? '기업 기록을 수정하세요.' : '관심 있는 기업을 등록하세요.'}</p></div><a href="#/companies" aria-label="닫기">×</a></header>
    : <header className="flex items-center gap-3 px-4 py-3 sm:px-5"><img src={detailBuildingIcon} alt="" className="h-10 w-10 object-contain" /><div className="min-w-0 flex-1"><h2 id="company-editor-title" className="text-lg! font-extrabold text-[#141b50]">기업 상세</h2><p className="mt-0.5! text-xs! text-[#66739b] sm:text-sm!">관심 기업 기록을 확인하고 관리하세요.</p></div><a href="#/companies" aria-label="닫기" className="grid size-8 place-items-center rounded-lg border border-[#e1e6f5] bg-[#f6f8fc] text-[#536389] hover:bg-[#ecf0fa]"><LucideIcon name="close" className="size-4" /></a></header>}
    {loading ? <LoadingState message="기업 기록을 불러오고 있습니다." /> : loadError ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} /> : <>
      {error && !confirmDelete && <p className="mx-4! my-3! inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs! text-amber-800!" role="alert"><LucideIcon name="info" className="size-4 shrink-0" />{error}</p>}
      {editing ? <form className="company-form" onSubmit={save}><div className="company-form-tabs" role="tablist" aria-label="기업 입력 단계"><button type="button" role="tab" aria-selected={tab === 'basic'} onClick={() => setTab('basic')}>기본 정보</button><button type="button" role="tab" aria-selected={tab === 'extra'} onClick={() => setTab('extra')}>추가 정보</button></div>
        <fieldset disabled={busy || tab !== 'basic'} hidden={tab !== 'basic'}><label><span className="inline-flex items-center gap-0.5">기업명 <em>*</em></span><input required={tab === 'basic'} maxLength={200} value={form.name} onChange={event => change('name', event.target.value)} placeholder="예) 네이버" /></label>
          <label>기업 URL<input type="url" maxLength={2048} value={form.websiteUrl ?? ''} onChange={event => change('websiteUrl', event.target.value || null)} placeholder="https://" /></label>
          <label>산업 분야<select value={form.industry ?? ''} onChange={event => change('industry', event.target.value || null)}><option value="">산업 분야를 선택하세요.</option>{industries.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>기업 규모<select value={form.companySize ?? ''} onChange={event => change('companySize', event.target.value as CompanySize || null)}><option value="">기업 규모를 선택하세요.</option>{Object.entries(sizeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>지역<select value={form.region ?? ''} onChange={event => change('region', event.target.value || null)}><option value="">지역을 선택하세요.</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
          <div className="company-form-tags"><strong>태그 <small>(기업당 최대 5개 · 태그 전체 최대 30개)</small></strong><div>{allTags.map(tag => <button type="button" key={tag} className={`${tagClass(tag, tags)}${form.tags?.includes(tag) ? ' is-selected' : ''}`} aria-pressed={form.tags?.includes(tag) ?? false} onClick={() => toggleTag(tag)}>{tag}</button>)}</div><button type="button" className="company-add-tag" disabled={tags.length >= 30} onClick={() => setTagDialog(true)}>＋ 새 태그 추가</button></div>
          <label>메모 <small>(선택)</small><textarea maxLength={2000} rows={4} value={form.note ?? ''} onChange={event => change('note', event.target.value || null)} placeholder="이 기업에 대한 메모를 작성해 보세요." /><small className="company-note-count">{form.note?.length ?? 0}/2000</small></label>
        </fieldset>
        <fieldset disabled={busy || tab !== 'extra'} hidden={tab !== 'extra'}><label>관심도<select value={form.interestLevel ?? 'MEDIUM'} onChange={event => change('interestLevel', event.target.value as InterestLevel)}>{Object.entries(interestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>관리 상태<select value={form.status} onChange={event => change('status', event.target.value as CompanyStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="company-form-favorite"><input type="checkbox" checked={form.favorite ?? false} onChange={event => change('favorite', event.target.checked)} />즐겨찾기에 추가</label></fieldset>
        <footer>{id ? <button type="button" className="company-cancel" onClick={() => { if (company) setForm(inputFrom(company)); setEditing(false); setError(''); }}>취소</button> : <a href="#/companies">취소</a>}<button type="submit" disabled={busy}>{busy ? '저장 중…' : id ? '저장하기' : '등록하기'}</button></footer></form>
        : company && <div className="mx-3 mb-3 rounded-xl border border-[#e3e8f4] bg-white p-4 shadow-[0_3px_15px_#253c6810] sm:mx-5 sm:mb-5 sm:p-5">
          <div className="flex flex-wrap items-center gap-4 border-b border-[#e7ebf6] pb-4"><span className={`company-logo company-logo--${company.id % 6} h-18! w-18! flex-none! rounded-xl! text-4xl! shadow-sm`}>{company.name.slice(0, 1)}</span><div className="min-w-0 flex-1"><h3 className="m-0 break-words text-xl font-extrabold text-[#151b48] sm:text-2xl">{company.name}</h3><div className="mt-2 flex flex-wrap items-center gap-1.5">{company.tags.map(tag => <span key={tag} className={`${tagClass(tag, tags)} rounded-md px-2.5 py-1 text-xs font-bold`} style={{ background: 'var(--tag-bg)', color: 'var(--tag-ink)' }}># {tag}</span>)}</div></div>{company.websiteUrl && <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label="기업 웹사이트 보기 (새 창)" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#cec9ef] bg-white px-3 text-xs font-bold text-[#5541c0] shadow-sm hover:bg-[#f7f5ff]"><LucideIcon name="external" className="size-4" />기업 웹사이트 보기</a>}</div>
          <dl className="mt-4 grid grid-cols-2 gap-2.5 min-[560px]:grid-cols-3">{([
            [0, '산업 분야', company.industry || '미입력', 'bg-[#f0f4ff]'],
            [1, '기업 규모', company.companySize ? sizeLabels[company.companySize] : '미입력', 'bg-[#fff3f6]'],
            [2, '지역', company.region || '미입력', 'bg-[#fff9e9]'],
            [3, '관심도', interestLabels[company.interestLevel], 'bg-[#eaf8f3]'],
            [4, '관리 상태', statusLabels[company.status], 'bg-[#edf3ff]'],
            [5, '수정일', displayDate(company.updatedAt), 'bg-[#f4efff]'],
          ] as const).map(([icon, label, value, tone]) => <div key={label} className={`flex min-h-16 items-center gap-1.5 rounded-lg p-2.5 ${tone}`}><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/70"><DetailSprite index={icon} className="size-8" /></span><div className="min-w-0"><dt className="text-[11px] text-[#6b789e]">{label}</dt><dd className="m-0! mt-0.5! break-words text-left! text-sm font-bold text-[#172052]">{value}</dd></div></div>)}</dl>
          <section className="company-detail-note mt-4 rounded-lg border border-[#e3e8f4] bg-[#fbfcff] p-3"><div className="flex items-center justify-between gap-2"><h4 className="m-0 inline-flex items-center gap-1.5 text-sm font-bold text-[#192453]"><DetailSprite index={6} className="size-5" />메모</h4>{!company.note && <button type="button" className="inline-flex h-8! min-h-0! items-center gap-1 rounded-md border border-[#dbe3f5] bg-white px-2! py-0! text-xs! font-semibold text-[#4d58aa] shadow-sm" onClick={() => { setTab('basic'); setEditing(true); }}><DetailSprite index={7} className="size-6 [image-rendering:pixelated]" />메모 추가</button>}</div>{company.note ? <p className="mt-2! whitespace-pre-wrap break-words rounded-md border border-[#e4e9f6] bg-white p-3 text-sm! text-[#37446f]!">{company.note}</p> : <div className="mt-2 grid min-h-22 place-items-center rounded-md border border-dashed border-[#d5dff1] bg-white text-center text-xs text-[#7180a7]"><div className="flex flex-col items-center justify-center gap-1"><DetailSprite index={6} className="size-7" /><span>등록된 메모가 없습니다.</span></div></div>}</section>
          <footer className="mt-3 flex justify-end gap-2"><button type="button" className="h-8! min-h-0! rounded-md border border-[#dbe3f5] bg-white px-2.5! py-0! text-xs! font-semibold text-[#4d58aa]" onClick={() => setEditing(true)}>수정</button><button type="button" className="h-8! min-h-0! rounded-md border border-[#f2dce4] bg-white px-2.5! py-0! text-xs! font-semibold text-[#b54f6c]" onClick={() => { setError(''); setConfirmDelete(true); }}>삭제</button></footer></div>}
    </>}
    {tagDialog && <TagManager onClose={() => { setTagDialog(false); companies.listTags().then(value => {
      setTags(value); setForm(current => ({ ...current, tags: current.tags?.filter(tag => value.some(option => option.name === tag)) }));
    }).catch(failure => setError(tagMessage(failure))); }} />}
  </section>
    {confirmDelete && company && <div className="company-confirm-backdrop company-detail-confirm-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) setConfirmDelete(false); }}>
      <div className="company-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="company-detail-delete-title">
        <header><span className="company-delete-icon"><LucideIcon name="trash" /></span><div><h2 id="company-detail-delete-title">기업 기록을 삭제할까요?</h2><p>채용공고와 지원 기록은 유지됩니다.</p></div></header>
        <div className="company-delete-content"><strong>{company.name}</strong>{error && <p role="alert">{error}</p>}</div>
        <footer><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>취소</button><button type="button" className="company-delete-confirm" disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중…' : '삭제'}</button></footer>
      </div>
    </div>}
  </>;
}
