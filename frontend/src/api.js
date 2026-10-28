const BASE = '/v1';

let _token = null;
export const setToken = (t) => { _token = t; };
export const getToken = () => _token;

async function request(method, path, body, useToken = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useToken && _token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// Health
export const health = () => request('GET', '/health', null, false);

// Auth
export const register = (b) => request('POST', '/auth/register', b, false);
export const login = (b) => request('POST', '/auth/login', b, false);
export const refresh = (b) => request('POST', '/auth/refresh', b, false);
export const logout = (b) => request('POST', '/auth/logout', b, false);
export const forgotPassword = (b) => request('POST', '/auth/forgot-password', b, false);
export const verifyOtp = (b) => request('POST', '/auth/verify-otp', b, false);
export const resetPassword = (b) => request('POST', '/auth/reset-password', b, false);

// ATMs
export const nearbyAtms = (params) => request('GET', `/atms/nearby?${new URLSearchParams(params)}`, null, false);
export const searchAtms = (params) => request('GET', `/atms/search?${new URLSearchParams(params)}`, null, false);
export const getAtm = (id, params = {}) => request('GET', `/atms/${id}?${new URLSearchParams(params)}`, null, false);

// Reports
export const createReport = (atmId, b) => request('POST', `/atms/${atmId}/reports`, b);
export const getReports = (atmId, params = {}) => request('GET', `/atms/${atmId}/reports?${new URLSearchParams(params)}`, null, false);

// Favorites
export const getFavorites = (params = {}) => request('GET', `/me/favorites?${new URLSearchParams(params)}`);
export const addFavorite = (atmId) => request('PUT', `/me/favorites/${atmId}`, null);
export const removeFavorite = (atmId) => request('DELETE', `/me/favorites/${atmId}`, null);

// Navigation
export const getRoute = (b) => request('POST', '/navigation/route', b, false);

// Account
export const getMe = () => request('GET', '/me');
export const updateMe = (b) => request('PATCH', '/me', b);
export const changePassword = (b) => request('POST', '/me/change-password', b);
export const deleteMe = () => request('DELETE', '/me');

// Recent Searches
export const getRecentSearches = () => request('GET', '/me/recent-searches');
export const addRecentSearch = (b) => request('POST', '/me/recent-searches', b);
export const clearRecentSearches = () => request('DELETE', '/me/recent-searches');
