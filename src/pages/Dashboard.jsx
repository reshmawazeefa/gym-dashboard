import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { normalizeRole } from "../utils/rbac";
import { canAccess } from "../utils/rbac";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LineChart as LineChartIcon,
  Mail,
  MessageSquare,
  Package,
  Plus,
  QrCode,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const membershipColors = ["#16a34a", "#f59e0b", "#ef4444"];

const modules = [
  { name: "Members", detail: "Profiles, plans, expiry, trainers", icon: Users, to: "/members", moduleKey: "members" },
  { name: "Staff", detail: "Trainers, receptionists, administrators", icon: Users, to: "/trainers", moduleKey: "staff" },
  { name: "Classes", detail: "Creation, schedules, bookings", icon: CalendarDays, to: "/modules/classes", moduleKey: "classes" },
  { name: "Payments", detail: "Plans, dues, receipts, reports", icon: CreditCard, to: "/payments", moduleKey: "payments" },
  { name: "Reports", detail: "Membership, income, attendance", icon: LineChartIcon, to: "/modules/reports", moduleKey: "reports" },
  { name: "Attendance", detail: "Daily log and QR check-in", icon: QrCode, to: "/modules/attendance", moduleKey: "attendance" },
  { name: "Finance", detail: "Income, expenses, transactions", icon: ClipboardList, to: "/modules/finance", moduleKey: "finance" },
  { name: "Store", detail: "Products, inventory, sales", icon: ShoppingBag, to: "/modules/products", moduleKey: "products" },
  { name: "Facilities", detail: "Rooms, halls, reservations", icon: Building2, to: "/modules/facilities", moduleKey: "facilities" },
  { name: "Facility Maintenance", detail: "Service tasks, scheduling, and status updates", icon: ClipboardList, to: "/modules/facility-maintenance", moduleKey: "facility-maintenance" },
  { name: "Communication", detail: "Member and staff communication", icon: MessageSquare, to: "/modules/communication", moduleKey: "communication" },
  { name: "Settings", detail: "Language, currency, gym theme", icon: Settings, to: "/modules/localization", moduleKey: "localization" },
];

const emptyProductForm = {
  productName: "",
  category: "Gym Apparel",
  brand: "",
  sku: "",
  barcode: "",
  regularPrice: "",
  salePrice: "",
  lowStockThreshold: "",
  imageUrl: "",
  description: "",
  active: true,
};

function readStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function dateOnly(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function daysUntil(date) {
  const target = dateOnly(date);
  const today = dateOnly(new Date());
  return Math.ceil((target - today) / 86400000);
}

function sameMonth(date, monthDate) {
  const nextDate = new Date(date);
  return (
    !Number.isNaN(nextDate.getTime()) &&
    nextDate.getFullYear() === monthDate.getFullYear() &&
    nextDate.getMonth() === monthDate.getMonth()
  );
}

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;
}

function getRecentMonths(count = 6) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
    return date;
  });
}

function getRecentDays(count = 6) {
  const today = dateOnly(new Date());
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - index));
    return date;
  });
}

function getDashboardData() {
  const members = readStorage("members");
  const payments = readStorage("payments");
  const plans = readStorage("plans");
  const attendanceRecords = readStorage("attendanceRecords");
  const financeRecords = readStorage("financeRecords");
  const trainers = readStorage("trainers");
  const staff = readStorage("staff");
  const today = new Date();

  // Calculate combined and deduplicated staff count
  const combined = [...(staff || []), ...(trainers || [])];
  const uniqueStaff = combined.filter((item, idx, arr) => {
    const key = item?.id || item?.email || JSON.stringify(item);
    return arr.findIndex((x) => (x?.id || x?.email || JSON.stringify(x)) === key) === idx;
  });
  const staffCount = uniqueStaff.length;

  const activeMembers = members.filter((member) => {
    if (member.status === "Inactive") return false;
    if (!member.expiryDate) return member.status === "Active";
    return daysUntil(member.expiryDate) >= 0;
  });
  const expiringMembers = members.filter((member) => {
    if (member.status === "Inactive" || !member.expiryDate) return false;
    const remainingDays = daysUntil(member.expiryDate);
    return remainingDays >= 0 && remainingDays <= 7;
  });
  const inactiveMembers = members.filter((member) => {
    if (member.status === "Inactive") return true;
    return member.expiryDate ? daysUntil(member.expiryDate) < 0 : false;
  });

  const paidPayments = payments.filter((payment) => payment.status === "Paid");
  const pendingPayments = payments.filter((payment) => payment.status !== "Paid");
  const monthlyPaidPayments = paidPayments.filter((payment) => sameMonth(payment.date, today));
  const monthlyIncomeFromPayments = monthlyPaidPayments.reduce(
    (total, payment) => total + (Number(payment.amount) || 0),
    0
  );
  const monthlyFinanceIncome = financeRecords
    .filter((record) => record.type === "Income" && record.status === "Paid" && sameMonth(record.date, today))
    .reduce((total, record) => total + (Number(record.amount) || 0), 0);
  const dueAmount = pendingPayments.reduce(
    (total, payment) => total + (Number(payment.amount) || 0),
    0
  );

  const revenueData = getRecentMonths().map((monthDate) => {
    const monthPayments = paidPayments.filter((payment) => sameMonth(payment.date, monthDate));
    const monthFinanceIncome = financeRecords
      .filter((record) => record.type === "Income" && record.status === "Paid" && sameMonth(record.date, monthDate))
      .reduce((total, record) => total + (Number(record.amount) || 0), 0);

    return {
      month: monthDate.toLocaleString("en-US", { month: "short" }),
      income:
        monthPayments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0) +
        monthFinanceIncome,
      payments: monthPayments.length,
    };
  });

  const attendanceData = getRecentDays().map((dayDate) => {
    const isoDate = dayDate.toISOString().split("T")[0];
    return {
      day: dayDate.toLocaleString("en-US", { weekday: "short" }),
      visits: attendanceRecords.filter(
        (record) => record.date === isoDate && ["Present", "Late"].includes(record.status)
      ).length,
    };
  });
  const todayIso = today.toISOString().split("T")[0];
  const todayCheckIns = attendanceRecords.filter(
    (record) => record.date === todayIso && ["Present", "Late"].includes(record.status)
  ).length;

  const memberPlanCounts = members.reduce((counts, member) => {
    const planName = member.planName || member.plan || "Unassigned";
    counts[planName] = (counts[planName] || 0) + 1;
    return counts;
  }, {});
  const planData = Object.entries(memberPlanCounts).map(([plan, count]) => ({
    plan,
    members: count,
  }));
  const fallbackPlanData = plans.map((plan) => ({ plan: plan.name, members: 0 }));

  const membershipData = [
    { name: "Active", value: activeMembers.length },
    { name: "Expiring", value: expiringMembers.length },
    { name: "Inactive", value: inactiveMembers.length },
  ];

  const stats = [
    {
      label: "Total Members",
      value: members.length.toString(),
      change: `${activeMembers.length} active members`,
      icon: Users,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Staff & Trainers",
      value: staffCount.toString(),
      change: `${staffCount} trainer records`,
      icon: Dumbbell,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Monthly Income",
      value: formatCurrency(monthlyIncomeFromPayments + monthlyFinanceIncome),
      change: `${monthlyPaidPayments.length} paid payments this month`,
      icon: CreditCard,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Due Amount",
      value: formatCurrency(dueAmount),
      change: `${pendingPayments.length} pending payments`,
      icon: WalletCards,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return {
    stats,
    staffCount,
    activeMemberCount: activeMembers.length,
    expiringMemberCount: expiringMembers.length,
    inactiveMemberCount: inactiveMembers.length,
    monthlyIncome: monthlyIncomeFromPayments + monthlyFinanceIncome,
    dueAmount,
    pendingPaymentCount: pendingPayments.length,
    todayCheckIns,
    revenueData,
    attendanceData,
    membershipData,
    planData: planData.length ? planData : fallbackPlanData,
  };
}

function getDashboardNotifications() {
  const members = readStorage("members");
  const payments = readStorage("payments");
  const reminders = readStorage("expirationReminders");
  const facilities = readStorage("facilityBookings");
  const finance = readStorage("financeRecords");

  const notifications = [];
  const expiringMembers = members.filter((member) => {
    if (!member.expiryDate || member.status === "Inactive") return false;
    const remainingDays = daysUntil(member.expiryDate);
    return remainingDays >= 0 && remainingDays <= 7;
  });
  const expiredMembers = members.filter((member) => {
    if (!member.expiryDate || member.status === "Inactive") return false;
    return daysUntil(member.expiryDate) < 0;
  });
  const pendingPayments = payments.filter((payment) => payment.status !== "Paid");
  const queuedReminders = reminders.filter((reminder) => reminder.status === "Queued");
  const todayIso = new Date().toISOString().split("T")[0];
  const todayBookings = facilities.filter(
    (booking) => booking.date === todayIso && booking.status === "Reserved"
  );
  const financeFollowUps = finance.filter((record) =>
    ["Pending", "Overdue"].includes(record.status)
  );

  if (expiredMembers.length) {
    notifications.push({
      title: `${expiredMembers.length} memberships already expired`,
      detail: `${expiredMembers.slice(0, 3).map((member) => member.name).join(", ")} need renewal follow-up.`,
      tone: "border-red-200 bg-red-50 text-red-800",
      to: "/members",
    });
  }

  if (expiringMembers.length) {
    notifications.push({
      title: `${expiringMembers.length} memberships expire in 7 days`,
      detail: `${expiringMembers.slice(0, 3).map((member) => member.name).join(", ")} are close to expiry.`,
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      to: "/modules/reminders",
    });
  }

  if (pendingPayments.length) {
    const pendingTotal = pendingPayments.reduce(
      (total, payment) => total + (Number(payment.amount) || 0),
      0
    );
    notifications.push({
      title: `${pendingPayments.length} pending payments need follow-up`,
      detail: `Pending collection total is Rs. ${pendingTotal.toLocaleString("en-IN")}.`,
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      to: "/payments",
    });
  }

  if (queuedReminders.length) {
    notifications.push({
      title: `${queuedReminders.length} renewal reminders queued`,
      detail: "Review reminder channel and send status before the due date.",
      tone: "border-blue-200 bg-blue-50 text-blue-800",
      to: "/modules/reminders",
    });
  }

  if (todayBookings.length) {
    notifications.push({
      title: `${todayBookings.length} facilities reserved today`,
      detail: todayBookings
        .slice(0, 2)
        .map((booking) => `${booking.facility} at ${booking.time}`)
        .join(", "),
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      to: "/modules/facilities",
    });
  }

  if (financeFollowUps.length) {
    notifications.push({
      title: `${financeFollowUps.length} finance records need review`,
      detail: "Pending or overdue income, expense, and invoice records are waiting.",
      tone: "border-violet-200 bg-violet-50 text-violet-800",
      to: "/modules/finance",
    });
  }

  return notifications.length
    ? notifications.slice(0, 5)
    : [
        {
          title: "No urgent notifications",
          detail: "Memberships, payments, reminders, bookings, and finance records look clear.",
          tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
          to: "/modules/reports",
        },
      ];
}

export default function Dashboard() {
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role, user?.loginType);
  const isMember = userRole === "member";
  const alerts = getDashboardNotifications();
  const {
    stats,
    activeMemberCount,
    expiringMemberCount,
    inactiveMemberCount,
    monthlyIncome,
    dueAmount,
    pendingPaymentCount,
    todayCheckIns,
    revenueData,
    attendanceData,
    membershipData,
    planData,
  } = getDashboardData();
  const [liveAttendance, setLiveAttendance] = React.useState(null);
  const [overviewRange, setOverviewRange] = React.useState("This Month");
  const [transactionsRange, setTransactionsRange] = React.useState("This Year");
  const [periodMenuOpen, setPeriodMenuOpen] = React.useState(false);
  const [transactionsMenuOpen, setTransactionsMenuOpen] = React.useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = React.useState(false);
  const [productForm, setProductForm] = React.useState(emptyProductForm);
  const periodMenuRef = React.useRef(null);
  const transactionMenuRef = React.useRef(null);

  const updateProductField = (field, value) => {
    setProductForm((current) => ({ ...current, [field]: value }));
  };

  const handleProductCategoryChange = (category) => {
    setProductForm({ ...emptyProductForm, category });
  };

  React.useEffect(() => {
    if (!isAddProductOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAddProductOpen]);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(event.target)) {
        setPeriodMenuOpen(false);
      }
      if (transactionMenuRef.current && !transactionMenuRef.current.contains(event.target)) {
        setTransactionsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { getAttendanceDashboard } = await import("../services/api");
        const data = await getAttendanceDashboard(user?.token);
        if (!cancelled) setLiveAttendance(data?.data || data);
      } catch {
        // silently fail
      }
    };
    if (!isMember) void load();
    return () => { cancelled = true; };
  }, [user?.token, isMember]);

  if (userRole === "platform_admin") {
    return (
      <div className="space-y-6">
        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {/* <h1 className="text-xl font-semibold text-gray-950">Platform Admin Portal</h1> */}
          <p className="mt-1 text-sm text-gray-500">Manage gyms and SaaS plans from the platform administration area.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to="/platform/gyms" className="rounded-md border border-gray-200 p-4 transition hover:border-blue-300 hover:bg-blue-50">
              <Building2 size={20} className="text-blue-600" />
              <p className="mt-2 font-semibold text-gray-950">Gyms</p>
              <p className="mt-1 text-sm text-gray-500">Manage platform gyms and owners.</p>
            </Link>
            <Link to="/platform/saas-plans" className="rounded-md border border-gray-200 p-4 transition hover:border-blue-300 hover:bg-blue-50">
              <ClipboardList size={20} className="text-blue-600" />
              <p className="mt-2 font-semibold text-gray-950">SaaS Plans</p>
              <p className="mt-1 text-sm text-gray-500">Manage subscription plans and features.</p>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // replace stats for member portal: hide total members
  const visibleStats = isMember
    ? stats.filter((s) => s.label !== "Total Members")
    : stats;

  const visibleModules = isMember
    ? modules.filter((module) => ["products", "facilities"].includes(module.moduleKey) && canAccess(user, module.moduleKey))
    : modules.filter((module) => canAccess(user, module.moduleKey) && !["finance", "payments", "communication", "localization"].includes(module.moduleKey));

  const totalMembers = membershipData.reduce((total, item) => total + item.value, 0);
  const activeRate = totalMembers ? Math.round((activeMemberCount / totalMembers) * 100) : 0;
  const monthlyRevenueMax = Math.max(...revenueData.map((item) => item.income), 1);
  const revenueAxisMax = Math.max(40000, Math.ceil(monthlyRevenueMax / 10000) * 10000);
  const revenueAxisTicks = Array.from({ length: revenueAxisMax / 10000 + 1 }, (_, index) => index * 10000);
  const dashboardStats = visibleStats.map((stat, index) => ({
    ...stat,
    accent:
      index === 0
        ? "bg-[#0b8a56] text-white ring-[#0b8a56]"
        : index === 1
          ? "bg-white text-slate-900 ring-slate-200"
          : index === 2
            ? "bg-white text-slate-900 ring-slate-200"
            : "bg-white text-slate-900 ring-slate-200",
    iconClass:
      index === 0
        ? "bg-white/15 text-white"
        : index === 1
          ? "bg-sky-50 text-sky-600"
          : index === 2
            ? "bg-emerald-50 text-emerald-600"
            : "bg-amber-50 text-amber-600",
  }));
  const managementModules = visibleModules.slice(0, 6);
  const productCategories = [
    { title: "Whey Isolate Protein 2kg", detail: "Optimum Gold - Nutrition", status: "48 in stock", tone: "bg-emerald-50 text-[#0D8252] border-emerald-100" },
    { title: "Electrolyte Hydration Tub", detail: "HydroMax - Drinks", status: "12 in stock (Low)", tone: "bg-amber-50 text-amber-600 border-amber-100" },
    { title: "Gym Master Lifting Straps", detail: "GymMaster Gear - Gear", status: "85 in stock", tone: "bg-emerald-50 text-[#0D8252] border-emerald-100" },
  ];
  const cardClass = "rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05),0_1px_2px_0_rgba(16,24,40,0.02)]";
  const cardHoverClass = "transition-all hover:shadow-[0_10px_25px_-5px_rgba(16,24,40,0.08),0_8px_10px_-6px_rgba(16,24,40,0.04)]";

  return (
    <div className="min-h-screen bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Overview</h1>
            <p className="mt-0.5 text-xs text-[#64748B]">Here is the summary of gym performance, attendance and financials</p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative" ref={periodMenuRef}>
              <button
                type="button"
                onClick={() => setPeriodMenuOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#EAECF0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-[0_1px_3px_0_rgba(16,24,40,0.05)] transition hover:bg-[#F8F9FB]"
              >
                {overviewRange}
                <ChevronDown size={14} className={periodMenuOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {periodMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-[#EAECF0] bg-white shadow-lg">
                  {['This Month', 'This Year'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setOverviewRange(option);
                        setPeriodMenuOpen(false);
                      }}
                      className={`rounded-lg flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-[#0F172A] transition hover:bg-[#F8F9FB] ${overviewRange === option ? "bg-[#F3F9F6] text-[#0D8252]" : ""}`}
                    >
                      <span>{option}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className="inline-flex items-center rounded-lg border border-[#EAECF0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] shadow-[0_1px_3px_0_rgba(16,24,40,0.05)] transition hover:bg-[#F8F9FB] hover:text-[#0F172A]">Reset Data</button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {dashboardStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`${index === 0 ? "bg-gradient-to-br from-[#0D8252] via-[#0b7449] to-[#065F46] text-white shadow-[0_10px_25px_-5px_rgba(13,130,82,0.35)]" : `${cardClass} ${cardHoverClass}`} group flex min-h-[154px] flex-col justify-between overflow-hidden rounded-2xl p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${index === 0 ? "border-white/10 bg-white/15 text-white" : "border-emerald-100 bg-emerald-50 text-[#0D8252]"}`}>
                        <Icon size={18} />
                      </span>
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wider ${index === 0 ? "text-emerald-100" : "text-[#64748B]"}`}>{stat.label}</p>
                        <p className={`text-[11px] ${index === 0 ? "text-emerald-200" : "text-[#94A3B8]"}`}>{stat.change}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-left gap-2">
                      <p className={`text-3xl font-extrabold tracking-tight ${index === 0 ? "text-white" : "text-[#0F172A]"}`}>{stat.value}</p>
                      {index !== 0 && <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#0D8252]">+3.2%</span>}
                    </div>
                  </div>
                </div>

                <div className={`mt-4 flex items-center justify-between text-xs ${index === 0 ? "text-emerald-100" : "text-[#64748B]"}`}>
                  <span>{index === 0 ? "Total member registered" : "Updated this period"}</span>
                  <Link to={index === 0 ? "/members" : index === 3 ? "/payments" : "/modules/reports"} className={`font-semibold transition-transform group-hover:translate-x-0.5 ${index === 0 ? "text-white" : "text-[#0D8252]"}`}>
                    {index === 0 ? "See details" : index === 1 ? "View Staff" : index === 2 ? "Report" : "Invoices"} &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </section>

        <section className={`${cardClass} p-6`}>
          <div className="flex flex-col gap-4 border-b border-[#EAECF0] pb-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-[#0D8252] shadow-sm">
                <QrCode size={22} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-[#0F172A]">Live Attendance Command</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0D8252]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0D8252]" />
                    Real-time Sync
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">Facility turnstile & biometric check-in activity at a glance</p>
              </div>
            </div>
            <Link to="/modules/attendance" className="text-xs font-semibold text-[#0D8252] transition hover:text-[#065F46]">View all logs &rarr;</Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-6 lg:grid-cols-4">
            <DashboardMiniMetric label="Today Check-ins" value={liveAttendance?.today?.checkIns ?? todayCheckIns} detail="members" />
            <DashboardMiniMetric label="Active Floor Presence" value={liveAttendance?.today?.activeSessions ?? 0} detail="Currently working out" positive />
            <DashboardMiniMetric label="Week to Date" value={liveAttendance?.weekToDate?.checkIns ?? attendanceData.reduce((total, day) => total + day.visits, 0)} detail={liveAttendance?.weekToDate?.vsLastWeek != null ? `${liveAttendance.weekToDate.vsLastWeek}% vs last week` : "check-ins"} />
            <DashboardMiniMetric label="Month to Date" value={liveAttendance?.monthToDate?.checkIns ?? todayCheckIns} detail={liveAttendance?.monthToDate?.vsLastMonth != null ? `${liveAttendance.monthToDate.vsLastMonth}% vs last month` : "check-ins"} danger={Number(liveAttendance?.monthToDate?.vsLastMonth || 0) < 0} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_0.95fr]">
          <div className={`${cardClass} flex flex-col justify-between p-6`}>
            <div className="mb-[2rem] flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Transactions Overview</h2>
                <p className="mt-1 text-3xl font-extrabold tracking-tight text-[#0F172A]">
                  ₹{Number(monthlyIncome || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 sm:items-end">
                <div className="relative self-start sm:self-auto" ref={transactionMenuRef}>
                  <button
                    type="button"
                    onClick={() => setTransactionsMenuOpen((open) => !open)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#EAECF0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] shadow-[0_1px_3px_0_rgba(16,24,40,0.05)] transition hover:bg-[#F8F9FB]"
                  >
                    {transactionsRange}
                    <ChevronDown size={14} className={transactionsMenuOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                  </button>

                  {transactionsMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-[#EAECF0] bg-white shadow-lg">
                      {['This Month', 'This Year'].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setTransactionsRange(option);
                            setTransactionsMenuOpen(false);
                          }}
                          className={`rounded-lg flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-[#0F172A] transition hover:bg-[#F8F9FB] ${transactionsRange === option ? "bg-[#F3F9F6] text-[#0D8252]" : ""}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#0D8252]"><span className="h-2 w-2 rounded-full bg-[#0D8252]" />Total Transaction</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#94A3B8]"><span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />Earning</span>
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="#EAECF0" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis
                  domain={[0, revenueAxisMax]}
                  ticks={revenueAxisTicks}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Tooltip cursor={{ fill: "#f8fafc" }} formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="income" radius={[10, 10, 0, 0]}>
                  {revenueData.map((item) => (
                    <Cell
                      key={item.month}
                      fill={item.income === monthlyRevenueMax ? "#079669" : "#F6F8FA"}
                      stroke={item.income === monthlyRevenueMax ? "#079669" : "#DCE5EC"}
                      strokeWidth={item.income === monthlyRevenueMax ? 0 : 1.5}
                      strokeDasharray={item.income === monthlyRevenueMax ? undefined : "4 3"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 flex items-center justify-between border-t border-[#EAECF0] pt-3 text-xs text-[#64748B]">
              <span>Projection: Onboarding Phase</span>
              <Link to="/payments" className="font-semibold text-[#0D8252] transition hover:text-[#065F46]">View All Details &rarr;</Link>
            </div>
          </div>

          <div className={`${cardClass} flex flex-col justify-between p-6`}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Membership Status</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">Active, expiring, and inactive ratios</p>
              </div>
              <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-semibold text-[#64748B]">{totalMembers} Total</span>
            </div>

            <div className="relative mx-auto mt-2 h-56 w-56">
              <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
                <circle cx="110" cy="110" r="82" fill="none" stroke="#EAF0F3" strokeWidth="18" />
                <circle
                  cx="110"
                  cy="110"
                  r="82"
                  fill="none"
                  stroke="#0D8252"
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 82}
                  strokeDashoffset={2 * Math.PI * 82 * (1 - (activeRate || 100) / 100)}
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold tracking-tight text-[#0F172A]">{activeRate}%</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0D8252]">Health</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#EAECF0] pt-3 text-center">
              {membershipData.map((item, index) => (
                <div key={item.name} className="rounded-xl border border-[#EAECF0] bg-[#F8F9FB] p-2">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#0F172A]">
                    <span className="h-2 w-2 rounded-full" style={{ background: membershipColors[index] }} />
                    <span>{item.name}</span>
                  </div>
                  <p className={`mt-1 text-lg font-bold ${index === 0 ? "text-[#0F172A]" : "text-[#64748B]"}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={`${cardClass} flex h-full flex-col justify-between p-6`}>
            <div>
              <div className="flex items-center justify-between border-b border-[#EAECF0] pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#0F172A]">Notifications</h2>
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#0D8252]">All Up to date</span>
                </div>
                <Bell size={16} className="text-[#94A3B8]" />
              </div>

              <div className="mt-4 space-y-3">
                {alerts.slice(0, 3).map((alert, index) => (
                  <Link key={alert.title} to={alert.to} className={`block rounded-xl border p-3.5 transition hover:border-[#0D8252] ${index === 0 ? "border-emerald-100 bg-emerald-50/50 text-[#0F172A]" : "border-[#EAECF0] bg-[#F8F9FB] text-[#64748B]"}`}>
                    <div className="flex items-start gap-2.5">
                      <Mail size={14} className={index === 0 ? "mt-0.5 shrink-0 text-[#0D8252]" : "mt-0.5 shrink-0 text-[#94A3B8]"} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#0F172A]">{alert.title}</p>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#64748B]">{alert.detail}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[#EAECF0] pt-3 text-xs text-[#64748B]">
              <span>System Status: Optimal</span>
              <Link to="/modules/notifications" className="font-semibold text-[#0D8252] transition hover:text-[#065F46]">View all &rarr;</Link>
            </div>
          </div>

          <div className={`${cardClass} flex h-full flex-col justify-between p-6`}>
            <div>
              <div className="flex items-center justify-between border-b border-[#EAECF0] pb-3">
                <h2 className="text-base font-bold text-[#0F172A]">Management Modules</h2>
                <Package size={16} className="text-[#94A3B8]" />
              </div>

              <div className="my-3.5 grid max-h-[310px] grid-cols-2 gap-2.5 overflow-y-auto pr-1">
                {managementModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Link key={module.name} to={module.to} className="group flex flex-col rounded-xl border border-[#EAECF0] bg-white p-3 text-left transition-all hover:border-[#0D8252] hover:bg-[#F8F9FB]">
                      <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B] transition-colors group-hover:bg-emerald-50 group-hover:text-[#0D8252]">
                        <Icon size={15} />
                      </span>
                      <span className="truncate text-xs font-bold leading-tight text-[#0F172A]">{module.name}</span>
                      <span className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-[#64748B]">{module.detail}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#EAECF0] pt-3 text-xs text-[#64748B]">
              <span>All modules operational</span>
              <Link to="/modules/reports" className="font-semibold text-[#0D8252] transition hover:text-[#065F46]">View all &rarr;</Link>
            </div>
          </div>

          <div className={`${cardClass} flex h-full flex-col justify-between p-6`}>
            <div>
              <div className="flex items-center justify-between border-b border-[#EAECF0] pb-3">
                <h2 className="text-base font-bold text-[#0F172A]">Product & Category</h2>
                <Link to="/modules/products" className="text-xs font-semibold text-[#0D8252] transition hover:text-[#065F46]">View all &rarr;</Link>
              </div>

              <div className="mt-3.5 space-y-2.5">
                {productCategories.map((item) => (
                  <div key={item.title} className="flex items-center justify-between gap-3 rounded-xl border border-[#EAECF0] bg-[#F8F9FB] p-3 transition hover:border-[#0D8252]">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#0F172A]">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">{item.detail}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.tone}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setProductForm(emptyProductForm);
                setIsAddProductOpen(true);
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#EAECF0] bg-white py-2 text-xs font-bold text-[#0F172A] transition hover:border-[#0D8252] hover:text-[#0D8252]"
            >
              <Plus size={14} className="mr-1" /> Add Product
            </button>
          </div>
        </section>
      </div>

      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setIsAddProductOpen(false)}>
          <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#0F172A]">Add Product</h3>
                  <p className="mt-1 text-xs text-[#64748B]">Add a new product with inventory stock, pricing, and category information.</p>
                </div>
              </div>

              <button type="button" onClick={() => setIsAddProductOpen(false)} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label="Close product modal">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-medium text-[#475569]">
                  <span className="mb-1.5 block">Product Name *</span>
                  <input type="text" value={productForm.productName} onChange={(event) => updateProductField("productName", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>

                <label className="block text-xs font-medium text-[#475569]">
                  <span className="mb-1.5 block">Category *</span>
                  <select value={productForm.category} onChange={(event) => handleProductCategoryChange(event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white">
                    <option>Gym Apparel</option>
                    <option>Supplements</option>
                    <option>Equipment</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-[#475569]">
                  <span className="mb-1.5 block">Brand</span>
                  <input type="text" value={productForm.brand} onChange={(event) => updateProductField("brand", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>

                <label className="block text-xs font-medium text-[#475569]">
                  <span className="mb-1.5 block">SKU</span>
                  <input type="text" value={productForm.sku} onChange={(event) => updateProductField("sku", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>

                <label className="block text-xs font-medium text-[#475569]">
                  <span className="mb-1.5 block">Barcode</span>
                  <input type="text" value={productForm.barcode} onChange={(event) => updateProductField("barcode", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>

                <label className="block text-xs font-medium text-[#475569]">
                  <span className="mb-1.5 block">Regular Price (₹)</span>
                  <input type="text" value={productForm.regularPrice} onChange={(event) => updateProductField("regularPrice", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>

                <label className="block text-xs font-medium text-[#475569]">
                  <span className="mb-1.5 block">Sale Price (₹)</span>
                  <input type="text" value={productForm.salePrice} onChange={(event) => updateProductField("salePrice", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>

                <label className="block text-xs font-medium text-[#475569]">
                  <span className="mb-1.5 block">Low Stock Threshold</span>
                  <input type="text" value={productForm.lowStockThreshold} onChange={(event) => updateProductField("lowStockThreshold", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>

                <label className="block text-xs font-medium text-[#475569] md:col-span-2">
                  <span className="mb-1.5 block">Image URL</span>
                  <input type="text" value={productForm.imageUrl} onChange={(event) => updateProductField("imageUrl", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>

                <label className="block text-xs font-medium text-[#475569] md:col-span-2">
                  <span className="mb-1.5 block">Description</span>
                  <textarea rows="4" value={productForm.description} onChange={(event) => updateProductField("description", event.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:bg-white" />
                </label>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#334155]">
                  <input type="checkbox" checked={productForm.active} onChange={(event) => updateProductField("active", event.target.checked)} className="h-4 w-4 rounded border-[#CBD5E1] accent-[#0D8252] focus:ring-2 focus:ring-[#0D8252]" />
                  <span>Active in store catalog</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={() => setIsAddProductOpen(false)} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
              <button type="button" onClick={() => setIsAddProductOpen(false)} className="rounded-lg bg-[#0D8252] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b7348]">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardMiniMetric({ label, value, detail, positive = false, danger = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex min-w-0 items-baseline gap-2">
        <p className="truncate text-lg font-extrabold text-slate-950">{value}</p>
        {detail && (
          <span className={`truncate rounded-full px-2 py-0.5 text-[10px] font-bold ${danger ? "bg-red-50 text-red-600" : positive ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}
