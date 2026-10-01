let accessToken = null;
let refreshToken = null;

export const getAccessToken = () => accessToken;

export const getRefreshToken = () => refreshToken || localStorage.getItem("refreshToken") || null;

export const setTokens = (access, refresh) => {
  accessToken = access || null;
  refreshToken = refresh || null;

  if (refresh) localStorage.setItem("refreshToken", refresh);
  else localStorage.removeItem("refreshToken");
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("refreshToken");
};

export const loadRefreshToken = () => {
  refreshToken = localStorage.getItem("refreshToken") || null;
  return refreshToken;
};