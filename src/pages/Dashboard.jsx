import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  ClipboardList,
  CreditCard,
  Dumbbell,
  LineChart as LineChartIcon,
  Mail,
  MessageSquare,
  Package,
  Plus,
  QrCode,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";

const membershipColors = ["#16a34a", "#f59e0b", "#ef4444"];

const quickActions = [
  { label: "Add member", icon: Plus, to: "/members", moduleKey: "members" },
  { label: "Record payment", icon: ReceiptText, to: "/payments", moduleKey: "payments" },
  { label: "Create class", icon: CalendarDays, to: "/schedule", moduleKey: "schedule" },
  { label: "Send message", icon: MessageSquare, to: "/modules/communication", moduleKey: "communication" },
];

const modules = [
  { name: "Members", detail: "Profiles, plans, expiry, trainers", icon: Users, to: "/members", moduleKey: "members" },
  { name: "Staff", detail: "Roles, schedules, class groups", icon: UserRoundCheck, to: "/modules/staff", moduleKey: "staff" },
  { name: "Classes", detail: "Booking, trainer assignment, capacity", icon: CalendarDays, to: "/schedule", moduleKey: "schedule" },
  { name: "Payments", detail: "Plans, dues, receipts, reports", icon: CreditCard, to: "/payments", moduleKey: "payments" },
  { name: "Reports", detail: "Membership, income, attendance", icon: LineChartIcon, to: "/modules/reports", moduleKey: "reports" },
  { name: "Attendance", detail: "Daily log and QR check-in", icon: QrCode, to: "/modules/attendance", moduleKey: "attendance" },
  { name: "Finance", detail: "Income, expenses, transactions", icon: ClipboardList, to: "/modules/finance", moduleKey: "finance" },
  { name: "Store", detail: "Products, inventory, sales", icon: ShoppingBag, to: "/modules/products", moduleKey: "products" },
  { name: "Facilities", detail: "Rooms, halls, reservations", icon: Building2, to: "/modules/facilities", moduleKey: "facilities" },
  { name: "Communication", detail: "Member and staff communication", icon: MessageSquare, to: "/modules/communication", moduleKey: "communication" },
  { name: "Settings", detail: "Language, currency, gym theme", icon: Settings, to: "/modules/localization", moduleKey: "localization" },
];

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
  const staffResponsibilities = readStorage("staffResponsibilities");
  const trainers = readStorage("trainers");
  const today = new Date();

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
      value: (trainers.length + staffResponsibilities.length).toString(),
      change: `${staffResponsibilities.length} role records`,
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
  const alerts = getDashboardNotifications();
  const { stats, revenueData, attendanceData, membershipData, planData } = getDashboardData();
  const visibleQuickActions = quickActions.filter((action) => canAccess(user, action.moduleKey));
  const visibleModules = modules.filter((module) => canAccess(user, module.moduleKey));

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-blue-100">Welcome back to Gym Master</p>
          </div>
          <ShieldCheck size={48} className="opacity-20" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-950">{stat.value}</p>
                </div>
                <div className={`rounded-md p-2 ${stat.tone}`}>
                  <Icon size={22} />
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500">{stat.change}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-950">Fee Payment & Income</h2>
              <p className="text-sm text-gray-500">Monthly collection trend and payment count</p>
            </div>
            <CreditCard className="text-gray-400" size={22} />
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <LineChart data={revenueData}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Line type="monotone" dataKey="income" stroke="#2563eb" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="payments" stroke="#16a34a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-950">Membership Status</h2>
              <p className="text-sm text-gray-500">Active, expiring, and inactive members</p>
            </div>
            <Users className="text-gray-400" size={22} />
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Pie data={membershipData} dataKey="value" innerRadius={68} outerRadius={105} paddingAngle={3}>
                {membershipData.map((entry, index) => (
                  <Cell key={entry.name} fill={membershipColors[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {membershipData.map((item, index) => (
              <div key={item.name} className="rounded-md bg-gray-50 p-2">
                <span className="mx-auto mb-1 block h-2 w-6 rounded-full" style={{ background: membershipColors[index] }} />
                <p className="font-semibold text-gray-900">{item.value}</p>
                <p className="text-xs text-gray-500">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-950">Attendance & Plan Distribution</h2>
              <p className="text-sm text-gray-500">Daily visits with current membership plan mix</p>
            </div>
            <QrCode className="text-gray-400" size={22} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={attendanceData}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="visits" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={planData} layout="vertical" margin={{ left: 18 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#6b7280" />
                <YAxis dataKey="plan" type="category" stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="members" fill="#7c3aed" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-950">Quick Actions</h2>
              <p className="text-sm text-gray-500">Common admin tasks</p>
            </div>
            <Plus className="text-gray-400" size={22} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visibleQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-center text-sm font-semibold text-gray-800 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <Icon size={22} />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.4fr]">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-950">Notifications</h2>
              <p className="text-sm text-gray-500">Renewals, dues, and schedule reminders</p>
            </div>
            <Bell className="text-gray-400" size={22} />
          </div>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Link
                key={alert.title}
                to={alert.to}
                className={`block rounded-md border p-3 transition hover:shadow-sm ${alert.tone}`}
              >
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-1 text-sm">{alert.detail}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-950">Admin Modules</h2>
              <p className="text-sm text-gray-500">Gym Master portal coverage</p>
            </div>
            <Package className="text-gray-400" size={22} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleModules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.name}
                  to={module.to}
                  className="rounded-md border border-gray-200 p-3 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                    <Icon size={19} />
                  </div>
                  <p className="font-semibold text-gray-950">{module.name}</p>
                  <p className="mt-1 text-sm leading-5 text-gray-500">{module.detail}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
