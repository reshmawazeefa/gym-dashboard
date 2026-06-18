import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Trash, Edit3, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { normalizeRole } from "../utils/rbac";
import AddTrainerModal from "../components/AddTrainerModal";
import {
  createGymStaff,
  deleteUser,
  getApiError,
  getTenantUsers,
  updateTenantUser,
  unwrapList,
  unwrapObject,
} from "../services/api";

const formatDateValue = (value) => {
  if (!value) return "";

  const stringValue = String(value).trim();
  const isoDate = stringValue.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;

  const parsedDate = new Date(stringValue);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateTimeValue = (value) => {
  const dateValue = formatDateValue(value);
  return dateValue ? `${dateValue}T00:00:00.000Z` : "";
};

const normalizeStaffRole = (role) => {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/^role[_-]/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized || normalized === "user") return "";
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("trainer")) return "trainer";
  if (normalized.includes("reception")) return "receptionist";
  if (normalized === "staff") return "staff";

  return normalized;
};

const formatRoleLabel = (role) => {
  const normalized = normalizeStaffRole(role);
  if (!normalized) return "Unknown";
  if (normalized.includes("reception")) return "Receptionist";

  return normalized
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getStaffRole = (user) => {
  const assignedRoles = Array.isArray(user.roles)
    ? user.roles
        .map((assignment) => assignment?.role?.name || assignment?.name || assignment?.roleName)
        .filter(Boolean)
    : [];
  const rawAssignedRoles = Array.isArray(user.raw?.roles)
    ? user.raw.roles
        .map((assignment) => assignment?.role?.name || assignment?.name || assignment?.roleName)
        .filter(Boolean)
    : [];
  const possibleRoles = [
    ...assignedRoles,
    ...rawAssignedRoles,
    user.staffRole,
    user.roleName,
    user.designation,
    user.position,
    user.userRole,
    user.userType,
    user.type,
    user.permissions?.role,
    user.profile?.role,
    user.staff?.role,
    user.raw?.staffRole,
    user.raw?.roleName,
    user.raw?.designation,
    user.raw?.position,
    user.raw?.userRole,
    user.raw?.type,
    user.role,
    user.raw?.role,
  ];

  for (const role of possibleRoles) {
    const normalized = normalizeStaffRole(role);
    if (normalized) return normalized;
  }

  return "";
};

function normaliseStaff(user, fallbackRole = "") {
  return {
    id: user.id || user._id || user.userId || user.email,
    name: user.name || user.fullName || "",
    email: user.email || "",
    role: getStaffRole(user) || normalizeStaffRole(fallbackRole),
    phoneNumber: user.phoneNumber || "",
    gender: user.gender || "",
    dateOfBirth: formatDateValue(user.dateOfBirth || ""),
    addressLine1: user.addressLine1 || "",
    addressLine2: user.addressLine2 || "",
    city: user.city || "",
    state: user.state || "",
    country: user.country || "",
    postalCode: user.postalCode || "",
    profileImage: user.profileImage || "",
    raw: user,
  };
}

export default function Trainers() {
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role, user?.loginType);
  const isMemberPortal = userRole === "member";
  const [staff, setStaff] = useState(() =>
    (JSON.parse(localStorage.getItem("staff")) || []).map(normaliseStaff)
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const itemsPerPage = 10;

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const staffRequests = [
        { queryRole: "staff", fallbackRole: "" },
        { queryRole: "admin", fallbackRole: "admin" },
        { queryRole: "trainer", fallbackRole: "trainer" },
        { queryRole: "receptionist", fallbackRole: "receptionist" },
      ];
      const responses = await Promise.allSettled(
        staffRequests.map(({ queryRole }) => getTenantUsers(queryRole))
      );
      const nextStaff = responses
        .flatMap((result, index) =>
          result.status === "fulfilled"
            ? unwrapList(result.value).map((user) =>
                normaliseStaff(user, staffRequests[index].fallbackRole)
              )
            : []
        )
        .filter((user, index, users) => {
          const key = user.id || user.email;
          return key && users.findIndex((item) => (item.id || item.email) === key) === index;
        });

      setStaff(nextStaff);
      localStorage.setItem("staff", JSON.stringify(nextStaff));
    } catch (error) {
      const stored = JSON.parse(localStorage.getItem("staff")) || [];
      setStaff(stored.map(normaliseStaff));
      toast.error(getApiError(error, "Could not load staff"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStaff();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadStaff]);

  const handleSave = async (data) => {
    try {
      if (editData) {
        const payload = {
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          gender: data.gender,
          dateOfBirth: formatDateTimeValue(data.dateOfBirth),
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
        };
        const response = await updateTenantUser(editData.id, payload);
        const updatedStaff = normaliseStaff({ ...data, ...unwrapObject(response) });
        const updated = staff.map((t) =>
          t.id === editData.id ? { ...t, ...updatedStaff } : t
        );
        setStaff(updated);
        localStorage.setItem("staff", JSON.stringify(updated));
        toast.success("Staff updated");
      } else {
        const response = await createGymStaff({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          phoneNumber: data.phoneNumber,
          gender: data.gender,
          dateOfBirth: formatDateTimeValue(data.dateOfBirth),
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
          profileImage: data.profileImage,
        });
        const responseStaff = unwrapObject(response);
        const createdStaff = normaliseStaff(
          Object.keys(responseStaff).length ? { ...data, ...responseStaff } : { id: Date.now(), ...data },
          data.role
        );
        const updated = [...staff, createdStaff];
        setStaff(updated);
        localStorage.setItem("staff", JSON.stringify(updated));
        toast.success("Staff created");
      }
    } catch (error) {
      toast.error(getApiError(error, editData ? "Staff update failed" : "Staff creation failed"));
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this staff member?")) {
      try {
        await deleteUser(id);
      const updated = staff.filter((t) => t.id !== id);
      setStaff(updated);
      localStorage.setItem("staff", JSON.stringify(updated));
        toast.success("Staff deleted successfully");
      } catch (error) {
        toast.error(getApiError(error, "Could not delete staff"));
      }
    }
  };

  const handleEdit = (staffMember) => {
    setEditData(normaliseStaff(staffMember));
    setIsModalOpen(true);
  };

  const filtered = staff.filter((t) =>
    [
      t.name,
      t.email,
      t.phoneNumber,
      t.role,
      t.gender,
      t.city,
      t.state,
      t.country,
      t.postalCode,
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">Staff</h1>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-1">
          <div className="min-w-0 flex-1">
            <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow sm:max-w-xxl">
              <Search size={18} />
              <input
                placeholder="Search staff..."
                className="w-full min-w-0 text-sm outline-none"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {!isMemberPortal && (
            <button
              onClick={() => {
                setEditData(null);
                setIsModalOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded bg-blue-500 px-4 py-2 text-sm text-white sm:w-auto"
            >
              <Plus size={18} />
              Add Staff
            </button>
          )}

          <button
            onClick={loadStaff}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded bg-gray-200 px-4 py-2 text-sm text-gray-700 disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="w-full border-collapse text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-sm font-semibold">Name</th>
              <th className="p-3 text-sm font-semibold">Email</th>
              <th className="p-3 text-sm font-semibold">Phone</th>
              <th className="p-3 text-sm font-semibold">Role</th>
              {!isMemberPortal && (
                <th className="p-3 text-center text-sm font-semibold">Actions</th>
              )}
            </tr>
          </thead>

          <tbody>
            {paginated.map((t) => (
              <tr key={t.id} className="border-t transition hover:bg-gray-50">
                <td className="p-3 text-sm">{t.name}</td>
                <td className="p-3 text-sm">{t.email}</td>
                <td className="p-3 text-sm">{t.phoneNumber || "-"}</td>
                <td className="p-3 text-sm">{formatRoleLabel(t.role)}</td>
                {!isMemberPortal && (
                  <td className="p-3">
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-blue-500"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-red-500"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={isMemberPortal ? "3" : "4"} className="p-4 text-center text-gray-500">
                  {loading ? "Loading staff..." : "No staff found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
          <p className="text-sm text-gray-600">
            Page {currentPage} of {totalPages || 1}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="rounded bg-gray-200 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages || 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="rounded bg-gray-200 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <AddTrainerModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditData(null);
          }}
          onSave={handleSave}
          editData={editData}
        />
      )}
    </div>
  );
}
