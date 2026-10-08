import { createApiClient } from './client';
import { ApiError } from './client';
import { createAuthApi } from './auth';
import { createProfileApi } from './profile';

const request = createApiClient(import.meta.env.VITE_API_BASE_URL || '/api');
export const apiRequest: typeof request = async (path, options) => {
  try { return await request(path, options); }
  catch (error) {
    // A password-change 401 can mean a wrong current password while the session remains valid.
    if (error instanceof ApiError && error.status === 401 && path !== '/auth/password')
      window.dispatchEvent(new Event('devjob:unauthorized'));
    throw error;
  }
};
export const authApi = createAuthApi(apiRequest, request);
export const profileApi = createProfileApi(apiRequest);
