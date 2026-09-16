import { createContext, useContext, useEffect, useState } from "react";
import {
  clearTokens,
  extractToken,
  gymOwnerLogin,
  gymUserLogin,
  platformLogin,
  registerGymMember,
  unwrapObject,
  memberCheckIn,
  trainerCheckIn,
  getRefreshToken,
  loadRefreshToken,
  refreshAuthToken,
  setTokens,
  logoutAuth,
  logoutAllAuth,
} from "../services/api";
import { getRoleLabel, isValidPortalLogin, normalizePermissions } from "../utils/rbac";

/* eslint-disable react-refresh/only-export-components */
const AuthContext = createContext();

function readJson(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readJson("authSession", null));
  const [loading, setLoading] = useState(true);

  const persistSession = (session) => {
    setUser(session);
    localStorage.setItem("authSession", JSON.stringify(session));
  };

  useEffect(() => {
    const storedRefreshToken = loadRefreshToken();
    if (!storedRefreshToken) {
      setLoading(false);
      return;
    }
    refreshAuthToken(storedRefreshToken)
      .then((response) => {
        const data = response?.data || response;
        setTokens(data.accessToken, data.refreshToken);
        const stored = readJson("authSession", {}) || {};
        persistSession({ ...stored, token: data.accessToken, accessToken: data.accessToken });
      })
      .catch(() => {
        clearTokens();
        localStorage.removeItem("authSession");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateUser = (nextUser) => {
    persistSession(nextUser);
  };

  const register = async (payload) => {
    const response = await registerGymMember(payload);
    return unwrapObject(response);
  };

  const login = async ({ email, password, gymSlug, loginType }) => {
    const credentials = loginType === "platform" ? { email, password } : { email, gymSlug, password };
    const response =
      loginType === "platform"
        ? await platformLogin({ email, password })
        : loginType === "owner"
          ? await gymOwnerLogin(credentials)
          : await gymUserLogin(credentials);

    const responseData = response?.data || response;
    const token = extractToken(responseData);
    if (!token) return null;

    setTokens(token, responseData.refreshToken || responseData.hashedRefreshToken || responseData.data?.refreshToken);

    const responseUser = unwrapObject(responseData);
    const userId = responseUser.id || responseUser._id || responseUser.userId || responseUser.user?.id || "";

    if (!isValidPortalLogin(loginType, responseUser)) {
      clearTokens();
      localStorage.removeItem("authSession");
      setUser(null);
      const portalName =
        loginType === "platform"
          ? "Platform Admin"
          : loginType === "owner"
            ? "Gym Owner"
            : loginType === "staff"
              ? "Gym Staff"
              : "Gym Member";
      throw new Error(`Invalid user: this account is not a ${portalName}.`);
    }

    const storedPermissions = userId ? readJson(`userPermissions:${userId}`, []) : [];
    const responsePermissions = normalizePermissions(
      responseUser.permissions || responseUser.userPermissions || responseUser.user?.permissions || responseData.permissions
    );
    const role =
      loginType === "platform"
        ? "Platform Admin"
        : getRoleLabel(
            responseUser.role || responseUser.user?.roles?.[0] || (loginType === "owner" ? "Gym Owner" : loginType),
            loginType
          );
    const session = {
      token,
      accessToken: token,
      id: userId,
      email,
      gymId: responseUser.gymId || responseUser.gym?.id || "",
      gymSlug: responseUser.gymSlug || responseUser.slug || responseUser.gym?.slug || gymSlug || "",
      name: responseUser.name || responseUser.ownerName || email,
      role,
      staffRole: responseUser.staffRole || responseUser.roleName || responseUser.designation || responseUser.position || responseUser.type || "",
      userRole: responseUser.role || responseUser.userRole || "",
      loginType,
      refreshToken: responseData.refreshToken || responseData.data?.refreshToken || "",
      permissions: responsePermissions.length ? responsePermissions : storedPermissions,
    };

    persistSession(session);

    // Auto check-in for members and trainers (uses JWT identity - no body needed)
    try {
      if (loginType === "member" && userId) {
        await memberCheckIn(token);
        localStorage.setItem("checkInTime", JSON.stringify(new Date().toISOString()));
      } else if (loginType === "trainer" && userId) {
        await trainerCheckIn(token);
        localStorage.setItem("checkInTime", JSON.stringify(new Date().toISOString()));
      }
    } catch (error) {
      console.warn("Auto check-in failed:", error.message);
      // Don't interrupt login flow if check-in fails
    }

    return session;
  };

  const logout = async () => {
    const storedRefreshToken = getRefreshToken();
    try {
      if (storedRefreshToken) await logoutAuth(storedRefreshToken, user?.accessToken || user?.token);
    } catch {
      // Clear local state even when the server session is already invalid.
    }
    clearTokens();
    setUser(null);
    localStorage.removeItem("authSession");
    localStorage.removeItem("user");
    localStorage.removeItem("checkInTime");
  };

  const logoutAll = async () => {
    try {
      await logoutAllAuth(user?.accessToken || user?.token);
    } finally {
      clearTokens();
      setUser(null);
      localStorage.removeItem("authSession");
      localStorage.removeItem("user");
      localStorage.removeItem("checkInTime");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, logoutAll, register, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
