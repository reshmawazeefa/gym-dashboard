import { useState, useEffect } from "react";
import { CalendarDays, Plus, CheckCircle, X, Clock } from "lucide-react";
import toast from "react-hot-toast";
import StatusBadge from "./StatusBadge";
import {
  createSchedule, getMySchedules, getUpcomingSchedules,
  updateSchedule, deleteSchedule, checkInToSchedule,
  startWorkoutSession, getApiError
} from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function displayDateTime(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

const scheduleStatuses = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "MISSED", "CANCELLED"];

export default function WorkoutSchedules({ user, role, canSchedule, canSession, workoutDays = [], onSessionStarted }) {
  const [upcoming, setUpcoming] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [createForm, setCreateForm] = useState({ workoutDayId: "", scheduledDate: "", scheduledTime: "", notes: "" });
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ scheduledDate: "", scheduledTime: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(null);
  const [starting, setStarting] = useState(null);

  const loadUpcoming = async () => {
    setLoadingUpcoming(true);
    try {
      const data = await getUpcomingSchedules(user?.token);
      const list = Array.isArray(data) ? data : data?.data || data?.schedules || data?.results || [];
      setUpcoming(list.slice(0, 10));
    } catch (error) {
      toast.error(getApiError(error, "Unable to load upcoming schedules"));
    } finally {
      setLoadingUpcoming(false);
    }
  };

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;
      if (filterStatus) params.status = filterStatus;
      const data = await getMySchedules(params, user?.token);
      const list = Array.isArray(data) ? data : data?.data || data?.schedules || data?.results || [];
      setSchedules(list);
      if (data?.totalPages !== undefined) setTotalPages(data.totalPages);
      else if (data?.pagination?.totalPages) setTotalPages(data.pagination.totalPages);
      else setTotalPages(list.length < 20 ? 1 : page + 1);
    } catch (error) {
      toast.error(getApiError(error, "Unable to load schedules"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUpcoming();
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [page]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!createForm.workoutDayId || !createForm.scheduledDate || !createForm.scheduledTime) {
      toast.error("Workout day, date, and time are required");
      return;
    }
    setCreating(true);
    try {
      await createSchedule({
        workoutDayId: createForm.workoutDayId,
        scheduledDate: createForm.scheduledDate,
        scheduledTime: createForm.scheduledTime,
        ...(createForm.notes && { notes: createForm.notes }),
      }, user?.token);
      toast.success("Schedule created");
      setCreateForm({ workoutDayId: "", scheduledDate: "", scheduledTime: "", notes: "" });
      await Promise.all([loadUpcoming(), loadSchedules()]);
    } catch (error) {
      toast.error(getApiError(error, "Unable to create schedule"));
    } finally {
      setCreating(false);
    }
  };

  const handleCheckIn = async (scheduleId) => {
    setCheckingIn(scheduleId);
    try {
      await checkInToSchedule(scheduleId, user?.token);
      toast.success("Checked in");
      await Promise.all([loadUpcoming(), loadSchedules()]);
    } catch (error) {
      toast.error(getApiError(error, "Unable to check in"));
    } finally {
      setCheckingIn(null);
    }
  };

  const handleStart = async (schedule) => {
    const scheduleId = idOf(schedule);
    const workoutDayId = schedule.workoutDayId || idOf(schedule.workoutDay);
    setStarting(scheduleId);
    try {
      await startWorkoutSession({
        ...(workoutDayId && { workoutDayId }),
        ...(schedule.workoutPlanId && { workoutPlanId: schedule.workoutPlanId }),
        ...(schedule.assignmentId && { assignmentId: schedule.assignmentId }),
      }, user?.token);
      toast.success("Workout started");
      await Promise.all([loadUpcoming(), loadSchedules()]);
      onSessionStarted?.();
    } catch (error) {
      toast.error(getApiError(error, "Unable to start workout"));
    } finally {
      setStarting(null);
    }
  };

  const startEdit = (schedule) => {
    setEditingId(idOf(schedule));
    const rawDate = schedule.scheduledDate ? schedule.scheduledDate.slice(0, 10) : "";
    const rawTime = schedule.scheduledTime || "";
    setEditForm({
      scheduledDate: rawDate,
      scheduledTime: rawTime,
      notes: schedule.notes || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ scheduledDate: "", scheduledTime: "", notes: "" });
  };

  const handleUpdate = async (scheduleId) => {
    try {
      const payload = {};
      if (editForm.scheduledDate) payload.scheduledDate = editForm.scheduledDate;
      if (editForm.scheduledTime) payload.scheduledTime = editForm.scheduledTime;
      if (editForm.notes !== undefined) payload.notes = editForm.notes;
      if (!Object.keys(payload).length) {
        cancelEdit();
        return;
      }
      await updateSchedule(scheduleId, payload, user?.token);
      toast.success("Schedule updated");
      cancelEdit();
      await Promise.all([loadUpcoming(), loadSchedules()]);
    } catch (error) {
      toast.error(getApiError(error, "Unable to update schedule"));
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!window.confirm("Delete this schedule?")) return;
    try {
      await deleteSchedule(scheduleId, user?.token);
      toast.success("Schedule deleted");
      await Promise.all([loadUpcoming(), loadSchedules()]);
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete schedule"));
    }
  };

  const handleFilter = () => {
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  const isValidCreator = (schedule) => {
    if (!user) return false;
    if (role === "admin") return true;
    const uid = idOf(user);
    const creatorId = idOf(schedule.user || schedule.createdBy || schedule);
    return creatorId === uid;
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <CalendarDays size={18} className="text-gray-400" />
          <h3 className="font-semibold text-gray-950">{canSession ? "My Schedule" : "Upcoming Schedules"}</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {loadingUpcoming ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">Loading upcoming schedules...</div>
          ) : upcoming.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">No upcoming schedules.</div>
          ) : upcoming.map((schedule) => {
            const scheduleId = idOf(schedule);
            const status = schedule.status || "SCHEDULED";
            return (
              <div key={scheduleId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={status} label={status} />
                    {schedule.workoutDay?.title && <span className="text-sm font-medium text-gray-800">{schedule.workoutDay.title}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Clock size={12} />{displayDate(schedule.scheduledDate)}</span>
                    {schedule.scheduledTime && <span>{schedule.scheduledTime}</span>}
                    {schedule.notes && <span className="text-gray-400">— {schedule.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    {canSession && status === "SCHEDULED" && (
                    <button type="button" onClick={() => handleCheckIn(scheduleId)} disabled={checkingIn === scheduleId} className={primaryButtonClass}>
                      {checkingIn === scheduleId ? "Checking in..." : "Check In"}
                    </button>
                  )}
                    {canSession && status === "CHECKED_IN" && (
                      <button type="button" onClick={() => handleStart(schedule)} disabled={starting === scheduleId} className={primaryButtonClass}>
                        {starting === scheduleId ? "Starting..." : "Start Workout"}
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {canSchedule && (
        <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-950">Create Schedule</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">Schedule a workout day on the calendar.</p>
            </div>
            <Plus size={18} className="text-gray-400" />
          </div>
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
              Workout Day
              <select
                className={inputClass}
                value={createForm.workoutDayId}
                onChange={(e) => setCreateForm({ ...createForm, workoutDayId: e.target.value })}
                disabled={!workoutDays.length}
                required
              >
                <option value="">
                  {workoutDays.length ? "Select a workout day" : "No workout days available"}
                </option>
                {workoutDays.map((day) => {
                  const dayId = idOf(day);
                  const planName = day.workoutPlan?.name || day.workoutPlan?.title || "Workout";
                  const dayName = day.title || day.name || `Day ${day.dayNumber || ""}`;
                  return <option key={dayId} value={dayId}>{planName} - {dayName}</option>;
                })}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
              Date
              <input className={inputClass} type="date" value={createForm.scheduledDate} onChange={(e) => setCreateForm({ ...createForm, scheduledDate: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
              Time
              <input className={inputClass} type="time" value={createForm.scheduledTime} onChange={(e) => setCreateForm({ ...createForm, scheduledTime: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
              Notes
              <textarea className="min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Optional notes" />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="submit" className={primaryButtonClass} disabled={creating}>
                {creating ? "Scheduling..." : "Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!canSession && <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-4">
          <label className="grid gap-0.5 text-xs font-semibold uppercase text-gray-500">
            From
            <input className={`${inputClass} h-9 w-40`} type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </label>
          <label className="grid gap-0.5 text-xs font-semibold uppercase text-gray-500">
            To
            <input className={`${inputClass} h-9 w-40`} type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </label>
          <label className="grid gap-0.5 text-xs font-semibold uppercase text-gray-500">
            Status
            <select className={`${inputClass} h-9 w-36`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              {scheduleStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={handleFilter} className={buttonClass}>Load</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Day / Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((schedule) => {
                const scheduleId = idOf(schedule);
                const isEditing = editingId === scheduleId;
                const status = schedule.status || "SCHEDULED";
                if (isEditing) {
                  return (
                    <tr key={scheduleId} className="bg-blue-50/20">
                      <td className="px-4 py-2">
                        <input className={`${inputClass} h-8`} type="date" value={editForm.scheduledDate} onChange={(e) => setEditForm({ ...editForm, scheduledDate: e.target.value })} />
                      </td>
                      <td className="px-4 py-2">
                        <input className={`${inputClass} h-8`} type="time" value={editForm.scheduledTime} onChange={(e) => setEditForm({ ...editForm, scheduledTime: e.target.value })} />
                      </td>
                      <td className="px-4 py-2 text-gray-800">
                        {schedule.workoutDay?.title || schedule.workoutPlan?.title || "-"}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={status} label={status} />
                      </td>
                      <td className="px-4 py-2">
                        <input className={`${inputClass} h-8`} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes" />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleUpdate(scheduleId)} className="inline-flex h-7 items-center rounded-lg bg-blue-600 px-2 text-xs font-medium text-white hover:bg-blue-700">Save</button>
                          <button type="button" onClick={cancelEdit} className="inline-flex h-7 items-center rounded-lg bg-gray-200 px-2 text-xs font-medium text-gray-700 hover:bg-gray-300">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={scheduleId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{displayDate(schedule.scheduledDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{schedule.scheduledTime || "-"}</td>
                    <td className="px-4 py-3 text-gray-800">{schedule.workoutDay?.title || schedule.workoutPlan?.title || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} label={status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-40 truncate">{schedule.notes || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {isValidCreator(schedule) && status === "SCHEDULED" && (
                          <button type="button" onClick={() => startEdit(schedule)} className={iconButtonClass} title="Edit schedule">
                            <CalendarDays size={15} />
                          </button>
                        )}
                        {isValidCreator(schedule) && (
                          <button type="button" onClick={() => handleDelete(scheduleId)} className={iconButtonClass} title="Delete schedule">
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && (
            <div className="p-6 text-center text-sm text-gray-500">Loading schedules...</div>
          )}
          {!loading && schedules.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">No schedules found.</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
              Previous
            </button>
            <div className="flex items-center gap-1">
              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${p === page ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button type="button" className={buttonClass} disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>
              Next
            </button>
        </div>
      </div>}
    </section>
  );
}
