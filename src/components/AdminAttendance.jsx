import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
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
  ShieldCheck,
  Timer,
  Trash,
  Upload,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import toast from "react-hot-toast";
import {
  adminCheckIn,
  adminCheckOut,
  bulkCheckIn,
  bulkImportAttendance,
  deleteAttendance,
  exportAttendance,
  filterAttendance,
  getAbsentMembers,
  getActiveAttendance,
  getApiError,
  getAttendanceByDate,
  getAttendanceComparison,
  getAttendanceMemberSummary,
  getAttendanceStats,
  getAttendanceTrends,
  getLateCheckIns,
  getMonthlyAttendanceReport,
  getOccupancyReport,
  getPeakHours,
  getQuarterlyAttendanceReport,
  getRetentionMetrics,
  getTenantUsers,
  getTodayAttendance,
  getTrainerAttendance,
  getUserAttendance,
  getWeeklyAttendanceReport,
  getYearlyAttendanceReport,
  updateAttendance,
  unwrapList,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";

const today = new Date().toISOString().slice(0, 10);

const ATTENDANCE_PERMISSIONS = {
  list: { action: "view", label: "All Records" },
  filter: { action: "view", label: "Filter" },
  today: { action: "view", label: "Today" },
  user: { action: "view", label: "User History" },
  stats: { action: "view", label: "Stats" },
  active: { action: "view", label: "Active" },
  update: { action: "update", label: "Update" },
  delete: { action: "delete", label: "Delete" },
  monthly: { action: "view", label: "Monthly Report" },
  weekly: { action: "view", label: "Weekly Report" },
  quarterly: { action: "view", label: "Quarterly Report" },
  yearly: { action: "view", label: "Yearly Report" },
  trends: { action: "view", label: "Trends" },
  peakHours: { action: "view", label: "Peak Hours" },
  comparison: { action: "view", label: "Comparison" },
  retention: { action: "view", label: "Retention" },
  occupancy: { action: "view", label: "Occupancy" },
  summary: { action: "view", label: "Member Summary" },
  absent: { action: "view", label: "Absent" },
  export: { action: "export", label: "Export" },
  mark: { action: "mark", label: "Mark Attendance" },
  forceCheckout: { action: "force.checkout", label: "Force Checkout" },
  date: { action: "view", label: "By Date" },
  trainer: { action: "view", label: "Trainer" },
  late: { action: "view", label: "Late" },
};

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

function can(user, key) {
  const perm = ATTENDANCE_PERMISSIONS[key];
  if (!perm) return false;
  return canAccess(user, "attendance", perm.action);
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
  const ownUserId = userIdOf(user);

  const canView = can(user, "list");
  const canMark = can(user, "mark");
  const canUpdate = can(user, "update");
  const canDelete = can(user, "delete");
  const canExport = can(user, "export");
  const canForceCheckout = can(user, "forceCheckout");
  const canViewReports = can(user, "monthly");
  const canViewSummary = can(user, "summary");

  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [absentCount, setAbsentCount] = useState(null);
  const [lateCount, setLateCount] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState({});
  const [memberSummary, setMemberSummary] = useState({});
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [quarterlyReport, setQuarterlyReport] = useState(null);
  const [yearlyReport, setYearlyReport] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [peakHoursData, setPeakHoursData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [retentionData, setRetentionData] = useState(null);
  const [occupancyData, setOccupancyData] = useState(null);
  const [activeTab, setActiveTab] = useState("records");
  const [reportsSubTab, setReportsSubTab] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
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
  const [weeklyQuery, setWeeklyQuery] = useState({
    year: String(new Date().getFullYear()),
    week: String(Math.ceil((new Date().getDate() + new Date(new Date().getFullYear(), 0, 1).getDay()) / 7)),
  });
  const [quarterlyQuery, setQuarterlyQuery] = useState({
    year: String(new Date().getFullYear()),
    quarter: String(Math.ceil((new Date().getMonth() + 1) / 3)),
  });
  const [yearlyQuery, setYearlyQuery] = useState({ year: String(new Date().getFullYear()) });
  const [trendsQuery, setTrendsQuery] = useState({ days: "30" });
  const [peakHoursQuery, setPeakHoursQuery] = useState({ date: new Date().toISOString().slice(0, 10) });
  const [comparisonQuery, setComparisonQuery] = useState({
    period1Start: "",
    period1End: "",
    period2Start: "",
    period2End: "",
  });
  const [retentionQuery, setRetentionQuery] = useState({ days: "90" });
  const [occupancyQuery, setOccupancyQuery] = useState({ date: new Date().toISOString().slice(0, 10) });
  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState({ checkIn: "", checkOut: "", status: "COMPLETED" });
  const [bulkRecords, setBulkRecords] = useState("");
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [bulkCheckInUserIds, setBulkCheckInUserIds] = useState([]);

  const isMember = !canMark && canView;
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
    if (!canMark) return;

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
  }, [canMark, user?.token, userType]);

  useEffect(() => {
    let isCurrent = true;

    const loadInitialAttendance = async () => {
      try {
        setLoading(true);
        if (canView) {
          const response = await getTodayAttendance(user?.token);
          if (isCurrent) setRecords(unwrapAttendance(response));
        } else if (ownUserId) {
          const [historyResponse, summaryResponse] = await Promise.all([
            getUserAttendance(ownUserId, user?.token),
            getAttendanceMemberSummary(ownUserId, user?.token),
          ]);
          if (isCurrent) {
            setRecords(unwrapAttendance(historyResponse));
            setMemberSummary(unwrapMetrics(summaryResponse));
          }
        }

        if (canView) {
          const statsResponse = await getAttendanceStats(user?.token);
          if (isCurrent) setMetrics(unwrapMetrics(statsResponse));
        }

        if (canView) {
          const absentResponse = await getAbsentMembers(user?.token);
          if (isCurrent) setAbsentCount(unwrapAttendance(absentResponse).length);
        }

        if (canView) {
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
  }, [canView, ownUserId, user?.token, lateAfterHour]);

  const loadToday = async () => {
    try {
      setLoading(true);
      const response = await getTodayAttendance(user?.token);
      setRecords(unwrapAttendance(response));
      setActiveTab("records");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load today's attendance"));
    } finally {
      setLoading(false);
    }
  };

  const loadFiltered = async () => {
    if (!canView) return;
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

  const loadList = useCallback(async (key) => {
    if (!canView) return;

    try {
      setLoading(true);
      const loaders = {
        active: () => getActiveAttendance(user?.token),
        absent: () => getAbsentMembers(user?.token),
        date: () => getAttendanceByDate(filters.startDate || today, user?.token),
        trainer: () => getTrainerAttendance(trainerId || ownUserId, user?.token),
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
  }, [canView, user?.token, filters.startDate, trainerId, ownUserId, lateAfterHour]);

  const loadUserHistory = async () => {
    const targetId = isMember ? ownUserId : filters.userId;
    if (!targetId || !canView) {
      toast.error("User id is required");
      return;
    }

    try {
      setLoading(true);
      const response = await getUserAttendance(targetId, user?.token);
      setRecords(unwrapAttendance(response));
      setActiveTab("records");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load user attendance"));
    } finally {
      setLoading(false);
    }
  };

  const loadMemberSummary = async () => {
    const targetId = isMember ? ownUserId : summaryUserId;
    if (!targetId || !canViewSummary) {
      toast.error("Member id is required");
      return;
    }

    try {
      const response = await getAttendanceMemberSummary(targetId, user?.token);
      setMemberSummary(unwrapMetrics(response));
      setActiveTab("reports");
      toast.success("Member summary loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load member summary"));
    }
  };

  const loadMonthlyReport = async () => {
    if (!canViewReports) return;
    if (!monthlyQuery.month || !monthlyQuery.year) {
      toast.error("Month and year are required");
      return;
    }

    try {
      const response = await getMonthlyAttendanceReport(monthlyQuery, user?.token);
      setMonthlyReport(unwrapMetrics(response));
      setReportsSubTab("monthly");
      toast.success("Monthly report loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load monthly report"));
    }
  };

  const loadWeeklyReport = async () => {
    if (!canViewReports) return;
    try {
      const response = await getWeeklyAttendanceReport(weeklyQuery, user?.token);
      setWeeklyReport(unwrapMetrics(response));
      setReportsSubTab("weekly");
      toast.success("Weekly report loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load weekly report"));
    }
  };

  const loadQuarterlyReport = async () => {
    if (!canViewReports) return;
    try {
      const response = await getQuarterlyAttendanceReport(quarterlyQuery, user?.token);
      setQuarterlyReport(unwrapMetrics(response));
      setReportsSubTab("quarterly");
      toast.success("Quarterly report loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load quarterly report"));
    }
  };

  const loadYearlyReport = async () => {
    if (!canViewReports) return;
    try {
      const response = await getYearlyAttendanceReport(yearlyQuery, user?.token);
      setYearlyReport(unwrapMetrics(response));
      setReportsSubTab("yearly");
      toast.success("Yearly report loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load yearly report"));
    }
  };

  const loadTrends = async () => {
    if (!canViewReports) return;
    try {
      const response = await getAttendanceTrends(trendsQuery, user?.token);
      setTrendsData(response?.data || response);
      setReportsSubTab("trends");
      toast.success("Trends loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load trends"));
    }
  };

  const loadPeakHours = async () => {
    if (!canViewReports) return;
    try {
      const response = await getPeakHours(peakHoursQuery, user?.token);
      setPeakHoursData(response?.data || response);
      setReportsSubTab("peakHours");
      toast.success("Peak hours loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load peak hours"));
    }
  };

  const loadComparison = async () => {
    if (!canViewReports) return;
    const { period1Start, period1End, period2Start, period2End } = comparisonQuery;
    if (!period1Start || !period1End || !period2Start || !period2End) {
      toast.error("All four date fields are required for comparison");
      return;
    }
    try {
      const response = await getAttendanceComparison(comparisonQuery, user?.token);
      setComparisonData(response?.data || response);
      setReportsSubTab("comparison");
      toast.success("Comparison loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load comparison"));
    }
  };

  const loadRetention = async () => {
    if (!canViewReports) return;
    try {
      const response = await getRetentionMetrics(retentionQuery, user?.token);
      setRetentionData(response?.data || response);
      setReportsSubTab("retention");
      toast.success("Retention metrics loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load retention metrics"));
    }
  };

  const loadOccupancy = async () => {
    if (!canViewReports) return;
    try {
      const response = await getOccupancyReport(occupancyQuery, user?.token);
      setOccupancyData(response?.data || response);
      setReportsSubTab("occupancy");
      toast.success("Occupancy report loaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load occupancy report"));
    }
  };

  const handleExport = async () => {
    if (!canExport) return;

    try {
      const response = await exportAttendance({ format: exportFormat }, user?.token);
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const ext = exportFormat === "pdf" ? "pdf" : exportFormat === "excel" ? "xlsx" : "csv";
      link.download = `attendance.${ext}`;
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
      if (mode === "in") {
        await adminCheckIn({ userId: selectedId, type: userType }, user?.token);
        toast.success(`${userType} checked in successfully`);
      } else {
        const fn = canForceCheckout ? adminCheckOut : adminCheckOut;
        await fn({ userId: selectedId }, user?.token);
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

  const handleBulkCheckIn = async () => {
    if (!canMark || !bulkCheckInUserIds.length) {
      toast.error("Select at least one user");
      return;
    }
    try {
      setActionLoading(true);
      const records = bulkCheckInUserIds.map((uid) => ({ userId: uid, type: userType }));
      const result = await bulkCheckIn(records, user?.token);
      const data = result?.data || result;
      toast.success(`Checked in ${data.succeeded || 0} users`);
      if (data.failed?.length) {
        data.failed.forEach((f) => toast.error(`${f.userId}: ${f.reason}`));
      }
      setBulkCheckInUserIds([]);
      void loadToday();
    } catch (error) {
      toast.error(getApiError(error, "Bulk check-in failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!canMark || !bulkRecords.trim()) {
      toast.error("Paste historical records in JSON format");
      return;
    }
    try {
      setActionLoading(true);
      let parsed;
      try {
        parsed = JSON.parse(bulkRecords);
      } catch {
        toast.error("Invalid JSON format");
        return;
      }
      const records = Array.isArray(parsed) ? parsed : parsed.records || [];
      if (!records.length) {
        toast.error("No records found in JSON");
        return;
      }
      const result = await bulkImportAttendance(records, user?.token);
      const data = result?.data || result;
      setBulkImportResult(data);
      toast.success(`Imported ${data.imported || 0} records`);
    } catch (error) {
      toast.error(getApiError(error, "Bulk import failed"));
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
    if (!id || !canUpdate) return;

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
    if (!id || !canDelete) return;
    if (!confirm("Delete this attendance record?")) return;

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

    if (canView) {
      await loadToday();
    } else if (ownUserId) {
      await loadUserHistory();
    }

    toast.success("Filters reset");
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const statCards = [
    canView && { label: "Today Check-Ins", value: metrics.todayCheckIns ?? records.length, icon: Users, tone: "blue" },
    canView && { label: "Active Sessions", value: metrics.activeSessions, icon: Clock, tone: "emerald" },
    canView && { label: "Completed Sessions", value: metrics.completedSessions, icon: CheckCircle2, tone: "violet" },
    canView && { label: "Auto Closed Sessions", value: metrics.autoClosedSessions, icon: Timer, tone: "amber" },
    canView && { label: "Absent Members", value: absentCount, icon: UserRoundX, tone: "red" },
    canView && { label: "Late Check-Ins", value: lateCount, icon: CalendarDays, tone: "slate" },
  ].filter(Boolean);

  const canShowReports = canViewReports || canViewSummary || canExport;

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

      {canMark && (
        <Card className="overflow-hidden">
          <SectionHeader
            icon={LogIn}
            title="Admin Check-in / Check-out"
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
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold ${isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                              {(item.name || item.email || userType[0]).slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-gray-900">{item.name || item.email || userIdOf(item)}</span>
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
                <button type="button" onClick={() => void handleCheckInOut("in")} disabled={actionLoading || !selectedUser} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                  <LogIn size={17} />
                  {actionLoading ? "Processing..." : "Check In"}
                </button>
                <button type="button" onClick={() => void handleCheckInOut("out")} disabled={actionLoading || !selectedUser} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
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
            { key: "records", label: "Attendance" },
            { key: "reports", label: "Reports", hidden: !canShowReports },
            { key: "bulk", label: "Bulk Ops", hidden: !canMark },
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

      {activeTab === "records" && (
        <section className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-semibold text-gray-950">Attendance Records</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {loading ? "Loading records..." : `${filteredRecords.length} of ${records.length} records shown`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canView && (
                  <button type="button" onClick={() => void loadToday()} className={compactButtonClass}>
                    Today
                  </button>
                )}
                {canView && (
                  <button type="button" onClick={() => void loadList("active")} className={compactButtonClass}>
                    Active
                  </button>
                )}
                {canView && (
                  <button type="button" onClick={() => void loadList("late")} className={compactButtonClass}>
                    Late
                  </button>
                )}
                {canView && (
                  <button type="button" onClick={() => void loadList("trainer")} className={compactButtonClass}>
                    Trainers
                  </button>
                )}
                <button type="button" onClick={() => setShowFilterPanel((prev) => !prev)} className={primaryButtonClass}>
                  <ArrowUpDown size={17} />
                  {showFilterPanel ? "Hide Filters" : "Filters"}
                </button>
              </div>
            </div>
          </Card>

          {showFilterPanel && (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-950">Advanced Filters</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Refine attendance records.</p>
                </div>
                <button type="button" onClick={() => setShowFilterPanel(false)} className={iconButtonClass} aria-label="Close filters">
                  <X size={17} />
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                <Field label="User Id">
                  <input className={compactInputClass} value={filters.userId} onChange={(event) => updateFilter("userId", event.target.value)} placeholder="user_uuid" />
                </Field>
                <Field label="Late After Hour">
                  <input className={compactInputClass} type="number" min="0" max="23" value={lateAfterHour} onChange={(event) => setLateAfterHour(event.target.value)} />
                </Field>
                <div className="flex items-end gap-2 sm:col-span-2">
                  <button type="button" onClick={() => void loadFiltered()} className={primaryButtonClass}>
                    Apply Filters
                  </button>
                  <button type="button" onClick={() => void loadList("absent")} className={compactButtonClass}>
                    Absent
                  </button>
                  <button type="button" onClick={() => void loadList("date")} className={compactButtonClass}>
                    By Date
                  </button>
                  <button type="button" onClick={() => void loadUserHistory()} className={compactButtonClass}>
                    User History
                  </button>
                  <button type="button" onClick={() => void resetFilters()} className={compactButtonClass}>
                    Reset
                  </button>
                </div>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 shadow-sm">
                <Search size={17} className="shrink-0 text-gray-400" />
                <input className="h-11 min-w-0 flex-1 text-sm outline-none" value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="Search attendance records..." />
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
                      <td colSpan={6} className="p-6 text-center text-sm text-gray-500">Loading attendance records...</td>
                    </tr>
                  )}
                  {!loading && filteredRecords.map((record, index) => {
                    const id = recordId(record) || `${displayName(record)}-${index}`;
                    const isExpanded = expandedId === id;
                    return (
                      <Fragment key={id}>
                        <tr className="align-middle transition hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <button type="button" onClick={() => setExpandedId(isExpanded ? "" : id)} className={iconButtonClass} aria-label="Toggle details">
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
                              {canUpdate && (
                                <button type="button" onClick={() => startEdit(record)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-600 transition hover:bg-blue-50" aria-label="Edit">
                                  <Pencil size={17} />
                                </button>
                              )}
                              {canDelete && (
                                <button type="button" onClick={() => void handleDelete(record)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50" aria-label="Delete">
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
                                  { label: "Duration", value: durationText(record) },
                                  { label: "Trainer", value: record.trainerName || record.trainer?.name || record.trainerId || "-" },
                                  { label: "Status", value: record.status || "-" },
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
                <span className="min-w-16 text-center text-sm font-semibold text-gray-700">{filters.page} / {totalPages}</span>
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
          <SectionHeader icon={BarChart3} title="Reports & Export" detail="Monthly, weekly, quarterly, yearly reports, trends, and exports." />
          <div className="flex flex-wrap gap-2 border-b border-gray-200 px-4 py-3">
            {[
              { key: "monthly", label: "Monthly", hidden: !canViewReports },
              { key: "weekly", label: "Weekly", hidden: !canViewReports },
              { key: "quarterly", label: "Quarterly", hidden: !canViewReports },
              { key: "yearly", label: "Yearly", hidden: !canViewReports },
              { key: "trends", label: "Trends", hidden: !canViewReports },
              { key: "peakHours", label: "Peak Hours", hidden: !canViewReports },
              { key: "comparison", label: "Comparison", hidden: !canViewReports },
              { key: "retention", label: "Retention", hidden: !canViewReports },
              { key: "occupancy", label: "Occupancy", hidden: !canViewReports },
              { key: "summary", label: "Member Summary", hidden: !canViewSummary },
              { key: "export", label: "Export", hidden: !canExport },
            ].filter((t) => !t.hidden).map((t) => (
              <button key={t.key} type="button" onClick={() => setReportsSubTab(t.key)}
                className={`h-9 rounded-md px-3 text-xs font-semibold transition ${reportsSubTab === t.key ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {reportsSubTab === "monthly" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Month"><input className={inputClass} type="number" min="1" max="12" value={monthlyQuery.month} onChange={(e) => setMonthlyQuery({ ...monthlyQuery, month: e.target.value })} /></Field>
                  <Field label="Year"><input className={inputClass} type="number" value={monthlyQuery.year} onChange={(e) => setMonthlyQuery({ ...monthlyQuery, year: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadMonthlyReport()} className={primaryButtonClass}><BarChart3 size={16} /> Generate</button></div>
                </div>
                {Object.keys(monthlyReport).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(monthlyReport).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-gray-500">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">{displayMetric(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "weekly" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Year"><input className={inputClass} type="number" value={weeklyQuery.year} onChange={(e) => setWeeklyQuery({ ...weeklyQuery, year: e.target.value })} /></Field>
                  <Field label="Week #"><input className={inputClass} type="number" min="1" max="53" value={weeklyQuery.week} onChange={(e) => setWeeklyQuery({ ...weeklyQuery, week: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadWeeklyReport()} className={primaryButtonClass}><BarChart3 size={16} /> Generate</button></div>
                </div>
                {weeklyReport && Object.keys(weeklyReport).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(weeklyReport).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-gray-500">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">{displayMetric(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "quarterly" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Year"><input className={inputClass} type="number" value={quarterlyQuery.year} onChange={(e) => setQuarterlyQuery({ ...quarterlyQuery, year: e.target.value })} /></Field>
                  <Field label="Quarter (1-4)"><input className={inputClass} type="number" min="1" max="4" value={quarterlyQuery.quarter} onChange={(e) => setQuarterlyQuery({ ...quarterlyQuery, quarter: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadQuarterlyReport()} className={primaryButtonClass}><BarChart3 size={16} /> Generate</button></div>
                </div>
                {quarterlyReport && Object.keys(quarterlyReport).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(quarterlyReport).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-gray-500">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">{displayMetric(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "yearly" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Year"><input className={inputClass} type="number" value={yearlyQuery.year} onChange={(e) => setYearlyQuery({ ...yearlyQuery, year: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadYearlyReport()} className={primaryButtonClass}><BarChart3 size={16} /> Generate</button></div>
                </div>
                {yearlyReport && Object.keys(yearlyReport).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(yearlyReport).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-gray-500">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">{displayMetric(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "trends" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Days (1-365)"><input className={inputClass} type="number" min="1" max="365" value={trendsQuery.days} onChange={(e) => setTrendsQuery({ ...trendsQuery, days: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadTrends()} className={primaryButtonClass}><BarChart3 size={16} /> Load Trends</button></div>
                </div>
                {trendsData && (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendsData.labels?.map((label, i) => ({ label, value: trendsData.series?.[i] || 0, unique: trendsData.uniqueSeries?.[i] || 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#2563eb" name="Check-ins" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="unique" stroke="#16a34a" name="Unique Members" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "peakHours" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date"><input className={inputClass} type="date" value={peakHoursQuery.date} onChange={(e) => setPeakHoursQuery({ ...peakHoursQuery, date: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadPeakHours()} className={primaryButtonClass}><BarChart3 size={16} /> Load</button></div>
                </div>
                {peakHoursData && (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Array.isArray(peakHoursData) ? peakHoursData : peakHoursData.hours || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip labelFormatter={(h) => `${h}:00`} />
                        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "comparison" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Period 1 Start"><input className={inputClass} type="date" value={comparisonQuery.period1Start} onChange={(e) => setComparisonQuery({ ...comparisonQuery, period1Start: e.target.value })} /></Field>
                  <Field label="Period 1 End"><input className={inputClass} type="date" value={comparisonQuery.period1End} onChange={(e) => setComparisonQuery({ ...comparisonQuery, period1End: e.target.value })} /></Field>
                  <Field label="Period 2 Start"><input className={inputClass} type="date" value={comparisonQuery.period2Start} onChange={(e) => setComparisonQuery({ ...comparisonQuery, period2Start: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadComparison()} className={primaryButtonClass}><BarChart3 size={16} /> Compare</button></div>
                </div>
                {comparisonData && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Period 1 Check-ins</p>
                      <p className="mt-2 text-2xl font-bold text-gray-950">{comparisonData.period1?.totalCheckIns ?? "-"}</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Period 2 Check-ins</p>
                      <p className="mt-2 text-2xl font-bold text-gray-950">{comparisonData.period2?.totalCheckIns ?? "-"}</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Change</p>
                      <p className="mt-2 text-2xl font-bold text-gray-950">{comparisonData.changes?.checkIns ?? "-"}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "retention" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Lookback Days"><input className={inputClass} type="number" min="1" max="365" value={retentionQuery.days} onChange={(e) => setRetentionQuery({ ...retentionQuery, days: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadRetention()} className={primaryButtonClass}><BarChart3 size={16} /> Load</button></div>
                </div>
                {retentionData && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Return Rate 7d</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-700">{retentionData.returnRate7d ?? "-"}</p>
                      <p className="text-xs text-gray-500 mt-1">{retentionData.returned7d ?? 0} members</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Return Rate 14d</p>
                      <p className="mt-2 text-2xl font-bold text-blue-700">{retentionData.returnRate14d ?? "-"}</p>
                      <p className="text-xs text-gray-500 mt-1">{retentionData.returned14d ?? 0} members</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Return Rate 30d</p>
                      <p className="mt-2 text-2xl font-bold text-violet-700">{retentionData.returnRate30d ?? "-"}</p>
                      <p className="text-xs text-gray-500 mt-1">{retentionData.returned30d ?? 0} members</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">At Risk</p>
                      <p className="mt-2 text-2xl font-bold text-amber-700">{retentionData.atRisk ?? "-"}</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Churned</p>
                      <p className="mt-2 text-2xl font-bold text-red-700">{retentionData.churned ?? "-"}</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Avg Visits / Member</p>
                      <p className="mt-2 text-2xl font-bold text-gray-950">{retentionData.avgVisitsPerMember ?? "-"}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "occupancy" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date"><input className={inputClass} type="date" value={occupancyQuery.date} onChange={(e) => setOccupancyQuery({ ...occupancyQuery, date: e.target.value })} /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadOccupancy()} className={primaryButtonClass}><BarChart3 size={16} /> Load</button></div>
                </div>
                {occupancyData && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-gray-500">Peak Hour</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">{occupancyData.peakHour !== undefined ? `${occupancyData.peakHour}:00` : "-"}</p>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-gray-500">Peak Count</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">{occupancyData.peakCount ?? "-"}</p>
                      </div>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Array.isArray(occupancyData.hours) ? occupancyData.hours : []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 10 }} />
                          <YAxis />
                          <Tooltip labelFormatter={(h) => `${h}:00`} />
                          <Bar dataKey="peakConcurrent" fill="#2563eb" radius={[4, 4, 0, 0]} name="Peak Concurrent" />
                          <Bar dataKey="checkIns" fill="#16a34a" radius={[4, 4, 0, 0]} name="Check-ins" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            )}

            {reportsSubTab === "summary" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="User Id"><input className={inputClass} value={summaryUserId} onChange={(e) => setSummaryUserId(e.target.value)} placeholder="user_uuid" /></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void loadMemberSummary()} className={softButtonClass}>Load Summary</button></div>
                </div>
                {Object.keys(memberSummary).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(memberSummary).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-gray-500">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">{displayMetric(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === "export" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Format">
                    <select className={inputClass} value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                      <option value="csv">CSV</option>
                      <option value="excel">Excel</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </Field>
                  <div className="flex items-end"><button type="button" onClick={() => void handleExport()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"><Download size={16} /> Download</button></div>
                </div>
              </div>
            )}

            {!["monthly", "weekly", "quarterly", "yearly", "trends", "peakHours", "comparison", "retention", "occupancy", "summary", "export"].includes(reportsSubTab) && (
              <EmptyState title="Select a report type" detail="Choose from the tabs above to view attendance analytics." />
            )}
          </div>
        </Card>
      )}

      {activeTab === "bulk" && canMark && (
        <Card className="overflow-hidden">
          <SectionHeader icon={Upload} title="Bulk Operations" detail="Batch check-in or import historical attendance records." />
          <div className="grid gap-6 p-4 lg:grid-cols-2">
            <div className="rounded-md border border-gray-200 p-4">
              <h3 className="mb-3 font-semibold text-gray-950">Bulk Check-In</h3>
              <p className="mb-4 text-sm text-gray-500">Select users and check them all in at once.</p>
              <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
                {users.map((u) => {
                  const uid = userIdOf(u);
                  const selected = bulkCheckInUserIds.includes(uid);
                  return (
                    <label key={uid} className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm transition last:border-b-0 ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={selected} onChange={() => setBulkCheckInUserIds((prev) => selected ? prev.filter((id) => id !== uid) : [...prev, uid])} className="h-4 w-4 rounded border-gray-300" />
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{u.name || u.email || uid}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">{bulkCheckInUserIds.length} selected</span>
                <button type="button" onClick={() => void handleBulkCheckIn()} disabled={actionLoading || !bulkCheckInUserIds.length} className={primaryButtonClass}>
                  <LogIn size={16} />
                  {actionLoading ? "Checking in..." : `Check In (${bulkCheckInUserIds.length})`}
                </button>
              </div>
            </div>

            <div className="rounded-md border border-gray-200 p-4">
              <h3 className="mb-3 font-semibold text-gray-950">Bulk Import (Historical)</h3>
              <p className="mb-4 text-sm text-gray-500">Paste a JSON array of historical attendance records.</p>
              <textarea className="min-h-32 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={bulkRecords} onChange={(e) => setBulkRecords(e.target.value)} placeholder='[{ "userId": "uuid", "type": "MEMBER", "checkIn": "2026-06-01T08:00:00Z", "checkOut": "2026-06-01T09:30:00Z", "source": "MANUAL", "status": "COMPLETED" }]' />
              <div className="mt-3 flex items-center justify-between">
                {bulkImportResult && <span className="text-sm text-gray-500">Imported: {bulkImportResult.imported ?? 0} records</span>}
                <button type="button" onClick={() => void handleBulkImport()} disabled={actionLoading || !bulkRecords.trim()} className={primaryButtonClass}>
                  <Upload size={16} />
                  {actionLoading ? "Importing..." : "Import Records"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {editRecord && canUpdate && (
        <Card className="p-4">
          <form onSubmit={handleUpdate}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <Field label="Check In"><input className={inputClass} type="datetime-local" value={editForm.checkIn} onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })} /></Field>
              <Field label="Check Out"><input className={inputClass} type="datetime-local" value={editForm.checkOut} onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })} /></Field>
              <Field label="Status">
                <select className={inputClass} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="AUTO_CLOSED">AUTO_CLOSED</option>
                </select>
              </Field>
              <div className="flex gap-2">
                <button type="submit" className={primaryButtonClass}>Save</button>
                <button type="button" onClick={() => setEditRecord(null)} className={softButtonClass}>Cancel</button>
              </div>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
