import { useEffect, useMemo, useState } from "react";
import { Building2, Download, Edit, Plus, Search, Trash, X } from "lucide-react";
import toast from "react-hot-toast";
import TablePagination from "./TablePagination";
import StatusBadge from "./StatusBadge";
import {
  createFacility,
  deleteFacility,
  getApiError,
  getFacilities,
  getFacilityById,
  toggleFacilityStatus,
  updateFacility,
  unwrapObject,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";

const facilityTypes = ["SWIMMING", "CARDIO", "STRENGTH", "YOGA", "SAUNA", "LOCKER", "OTHER"];
const emptyFacilityForm = {
  name: "",
  description: "",
  type: "SWIMMING",
  capacity: "",
  openingTime: "",
  closingTime: "",
  rules: "",
};
const inputClass =
  "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50";

function idOf(item) {
  return item?.id || item?._id || item?.facilityId || "";
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function unwrapFacilities(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.facilities)) return payload.facilities;
  if (Array.isArray(payload?.data?.facilities)) return payload.data.facilities;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function unwrapMeta(payload, fallback) {
  return payload?.meta || payload?.data?.meta || fallback;
}

function normalizeFacilityPayload(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    type: form.type,
    capacity: Number(form.capacity),
    openingTime: form.openingTime,
    closingTime: form.closingTime,
    rules: form.rules.trim(),
  };
}

function facilityDescription(facility) {
  const name = facility.name?.trim();
  const description = facility.description?.trim();
  if (description && description !== name) return description;
  return "";
}

export default function AdminFacilities() {
  const { user } = useAuth();
  const canCreate = canAccess(user, "facilities", "create");
  const canEdit = canAccess(user, "facilities", "edit");
  const canDelete = canAccess(user, "facilities", "delete");

  const [facilities, setFacilities] = useState([]);
  const [form, setForm] = useState(emptyFacilityForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isFacilityModalOpen, setFacilityModalOpen] = useState(false);

  useEffect(() => {
    if (!isFacilityModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFacilityModalOpen]);

  const activeCount = useMemo(() => facilities.filter((facility) => facility.isActive !== false).length, [facilities]);
  const inactiveCount = Math.max(0, facilities.length - activeCount);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const response = await getFacilities(
        {
          page,
          limit,
          search: search.trim() || undefined,
          type: typeFilter || undefined,
          isActive: activeFilter === "" ? undefined : activeFilter,
        },
        user?.token
      );
      const nextMeta = unwrapMeta(response, { total: 0, page, limit, totalPages: 1 });
      setFacilities(unwrapFacilities(response));
      setMeta({
        total: Number(nextMeta.total || 0),
        page: Number(nextMeta.page || page),
        limit: Number(nextMeta.limit || limit),
        totalPages: Math.max(1, Number(nextMeta.totalPages || 1)),
      });
    } catch (error) {
      setFacilities([]);
      toast.error(getApiError(error, "Unable to load facilities"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFacilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, typeFilter, activeFilter]);

  const resetForm = () => {
    setForm(emptyFacilityForm);
    setEditingId("");
    setFacilityModalOpen(false);
  };

  const openCreateFacility = () => {
    resetForm();
    setFacilityModalOpen(true);
  };

  const handleExportCsv = () => {
    if (!facilities.length) {
      toast.error("No facilities available to export");
      return;
    }

    const headers = ["Facility", "Type", "Capacity", "Description", "Rules", "Opening Time", "Closing Time", "Status"];
    const escapeCsvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = facilities.map((facility) => [
      facility.name,
      titleCase(facility.type || ""),
      facility.capacity,
      facilityDescription(facility),
      facility.rules,
      facility.openingTime,
      facility.closingTime,
      facility.isActive === false ? "Inactive" : "Active",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "facilities.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} facilit${rows.length === 1 ? "y" : "ies"} exported`);
  };

  const submitFacility = async (event) => {
    event.preventDefault();
    if ((editingId && !canEdit) || (!editingId && !canCreate)) {
      toast.error("You do not have permission to save facilities");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Facility name is required");
      return;
    }
    if (!Number.isFinite(Number(form.capacity)) || Number(form.capacity) <= 0) {
      toast.error("Capacity must be a positive number");
      return;
    }
    if (!form.openingTime || !form.closingTime) {
      toast.error("Opening and closing time are required");
      return;
    }

    try {
      setSaving(true);
      const payload = normalizeFacilityPayload(form);
      if (editingId) {
        await updateFacility(editingId, payload, user?.token);
        toast.success("Facility updated successfully");
      } else {
        await createFacility(payload, user?.token);
        toast.success("Facility created successfully");
      }
      resetForm();
      void loadFacilities();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save facility"));
    } finally {
      setSaving(false);
    }
  };

  const editFacility = async (facility) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit facilities");
      return;
    }

    try {
      const facilityId = idOf(facility);
      const response = await getFacilityById(facilityId, user?.token);
      const detail = unwrapObject(response);
      const nextFacility = detail?.facility || detail || facility;
      setEditingId(facilityId);
      setFacilityModalOpen(true);
      setForm({
        name: nextFacility.name || "",
        description: nextFacility.description || "",
        type: nextFacility.type || "SWIMMING",
        capacity: nextFacility.capacity || "",
        openingTime: nextFacility.openingTime || "",
        closingTime: nextFacility.closingTime || "",
        rules: nextFacility.rules || "",
      });
    } catch (error) {
      toast.error(getApiError(error, "Unable to load facility details"));
    }
  };

  const removeFacility = async (facility) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete facilities");
      return;
    }
    if (!confirm("Delete this facility?")) return;

    try {
      await deleteFacility(idOf(facility), user?.token);
      toast.success("Facility deleted successfully");
      void loadFacilities();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete facility"));
    }
  };

  const changeFacilityStatus = async (facility) => {
    if (!canEdit) {
      toast.error("You do not have permission to update facility status");
      return;
    }

    const facilityId = idOf(facility);
    if (!facilityId || updatingStatusId) return;

    try {
      setUpdatingStatusId(facilityId);
      await toggleFacilityStatus(idOf(facility), { isActive: facility.isActive === false }, user?.token);
      toast.success("Facility status updated successfully");
      await loadFacilities();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update facility status"));
    } finally {
      setUpdatingStatusId("");
    }
  };

  const applySearch = (event) => {
    event.preventDefault();
    if (page === 1) {
      void loadFacilities();
    } else {
      setPage(1);
    }
  };

  return (
    <div className="min-h-full space-y-5 bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl">Facility Management</h1>
          <p className="mt-0.5 text-xs text-[#64748B]">Manage gym zones, studios, room capacity, operating hours, and booking rules.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button type="button" onClick={handleExportCsv} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#F8FAFC]"><Download size={14} />Export CSV</button>
          {canCreate && <button type="button" onClick={openCreateFacility} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"><Plus size={14} />Add Facility</button>}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-[#64748B]">Total Facilities</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-extrabold leading-none text-[#0F172A]">{meta.total || facilities.length}</p>
            <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-[#0D8252]">Active</span>
          </div>
        </div>
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-[#64748B]">Active On Page</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-extrabold leading-none text-[#0D8252]">{activeCount}</p>
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-medium text-[#0D8252]">{meta.total ? Math.round((activeCount / meta.total) * 100) : 0}% operational</span>
          </div>
        </div>
        <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <p className="text-xs font-medium text-[#64748B]">Inactive On Page</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-extrabold leading-none text-amber-600">{inactiveCount}</p>
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">Offline</span>
          </div>
        </div>
      </section>

      <section className="grid items-start">
        <form onSubmit={submitFacility} className="hidden">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-950">{editingId ? "Edit Facility" : "Create Facility"}</h2>
            <p className="mt-1 text-sm text-gray-500">Facility details are saved to the facility API.</p>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Name
              <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Swimming Pool" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Description
              <textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Olympic size pool" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Type
                <select className={inputClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  {facilityTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Capacity
                <input className={inputClass} type="number" min="1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="40" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Opening Time
                <input className={inputClass} type="time" value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Closing Time
                <input className={inputClass} type="time" value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Rules
              <textarea className={textareaClass} value={form.rules} onChange={(event) => setForm({ ...form, rules: event.target.value })} placeholder="Swimming costume mandatory" />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" className={primaryButtonClass} disabled={saving || (editingId ? !canEdit : !canCreate)}>
              {saving ? "Saving..." : editingId ? "Update Facility" : "Create Facility"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className={buttonClass}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="overflow-hidden min-w-0 rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <form onSubmit={applySearch} className="flex flex-col gap-2 border-b border-[#EEF2F4] bg-white p-3 sm:flex-row sm:items-center">
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 focus-within:border-[#0D8252] focus-within:bg-white">
              <Search size={15} className="text-[#94A3B8]" />
              <input className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#94A3B8]" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search facilities..." />
            </div>
            <select className={`${inputClass} sm:w-24`} value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
              <option value="">All Types</option>
              {facilityTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
            <select className={`${inputClass} sm:w-24`} value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button type="submit" className={`${buttonClass} sm:px-4`}>Search</button>
          </form>

          <div className="overflow-hidden">
            <table className="w-full min-w-0 table-auto text-left text-sm">
              <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3 text-center">Capacity</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Rules</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facilities.map((facility) => {
                  const facilityId = idOf(facility);
                  return (
                      <tr className="h-[58px] border-t border-[#EEF2F4] align-middle text-[10px] text-[#475569] transition hover:bg-[#FBFCFD]">
                        <td className="px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#0F172A]">{facility.name || "Unnamed facility"}</p>
                            <span className="mt-0.5 inline-flex rounded-lg bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-[#0D8252]">{titleCase(facility.type || "-")}</span>
                          </div>
                        </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-[#0F172A]">{facility.capacity || "-"}</td>
                    <td className="max-w-40 truncate px-4 py-2.5">{facilityDescription(facility) || "-"}</td>
                    <td className="max-w-40 truncate px-4 py-2.5">{facility.rules || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{facility.openingTime || "--:--"} - {facility.closingTime || "--:--"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={facility.isActive === false ? "INACTIVE" : "ACTIVE"}
                        label={facility.isActive === false ? "Inactive" : "Active"}
                        onClick={() => void changeFacilityStatus(facility)}
                        disabled={!canEdit || updatingStatusId === idOf(facility)}
                        aria-label={facility.isActive === false ? "Activate facility" : "Deactivate facility"}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => void editFacility(facility)} disabled={!canEdit} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#0D8252] transition hover:bg-emerald-50 disabled:opacity-40" aria-label="Edit facility">
                          <Edit size={15} />
                        </button>
                        <button type="button" onClick={() => void removeFacility(facility)} disabled={!canDelete} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 disabled:opacity-40" aria-label="Delete facility">
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {!loading && !facilities.length && (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-500">No facilities found.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading facilities...</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p>Page {meta.page} of {meta.totalPages || 1} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {facilities.length} facilities</p>
              {/* <select className="h-8 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[10px] text-[#475569]" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
                {[10, 20, 50].map((item) => <option key={item} value={item}>{item} / page</option>)}
              </select> */}
            </div>
            <TablePagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} previousLabel="Prev" disabled={loading} />
          </div>
        </div>
      </section>

      {isFacilityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && resetForm()}>
          <form onSubmit={submitFacility} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Building2 size={18} /></div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">{editingId ? "Edit Facility" : "Add Facility"}</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">Create facilities, capacity, operating hours, and booking rules.</p>
                </div>
              </div>
              <button type="button" onClick={resetForm} aria-label="Close Facility modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#334155] sm:col-span-2">Name<input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Swimming Pool" /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155] sm:col-span-2">Description<textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Olympic size pool" /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">Type<select className={inputClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{facilityTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">Capacity<input className={inputClass} type="number" min="1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="40" /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">Opening Time<input className={inputClass} type="time" value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">Closing Time<input className={inputClass} type="time" value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155] sm:col-span-2">Rules<textarea className={textareaClass} value={form.rules} onChange={(event) => setForm({ ...form, rules: event.target.value })} placeholder="Swimming costume mandatory" /></label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={resetForm} className={buttonClass}>Cancel</button>
              <button type="submit" className={primaryButtonClass} disabled={saving || (editingId ? !canEdit : !canCreate)}>{saving ? "Saving..." : editingId ? "Update Facility" : "Add Facility"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
