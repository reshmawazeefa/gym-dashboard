import { useEffect, useState } from "react";
import TablePagination from "./TablePagination";
import StatusBadge from "./StatusBadge";
import {
  Bell,
  BellOff,
  CheckCheck,
  Download,
  Loader2,
  Mail,
  MailCheck,
  Plus,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getApiError,
  getNotifications,
  getSentNotificationById,
  getSentNotifications,
  getTenantUsers,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  sendNotification,
  uploadNotificationImage,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess, normalizeRole } from "../utils/rbac";

const NOTIFICATION_TYPES = [
  "MEMBERSHIP_EXPIRY",
  "MEMBERSHIP_RENEWAL",
  "CLASS_REMINDER",
  "CLASS_BOOKING",
  "CLASS_CANCELLATION",
  "BILLING_RECEIPT",
  "BILLING_FAILED",
  "BILLING_OVERDUE",
  "ATTENDANCE_ALERT",
  "WORKOUT_REMINDER",
  "MEAL_REMINDER",
  "EQUIPMENT_WARRANTY_EXPIRY",
  "GENERAL",
];

const TYPE_COLORS = {
  MEMBERSHIP_EXPIRY: "bg-red-100 text-red-700",
  MEMBERSHIP_RENEWAL: "bg-emerald-100 text-emerald-700",
  CLASS_REMINDER: "bg-blue-100 text-blue-700",
  CLASS_BOOKING: "bg-purple-100 text-purple-700",
  CLASS_CANCELLATION: "bg-orange-100 text-orange-700",
  BILLING_RECEIPT: "bg-green-100 text-green-700",
  BILLING_FAILED: "bg-rose-100 text-rose-700",
  BILLING_OVERDUE: "bg-amber-100 text-amber-700",
  ATTENDANCE_ALERT: "bg-cyan-100 text-cyan-700",
  WORKOUT_REMINDER: "bg-indigo-100 text-indigo-700",
  MEAL_REMINDER: "bg-yellow-100 text-yellow-700",
  EQUIPMENT_WARRANTY_EXPIRY: "bg-orange-100 text-orange-700",
  GENERAL: "bg-gray-100 text-gray-700",
};

function normalizeNotificationList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.notifications)) return response.notifications;
  return [];
}

function normalizeMeta(response) {
  const meta = response?.meta ?? response?.data?.meta ?? {};
  return {
    total: Number(meta.total ?? response?.total ?? response?.data?.total ?? 0),
    totalPages: Number(meta.totalPages ?? meta.total_pages ?? response?.totalPages ?? response?.data?.totalPages ?? 1),
  };
}

function normalizeUnreadCount(response) {
  const value = response?.data?.unreadCount ?? response?.unreadCount ?? response?.data?.data?.unreadCount ?? response?.count ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const isGymOwner = normalizeRole(user?.role, user?.loginType) === "gym_owner";
  const [activeTab, setActiveTab] = useState(() => (isGymOwner ? "sent" : "history"));
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sentNotifications, setSentNotifications] = useState([]);
  const [sentPage, setSentPage] = useState(1);
  const [sentTotalPages, setSentTotalPages] = useState(1);
  const [sentTotalCount, setSentTotalCount] = useState(0);
  const [sentLoading, setSentLoading] = useState(false);
  const [selectedSentNotification, setSelectedSentNotification] = useState(null);
  const [sentDetailLoading, setSentDetailLoading] = useState(false);
  const [sentTypeFilter, setSentTypeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [members, setMembers] = useState([]);
  const [sendForm, setSendForm] = useState({
    userIds: [],
    title: "",
    body: "",
    type: "GENERAL",
    imageUrl: "",
  });
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isTestingModalOpen, setTestingModalOpen] = useState(false);
  const [testForm, setTestForm] = useState({ title: "", body: "", iconUrl: "" });
  const [testing, setTesting] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientRole, setRecipientRole] = useState("All");

  const canSend = canAccess(user, "notifications", "send");
  const limit = 10;

  useEffect(() => {
    if (!isCreateModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (!isTestingModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isTestingModalOpen]);

  async function fetchNotifications() {
    if (!user?.token) return;
    setLoading(true);
    try {
      const params = { page, limit };
      if (typeFilter) params.type = typeFilter;
      const [listRes, unreadRes] = await Promise.all([
        getNotifications(params, user.token),
        getUnreadNotificationCount(user.token),
      ]);
      const items = normalizeNotificationList(listRes);
      const meta = normalizeMeta(listRes);
      setNotifications(items);
      setTotalCount(meta.total || items.length);
      setTotalPages(Math.max(1, meta.totalPages || 1));
      setUnreadCount(normalizeUnreadCount(unreadRes));
    } catch (error) {
      toast.error(getApiError(error, "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  }

  async function fetchMembers() {
    if (!user?.token) return;
    try {
      const response = await getTenantUsers("member", user.token);
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : Array.isArray(response?.users)
              ? response.users
              : Array.isArray(response?.members)
                ? response.members
                : [];
      setMembers(list);
    } catch (error) {
      console.warn("Failed to load members", error);
    }
  }

  async function fetchSentNotifications() {
    if (!user?.token || !canSend) return;
    setSentLoading(true);
    try {
      const params = { page: sentPage, limit };
      if (sentTypeFilter) params.type = sentTypeFilter;
      const response = await getSentNotifications(params, user.token);
      const items = normalizeNotificationList(response);
      const meta = normalizeMeta(response);
      setSentNotifications(items);
      setSentTotalCount(meta.total || items.length);
      setSentTotalPages(Math.max(1, meta.totalPages || 1));
    } catch (error) {
      toast.error(getApiError(error, "Failed to load sent notifications"));
    } finally {
      setSentLoading(false);
    }
  }

  async function handleSentNotificationDetails(notificationId) {
    if (!user?.token) return;
    setSentDetailLoading(true);
    try {
      const response = await getSentNotificationById(notificationId, user.token);
      setSelectedSentNotification(response?.data ?? response);
    } catch (error) {
      toast.error(getApiError(error, "Failed to load notification recipients"));
    } finally {
      setSentDetailLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
  }, [page, typeFilter, user?.token]);

  useEffect(() => {
    if (isCreateModalOpen && canSend && members.length === 0) {
      fetchMembers();
    }
  }, [isCreateModalOpen, canSend, user?.token]);

  useEffect(() => {
    if (activeTab === "sent" && canSend) fetchSentNotifications();
  }, [activeTab, sentPage, sentTypeFilter, canSend, user?.token]);

  useEffect(() => {
    if (isGymOwner && activeTab === "history") setActiveTab("sent");
  }, [activeTab, isGymOwner]);

  async function handleMarkRead(id) {
    if (!user?.token) return;
    try {
      await markNotificationAsRead(id, user.token);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      toast.error(getApiError(error, "Failed to mark as read"));
    }
  }

  async function handleMarkAllRead() {
    if (!user?.token) return;
    try {
      await markAllNotificationsAsRead(user.token);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error(getApiError(error, "Failed to mark all as read"));
    }
  }

  function handleExportCSV() {
    try {
      const headers = ["Type", "Title", "Body", "Sent At", "Status"];
      const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows = notifications.map((notification) => [
        notification.type || "GENERAL",
        notification.title,
        notification.body,
        notification.sentAt ? new Date(notification.sentAt).toLocaleString() : "",
        notification.isRead ? "Read" : "Unread",
      ]);
      const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "notifications.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} notification${rows.length === 1 ? "" : "s"} exported`);
    } catch (error) {
      toast.error(getApiError(error, "Could not export notifications"));
    }
  }

  function toggleMember(memberId) {
    setSendForm((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(memberId)
        ? prev.userIds.filter((id) => id !== memberId)
        : [...prev.userIds, memberId],
    }));
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Only JPEG, PNG, WebP, and GIF images are allowed");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    setUploading(true);
    try {
      const response = await uploadNotificationImage(formData, user?.token);
      const url = response?.data?.url ?? response?.url ?? response?.data?.imageUrl ?? "";
      if (url) {
        setSendForm((prev) => ({ ...prev, imageUrl: url }));
        toast.success("Image uploaded");
      } else {
        toast.error("Upload succeeded but no URL returned");
      }
    } catch (error) {
      toast.error(getApiError(error, "Failed to upload image"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSend() {
    if (!user?.token) return;
    if (!sendForm.userIds.length) {
      toast.error("Select at least one recipient");
      return;
    }
    if (!sendForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!sendForm.body.trim()) {
      toast.error("Body is required");
      return;
    }
    setSending(true);
    try {
      await sendNotification(
        {
          userIds: sendForm.userIds,
          title: sendForm.title,
          body: sendForm.body,
          type: sendForm.type,
          imageUrl: sendForm.imageUrl || undefined,
          data: {},
        },
        user.token,
      );
      toast.success("Notification sent");
      setSendForm({ userIds: [], title: "", body: "", type: "GENERAL", imageUrl: "" });
      setRecipientSearch("");
      setRecipientRole("All");
      setCreateModalOpen(false);
      await fetchNotifications();
    } catch (error) {
      toast.error(getApiError(error, "Failed to send notification"));
    } finally {
      setSending(false);
    }
  }

  async function handleTestNotification() {
    if (!testForm.title.trim() || !testForm.body.trim()) return;
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser notifications are not supported");
      return;
    }

    setTesting(true);
    try {
      let permission = window.Notification.permission;
      if (permission === "default") {
        permission = await window.Notification.requestPermission();
      }
      if (permission !== "granted") {
        toast.error("Notification permission was not granted");
        return;
      }

      new window.Notification(testForm.title.trim(), {
        body: testForm.body.trim(),
        ...(testForm.iconUrl.trim() ? { icon: testForm.iconUrl.trim() } : {}),
      });
      toast.success("Test notification displayed on this device");
      setTestingModalOpen(false);
    } catch {
      toast.error("Unable to display a browser notification");
    } finally {
      setTesting(false);
    }
  }

  const visibleMembers = members.filter((member) => {
    const role = member.role || member.user?.role || "Member";
    const name = member.name || member.user?.name || "";
    const email = member.email || member.user?.email || "";
    const query = recipientSearch.trim().toLowerCase();
    const matchesRole = recipientRole === "All" || role.toLowerCase() === recipientRole.toLowerCase();
    const matchesSearch = !query || `${name} ${email}`.toLowerCase().includes(query);
    return matchesRole && matchesSearch;
  });

  function resetRecipients() {
    setSendForm((prev) => ({ ...prev, userIds: [] }));
  }

  function selectAllVisibleRecipients() {
    const visibleIds = visibleMembers.map((member) => member.id || member._id || member.userId || member.email);
    setSendForm((prev) => ({
      ...prev,
      userIds: [...new Set([...prev.userIds, ...visibleIds])],
    }));
  }

  const inputClass = "w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white";

  return (
    <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Notifications</h1>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Send push notifications and view notification history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleExportCSV} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#F8FAFC]"><Download size={13} />Export CSV</button>
            {canSend && <button type="button" onClick={() => setTestingModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#F8FAFC]"><Bell size={14} />Test Notification</button>}
            {canSend && <button type="button" onClick={() => setCreateModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"><Plus size={14} />Create Message</button>}
          </div>
        </section>

      {!isGymOwner && activeTab === "history" && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex min-h-[108px] items-center justify-between rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Total Notifications</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">{totalCount}</p><p className="mt-1 text-[10px] text-[#94A3B8]">All notification activity</p></div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#0D8252]"><Bell size={17} /></span>
            </div>
            <div className="flex min-h-[108px] items-center justify-between rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Unread</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">{unreadCount}</p><p className="mt-1 text-[10px] text-[#94A3B8]">Awaiting review</p></div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Mail size={17} /></span>
            </div>
            <div className="flex min-h-[108px] items-center justify-between rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Read</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">{Math.max(0, totalCount - unreadCount)}</p><p className="mt-1 text-[10px] text-[#94A3B8]">Reviewed notifications</p></div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#0D8252]"><MailCheck size={17} /></span>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Sent Notifications</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">Review notifications delivered to your account.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#64748B]">Type</span>
              <select
                value={typeFilter}
                onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"
              >
                <option value="">All Types</option>
                {NOTIFICATION_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold text-[#0D8252] transition hover:text-[#086B43] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck size={14} />
                Mark All Read
              </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center px-4 py-12 text-xs text-[#64748B]">
                <Loader2 size={16} className="mr-2 animate-spin" />
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-[#64748B]">
                <BellOff size={32} className="mx-auto mb-2 text-[#CBD5E1]" />
                No notifications found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                    <tr>
                      <th className="w-[18%] px-4 py-3">Type</th>
                      <th className="w-[18%] px-4 py-3">Title</th>
                      <th className="w-[28%] px-4 py-3">Body</th>
                      <th className="w-[16%] px-4 py-3">Sent At</th>
                      <th className="w-[10%] px-4 py-3">Status</th>
                      <th className="w-[10%] px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n) => (
                      <tr key={n.id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold ${TYPE_COLORS[n.type] || "bg-gray-100 text-gray-700"}`}>
                            {n.type || "GENERAL"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-[#0F172A]">{n.title || "-"}</td>
                        <td className="max-w-xs truncate px-4 py-3">{n.body || "-"}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {n.sentAt ? new Date(n.sentAt).toLocaleString() : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={n.isRead ? "READ" : "UNREAD"} label={n.isRead ? "Read" : "Unread"} />
                        </td>
                        <td className="px-4 py-3">
                          {!n.isRead && (
                            <button
                              type="button"
                              onClick={() => handleMarkRead(n.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#CFEFDB] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#0D8252] transition hover:bg-emerald-50"
                            >
                              <CheckCheck size={13} />
                              Mark Read
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
                <span>Page {page} of {totalPages} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {notifications.length} records</span>
                <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
          </section>
        </>
      )}

      {isCreateModalOpen && canSend && (
        <div className="fixed h-full inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/30 p-2 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setCreateModalOpen(false)}>
        <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-2rem)]" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Send size={18} /></div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Send Notification</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">Compose and send a push notification to selected members.</p>
              </div>
            </div>
            <button type="button" onClick={() => setCreateModalOpen(false)} aria-label="Close notification modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4">
            <div className="grid gap-1 text-xs font-semibold text-[#334155]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span>Recipients</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-[#0D8252]">{sendForm.userIds.length} selected</span>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={resetRecipients} className="text-[10px] font-normal text-[#0D8252] transition hover:text-[#086B43]">Reset</button>
                  <button type="button" onClick={selectAllVisibleRecipients} className="text-[10px] font-normal text-[#0D8252] transition hover:text-[#086B43]">Select All</button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
                <div className="flex flex-col gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] p-2 sm:flex-row sm:items-center">
                  <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[#E2E8F0] bg-white px-2.5 focus-within:border-[#0D8252]">
                    <Search size={13} className="shrink-0 text-[#94A3B8]" />
                    <input className="min-w-0 flex-1 bg-transparent text-[10px] font-normal text-[#334155] outline-none placeholder:text-[#94A3B8]" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Search members by name or email..." />
                  </div>
                  <label className="flex h-8 items-center gap-1.5 text-[11px] font-normal text-[#64748B] sm:w-28"><span>Role:</span><select className="min-w-0 flex-1 rounded-md border border-[#E2E8F0] bg-white px-1.5 py-1 text-[11px] text-[#475569] outline-none" value={recipientRole} onChange={(event) => setRecipientRole(event.target.value)}><option value="All">All</option><option value="Member">Member</option><option value="Admin">Admin</option></select></label>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {visibleMembers.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs font-normal text-[#94A3B8]">No members available</p>
                  ) : (
                    visibleMembers.map((member) => {
                      const mid = member.id || member._id || member.userId || member.email;
                      const selected = sendForm.userIds.includes(mid);
                      const memberName = member.name || member.user?.name || member.email || mid;
                      const memberEmail = member.email || member.user?.email || "";
                      return (
                        <label key={mid} className={`flex cursor-pointer items-center gap-2 border-b border-[#EEF2F4] px-2.5 py-2 last:border-b-0 transition ${selected ? "bg-emerald-50/70" : "hover:bg-[#FBFCFD]"}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleMember(mid)} className="h-3.5 w-3.5 shrink-0 rounded border-[#CBD5E1] accent-[#0D8252] focus:ring-2 focus:ring-[#0D8252]/20" />
                          <span className="min-w-0 flex-1 font-normal"><span className="block truncate text-[12px] font-semibold text-[#334155]">{memberName}</span>{memberEmail && <span className="block truncate text-[10px] font-normal text-[#94A3B8]">{memberEmail}</span>}</span>
                          <span className="shrink-0 text-[9px] font-normal text-[#94A3B8]">{member.role || member.user?.role || "Member"}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-gray-700">
                Title
                <input
                  className={inputClass}
                  type="text"
                  value={sendForm.title}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-gray-700">
                Type
                <select
                  className={inputClass}
                  value={sendForm.type}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, type: e.target.value }))}
                >
                  {NOTIFICATION_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1 text-xs font-semibold text-[#334155]">
              Body
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={sendForm.body}
                onChange={(e) => setSendForm((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Notification body text"
              />
            </label>

            <label className="grid gap-1 text-xs font-semibold text-[#334155]">
              Image
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputClass}
                  type="text"
                  value={sendForm.imageUrl}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://... or upload"
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">
                  <Upload size={16} />
                  {uploading ? "Uploading..." : "Upload"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              {sendForm.imageUrl && (
                <div className="relative mt-2 inline-block">
                  <img
                    src={sendForm.imageUrl}
                    alt="Preview"
                    className="h-24 w-24 rounded-lg border border-[#E2E8F0] object-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setSendForm((prev) => ({ ...prev, imageUrl: "" }))}
                    className="absolute -right-2 -top-2 rounded-lg bg-red-500 p-0.5 text-white shadow"
                    aria-label="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </label>

          </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={() => setCreateModalOpen(false)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !sendForm.userIds.length || !sendForm.title.trim() || !sendForm.body.trim()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? "Sending..." : "Send Notification"}
              </button>
          </div>
        </section>
        </div>
      )}

      {isTestingModalOpen && canSend && (
        <div className="fixed h-full inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/30 p-2 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setTestingModalOpen(false)}>
          <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-2rem)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Bell size={18} /></div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Notification Testing</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">Test how a notification appears in this browser.</p>
                </div>
              </div>
              <button type="button" onClick={() => setTestingModalOpen(false)} aria-label="Close notification testing modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-4">
                <div className="grid gap-1 text-xs font-semibold text-[#334155]">
                  <div className="flex items-center justify-between gap-3">
                    <span>Recipient</span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-[#0D8252]">Local only</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#334155]">
                    <Bell size={14} className="shrink-0 text-[#0D8252]" />
                    <span>This browser</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                    Title
                    <input
                      className={inputClass}
                      type="text"
                      value={testForm.title}
                      onChange={(event) => setTestForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Notification title"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                    Icon URL
                    <input
                      className={inputClass}
                      type="url"
                      value={testForm.iconUrl}
                      onChange={(event) => setTestForm((prev) => ({ ...prev, iconUrl: event.target.value }))}
                      placeholder="https://... (optional)"
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Body
                  <textarea
                    className={`${inputClass} min-h-24 resize-y`}
                    value={testForm.body}
                    onChange={(event) => setTestForm((prev) => ({ ...prev, body: event.target.value }))}
                    placeholder="Notification body text"
                  />
                </label>
                <p className="text-xs text-[#64748B]">This displays a browser notification on this device only. It is not sent to members.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={() => setTestingModalOpen(false)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testing || !testForm.title.trim() || !testForm.body.trim()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                {testing ? "Testing..." : "Show Test Notification"}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === "sent" && canSend && (
        <section className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Sent Notifications</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">{sentTotalCount} send action{sentTotalCount === 1 ? "" : "s"} from this gym</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#64748B]">Type</span>
              <select value={sentTypeFilter} onChange={(event) => { setSentPage(1); setSentTypeFilter(event.target.value); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"><option value="">All Types</option>{NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
              <button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0} className="inline-flex items-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold text-[#0D8252] transition hover:text-[#086B43] disabled:cursor-not-allowed disabled:opacity-50"><CheckCheck size={14} />Mark All Read</button>
            </div>
          </div>
          {sentLoading ? (
            <div className="flex items-center justify-center px-4 py-12 text-sm text-gray-500"><Loader2 size={16} className="mr-2 animate-spin" />Loading sent notifications...</div>
          ) : sentNotifications.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500"><Send size={32} className="mx-auto mb-2 text-gray-300" />No sent notifications found</div>
          ) : (
            <>
            {/* Legacy list presentation retained only for source-history context.
            <div className="divide-y divide-gray-100">
              {sentNotifications.map((notification) => (
                <button key={notification.id} type="button" onClick={() => handleSentNotificationDetails(notification.id)} className="flex w-full flex-col gap-3 px-4 py-4 text-left text-xs transition hover:bg-[#FBFCFD] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${TYPE_COLORS[notification.type] || TYPE_COLORS.GENERAL}`}>{notification.type || "GENERAL"}</span><p className="truncate font-semibold text-gray-900">{notification.title || "Untitled notification"}</p></div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">{notification.body || "-"}</p>
                    <p className="mt-1 text-xs text-gray-500">{notification.sentAt ? new Date(notification.sentAt).toLocaleString() : "-"} · Sent by {notification.sender?.name || "Admin"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-gray-500"><Users size={14} />{notification.recipientCount ?? 0} recipients</div>
                </button>
              ))}
            </div>
            */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="w-[18%] px-4 py-3">Type</th>
                    <th className="w-[18%] px-4 py-3">Title</th>
                    <th className="w-[28%] px-4 py-3">Body</th>
                    <th className="w-[16%] px-4 py-3">Sent At</th>
                    <th className="w-[10%] px-4 py-3">Status</th>
                    <th className="w-[10%] px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sentNotifications.map((notification) => {
                    const deliveryStatus = notification.deliveryStatus || notification.status || "SENT";
                    return (
                      <tr key={notification.id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                        <td className="px-4 py-3"><span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold ${TYPE_COLORS[notification.type] || TYPE_COLORS.GENERAL}`}>{notification.type || "GENERAL"}</span></td>
                        <td className="px-4 py-3 font-bold text-[#0F172A]">{notification.title || "Untitled notification"}</td>
                        <td className="max-w-xs px-4 py-3"><p className="line-clamp-2">{notification.body || "-"}</p></td>
                        <td className="whitespace-nowrap px-4 py-3">{notification.sentAt ? new Date(notification.sentAt).toLocaleString() : "-"}</td>
                        <td className="px-4 py-3"><StatusBadge status={deliveryStatus} label={deliveryStatus} />
                        {/* <p className="mt-1 text-[10px] text-[#94A3B8]">{notification.recipientCount ?? 0} recipients</p> */}
                        </td>
                        <td className="px-4 py-3"><button type="button" onClick={() => handleSentNotificationDetails(notification.id)} className="inline-flex items-center gap-1 rounded-lg border border-[#CFEFDB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0D8252] transition hover:bg-emerald-50">View</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
          <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-[#64748B]">Showing {sentTotalCount ? (sentPage - 1) * limit + 1 : 0} to {Math.min(sentPage * limit, sentTotalCount)} of {sentTotalCount} sent notifications</span>
            <TablePagination page={sentPage} totalPages={sentTotalPages} onPageChange={setSentPage} disabled={sentLoading} className="gap-2" />
          </div>
        </section>
      )}

      {selectedSentNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setSelectedSentNotification(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div>
              <h2 className="text-lg font-bold text-gray-950">{selectedSentNotification.title || "Sent notification"}</h2>
              <p className="mt-1 text-xs text-gray-500">{selectedSentNotification.type || "GENERAL"} · {selectedSentNotification.sentAt ? new Date(selectedSentNotification.sentAt).toLocaleString() : "-"}</p>
              </div>
              <button type="button" onClick={() => setSelectedSentNotification(null)} className="rounded-lg text-gray-400 hover:text-gray-700" aria-label="Close">
                <X size={19} />
              </button>
              </div>
            <p className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-gray-700">{selectedSentNotification.body || "-"}</p>
            {selectedSentNotification.imageUrl && <img src={selectedSentNotification.imageUrl} alt="Notification" className="mt-4 max-h-48 rounded-md border border-gray-200 object-contain" />}
            <div className="mt-5 flex items-center justify-between"><h3 className="font-semibold text-gray-950">Recipients</h3><span className="text-xs text-gray-500">{selectedSentNotification.recipientCount ?? selectedSentNotification.recipients?.length ?? 0} total</span></div>
            {sentDetailLoading ? <div className="py-8 text-center text-sm text-gray-500"><Loader2 size={16} className="mx-auto mb-2 animate-spin" />Loading recipients...</div> : <div className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">{(selectedSentNotification.recipients || []).map((recipient) => <div key={recipient.id || recipient.userId} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-medium text-gray-900">{recipient.user?.name || recipient.user?.email || recipient.userId}</p>{recipient.user?.email && <p className="text-xs text-gray-500">{recipient.user.email}</p>}</div><StatusBadge status={recipient.deliveryStatus || "SENT"} label={recipient.deliveryStatus || "SENT"} /></div>)}</div>}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
