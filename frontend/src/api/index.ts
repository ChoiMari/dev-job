import { createApiClient } from './client';
import { ApiError } from './client';
import { createAuthApi } from './auth';

const request = createApiClient(import.meta.env.VITE_API_BASE_URL || '/api');
export const apiRequest: typeof request = async (path, options) => {
  try { return await request(path, options); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) window.dispatchEvent(new Event('devjob:unauthorized'));
    throw error;
  }
};
export const authApi = createAuthApi(apiRequest);
