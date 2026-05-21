import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Bell,
  Building2,
  Calendar,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  Code2,
  CreditCard,
  Dumbbell,
  Languages,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Menu,
  Salad,
  Settings,
  ShoppingBag,
  UserCheck,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";

const primaryLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, moduleKey: "dashboard" },
  { to: "/members", label: "Members", icon: Users, moduleKey: "members" },
  { to: "/plans", label: "Plans & Renewal", icon: ClipboardList, moduleKey: "plans" },
  { to: "/payments", label: "Payments", icon: CreditCard, moduleKey: "payments" },
  { to: "/trainers", label: "Staff", icon: Dumbbell, moduleKey: "staff" },
  { to: "/permissions", label: "Permissions", icon: LockKeyhole, moduleKey: "permissions" },
  { to: "/platform/gyms", label: "Gyms", icon: Building2, moduleKey: "gyms" },
];

const moduleSections = [
  {
    title: "Operations",
    links: [
      { to: "/modules/attendance", label: "Attendance", icon: ClipboardCheck, moduleKey: "attendance" },
      { to: "/modules/subscriptions", label: "Subscriptions", icon: UserCheck, moduleKey: "subscriptions" },
      { to: "/modules/classes", label: "Classes", icon: Calendar, moduleKey: "classes" },
      { to: "/modules/workouts", label: "Workouts", icon: Activity, moduleKey: "workouts" },
      { to: "/modules/nutrition", label: "Nutrition", icon: Salad, moduleKey: "nutrition" },
      { to: "/modules/staff", label: "Staff Roles", icon: UserCog, moduleKey: "staff" },
      { to: "/modules/products", label: "Products", icon: ShoppingBag, moduleKey: "products" },
      { to: "/modules/facilities", label: "Facilities", icon: ClipboardList, moduleKey: "facilities" },
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
  {
    title: "System",
    links: [
      { to: "/modules/localization", label: "Languages", icon: Languages, moduleKey: "localization" },
      { to: "/modules/integrations", label: "API & Stripe", icon: Code2, moduleKey: "integrations" },
      { to: "/modules/workflow", label: "Workflow", icon: ClipboardList, moduleKey: "workflow" },
      { to: "/modules/security", label: "Security", icon: LockKeyhole, moduleKey: "security" },
    ],
  },
];

export default function Sidebar({ mobileOpen = false, onMobileClose = () => {} }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const showFullNav = !collapsed || mobileOpen;

  const menuItemClass = "flex items-center gap-3 rounded-md p-2 transition";
  const getLinkClass = ({ isActive }) =>
    `${menuItemClass} ${isActive ? "bg-gray-800 text-blue-300" : "text-gray-200 hover:bg-gray-800"}`;

  const renderLink = (link) => {
    const Icon = link.icon;
    const showLabel = !collapsed || mobileOpen;
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        className={getLinkClass}
        title={link.label}
        onClick={onMobileClose}
      >
        <Icon size={20} />
        {showLabel && <span className="truncate">{link.label}</span>}
      </NavLink>
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 max-w-[86vw] flex-col bg-gray-950 text-white shadow-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:max-w-none lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-72"} lg:translate-x-0`}
      >
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        {showFullNav && (
          <div>
            <span className="block text-lg font-bold">Gym Master</span>
            <span className="text-xs text-gray-400">Admin Portal</span>
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
          className="rounded-md p-2 text-gray-200 hover:bg-gray-800"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        <div className="space-y-2">
          {primaryLinks.filter((link) => canAccess(user, link.moduleKey)).map(renderLink)}
        </div>

        {moduleSections
          .map((section) => ({
            ...section,
            links: section.links.filter((link) => canAccess(user, link.moduleKey)),
          }))
          .filter((section) => section.links.length)
          .map((section) => (
            <div key={section.title} className="space-y-2">
              {showFullNav && (
                <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {section.title}
                </p>
              )}
              {section.links.map(renderLink)}
            </div>
          ))}
      </nav>

      {showFullNav && (
        <div className="border-t border-white/10 p-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Settings size={15} />
            Roles, API, Stripe, languages
          </div>
        </div>
      )}
      </aside>
    </>
  );
}
