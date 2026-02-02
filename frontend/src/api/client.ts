import axios from 'axios';
import { clearAuth, getToken, isTokenExpired } from '../utils/auth';

export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const emitEvent = (name: string, detail?: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
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

  const licenseKey = localStorage.getItem('medx_license_key');
  if (licenseKey) {
    config.headers['X-License-Key'] = licenseKey;
  }

  return config;
});

client.interceptors.response.use(
  (response) => {
    emitEvent('api:loading', { delta: -1 });
    return response;
  },
  (error) => {
    emitEvent('api:loading', { delta: -1 });

    const status = error?.response?.status;
    if (status === 401) {
      clearAuth();
      emitEvent('auth:logout', { reason: 'unauthorized' });
      return Promise.reject(error);
    }

    const message = error?.response?.data?.detail || error?.message || 'Ошибка запроса';
    if (status === 403) {
      emitEvent('api:error', { message: message || 'Нет доступа' });
      return Promise.reject(error);
    }
    emitEvent('api:error', { message });
    return Promise.reject(error);
  },
);

export default client;
