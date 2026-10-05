import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/States';
import { Badge } from '../components/PixelArt';

type PreviewState = 'loading' | 'empty' | 'error' | 'success';

export function StatePreview() {
  const [state, setState] = useState<PreviewState>('loading');
  return <section className="card" aria-label="공통 상태 미리보기">
    <Badge tone="primary">컴포넌트 미리보기</Badge>
    <p>상태를 선택해 안내와 표시를 확인하세요. 실제 데이터 처리 결과가 아닌 미리보기입니다.</p>
    <div className="state-controls" role="group" aria-label="표시할 상태">
      {([['loading', '로딩'], ['empty', '빈 화면'], ['error', '오류'], ['success', '성공']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={state === value} onClick={() => setState(value)}>{label}</button>,
      )}
    </div>
    {state === 'loading' && <LoadingState />}
    {state === 'empty' && <EmptyState message="내용이 준비되면 이곳에 표시됩니다." />}
    {state === 'error' && <ErrorState message="미리보기용 오류입니다. 다시 시도하면 로딩 상태를 확인할 수 있습니다." onRetry={() => setState('loading')} />}
    {state === 'success' && <SuccessState title="작업을 완료했습니다." message="성공 안내 미리보기입니다. 실제 데이터는 변경되지 않습니다." />}
  </section>;
}
