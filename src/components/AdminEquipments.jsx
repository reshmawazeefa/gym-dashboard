import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, Edit, History, Plus, Search, Trash, Upload, X, Dumbbell } from "lucide-react";
import toast from "react-hot-toast";
import TablePagination from "./TablePagination";
import StatusBadge from "./StatusBadge";
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
  "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50";

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

function formatMaintenanceDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
  const [historyEquipment, setHistoryEquipment] = useState(null);
  const [maintenanceTargetEquipmentId, setMaintenanceTargetEquipmentId] = useState("");

  useEffect(() => {
    if (!equipmentFormModalOpen && !historyEquipment) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [equipmentFormModalOpen, historyEquipment]);

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

  const openHistoryModal = async (equipment) => {
    setHistoryEquipment(equipment);
    await loadMaintenances(idOf(equipment));
  };

  const openAddMaintenanceModal = (equipment) => {
    setMaintenanceTargetEquipmentId(idOf(equipment));
    setMaintenanceEditId("");
    setMaintenanceModalEdit(null);
    setMaintenanceModalOpen(true);
  };

  const handleMaintenanceSave = async (payload, equipmentIdOverride = maintenanceTargetEquipmentId || expandedEquipmentId) => {
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
      setMaintenanceTargetEquipmentId("");
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
    <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {/* <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Gym Owner Portal / Equipment</div> */}
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Equipment Management</h1>
            <p className="mt-0.5 text-xs text-[#64748B]">Manage inventory, condition, maintenance, warranties, and equipment analytics.</p>
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

      <section className="rounded-xl border border-[#EAECF0] bg-white p-1.5 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
        <div className="flex flex-wrap gap-1">
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
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${activeView === tab.id ? "bg-[#0D8252] text-white" : "bg-white text-[#64748B] hover:bg-[#F8FAFC]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeView === "dashboard" && (
        <>
          <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            <div className="min-h-[88px] rounded-xl border border-[#EAECF0] bg-white p-3 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Total Equipment</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-[#0F172A]">{meta.total || equipments.length}</p>
              <p className="mt-1 text-[10px] text-[#94A3B8]">Records</p>
            </div>
            <div className="min-h-[88px] rounded-xl border border-[#EAECF0] bg-white p-3 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Total Quantity</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-[#0F172A]">{equipments.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)}</p>
              <p className="mt-1 text-[10px] text-[#94A3B8]">Units</p>
            </div>
            <div className="min-h-[88px] rounded-xl border border-[#EAECF0] bg-white p-3 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Total Value</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-[#0F172A]">₹{Number(dashboardData?.overview?.totalValue || 0).toLocaleString()}</p>
              <p className="mt-1 text-[10px] text-[#94A3B8]">Purchase value</p>
            </div>
            <div className="min-h-[88px] rounded-xl border border-[#EAECF0] bg-white p-3 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Active</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-[#0D8252]">{statsActive}</p>
              <p className="mt-1 text-[10px] text-[#0D8252]">{Math.round((statsActive / Math.max(1, equipments.length)) * 100) || 0}%</p>
            </div>
            <div className="min-h-[88px] rounded-xl border border-[#EAECF0] bg-white p-3 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Out of Service</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-rose-600">{equipments.filter((e) => e.status === "OUT_OF_SERVICE").length}</p>
              <p className="mt-1 text-[10px] text-[#94A3B8]">Attention</p>
            </div>
            <div className="min-h-[88px] rounded-xl border border-[#EAECF0] bg-white p-3 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Warranty Alerts</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-amber-600">{dashboardData?.warrantyAlerts?.expiringIn90Days || 0}</p>
              <p className="mt-1 text-[10px] text-[#94A3B8]">In 90 days</p>
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0F172A]">Condition Breakdown</h2>
                <button type="button" className={buttonClass} onClick={() => setActiveView("inventory")}>Full report</button>
              </div>
              <div className="space-y-3">
                {conditionOptions.map((condition) => {
                  const count = equipments.filter((item) => item.condition === condition).length;
                  const width = Math.max(4, Math.round((count / Math.max(1, equipments.length)) * 100));
                  return (
                    <div className="flex items-center gap-3" key={condition}>
                      <span className="w-24 text-xs font-medium text-gray-600">{titleCase(condition)}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-[#EEF2F4]">
                        <div className="h-1.5 rounded-full bg-[#0D8252]" style={{ width: `${width}%` }}></div>
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-gray-800">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0F172A]">Maintenance & Warranty Alerts</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-medium text-amber-700">Action required</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{Number(maintenanceOverview?.pendingMaintenance ?? maintenanceOverview?.pending ?? dashboardData?.maintenanceOverview?.pendingMaintenance ?? 0)} pending maintenance</p>
                      <p className="text-xs text-gray-500">Review upcoming service records</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-700">Pending</span>
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{Number(maintenanceOverview?.overdueMaintenance ?? maintenanceOverview?.overdue ?? dashboardData?.maintenanceOverview?.overdueMaintenance ?? 0)} overdue maintenance</p>
                      <p className="text-xs text-gray-500">Schedule service immediately</p>
                    </div>
                    <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700">Overdue</span>
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{Number(warrantyAlerts?.expiringIn90Days ?? warrantyAlerts?.expiringSoon ?? warrantyAlerts?.totalExpiring ?? 0)} warranties expiring</p>
                      <p className="text-xs text-gray-500">Within 90 days</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-medium text-blue-700">90 days</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0F172A]">Recent Maintenance</h2>
              <button type="button" className={buttonClass} onClick={() => setActiveView("maintenance")}>View All</button>
            </div>
            {recentActivityRows.length ? (
              <div className="overflow-x-auto rounded-lg border border-[#EEF2F4]">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
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
                        <td className="border-t border-[#EEF2F4] p-3 font-semibold text-[#0F172A]">{activity.equipmentName || "Equipment"}</td>
                        <td className="border-t border-[#EEF2F4] p-3 text-[#475569]">{activity.issue || "Maintenance"}</td>
                        <td className="border-t border-[#EEF2F4] p-3 text-[#475569]">{activity.date ? new Date(activity.date).toLocaleDateString() : "—"}</td>
                        <td className="border-t border-[#EEF2F4] p-3 text-[#475569]">{activity.cost ? `₹${Number(activity.cost).toLocaleString()}` : "—"}</td>
                        <td className="border-t border-[#EEF2F4] p-3">
                          <StatusBadge status={activity.status || "PENDING"} label={titleCase(activity.status || "PENDING")} />
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
        <section className="min-w-0 overflow-hidden rounded-xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <div className="min-w-0 overflow-hidden">
            <div className="grid gap-2.5 border-b border-[#EEF2F4] p-3 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_10rem] lg:items-end">
              <div className="flex h-9 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 focus-within:border-[#0D8252] focus-within:bg-white">
                <Search size={15} className="text-[#94A3B8]" />
                <input className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#94A3B8]" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search equipment..." />
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
              <table className="w-full min-w-[860px] table-auto text-left text-xs">
                <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="p-3">Equipment</th>
                    <th className="p-3">Category &amp; Condition</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Warranty</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {equipments.map((equipment) => {
                    const equipId = idOf(equipment);
                    const isExpanded = expandedEquipmentId === equipId;
                    return (
                      <Fragment key={equipId}>
                        <tr className="border-t border-[#EEF2F4] align-middle hover:bg-gray-50">
                          <td className="p-3 min-w-0">
                            <button type="button" className="block min-w-0 text-left" onClick={() => void handleToggleExpand(equipId)} aria-label={isExpanded ? "Collapse equipment details" : "Expand equipment details"}>
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="truncate font-semibold text-[#0F172A]">{equipment.name || "Unnamed"}</p>
                                <StatusBadge status={equipment.status || "UNKNOWN"} label={titleCase(equipment.status || "Unknown")} />
                              </div>
                              <p className="truncate text-[10px] text-[#94A3B8]">{equipment.serialNumber || (equipment.brand ? `${equipment.brand} ${equipment.modelNumber || ""}` : "—")}</p>
                            </button>
                          </td>
                          <td className="p-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F0FF] px-3 py-1.5 text-[10px] font-medium text-[#334155]"><span>{titleCase(equipment.category || "-")}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${equipment.condition === "GOOD" ? "bg-[#0D9F6E] text-white" : conditionTone[equipment.condition] || "bg-[#E2E8F0] text-[#334155]"}`}>{titleCase(equipment.condition || "-")}</span></span></td>
                          <td className="p-3 text-center font-semibold text-[#334155]">{equipment.quantity ?? "-"}</td>
                          <td className="p-3 font-semibold text-[#334155]">{equipment.purchasePrice ? `₹${Number(equipment.purchasePrice).toLocaleString()}` : "—"}</td>
                          <td className="p-3"><div className="relative flex flex-col items-start gap-1 pl-3 text-[10px] before:absolute before:bottom-2 before:left-0 before:top-3 before:h-[1.75rem] before:border-l before:border-[#eff2f5]"><span className="relative rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 before:absolute before:-left-3 before:top-1/2 before:w-3 before:border-t before:border-[#eff2f5]">{equipment.purchaseDate ? new Date(equipment.purchaseDate).toLocaleDateString() : "—"}</span><span className="relative rounded-md border border-rose-100 bg-rose-50 px-2 py-1 font-semibold text-rose-600 before:absolute before:-left-3 before:top-1/2 before:w-3 before:border-t before:border-[#eff2f5]">{equipment.warrantyExpiry ? new Date(equipment.warrantyExpiry).toLocaleDateString() : "—"}</span></div></td>
                          <td className="p-3 text-xs text-[#475569]">{equipment.location || "—"}</td>
                          <td className="p-3 align-middle">
                            <div className="flex flex-col items-center gap-2">
                              <button type="button" onClick={() => openAddMaintenanceModal(equipment)} disabled={!canMaintain} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-[#0D8252] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50" title="Add maintenance record"><Plus size={14} />Record</button>
                              <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={() => void openHistoryModal(equipment)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0D8252]" aria-label={`View history for ${equipment.name || "equipment"}`}><Clock3 size={15} /></button>
                              <button type="button" onClick={() => void editEquipment(equipment)} disabled={!canEdit} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40"><Edit size={15} /></button>
                              <button type="button" onClick={() => void removeEquipment(equipment)} disabled={!canDelete} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash size={15} /></button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="p-4">
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
                                    <button type="button" onClick={() => { setMaintenanceEditId(""); setMaintenanceModalEdit(null); setMaintenanceModalOpen(true); }} disabled={!canMaintain} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Plus size={14} />Add Record</button>
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
                                              <td className="p-2"><StatusBadge status={record.status || "UNKNOWN"} label={titleCase(record.status || "Unknown")} /></td>
                                              <td className="p-2 text-right"><div className="flex justify-end gap-1"><button type="button" onClick={() => handleEditMaintenance(record)} disabled={!canMaintain} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-50 disabled:opacity-40"><Edit size={15} /></button><button type="button" onClick={() => void handleDeleteMaintenance(record)} disabled={!canMaintain} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash size={13} /></button></div></td>
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
                  {!loading && !equipments.length && <tr><td colSpan={7} className="p-8 text-center text-gray-500">No equipments found.</td></tr>}
                  {loading && <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading equipments...</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-[#64748B]">
                Showing {meta.total ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, meta.total)} of {meta.total} equipment
              </span>
              <TablePagination page={page} totalPages={meta.totalPages} onPageChange={setPage} disabled={loading} className="gap-2" />
            </div>
          </div>
        </section>
      )}

      {activeView === "maintenance" && (
        <section className="overflow-hidden rounded-xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Maintenance Center</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">Track planned and completed maintenance work.</p>
            </div>
            <div className="flex w-full justify-end sm:w-auto">
              <button type="button" onClick={() => { setMaintenanceEditId(""); setMaintenanceModalEdit(null); setMaintenanceModalOpen(true); }} className={primaryButtonClass}><Plus size={16} />Add Maintenance</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-y border-[#EEF2F4] bg-[#FBFCFD] p-3 sm:grid-cols-4">
            <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Pending</p><p className="mt-1 text-lg font-extrabold tracking-tight text-amber-600">{allMaintenances.filter((m) => m.status === "PENDING").length || 0}</p></div>
            <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Completed</p><p className="mt-1 text-lg font-extrabold tracking-tight text-[#0D8252]">{allMaintenances.filter((m) => m.status === "COMPLETED").length || 0}</p></div>
            <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Cancelled</p><p className="mt-1 text-lg font-extrabold tracking-tight text-[#334155]">{allMaintenances.filter((m) => m.status === "CANCELLED").length || 0}</p></div>
            <div className="flex min-h-[100px] flex-col justify-center rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Cost</p><p className="mt-1 text-lg font-extrabold tracking-tight text-[#0F172A]">₹{allMaintenances.reduce((sum, m) => sum + (Number(m.cost) || 0), 0).toLocaleString()}</p></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] table-auto text-left text-xs">
              <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                <tr><th className="px-4 py-3">Equipment</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Next Due</th><th className="px-4 py-3 text-center">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F4]">
                {allMaintenances.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-xs text-[#64748B]">No maintenance records found.</td></tr> : allMaintenances.map((record) => (
                  <tr key={record.id || record._id} className="border-t border-[#EEF2F4] align-middle transition hover:bg-[#FBFCFD]">
                    <td className="max-w-[150px] px-4 py-2.5 font-semibold text-[#0F172A]"><span className="block truncate">{record.equipmentName || "Equipment"}</span></td>
                    <td className="max-w-[170px] px-3 py-2.5 text-[#475569]"><span className="block truncate">{record.title || "—"}</span></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#475569]">{formatMaintenanceDate(record.maintenanceDate)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-[#334155]">{record.cost ? `₹${Number(record.cost).toLocaleString()}` : "—"}</td>
                    <td className="max-w-[130px] px-3 py-2.5 text-[#475569]"><span className="block truncate">{record.vendor || "—"}</span></td>
                    <td className="px-3 py-2.5"><StatusBadge status={record.status || "UNKNOWN"} label={titleCase(record.status || "Unknown")} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#475569]">{formatMaintenanceDate(record.nextDueDate)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center gap-1">
                        <button type="button" onClick={() => handleEditMaintenance(record)} aria-label={`Edit ${record.title || "maintenance record"}`} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-blue-50 hover:text-[#0D8252] hover:bg-emerald-50"><Edit size={15} /></button>
                        <button type="button" onClick={() => void handleDeleteMaintenance(record)} aria-label={`Delete ${record.title || "maintenance record"}`} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-red-50 hover:text-red-600"><Trash size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-[#64748B]">
              Showing {allMaintenances.length ? 1 : 0} to {allMaintenances.length} of {allMaintenances.length} maintenance records
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
              <span className="rounded-lg bg-[#0D8252] px-3 py-1.5 font-bold text-white">1</span>
              <button type="button" disabled className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </div>
          </div>
        </section>
      )}

      {activeView === "reports" && (
        <section className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#EEF2F4] bg-white px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Maintenance Records</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">Detailed service records, vendor costs, and status tracking.</p>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                <label className="relative w-full sm:w-32">
                  <select className={`${inputClass} appearance-none pr-7`} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} aria-label="Filter by category">
                    <option value="">All Categories</option>
                    {categoryOptions.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                </label>
                <label className="relative w-full sm:w-32">
                  <select className={`${inputClass} appearance-none pr-7`} value={conditionFilter} onChange={(e) => { setConditionFilter(e.target.value); setPage(1); }} aria-label="Filter by condition">
                    <option value="">All Conditions</option>
                    {conditionOptions.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                </label>
                <label className="relative w-full sm:w-28">
                  <select className={`${inputClass} appearance-none pr-7`} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filter by status">
                    <option value="">All Status</option>
                    {statusOptions.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                </label>
                <button type="button" onClick={() => { setMaintenanceEditId(""); setMaintenanceModalEdit(null); setMaintenanceModalOpen(true); }} disabled={!canMaintain} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={12} />Add Record</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-auto text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                  <tr><th className="px-4 py-3">Equipment</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Due</th><th className="px-4 py-3 text-center">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F4]">
                  {allMaintenances.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-xs text-[#64748B]">No maintenance records found.</td></tr> : allMaintenances.map((record) => (
                    <tr key={record.id || record._id} className="align-middle transition hover:bg-[#FBFCFD]">
                      <td className="max-w-[145px] px-4 py-2.5 font-semibold text-[#0F172A]"><span className="block truncate">{record.equipmentName || "Equipment"}</span></td>
                      <td className="max-w-[175px] px-2.5 py-2.5 text-[#475569]"><span className="block truncate">{record.title || record.description || "Maintenance"}</span></td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-[#475569]">{formatMaintenanceDate(record.maintenanceDate)}</td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 font-semibold text-[#334155]">{record.cost ? `₹${Number(record.cost).toLocaleString()}` : "—"}</td>
                      <td className="max-w-[120px] px-2.5 py-2.5 text-[#475569]"><span className="block truncate">{record.vendor || "—"}</span></td>
                      <td className="px-2.5 py-2.5"><StatusBadge status={record.status || "UNKNOWN"} label={titleCase(record.status || "Unknown")} /></td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-[#475569]">{formatMaintenanceDate(record.nextDueDate)}</td>
                      <td className="px-2.5 py-2.5"><div className="flex justify-center gap-1"><button type="button" onClick={() => handleEditMaintenance(record)} disabled={!canMaintain} aria-label={`Edit ${record.title || "maintenance record"}`} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40"><Edit size={15} /></button><button type="button" onClick={() => void handleDeleteMaintenance(record)} disabled={!canMaintain} aria-label={`Delete ${record.title || "maintenance record"}`} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash size={13} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-[#64748B]">Showing {allMaintenances.length ? 1 : 0} to {allMaintenances.length} of {allMaintenances.length} records</span>
              <div className="flex items-center gap-2"><button type="button" disabled className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Previous</button><span className="rounded-lg bg-[#0D8252] px-3 py-1.5 font-bold text-white">1</span><button type="button" disabled className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Next</button></div>
            </div>
          </section>

          <section className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#0F172A]">Advanced Equipment Operations</h2>
              <span className="text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">Bulk + Export</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-[3fr_1fr]">
              <textarea className="min-h-24 w-full resize-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[10px] text-[#64748B] outline-none placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white" placeholder='Paste JSON payload such as {"equipment":[...]}, {"updates":[...]}, or {"ids":[...]}' value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
              <div className="grid grid-cols-2 gap-2 content-start">
                <button type="button" onClick={() => void handleBulkCreate()} className={buttonClass} disabled={bulkBusy || !canCreate}><Upload size={13} />{bulkBusy ? "Working..." : "Bulk Create"}</button>
                <button type="button" onClick={() => void handleBulkUpdate()} className={buttonClass} disabled={bulkBusy || !canEdit}><Upload size={13} />Bulk Update</button>
                <button type="button" onClick={() => void handleBulkDelete()} className={buttonClass} disabled={bulkBusy || !canDelete}><Trash size={13} />Bulk Delete</button>
                <button type="button" onClick={() => void handleExport("csv")} className={buttonClass}><Download size={13} />Export CSV</button>
              </div>
            </div>
          </section>
        </section>
      )}

      {historyEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/30 p-2 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setHistoryEquipment(null)}>
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-2rem)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><History size={18} /></div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Equipment History</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">{historyEquipment.name || "Unnamed equipment"} maintenance and inventory details.</p>
                </div>
              </div>
              <button type="button" onClick={() => setHistoryEquipment(null)} aria-label="Close equipment history" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[#EEF2F4] bg-[#F8FAFC] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Category</p><p className="mt-1 text-xs font-semibold text-[#334155]">{titleCase(historyEquipment.category || "-")}</p></div>
                <div className="rounded-lg border border-[#EEF2F4] bg-[#F8FAFC] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Condition</p><p className="mt-1 text-xs font-semibold text-[#334155]">{titleCase(historyEquipment.condition || "-")}</p></div>
                <div className="rounded-lg border border-[#EEF2F4] bg-[#F8FAFC] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Quantity</p><p className="mt-1 text-xs font-semibold text-[#334155]">{historyEquipment.quantity ?? "-"}</p></div>
                <div className="rounded-lg border border-[#EEF2F4] bg-[#F8FAFC] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Location</p><p className="mt-1 truncate text-xs font-semibold text-[#334155]">{historyEquipment.location || "-"}</p></div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[#0F172A]">Maintenance History</h3>
                <span className="text-[10px] font-semibold text-[#64748B]">{maintenances.length} record{maintenances.length === 1 ? "" : "s"}</span>
              </div>
              {maintenanceLoading ? (
                <div className="py-10 text-center text-xs text-[#64748B]">Loading history...</div>
              ) : maintenances.length === 0 ? (
                <div className="mt-2 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center text-xs text-[#64748B]">No maintenance history found for this equipment.</div>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border border-[#EEF2F4]">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]"><tr><th className="px-3 py-2.5">Title</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Cost</th><th className="px-3 py-2.5">Vendor</th><th className="px-3 py-2.5">Status</th></tr></thead>
                    <tbody className="divide-y divide-[#EEF2F4]">
                      {maintenances.map((record) => <tr key={record.id || record._id}><td className="px-3 py-2.5 font-semibold text-[#334155]">{record.title || "Maintenance"}</td><td className="px-3 py-2.5 text-[#475569]">{record.maintenanceDate ? new Date(record.maintenanceDate).toLocaleDateString() : "-"}</td><td className="px-3 py-2.5 text-[#475569]">{record.cost ? `₹${Number(record.cost).toLocaleString()}` : "-"}</td><td className="px-3 py-2.5 text-[#475569]">{record.vendor || "-"}</td><td className="px-3 py-2.5"><StatusBadge status={record.status || "UNKNOWN"} label={titleCase(record.status || "Unknown")} /></td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end border-t border-[#E2E8F0] bg-white px-5 py-4"><button type="button" onClick={() => setHistoryEquipment(null)} className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-4 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Close</button></div>
          </div>
        </div>
      )}

      {equipmentFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/30 p-2 sm:p-4">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Dumbbell size={18} /></div>
                <div>
                <h2 className="text-base font-bold text-[#0F172A]">{editingId ? "Edit Equipment" : "Create Equipment"}</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">Equipment details are saved through the equipment API.</p>
                </div>
              </div>
              <button type="button" onClick={() => { resetForm(); setEquipmentFormModalOpen(false); }} aria-label="Close equipment modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
            </div>
            <form onSubmit={submitEquipment} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Name
                  <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Treadmill Pro" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Brand
                  <input className={inputClass} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="LifeFitness" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Model Number
                  <input className={inputClass} value={form.modelNumber} onChange={(e) => setForm({ ...form, modelNumber: e.target.value })} placeholder="LF-9500" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Serial Number
                  <input className={inputClass} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-12345" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Category
                  <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {categoryOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Condition
                  <select className={inputClass} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                    {conditionOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Status
                  <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {statusOptions.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Quantity
                  <input className={inputClass} type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Purchase Date
                  <input className={inputClass} type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Purchase Price
                  <input className={inputClass} type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="2999.99" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Warranty Expiry
                  <input className={inputClass} type="date" value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#334155]">
                  Location
                  <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Floor 1 - Cardio Zone" />
                </label>
              </div>

              </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
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
          onClose={() => { setMaintenanceModalOpen(false); setMaintenanceModalEdit(null); setMaintenanceEditId(""); setMaintenanceTargetEquipmentId(""); }}
          onSave={handleMaintenanceSave}
          editData={maintenanceModalEdit}
          equipmentOptions={equipments.map((item) => ({ id: idOf(item), name: item.name, serialNumber: item.serialNumber }))}
          selectedEquipmentId={maintenanceTargetEquipmentId || expandedEquipmentId || maintenanceModalEdit?.equipmentId || ""}
        />
      )}
      </div>
    </div>
  );
}
