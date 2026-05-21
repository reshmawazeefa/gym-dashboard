import { createContext, useContext, useState } from "react";
import {
  extractToken,
  gymOwnerLogin,
  gymUserLogin,
  platformLogin,
  registerGymMember,
  unwrapObject,
  memberCheckIn,
  trainerCheckIn,
} from "../services/api";
import { getRoleLabel, normalizePermissions } from "../utils/rbac";

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

  const persistSession = (session) => {
    setUser(session);
    localStorage.setItem("authSession", JSON.stringify(session));
  };

  const register = async ({ name, email, password, gymId }) => {
    const payload = { name, email, password, gymId };
    const response = await registerGymMember(payload);
    return unwrapObject(response);
  };

  const login = async ({ email, password, gymId, loginType }) => {
    const credentials = gymId ? { email, password, gymId } : { email, password };
    const response =
      loginType === "platform"
        ? await platformLogin({ email, password })
        : loginType === "owner"
          ? await gymOwnerLogin(credentials)
          : await gymUserLogin(credentials);

    const token = extractToken(response);
    if (!token) return null;

    const responseUser = unwrapObject(response);
    const userId = responseUser.id || responseUser._id || responseUser.userId || "";
    const storedPermissions = userId ? readJson(`userPermissions:${userId}`, []) : [];
    const responsePermissions = normalizePermissions(
      responseUser.permissions || responseUser.userPermissions || response.permissions
    );
    const role =
      loginType === "platform"
        ? "Platform Admin"
        : getRoleLabel(
            responseUser.role || (loginType === "owner" ? "Gym Owner" : loginType),
            loginType
          );
    const session = {
      token,
      id: userId,
      email,
      gymId: responseUser.gymId || responseUser.gym?.id || gymId || "",
      name: responseUser.name || responseUser.ownerName || email,
      role,
      staffRole: responseUser.staffRole || responseUser.roleName || responseUser.designation || responseUser.position || responseUser.type || "",
      userRole: responseUser.role || responseUser.userRole || "",
      loginType,
      permissions: responsePermissions.length ? responsePermissions : storedPermissions,
    };

    persistSession(session);

    // Auto check-in for members and trainers
    try {
      // Use id if available, otherwise use email as identifier
      const checkInUserId = userId || email;
      
      if (loginType === "member" && checkInUserId) {
        await memberCheckIn({ userId: checkInUserId, type: "MEMBER" }, token);
        localStorage.setItem("checkInTime", JSON.stringify(new Date().toISOString()));
      } else if (loginType === "trainer" && checkInUserId) {
        await trainerCheckIn({ userId: checkInUserId, type: "TRAINER" }, token);
        localStorage.setItem("checkInTime", JSON.stringify(new Date().toISOString()));
      }
    } catch (error) {
      console.warn("Auto check-in failed:", error.message);
      // Don't interrupt login flow if check-in fails
    }

    return session;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("authSession");
    localStorage.removeItem("user");
    localStorage.removeItem("checkInTime");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
