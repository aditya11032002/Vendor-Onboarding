export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiFetch = async (url, options = {}) => {
  const mergedOptions = {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    }
  };

  // Maintain backward compatibility with the Authorization header if local token is present
  const savedToken = localStorage.getItem('admin_token');
  if (savedToken && (!mergedOptions.headers || !mergedOptions.headers['Authorization'])) {
    if (!mergedOptions.headers) {
      mergedOptions.headers = {};
    }
    mergedOptions.headers['Authorization'] = `Bearer ${savedToken}`;
  }

  return fetch(url, mergedOptions);
};
