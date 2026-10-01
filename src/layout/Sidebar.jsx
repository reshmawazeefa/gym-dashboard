import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Languages,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Salad,
  Settings,
  ShieldCheck,
  ShoppingBag,
  User,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { canAccess, normalizeRole } from "../utils/rbac";
import { isSubscriptionActive, isSubscriptionRestricted } from "../utils/subscriptionStatus";
import { getMyGym } from "../services/api";
import { resolveGymLogoUrl } from "../utils/gymLogo";

const primaryLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, moduleKey: "dashboard" },
  { to: "/profile", label: "Profile", icon: UserCheck, moduleKey: "dashboard" },
  { to: "/members", label: "Members", icon: Users, moduleKey: "members" },
  { to: "/membership", label: "Membership", icon: ClipboardList, moduleKey: "plans" },
  { to: "/payments", label: "Payment History", icon: CreditCard, moduleKey: "payments" },
  { to: "/trainers", label: "Staff", icon: Dumbbell, moduleKey: "staff" },
  { to: "/permissions", label: "Permissions", icon: LockKeyhole, moduleKey: "permissions" },
  { to: "/platform/gyms", label: "Gyms", icon: Building2, moduleKey: "gyms" },
  { to: "/platform/saas-plans", label: "SaaS Plans", icon: ClipboardList, moduleKey: "saas-plans" },
];

const moduleSections = [
  {
    title: "Operations",
    links: [
      { to: "/modules/attendance", label: "Attendance", icon: ClipboardCheck, moduleKey: "attendance" },
      { to: "/modules/subscriptions", label: "Subscriptions", icon: UserCheck, moduleKey: "subscriptions" },
      { to: "/modules/classes", label: "Classes", icon: CalendarDays, moduleKey: "classes" },
      { to: "/modules/workouts", label: "Workouts", icon: Activity, moduleKey: "workouts" },
      { to: "/modules/payroll", label: "Payroll", icon: WalletCards, moduleKey: "payroll" },
      { to: "/modules/nutrition", label: "Nutrition", icon: Salad, moduleKey: "nutrition" },
      { to: "/modules/products", label: "Products", icon: ShoppingBag, moduleKey: "products" },
      { to: "/modules/facilities", label: "Facilities", icon: ClipboardList, moduleKey: "facilities" },
      { to: "/modules/facility-maintenance", label: "Facility Maintenance", icon: ClipboardList, moduleKey: "facility-maintenance" },
      { to: "/modules/equipments", label: "Equipments", icon: Dumbbell, moduleKey: "equipments" },
      { to: "/modules/notifications", label: "Notifications", icon: Bell, moduleKey: "notifications" },
    ],
  },
  {
    title: "Business",
    links: [
      { to: "/modules/finance", label: "Finance", icon: WalletCards, moduleKey: "finance" },
      { to: "/modules/reports", label: "Reports", icon: ChartNoAxesCombined, moduleKey: "reports" },
      { to: "/modules/communication", label: "Communication", icon: Mail, moduleKey: "communication" },
      { to: "/modules/reminders", label: "Reminders", icon: Bell, moduleKey: "reminders" },
    ],
  },
];

const HIDDEN_MODULE_KEYS = new Set(["subscriptions", "communication", "reminders", "finance", "reports"]);
const HIDDEN_PRIMARY_KEYS = new Set([]);
const PLATFORM_ADMIN_HIDDEN_PRIMARY_KEYS = new Set(["members", "staff", "payments", "permissions"]);

export default function Sidebar({ mobileOpen = false, onMobileClose = () => {}, onBlockedNavigation = () => {} }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("gymMaster.sidebarCollapsed") === "true");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountMenuPath, setAccountMenuPath] = useState("");
  const [gymData, setGymData] = useState(null);
  const [gymLogo, setGymLogo] = useState("");
  const navigate = useNavigate();
  const showFullNav = !collapsed || mobileOpen;
  const isGymOwner = normalizeRole(user?.role, user?.loginType) === "gym_owner";
  const isPlatformAdmin = normalizeRole(user?.role, user?.loginType) === "platform_admin";
  const isMember = normalizeRole(user?.role, user?.loginType) === "member";
  const hasActiveSubscription = isSubscriptionActive(user?.subscriptionStatus);
  const accountName = gymData?.name || user?.name || user?.fullName || user?.displayName || user?.userName || user?.ownerName || "Gym Owner";
  const accountEmail = user?.email || "";

  useEffect(() => {
    let active = true;
    const loadGymLogo = async () => {
      const token = user?.accessToken || user?.token;
      if (!token) {
        setGymData(null);
        setGymLogo("");
        return;
      }

      try {
        const response = await getMyGym(token);
        const nextGym = response?.data || response?.gym || response || {};
        const name = typeof nextGym.name === "string" ? nextGym.name.trim() : "";
        const logo = nextGym.logo || "";
        if (active) {
          setGymData(name ? { ...nextGym, name } : null);
          setGymLogo(resolveGymLogoUrl(logo));
        }
      } catch {
        if (active) {
          setGymData(null);
          setGymLogo("");
        }
      }
    };

    void loadGymLogo();
    return () => {
      active = false;
    };
  }, [user?.accessToken, user?.token]);

  useEffect(() => {
    localStorage.setItem("gymMaster.sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const primaryNavLinks = [];
  primaryLinks.forEach((link) => {
    if (HIDDEN_PRIMARY_KEYS.has(link.moduleKey)) return;
    if (isMember && link.moduleKey === "payments") return;
    if (isPlatformAdmin && PLATFORM_ADMIN_HIDDEN_PRIMARY_KEYS.has(link.moduleKey)) return;
    if (link.moduleKey === "gyms" && isGymOwner) return;
    if (link.moduleKey === "saas-plans" && !isPlatformAdmin) return;
    if (link.moduleKey === "plans" && isPlatformAdmin) return;
    primaryNavLinks.push(link);
  });

  const menuItemClass = "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition";
  const renderLink = (link) => {
    const Icon = link.icon;
    const showLabel = !collapsed || mobileOpen;
    const isBlocked = isGymOwner && isSubscriptionRestricted(user?.subscriptionStatus) && link.to !== "/modules/subscriptions";
    const getLinkClass = ({ isActive }) =>
      `${menuItemClass} ${isBlocked ? "cursor-not-allowed text-[#475569] opacity-80" : isActive ? "bg-[#0D8252] text-white shadow-sm" : "text-[#475569] hover:bg-[#F8F9FB] hover:text-[#0F172A]"}`;
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        className={getLinkClass}
        title={link.label}
        aria-disabled={isBlocked}
        onClick={(event) => {
          if (isBlocked) {
            event.preventDefault();
            onBlockedNavigation();
            onMobileClose();
            return;
          }
          setAccountMenuOpen(false);
          onMobileClose();
        }}
      >
        <Icon size={16} className={showLabel ? "shrink-0" : ""} />
        {showLabel && <span className="truncate">{link.label}</span>}
      </NavLink>
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="rounded-lg fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 max-w-[86vw] flex-col overflow-hidden border-r border-[#EAECF0] bg-white text-[#64748B] shadow-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:max-w-none lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-72"} lg:translate-x-0`}
      >
      <div className="border-b border-[#EAECF0] p-5">
        <div className="flex items-center justify-between gap-3">
        {showFullNav && (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#0D8252] to-[#065F46] text-white shadow-sm">
              <ShoppingBag size={18} />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-[16px] font-bold leading-tight tracking-tight text-[#0F172A]">Gym Master</span>
              <span className="block truncate text-[11px] font-semibold tracking-wide text-[#0D8252]">
                {isPlatformAdmin ? "Platform Portal" : "Owner Portal"}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={() => {
            if (window.innerWidth < 1024) {
              onMobileClose();
              return;
            }
            setCollapsed(!collapsed);
          }}
          className="rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          aria-label="Toggle sidebar"
        >
          <Menu size={19} />
        </button>
        </div>
        {showFullNav && (
          <div className="relative mt-4">
            <input
              className="w-full rounded-xl border border-[#EAECF0] bg-[#F8F9FB] py-2 pl-3 pr-9 text-xs text-[#0F172A] outline-none transition focus:border-[#0D8252] focus:ring-1 focus:ring-[#0D8252]"
              placeholder="Search..."
              type="text"
            />
            <span className="absolute right-2.5 top-2 rounded border border-[#EAECF0] bg-white px-1 text-[10px] font-semibold text-[#64748B] shadow-sm">K</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3.5 py-4">
        <div className="space-y-2">
          {showFullNav && <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">Main Menu</p>}
          {primaryNavLinks.filter((link) => canAccess(user, link.moduleKey)).map(renderLink)}
        </div>

        {!isPlatformAdmin && moduleSections
          .map((section) => ({
            ...section,
            links: section.links.filter((link) => !(isMember && link.moduleKey === "subscriptions") && !HIDDEN_MODULE_KEYS.has(link.moduleKey) && canAccess(user, link.moduleKey)),
          }))
          .filter((section) => section.links.length)
          .map((section) => (
            <div key={section.title} className="space-y-2">
              {showFullNav && (
                <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  {section.title}
                </p>
              )}
              {section.links.map(renderLink)}
            </div>
          ))}
      </nav>

      {showFullNav && (
        <div className="relative border-t border-[#EAECF0] bg-white p-4">
          {/* <div className="mb-3 rounded-2xl border border-[#EAECF0] bg-[#F8F9FB] p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
              <span>Gym Pro Plan</span>
              <span className="text-[#0D8252]">Pro</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-tight text-[#64748B]">Advanced multi-gate turnstile and payroll enabled</p>
            <div className="mt-2.5 flex items-center justify-between">
              <button type="button" className="rounded-lg bg-[#0D8252] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#065F46]">Manage</button>
              <span className="text-[11px] font-medium text-[#64748B]">Learn more</span>
            </div>
          </div> */}
          {accountMenuOpen && accountMenuPath === location.pathname && (
            <div className="absolute bottom-[calc(100%-0.5rem)] left-2 right-2 z-50 overflow-hidden rounded-2xl border border-[#E6EBEF] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
              <div className="border-b border-[#E8EEF0] bg-[#F7FCFA] px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0D8252] text-sm font-bold text-white ring-2 ring-emerald-100">
                    {gymLogo ? <img src={gymLogo} alt="Gym logo" className="h-full w-full object-cover" /> : <ShoppingBag size={17} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#0F172A]">{accountName}</p>
                    <p className="truncate text-[11px] text-[#64748B]">{accountEmail}</p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button type="button" onClick={() => { setAccountMenuOpen(false); navigate("/profile"); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-xs font-medium text-[#334155] transition hover:bg-[#F8FAFC]">
                  <User size={15} className="text-[#94A3B8]" />
                  <span>My Profile</span>
                </button>
                <button type="button" onClick={() => { setAccountMenuOpen(false); navigate("/payments"); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-xs font-medium text-[#334155] transition hover:bg-[#F8FAFC]">
                  <CreditCard size={15} className="text-[#94A3B8]" />
                  <span>Billing</span>
                  <span className={`ml-auto rounded-full px-2 py-1 text-[10px] font-bold ${hasActiveSubscription ? "bg-emerald-50 text-[#0D8252]" : "bg-amber-50 text-amber-600"}`}>{hasActiveSubscription ? "Active" : "Review"}</span>
                </button>
                <button type="button" onClick={() => { setAccountMenuOpen(false); navigate("/permissions"); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-xs font-medium text-[#334155] transition hover:bg-[#F8FAFC]">
                  <ShieldCheck size={15} className="text-[#94A3B8]" />
                  <span>Permissions</span>
                </button>
              </div>

              <div className="border-t border-[#E8EEF0] p-2">
                <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold text-rose-600 transition hover:bg-rose-50">
                  <LogOut size={15} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              const sameRoute = accountMenuPath === location.pathname;
              setAccountMenuPath(location.pathname);
              setAccountMenuOpen((open) => (sameRoute ? !open : true));
            }}
            className="flex w-full items-center justify-between rounded-lg text-left transition hover:bg-[#F8FAFC]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0D8252] text-xs font-bold text-white shadow-sm ring-2 ring-emerald-100">
                {gymLogo ? <img src={gymLogo} alt="Gym logo" className="h-full w-full object-cover" /> : <ShoppingBag size={15} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#0F172A]">{accountName}</p>
                <p className="truncate text-[11px] text-[#94A3B8]">{accountEmail}</p>
              </div>
            </div>
            <Settings size={15} className={`shrink-0 text-[#94A3B8] transition-transform ${accountMenuOpen ? "rotate-90" : ""}`} />
          </button>
        </div>
      )}
      </aside>
    </>
  );
}
