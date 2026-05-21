import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Pencil,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  Timer,
  Trash,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  adminCheckIn,
  adminCheckOut,
  deleteAttendance,
  exportAttendance,
  filterAttendance,
  getAbsentMembers,
  getActiveAttendance,
  getApiError,
  getAttendanceByDate,
  getAttendanceMemberSummary,
  getAttendanceStats,
  getLateCheckIns,
  getMonthlyAttendanceReport,
  getTenantUsers,
  getTodayAttendance,
  getTrainerAttendance,
  getUserAttendance,
  updateAttendance,
  unwrapList,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

const today = new Date().toISOString().slice(0, 10);

const endpoints = [
  { key: "filter", owner: true, admin: true, trainer: true, member: false },
  { key: "today", owner: true, admin: true, trainer: true, member: false },
  { key: "user", owner: true, admin: true, trainer: true, member: true },
  { key: "stats", owner: true, admin: true, trainer: false, member: false },
  { key: "active", owner: true, admin: true, trainer: true, member: false },
  { key: "update", owner: true, admin: true, trainer: false, member: false },
  { key: "delete", owner: true, admin: false, trainer: false, member: false },
  { key: "monthly", owner: true, admin: true, trainer: false, member: false },
  { key: "summary", owner: true, admin: true, trainer: true, member: true },
  { key: "absent", owner: true, admin: true, trainer: true, member: false },
  { key: "export", owner: true, admin: true, trainer: false, member: false },
  { key: "date", owner: true, admin: true, trainer: true, member: false },
  { key: "trainer", owner: true, admin: true, trainer: true, member: false },
  { key: "late", owner: true, admin: true, trainer: false, member: false },
];

const inputClass =
  "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const compactInputClass =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const compactButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const softButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

function attendanceRole(user) {
  const text = `${user?.loginType || ""} ${user?.role || ""} ${user?.staffRole || ""} ${user?.userRole || ""}`.toLowerCase();
  if (text.includes("owner")) return "owner";
  if (text.includes("member")) return "member";
  if (text.includes("trainer")) return "trainer";
  if (text.includes("admin") || text.includes("staff")) return "admin";
  return "member";
}

function canUse(role, key) {
  const row = endpoints.find((item) => item.key === key);
  return Boolean(row?.[role]);
}

function userIdOf(user) {
  return user?.id || user?._id || user?.userId || user?.email || "";
}

function recordId(record) {
  return record?.id || record?._id || record?.attendanceId || record?.uuid || "";
}

function displayName(record) {
  return (
    record?.userName ||
    record?.memberName ||
    record?.trainerName ||
    record?.user?.name ||
    record?.member?.name ||
    record?.trainer?.name ||
    record?.name ||
    "-"
  );
}

function displayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function displayMetric(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return displayDate(value);
  return String(value);
}

function unwrapAttendance(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.attendance)) return payload.attendance;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data?.attendance)) return payload.data.attendance;
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  if (Array.isArray(payload?.data?.sessions)) return payload.data.sessions;
  if (Array.isArray(payload?.members)) return payload.members;
  if (Array.isArray(payload?.data?.members)) return payload.data.members;
  return [];
}

function unwrapMetrics(payload) {
  return payload?.data && !Array.isArray(payload.data) ? payload.data : payload || {};
}

function getStatusClass(status = "") {
  const normalized = String(status).toUpperCase();
  if (normalized === "ACTIVE") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (normalized === "COMPLETED") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (normalized === "AUTO_CLOSED") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

function getType(record) {
  return record.type || record.userType || record.role || record.user?.type || "-";
}

function getCheckIn(record) {
  return record.checkIn || record.checkInTime || record.createdAt || record.timestamp;
}

function getCheckOut(record) {
  return record.checkOut || record.checkOutTime || record.completedAt;
}

function durationText(record) {
  const checkIn = new Date(getCheckIn(record));
  const checkOut = new Date(getCheckOut(record));
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return "-";
  const minutes = Math.max(0, Math.round((checkOut - checkIn) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

function SectionHeader({ icon: Icon, title, detail, action }) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-950 text-white">
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-950">{title}</h3>
          {detail && <p className="mt-1 text-sm text-gray-500">{detail}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`grid gap-1 text-xs font-semibold uppercase text-gray-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function StatCard({ label, value, icon, tone }) {
  const IconComponent = icon;
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <div className={`flex h-11 w-11 items-center justify-center rounded-md ring-1 ${tones[tone] || tones.slate}`}>
        <IconComponent size={22} />
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium leading-5 text-gray-500">{label}</p>
        <p className="shrink-0 text-2xl font-bold leading-none text-gray-950">{value ?? "-"}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-gray-500">
        <FileSpreadsheet size={22} />
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-gray-500">{detail}</p>
    </div>
  );
}

export default function AdminAttendance() {
  const { user } = useAuth();
  const role = attendanceRole(user);
  const ownUserId = userIdOf(user);
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [absentCount, setAbsentCount] = useState(null);
  const [lateCount, setLateCount] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState({});
  const [memberSummary, setMemberSummary] = useState({});
  const [activeTab, setActiveTab] = useState(role === "member" ? "self" : "records");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userType, setUserType] = useState("MEMBER");
  const [filters, setFilters] = useState({
    page: "1",
    limit: "10",
    userId: "",
    type: "",
    status: "",
    startDate: "",
    endDate: "",
  });
  const [trainerId, setTrainerId] = useState(ownUserId);
  const [summaryUserId, setSummaryUserId] = useState(ownUserId);
  const [lateAfterHour, setLateAfterHour] = useState("10");
  const [exportFormat, setExportFormat] = useState("csv");
  const [monthlyQuery, setMonthlyQuery] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
  });
  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState({ checkIn: "", checkOut: "", status: "COMPLETED" });

  const canManageCheckIn = role === "owner";
  const canShowReports = canUse(role, "monthly") || canUse(role, "summary") || canUse(role, "export");
  const filteredUsers = users.filter((item) =>
    [item.name, item.email, userIdOf(item)].join(" ").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredRecords = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [displayName(record), getType(record), record.status, record.userId, record.email]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [records, tableSearch]);

  const totalPages = Math.max(1, Math.ceil(records.length / (Number(filters.limit) || 10)));

  useEffect(() => {
    if (!canManageCheckIn) return;

    let isCurrent = true;
    const loadUsers = async () => {
      try {
        const queryRole = userType === "TRAINER" ? "trainer" : "member";
        const response = await getTenantUsers(queryRole, user?.token);
        if (isCurrent) setUsers(unwrapList(response));
      } catch (error) {
        toast.error(getApiError(error, "Failed to load users"));
        if (isCurrent) setUsers([]);
      }
    };

    void loadUsers();
    return () => {
      isCurrent = false;
    };
  }, [canManageCheckIn, user?.token, userType]);

  useEffect(() => {
    let isCurrent = true;

    const loadInitialAttendance = async () => {
      try {
        setLoading(true);
        if (canUse(role, "today")) {
          const response = await getTodayAttendance(user?.token);
          if (isCurrent) setRecords(unwrapAttendance(response));
        } else if (role === "member" && ownUserId) {
          const [historyResponse, summaryResponse] = await Promise.all([
            getUserAttendance(ownUserId, user?.token),
            getAttendanceMemberSummary(ownUserId, user?.token),
          ]);
          if (isCurrent) {
            setRecords(unwrapAttendance(historyResponse));
            setMemberSummary(unwrapMetrics(summaryResponse));
          }
        }

        if (canUse(role, "stats")) {
          const statsResponse = await getAttendanceStats(user?.token);
          if (isCurrent) setMetrics(unwrapMetrics(statsResponse));
        }

        if (canUse(role, "absent")) {
          const absentResponse = await getAbsentMembers(user?.token);
          if (isCurrent) setAbsentCount(unwrapAttendance(absentResponse).length);
        }

        if (canUse(role, "late")) {
          const lateResponse = await getLateCheckIns({ afterHour: lateAfterHour || undefined }, user?.token);
          if (isCurrent) setLateCount(unwrapAttendance(lateResponse).length);
        }
      } catch (error) {
        toast.error(getApiError(error, "Unable to load attendance"));
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void loadInitialAttendance();
    return () => {
      isCurrent = false;
    };
  }, [role, ownUserId, user?.token, lateAfterHour]);

  const loadToday = async () => {
    try {
      setLoading(true);
      const response = await getTodayAttendance(user?.token);
      setRecords(unwrapAttendance(response));
      setActiveTab(role === "member" ? "self" : "records");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load today's attendance"));
    } finally {
      setLoading(false);
    }
  };

  const loadFiltered = async () => {
    if (!canUse(role, "filter")) return;
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));

    try {
      setLoading(true);
      const response = await filterAttendance(params, user?.token);
      setRecords(unwrapAttendance(response));
      setActiveTab("records");
      toast.success("Attendance filters applied");
    } catch (error) {
      toast.error(getApiError(error, "Unable to filter attendance"));
    } finally {
      setLoading(false);
    }
  };

  const loadList = async (key) => {
    if (!canUse(role, key)) return;

    try {
      setLoading(true);
      const loaders = {
        active: () => getActiveAttendance(user?.token),
        absent: () => getAbsentMembers(user?.token),
        date: () => getAttendanceByDate(filters.startDate || today, user?.token),
        trainer: () => getTrainerAttendance(role === "trainer" ? ownUserId : trainerId, user?.token),
        late: () => getLateCheckIns({ afterHour: lateAfterHour || undefined }, user?.token),
      };
      const response = await loaders[key]();
      const nextRecords = unwrapAttendance(response);
      setRecords(nextRecords);
      if (key === "absent") setAbsentCount(nextRecords.length);
      if (key === "late") setLateCount(nextRecords.length);
      setActiveTab("records");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load attendance records"));
    } finally {
      setLoading(false);
    }
  };

  const loadUserHistory = async () => {
    const targetId = role === "member" ? ownUserId : filters.userId;
    if (!targetId || !canUse(role, "user")) {
      toast.error("User id is required");
      return;
    }

    try {
      setLoading(true);
      const response = await getUserAttendance(targetId, user?.token);
      setRecords(unwrapAttendance(response));
      setActiveTab(role === "member" ? "self" : "records");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load user attendance"));
    } finally {
      setLoading(false);
    }
  };

  const loadMemberSummary = async () => {
    const targetId = role === "member" ? ownUserId : summaryUserId;
    if (!targetId || !canUse(role, "summary")) {
      toast.error("Member id is required");
      return;
    }

    try {
      const response = await getAttendanceMemberSummary(targetId, user?.token);
      setMemberSummary(unwrapMetrics(response));
      if (role === "member") setActiveTab("self");
      toast.success("Member summary loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load member summary"));
    }
  };

  const loadMonthlyReport = async () => {
    if (!canUse(role, "monthly")) return;
    if (!monthlyQuery.month || !monthlyQuery.year) {
      toast.error("Month and year are required");
      return;
    }

    try {
      const response = await getMonthlyAttendanceReport(monthlyQuery, user?.token);
      setMonthlyReport(unwrapMetrics(response));
      setActiveTab("reports");
      toast.success("Monthly report loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load monthly report"));
    }
  };

  const handleExport = async () => {
    if (!canUse(role, "export")) return;

    try {
      const response = await exportAttendance({ format: exportFormat }, user?.token);
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance.${exportFormat === "excel" ? "xlsx" : "csv"}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Attendance export downloaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to export attendance"));
    }
  };

  const handleCheckInOut = async (mode) => {
    if (!selectedUser) {
      toast.error("Please select a user");
      return;
    }

    try {
      setActionLoading(true);
      const selectedId = userIdOf(selectedUser);
      const payload = { userId: selectedId, type: userType };
      if (mode === "in") {
        await adminCheckIn(payload, user?.token);
        toast.success(`${userType} checked in successfully`);
      } else {
        await adminCheckOut(payload, user?.token);
        toast.success(`${userType} checked out successfully`);
      }
      setSelectedUser(null);
      void loadToday();
    } catch (error) {
      toast.error(getApiError(error, "Attendance action failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const startEdit = (record) => {
    setEditRecord(record);
    setEditForm({
      checkIn: record.checkIn ? new Date(record.checkIn).toISOString().slice(0, 16) : "",
      checkOut: record.checkOut ? new Date(record.checkOut).toISOString().slice(0, 16) : "",
      status: record.status || "COMPLETED",
    });
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    const id = recordId(editRecord);
    if (!id || !canUse(role, "update")) return;

    try {
      const payload = {
        checkIn: editForm.checkIn ? new Date(editForm.checkIn).toISOString() : undefined,
        checkOut: editForm.checkOut ? new Date(editForm.checkOut).toISOString() : undefined,
        status: editForm.status,
      };
      await updateAttendance(id, payload, user?.token);
      toast.success("Attendance updated");
      setEditRecord(null);
      void loadToday();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update attendance"));
    }
  };

  const handleDelete = async (record) => {
    const id = recordId(record);
    if (!id || !canUse(role, "delete")) return;
    if (!confirm("Delete this attendance record? This action is restricted to gym owners.")) return;

    try {
      await deleteAttendance(id, user?.token);
      toast.success("Attendance deleted");
      setRecords((current) => current.filter((item) => recordId(item) !== id));
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete attendance"));
    }
  };

  const resetFilters = async () => {
    setFilters({ page: "1", limit: "10", userId: "", type: "", status: "", startDate: "", endDate: "" });
    setTableSearch("");
    setTrainerId(ownUserId);
    setLateAfterHour("10");
    setExpandedId("");

    if (canUse(role, "today")) {
      await loadToday();
    } else if (role === "member" && ownUserId) {
      await loadUserHistory();
    }

    toast.success("Filters reset");
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const statCards = [
    canUse(role, "today") && { label: "Today Check-Ins", value: metrics.todayCheckIns ?? records.length, icon: Users, tone: "blue" },
    canUse(role, "active") && { label: "Active Sessions", value: metrics.activeSessions, icon: Clock, tone: "emerald" },
    canUse(role, "stats") && { label: "Completed Sessions", value: metrics.completedSessions, icon: CheckCircle2, tone: "violet" },
    canUse(role, "stats") && { label: "Auto Closed Sessions", value: metrics.autoClosedSessions, icon: Timer, tone: "amber" },
    canUse(role, "absent") && { label: "Absent Members", value: absentCount, icon: UserRoundX, tone: "red" },
    canUse(role, "late") && { label: "Late Check-Ins", value: lateCount, icon: CalendarDays, tone: "slate" },
  ].filter(Boolean);

  const reportOutput = { ...monthlyReport, ...memberSummary };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gray-950 text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-950">Attendance Management</h2>
            <p className="mt-1 text-sm text-gray-500">Daily check-ins, live sessions, reports, and attendance corrections.</p>
          </div>
        </div>
      </Card>

      {statCards.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </section>
      )}

      {canManageCheckIn && (
        <Card className="overflow-hidden">
          <SectionHeader
            icon={LogIn}
            title="Owner Check-in / Check-out"
            detail="Select a member or trainer, then mark attendance with one tap."
            action={
              <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
                {["MEMBER", "TRAINER"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setUserType(type);
                      setSelectedUser(null);
                      setSearchTerm("");
                    }}
                    className={`min-w-24 rounded px-3 py-2 text-sm font-semibold transition ${
                      userType === type ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                    }`}
                  >
                    {type === "MEMBER" ? "Members" : "Trainers"}
                  </button>
                ))}
              </div>
            }
          />
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="overflow-hidden rounded-md border border-gray-200">
              <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 shadow-sm">
                  <Search size={17} className="shrink-0 text-gray-400" />
                  <input
                    className="h-10 min-w-0 flex-1 text-sm outline-none"
                    placeholder={`Search ${userType === "MEMBER" ? "members" : "trainers"} by name, email, or id`}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <span className="text-sm font-medium text-gray-500">
                  {filteredUsers.length} result{filteredUsers.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto bg-white">
                {filteredUsers.length ? (
                  filteredUsers.map((item) => {
                    const isSelected = userIdOf(selectedUser) === userIdOf(item);

                    return (
                      <button
                        key={userIdOf(item)}
                        type="button"
                        onClick={() => setSelectedUser(item)}
                        className={`block w-full border-b border-gray-100 p-3 text-left transition last:border-b-0 ${
                          isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
                                isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {(item.name || item.email || userType[0]).slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-gray-900">
                                {item.name || item.email || userIdOf(item)}
                              </span>
                              <span className="block truncate text-sm text-gray-500">{item.email || userIdOf(item)}</span>
                            </span>
                          </span>
                          {isSelected && <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">Selected</span>}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <EmptyState title={`No ${userType.toLowerCase()}s found`} detail="Try another name, email, or id." />
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-md border border-gray-200 bg-gray-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Current Selection</p>
                <p className="mt-2 truncate text-base font-semibold text-gray-950">
                  {selectedUser ? selectedUser.name || selectedUser.email || userIdOf(selectedUser) : `No ${userType.toLowerCase()} selected`}
                </p>
                <p className="mt-1 break-all text-sm text-gray-500">{selectedUser ? userIdOf(selectedUser) : "Select a row to enable actions."}</p>
              </div>
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() => void handleCheckInOut("in")}
                  disabled={actionLoading || !selectedUser}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogIn size={17} />
                  {actionLoading ? "Processing..." : "Check In"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCheckInOut("out")}
                  disabled={actionLoading || !selectedUser}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut size={17} />
                  {actionLoading ? "Processing..." : "Check Out"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { key: role === "member" ? "self" : "records", label: role === "member" ? "My Attendance" : "Attendance" },
            { key: "reports", label: "Reports", hidden: !canShowReports },
          ]
            .filter((tab) => !tab.hidden)
            .map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
                  activeTab === tab.key ? "bg-gray-950 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>
      </Card>

      {(activeTab === "records" || activeTab === "self") && (
        <section className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-semibold text-gray-950">{activeTab === "self" ? "My Attendance" : "Attendance Records"}</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {loading ? "Loading records..." : `${filteredRecords.length} of ${records.length} records shown`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canUse(role, "today") && (
                  <button type="button" onClick={() => void loadToday()} className={compactButtonClass}>
                    Today
                  </button>
                )}
                {canUse(role, "active") && (
                  <button type="button" onClick={() => void loadList("active")} className={compactButtonClass}>
                    Active
                  </button>
                )}
                {canUse(role, "late") && (
                  <button type="button" onClick={() => void loadList("late")} className={compactButtonClass}>
                    Late
                  </button>
                )}
                {canUse(role, "trainer") && (
                  <button type="button" onClick={() => void loadList("trainer")} className={compactButtonClass}>
                    Trainers
                  </button>
                )}
                <button type="button" onClick={() => setIsFilterDrawerOpen(true)} className={primaryButtonClass}>
                  <SlidersHorizontal size={17} />
                  Filter
                </button>
              </div>
            </div>
          </Card>

          {isFilterDrawerOpen && (
            <div className="fixed inset-0 z-50 flex justify-end bg-gray-950/40">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                onClick={() => setIsFilterDrawerOpen(false)}
                aria-label="Close filter drawer"
              />
              <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
                  <div>
                    <h3 className="font-semibold text-gray-950">Advanced Filters</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">Refine attendance records without shrinking the table.</p>
                  </div>
                  <button type="button" onClick={() => setIsFilterDrawerOpen(false)} className={iconButtonClass} aria-label="Close filters">
                    <X size={17} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid gap-3">
                    {canUse(role, "filter") && (
                      <>
                        <Field label="Type">
                          <select className={compactInputClass} value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
                            <option value="">Any</option>
                            <option value="MEMBER">MEMBER</option>
                            <option value="TRAINER">TRAINER</option>
                          </select>
                        </Field>
                        <Field label="Status">
                          <select className={compactInputClass} value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                            <option value="">Any</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="AUTO_CLOSED">AUTO_CLOSED</option>
                          </select>
                        </Field>
                        <Field label="Start Date">
                          <input className={compactInputClass} type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} />
                        </Field>
                        <Field label="End Date">
                          <input className={compactInputClass} type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} />
                        </Field>
                        <Field label="Trainer">
                          <input className={compactInputClass} value={trainerId} onChange={(event) => setTrainerId(event.target.value)} placeholder="trainer_uuid" disabled={role === "trainer"} />
                        </Field>
                        <Field label="User Id">
                          <input className={compactInputClass} value={filters.userId} onChange={(event) => updateFilter("userId", event.target.value)} placeholder="user_uuid" />
                        </Field>
                        {canUse(role, "late") && (
                          <Field label="Late After Hour">
                            <input className={compactInputClass} type="number" min="0" max="23" value={lateAfterHour} onChange={(event) => setLateAfterHour(event.target.value)} />
                          </Field>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsFilterDrawerOpen(false);
                            void loadFiltered();
                          }}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Apply Filters
                        </button>
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-2 border-t border-gray-200 pt-3">
                      {canUse(role, "absent") && (
                        <button type="button" onClick={() => void loadList("absent")} className={compactButtonClass}>
                          Absent
                        </button>
                      )}
                      {canUse(role, "date") && (
                        <button type="button" onClick={() => void loadList("date")} className={compactButtonClass}>
                          By Date
                        </button>
                      )}
                      {canUse(role, "user") && (
                        <button type="button" onClick={() => void loadUserHistory()} className={compactButtonClass}>
                          User History
                        </button>
                      )}
                      <button type="button" onClick={() => void resetFilters()} className={compactButtonClass}>
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 shadow-sm">
                <Search size={17} className="shrink-0 text-gray-400" />
                <input
                  className="h-11 min-w-0 flex-1 text-sm outline-none"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Search attendance records..."
                />
              </div>
            </div>

            <div className="max-h-[34rem] overflow-auto">
              <table className="min-w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100 text-xs uppercase text-gray-500 shadow-sm">
                <tr>
                  <th className="w-[30%] p-3">User</th>
                  <th className="w-[14%] p-3">Type</th>
                  <th className="w-[19%] p-3">Check In</th>
                  <th className="w-[19%] p-3">Check Out</th>
                  <th className="w-[10%] p-3">Status</th>
                  <th className="w-[8%] p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-sm text-gray-500">
                      Loading attendance records...
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredRecords.map((record, index) => {
                    const id = recordId(record) || `${displayName(record)}-${index}`;
                    const isExpanded = expandedId === id;

                    return (
                      <Fragment key={id}>
                        <tr className="align-middle transition hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <button type="button" onClick={() => setExpandedId(isExpanded ? "" : id)} className={iconButtonClass} aria-label="Toggle attendance details">
                                <ChevronDown size={16} className={`transition ${isExpanded ? "rotate-180" : ""}`} />
                              </button>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-950">{displayName(record)}</p>
                                <p className="truncate text-xs text-gray-500">{record.userId || record.email || recordId(record) || "-"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-gray-700">{getType(record)}</td>
                          <td className="p-3 text-gray-700">{displayDate(getCheckIn(record))}</td>
                          <td className="p-3 text-gray-700">{displayDate(getCheckOut(record))}</td>
                          <td className="p-3">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ${getStatusClass(record.status)}`}>
                              {record.status || "-"}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              {canUse(role, "update") && (
                                <button type="button" onClick={() => startEdit(record)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-600 transition hover:bg-blue-50" aria-label="Edit attendance">
                                  <Pencil size={17} />
                                </button>
                              )}
                              {canUse(role, "delete") && (
                                <button type="button" onClick={() => void handleDelete(record)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50" aria-label="Delete attendance">
                                  <Trash size={17} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={6} className="p-4">
                              <div className="grid gap-3 md:grid-cols-5">
                                {[
                                  { label: "Check-In", value: displayDate(getCheckIn(record)) },
                                  { label: "Check-Out", value: displayDate(getCheckOut(record)) },
                                  { label: "Workout Duration", value: durationText(record) },
                                  { label: "Trainer", value: record.trainerName || record.trainer?.name || record.trainerId || "-" },
                                  { label: "Attendance Status", value: record.status || "-" },
                                ].map((item) => (
                                  <div key={item.label} className="rounded-md border border-gray-200 bg-white p-3">
                                    <p className="text-xs font-semibold uppercase text-gray-500">{item.label}</p>
                                    <p className="mt-1 break-words text-sm font-medium text-gray-900">{item.value}</p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                {!loading && !filteredRecords.length && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No attendance records found" detail="Adjust filters, load today, or choose another quick list." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-gray-500">
                Showing {filteredRecords.length ? 1 : 0} to {filteredRecords.length} of {records.length} results
              </span>
              <div className="flex items-center gap-2">
                <select className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700" value={filters.limit} onChange={(event) => updateFilter("limit", event.target.value)}>
                  <option value="10">10 / page</option>
                  <option value="25">25 / page</option>
                  <option value="50">50 / page</option>
                </select>
                <button type="button" className={iconButtonClass} onClick={() => updateFilter("page", String(Math.max(1, Number(filters.page || 1) - 1)))} disabled={Number(filters.page || 1) <= 1}>
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-16 text-center text-sm font-semibold text-gray-700">
                  {filters.page} / {totalPages}
                </span>
                <button type="button" className={iconButtonClass} onClick={() => updateFilter("page", String(Number(filters.page || 1) + 1))}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </Card>
        </section>
      )}

      {activeTab === "reports" && (
        <Card className="overflow-hidden">
          <SectionHeader icon={BarChart3} title="Reports & Export" detail="Monthly summaries, member summaries, and attendance exports." />
          <div className="grid gap-4 p-4 lg:grid-cols-3">
            {canUse(role, "monthly") && (
              <div className="rounded-md border border-gray-200 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-600" />
                  <h3 className="font-semibold text-gray-950">Monthly Report</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Month">
                    <input className={inputClass} type="number" min="1" max="12" value={monthlyQuery.month} onChange={(event) => setMonthlyQuery({ ...monthlyQuery, month: event.target.value })} />
                  </Field>
                  <Field label="Year">
                    <input className={inputClass} type="number" value={monthlyQuery.year} onChange={(event) => setMonthlyQuery({ ...monthlyQuery, year: event.target.value })} />
                  </Field>
                </div>
                <button type="button" onClick={() => void loadMonthlyReport()} className={`${primaryButtonClass} mt-4 w-full`}>
                  <BarChart3 size={16} />
                  Generate Report
                </button>
              </div>
            )}

            {canUse(role, "summary") && (
              <div className="rounded-md border border-gray-200 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Users size={18} className="text-emerald-600" />
                  <h3 className="font-semibold text-gray-950">Member Summary</h3>
                </div>
                <Field label="User Id">
                  <input className={inputClass} value={role === "member" ? ownUserId : summaryUserId} disabled={role === "member"} onChange={(event) => setSummaryUserId(event.target.value)} />
                </Field>
                <button type="button" onClick={() => void loadMemberSummary()} className={`${softButtonClass} mt-4 w-full`}>
                  Load Summary
                </button>
              </div>
            )}

            {canUse(role, "export") && (
              <div className="rounded-md border border-gray-200 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Download size={18} className="text-gray-700" />
                  <h3 className="font-semibold text-gray-950">Export Attendance</h3>
                </div>
                <Field label="Format">
                  <select className={inputClass} value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
                    <option value="csv">csv</option>
                    <option value="excel">excel</option>
                  </select>
                </Field>
                <button type="button" onClick={() => void handleExport()} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800">
                  <Download size={16} />
                  Download Export
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(reportOutput).map(([key, value]) => (
                <div key={key} className="min-h-24 rounded-md bg-white p-4 ring-1 ring-gray-200">
                  <p className="text-xs font-semibold uppercase text-gray-500">{key}</p>
                  <p className="mt-2 break-words text-lg font-bold text-gray-950">{displayMetric(value)}</p>
                </div>
              ))}
              {!Object.keys(reportOutput).length && (
                <div className="sm:col-span-2 xl:col-span-4">
                  <EmptyState title="No report data yet" detail="Generate a monthly report or member summary to view analytics here." />
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {editRecord && canUse(role, "update") && (
        <Card className="p-4">
          <form onSubmit={handleUpdate}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <Field label="Check In">
                <input className={inputClass} type="datetime-local" value={editForm.checkIn} onChange={(event) => setEditForm({ ...editForm, checkIn: event.target.value })} />
              </Field>
              <Field label="Check Out">
                <input className={inputClass} type="datetime-local" value={editForm.checkOut} onChange={(event) => setEditForm({ ...editForm, checkOut: event.target.value })} />
              </Field>
              <Field label="Status">
                <select className={inputClass} value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="AUTO_CLOSED">AUTO_CLOSED</option>
                </select>
              </Field>
              <div className="flex gap-2">
                <button type="submit" className={primaryButtonClass}>
                  Save
                </button>
                <button type="button" onClick={() => setEditRecord(null)} className={softButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
