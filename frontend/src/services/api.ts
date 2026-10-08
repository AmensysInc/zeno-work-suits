import axios from 'axios';
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('trackly_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config.url.includes('/auth/')
    ) {
      localStorage.removeItem('trackly_token');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d: { msg: string }) => d.msg).join(', ')
        : 'Unable to save. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
