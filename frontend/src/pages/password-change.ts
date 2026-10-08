import { ApiError } from '../api/client.ts';

export function validatePasswordChange(current: string, next: string, confirmation: string): string {
  const bytes = (value: string) => new TextEncoder().encode(value).length;
  if (!current.trim()) return '현재 비밀번호를 입력해 주세요.';
  if (bytes(current) > 72) return '현재 비밀번호는 UTF-8 기준 72바이트 이내로 입력해 주세요.';
  if (!next.trim() || next.length < 8) return '새 비밀번호는 8자 이상 입력해 주세요.';
  if (bytes(next) > 72) return '새 비밀번호는 UTF-8 기준 72바이트 이내로 입력해 주세요.';
  if (current === next) return '새 비밀번호는 현재 비밀번호와 달라야 합니다.';
  if (next !== confirmation) return '새 비밀번호 확인이 일치하지 않습니다.';
  return '';
}

export function passwordChangeError(failure: unknown): string {
  if (failure instanceof ApiError) {
    if (failure.status === 400) return '비밀번호 입력값을 확인해 주세요. 새 비밀번호는 현재 비밀번호와 달라야 합니다.';
    if (failure.status === 403) return '보안 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.';
    return failure.message;
  }
  return '비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.';
}
