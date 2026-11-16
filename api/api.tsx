import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BASE_URL } from './baseurl';

function getUrl(path: string): string {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function request<T = unknown>(path: string, options: AxiosRequestConfig = {}): Promise<T> {
  const response: AxiosResponse<T> = await axios.request<T>({
    url: getUrl(path),
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  return response.data;
}

// Types
export interface PositionPayload {
  [key: string]: any;
}

export interface ApiResponse {
  success?: boolean;
  message?: string;
  [key: string]: any;
}

export const api = {
  get<T = unknown>(path: string, options?: AxiosRequestConfig) {
    return request<T>(path, { ...options, method: 'GET' });
  },

  post<T = unknown>(path: string, data?: unknown, options?: AxiosRequestConfig) {
    return request<T>(path, { ...options, method: 'POST', data });
  },

  delete<T = unknown>(path: string, options?: AxiosRequestConfig) {
    return request<T>(path, { ...options, method: 'DELETE' });
  },

  update<T = unknown>(path: string, data?: unknown, options?: AxiosRequestConfig) {
    return request<T>(path, { ...options, method: 'PUT', data });
  },

  patch<T = unknown>(path: string, data?: unknown, options?: AxiosRequestConfig) {
    return request<T>(path, { ...options, method: 'PATCH', data });
  },

  getActiveUsers: <T = unknown>() => api.get<T>('/active-users'),
  getSLClientList: <T = unknown>() => api.get<T>('/sl_client_list'),
  getLotSizes: <T = unknown>() => api.get<T>('/lot-sizes'),
  getInitialOrders: <T = unknown>(userId: string | number) => api.get<T>(`/initial-orders/${userId}`),
  getInitialPositions: <T = unknown>(userId: string | number) => api.get<T>(`/initial-positions/${userId}`),
  getInitialSLMonitor: <T = unknown>(userId: string | number) => api.get<T>(`/initial-sl-monitor/${userId}`),
  getRatios: <T = unknown>() => api.get<T>('/ratios'),
  getRules: <T = unknown>() => api.get<T>('/rule/'),
  getStaticRules: <T = unknown>() => api.get<T>('/static_rules/'),
  getHistoricalStraddle: <T = unknown>(params: { index: string; from_date: string; to_date: string; interval?: number }) =>
    api.post<T>('/historical-straddle', params),
  getTodayIv: <T = unknown>(index: string, interval: number) =>
    api.get<T>(`/iv/${encodeURIComponent(index)}`, { params: { interval } }),
  getAvailableFunds: <T = unknown>(clientId: string | number) => api.get<T>(`/show_available_fund/${clientId}`),
  getCasTable: <T = unknown>(index: string) => api.get<T>(`/cas-table/${index}`),

  addPosition: <T = ApiResponse>(payload: PositionPayload) =>
    api.post<T>('/add_position', payload),

  reducePosition: <T = ApiResponse>(payload: PositionPayload) =>
    api.post<T>('/reduce_position', payload),

  squareOffPosition: <T = ApiResponse>(payload: PositionPayload) =>
    api.post<T>('/squareoff_position', payload),
};

export function wsUrl(path: string): string {
  const host = location.hostname || 'localhost';

  if (import.meta.env.DEV) {
    return `ws://${host}:8000${path}`;
  }

  return `wss://${host}${path}`;
}