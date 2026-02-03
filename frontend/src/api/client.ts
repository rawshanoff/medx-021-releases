import axios from 'axios';
import { clearAuth, getToken, isTokenExpired } from '../utils/auth';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const emitEvent = (name: string, detail?: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

// Retry configuration
interface RetryConfig {
  retryCount: number;
  maxRetries: number;
  retryDelay: number;
}

const retryConfig: Record<string, RetryConfig> = {};

const getRetryConfig = (url: string): RetryConfig => {
  if (!retryConfig[url]) {
    retryConfig[url] = { retryCount: 0, maxRetries: 3, retryDelay: 1000 };
  }
  return retryConfig[url];
};

const resetRetryConfig = (url: string) => {
  delete retryConfig[url];
};

// Interceptor to attach tokens
client.interceptors.request.use((config) => {
  emitEvent('api:loading', { delta: 1 });

  const token = getToken();
  if (token) {
    if (isTokenExpired(token)) {
      clearAuth();
      emitEvent('auth:logout', { reason: 'expired' });
      return Promise.reject(new Error('Session expired'));
    }
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

client.interceptors.response.use(
  (response) => {
    emitEvent('api:loading', { delta: -1 });
    resetRetryConfig(response.config.url || '');
    return response;
  },
  async (error) => {
    emitEvent('api:loading', { delta: -1 });

    const status = error?.response?.status;
    const url = error?.config?.url || '';

    if (status === 401) {
      clearAuth();
      emitEvent('auth:logout', { reason: 'unauthorized' });
      resetRetryConfig(url);
      return Promise.reject(error);
    }

    if (status === 403) {
      const detail = error?.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && detail[0]?.msg
            ? String(detail[0].msg)
            : 'Нет доступа';
      emitEvent('api:error', { message });
      resetRetryConfig(url);
      return Promise.reject(error);
    }

    // Retry logic for server errors (5xx) and network errors
    const isServerError = status >= 500;
    const isNetworkError = !error?.response;
    const isRetryable = isServerError || isNetworkError;

    if (isRetryable && error?.config) {
      const config = getRetryConfig(url);
      if (config.retryCount < config.maxRetries) {
        config.retryCount++;
        await new Promise((resolve) => setTimeout(resolve, config.retryDelay * config.retryCount));
        return client(error.config);
      }
    }

    resetRetryConfig(url);

    const detail = error?.response?.data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
          ? String(detail[0].msg)
          : error?.message || 'Ошибка запроса';
    emitEvent('api:error', { message });
    return Promise.reject(error);
  },
);

export default client;
