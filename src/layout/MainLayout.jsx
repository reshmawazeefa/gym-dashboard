import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { Bell, CheckCheck, ChevronDown, Loader2, Menu, User, LogOut } from "lucide-react";
import { moduleDefinitions } from "../data/moduleDefinitions";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  registerNotificationDeviceToken,
  unregisterNotificationDeviceToken,
} from "../services/api";

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const navigate = useNavigate();

  const portalTitle = user?.role ? `${user.role} Portal` : "Gym Owner Portal";
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "GM";

  const location = useLocation();

  const sessionToken = user?.accessToken || user?.token || null;

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      if (!sessionToken) {
        if (active) {
          setNotifications([]);
          setUnreadCount(0);
        }
        return;
      }

      try {
        if (active) setLoadingNotifications(true);

        const deviceToken = localStorage.getItem("notificationDeviceToken") || createDeviceToken();
        if (!localStorage.getItem("notificationDeviceToken")) {
          localStorage.setItem("notificationDeviceToken", deviceToken);
        }

        await registerNotificationDeviceToken({ token: deviceToken, platform: "web" }, sessionToken);

        const [historyResponse, unreadResponse] = await Promise.all([
          getNotifications({ page: 1, limit: 5 }, sessionToken),
          getUnreadNotificationCount(sessionToken),
        ]);

        if (!active) return;

        const historyItems = Array.isArray(historyResponse?.data)
          ? historyResponse.data
          : Array.isArray(historyResponse?.data?.data)
            ? historyResponse.data.data
            : [];
        const unreadValue = Number(
          unreadResponse?.data?.unreadCount ?? unreadResponse?.unreadCount ?? unreadResponse?.data?.data?.unreadCount ?? 0
        );

        setNotifications(historyItems);
        setUnreadCount(Number.isFinite(unreadValue) ? unreadValue : 0);
      } catch (error) {
        console.warn("Unable to load notification history", error);
      } finally {
        if (active) setLoadingNotifications(false);
      }
    };

    loadNotifications();

    return () => {
      active = false;
    };
  }, [sessionToken]);

  function createDeviceToken() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `web-${crypto.randomUUID()}`;
    }

    return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function refreshNotifications() {
    if (!sessionToken) return;

    try {
      setLoadingNotifications(true);
      const [historyResponse, unreadResponse] = await Promise.all([
        getNotifications({ page: 1, limit: 5 }, sessionToken),
        getUnreadNotificationCount(sessionToken),
      ]);

      const historyItems = Array.isArray(historyResponse?.data)
        ? historyResponse.data
        : Array.isArray(historyResponse?.data?.data)
          ? historyResponse.data.data
          : [];
      const unreadValue = Number(
        unreadResponse?.data?.unreadCount ?? unreadResponse?.unreadCount ?? unreadResponse?.data?.data?.unreadCount ?? 0
      );

      setNotifications(historyItems);
      setUnreadCount(Number.isFinite(unreadValue) ? unreadValue : 0);
    } catch (error) {
      console.warn("Unable to refresh notification history", error);
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function handleMarkAsRead(notificationId) {
    if (!sessionToken) return;

    try {
      await markNotificationAsRead(notificationId, sessionToken);
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      console.warn("Unable to mark notification as read", error);
    }
  }

  async function handleMarkAllRead() {
    if (!sessionToken) return;

    try {
      await markAllNotificationsAsRead(sessionToken);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.warn("Unable to mark notifications as read", error);
    }
  }

  async function handleLogout() {
    const deviceToken = localStorage.getItem("notificationDeviceToken");

    if (sessionToken && deviceToken) {
      try {
        await unregisterNotificationDeviceToken(deviceToken, sessionToken);
      } catch (error) {
        console.warn("Unable to unregister device token", error);
      }
    }

    setAccountMenuOpen(false);
    setNotificationMenuOpen(false);
    logout();
  }

  function capitalizeParts(key) {
    return key
      .split(/[-_]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }

  function getModuleName(pathname) {
    const normalized = pathname.replace(/\/$/, "");
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    let key = segments[0];
    if (key === "modules" && segments[1]) key = segments[1];
    if (key === "platform" && segments[1]) key = segments[1];

    const map = {
      members: "Members",
      payments: "Payments",
      plans: "Plans",
      trainers: "Staff",
      permissions: "Permissions",
      profile: "Profile",
      dashboard: "Dashboard",
      gyms: "Gyms",
      "saas-plans": "SaaS Plans",
    };

    if (map[key]) return map[key];
    if (moduleDefinitions[key] && moduleDefinitions[key].title) return moduleDefinitions[key].title;
    return capitalizeParts(key);
  }

  function TopBarHeader() {
    const normalizedPath = location.pathname.replace(/\/$/, "");
    const isDashboard = normalizedPath === "" || normalizedPath === "/" || normalizedPath === "/dashboard";
    const moduleName = getModuleName(location.pathname);

    if (isDashboard) {
      return (
        <>
          <p className="text-sm font-semibold text-gray-500">Welcome back</p>
          <h1 className="truncate text-xl font-semibold text-gray-950">{portalTitle}</h1>
        </>
      );
    }

    if (!moduleName) return null;

    return <h1 className="truncate text-xl font-semibold text-gray-950">{moduleName}</h1>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">
        <div className="mb-5 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-gray-200 sticky top-0 z-50">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-full border border-gray-200 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                {/* Show welcome on dashboard; show module name on other pages */}
                <TopBarHeader />
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end md:flex-1">
              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationMenuOpen((current) => !current);
                      if (!notificationMenuOpen) refreshNotifications();
                    }}
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50"
                    aria-label="Notifications"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notificationMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg">
                      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Notifications</p>
                          <p className="text-xs text-gray-500">{unreadCount} unread</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Mark all read
                        </button>
                      </div>

                      <div className="max-h-80 overflow-y-auto">
                        {loadingNotifications ? (
                          <div className="flex items-center justify-center px-4 py-6 text-sm text-gray-500">
                            <Loader2 size={16} className="mr-2 animate-spin" />
                            Loading notifications...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-gray-500">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => handleMarkAsRead(notification.id)}
                              className={`flex w-full flex-col gap-1 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${notification.isRead ? "bg-white" : "bg-blue-50/60"}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">{notification.title || "Notification"}</p>
                                  <p className="text-sm text-gray-600">{notification.body || "You have a new update."}</p>
                                </div>
                                {!notification.isRead && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />}
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{notification.sentAt ? new Date(notification.sentAt).toLocaleString() : "Just now"}</span>
                                {notification.isRead ? <CheckCheck size={14} className="text-green-600" /> : <span className="font-medium text-blue-600">Tap to read</span>}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="border-t border-gray-100 px-4 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationMenuOpen(false);
                            navigate("/modules/notifications");
                          }}
                          className="w-full rounded-md px-3 py-2 text-center text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                        >
                          View All Notifications
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                      {initials}
                    </span>
                    <span className="hidden sm:inline">{user?.name || "Owner"}</span>
                    <ChevronDown size={16} />
                  </button>

                  {accountMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          navigate("/profile");
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-50"
                      >
                        <User size={16} />
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-50"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
