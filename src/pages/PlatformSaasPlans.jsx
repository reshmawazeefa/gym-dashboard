import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { ClipboardList, Code2, Plus, Search, Edit3, Trash2, X } from "lucide-react";
import {
  createSaasPlan,
  getSaasPlans,
  getSaasPlanById,
  updateSaasPlan,
  deleteSaasPlan,
  getSaasFeatures,
  createSaasFeature,
  bulkCreateSaasFeatures,
  updateSaasFeature,
  deleteSaasFeature,
  getApiError,
  unwrapList,
} from "../services/api";

const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"];

const emptyForm = {
  name: "",
  description: "",
  price: "",
  billingCycle: "MONTHLY",
  durationDays: "",
  trialDays: "",
  maxGyms: "",
  maxMembers: "",
  maxStaff: "",
  sortOrder: "",
  featureIds: [],
};

function normalisePlan(plan) {
  const features = Array.isArray(plan.features) ? plan.features : [];
  return {
    id: plan.id,
    name: plan.name || "",
    description: plan.description || "",
    price: plan.price ?? 0,
    billingCycle: plan.billingCycle || "MONTHLY",
    durationDays: plan.durationDays ?? 0,
    trialDays: plan.trialDays ?? null,
    maxGyms: plan.maxGyms ?? null,
    maxMembers: plan.maxMembers ?? null,
    maxStaff: plan.maxStaff ?? null,
    sortOrder: plan.sortOrder ?? 0,
    isActive: plan.isActive ?? true,
    features,
    featureIds: features.map((f) => f.id),
  };
}

export default function PlatformSaasPlans() {
  const [activeTab, setActiveTab] = useState("plans");

  // Plans state
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [featuresList, setFeaturesList] = useState([]);

  // Features tab state
  const [features, setFeatures] = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresSearch, setFeaturesSearch] = useState("");
  const [featuresPage, setFeaturesPage] = useState(1);
  const [featuresTotalPages, setFeaturesTotalPages] = useState(1);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [editFeature, setEditFeature] = useState(null);
  const [formFeatureName, setFormFeatureName] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkNames, setBulkNames] = useState([""]);

  const itemsPerPage = 10;

  // ---- Plans data loading ----
  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await getSaasPlans();
      const list = Array.isArray(response?.data)
        ? response.data
        : unwrapList(response);
      setPlans(list.map(normalisePlan));
      setTotalPages(Math.ceil(list.length / itemsPerPage) || 1);
    } catch (error) {
      toast.error(getApiError(error, "Failed to load SaaS plans"));
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFeatures = async () => {
    try {
      const response = await getSaasFeatures({ limit: 100 });
      const list = Array.isArray(response?.data)
        ? response.data
        : unwrapList(response);
      setFeaturesList(list);
    } catch {
      // silently handle
    }
  };

  // ---- Features tab data loading ----
  const loadFeaturesData = async (p = 1) => {
    try {
      setFeaturesLoading(true);
      const params = { page: p, limit: 10 };
      if (featuresSearch.trim()) params.search = featuresSearch.trim();
      const response = await getSaasFeatures(params);
      const data = response?.data || response;
      const list = Array.isArray(data) ? data : unwrapList(data);
      setFeatures(list);
      const meta = response?.meta || data?.meta || {};
      setFeaturesTotalPages(meta.totalPages || 1);
    } catch (error) {
      toast.error(getApiError(error, "Failed to load features"));
      setFeatures([]);
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
    loadFeatures();
  }, []);

  useEffect(() => {
    loadFeaturesData(featuresPage);
  }, [featuresPage, featuresSearch]);

  // ---- Plan CRUD handlers ----
  const openCreate = () => {
    setEditData(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = async (plan) => {
    try {
      const response = await getSaasPlanById(plan.id);
      const data = response?.data || response;
      const full = normalisePlan(data);
      setEditData(full);
      setForm({
        name: full.name,
        description: full.description || "",
        price: full.price,
        billingCycle: full.billingCycle,
        durationDays: full.durationDays,
        trialDays: full.trialDays ?? "",
        maxGyms: full.maxGyms ?? "",
        maxMembers: full.maxMembers ?? "",
        maxStaff: full.maxStaff ?? "",
        sortOrder: full.sortOrder ?? "",
        featureIds: full.featureIds,
      });
      setShowModal(true);
    } catch (error) {
      toast.error(getApiError(error, "Failed to load plan details"));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.durationDays) {
      toast.error("Name, price, and duration are required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        billingCycle: form.billingCycle,
        durationDays: Number(form.durationDays),
        trialDays: form.trialDays ? Number(form.trialDays) : undefined,
        maxGyms: form.maxGyms ? Number(form.maxGyms) : undefined,
        maxMembers: form.maxMembers ? Number(form.maxMembers) : undefined,
        maxStaff: form.maxStaff ? Number(form.maxStaff) : undefined,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
        featureIds: form.featureIds.length ? form.featureIds : undefined,
      };

      if (editData) {
        const updatePayload = {};
        for (const key of Object.keys(payload)) {
          if (JSON.stringify(payload[key]) !== JSON.stringify(editData[key])) {
            updatePayload[key] = payload[key];
          }
        }
        if (form.featureIds.length) {
          updatePayload.featureIds = form.featureIds;
        }
        await updateSaasPlan(editData.id, updatePayload);
        toast.success("SaaS plan updated");
      } else {
        await createSaasPlan(payload);
        toast.success("SaaS plan created");
      }

      setShowModal(false);
      loadPlans();
    } catch (error) {
      toast.error(getApiError(error, editData ? "Update failed" : "Creation failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete SaaS plan "${name}"?`)) return;

    try {
      await deleteSaasPlan(id);
      toast.success("SaaS plan deleted");
      loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Delete failed"));
    }
  };

  const toggleFeature = (featureId) => {
    setForm((prev) => ({
      ...prev,
      featureIds: prev.featureIds.includes(featureId)
        ? prev.featureIds.filter((id) => id !== featureId)
        : [...prev.featureIds, featureId],
    }));
  };

  // ---- Feature CRUD handlers ----
  const handleFeatureSave = async () => {
    const name = formFeatureName.trim();
    if (!name || name.length < 2) {
      toast.error("Feature name must be at least 2 characters");
      return;
    }

    try {
      if (editFeature) {
        await updateSaasFeature(editFeature.id, { name });
        toast.success("Feature updated");
      } else {
        await createSaasFeature({ name });
        toast.success("Feature created");
      }
      setShowFeatureModal(false);
      setEditFeature(null);
      setFormFeatureName("");
      loadFeaturesData(1);
      loadFeatures();
    } catch (error) {
      toast.error(getApiError(error, editFeature ? "Update failed" : "Creation failed"));
    }
  };

  const handleFeatureDelete = async (id) => {
    if (!confirm("Delete this feature?")) return;

    try {
      await deleteSaasFeature(id);
      toast.success("Feature deleted");
      loadFeaturesData(featuresPage);
      loadFeatures();
    } catch (error) {
      const msg = getApiError(error, "Unable to delete feature");
      toast.error(msg);
    }
  };

  const handleBulkCreate = async () => {
    const names = bulkNames
      .map((n) => n.trim())
      .filter((n) => n.length >= 2);

    if (names.length === 0) {
      toast.error("Enter at least one valid feature name");
      return;
    }

    try {
      const response = await bulkCreateSaasFeatures(names);
      toast.success(response?.message || "Features created");
      setShowBulkModal(false);
      setBulkNames([""]);
      loadFeaturesData(1);
      loadFeatures();
    } catch (error) {
      toast.error(getApiError(error, "Bulk create failed"));
    }
  };

  // Plans filtering
  const filtered = plans.filter((p) =>
    [p.name, p.description, p.billingCycle]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const planStart = (page - 1) * itemsPerPage;
  const paginated = filtered.slice(planStart, planStart + itemsPerPage);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "plans", label: "Plans", icon: ClipboardList },
          { key: "features", label: "Features", icon: Code2 },
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

      {/* ============== PLANS TAB ============== */}
      {activeTab === "plans" && (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">

            <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:flex-1">
              <div className="min-w-0 flex-1">
                <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow sm:max-w-xxl">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search plans..."
                    className="w-full min-w-0 text-sm outline-none"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm rounded w-full md:w-auto"
              >
                <Plus size={18} /> Add SaaS Plan
              </button>
            </div>
          </div>

          <div className="bg-white rounded shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Price</th>
                    <th className="p-3 text-left">Billing</th>
                    <th className="p-3 text-left">Duration</th>
                    <th className="p-3 text-left">Trial</th>
                    <th className="p-3 text-left">Limits</th>
                    <th className="p-3 text-left">Sort</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Features</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="text-center p-6 text-gray-500">
                        Loading plans...
                      </td>
                    </tr>
                  ) : (
                    paginated.map((p) => (
                      <tr key={p.id} className="border-t hover:bg-gray-50">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3">${Number(p.price).toFixed(2)}</td>
                        <td className="p-3">
                          <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            {p.billingCycle}
                          </span>
                        </td>
                        <td className="p-3">{p.durationDays}d</td>
                        <td className="p-3">{p.trialDays ? `${p.trialDays}d` : "-"}</td>
                        <td className="p-3 text-xs">
                          {p.maxGyms ? `G:${p.maxGyms}` : ""}
                          {p.maxMembers ? ` M:${p.maxMembers}` : ""}
                          {p.maxStaff ? ` S:${p.maxStaff}` : ""}
                          {!p.maxGyms && !p.maxMembers && !p.maxStaff ? "-" : ""}
                        </td>
                        <td className="p-3">{p.sortOrder || "-"}</td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-1 text-xs font-semibold ${
                              p.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-3 max-w-[150px] truncate" title={p.features.map((f) => f.name).join(", ")}>
                          {p.features.length
                            ? p.features.map((f) => f.name).join(", ")
                            : "-"}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={() => openEdit(p)}
                              className="text-blue-500 hover:scale-110 transition"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              className="text-red-500 hover:scale-110 transition"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan="10" className="text-center p-6 text-gray-500">
                        No SaaS plans found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-3 p-4 border-t">
              <p className="text-sm text-gray-600">
                Page {page} of {totalPages || 1}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Plan modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">
                    {editData ? "Edit SaaS Plan" : "Add SaaS Plan"}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Plan name"
                  className="w-full border p-2 mb-3"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <textarea
                  placeholder="Description (optional)"
                  className="w-full border p-2 mb-3"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="Price"
                  className="w-full border p-2 mb-3"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Cycle
                </label>
                <select
                  className="w-full border p-2 mb-3"
                  value={form.billingCycle}
                  onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                >
                  {BILLING_CYCLES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Duration (days)"
                  className="w-full border p-2 mb-3"
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="Trial days (optional)"
                  className="w-full border p-2 mb-3"
                  value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="Max gyms (optional)"
                  className="w-full border p-2 mb-3"
                  value={form.maxGyms}
                  onChange={(e) => setForm({ ...form, maxGyms: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="Max members (optional)"
                  className="w-full border p-2 mb-3"
                  value={form.maxMembers}
                  onChange={(e) => setForm({ ...form, maxMembers: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="Max staff (optional)"
                  className="w-full border p-2 mb-3"
                  value={form.maxStaff}
                  onChange={(e) => setForm({ ...form, maxStaff: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="Sort order (optional)"
                  className="w-full border p-2 mb-3"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features
                </label>
                {featuresList.length === 0 ? (
                  <p className="mb-3 text-sm text-gray-500">
                    No SaaS features available. Create features in the Features tab first.
                  </p>
                ) : (
                  <div className="mb-4 max-h-48 overflow-y-auto border rounded p-2 space-y-1">
                    {featuresList.map((feature) => (
                      <label
                        key={feature.id}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.featureIds.includes(feature.id)}
                          onChange={() => toggleFeature(feature.id)}
                          className="accent-blue-600"
                        />
                        {feature.name}
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm border rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-4 py-2 text-sm rounded disabled:opacity-60"
                  >
                    {saving ? "Saving..." : editData ? "Update" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============== FEATURES TAB ============== */}
      {activeTab === "features" && (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
            <h1 className="text-xl font-bold">SaaS Features</h1>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded bg-white p-3 shadow">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search feature..."
                  className="min-w-0 text-sm outline-none"
                  value={featuresSearch}
                  onChange={(e) => {
                    setFeaturesSearch(e.target.value);
                    setFeaturesPage(1);
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setEditFeature(null);
                  setFormFeatureName("");
                  setShowFeatureModal(true);
                }}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm rounded"
              >
                <Plus size={18} /> Add Feature
              </button>
              <button
                onClick={() => {
                  setBulkNames([""]);
                  setShowBulkModal(true);
                }}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 text-sm rounded"
              >
                <Plus size={18} /> Bulk Create
              </button>
            </div>
          </div>

          <div className="bg-white rounded shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left font-semibold">Name</th>
                    <th className="p-3 text-left font-semibold">Created At</th>
                    <th className="p-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {featuresLoading ? (
                    <tr>
                      <td colSpan="3" className="text-center p-6 text-gray-500">Loading features...</td>
                    </tr>
                  ) : (
                    features.map((feature) => (
                      <tr key={feature.id || feature._id} className="border-t hover:bg-gray-50">
                        <td className="p-3">{feature.name}</td>
                        <td className="p-3 text-gray-500">
                          {feature.createdAt
                            ? new Date(feature.createdAt).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={() => {
                                setEditFeature(feature);
                                setFormFeatureName(feature.name);
                                setShowFeatureModal(true);
                              }}
                              className="text-blue-500 hover:scale-110 transition"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={() => handleFeatureDelete(feature.id)}
                              className="text-red-500 hover:scale-110 transition"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {!featuresLoading && features.length === 0 && (
                    <tr>
                      <td colSpan="3" className="text-center p-6 text-gray-500">
                        No features found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center gap-3 p-4 border-t">
              <p className="text-sm text-gray-600">Page {featuresPage} of {featuresTotalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeaturesPage((p) => Math.max(1, p - 1))}
                  disabled={featuresPage <= 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setFeaturesPage((p) => p + 1)}
                  disabled={featuresPage >= featuresTotalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Feature add/edit modal */}
          {showFeatureModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded w-full max-w-sm">
                <h2 className="text-lg font-bold mb-4">
                  {editFeature ? "Edit Feature" : "Add Feature"}
                </h2>
                <input
                  type="text"
                  placeholder="Feature name"
                  className="w-full border p-2 mb-4"
                  value={formFeatureName}
                  onChange={(e) => setFormFeatureName(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowFeatureModal(false); setEditFeature(null); }}
                    className="px-4 py-2 text-sm border rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFeatureSave}
                    className="bg-blue-500 text-white px-4 py-2 text-sm rounded"
                  >
                    {editFeature ? "Update" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk create modal */}
          {showBulkModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">Bulk Create Features</h2>
                <p className="text-sm text-gray-500 mb-3">
                  Add feature names below. Each name must be 2-100 characters.
                </p>
                <div className="space-y-2">
                  {bulkNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Feature ${i + 1}`}
                        className="flex-1 border p-2 text-sm"
                        value={name}
                        onChange={(e) => {
                          const next = [...bulkNames];
                          next[i] = e.target.value;
                          setBulkNames(next);
                        }}
                      />
                      {bulkNames.length > 1 && (
                        <button
                          onClick={() => setBulkNames((prev) => prev.filter((_, j) => j !== i))}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setBulkNames((prev) => [...prev, ""])}
                  className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus size={16} /> Add row
                </button>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => { setShowBulkModal(false); setBulkNames([""]); }}
                    className="px-4 py-2 text-sm border rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkCreate}
                    className="bg-emerald-600 text-white px-4 py-2 text-sm rounded"
                  >
                    Create All
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
