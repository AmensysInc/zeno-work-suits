import axios from 'axios';

/** Browser storage keys; kept from the previous app so sessions survive the upgrade. */
export const TOKEN_KEY = 'trackly_token';
export const PROJECT_KEY = 'trackly_project';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Forgets the signed-in session, including the last project visited, so the
 * next person to sign in on this browser does not start in someone else's project.
 */
export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROJECT_KEY);
  } catch {
    /* storage unavailable */
  }
}

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config.url.includes('/auth/')
    ) {
      clearSession();
      window.location.assign('/login');
    }
    // Still on an admin-issued temporary password: the server allows nothing else.
    if (
      error.response?.status === 403 &&
      error.response.data?.detail ===
        'Choose a new password before continuing' &&
      window.location.pathname !== '/change-password'
    ) {
      window.location.assign('/change-password');
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
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
