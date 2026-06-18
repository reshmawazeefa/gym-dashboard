import { useAuth } from "../context/AuthContext";
import { normalizeRole } from "../utils/rbac";
import OwnerProfile from "./OwnerProfile";
import StaffProfile from "./StaffProfile";

export default function Profile() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role, user?.loginType);

  if (role === "gym_owner" || role === "platform_admin") {
    return <OwnerProfile />;
  }

  return <StaffProfile />;
}
