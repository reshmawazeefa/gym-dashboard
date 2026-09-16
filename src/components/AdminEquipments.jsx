import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Edit, Plus, Search, Trash, Upload } from "lucide-react";
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
  bulkCreateEquipment,
  bulkUpdateEquipment,
  bulkDeleteEquipment,
  exportEquipment,
  getEquipmentDashboard,
  getEquipmentMaintenanceCostReport,
  getEquipmentWarrantyExpiryReport,
  getEquipmentConditionSummaryReport,
  getEquipmentUtilizationReport,
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
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [reports, setReports] = useState({ maintenance: null, warranty: null, condition: null, utilization: null });
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [allMaintenances, setAllMaintenances] = useState([]);
  const [allMaintenanceLoading, setAllMaintenanceLoading] = useState(false);
  const [equipmentFormModalOpen, setEquipmentFormModalOpen] = useState(false);

  const statsActive = useMemo(() => equipments.filter((e) => e.status === "ACTIVE").length, [equipments]);
  const statsUnderRepair = useMemo(() => equipments.filter((e) => e.condition === "DAMAGED" || e.condition === "UNDER_REPAIR").length, [equipments]);

  const dashboardPayload = dashboardData?.data || dashboardData || {};
  const dashboardOverview = dashboardPayload?.overview || {};
  const maintenanceOverview = dashboardPayload?.maintenanceOverview || dashboardPayload?.maintenance || {};
  const warrantyAlerts = dashboardPayload?.warrantyAlerts || dashboardPayload?.warranty || {};

  const recentActivityRows = useMemo(() => {
    return allMaintenances
      .slice()
      .sort((a, b) => new Date(b.maintenanceDate || b.date || b.updatedAt || b.nextDueDate || 0) - new Date(a.maintenanceDate || a.date || a.updatedAt || a.nextDueDate || 0))
      .slice(0, 5)
      .map((record) => ({
        equipmentName: record.equipmentName || "Equipment",
        issue: record.title || record.description || "Maintenance",
        date: record.maintenanceDate || record.date || record.updatedAt || record.nextDueDate || "",
        cost: record.cost ?? "",
        status: record.status || "PENDING",
      }));
  }, [allMaintenances]);

  const loadAllMaintenances = async (items = equipments) => {
    if (!items.length) {
      setAllMaintenances([]);
      return;
    }

    try {
      setAllMaintenanceLoading(true);
      const results = await Promise.allSettled(
        items.map(async (equipment) => {
          const equipmentId = idOf(equipment);
          const response = await getEquipmentMaintenances(equipmentId, user?.token);
          return unwrapMaintenances(response).map((record) => ({
            ...record,
            equipmentId,
            equipmentName: equipment.name || "Equipment",
          }));
        })
      );

      const list = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
      setAllMaintenances(list);
    } catch (error) {
      setAllMaintenances([]);
    } finally {
      setAllMaintenanceLoading(false);
    }
  };

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
      const nextEquipments = unwrapEquipments(response);
      setEquipments(nextEquipments);
      setMeta({
        total: Number(nextMeta.total || 0),
        page: Number(nextMeta.page || page),
        limit: Number(nextMeta.limit || limit),
        totalPages: Math.max(1, Number(nextMeta.totalPages || 1)),
      });
      await loadAllMaintenances(nextEquipments);
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
  }, [page, limit, categoryFilter, conditionFilter, statusFilter, search]);

  useEffect(() => {
    if (!user?.token) return;
    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

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

  const loadDashboardData = async () => {
    try {
      setReportsLoading(true);
      const [dashboardResponse, maintenanceReportResponse, warrantyReportResponse, conditionSummaryResponse, utilizationReportResponse] = await Promise.all([
        getEquipmentDashboard(user?.token),
        getEquipmentMaintenanceCostReport({ period: "monthly", months: 6 }, user?.token),
        getEquipmentWarrantyExpiryReport({ days: 90 }, user?.token),
        getEquipmentConditionSummaryReport(user?.token),
        getEquipmentUtilizationReport({ days: 30 }, user?.token),
      ]);

      setDashboardData(dashboardResponse?.data || dashboardResponse);
      setReports({
        maintenance: maintenanceReportResponse?.data || maintenanceReportResponse,
        warranty: warrantyReportResponse?.data || warrantyReportResponse,
        condition: conditionSummaryResponse?.data || conditionSummaryResponse,
        utilization: utilizationReportResponse?.data || utilizationReportResponse,
      });
    } catch (error) {
      toast.error(getApiError(error, "Unable to load equipment analytics"));
    } finally {
      setReportsLoading(false);
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
      setEquipmentFormModalOpen(false);
      void loadEquipments();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save equipment"));
    } finally {
      setSaving(false);
    }
  };

  const openEquipmentFormModal = () => {
    setActiveView("inventory");
    resetForm();
    setEquipmentFormModalOpen(true);
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
      setActiveView("inventory");
      setEquipmentFormModalOpen(true);
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

  const handleToggleExpand = async (equipmentId) => {
    if (expandedEquipmentId === equipmentId) {
      setExpandedEquipmentId("");
      setMaintenances([]);
    } else {
      setExpandedEquipmentId(equipmentId);
      await loadMaintenances(equipmentId);
    }
  };

  const handleMaintenanceSave = async (payload, equipmentIdOverride = expandedEquipmentId) => {
    if (!canMaintain) {
      toast.error("You do not have permission to manage maintenance");
      return;
    }

    const targetEquipmentId = equipmentIdOverride || expandedEquipmentId;
    if (!targetEquipmentId) {
      toast.error("Choose an equipment before saving maintenance");
      return;
    }

    try {
      if (maintenanceEditId) {
        await updateEquipmentMaintenance(maintenanceEditId, payload, user?.token);
        toast.success("Maintenance updated successfully");
      } else {
        await createEquipmentMaintenance(targetEquipmentId, payload, user?.token);
        toast.success("Maintenance created successfully");
      }
      setMaintenanceModalOpen(false);
      setMaintenanceModalEdit(null);
      setMaintenanceEditId("");
      await loadMaintenances(targetEquipmentId);
      await loadAllMaintenances(equipments);
    } catch (error) {
      toast.error(getApiError(error, "Unable to save maintenance"));
    }
  };

  const handleEditMaintenance = (record) => {
    setMaintenanceModalEdit({
      id: record.id || record._id,
      equipmentId: record.equipmentId || expandedEquipmentId,
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
      await loadAllMaintenances(equipments);
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete maintenance"));
    }
  };

  const handleBulkCreate = async () => {
    if (!canCreate) {
      toast.error("You do not have permission to bulk create equipment");
      return;
    }
    if (!bulkText.trim()) {
      toast.error("Paste equipment rows to import");
      return;
    }

    try {
      setBulkBusy(true);
      const payload = JSON.parse(bulkText);
      const response = await bulkCreateEquipment(payload, user?.token);
      toast.success(response?.message || "Bulk create completed");
      setBulkText("");
      await loadEquipments();
      await loadDashboardData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to import equipment"));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (!canEdit) {
      toast.error("You do not have permission to bulk update equipment");
      return;
    }
    if (!bulkText.trim()) {
      toast.error("Paste bulk updates to apply");
      return;
    }

    try {
      setBulkBusy(true);
      const payload = JSON.parse(bulkText);
      const response = await bulkUpdateEquipment(payload, user?.token);
      toast.success(response?.message || "Bulk update completed");
      setBulkText("");
      await loadEquipments();
      await loadDashboardData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update equipment in bulk"));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!canDelete) {
      toast.error("You do not have permission to bulk delete equipment");
      return;
    }
    if (!bulkText.trim()) {
      toast.error("Paste equipment IDs to delete");
      return;
    }

    try {
      setBulkBusy(true);
      const payload = JSON.parse(bulkText);
      const response = await bulkDeleteEquipment(payload, user?.token);
      toast.success(response?.message || "Bulk delete completed");
      setBulkText("");
      await loadEquipments();
      await loadDashboardData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete equipment in bulk"));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExport = async (format = "csv") => {
    if (!canCreate && !canEdit && !canDelete) {
      toast.error("You do not have permission to export equipment data");
      return;
    }

    try {
      const csv = await exportEquipment({ format, search: search.trim() || undefined, category: categoryFilter || undefined, condition: conditionFilter || undefined, status: statusFilter || undefined }, user?.token);
      const blob = new Blob([csv], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `equipment-export.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Equipment export downloaded");
    } catch (error) {
      toast.error(getApiError(error, "Unable to export equipment data"));
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Gym Owner Portal / Equipment</div>
            <h1 className="text-2xl font-bold text-gray-950">Equipment Management</h1>
            <p className="mt-1 text-sm text-gray-500">Manage inventory, condition, maintenance, warranties, and equipment analytics.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void handleExport("csv")} className={buttonClass}>
              <Download size={16} /> Export
            </button>
            <button type="button" onClick={() => openEquipmentFormModal()} className={primaryButtonClass}>
              <Plus size={16} /> Add Equipment
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "inventory", label: "Inventory" },
            { id: "maintenance", label: "Maintenance" },
            { id: "reports", label: "Reports" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${activeView === tab.id ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeView === "dashboard" && (
        <>
          <section className="grid gap-4 md:grid-cols-6">
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs font-medium uppercase text-gray-500">Total Equipment</p>
              <p className="mt-2 text-2xl font-bold text-gray-950">{meta.total || equipments.length}</p>
              <p className="mt-1 text-xs text-gray-500">Records</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs font-medium uppercase text-gray-500">Total Quantity</p>
              <p className="mt-2 text-2xl font-bold text-gray-950">{equipments.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)}</p>
              <p className="mt-1 text-xs text-gray-500">Units</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs font-medium uppercase text-gray-500">Total Value</p>
              <p className="mt-2 text-2xl font-bold text-gray-950">₹{Number(dashboardData?.overview?.totalValue || 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-500">Purchase value</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs font-medium uppercase text-gray-500">Active</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{statsActive}</p>
              <p className="mt-1 text-xs text-gray-500">{Math.round((statsActive / Math.max(1, equipments.length)) * 100) || 0}%</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs font-medium uppercase text-gray-500">Out of Service</p>
              <p className="mt-2 text-2xl font-bold text-red-700">{equipments.filter((e) => e.status === "OUT_OF_SERVICE").length}</p>
              <p className="mt-1 text-xs text-gray-500">Attention</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-xs font-medium uppercase text-gray-500">Warranty Alerts</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{dashboardData?.warrantyAlerts?.expiringIn90Days || 0}</p>
              <p className="mt-1 text-xs text-gray-500">In 90 days</p>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-950">Condition Breakdown</h2>
                <button type="button" className={buttonClass} onClick={() => setActiveView("inventory")}>Full report</button>
              </div>
              <div className="space-y-3">
                {conditionOptions.map((condition) => {
                  const count = equipments.filter((item) => item.condition === condition).length;
                  const width = Math.max(4, Math.round((count / Math.max(1, equipments.length)) * 100));
                  return (
                    <div className="flex items-center gap-3" key={condition}>
                      <span className="w-24 text-xs font-medium text-gray-600">{titleCase(condition)}</span>
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${width}%` }}></div>
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-gray-800">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-950">Maintenance & Warranty Alerts</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Action required</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{Number(maintenanceOverview?.pendingMaintenance ?? maintenanceOverview?.pending ?? dashboardData?.maintenanceOverview?.pendingMaintenance ?? 0)} pending maintenance</p>
                      <p className="text-xs text-gray-500">Review upcoming service records</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Pending</span>
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{Number(maintenanceOverview?.overdueMaintenance ?? maintenanceOverview?.overdue ?? dashboardData?.maintenanceOverview?.overdueMaintenance ?? 0)} overdue maintenance</p>
                      <p className="text-xs text-gray-500">Schedule service immediately</p>
                    </div>
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Overdue</span>
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{Number(warrantyAlerts?.expiringIn90Days ?? warrantyAlerts?.expiringSoon ?? warrantyAlerts?.totalExpiring ?? 0)} warranties expiring</p>
                      <p className="text-xs text-gray-500">Within 90 days</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">90 days</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-950">Recent Activity</h2>
              <button type="button" className={buttonClass} onClick={() => setActiveView("maintenance")}>Maintenance</button>
            </div>
            {recentActivityRows.length ? (
              <div className="overflow-hidden rounded-md border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Equipment</th>
                      <th className="p-3">Issue</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Cost</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivityRows.map((activity, index) => (
                      <tr key={`${activity.equipmentName}-${activity.date}-${index}`} className="border-t border-gray-100">
                        <td className="p-3 font-semibold text-gray-950">{activity.equipmentName || "Equipment"}</td>
                        <td className="p-3 text-gray-700">{activity.issue || "Maintenance"}</td>
                        <td className="p-3 text-gray-700">{activity.date ? new Date(activity.date).toLocaleDateString() : "—"}</td>
                        <td className="p-3 text-gray-700">{activity.cost ? `₹${Number(activity.cost).toLocaleString()}` : "—"}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${maintenanceStatusTone[activity.status] || "bg-emerald-100 text-emerald-700"}`}>{titleCase(activity.status || "PENDING")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No recent activity available.</p>
            )}
          </section>
        </>
      )}

      {activeView === "inventory" && (
        <section className="overflow-hidden min-w-0 rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="overflow-hidden min-w-0 rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            <div className="grid gap-4 border-b border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_10rem] lg:items-end">
              <div className="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <Search size={17} className="text-gray-400" />
                <input className="min-w-0 flex-1 text-sm outline-none" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or brand..." />
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
            </div>

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
                            <button type="button" className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 ${isExpanded ? "rotate-180" : ""}`} onClick={() => void handleToggleExpand(equipId)}>
                              <ChevronDown size={16} />
                            </button>
                          </td>
                          <td className="p-3 min-w-0">
                            <p className="truncate font-semibold text-gray-950">{equipment.name || "Unnamed"}</p>
                            {equipment.brand && <p className="truncate text-xs text-gray-500">{equipment.brand} {equipment.modelNumber ? `(${equipment.modelNumber})` : ""}</p>}
                          </td>
                          <td className="p-3"><span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${categoryTone[equipment.category] || "bg-gray-50 text-gray-700"}`}>{titleCase(equipment.category || "-")}</span></td>
                          <td className="p-3"><span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${conditionTone[equipment.condition] || "bg-gray-50 text-gray-700"}`}>{titleCase(equipment.condition || "-")}</span></td>
                          <td className="p-3 text-center font-semibold text-gray-800">{equipment.quantity ?? "-"}</td>
                          <td className="p-3"><span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${statusTone[equipment.status] || "bg-gray-100 text-gray-700"}`}>{titleCase(equipment.status || "Unknown")}</span></td>
                          <td className="p-3 text-xs text-gray-600">{equipment.location || "—"}</td>
                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => void editEquipment(equipment)} disabled={!canEdit} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-700 hover:bg-blue-50 disabled:opacity-40"><Edit size={16} /></button>
                              <button type="button" onClick={() => void removeEquipment(equipment)} disabled={!canDelete} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash size={16} /></button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="p-4">
                              <div className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-4">
                                  <div><p className="text-xs font-semibold uppercase text-gray-500">Serial Number</p><p className="mt-1 text-sm">{equipment.serialNumber || "—"}</p></div>
                                  <div><p className="text-xs font-semibold uppercase text-gray-500">Purchase Date</p><p className="mt-1 text-sm">{equipment.purchaseDate ? new Date(equipment.purchaseDate).toLocaleDateString() : "—"}</p></div>
                                  <div><p className="text-xs font-semibold uppercase text-gray-500">Purchase Price</p><p className="mt-1 text-sm">{equipment.purchasePrice ? `₹${Number(equipment.purchasePrice).toLocaleString()}` : "—"}</p></div>
                                  <div><p className="text-xs font-semibold uppercase text-gray-500">Warranty Expiry</p><p className="mt-1 text-sm">{equipment.warrantyExpiry ? new Date(equipment.warrantyExpiry).toLocaleDateString() : "—"}</p></div>
                                </div>
                                <div className="border-t border-gray-200 pt-4">
                                  <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-950">Maintenance History</h3>
                                    <button type="button" onClick={() => { setMaintenanceEditId(""); setMaintenanceModalEdit(null); setMaintenanceModalOpen(true); }} disabled={!canMaintain} className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Plus size={14} />Add Record</button>
                                  </div>
                                  {maintenanceLoading ? <p className="text-sm text-gray-500">Loading maintenance records...</p> : maintenances.length === 0 ? <p className="text-sm text-gray-500">No maintenance records found.</p> : (
                                    <div className="overflow-hidden rounded-md border border-gray-200">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-100 text-xs uppercase text-gray-500"><tr><th className="p-2">Title</th><th className="p-2">Date</th><th className="p-2">Cost</th><th className="p-2">Vendor</th><th className="p-2">Next Due</th><th className="p-2">Status</th><th className="p-2 text-right">Actions</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {maintenances.map((record) => (
                                            <tr key={record.id || record._id} className="hover:bg-white">
                                              <td className="p-2 font-medium text-gray-900">{record.title}</td>
                                              <td className="p-2 text-gray-600">{record.maintenanceDate ? new Date(record.maintenanceDate).toLocaleDateString() : "—"}</td>
                                              <td className="p-2 text-gray-600">{record.cost ? `₹${Number(record.cost).toLocaleString()}` : "—"}</td>
                                              <td className="p-2 text-gray-600">{record.vendor || "—"}</td>
                                              <td className="p-2 text-gray-600">{record.nextDueDate ? new Date(record.nextDueDate).toLocaleDateString() : "—"}</td>
                                              <td className="p-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${maintenanceStatusTone[record.status] || "bg-gray-100 text-gray-700"}`}>{titleCase(record.status || "Unknown")}</span></td>
                                              <td className="p-2 text-right"><div className="flex justify-end gap-1"><button type="button" onClick={() => handleEditMaintenance(record)} disabled={!canMaintain} className="inline-flex h-7 w-7 items-center justify-center rounded text-blue-700 hover:bg-blue-50 disabled:opacity-40"><Edit size={13} /></button><button type="button" onClick={() => void handleDeleteMaintenance(record)} disabled={!canMaintain} className="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash size={13} /></button></div></td>
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
                  {!loading && !equipments.length && <tr><td colSpan={8} className="p-8 text-center text-gray-500">No equipments found.</td></tr>}
                  {loading && <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading equipments...</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Page {meta.page} of {meta.totalPages}</span>
                <select className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                  {[10,20,50].map((item) => <option key={item} value={item}>{item} / page</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" className={buttonClass} disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} />Prev</button>
                <button type="button" className={buttonClass} disabled={page >= meta.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight size={16} /></button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeView === "maintenance" && (
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-950">Maintenance Center</h2>
              <p className="text-sm text-gray-500">Track planned and completed maintenance work.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setMaintenanceEditId(""); setMaintenanceModalEdit(null); setMaintenanceModalOpen(true); }} className={primaryButtonClass}><Plus size={16} />Add Maintenance</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-md bg-gray-50 p-3"><p className="text-xs font-semibold uppercase text-gray-500">Pending</p><p className="mt-1 text-2xl font-bold text-amber-700">{allMaintenances.filter((m) => m.status === "PENDING").length || 0}</p></div>
            <div className="rounded-md bg-gray-50 p-3"><p className="text-xs font-semibold uppercase text-gray-500">Completed</p><p className="mt-1 text-2xl font-bold text-emerald-700">{allMaintenances.filter((m) => m.status === "COMPLETED").length || 0}</p></div>
            <div className="rounded-md bg-gray-50 p-3"><p className="text-xs font-semibold uppercase text-gray-500">Cancelled</p><p className="mt-1 text-2xl font-bold text-gray-700">{allMaintenances.filter((m) => m.status === "CANCELLED").length || 0}</p></div>
            <div className="rounded-md bg-gray-50 p-3"><p className="text-xs font-semibold uppercase text-gray-500">Cost</p><p className="mt-1 text-2xl font-bold text-gray-950">₹{allMaintenances.reduce((sum, m) => sum + (Number(m.cost) || 0), 0).toLocaleString()}</p></div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                <tr><th className="p-3">Equipment</th><th className="p-3">Title</th><th className="p-3">Date</th><th className="p-3">Cost</th><th className="p-3">Vendor</th><th className="p-3">Status</th><th className="p-3">Next Due</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allMaintenances.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">No maintenance records found.</td></tr> : allMaintenances.map((record) => (
                  <tr key={record.id || record._id} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-950">{record.equipmentName || "Equipment"}</td>
                    <td className="p-3 text-gray-700">{record.title}</td>
                    <td className="p-3 text-gray-700">{record.maintenanceDate ? new Date(record.maintenanceDate).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-gray-700">{record.cost ? `₹${Number(record.cost).toLocaleString()}` : "—"}</td>
                    <td className="p-3 text-gray-700">{record.vendor || "—"}</td>
                    <td className="p-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${maintenanceStatusTone[record.status] || "bg-gray-100 text-gray-700"}`}>{titleCase(record.status || "Unknown")}</span></td>
                    <td className="p-3 text-gray-700">{record.nextDueDate ? new Date(record.nextDueDate).toLocaleDateString() : "—"}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => handleEditMaintenance(record)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-700 hover:bg-blue-50"><Edit size={16} /></button>
                        <button type="button" onClick={() => void handleDeleteMaintenance(record)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"><Trash size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeView === "reports" && (
        <section className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <div><h2 className="font-semibold text-gray-950">Maintenance Cost Report</h2><p className="text-xs text-gray-500">GET /reports/maintenance-costs</p></div>
                <select className={inputClass}><option>Monthly</option><option>Weekly</option></select>
              </div>
              <div className="rounded-md bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Total Spend</p>
                <p className="mt-1 text-2xl font-bold text-gray-950">₹{Number(reports.maintenance?.summary?.totalCost || 0).toLocaleString()}</p>
                <p className="mt-2 text-xs text-gray-500">{reports.maintenance?.summary?.count || 0} maintenance records · Avg ₹{Number(reports.maintenance?.summary?.averageCost || 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <div><h2 className="font-semibold text-gray-950">Warranty Expiry</h2><p className="text-xs text-gray-500">GET /reports/warranty-expiry</p></div>
                <select className={inputClass}><option>90 days</option><option>30 days</option></select>
              </div>
              <div className="rounded-md bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Expiring Soon</p>
                <p className="mt-1 text-2xl font-bold text-gray-950">{reports.warranty?.summary?.totalExpiring || 0}</p>
                <p className="mt-2 text-xs text-gray-500">Items within selected report period</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <h2 className="font-semibold text-gray-950">Condition & Status Summary</h2>
              <div className="mt-4 space-y-3">
                {conditionOptions.map((condition) => {
                  const count = equipments.filter((item) => item.condition === condition).length;
                  const width = Math.max(4, Math.round((count / Math.max(1, equipments.length)) * 100));
                  return (
                    <div className="flex items-center gap-3">
                      <span className="w-24 text-xs font-medium text-gray-600">{titleCase(condition)}</span>
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${width}%` }}></div>
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-gray-800">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-950">Utilization Report</h2>
                <select className={inputClass}><option>30 days</option><option>7 days</option></select>
              </div>
              <div className="rounded-md bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Overall Utilization</p>
                <p className="mt-1 text-2xl font-bold text-gray-950">{reports.utilization?.data?.overall?.utilizationRate || 0}%</p>
                <p className="mt-2 text-xs text-gray-500">{activeView ? Math.max(1, equipments.length) : 0} active equipment tracked</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-950">Advanced Equipment Operations</h2>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Bulk + Export</span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <button type="button" onClick={() => void handleBulkCreate()} className={buttonClass} disabled={bulkBusy || !canCreate}><Upload size={16} />{bulkBusy ? "Working..." : "Bulk Create"}</button>
              <button type="button" onClick={() => void handleBulkUpdate()} className={buttonClass} disabled={bulkBusy || !canEdit}><Upload size={16} />Bulk Update</button>
              <button type="button" onClick={() => void handleBulkDelete()} className={buttonClass} disabled={bulkBusy || !canDelete}><Trash size={16} />Bulk Delete</button>
              <button type="button" onClick={() => void handleExport("csv")} className={buttonClass}><Download size={16} />Export CSV</button>
            </div>
            <textarea className="mt-4 min-h-32 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder='Paste JSON payload such as {"equipment":[...]}, {"updates":[...]}, or {"ids":[...]}' value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          </section>
        </section>
      )}

      {equipmentFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-950">{editingId ? "Edit Equipment" : "Create Equipment"}</h2>
                <p className="text-xs text-gray-500">Equipment details are saved through the equipment API.</p>
              </div>
              <button type="button" onClick={() => { resetForm(); setEquipmentFormModalOpen(false); }} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">×</button>
            </div>
            <form onSubmit={submitEquipment} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Name
                  <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Treadmill Pro" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Brand
                  <input className={inputClass} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="LifeFitness" />
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
                  Quantity
                  <input className={inputClass} type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Purchase Date
                  <input className={inputClass} type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Purchase Price
                  <input className={inputClass} type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="2999.99" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Warranty Expiry
                  <input className={inputClass} type="date" value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Location
                  <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Floor 1 - Cardio Zone" />
                </label>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => { resetForm(); setEquipmentFormModalOpen(false); }} className={buttonClass}>Cancel</button>
                <button type="submit" disabled={saving || (editingId ? !canEdit : !canCreate)} className={primaryButtonClass}>
                  {saving ? "Saving..." : editingId ? "Update Equipment" : "Create Equipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {maintenanceModalOpen && (
        <EquipmentModal
          isOpen={maintenanceModalOpen}
          onClose={() => { setMaintenanceModalOpen(false); setMaintenanceModalEdit(null); setMaintenanceEditId(""); }}
          onSave={handleMaintenanceSave}
          editData={maintenanceModalEdit}
          equipmentOptions={equipments.map((item) => ({ id: idOf(item), name: item.name, serialNumber: item.serialNumber }))}
          selectedEquipmentId={expandedEquipmentId || maintenanceModalEdit?.equipmentId || ""}
        />
      )}
    </div>
  );
}
