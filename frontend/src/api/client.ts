export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

function isErrorBody(value: unknown): value is { code: string; message: string } {
  return typeof value === 'object' && value !== null
    && 'code' in value && typeof value.code === 'string'
    && 'message' in value && typeof value.message === 'string';
}

// Returns unknown intentionally: resource-specific validation belongs to later stages.
export function createApiClient(baseUrl: string, fetcher: typeof fetch = fetch) {
  return async (path: string, options: RequestOptions = {}): Promise<unknown> => {
    if (!path.startsWith('/') || path.startsWith('//') || /[?#]/.test(path)) {
      throw new TypeError('API 경로는 /로 시작하고 query 옵션으로 검색 조건을 전달해야 합니다.');
    }
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    let response: Response;
    try {
      response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}${suffix}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
        // S03 must establish authentication before cookies or tokens are sent.
        credentials: 'omit',
      });
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      throw new ApiError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', 0, 'NETWORK_ERROR');
    }
    if (response.status === 204) return undefined;

    let data: unknown;
    try {
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) throw new Error('Expected JSON');
      data = await response.json();
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      throw new ApiError(
        response.ok ? '서버 응답을 확인할 수 없습니다.' : '요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.',
        response.status,
        response.ok ? 'INVALID_RESPONSE' : 'HTTP_ERROR',
      );
    }
    if (!response.ok) {
      throw new ApiError(
        isErrorBody(data) ? data.message : '요청을 처리할 수 없습니다.',
        response.status,
        isErrorBody(data) ? data.code : 'HTTP_ERROR',
      );
    }
    return data;
  };
}
