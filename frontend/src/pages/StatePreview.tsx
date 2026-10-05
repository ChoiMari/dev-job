import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/States';

type PreviewState = 'loading' | 'empty' | 'error';

export function StatePreview() {
  const [state, setState] = useState<PreviewState>('loading');
  return <section className="card" aria-label="공통 상태 미리보기">
    <p>공통 컴포넌트의 표시를 확인하는 미리보기입니다.</p>
    <div className="state-controls" role="group" aria-label="표시할 상태">
      {([['loading', '로딩'], ['empty', '빈 화면'], ['error', '오류']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={state === value} onClick={() => setState(value)}>{label}</button>,
      )}
    </div>
    {state === 'loading' && <LoadingState />}
    {state === 'empty' && <EmptyState message="내용이 준비되면 이곳에 표시됩니다." />}
    {state === 'error' && <ErrorState message="미리보기용 오류입니다. 다시 시도하면 로딩 상태를 확인할 수 있습니다." onRetry={() => setState('loading')} />}
  </section>;
}
