import { useState, useEffect } from "react";
import { MessageSquare, Plus, CheckCircle, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  createFeedback, getMyFeedback, getUserFeedback, markFeedbackRead,
  getApiError
} from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function displayDateTime(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const textareaClass = "min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

function Stars({ rating }) {
  return <span className="text-amber-400">{"\u2605".repeat(rating || 0)}{"\u2606".repeat(Math.max(0, 5 - (rating || 0)))}</span>;
}

export default function WorkoutFeedback({ user, role, canManage, members }) {
  const isAdmin = canManage || role === "trainer" || role === "admin" || role === "owner";
  const token = user?.token || null;

  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ memberId: "", workoutSessionId: "", feedback: "", rating: 5 });
  const [filterMemberId, setFilterMemberId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setForm({ memberId: "", workoutSessionId: "", feedback: "", rating: 5 });
    setShowForm(false);
  }

  async function loadFeedback() {
    try {
      if (isAdmin) {
        const memberId = filterMemberId || form.memberId;
        if (memberId) {
          const res = await getUserFeedback(memberId, token);
          setFeedbackList(Array.isArray(res) ? res : res?.feedback || []);
        } else {
          setFeedbackList([]);
        }
      } else {
        const res = await getMyFeedback(token);
        setFeedbackList(Array.isArray(res) ? res : res?.feedback || []);
      }
    } catch (err) {
      toast.error(getApiError(err, "Failed to load feedback"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadFeedback();
  }, [filterMemberId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.feedback.trim()) {
      toast.error("Feedback is required");
      return;
    }
    setSubmitting(true);
    try {
      await createFeedback(form, token);
      toast.success("Feedback submitted");
      resetForm();
      if (filterMemberId || form.memberId) {
        const id = filterMemberId || form.memberId;
        const res = await getUserFeedback(id, token);
        setFeedbackList(Array.isArray(res) ? res : res?.feedback || []);
      }
    } catch (err) {
      toast.error(getApiError(err, "Failed to submit feedback"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkRead(feedbackId) {
    try {
      await markFeedbackRead(feedbackId, token);
      toast.success("Marked as read");
      setFeedbackList((prev) =>
        prev.map((f) =>
          idOf(f) === feedbackId ? { ...f, read: true, isRead: true } : f
        )
      );
    } catch (err) {
      toast.error(getApiError(err, "Failed to mark as read"));
    }
  }

  function isUnread(item) {
    return item?.read === false || item?.isRead === false;
  }

  function trainerName(item) {
    return nameOf(item?.trainer || item?.trainerId || item?.createdBy || item?.author);
  }

  function memberName(item) {
    return nameOf(item?.member || item?.memberId || item?.user || item?.userId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Workout Feedback</h2>
        {isAdmin && !showForm && (
          <button onClick={() => setShowForm(true)} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            Give Feedback
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Give Feedback</h3>
            <button type="button" onClick={resetForm} className={iconButtonClass}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Member *</label>
              <select
                value={form.memberId}
                onChange={(e) => setForm((prev) => ({ ...prev, memberId: e.target.value }))}
                className={inputClass}
                required
              >
                <option value="">Select a member</option>
                {(Array.isArray(members) ? members : []).map((m) => (
                  <option key={idOf(m)} value={idOf(m)}>{nameOf(m)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Workout Session ID</label>
              <input
                value={form.workoutSessionId}
                onChange={(e) => setForm((prev) => ({ ...prev, workoutSessionId: e.target.value }))}
                placeholder="Optional session ID"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Feedback *</label>
              <textarea
                value={form.feedback}
                onChange={(e) => setForm((prev) => ({ ...prev, feedback: e.target.value }))}
                placeholder="Write your feedback here..."
                className={textareaClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Rating</label>
              <select
                value={form.rating}
                onChange={(e) => setForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                className={inputClass}
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>{r} Star{r > 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={resetForm} className={buttonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      )}

      {isAdmin && (
        <div className="flex items-center gap-3">
          <div className="w-64 space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Filter by Member</label>
            <select
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
              className={inputClass}
            >
              <option value="">All Members</option>
              {(Array.isArray(members) ? members : []).map((m) => (
                <option key={idOf(m)} value={idOf(m)}>{nameOf(m)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {feedbackList.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-14 text-gray-500">
          <MessageSquare className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium">No feedback found</p>
          <p className="mt-1 text-xs">
            {isAdmin ? "Select a member and give feedback to get started." : "No feedback has been given to you yet."}
          </p>
        </div>
      )}

      {feedbackList.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                {isAdmin ? (
                  <>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Session ID</th>
                    <th className="px-4 py-3">Feedback</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Actions</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3">Trainer</th>
                    <th className="px-4 py-3">Feedback</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {feedbackList.map((item) => {
                const fid = idOf(item);
                const unread = isUnread(item);
                return (
                  <tr
                    key={fid}
                    className={`border-b border-gray-100 transition ${
                      unread ? "bg-blue-50" : "bg-white"
                    } hover:bg-gray-50`}
                  >
                    {isAdmin ? (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-900">{memberName(item)}</td>
                        <td className="px-4 py-3 text-gray-600">{item.workoutSessionId || item.sessionId || "-"}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{item.feedback || "-"}</td>
                        <td className="px-4 py-3"><Stars rating={item.rating} /></td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{displayDate(item.createdAt || item.date)}</td>
                        <td className="px-4 py-3">
                          {unread && (
                            <button
                              onClick={() => handleMarkRead(fid)}
                              className={buttonClass}
                              title="Mark as Read"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Mark Read
                            </button>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-900">{trainerName(item)}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{item.feedback || "-"}</td>
                        <td className="px-4 py-3"><Stars rating={item.rating} /></td>
                        <td className="px-4 py-3">
                          {unread ? (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Unread</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Read</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{displayDateTime(item.createdAt || item.date)}</td>
                        <td className="px-4 py-3">
                          {unread && (
                            <button
                              onClick={() => handleMarkRead(fid)}
                              className={buttonClass}
                              title="Mark as Read"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Mark Read
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
