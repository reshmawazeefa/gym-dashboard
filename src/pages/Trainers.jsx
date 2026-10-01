import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  Trash,
  Edit,
  Users,
  ShieldCheck,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import TablePagination from "../components/TablePagination";
import StatusBadge from "../components/StatusBadge";
import { normalizeRole } from "../utils/rbac";
import AddTrainerModal from "../components/AddTrainerModal";
import {
  createGymStaff,
  deleteUser,
  getApiError,
  getTenantUsers,
  updateTenantUserStatus,
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

const getRoleTheme = (role) => {
  const normalized = normalizeStaffRole(role);
  if (normalized === "admin") return "bg-violet-50 text-violet-700";
  if (normalized === "trainer") return "bg-sky-50 text-sky-700";
  if (normalized === "receptionist") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-[#0D8252]";
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
    isActive: user.isActive !== false,
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
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [exporting, setExporting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState({});
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
        const updatedStaff = normaliseStaff({
          ...editData.raw,
          ...editData,
          ...data,
          ...unwrapObject(response),
          isActive: editData.isActive,
        }, editData.role);
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

  const handleStatusChange = async (staffMember, nextIsActive) => {
    const id = staffMember.id;
    if (updatingStatus[id]) return;

    try {
      setUpdatingStatus((current) => ({ ...current, [id]: true }));
      await updateTenantUserStatus(id, { isActive: nextIsActive });
      await loadStaff();
      toast.success(`Staff member marked ${nextIsActive ? "Active" : "Inactive"}`);
    } catch (error) {
      toast.error(getApiError(error, "Could not update staff status"));
    } finally {
      setUpdatingStatus((current) => ({ ...current, [id]: false }));
    }
  };

  const handleEdit = (staffMember) => {
    setEditData(normaliseStaff(staffMember));
    setIsModalOpen(true);
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filtered = staff.filter((t) => {
    const searchableFields = [
      t.name,
      t.email,
      t.phoneNumber,
      t.role,
      formatRoleLabel(t.role),
      t.gender,
      t.city,
      t.state,
      t.country,
      t.postalCode,
    ];
    const matchesSearch = !normalizedSearchTerm || searchableFields.filter(Boolean).join(" ").toLowerCase().includes(normalizedSearchTerm);
    const matchesRole = roleFilter === "All" || t.role === roleFilter;
    const matchesStatus = statusFilter === "All" || (t.isActive ? "Active" : "Inactive") === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleExportCSV = () => {
    if (exporting) return;
    setExporting(true);

    try {
      const headers = ["Name", "Email", "Phone", "Role", "Status"];
      const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows = filtered.map((member) => [
        member.name,
        member.email,
        member.phoneNumber,
        formatRoleLabel(member.role),
        member.isActive ? "Active" : "Inactive",
      ]);
      const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "staff.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} staff member${rows.length === 1 ? "" : "s"} exported`);
    } catch (error) {
      toast.error(getApiError(error, "Could not export staff"));
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);
  const trainerCount = staff.filter((member) => normalizeStaffRole(member.role).includes("trainer")).length;
  const adminCount = staff.filter((member) => normalizeStaffRole(member.role).includes("admin")).length;
  const operationsCount = staff.filter((member) => {
    const role = normalizeStaffRole(member.role);
    return role === "staff" || role === "receptionist";
  }).length;
  const summaryCards = [
    { label: "Total Staff", value: staff.filter((member) => member.isActive).length, detail: "+100%", caption: "Active staff accounts", icon: Users },
    { label: "Trainers", value: trainerCount, detail: "Staff", caption: "Assigned to floor sessions", icon: Users },
    { label: "Admin & Operations", value: adminCount + operationsCount, detail: "Ops", caption: "1 Admin, 1 Receptionist", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* <div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0D8252]">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0D8252]" />
                Live Facility
              </span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="text-[#94A3B8]">Branch #01</span>
            </div> */}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Staff &amp; Trainers</h1>
              {/* <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-[#0D8252]">{staff.filter((member) => member.isActive).length} Active Staff</span> */}
            </div>
            <p className="mt-0.5 text-xs text-[#64748B]">Manage gym instructors, personnel, administrative staff, and role permissions.</p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExportCSV} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] disabled:cursor-not-allowed disabled:opacity-60">
              <Download size={13} />
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
            {!isMemberPortal && (
              <button
                onClick={() => {
                  setEditData(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition hover:bg-[#086B43]"
              >
                <Plus size={14} />
                Add Staff
              </button>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {summaryCards.map((card, index) => (
            <div key={card.label} className="flex min-h-[108px] items-center justify-between rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{card.label}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-[#0F172A]">{card.value}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">{card.detail}</span>
                </div>
                <p className="mt-1 text-[10px] text-[#94A3B8]">{card.caption}</p>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${index === 0 ? "bg-emerald-50 text-[#0D8252]" : index === 1 ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"}`}>
                {index === 2 ? <ShieldCheck size={18} /> : <Users size={18} />}
              </span>
            </div>
          ))}
        </section>

        <div className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <Search size={15} className="text-[#94A3B8]" />
              <input
                placeholder="Search staff by name, email, phone, or role..."
                className="w-full min-w-0 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
              <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none">
                <option value="All">All Roles</option>
                {[...new Set(staff.map((member) => member.role).filter(Boolean))].sort().map((role) => <option key={role} value={role}>{formatRoleLabel(role)}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none">
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              {/* <span className="rounded-full bg-[#F1F5F9] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748B]">{filtered.length} Records</span> */}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  {!isMemberPortal && (
                    <th className="px-4 py-3 text-center">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {paginated.map((t) => (
                  <tr key={t.id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                    <td className="px-4 py-2.5 font-semibold text-[#0F172A]">
                      <span className="block">{t.name}</span>
                      <span className="mt-0.5 block text-[9px] font-normal text-[#94A3B8]">#ST-{String(start + paginated.indexOf(t) + 1).padStart(3, "0")}</span>
                    </td>
                    <td className="px-4 py-3">{t.email}</td>
                    <td className="px-4 py-3">{t.phoneNumber || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${getRoleTheme(t.role)}`}>
                        {formatRoleLabel(t.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.isActive ? "ACTIVE" : "INACTIVE"} label={t.isActive ? "Active" : "Inactive"} onClick={() => void handleStatusChange(t, !t.isActive)} disabled={!!updatingStatus[t.id]} ariaLabel={`${t.isActive ? "Deactivate" : "Activate"} ${t.name || "staff member"}`} />
                    </td>
                    {!isMemberPortal && (
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-3">
                          {/* <button
                            onClick={() => handleEdit(t)}
                            className="text-[#0D8252] transition hover:text-[#065F46]"
                            aria-label={`Edit ${t.name}`}
                          >
                            <Edit size={15} />
                          </button> */}

                          <button class="text-[#0D8252] transition hover:text-[#065F46]" aria-label={`Edit ${t.name}`}  onClick={() => handleEdit(t)} className="rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg></button>

                          <button
                            onClick={() => handleDelete(t.id)}
                            className="rounded-lg text-rose-500 transition hover:text-rose-700"
                            aria-label={`Delete ${t.name}`}
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isMemberPortal ? "5" : "6"} className="px-4 py-10 text-center text-xs text-[#64748B]">
                      {loading ? "Loading staff..." : "No staff found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-[#64748B]">Showing {filtered.length ? start + 1 : 0} to {Math.min(start + paginated.length, filtered.length)} of {filtered.length} staff records</span>

            <TablePagination page={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} className="gap-2" />
          </div>
        </div>

        {isModalOpen && (
          <AddTrainerModal
            key={editData?.id || "new-staff"}
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
    </div>
  );
}
