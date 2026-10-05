import { createApiClient } from './client';

export const apiRequest = createApiClient(import.meta.env.VITE_API_BASE_URL || '/api');
