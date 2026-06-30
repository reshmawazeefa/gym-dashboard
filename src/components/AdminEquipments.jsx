import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Edit, Plus, RefreshCw, Search, Trash } from "lucide-react";
import toast from "react-hot-toast";
import {
  getApiError,
  getEquipments,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getEquipmentMaintenances,
  createEquipmentMaintenance,
  updateEquipmentMaintenance,
  deleteEquipmentMaintenance,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/rbac";
import EquipmentModal from "./EquipmentModal";

const categoryOptions = ["CARDIO", "STRENGTH", "MACHINE", "FREE_WEIGHT", "ACCESSORY", "OTHER"];
const conditionOptions = ["EXCELLENT", "GOOD", "FAIR", "DAMAGED", "UNDER_REPAIR"];
const statusOptions = ["ACTIVE", "INACTIVE", "OUT_OF_SERVICE"];
const categoryTone = {
  CARDIO: "bg-rose-50 text-rose-700",
  STRENGTH: "bg-blue-50 text-blue-700",
  MACHINE: "bg-purple-50 text-purple-700",
  FREE_WEIGHT: "bg-amber-50 text-amber-700",
  ACCESSORY: "bg-teal-50 text-teal-700",
  OTHER: "bg-gray-50 text-gray-700",
};

const conditionTone = {
  EXCELLENT: "bg-emerald-50 text-emerald-700",
  GOOD: "bg-blue-50 text-blue-700",
  FAIR: "bg-amber-50 text-amber-700",
  DAMAGED: "bg-red-50 text-red-700",
  UNDER_REPAIR: "bg-orange-50 text-orange-700",
};

const statusTone = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-gray-100 text-gray-700",
  OUT_OF_SERVICE: "bg-red-100 text-red-700",
};

const maintenanceStatusTone = {
  PENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

const emptyForm = {
  name: "",
  brand: "",
  modelNumber: "",
  serialNumber: "",
  category: "CARDIO",
  purchaseDate: "",
  purchasePrice: "",
  condition: "GOOD",
  quantity: 1,
  status: "ACTIVE",
  location: "",
  warrantyExpiry: "",
};

const inputClass =
  "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

function idOf(item) {
  return item?.id || item?._id || "";
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function unwrapEquipments(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.equipments)) return payload.equipments;
  if (Array.isArray(payload?.data?.equipments)) return payload.data.equipments;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function unwrapMaintenances(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.maintenances)) return payload.maintenances;
  if (Array.isArray(payload?.data?.maintenances)) return payload.data.maintenances;
  return [];
}

function unwrapMeta(payload, fallback) {
  return payload?.meta || payload?.data?.meta || fallback;
}

function normalizeFormValue(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

function toLocalDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export default function AdminEquipments() {
  const { user } = useAuth();
  const canCreate = canAccess(user, "equipments", "create");
  const canEdit = canAccess(user, "equipments", "edit");
  const canDelete = canAccess(user, "equipments", "delete");
  const canMaintain = canAccess(user, "equipments", "maintenance");

  const [equipments, setEquipments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [expandedEquipmentId, setExpandedEquipmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  const [maintenances, setMaintenances] = useState([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceEditId, setMaintenanceEditId] = useState("");
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceModalEdit, setMaintenanceModalEdit] = useState(null);

  const statsActive = useMemo(() => equipments.filter((e) => e.status === "ACTIVE").length, [equipments]);
  const statsUnderRepair = useMemo(() => equipments.filter((e) => e.condition === "DAMAGED" || e.condition === "UNDER_REPAIR").length, [equipments]);

  const loadEquipments = async () => {
    try {
      setLoading(true);
      const response = await getEquipments(
        {
          page,
          limit,
          search: search.trim() || undefined,
          category: categoryFilter || undefined,
          condition: conditionFilter || undefined,
          status: statusFilter || undefined,
        },
        user?.token
      );
      const nextMeta = unwrapMeta(response, { total: 0, page, limit, totalPages: 1 });
      setEquipments(unwrapEquipments(response));
      setMeta({
        total: Number(nextMeta.total || 0),
        page: Number(nextMeta.page || page),
        limit: Number(nextMeta.limit || limit),
        totalPages: Math.max(1, Number(nextMeta.totalPages || 1)),
      });
    } catch (error) {
      setEquipments([]);
      toast.error(getApiError(error, "Unable to load equipments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEquipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, categoryFilter, conditionFilter, statusFilter]);

  const loadMaintenances = async (equipmentId) => {
    if (!equipmentId) return;
    try {
      setMaintenanceLoading(true);
      const response = await getEquipmentMaintenances(equipmentId, user?.token);
      setMaintenances(unwrapMaintenances(response));
    } catch (error) {
      setMaintenances([]);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const submitEquipment = async (event) => {
    event.preventDefault();
    if ((editingId && !canEdit) || (!editingId && !canCreate)) {
      toast.error("You do not have permission to save equipments");
      return;
    }
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Equipment name is required (min 2 characters)");
      return;
    }
    if (form.condition === "DAMAGED" && form.status === "ACTIVE") {
      toast.error("Damaged equipment cannot be active");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        brand: normalizeFormValue(form.brand.trim()) || undefined,
        modelNumber: normalizeFormValue(form.modelNumber.trim()) || undefined,
        serialNumber: normalizeFormValue(form.serialNumber.trim()) || undefined,
        category: form.category,
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        condition: form.condition,
        quantity: Number(form.quantity),
        status: form.status,
        location: normalizeFormValue(form.location.trim()) || undefined,
        warrantyExpiry: form.warrantyExpiry ? new Date(form.warrantyExpiry).toISOString() : undefined,
      };

      if (editingId) {
        await updateEquipment(editingId, payload, user?.token);
        toast.success("Equipment updated successfully");
      } else {
        await createEquipment(payload, user?.token);
        toast.success("Equipment created successfully");
      }
      resetForm();
      void loadEquipments();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save equipment"));
    } finally {
      setSaving(false);
    }
  };

  const editEquipment = async (equipment) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit equipments");
      return;
    }

    try {
      const equipmentId = idOf(equipment);
      const response = await getEquipmentById(equipmentId, user?.token);
      const detail = response?.data || response;
      const nextEquipment = detail?.equipment || detail || equipment;
      setEditingId(equipmentId);
      setForm({
        name: nextEquipment.name || "",
        brand: nextEquipment.brand || "",
        modelNumber: nextEquipment.modelNumber || "",
        serialNumber: nextEquipment.serialNumber || "",
        category: nextEquipment.category || "CARDIO",
        purchaseDate: toLocalDate(nextEquipment.purchaseDate),
        purchasePrice: nextEquipment.purchasePrice ?? "",
        condition: nextEquipment.condition || "GOOD",
        quantity: nextEquipment.quantity ?? 1,
        status: nextEquipment.status || "ACTIVE",
        location: nextEquipment.location || "",
        warrantyExpiry: toLocalDate(nextEquipment.warrantyExpiry),
      });
    } catch (error) {
      toast.error(getApiError(error, "Unable to load equipment details"));
    }
  };

  const removeEquipment = async (equipment) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete equipments");
      return;
    }
    if (!confirm("Delete this equipment?")) return;

    try {
      await deleteEquipment(idOf(equipment), user?.token);
      toast.success("Equipment deleted successfully");
      void loadEquipments();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete equipment"));
    }
  };

  const applySearch = (event) => {
    event.preventDefault();
    if (page === 1) {
      void loadEquipments();
    } else {
      setPage(1);
    }
  };

  const handleToggleExpand = async (equipmentId) => {
    if (expandedEquipmentId === equipmentId) {
      setExpandedEquipmentId("");
      setMaintenances([]);
    } else {
      setExpandedEquipmentId(equipmentId);
      await loadMaintenances(equipmentId);
    }
  };

  const handleMaintenanceSave = async (payload) => {
    if (!canMaintain) {
      toast.error("You do not have permission to manage maintenance");
      return;
    }
    if (!expandedEquipmentId) return;
    try {
      if (maintenanceEditId) {
        await updateEquipmentMaintenance(maintenanceEditId, payload, user?.token);
        toast.success("Maintenance updated successfully");
      } else {
        await createEquipmentMaintenance(expandedEquipmentId, payload, user?.token);
        toast.success("Maintenance created successfully");
      }
      setMaintenanceModalOpen(false);
      setMaintenanceModalEdit(null);
      await loadMaintenances(expandedEquipmentId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to save maintenance"));
    }
  };

  const handleEditMaintenance = (record) => {
    setMaintenanceModalEdit({
      id: record.id || record._id,
      title: record.title || "",
      description: record.description || "",
      maintenanceDate: toLocalDate(record.maintenanceDate),
      cost: record.cost ?? "",
      vendor: record.vendor || "",
      nextDueDate: toLocalDate(record.nextDueDate),
      status: record.status || "PENDING",
    });
    setMaintenanceEditId(record.id || record._id);
    setMaintenanceModalOpen(true);
  };

  const handleDeleteMaintenance = async (record) => {
    if (!canMaintain) {
      toast.error("You do not have permission to manage maintenance");
      return;
    }
    if (!confirm("Delete this maintenance record?")) return;
    try {
      await deleteEquipmentMaintenance(record.id || record._id, user?.token);
      toast.success("Maintenance deleted successfully");
      await loadMaintenances(expandedEquipmentId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete maintenance"));
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white">
              <Dumbbell size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-950">Equipment Management</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                Manage gym equipment inventory, track condition, and log maintenance records.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void loadEquipments()} className={buttonClass}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Equipment</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{meta.total || equipments.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Active</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{statsActive}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-gray-500">Damaged / Under Repair</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{statsUnderRepair}</p>
        </div>
      </section>

      <section className="grid gap-6 items-start xl:grid-cols-[20rem_minmax(0,1fr)]">
        <form onSubmit={submitEquipment} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 xl:max-w-[22rem]">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-950">{editingId ? "Edit Equipment" : "Create Equipment"}</h2>
            <p className="mt-1 text-sm text-gray-500">Equipment details are saved to the equipment API.</p>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Name
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Treadmill Pro" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Brand
                <input className={inputClass} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="LifeFitness" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Quantity
                <input className={inputClass} type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Model Number
                <input className={inputClass} value={form.modelNumber} onChange={(e) => setForm({ ...form, modelNumber: e.target.value })} placeholder="LF-9500" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Serial Number
                <input className={inputClass} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-12345" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Category
                <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categoryOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Condition
                <select className={inputClass} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                  {conditionOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Status
                <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {statusOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Purchase Price
                <input className={inputClass} type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="2999.99" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Purchase Date
                <input className={inputClass} type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Warranty Expiry
                <input className={inputClass} type="date" value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Location
              <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Floor 1 - Cardio Zone" />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" className={primaryButtonClass} disabled={saving || (editingId ? !canEdit : !canCreate)}>
              {saving ? "Saving..." : editingId ? "Update Equipment" : "Create Equipment"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className={buttonClass}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="overflow-hidden min-w-0 rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <form onSubmit={applySearch} className="grid gap-4 border-b border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_10rem] lg:items-end">
            <div className="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <Search size={17} className="text-gray-400" />
              <input className="min-w-0 flex-1 text-sm outline-none" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or brand..." />
            </div>
            <select className={inputClass} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="">All Categories</option>
              {categoryOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
            </select>
            <select className={inputClass} value={conditionFilter} onChange={(e) => { setConditionFilter(e.target.value); setPage(1); }}>
              <option value="">All Conditions</option>
              {conditionOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
            </select>
            <select className={inputClass} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Status</option>
              {statusOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
            </select>
            <button type="submit" className={buttonClass}>Search</button>
          </form>

          <div className="overflow-hidden">
            <table className="w-full min-w-0 table-auto text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3"></th>
                  <th className="p-3">Equipment</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Location</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {equipments.map((equipment) => {
                  const equipId = idOf(equipment);
                  const isExpanded = expandedEquipmentId === equipId;
                  return (
                    <Fragment key={equipId}>
                      <tr className="align-middle hover:bg-gray-50">
                        <td className="p-3 text-center align-middle">
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 ${isExpanded ? "rotate-180" : ""}`}
                            onClick={() => void handleToggleExpand(equipId)}
                            aria-label={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </td>
                        <td className="p-3 min-w-0">
                          <p className="truncate font-semibold text-gray-950">{equipment.name || "Unnamed"}</p>
                          {equipment.brand && <p className="truncate text-xs text-gray-500">{equipment.brand} {equipment.modelNumber ? `(${equipment.modelNumber})` : ""}</p>}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${categoryTone[equipment.category] || "bg-gray-50 text-gray-700"}`}>
                            {titleCase(equipment.category || "-")}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${conditionTone[equipment.condition] || "bg-gray-50 text-gray-700"}`}>
                            {titleCase(equipment.condition || "-")}
                          </span>
                        </td>
                        <td className="p-3 text-center font-semibold text-gray-800">{equipment.quantity ?? "-"}</td>
                        <td className="p-3">
                          <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${statusTone[equipment.status] || "bg-gray-100 text-gray-700"}`}>
                            {titleCase(equipment.status || "Unknown")}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-gray-600">{equipment.location || "—"}</td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => void editEquipment(equipment)} disabled={!canEdit} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-700 hover:bg-blue-50 disabled:opacity-40" aria-label="Edit equipment">
                              <Edit size={16} />
                            </button>
                            <button type="button" onClick={() => void removeEquipment(equipment)} disabled={!canDelete} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40" aria-label="Delete equipment">
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="p-4">
                            <div className="space-y-4">
                              <div className="grid gap-4 sm:grid-cols-4">
                                <div>
                                  <p className="text-xs font-semibold uppercase text-gray-500">Serial Number</p>
                                  <p className="mt-1 text-sm">{equipment.serialNumber || "—"}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase text-gray-500">Purchase Date</p>
                                  <p className="mt-1 text-sm">{equipment.purchaseDate ? new Date(equipment.purchaseDate).toLocaleDateString() : "—"}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase text-gray-500">Purchase Price</p>
                                  <p className="mt-1 text-sm">{equipment.purchasePrice ? `₹${Number(equipment.purchasePrice).toLocaleString()}` : "—"}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase text-gray-500">Warranty Expiry</p>
                                  <p className="mt-1 text-sm">{equipment.warrantyExpiry ? new Date(equipment.warrantyExpiry).toLocaleDateString() : "—"}</p>
                                </div>
                              </div>

                              <div className="border-t border-gray-200 pt-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <h3 className="text-sm font-semibold text-gray-950">Maintenance History</h3>
                                  <button
                                    type="button"
                                    onClick={() => { setMaintenanceEditId(""); setMaintenanceModalEdit(null); setMaintenanceModalOpen(true); }}
                                    disabled={!canMaintain}
                                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <Plus size={14} />
                                    Add Record
                                  </button>
                                </div>
                                {maintenanceLoading ? (
                                  <p className="text-sm text-gray-500">Loading maintenance records...</p>
                                ) : maintenances.length === 0 ? (
                                  <p className="text-sm text-gray-500">No maintenance records found.</p>
                                ) : (
                                  <div className="overflow-hidden rounded-md border border-gray-200">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                                        <tr>
                                          <th className="p-2">Title</th>
                                          <th className="p-2">Date</th>
                                          <th className="p-2">Cost</th>
                                          <th className="p-2">Vendor</th>
                                          <th className="p-2">Next Due</th>
                                          <th className="p-2">Status</th>
                                          <th className="p-2 text-right">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {maintenances.map((record) => (
                                          <tr key={record.id || record._id} className="hover:bg-white">
                                            <td className="p-2 font-medium text-gray-900">{record.title}</td>
                                            <td className="p-2 text-gray-600">{record.maintenanceDate ? new Date(record.maintenanceDate).toLocaleDateString() : "—"}</td>
                                            <td className="p-2 text-gray-600">{record.cost ? `₹${Number(record.cost).toLocaleString()}` : "—"}</td>
                                            <td className="p-2 text-gray-600">{record.vendor || "—"}</td>
                                            <td className="p-2 text-gray-600">{record.nextDueDate ? new Date(record.nextDueDate).toLocaleDateString() : "—"}</td>
                                            <td className="p-2">
                                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${maintenanceStatusTone[record.status] || "bg-gray-100 text-gray-700"}`}>
                                                {titleCase(record.status || "Unknown")}
                                              </span>
                                            </td>
                                            <td className="p-2 text-right">
                                              <div className="flex justify-end gap-1">
                                                <button type="button" onClick={() => handleEditMaintenance(record)} disabled={!canMaintain} className="inline-flex h-7 w-7 items-center justify-center rounded text-blue-700 hover:bg-blue-50 disabled:opacity-40" aria-label="Edit maintenance">
                                                  <Edit size={13} />
                                                </button>
                                                <button type="button" onClick={() => void handleDeleteMaintenance(record)} disabled={!canMaintain} className="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50 disabled:opacity-40" aria-label="Delete maintenance">
                                                  <Trash size={13} />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!loading && !equipments.length && (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-500">No equipments found.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading equipments...</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Page {meta.page} of {meta.totalPages}</span>
              <select className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
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

      {maintenanceModalOpen && (
        <EquipmentModal
          isOpen={maintenanceModalOpen}
          onClose={() => { setMaintenanceModalOpen(false); setMaintenanceModalEdit(null); setMaintenanceEditId(""); }}
          onSave={handleMaintenanceSave}
          editData={maintenanceModalEdit}
        />
      )}
    </div>
  );
}
