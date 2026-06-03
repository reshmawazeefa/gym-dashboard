import { Fragment, useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, Edit, Search, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";
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
const statusTone = {
  PENDING: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

const inputClass =
  "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass =
  "min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const pillButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
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
          facilityId: facilityFilter || undefined,
          status: statusFilter || undefined,
        },
        user?.token
      );
      setRecords(unwrapList(response));
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
  }, [facilityFilter, statusFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditId("");
  };

  const clearFilters = () => {
    setSearch("");
    setFacilityFilter("");
    setStatusFilter("");
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
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-950">Facility Maintenance</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                Log maintenance tasks for facilities and update status as repairs progress.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Tasks</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{records.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Pending</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{pendingCount}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Completed</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{completedCount}</p>
        </div>
      </section>

      <section className="grid gap-6 items-start xl:grid-cols-[18rem_minmax(0,1.6fr)]">
        <form onSubmit={startMaintenance} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 xl:max-w-[18rem]">
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

        <div className="overflow-hidden min-w-0 rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-col gap-4 border-b border-gray-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Maintenance tasks</p>
              <p className="mt-1 text-sm text-slate-500">Filter, search, and manage facility work orders quickly.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} onClick={clearFilters}>
                Clear filters
              </button>
              <button type="button" className={buttonClass} onClick={() => void loadRecords()}>
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_14rem_14rem]">
            <label className="flex min-w-0 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <Search size={18} className="text-gray-400" />
              <input
                className="min-w-0 flex-1 border-none bg-transparent py-1 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks, facility, status"
              />
            </label>
            <select className={inputClass} value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)}>
              <option value="">All facilities</option>
              {facilities.map((facility) => (
                <option key={facility.id || facility._id} value={facility.id || facility._id}>
                  {facility.name || "Unnamed facility"}
                </option>
              ))}
            </select>
            <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
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
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[record.status] || "bg-gray-100 text-gray-700"}`}>
                          {record.status?.replace(/_/g, " ") || "Unknown"}
                        </span>
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
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-600 transition hover:bg-gray-100 ${isExpanded ? "rotate-180" : ""}`}
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
                      className={`${statusButtonClass} ${record.status === "COMPLETED" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
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
                      className={`${pillButtonClass} border-red-200 text-red-700 hover:bg-red-50`}
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

          <div className="overflow-x-auto hidden lg:block">
            <table className="w-full min-w-full table-auto text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3"></th>
                  <th className="p-3">Task</th>
                  <th className="p-3">Facility</th>
                  <th className="p-3">Schedule</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((record) => {
                  const recordId = record.id || record._id || record.maintenanceId;
                  const isExpanded = expandedId === recordId;
                  return (
                    <Fragment key={recordId}>
                      <tr className="align-middle hover:bg-gray-50">
                        <td className="p-3 text-center align-middle">
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 ${isExpanded ? "rotate-180" : ""}`}
                            onClick={() => setExpandedId(isExpanded ? "" : recordId)}
                            aria-label={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </td>
                        <td className="p-3 min-w-0">
                          <p className="truncate font-semibold text-gray-950">{record.title || "Untitled task"}</p>
                        </td>
                        <td className="p-3 text-sm text-gray-700">{getFacilityName(facilities, record.facilityId)}</td>
                        <td className="p-3 text-sm text-gray-700">
                          <div>{formatFriendlyDate(record.startDate)}</div>
                          <div className="text-gray-500">{formatFriendlyDate(record.endDate)}</div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone[record.status] || "bg-gray-100 text-gray-700"}`}>
                            {record.status?.replace(/_/g, " ") || "Unknown"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void toggleRecordStatus(record)}
                              disabled={!canEdit}
                              className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold ${record.status === "COMPLETED" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"} disabled:opacity-50`}
                            >
                              {record.status === "COMPLETED" ? "Reopen" : "Complete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void editRecord(record)}
                              disabled={!canEdit}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                              aria-label="Edit maintenance"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeRecord(record)}
                              disabled={!canDelete}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40"
                              aria-label="Delete maintenance"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="p-4 text-sm text-gray-600">
                            <div>
                              <p className="text-xs font-semibold uppercase text-gray-500">Description</p>
                              <p className="mt-2 leading-6 text-slate-700">{record.description || "No description provided."}</p>
                            </div>
                          </td>
                        </tr>
                      )}
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
        </div>
      </section>
    </div>
  );
}
