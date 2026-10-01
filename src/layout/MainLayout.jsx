import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { Bell, CheckCheck, ChevronDown, Loader2, Menu, TriangleAlert, User, LogOut, X } from "lucide-react";
import { moduleDefinitions } from "../data/moduleDefinitions";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  registerNotificationDeviceToken,
  unregisterNotificationDeviceToken,
} from "../services/api";
import { getWebPushToken } from "../services/webNotifications";
import { isSubscriptionRestricted } from "../utils/subscriptionStatus";

export default function MainLayout({ children }) {
  const { user, logout, logoutAll } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [subscriptionAlertOpen, setSubscriptionAlertOpen] = useState(false);
  const navigate = useNavigate();

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
  const hasSubscriptionAccessAlert = Boolean(location.state?.subscriptionAccessDenied);

  const showSubscriptionAlert = () => {
    if (location.pathname.replace(/\/$/, "") !== "/modules/subscriptions") {
      navigate("/modules/subscriptions", { replace: true, state: { subscriptionAccessDenied: true } });
      return;
    }
    setSubscriptionAlertOpen(true);
  };

  const closeSubscriptionAlert = () => {
    setSubscriptionAlertOpen(false);
    if (hasSubscriptionAccessAlert) navigate(location.pathname, { replace: true, state: null });
  };

  const isSubscriptionAlertVisible = subscriptionAlertOpen || hasSubscriptionAccessAlert;

  useEffect(() => {
    if (!isSubscriptionAlertVisible) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSubscriptionAlertVisible]);

  const navigateWithSubscriptionGuard = (path) => {
    const isOwner = user?.userRole === "gym_owner" || user?.loginType === "gym_owner" || user?.role === "Gym Owner";
    if (isOwner && isSubscriptionRestricted(user?.subscriptionStatus) && path !== "/modules/subscriptions") {
      showSubscriptionAlert();
      return;
    }
    navigate(path);
  };

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

        const deviceToken = await getWebPushToken();
        if (deviceToken) {
          localStorage.setItem("notificationDeviceToken", deviceToken);
          await registerNotificationDeviceToken({ token: deviceToken, platform: "web" }, sessionToken);
        }

        const [historyResponse, unreadResponse] = await Promise.all([
          getNotifications({ page: 1, limit: 5 }, sessionToken),
          getUnreadNotificationCount(sessionToken),
        ]);

        if (!active) return;

        const historyItems = Array.isArray(historyResponse)
          ? historyResponse
          : Array.isArray(historyResponse?.data)
            ? historyResponse.data
            : Array.isArray(historyResponse?.data?.data)
              ? historyResponse.data.data
              : Array.isArray(historyResponse?.notifications)
                ? historyResponse.notifications
                : [];
        const unreadValue = Number(
          unreadResponse?.data?.unreadCount ?? unreadResponse?.unreadCount ?? unreadResponse?.data?.data?.unreadCount ?? unreadResponse?.count ?? 0
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

  async function refreshNotifications() {
    if (!sessionToken) return;

    try {
      setLoadingNotifications(true);
      const [historyResponse, unreadResponse] = await Promise.all([
        getNotifications({ page: 1, limit: 5 }, sessionToken),
        getUnreadNotificationCount(sessionToken),
      ]);

      const historyItems = Array.isArray(historyResponse)
        ? historyResponse
        : Array.isArray(historyResponse?.data)
          ? historyResponse.data
          : Array.isArray(historyResponse?.data?.data)
            ? historyResponse.data.data
            : Array.isArray(historyResponse?.notifications)
              ? historyResponse.notifications
              : [];
      const unreadValue = Number(
        unreadResponse?.data?.unreadCount ?? unreadResponse?.unreadCount ?? unreadResponse?.data?.data?.unreadCount ?? unreadResponse?.count ?? 0
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
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleLogoutAll() {
    setAccountMenuOpen(false);
    await logoutAll();
    navigate("/login", { replace: true });
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
      payments: "Payment History",
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

  const normalizedPath = location.pathname.replace(/\/$/, "");
  const isDashboard = normalizedPath === "" || normalizedPath === "/" || normalizedPath === "/dashboard";

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#F8F9FB]">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        onBlockedNavigation={showSubscriptionAlert}
      />

      <main className={`min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${isDashboard ? "p-0" : ""}`}>
        <div className="sticky top-0 z-40 mb-4 border-b border-gray-200 bg-white px-6 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={18} />
              </button>

              <div className="min-w-0 overflow-hidden text-sm font-medium text-gray-700">
                <span className="truncate text-gray-500">Gym Master</span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="truncate text-gray-900">
                  {getModuleName(location.pathname) || "Dashboard"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationMenuOpen((current) => !current);
                    if (!notificationMenuOpen) refreshNotifications();
                  }}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
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
                        className="rounded-lg text-sm font-medium text-blue-600 hover:text-blue-700"
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
                            className={`rounded-lg flex w-full flex-col gap-1 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${notification.isRead ? "bg-white" : "bg-blue-50/60"}`}
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
                          navigateWithSubscriptionGuard("/modules/notifications");
                        }}
                        className="w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                      >
                        View All Notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {children}
      </main>
      {isSubscriptionAlertVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="subscription-access-title" className="w-full max-w-lg overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700"><TriangleAlert size={18} /></div>
                <div>
                  <h2 id="subscription-access-title" className="text-base font-bold text-[#0F172A]">Subscription Required</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">Complete your subscription payment to restore access.</p>
                </div>
              </div>
              <button type="button" onClick={closeSubscriptionAlert} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label="Close subscription alert"><X size={17} /></button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-[#475569]">Your subscription payment has not been completed. Please complete your subscription payment to access the dashboard and use all gym management features.</p>
            </div>
            <div className="flex items-center justify-end border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={closeSubscriptionAlert} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Close</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
