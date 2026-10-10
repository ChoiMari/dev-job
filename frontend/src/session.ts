import { ApiError } from './api/client.ts';

export function sessionFailureKind(failure: unknown): 'anonymous' | 'error' {
  return failure instanceof ApiError && failure.status === 401 ? 'anonymous' : 'error';
}

export function anonymousRoute(path: string): 'home' | 'auth' | 'login' {
  if (path === '/') return 'home';
  if (path === '/login' || path === '/register') return 'auth';
  return 'login';
}
