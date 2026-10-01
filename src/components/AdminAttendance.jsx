import { useCallback, useEffect, useMemo, useState } from "react";
import TablePagination from "./TablePagination";
import StatusBadge from "./StatusBadge";
import {
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Edit,
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
  getAttendanceLogs,
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
  "h-8 w-full rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] px-3 text-xs text-[#0F172A] outline-none transition placeholder:font-normal placeholder:not-italic placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
const compactInputClass =
  "h-8 w-full rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] px-3 text-xs text-[#0F172A] outline-none transition placeholder:font-normal placeholder:not-italic placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
const compactButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60";
const softButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60";

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

function toIsoDateTime(dateValue, boundary) {
  if (!dateValue) return "";
  const time = boundary === "end" ? "T23:59:59.999Z" : "T00:00:00.000Z";
  return `${dateValue}${time}`;
}

function buildAttendanceFilterParams(filterValues) {
  const { startDate, endDate, ...rest } = filterValues;
  const params = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );

  const hasStartDate = Boolean(startDate);
  const hasEndDate = Boolean(endDate);

  if (hasStartDate !== hasEndDate) {
    return {
      params: null,
      error: "Select both start date and end date before applying a date filter.",
    };
  }

  if (hasStartDate && hasEndDate) {
    params.startDate = toIsoDateTime(startDate, "start");
    params.endDate = toIsoDateTime(endDate, "end");
  }

  return { params, error: "" };
}

function getAttendanceRequestError(error, fallback) {
  const details = error?.response?.data?.errors;
  if (Array.isArray(details) && details.length) {
    return details.map((item) => `${item.field}: ${item.message}`).join("; ");
  }
  return getApiError(error, fallback);
}

function unwrapAttendance(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
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

function unwrapPagination(payload) {
  return payload?.data?.pagination || null;
}

function unwrapMetrics(payload) {
  return payload?.data && !Array.isArray(payload.data) ? payload.data : payload || {};
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
  return <section className={`rounded-xl border border-[#E5EAF0] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] ${className}`}>{children}</section>;
}

function SectionHeader({ icon: Icon, title, detail, action }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-white">
            <Icon size={15} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-5 text-[#0F172A]">{title}</h3>
          {detail && <p className="mt-0.5 text-xs text-[#64748B]">{detail}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`grid gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#64748B] ${className}`}>
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
    <div className="min-h-[82px] rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${tones[tone] || tones.slate}`}><IconComponent size={14} /></span>
      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase leading-none tracking-wide text-[#64748B]">{label}</p>
        <p className="mt-1.5 text-xl font-extrabold leading-none tracking-tight text-[#0F172A]">{value ?? "-"}</p>
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
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
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
  const [editForm, setEditForm] = useState({ checkIn: "", checkOut: "", status: "COMPLETED", source: "", type: "" });
  const [logsData, setLogsData] = useState([]);
  const [logsPagination, setLogsPagination] = useState(null);
  const [logsFilters, setLogsFilters] = useState({ userId: "", action: "", page: "1", limit: "20" });
  const [serverPagination, setServerPagination] = useState(null);
  const [bulkRecords, setBulkRecords] = useState("");
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [bulkCheckInUserIds, setBulkCheckInUserIds] = useState([]);
  const [bulkCheckInSearch, setBulkCheckInSearch] = useState("");

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
  const filteredBulkUsers = useMemo(() => {
    const query = bulkCheckInSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((item) =>
      [item.name, item.email, userIdOf(item)].join(" ").toLowerCase().includes(query)
    );
  }, [bulkCheckInSearch, users]);

  const totalRecords = serverPagination?.total ?? records.length;
  const recordsPage = Number(filters.page || 1);
  const recordsLimit = Number(filters.limit || 10);
  const recordsTotalPages = serverPagination?.totalPages || Math.max(1, Math.ceil(totalRecords / recordsLimit));
  const recordsShowingStart = totalRecords ? (recordsPage - 1) * recordsLimit + 1 : 0;
  const recordsShowingEnd = totalRecords ? Math.min(recordsPage * recordsLimit, totalRecords) : 0;
  const totalLogs = logsPagination?.total ?? logsData.length;
  const logsPage = Number(logsFilters.page || 1);
  const logsLimit = Number(logsFilters.limit || 20);
  const logsTotalPages = logsPagination?.totalPages || Math.max(1, Math.ceil(totalLogs / logsLimit));
  const logsShowingStart = totalLogs ? (logsPage - 1) * logsLimit + 1 : 0;
  const logsShowingEnd = totalLogs ? Math.min(logsPage * logsLimit, totalLogs) : 0;

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

  const loadFiltered = async (filterOverride = filters) => {
    if (!canView) return;
    const { params, error } = buildAttendanceFilterParams(filterOverride);
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setLoading(true);
      const response = await filterAttendance(params, user?.token);
      setRecords(unwrapAttendance(response));
      setServerPagination(unwrapPagination(response));
      setActiveTab("records");
      toast.success("Attendance filters applied");
    } catch (error) {
      toast.error(getAttendanceRequestError(error, "Unable to filter attendance"));
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
      toast.error(getAttendanceRequestError(error, "Unable to load comparison"));
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

  const resetReports = () => {
    setMonthlyQuery({ month: "", year: "" });
    setWeeklyQuery({ year: "", week: "" });
    setQuarterlyQuery({ year: "", quarter: "" });
    setYearlyQuery({ year: "" });
    setTrendsQuery({ days: "" });
    setPeakHoursQuery({ date: "" });
    setComparisonQuery({
      period1Start: "",
      period1End: "",
      period2Start: "",
      period2End: "",
    });
    setRetentionQuery({ days: "" });
    setOccupancyQuery({ date: "" });
    setSummaryUserId("");
    setExportFormat("csv");
    setMonthlyReport({});
    setWeeklyReport(null);
    setQuarterlyReport(null);
    setYearlyReport(null);
    setTrendsData(null);
    setPeakHoursData(null);
    setComparisonData(null);
    setRetentionData(null);
    setOccupancyData(null);
    setMemberSummary({});
    toast.success("Reports reset");
  };

  const loadLogs = async (filterOverride = logsFilters) => {
    if (!canView) return;
    const params = Object.fromEntries(
      Object.entries(filterOverride).filter(([, value]) => value !== "")
    );
    try {
      setLoading(true);
      const response = await getAttendanceLogs(params, user?.token);
      const data = response?.data || response;
      setLogsData(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
      setLogsPagination(data?.pagination || null);
      setActiveTab("logs");
    } catch (error) {
      toast.error(getApiError(error, "Unable to load attendance logs"));
    } finally {
      setLoading(false);
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

  const handleCheckInOutForUser = async (targetUser, mode) => {
    if (!targetUser) {
      toast.error("Please select a user");
      return;
    }

    try {
      setActionLoading(true);
      const selectedId = userIdOf(targetUser);
      if (mode === "in") {
        await adminCheckIn({ userId: selectedId, type: userType }, user?.token);
        toast.success(`${userType} checked in successfully`);
      } else {
        await adminCheckOut({ userId: selectedId }, user?.token);
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
      source: record.source || "",
      type: record.type || "",
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
        source: editForm.source || undefined,
        type: editForm.type || undefined,
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

  const applyFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value, page: "1" };
    setFilters(nextFilters);
    void loadFiltered(nextFilters);
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
  const attendanceTabs = [
    canView && { key: "records", label: "Attendance", icon: CalendarDays },
    canShowReports && { key: "reports", label: "Reports", icon: BarChart3 },
    canView && { key: "logs", label: "Logs", icon: Clock },
    canMark && { key: "bulk", label: "Bulk Ops", icon: Upload },
  ].filter(Boolean);

  return (
    <div className="min-h-full bg-[#F7F8FA] p-3 text-[#1E293B] sm:p-4">
      <div className="mx-auto w-full max-w-7xl space-y-3">
        <section className="flex items-start justify-between gap-3 px-0.5">
          <div>
            {/* <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0D8252]">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-[#0D8252]" /> Live Facility</span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="text-[#94A3B8]">Branch #01</span>
            </div> */}
            <h1 className="text-2xl font-extrabold leading-6 tracking-tight text-[#020617]">Attendance Management</h1>
            <p className="mt-1 text-xs text-[#64748B]">Manage live check-ins, verify memberships, review session logs, and generate reports.</p>
          </div>
          <span className="hidden h-8 shrink-0 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 text-[10px] font-semibold text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:inline-flex"><Clock size={12} className="text-[#0D8252]" /> Auto-checkout timeout: 120m</span>
        </section>
      {/* <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gray-950 text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-950">Attendance Management</h2>
            <p className="mt-1 text-sm text-gray-500">Daily check-ins, live sessions, reports, and attendance corrections.</p>
          </div>
        </div>
      </Card> */}

      {statCards.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </section>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(250px,0.295fr)_minmax(0,0.705fr)]">
      {canMark && (
        <Card className="overflow-hidden">
          <div className="px-3 py-3">
            <div className="mb-3 flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#0D8252]">
                <LogIn size={15} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-5 text-[#0F172A]">Admin Check-in / Out</h2>
                <p className="text-[10px] text-[#64748B]">Select member or trainer</p>
              </div>
            </div>
            <div className="mb-3 inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5">
              {["MEMBER", "TRAINER"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setUserType(type);
                    setSelectedUser(null);
                    setSearchTerm("");
                  }}
                  className={`h-7 min-w-16 rounded-lg px-2 text-[11px] font-bold transition ${
                    userType === type ? "bg-[#0D8252] text-white shadow-sm" : "text-[#64748B] hover:bg-white hover:text-[#0F172A]"
                  }`}
                >
                  {type === "MEMBER" ? "Members" : "Trainers"}
                </button>
              ))}
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5">
              <Search size={14} className="shrink-0 text-[#94A3B8]" />
              <input
                className="h-7 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:font-normal placeholder:not-italic placeholder:text-[#94A3B8]"
                placeholder="Search members by name, email"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#64748B]">{filteredUsers.length}</span>
            </div>
            <div className="max-h-[31rem] space-y-2 overflow-y-auto pr-0.5">
              {filteredUsers.length ? (
                filteredUsers.map((item) => {
                  const isSelected = userIdOf(selectedUser) === userIdOf(item);
                  return (
                    <div key={userIdOf(item)} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition ${isSelected ? "border-emerald-200 bg-emerald-50" : "border-[#E2E8F0] bg-white hover:bg-[#FBFCFD]"}`}>
                      <button type="button" onClick={() => setSelectedUser(item)} className="rounded-lg flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className="min-w-0"><span className="block truncate text-xs font-semibold text-[#0F172A]">{item.name || item.email || userIdOf(item)}</span>
                        <span className="block truncate text-[10px] text-[#94A3B8]">{item.email || userIdOf(item)}</span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button type="button" onClick={() => { setSelectedUser(item); void handleCheckInOutForUser(item, "in"); }} disabled={actionLoading} className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#0D8252] text-white transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60" aria-label={`Check in ${item.name || "user"}`}><LogIn size={13} /></button>
                        <button type="button" onClick={() => { setSelectedUser(item); void handleCheckInOutForUser(item, "out"); }} disabled={actionLoading} className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" aria-label={`Check out ${item.name || "user"}`}><LogOut size={13} /></button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState title={`No ${userType.toLowerCase()}s found`} detail="Try another name, email, or id." />
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-[9px] text-[#64748B]"><span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full border border-[#0D8252]" /> Instant sync active</span><span>Live</span></div>
          </div>
        </Card>
      )}

      <div className="min-w-0 space-y-3">
      {attendanceTabs.length > 0 && (
        <Card className="p-1">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {attendanceTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                    activeTab === tab.key ? "bg-[#0D8252] text-white shadow-sm" : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === "records" && (
        <section className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#0F172A]">Attendance Records</h3>
                </div>
                <p className="mt-0.5 text-[10px] leading-5 text-[#94A3B8]">
                  {loading ? "Loading records..." : `${filteredRecords.length} of ${records.length} records shown`}
                </p>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Status</span>
                  <select className="h-8 min-w-32 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[10px] font-semibold text-[#475569] outline-none" value={filters.status} onChange={(event) => {
                    const value = event.target.value;
                    if (value === "TODAY") {
                      updateFilter("status", "");
                      void loadToday();
                    } else if (value === "ACTIVE") {
                      updateFilter("status", value);
                      void loadList("active");
                    } else if (value === "LATE") {
                      updateFilter("status", value);
                      void loadList("late");
                    } else if (value === "ABSENT") {
                      updateFilter("status", value);
                      void loadList("absent");
                    } else {
                      applyFilterChange("status", value);
                    }
                  }}>
                    <option value="">All</option>
                    <option value="TODAY">Today</option>
                    <option value="ACTIVE">Active</option>
                    <option value="LATE">Late</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="AUTO_CLOSED">Auto Closed</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Type</span>
                  <select className="h-8 min-w-28 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[10px] font-semibold text-[#475569] outline-none" value={filters.type} onChange={(event) => applyFilterChange("type", event.target.value)}>
                    <option value="">All</option>
                    <option value="MEMBER">Member</option>
                    <option value="TRAINER">Trainer</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Date</span>
                  <button type="button" onClick={() => setShowDateFilterModal(true)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[10px] font-semibold text-[#475569] transition hover:bg-[#F8FAFC]"><CalendarDays size={13} /> Pick Range</button>
                </div>
                {/* <div className="flex items-end justify-start lg:justify-end">
                <button type="button" onClick={() => setShowFilterPanel((prev) => !prev)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#086B43]">
                  <ArrowUpDown size={13} />
                  {showFilterPanel ? "Hide Filters" : "Filters"}
                </button>
                </div> */}
              </div>
            </div>

          {showFilterPanel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setShowFilterPanel(false)}>
              <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">Advanced Filters</h2>
                    <p className="mt-0.5 text-xs text-[#64748B]">Refine attendance records.</p>
                  </div>
                  <button type="button" onClick={() => setShowFilterPanel(false)} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label="Close filters"><X size={17} /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Type"><select className={compactInputClass} value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}><option value="">Any</option><option value="MEMBER">MEMBER</option><option value="TRAINER">TRAINER</option></select></Field>
                    <Field label="Status"><select className={compactInputClass} value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">Any</option><option value="ACTIVE">ACTIVE</option><option value="COMPLETED">COMPLETED</option><option value="AUTO_CLOSED">AUTO_CLOSED</option></select></Field>
                    <Field label="Start Date"><input className={compactInputClass} type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} /></Field>
                    <Field label="End Date"><input className={compactInputClass} type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} /></Field>
                    <Field label="User Id"><input className={compactInputClass} value={filters.userId} onChange={(event) => updateFilter("userId", event.target.value)} placeholder="user_uuid" /></Field>
                    <Field label="Late After Hour"><input className={compactInputClass} type="number" min="0" max="23" value={lateAfterHour} onChange={(event) => setLateAfterHour(event.target.value)} /></Field>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FBFCFD] px-5 py-4">
                  <button type="button" onClick={() => void loadFiltered()} className={primaryButtonClass}>Apply Filters</button>
                  <button type="button" onClick={() => void loadList("absent")} className={compactButtonClass}>Absent</button>
                  <button type="button" onClick={() => void loadList("date")} className={compactButtonClass}>By Date</button>
                  <button type="button" onClick={() => void loadUserHistory()} className={compactButtonClass}>User History</button>
                  <button type="button" onClick={() => void resetFilters()} className={compactButtonClass}>Reset</button>
                </div>
              </div>
            </div>
          )}

          {showDateFilterModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setShowDateFilterModal(false)}>
              <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">Filter by Date</h2>
                    <p className="mt-0.5 text-xs text-[#64748B]">Select the attendance date range.</p>
                  </div>
                  <button type="button" onClick={() => setShowDateFilterModal(false)} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label="Close date filter modal"><X size={17} /></button>
                </div>
                <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
                  <Field label="Start Date"><input className={compactInputClass} type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} /></Field>
                  <Field label="End Date"><input className={compactInputClass} type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} /></Field>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FBFCFD] px-5 py-4">
                  <button type="button" onClick={() => setShowDateFilterModal(false)} className={softButtonClass}>Cancel</button>
                  <button type="button" onClick={() => { setShowDateFilterModal(false); setTimeout(() => void loadFiltered(), 0); }} className={primaryButtonClass}>Apply Filters</button>
                </div>
              </div>
            </div>
          )}

            <div className="border-b border-[#EEF2F4] p-4">
              <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3">
                <Search size={17} className="shrink-0 text-gray-400" />
                <input className="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:font-normal placeholder:not-italic placeholder:text-[#94A3B8]" value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="Search attendance records..." />
              </div>
            </div>
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-left">
                <thead className="sticky top-0 z-10 bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B] shadow-sm">
                  <tr>
                    <th className="w-[21%] px-3 py-3">User</th>
                    <th className="w-[13%] px-3 py-3">Type</th>
                    <th className="w-[15%] px-3 py-3">Check In</th>
                    <th className="w-[15%] px-3 py-3">Check Out</th>
                    <th className="w-[12%] px-3 py-3">Duration</th>
                    <th className="w-[14%] px-3 py-3">Status</th>
                    <th className="w-[10%] px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-sm text-gray-500">Loading attendance records...</td>
                    </tr>
                  )}
                  {!loading && filteredRecords.map((record, index) => {
                    const id = recordId(record) || `${displayName(record)}-${index}`;
                    const durationMinutes = record.duration != null ? record.duration : null;
                    return (
                      <tr key={id} className="h-[58px] align-middle border-t border-[#EEF2F4] text-[10px] text-[#475569] transition hover:bg-[#FBFCFD]">
                        <td className="px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#0F172A]">{displayName(record)}</p>
                            {/* <p className="truncate text-[10px] text-[#94A3B8]">{record.userId || record.email || recordId(record) || "-"}</p> */}
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><span className="inline-flex rounded-md bg-[#F1F5F9] px-2 py-1 text-[10px] font-semibold text-[#64748B]">{getType(record)}</span></td>
                        <td className="px-3 py-2.5 text-[#475569]">{displayDate(getCheckIn(record))}</td>
                        <td className="px-3 py-2.5 text-[#475569]">{displayDate(getCheckOut(record))}</td>
                        <td className="px-3 py-2.5 text-[#475569]">
                          {durationMinutes != null
                            ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
                            : durationText(record) !== "-"
                              ? durationText(record)
                              : "-"}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={record.status} label={record.status || "-"} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {canUpdate && (
                              <button type="button" onClick={() => startEdit(record)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#0D8252] transition hover:bg-emerald-50" aria-label="Edit">
                                <Edit size={15} />
                              </button>

                            )}
                            {canDelete && (
                              <button type="button" onClick={() => void handleDelete(record)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50" aria-label="Delete">
                                <Trash size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && !filteredRecords.length && (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState title="No attendance records found" detail="Adjust filters, load today, or choose another quick list." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-[#64748B]">
                Showing {recordsShowingStart} to {recordsShowingEnd} of {totalRecords} attendance records
              </span>
              <TablePagination page={recordsPage} totalPages={recordsTotalPages} onPageChange={(nextPage) => { const nextFilters = { ...filters, page: String(nextPage) }; setFilters(nextFilters); void loadFiltered(nextFilters); }} className="gap-2" />
            </div>
          </Card>
        </section>
      )}
      {activeTab === "reports" && (
        <Card className="overflow-hidden">
          <SectionHeader
            icon={BarChart3}
            title="Reports & Export"
            detail="Monthly, weekly, quarterly, yearly reports, trends, and exports."
            action={
              <select
                className="h-8 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[10px] font-semibold text-[#475569] outline-none sm:w-36"
                value={reportsSubTab}
                onChange={(event) => setReportsSubTab(event.target.value)}
                aria-label="Select report"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="trends">Trends</option>
                <option value="peakHours">Peak Hours</option>
                <option value="comparison">Comparison</option>
                <option value="retention">Retention</option>
                <option value="occupancy">Occupancy</option>
                {/* <option value="summary">Member Summary</option> */}
                <option value="export">Export</option>
              </select>
            }
          />

          <div className="p-3">
            {reportsSubTab === "monthly" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <Field label="Month"><input className={inputClass} type="number" min="1" max="12" value={monthlyQuery.month} onChange={(e) => setMonthlyQuery({ ...monthlyQuery, month: e.target.value })} placeholder="Month" /></Field>
                  <Field label="Year"><input className={inputClass} type="number" value={monthlyQuery.year} onChange={(e) => setMonthlyQuery({ ...monthlyQuery, year: e.target.value })} placeholder="Year" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadMonthlyReport()} className={primaryButtonClass}><BarChart3 size={14} /> Generate</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Total Check Ins", monthlyReport.totalCheckIns ?? monthlyReport.checkIns ?? monthlyReport.total],
                    ["Unique Members", monthlyReport.uniqueMembers ?? monthlyReport.uniqueMemberCount],
                    ["Average Daily Attendance", monthlyReport.averageDailyAttendance ?? monthlyReport.averageDaily ?? monthlyReport.average],
                  ].map(([label, value]) => (
                    <div key={label} className="min-h-[78px] rounded-lg border border-[#E2E8F0] bg-white px-4 py-3">
                      <p className="max-w-36 text-[9px] font-bold uppercase leading-4 tracking-wide text-[#64748B]">{label}</p>
                      <p className="mt-2 text-xl font-extrabold leading-none tracking-tight text-[#0F172A]">{displayMetric(value)}</p>
                    </div>
                  ))}
                </div>
                {Object.keys(monthlyReport).filter((key) => !["totalCheckIns", "checkIns", "total", "uniqueMembers", "uniqueMemberCount", "averageDailyAttendance", "averageDaily", "average"].includes(key)).length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {Object.entries(monthlyReport).filter(([key]) => !["totalCheckIns", "checkIns", "total", "uniqueMembers", "uniqueMemberCount", "averageDailyAttendance", "averageDaily", "average"].includes(key)).map(([key, value]) => (
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
                  <Field label="Year"><input className={inputClass} type="number" value={weeklyQuery.year} onChange={(e) => setWeeklyQuery({ ...weeklyQuery, year: e.target.value })} placeholder="Year" /></Field>
                  <Field label="Week #"><input className={inputClass} type="number" min="1" max="53" value={weeklyQuery.week} onChange={(e) => setWeeklyQuery({ ...weeklyQuery, week: e.target.value })} placeholder="Week number" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadWeeklyReport()} className={primaryButtonClass}><BarChart3 size={16} /> Generate</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                  <Field label="Year"><input className={inputClass} type="number" value={quarterlyQuery.year} onChange={(e) => setQuarterlyQuery({ ...quarterlyQuery, year: e.target.value })} placeholder="Year" /></Field>
                  <Field label="Quarter (1-4)"><input className={inputClass} type="number" min="1" max="4" value={quarterlyQuery.quarter} onChange={(e) => setQuarterlyQuery({ ...quarterlyQuery, quarter: e.target.value })} placeholder="Quarter" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadQuarterlyReport()} className={primaryButtonClass}><BarChart3 size={16} /> Generate</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                  <Field label="Year"><input className={inputClass} type="number" value={yearlyQuery.year} onChange={(e) => setYearlyQuery({ ...yearlyQuery, year: e.target.value })} placeholder="Year" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadYearlyReport()} className={primaryButtonClass}><BarChart3 size={16} /> Generate</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                  <Field label="Days (1-365)"><input className={inputClass} type="number" min="1" max="365" value={trendsQuery.days} onChange={(e) => setTrendsQuery({ ...trendsQuery, days: e.target.value })} placeholder="Days" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadTrends()} className={primaryButtonClass}><BarChart3 size={16} /> Load Trends</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                  <Field label="Date"><input className={inputClass} type="date" value={peakHoursQuery.date} onChange={(e) => setPeakHoursQuery({ ...peakHoursQuery, date: e.target.value })} placeholder="Date" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadPeakHours()} className={primaryButtonClass}><BarChart3 size={16} /> Load</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Period 1 Start"><input className={inputClass} type="date" value={comparisonQuery.period1Start} onChange={(e) => setComparisonQuery({ ...comparisonQuery, period1Start: e.target.value })} placeholder="Start date" /></Field>
                  <Field label="Period 1 End"><input className={inputClass} type="date" value={comparisonQuery.period1End} onChange={(e) => setComparisonQuery({ ...comparisonQuery, period1End: e.target.value })} placeholder="End date" /></Field>
                  <Field label="Period 2 Start"><input className={inputClass} type="date" value={comparisonQuery.period2Start} onChange={(e) => setComparisonQuery({ ...comparisonQuery, period2Start: e.target.value })} placeholder="Start date" /></Field>
                  <Field label="Period 2 End"><input className={inputClass} type="date" value={comparisonQuery.period2End} onChange={(e) => setComparisonQuery({ ...comparisonQuery, period2End: e.target.value })} placeholder="End date" /></Field>
                  <div className="flex items-end gap-2 md:col-span-2 md:justify-start">
                    <button type="button" onClick={() => void loadComparison()} className={primaryButtonClass}><BarChart3 size={16} /> Compare</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                  <Field label="Lookback Days"><input className={inputClass} type="number" min="1" max="365" value={retentionQuery.days} onChange={(e) => setRetentionQuery({ ...retentionQuery, days: e.target.value })} placeholder="Days" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadRetention()} className={primaryButtonClass}><BarChart3 size={16} /> Load</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                  <Field label="Date"><input className={inputClass} type="date" value={occupancyQuery.date} onChange={(e) => setOccupancyQuery({ ...occupancyQuery, date: e.target.value })} placeholder="Date" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadOccupancy()} className={primaryButtonClass}><BarChart3 size={16} /> Load</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                  <Field label="User Id"><input className={inputClass} value={summaryUserId} onChange={(e) => setSummaryUserId(e.target.value)} placeholder="User ID" /></Field>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void loadMemberSummary()} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60">Load Summary</button>
                    <button type="button" onClick={resetReports} className={softButtonClass}>Reset</button>
                  </div>
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
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void handleExport()} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60"><Download size={16} /> Download</button>
                    <button type="button" onClick={resetReports} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60">Reset</button>
                  </div>
                </div>
              </div>
            )}

            {!["monthly", "weekly", "quarterly", "yearly", "trends", "peakHours", "comparison", "retention", "occupancy", "summary", "export"].includes(reportsSubTab) && (
              <EmptyState title="Select a report type" detail="Choose from the tabs above to view attendance analytics." />
            )}
          </div>
        </Card>
      )}

      {activeTab === "logs" && (
        <Card className="overflow-hidden">
          <SectionHeader
            icon={Clock}
            title="Attendance Audit Logs"
            detail="Track every state change: check-in, check-out, auto-close, edits, and deletions."
          />
          <div className="px-3 pb-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end">
              <Field label="User Id">
                <input className={compactInputClass} value={logsFilters.userId} onChange={(e) => setLogsFilters((prev) => ({ ...prev, userId: e.target.value, page: "1" }))} placeholder="Filter by user" />
              </Field>
              <Field label="Action">
                <select className={compactInputClass} value={logsFilters.action} onChange={(e) => setLogsFilters((prev) => ({ ...prev, action: e.target.value, page: "1" }))}>
                  <option value="">All</option>
                  <option value="CREATED">CREATED</option>
                  <option value="UPDATED">UPDATED</option>
                  <option value="DELETED">DELETED</option>
                  <option value="AUTO_CLOSED">AUTO_CLOSED</option>
                </select>
              </Field>
              <button type="button" onClick={() => void loadLogs()} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-4 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60">
                  <Search size={13} /> Load Logs
                </button>
                <button type="button" onClick={() => { setLogsFilters({ userId: "", action: "", page: "1", limit: "20" }); setLogsData([]); setLogsPagination(null); }} className="inline-flex h-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-4 text-[10px] font-bold text-[#475569] transition hover:bg-[#F8FAFC]">
                  Reset
                </button>
            </div>
          </div>
          <div className="overflow-auto border-t border-[#EEF2F4]">
            <table className="min-w-full table-fixed text-left">
              <thead className="sticky top-0 z-10 bg-white text-[9px] font-bold uppercase tracking-wide text-[#475569] shadow-[0_1px_0_#EEF2F4]">
                <tr>
                  <th className="w-[15%] px-4 py-3">Action</th>
                  <th className="w-[17%] px-4 py-3">User</th>
                  <th className="w-[15%] px-4 py-3">Timestamp</th>
                  <th className="w-[28%] px-4 py-3">Changes</th>
                  <th className="w-[25%] px-4 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading && (
                  <tr><td colSpan={5} className="h-56 p-6 text-center text-xs text-[#64748B]">Loading audit logs...</td></tr>
                )}
                {!loading && logsData.map((log, index) => {
                  const logId = log.id || `log-${index}`;
                  const changes = log.changes || {};
                  const attendance = log.attendance || {};
                  return (
                    <tr key={logId} className="align-top text-xs transition hover:bg-[#FBFCFD]">
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${
                          log.action === "CREATED" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                          log.action === "UPDATED" ? "bg-blue-50 text-blue-700 ring-blue-200" :
                          log.action === "DELETED" ? "bg-red-50 text-red-700 ring-red-200" :
                          log.action === "AUTO_CLOSED" ? "bg-amber-50 text-amber-700 ring-amber-200" :
                          "bg-gray-100 text-gray-700 ring-gray-200"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        <p className="truncate font-semibold text-[#0F172A]">{attendance?.user?.name || log.changedBy || attendance?.userId || "-"}</p>
                        <p className="truncate text-[10px] text-[#94A3B8]">{attendance?.user?.email || ""}</p>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{displayDate(log.createdAt)}</td>
                      <td className="px-4 py-3 text-[#475569]">
                        <div className="max-h-20 overflow-y-auto rounded-md bg-[#F8FAFC] p-2 text-[10px] font-mono">
                          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(changes, null, 1)}</pre>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        <p className="text-[10px] text-[#64748B]">{attendance?.id || log.attendanceId || "-"}</p>
                        <p className="text-[10px] text-[#64748B]">
                          {attendance?.checkIn ? `In: ${displayDate(attendance.checkIn)}` : ""}
                          {attendance?.checkOut ? ` Out: ${displayDate(attendance.checkOut)}` : ""}
                        </p>
                        <p className="text-xs font-medium">{attendance?.type || ""} {attendance?.status ? `· ${attendance.status}` : ""}</p>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !logsData.length && (
                  <tr>
                    <td colSpan={5}>
                      <div className="flex h-56 flex-col items-center justify-center px-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#94A3B8]">
                          <FileSpreadsheet size={18} />
                        </div>
                        <p className="mt-3 text-xs font-extrabold text-[#0F172A]">No audit logs found</p>
                        <p className="mt-1 text-[10px] text-[#64748B]">Adjust filters and click Load Logs.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-[#64748B]">
              Showing {logsShowingStart} to {logsShowingEnd} of {totalLogs} audit logs
            </span>
            <TablePagination page={logsPage} totalPages={logsTotalPages} onPageChange={(nextPage) => { const nextFilters = { ...logsFilters, page: String(nextPage) }; setLogsFilters(nextFilters); void loadLogs(nextFilters); }} className="gap-2" />
          </div>
        </Card>
      )}

      {activeTab === "bulk" && canMark && (
        <Card className="overflow-hidden rounded-2xl border-[#DDE5EF] bg-white shadow-[0_1px_8px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-white">
                <Upload size={17} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold leading-5 text-[#020617]">Bulk Operations</h3>
                <p className="mt-0.5 text-xs text-[#64748B]">Batch check-in or import historical attendance records.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#EEF2F4] px-5 py-5 sm:px-6">
            <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex min-h-[238px] flex-col rounded-xl border border-[#DDE5EF] bg-white p-4 sm:p-5">
              <h3 className="text-sm font-extrabold leading-5 text-[#0F172A]">Bulk Check-In</h3>
              <p className="mt-1.5 text-xs leading-5 text-[#64748B]">Select users and check them all in at once.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#DDE5EF] bg-[#FBFCFD] px-3 focus-within:border-[#0D8252] focus-within:bg-white">
                  <Search size={13} className="shrink-0 text-[#94A3B8]" />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-xs text-[#0F172A] outline-none placeholder:font-normal placeholder:not-italic placeholder:text-[#94A3B8]"
                    value={bulkCheckInSearch}
                    onChange={(event) => setBulkCheckInSearch(event.target.value)}
                    placeholder="Search users"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBulkCheckInSearch("");
                    setBulkCheckInUserIds([]);
                  }}
                  disabled={!bulkCheckInSearch && !bulkCheckInUserIds.length}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-[#0D8252] bg-white px-3 text-xs font-bold text-[#0D8252] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:text-[#94A3B8] disabled:opacity-70"
                >
                  Reset
                </button>
              </div>
              <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-[#DDE5EF] bg-white">
                {filteredBulkUsers.map((u) => {
                  const uid = userIdOf(u);
                  const selected = bulkCheckInUserIds.includes(uid);
                  return (
                    <label key={uid} className={`flex h-11 cursor-pointer items-center gap-3 border-b border-[#EEF2F4] px-3 text-xs transition last:border-b-0 ${selected ? "bg-emerald-50/80" : "hover:bg-[#F8FAFC]"}`}>
                      <input type="checkbox" checked={selected} onChange={() => setBulkCheckInUserIds((prev) => selected ? prev.filter((id) => id !== uid) : [...prev, uid])} className="h-4 w-4 rounded border-[#CBD5E1] accent-[#0D8252] focus:ring-2 focus:ring-[#0D8252]/20" />
                      <span className="min-w-0 flex-1 truncate font-medium text-[#334155]">{u.name || u.email || uid}</span>
                    </label>
                  );
                })}
                {!filteredBulkUsers.length && (
                  <div className="flex h-20 items-center justify-center px-4 text-center text-xs text-[#94A3B8]">
                    {bulkCheckInSearch ? "No users match your search" : "No users available"}
                  </div>
                )}
              </div>
              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <span className="pb-1 text-xs font-medium text-[#475569]">{bulkCheckInUserIds.length} selected</span>
                <button type="button" onClick={() => void handleBulkCheckIn()} disabled={actionLoading || !bulkCheckInUserIds.length} className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60">
                  <LogIn size={13} />
                  {actionLoading ? "Checking in..." : `Check In (${bulkCheckInUserIds.length})`}
                </button>
              </div>
            </div>

            <div className="flex min-h-[238px] flex-col rounded-xl border border-[#DDE5EF] bg-white p-4 sm:p-5">
              <h3 className="text-sm font-extrabold leading-5 text-[#0F172A]">Bulk Import (Historical)</h3>
              <p className="mt-1.5 text-xs leading-5 text-[#64748B]">Paste a JSON array of historical attendance records.</p>
              <textarea className="mt-4 min-h-32 w-full flex-1 resize-y rounded-lg border border-[#DDE5EF] bg-white px-3 py-3 text-xs leading-4 text-[#0F172A] outline-none placeholder:font-normal placeholder:not-italic placeholder:text-[#334155] focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" value={bulkRecords} onChange={(e) => setBulkRecords(e.target.value)} placeholder='[{ "userId": "uuid", "type": "MEMBER", "checkIn": "2026-06-01T08:00:00Z", "checkOut": "2026-06-01T09:30:00Z", "source": "MANUAL", "status": "COMPLETED" }]' />
              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                {bulkImportResult ? <span className="pb-1 text-xs font-medium text-[#475569]">Imported: {bulkImportResult.imported ?? 0} records</span> : <span />}
                <button type="button" onClick={() => void handleBulkImport()} disabled={actionLoading || !bulkRecords.trim()} className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60">
                  <Upload size={13} />
                  {actionLoading ? "Importing..." : "Import Records"}
                </button>
              </div>
            </div>
            </div>
          </div>
        </Card>
      )}

      </div>
      </div>

      {editRecord && canUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setEditRecord(null)}>
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Edit Attendance Record</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">Update the selected attendance record details.</p>
              </div>
              <button type="button" onClick={() => setEditRecord(null)} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label="Close edit attendance modal"><X size={17} /></button>
            </div>
            <form onSubmit={handleUpdate} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Check In"><input className={inputClass} type="datetime-local" value={editForm.checkIn} onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })} /></Field>
                  <Field label="Check Out"><input className={inputClass} type="datetime-local" value={editForm.checkOut} onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })} /></Field>
                  <Field label="Type"><select className={inputClass} value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}><option value="">Any</option><option value="MEMBER">MEMBER</option><option value="TRAINER">TRAINER</option></select></Field>
                  <Field label="Source"><select className={inputClass} value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}><option value="">Any</option><option value="MOBILE">MOBILE</option><option value="QR">QR</option><option value="KIOSK">KIOSK</option><option value="RFID">RFID</option><option value="BIOMETRIC">BIOMETRIC</option><option value="MANUAL">MANUAL</option></select></Field>
                  <Field label="Status"><select className={inputClass} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}><option value="ACTIVE">ACTIVE</option><option value="COMPLETED">COMPLETED</option><option value="AUTO_CLOSED">AUTO_CLOSED</option></select></Field>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FBFCFD] px-5 py-4">
                <button type="button" onClick={() => setEditRecord(null)} className={softButtonClass}>Cancel</button>
                <button type="submit" className={primaryButtonClass}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
