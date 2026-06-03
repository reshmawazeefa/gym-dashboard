import { Fragment, useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Edit, Power, RefreshCw, Search, Trash } from "lucide-react";
import toast from "react-hot-toast";
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
  "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const textareaClass =
  "min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

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
  const [expandedFacilityId, setExpandedFacilityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

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

    try {
      await toggleFacilityStatus(idOf(facility), { isActive: facility.isActive === false }, user?.token);
      toast.success("Facility status updated successfully");
      void loadFacilities();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update facility status"));
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
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-950">Facility Management</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                Create facilities, filter by type and status, and manage active availability.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void loadFacilities()} className={buttonClass}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Facilities</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{meta.total || facilities.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Active On Page</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{activeCount}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Inactive On Page</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{inactiveCount}</p>
        </div>
      </section>

      <section className="grid gap-6 items-start xl:grid-cols-[20rem_minmax(0,1fr)]">
        <form onSubmit={submitFacility} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 xl:max-w-[22rem]">
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
          <form onSubmit={applySearch} className="grid gap-4 border-b border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_6rem] lg:items-end">
            <div className="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <Search size={17} className="text-gray-400" />
              <input className="min-w-0 flex-1 text-sm outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search facilities..." />
            </div>
            <select className={inputClass} value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
              <option value="">All Types</option>
              {facilityTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
            <select className={inputClass} value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button type="submit" className={buttonClass}>Search</button>
          </form>

          <div className="overflow-hidden">
            <table className="w-full min-w-0 table-auto text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3"></th>
                  <th className="p-3">Facility</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-center">Capacity</th>
                  <th className="p-3 text-center">Hours</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facilities.map((facility) => {
                  const facilityId = idOf(facility);
                  const isExpanded = expandedFacilityId === facilityId;
                  return (
                    <Fragment key={facilityId}>
                      <tr className="align-middle hover:bg-gray-50">
                        <td className="p-3 text-center align-middle">
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 ${isExpanded ? "rotate-180" : ""}`}
                            onClick={() => setExpandedFacilityId(isExpanded ? "" : facilityId)}
                            aria-label={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </td>
                        <td className="p-3 min-w-0">
                          <p className="truncate font-semibold text-gray-950">{facility.name || "Unnamed facility"}</p>
                        </td>
                    <td className="p-3">
                      <span className="inline-flex h-7 items-center rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-700">{titleCase(facility.type || "-")}</span>
                    </td>
                    <td className="p-3 text-center font-semibold text-gray-800">{facility.capacity || "-"}</td>
                    <td className="p-3 text-center text-xs font-medium text-gray-600">
                      {facility.openingTime || "--:--"} - {facility.closingTime || "--:--"}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => void changeFacilityStatus(facility)}
                        disabled={!canEdit}
                        className="inline-flex items-center gap-3 rounded-full px-2 py-1 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={facility.isActive === false ? "Activate facility" : "Deactivate facility"}
                      >
                        <span className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${facility.isActive === false ? "bg-red-200" : "bg-emerald-200"}`}>
                          <span className={`absolute left-0 top-0 h-5 w-5 rounded-full bg-white shadow transition-transform ${facility.isActive === false ? "translate-x-0" : "translate-x-5"}`} />
                        </span>
                        <span className={`text-xs font-semibold ${facility.isActive === false ? "text-red-700" : "text-emerald-700"}`}>
                          {facility.isActive === false ? "Inactive" : "Active"}
                        </span>
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => void editFacility(facility)} disabled={!canEdit} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-700 hover:bg-blue-50 disabled:opacity-40" aria-label="Edit facility">
                          <Edit size={16} />
                        </button>
                        <button type="button" onClick={() => void removeFacility(facility)} disabled={!canDelete} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40" aria-label="Delete facility">
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="p-4 text-sm text-gray-600">
                        <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-[minmax(0,18rem)_minmax(0,18rem)]">
                          <div>
                            <p className="text-xs font-semibold uppercase text-gray-500">Description</p>
                            <p className="mt-1 leading-6">{facility.description || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-gray-500">Rules</p>
                            <p className="mt-1 leading-6">{facility.rules || "—"}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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

          <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Page {meta.page} of {meta.totalPages}</span>
              <select className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
                {[10, 20, 50].map((item) => <option key={item} value={item}>{item} / page</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" className={buttonClass} disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                <ChevronLeft size={16} />
                Prev
              </button>
              <button type="button" className={buttonClass} disabled={page >= meta.totalPages || loading} onClick={() => setPage((current) => current + 1)}>
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
