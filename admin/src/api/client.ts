import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 30_000,
});

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(fn: () => void) {
  unauthorizedHandler = fn;
}

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: { code: string; message: string; details?: { path: string; message: string }[] } }>) => {
    const status = error.response?.status ?? 0;
    const payload = error.response?.data?.error;

    if (status === 401 && unauthorizedHandler) unauthorizedHandler();

    const message =
      payload?.message ||
      (status === 0 ? '连不上服务器，确认后端是否在运行' : error.message) ||
      '请求失败';

    return Promise.reject(new ApiError(status, payload?.code || 'NETWORK_ERROR', message, payload?.details));
  },
);

async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) => unwrap<T>(http.get(url, { params })),
  post: <T>(url: string, body?: unknown) => unwrap<T>(http.post(url, body)),
  put: <T>(url: string, body?: unknown) => unwrap<T>(http.put(url, body)),
  patch: <T>(url: string, body?: unknown) => unwrap<T>(http.patch(url, body)),
  delete: <T>(url: string) => unwrap<T>(http.delete(url)),
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.details?.length) return `${e.message}：${e.details.map((d) => d.message).join('；')}`;
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}
