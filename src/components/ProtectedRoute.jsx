import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";

export default function ProtectedRoute({ children, moduleKey = "dashboard", action = "view" }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
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
