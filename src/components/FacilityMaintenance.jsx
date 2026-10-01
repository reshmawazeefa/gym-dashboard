import { Fragment, useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, Edit, Plus, Search, Trash, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";
import StatusBadge from "./StatusBadge";
import {
  createFacilityMaintenance,
  deleteFacilityMaintenance,
  getApiError,
  getFacilityMaintenances,
  getFacilityMaintenanceById,
  getFacilities,
  updateFacilityMaintenance,
  unwrapList,
} from "../services/api";

const statusOptions = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const inputClass =
  "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50";
const pillButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const statusButtonClass =
  "inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

const emptyForm = {
  facilityId: "",
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  status: "PENDING",
};

function normalizeDateTime(value) {
  if (!value) return "";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "";
  return time.toISOString();
}

function formatFriendlyDate(value) {
  if (!value) return "—";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getFacilityName(facilities, id) {
  const facility = facilities.find((item) => item.id === id || item._id === id || item.facilityId === id);
  return facility?.name || id || "Unknown facility";
}

export default function FacilityMaintenance() {
  const { user } = useAuth();
  const canCreate = canAccess(user, "facility-maintenance", "create");
  const canEdit = canAccess(user, "facility-maintenance", "edit");
  const canDelete = canAccess(user, "facility-maintenance", "delete");

  const [facilities, setFacilities] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isModalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  const pendingCount = useMemo(
    () => records.filter((record) => record.status === "PENDING").length,
    [records]
  );
  const completedCount = useMemo(
    () => records.filter((record) => record.status === "COMPLETED").length,
    [records]
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;

    return records.filter((record) =>
      [record.title, record.description, getFacilityName(facilities, record.facilityId), record.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [records, search, facilities]);

  const loadFacilities = async () => {
    try {
      const response = await getFacilities({}, user?.token);
      setFacilities(unwrapList(response));
    } catch (error) {
      toast.error(getApiError(error, "Unable to load facilities"));
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const response = await getFacilityMaintenances(
        {
          page,
          limit,
          facilityId: facilityFilter || undefined,
          status: statusFilter || undefined,
        },
        user?.token
      );
      const responseMeta = response?.meta || response?.data?.meta || {};
      setRecords(unwrapList(response));
      setMeta({
        total: Number(responseMeta.total || 0),
        page: Number(responseMeta.page || page),
        limit: Number(responseMeta.limit || limit),
        totalPages: Math.max(1, Number(responseMeta.totalPages || 1)),
      });
    } catch (error) {
      toast.error(getApiError(error, "Unable to load maintenance tasks"));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchMaintenanceData = async () => {
      await Promise.all([loadFacilities(), loadRecords()]);
    };

    void fetchMaintenanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  useEffect(() => {
    const reloadRecords = async () => {
      await loadRecords();
    };

    void reloadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityFilter, statusFilter, page, limit]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditId("");
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setFacilityFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const startMaintenance = async (event) => {
    event.preventDefault();
    if ((editId && !canEdit) || (!editId && !canCreate)) {
      toast.error("You do not have permission to save maintenance tasks");
      return;
    }

    if (!form.facilityId) {
      toast.error("Facility is required");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Maintenance title is required");
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error("Start and end date are required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        facilityId: form.facilityId,
        title: form.title.trim(),
        description: form.description.trim(),
        startDate: normalizeDateTime(form.startDate),
        endDate: normalizeDateTime(form.endDate),
        status: form.status,
      };

      if (editId) {
        await updateFacilityMaintenance(editId, payload, user?.token);
        toast.success("Maintenance task updated successfully");
      } else {
        await createFacilityMaintenance(payload, user?.token);
        toast.success("Maintenance task created successfully");
      }
      resetForm();
      void loadRecords();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save maintenance task"));
    } finally {
      setSaving(false);
    }
  };

  const editRecord = async (record) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit maintenance tasks");
      return;
    }

    try {
      const maintenanceId = record.id || record._id || record.maintenanceId;
      const response = await getFacilityMaintenanceById(maintenanceId, user?.token);
      const detail = response?.data || response;
      const entry = detail?.maintenance || detail || record;

      setEditId(maintenanceId);
      setModalOpen(true);
      setForm({
        facilityId: entry.facilityId || entry.facility?.id || entry.facility?._id || "",
        title: entry.title || "",
        description: entry.description || "",
        startDate: toLocalInputDate(entry.startDate),
        endDate: toLocalInputDate(entry.endDate),
        status: entry.status || "PENDING",
      });
    } catch (error) {
      toast.error(getApiError(error, "Unable to load maintenance details"));
    }
  };

  const removeRecord = async (record) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete maintenance tasks");
      return;
    }
    if (!confirm("Delete this maintenance task?")) return;

    try {
      const maintenanceId = record.id || record._id || record.maintenanceId;
      await deleteFacilityMaintenance(maintenanceId, user?.token);
      toast.success("Maintenance task deleted successfully");
      void loadRecords();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete maintenance task"));
    }
  };

  const toggleRecordStatus = async (record) => {
    if (!canEdit) {
      toast.error("You do not have permission to update maintenance status");
      return;
    }

    try {
      const maintenanceId = record.id || record._id || record.maintenanceId;
      const nextStatus = record.status === "COMPLETED" ? "PENDING" : "COMPLETED";
      await updateFacilityMaintenance(maintenanceId, { status: nextStatus }, user?.token);
      toast.success("Maintenance status updated successfully");
      void loadRecords();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update maintenance status"));
    }
  };

  return (
    <div className="min-h-full space-y-5 bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
      <header className="px-0.5">
        <h1 className="text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl">Facility Maintenance</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">Schedule, track, and manage facility work orders quickly.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-[#64748B]">Total Tasks</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-extrabold leading-none text-[#0F172A]">{records.length}</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-[#475569]">All tasks</span>
          </div>
        </div>
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-[#64748B]">Pending</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-extrabold leading-none text-amber-600">{pendingCount}</p>
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">Needs attention</span>
          </div>
        </div>
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-[#64748B]">Completed</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-extrabold leading-none text-[#0D8252]">{completedCount}</p>
            <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-[#0D8252]">Completed</span>
          </div>
        </div>
      </section>

      <section className="grid items-start">
        <form onSubmit={startMaintenance} className="hidden">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-950">{editId ? "Update Maintenance" : "Create Maintenance"}</h2>
            <p className="mt-1 text-sm text-gray-500">Schedule facility service, inspections, and repair work.</p>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Facility
              <select
                className={inputClass}
                value={form.facilityId}
                onChange={(event) => setForm({ ...form, facilityId: event.target.value })}
              >
                <option value="">Select facility</option>
                {facilities.map((facility) => (
                  <option key={facility.id || facility._id} value={facility.id || facility._id}>
                    {facility.name || "Unnamed facility"}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Title
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Pump service"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Description
              <textarea
                className={textareaClass}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Clean filters and check motors"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Start Date
              <input
                className={inputClass}
                type="datetime-local"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              End Date
              <input
                className={inputClass}
                type="datetime-local"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Status
              <select
                className={inputClass}
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" className={primaryButtonClass} disabled={saving || (editId ? !canEdit : !canCreate)}>
              {saving ? "Saving..." : editId ? "Update Task" : "Create Task"}
            </button>
            {editId && (
              <button type="button" onClick={resetForm} className={buttonClass}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#EEF2F4] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-bold text-[#0F172A]">Maintenance tasks</p>
              <p className="mt-0.5 text-xs text-[#64748B]">Filter, search, and manage facility work orders quickly.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreate && <button type="button" className={primaryButtonClass} onClick={openCreateModal}><Plus size={14} />Create Task</button>}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-[#EEF2F4] bg-white p-3 sm:flex-row sm:items-center">
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 focus-within:border-[#0D8252] focus-within:bg-white">
              <Search size={15} className="text-[#94A3B8]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks, facility, status"
              />
              <button type="button" onClick={clearFilters} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-[#0D8252] transition hover:bg-emerald-50">Reset</button>
            </label>
            <label className="flex h-9 w-full items-center gap-2 sm:w-48"><span className="shrink-0 text-[10px] font-semibold text-[#64748B]">Facilities</span><select className={`${inputClass} min-w-0`} value={facilityFilter} onChange={(event) => { setFacilityFilter(event.target.value); setPage(1); }}><option value="">All facilities</option>{facilities.map((facility) => <option key={facility.id || facility._id} value={facility.id || facility._id}>{facility.name || "Unnamed facility"}</option>)}</select></label>
            <label className="flex h-9 w-full items-center gap-2 sm:w-44"><span className="shrink-0 text-[10px] font-semibold text-[#64748B]">Statuses</span><select className={`${inputClass} min-w-0`} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></label>
          </div>

          <div className="space-y-4 p-4 lg:hidden">
            {filteredRecords.map((record) => {
              const recordId = record.id || record._id || record.maintenanceId;
              const isExpanded = expandedId === recordId;
              return (
                <div key={recordId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-slate-950">{record.title || "Untitled task"}</p>
                        <StatusBadge status={record.status || "UNKNOWN"} label={record.status?.replace(/_/g, " ") || "Unknown"} />
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div>
                          <p className="font-semibold text-slate-900">Facility</p>
                          <p>{getFacilityName(facilities, record.facilityId)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Schedule</p>
                          <p>{formatFriendlyDate(record.startDate)} — {formatFriendlyDate(record.endDate)}</p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? "" : recordId)}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-slate-600 transition hover:bg-gray-100 ${isExpanded ? "rotate-180" : ""}`}
                      aria-label={isExpanded ? "Collapse details" : "Expand details"}
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleRecordStatus(record)}
                      disabled={!canEdit}
                      className={`rounded-lg ${statusButtonClass} ${record.status === "COMPLETED" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >
                      {record.status === "COMPLETED" ? "Reopen" : "Mark Completed"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void editRecord(record)}
                      disabled={!canEdit}
                      className={pillButtonClass}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeRecord(record)}
                      disabled={!canDelete}
                      className={`rounded-lg ${pillButtonClass} border-red-200 text-red-700 hover:bg-red-50`}
                    >
                      Delete
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                        <p className="mt-2 text-slate-700">{record.description || "No additional notes."}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && !filteredRecords.length && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No maintenance tasks match the current filters.
              </div>
            )}
            {loading && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Loading tasks...
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-0 table-auto text-left text-sm">
              <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="w-[24%] px-4 py-3">Task</th>
                  <th className="w-[18%] px-4 py-3">Facility</th>
                  <th className="w-[20%] px-4 py-3">Schedule</th>
                  <th className="w-[17%] px-4 py-3">Description</th>
                  <th className="w-[12%] px-4 py-3">Status</th>
                  <th className="w-[9%] px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((record) => {
                  const recordId = record.id || record._id || record.maintenanceId;
                  return (
                    <Fragment key={recordId}>
                      <tr className="h-[58px] border-t border-[#EEF2F4] align-middle text-[10px] text-[#475569] transition hover:bg-[#FBFCFD]">
                        <td className="min-w-0 px-4 py-2.5">
                          <p className="truncate text-xs font-bold text-[#0F172A]">{record.title || "Untitled task"}</p>
                        </td>
                        <td className="truncate px-4 py-2.5 text-xs text-[#475569]">{getFacilityName(facilities, record.facilityId)}</td>
                        <td className="px-4 py-2.5 text-xs text-[#475569]">
                          <div className="inline-flex flex-col items-start gap-1">
                            <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{formatFriendlyDate(record.startDate)}</span>
                            <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{formatFriendlyDate(record.endDate)}</span>
                          </div>
                        </td>
                        <td className="max-w-40 truncate px-4 py-2.5 text-xs text-[#475569]">{record.description || "-"}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={record.status || "UNKNOWN"} label={record.status?.replace(/_/g, " ") || "Unknown"} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void toggleRecordStatus(record)}
                              disabled={!canEdit}
                              className={`inline-flex h-7 items-center rounded-lg px-2 text-[10px] font-semibold ${record.status === "COMPLETED" ? "bg-[#0D8252] text-white hover:bg-[#086B43]" : "bg-slate-100 text-slate-700 hover:bg-slate-200"} disabled:opacity-50`}
                            >
                              {record.status === "COMPLETED" ? "Reopen" : "Complete"}
                            </button>
                            <div className="flex w-full items-center justify-between">
                              <button type="button" onClick={() => void editRecord(record)} disabled={!canEdit} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#0D8252] hover:bg-emerald-50 disabled:opacity-40" aria-label="Edit maintenance"><Edit size={15} /></button>
                              <button type="button" onClick={() => void removeRecord(record)} disabled={!canDelete} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40" aria-label="Delete maintenance"><Trash size={16} /></button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {!loading && !filteredRecords.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No maintenance tasks found.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Loading tasks...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-[#64748B]">
              Showing {meta.total ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, meta.total)} of {meta.total} maintenance tasks
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="rounded-lg bg-[#0D8252] px-3 py-1.5 font-bold text-white">{page}</span>
              <button
                type="button"
                onClick={() => setPage((currentPage) => Math.min(currentPage + 1, meta.totalPages || 1))}
                disabled={page >= meta.totalPages || loading}
                className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && resetForm()}>
          <form onSubmit={startMaintenance} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Building2 size={18} /></div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">{editId ? "Update Maintenance" : "Create Maintenance"}</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">Schedule facility service, inspections, and repair work.</p>
                </div>
              </div>
              <button type="button" onClick={resetForm} aria-label="Close maintenance modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#334155] sm:col-span-2">Facility<select className={inputClass} value={form.facilityId} onChange={(event) => setForm({ ...form, facilityId: event.target.value })}><option value="">Select facility</option>{facilities.map((facility) => <option key={facility.id || facility._id} value={facility.id || facility._id}>{facility.name || "Unnamed facility"}</option>)}</select></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155] sm:col-span-2">Title<input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Pump service" /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155] sm:col-span-2">Description<textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Clean filters and check motors" /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">Start Date<input className={inputClass} type="datetime-local" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">End Date<input className={inputClass} type="datetime-local" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155] sm:col-span-2">Status<select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statusOptions.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={resetForm} className={buttonClass}>Cancel</button>
              <button type="submit" className={primaryButtonClass} disabled={saving || (editId ? !canEdit : !canCreate)}>{saving ? "Saving..." : editId ? "Update Task" : "Create Task"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
