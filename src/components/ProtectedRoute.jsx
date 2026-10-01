import { Navigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { canAccess, getPortalHomePath, getPortalKey, isUserAllowedInPortal } from "../utils/rbac";
import { isSubscriptionRestricted } from "../utils/subscriptionStatus";

function getPortalLabel(portalKey) {
  if (portalKey === "platform_admin") return "Platform Admin portal";
  if (portalKey === "gym_owner") return "Gym Owner portal";
  if (portalKey === "staff") return "Staff portal";
  return "Member portal";
}

export default function ProtectedRoute({ children, moduleKey = "dashboard", action = "view" }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>;
  }

  if (!user) {
    return <Navigate to={location.pathname.startsWith("/platform") ? "/platform/login" : "/login"} replace />;
  }

  if (!getPortalKey(user)) {
    return <Navigate to="/login" replace />;
  }

  if (!isUserAllowedInPortal(user, location.pathname)) {
    const portalKey = getPortalKey(user);
    const roleName = user.role || user.roles?.join(", ") || "User";
    const correctPortal = getPortalLabel(portalKey);

    toast.error(`Portal mismatch: ${roleName} users must use the ${correctPortal}.`);
    return <Navigate to={getPortalHomePath(user)} replace />;
  }

  const isOwner = getPortalKey(user) === "gym_owner";
  const isSubscriptionPage = location.pathname.replace(/\/$/, "") === "/modules/subscriptions";

  if (isOwner && !isSubscriptionPage && !String(user.subscriptionStatus || "").trim()) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Verifying subscription status...</div>;
  }

  if (isOwner && !isSubscriptionPage && isSubscriptionRestricted(user.subscriptionStatus)) {
    return <Navigate to="/modules/subscriptions" replace state={{ subscriptionAccessDenied: true }} />;
  }

  if (moduleKey && !canAccess(user, moduleKey, action)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <div className="max-w-md rounded-lg bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
          <h1 className="text-xl font-bold text-gray-950">Access restricted</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Your role does not have permission to open this module.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
