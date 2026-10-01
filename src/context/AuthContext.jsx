import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  clearTokens,
  extractToken,
  platformLogin,
  tenantLogin,
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
  getCurrentSubscription,
} from "../services/api";
import { getPrimaryRole, getRoleLabel, getUserRoles, normalizePermissions } from "../utils/rbac";

/* eslint-disable react-refresh/only-export-components */
const AuthContext = createContext();

function readJson(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function getTokenClaims(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function getAuthPayload(response) {
  const responseData = response?.data || response || {};
  const authData = responseData.data && typeof responseData.data === "object" ? responseData.data : responseData;
  const responseUser = authData.user || responseData.user || {};
  const roles = getUserRoles({ roles: responseUser.roles || responseUser.role });
  const token = extractToken(responseData);
  const refreshToken = authData.refreshToken || responseData.refreshToken || "";
  const claims = getTokenClaims(token);
  const id = responseUser.id || responseUser._id || responseUser.userId || claims.id || claims.sub || "";
  const gymId = responseUser.gymId || responseUser.gym?.id || authData.gymId || claims.gymId || claims.gym_id || "";

  return { responseData, authData, responseUser, roles, token, refreshToken, id, gymId };
}

function getSubscriptionStatus(response) {
  const subscription = response?.data?.subscription
    || response?.data?.data?.subscription
    || response?.subscription
    || response?.data?.data
    || response?.data
    || response
    || {};
  return String(subscription?.status || subscription?.subscriptionStatus || "").toUpperCase();
}

function isOwnerSession(session) {
  return getPrimaryRole(session) === "gym_owner";
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readJson("authSession", null));
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((session) => {
    const nextSession = session
      ? {
          ...session,
          accessToken: session.accessToken || session.token || null,
          token: session.token || session.accessToken || null,
        }
      : null;

    setUser(nextSession);
    if (nextSession) {
      localStorage.setItem("authSession", JSON.stringify(nextSession));
      setTokens(nextSession.accessToken || nextSession.token, nextSession.refreshToken || getRefreshToken());
      return;
    }

    localStorage.removeItem("authSession");
  }, []);

  const refreshSubscriptionStatus = useCallback(async (session = null) => {
    const currentSession = session || readJson("authSession", null);
    if (!currentSession || !isOwnerSession(currentSession)) return currentSession;

    let subscriptionStatus = currentSession.subscriptionStatus || "";
    try {
      const response = await getCurrentSubscription(currentSession.accessToken || currentSession.token);
      subscriptionStatus = getSubscriptionStatus(response) || subscriptionStatus;
    } catch {
      // Keep the last known status when the subscription endpoint is temporarily unavailable.
    }

    const nextSession = { ...currentSession, subscriptionStatus };
    persistSession(nextSession);
    return nextSession;
  }, [persistSession]);

  useEffect(() => {
    const handleExpiredSession = () => {
      clearTokens();
      localStorage.removeItem("authSession");
      setUser(null);
    };
    window.addEventListener("auth:expired", handleExpiredSession);

    const storedSession = readJson("authSession", null);
    const storedAccessToken = storedSession?.accessToken || storedSession?.token || null;
    const storedRefreshToken = loadRefreshToken() || storedSession?.refreshToken || null;

    if (storedSession && (storedAccessToken || storedRefreshToken)) {
      const hydratedSession = {
        ...storedSession,
        accessToken: storedAccessToken,
        token: storedAccessToken || storedSession?.token || null,
        refreshToken: storedRefreshToken || storedSession?.refreshToken || null,
      };

      setTokens(storedAccessToken, storedRefreshToken);
      let active = true;
      void (async () => {
        let restoredSession = hydratedSession;
        try {
          if (storedRefreshToken) {
            try {
              const response = await refreshAuthToken(storedRefreshToken);
              const data = getAuthPayload(response);
              if (data.token) {
                const roles = data.roles.length ? data.roles : hydratedSession.roles || [];
                const primaryRole = getPrimaryRole({ roles }) || hydratedSession.userRole;
                restoredSession = {
                  ...hydratedSession,
                  token: data.token,
                  accessToken: data.token,
                  refreshToken: data.refreshToken || storedRefreshToken,
                  id: data.id || hydratedSession.id,
                  email: data.responseUser.email || hydratedSession.email || "",
                  gymId: data.gymId || hydratedSession.gymId,
                  roles,
                  userRole: primaryRole,
                  role: data.roles.length ? getRoleLabel(primaryRole) : hydratedSession.role,
                  loginType: primaryRole || hydratedSession.loginType,
                };
                setTokens(restoredSession.accessToken, restoredSession.refreshToken);
                if (!isOwnerSession(restoredSession)) persistSession(restoredSession);
              }
            } catch {
              // Keep the existing persisted session if token refresh is temporarily unavailable.
            }
          }

          if (isOwnerSession(restoredSession)) await refreshSubscriptionStatus(restoredSession);
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
        window.removeEventListener("auth:expired", handleExpiredSession);
      };
    }

    Promise.resolve().then(() => {
      clearTokens();
      localStorage.removeItem("authSession");
      setUser(null);
      setLoading(false);
    });

    return () => window.removeEventListener("auth:expired", handleExpiredSession);
  }, [persistSession, refreshSubscriptionStatus]);

  useEffect(() => {
    const handleSessionStorage = (event) => {
      if (event.key !== "authSession") return;

      if (!event.newValue) {
        clearTokens();
        setUser(null);
        return;
      }

      try {
        const storedSession = JSON.parse(event.newValue);
        if (!storedSession || typeof storedSession !== "object") return;
        const accessToken = storedSession.accessToken || storedSession.token || null;
        const refreshToken = storedSession.refreshToken || loadRefreshToken() || getRefreshToken();
        if (!accessToken && !refreshToken) return;

        const synchronizedSession = {
          ...storedSession,
          accessToken,
          token: accessToken || storedSession.token || null,
          refreshToken,
        };
        setTokens(accessToken, refreshToken);
        setUser(synchronizedSession);
      } catch {
        // Ignore malformed session values from another tab.
      }
    };

    window.addEventListener("storage", handleSessionStorage);
    return () => window.removeEventListener("storage", handleSessionStorage);
  }, []);

  const updateUser = (nextUser) => {
    persistSession(nextUser);
  };

  const register = async (payload) => {
    const response = await registerGymMember(payload);
    return unwrapObject(response);
  };

  const completeOwnerRegistration = async (response) => {
    const data = getAuthPayload(response);
    const { responseData, authData, roles, token, refreshToken } = data;
    const responseUser = responseData.owner || authData.owner || {};
    const responseGym = responseData.gym || authData.gym || {};
    const registrationRoles = responseUser.roles || roles;
    const sessionRole = getPrimaryRole({ roles: registrationRoles.length ? registrationRoles : ["owner"] });
    const userId = responseUser.id || responseUser.userId || "";
    const gymId = responseGym.id || responseGym.gymId || "";

    if (!token || !refreshToken || !sessionRole) {
      throw new Error("Registration response did not include a valid owner session.");
    }

    setTokens(token, refreshToken);
    const session = {
      token,
      accessToken: token,
      refreshToken,
      id: userId,
      email: responseUser.email || "",
      name: responseUser.name || responseUser.ownerName || "",
      gymId,
      roles: registrationRoles.length ? registrationRoles : ["owner"],
      userRole: sessionRole,
      role: getRoleLabel(sessionRole),
      loginType: sessionRole,
      permissions: normalizePermissions(responseUser.permissions || authData.permissions || responseData.permissions),
    };
    persistSession(session);
    if (sessionRole === "gym_owner") await refreshSubscriptionStatus(session);
    return session;
  };

  const login = async ({ email, password, gymId, gymSlug, loginType } = {}) => {
    const credentials = { email, password };
    if (gymId) credentials.gymId = gymId;
    if (gymSlug) credentials.gymSlug = gymSlug;
    const response = loginType === "platform" ? await platformLogin(credentials) : await tenantLogin(credentials);
    if (response?.ambiguous) return { ambiguous: true, gyms: response.data?.gyms || response.gyms || [] };

    const data = getAuthPayload(response);
    const { responseData, authData, responseUser, roles, token, refreshToken, id: userId, gymId: responseGymId } = data;
    if (!token) return null;
    const sessionRole = getPrimaryRole({ roles });

    setTokens(token, refreshToken);

    if (!sessionRole) {
      clearTokens();
      localStorage.removeItem("authSession");
      setUser(null);
      throw new Error("Your account does not have a valid portal role assigned.");
    }

    const storedPermissions = userId ? readJson(`userPermissions:${userId}`, []) : [];
    const responsePermissions = normalizePermissions(
      responseUser.permissions || responseUser.userPermissions || authData.permissions || responseData.permissions
    );
    const role = getRoleLabel(sessionRole);
    const session = {
      token,
      accessToken: token,
      id: userId,
      email,
      gymId: responseGymId,
      name: responseUser.name || responseUser.ownerName || email,
      role,
      roles,
      staffRole: responseUser.staffRole || responseUser.roleName || responseUser.designation || responseUser.position || "",
      userRole: sessionRole,
      loginType: sessionRole,
      refreshToken,
      permissions: responsePermissions.length ? responsePermissions : storedPermissions,
    };

    persistSession(session);
    if (sessionRole === "gym_owner") await refreshSubscriptionStatus(session);

    // Auto check-in for members and trainers (uses JWT identity - no body needed)
    try {
      if (sessionRole === "member" && userId) {
        await memberCheckIn(token);
        localStorage.setItem("checkInTime", JSON.stringify(new Date().toISOString()));
      } else if (sessionRole === "trainer" && userId) {
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
    <AuthContext.Provider value={{ user, loading, isAuthenticated: Boolean(user), login, logout, logoutAll, register, completeOwnerRegistration, refreshSubscriptionStatus, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
