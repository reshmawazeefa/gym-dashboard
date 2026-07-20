import { useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MailCheck,
  Send,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getApiError,
  getNotifications,
  getTenantUsers,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  sendNotification,
  uploadNotificationImage,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";

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
  GENERAL: "bg-gray-100 text-gray-700",
};

export default function AdminNotifications() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("history");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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

  const canSend = canAccess(user, "notifications", "send");
  const limit = 10;

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
      const items = Array.isArray(listRes?.data)
        ? listRes.data
        : Array.isArray(listRes?.data?.data)
          ? listRes.data.data
          : [];
      setNotifications(items);
      setTotalCount(listRes?.meta?.total ?? listRes?.data?.meta?.total ?? items.length);
      setTotalPages(listRes?.meta?.totalPages ?? listRes?.data?.meta?.totalPages ?? 1);
      const unreadVal = Number(unreadRes?.data?.unreadCount ?? unreadRes?.unreadCount ?? 0);
      setUnreadCount(Number.isFinite(unreadVal) ? unreadVal : 0);
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

  useEffect(() => {
    fetchNotifications();
  }, [page, typeFilter, user?.token]);

  useEffect(() => {
    if (activeTab === "send" && canSend && members.length === 0) {
      fetchMembers();
    }
  }, [activeTab, canSend, user?.token]);

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
        },
        user.token,
      );
      toast.success("Notification sent");
      setSendForm({ userIds: [], title: "", body: "", type: "GENERAL", imageUrl: "" });
    } catch (error) {
      toast.error(getApiError(error, "Failed to send notification"));
    } finally {
      setSending(false);
    }
  }

  const inputClass = "w-full rounded-md border border-gray-300 p-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white">
            <Bell size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-950">Notifications</h1>
            <p className="mt-1 text-sm text-gray-500">
              Send push notifications and view notification history.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "history", label: "History", icon: Mail },
            ...(canSend ? [{ key: "send", label: "Send", icon: Send }] : []),
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "history" && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Total Notifications</p>
              <p className="mt-2 text-2xl font-bold text-gray-950">{totalCount}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Unread</p>
              <p className="mt-2 text-2xl font-bold text-gray-950">{unreadCount}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Read</p>
              <p className="mt-2 text-2xl font-bold text-gray-950">{Math.max(0, totalCount - unreadCount)}</p>
            </div>
          </section>

          <section className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <select
                value={typeFilter}
                onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }}
                className="rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="inline-flex items-center gap-2 rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
              >
                <CheckCheck size={16} />
                Mark All Read
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center px-4 py-12 text-sm text-gray-500">
                <Loader2 size={16} className="mr-2 animate-spin" />
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">
                <BellOff size={32} className="mx-auto mb-2 text-gray-300" />
                No notifications found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3 font-semibold">Type</th>
                      <th className="p-3 font-semibold">Title</th>
                      <th className="p-3 font-semibold">Body</th>
                      <th className="p-3 font-semibold">Sent At</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n) => (
                      <tr key={n.id} className="border-t border-gray-200 transition hover:bg-gray-50">
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${TYPE_COLORS[n.type] || "bg-gray-100 text-gray-700"}`}>
                            {n.type || "GENERAL"}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-gray-800">{n.title || "-"}</td>
                        <td className="max-w-xs truncate p-3 text-gray-600">{n.body || "-"}</td>
                        <td className="whitespace-nowrap p-3 text-gray-500">
                          {n.sentAt ? new Date(n.sentAt).toLocaleString() : "-"}
                        </td>
                        <td className="p-3">
                          {n.isRead ? (
                            <span className="inline-flex items-center gap-1 text-sm text-green-600">
                              <MailCheck size={14} /> Read
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                              <Mail size={14} /> Unread
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {!n.isRead && (
                            <button
                              type="button"
                              onClick={() => handleMarkRead(n.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-md px-2 py-1 text-gray-400 disabled:opacity-30"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <span className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">{page}</span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-md px-2 py-1 text-gray-400 disabled:opacity-30"
                    aria-label="Next page"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "send" && canSend && (
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-950">Send Notification</h2>
              <p className="text-sm text-gray-500">Compose and send a push notification to selected members.</p>
            </div>
            <Send className="text-gray-400" size={21} />
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Recipients
              <div className="max-h-40 overflow-y-auto rounded-md border border-gray-300 p-2">
                {members.length === 0 ? (
                  <p className="text-sm text-gray-400">No members available</p>
                ) : (
                  members.map((member) => {
                    const mid = member.id || member._id || member.userId || member.email;
                    return (
                      <label key={mid} className="flex items-center gap-2 rounded px-2 py-1 text-sm transition hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={sendForm.userIds.includes(mid)}
                          onChange={() => toggleMember(mid)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{member.name || member.email || mid}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {sendForm.userIds.length > 0 && (
                <span className="text-xs text-gray-500">{sendForm.userIds.length} selected</span>
              )}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Title
                <input
                  className={inputClass}
                  type="text"
                  value={sendForm.title}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
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

            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Body
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={sendForm.body}
                onChange={(e) => setSendForm((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Notification body text"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Image
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputClass}
                  type="text"
                  value={sendForm.imageUrl}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://... or upload"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
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
                    className="h-24 w-24 rounded-md border border-gray-200 object-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setSendForm((prev) => ({ ...prev, imageUrl: "" }))}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white shadow"
                    aria-label="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !sendForm.userIds.length || !sendForm.title.trim() || !sendForm.body.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? "Sending..." : "Send Notification"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
