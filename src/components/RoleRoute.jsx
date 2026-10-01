import { Navigate } from "react-router-dom";
import { getPrimaryRole } from "../utils/rbac";
import { useAuth } from "../context/AuthContext";

const ROLE_ALIASES = {
  owner: "gym_owner",
  platform: "platform_admin",
};

export default function RoleRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const allowed = allowedRoles.map((role) => ROLE_ALIASES[role] || role);
  return allowed.includes(getPrimaryRole(user)) ? children : <Navigate to="/" replace />;
}