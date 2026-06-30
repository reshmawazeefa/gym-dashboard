import { useState, useEffect, useMemo } from "react";
import { Plus, Edit, Trash, Search, BarChart3, X, Check } from "lucide-react";
import PlanModal from "../components/PlanModal";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  createMembershipPlan,
  deleteMembershipPlan,
  getMembershipPlans,
  subscribeToPlan,
  updateMembershipPlan,
  getPlanStats,
  createFeature,
  bulkCreateFeatures,
  getFeatures,
  updateFeature,
  deleteFeature,
  getApiError,
  getAuthToken,
  unwrapList,
  unwrapObject,
} from "../services/api";

function normalizePlan(plan = {}) {
  const features = Array.isArray(plan.features)
    ? plan.features
    : String(plan.features || "")
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

  return {
    id: plan.id || plan._id || plan.planId || plan.name,
    name: plan.name || "",
    price: plan.price ?? "",
    duration: plan.duration ?? "",
    description: plan.description || "",
    planType: plan.planType || "",
    features,
    featureIds: plan.featureIds || (plan.planFeatures || []).map((pf) => pf.featureId || pf.feature?.id).filter(Boolean),
    raw: plan,
  };
}

function unwrapPlan(payload) {
  if (Array.isArray(payload)) return normalizePlan(payload[0] || {});
  const objectPayload = unwrapObject(payload);
  return normalizePlan(objectPayload.plan || objectPayload.membershipPlan || objectPayload);
}

const tabs = [
  { key: "plans", label: "Plans" },
  { key: "features", label: "Features" },
  { key: "stats", label: "Stats" },
];

export default function Plans() {
  const { user } = useAuth();
  const loggedUserAccessToken = user?.accessToken || user?.token || getAuthToken();
  const isMemberPortal = user?.loginType === "member";
  const [activeTab, setActiveTab] = useState("plans");

  // Plans state
  const [plans, setPlans] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [modalKey, setModalKey] = useState(0);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [subscribingPlanId, setSubscribingPlanId] = useState(null);
  const itemsPerPage = 5;

  // Features state
  const [features, setFeatures] = useState([]);
  const [featureSearch, setFeatureSearch] = useState("");
  const [featurePage, setFeaturePage] = useState(1);
  const [featureTotalPages, setFeatureTotalPages] = useState(1);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [editFeature, setEditFeature] = useState(null);
  const [featureFormName, setFeatureFormName] = useState("");
  const [showBulkFeatureModal, setShowBulkFeatureModal] = useState(false);
  const [bulkFeatureNames, setBulkFeatureNames] = useState([""]);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Stats state
  const [statsPlanId, setStatsPlanId] = useState("");
  const [planStats, setPlanStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await getMembershipPlans({}, loggedUserAccessToken);
        const apiPlans = unwrapList(response).map(normalizePlan);
        setPlans(apiPlans);
      } catch (error) {
        console.warn("Unable to load membership plans:", error);
        setPlans([]);
      }
    };

    loadPlans();
  }, [loggedUserAccessToken]);

  // Load features
  const loadFeatures = async (page = 1) => {
    try {
      setFeaturesLoading(true);
      const params = { page, limit: 10 };
      if (featureSearch.trim()) params.search = featureSearch.trim();
      const response = await getFeatures(params, loggedUserAccessToken);
      const data = response?.data || response;
      const list = Array.isArray(data) ? data : unwrapList(data);
      setFeatures(list);
      const meta = response?.meta || data?.meta || {};
      setFeatureTotalPages(meta.totalPages || 1);
    } catch (error) {
      console.warn("Unable to load features:", error);
      setFeatures([]);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const loadAllFeatures = async () => {
    try {
      const response = await getFeatures({ limit: 100 }, loggedUserAccessToken);
      const data = response?.data || response;
      const list = Array.isArray(data) ? data : unwrapList(data);
      if (list.length) setFeatures(list);
    } catch {
      // silently handle — features list stays as-is
    }
  };

  useEffect(() => {
    if (activeTab === "features") {
      loadFeatures(featurePage);
    } else if (activeTab === "plans") {
      loadAllFeatures();
    }
  }, [activeTab, featurePage, featureSearch, loggedUserAccessToken]);

  // Plan CRUD
  const saveData = async (data) => {
    const planName = data.name?.trim().toLowerCase();
    const editingPlanId = editData?.id || editData?._id;
    const duplicate = plans.some(
      (p) =>
        p.name?.trim().toLowerCase() === planName &&
        (!editData || (p.id || p._id) !== editingPlanId)
    );

    if (duplicate) {
      toast.error("Plan name must be unique");
      return;
    }

    let updated;

    const payload = {
      name: data.name,
      price: Number(data.price),
      duration: Number(data.duration),
      description: data.description,
      planType: data.planType,
      featureIds: data.featureIds,
    };

    if (editData) {
      try {
        const response = await updateMembershipPlan(editingPlanId, payload, loggedUserAccessToken);
        const apiPlan = unwrapPlan(response);
        updated = plans.map((p) =>
          p.id === editingPlanId ? { ...p, ...apiPlan } : p
        );
        toast.success("Plan updated");
      } catch (error) {
        toast.error(getApiError(error, "Plan update failed"));
        return;
      }
    } else {
      try {
        const response = await createMembershipPlan(payload, loggedUserAccessToken);
        const apiPlan = unwrapPlan(response);
        updated = [
          ...plans,
          apiPlan.id ? apiPlan : normalizePlan({ id: Date.now(), ...payload }),
        ];
        toast.success("Plan created");
      } catch (error) {
        toast.error(getApiError(error, "Plan creation failed"));
        return;
      }
    }

    setPlans(updated);
    setEditData(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this plan?")) return;

    try {
      await deleteMembershipPlan(id, loggedUserAccessToken);
      setPlans((prev) => prev.filter((p) => p.id !== id));
      toast.success("Plan deleted");
    } catch (error) {
      toast.error(getApiError(error, "Plan delete failed"));
    }
  };

  const getUserId = (u) =>
    u?.id || u?._id || u?.userId || u?.memberId || "";
  const loggedUserId = getUserId(user);

  const handleSubscribe = async (planId) => {
    if (!loggedUserId) {
      toast.error("Unable to subscribe without a valid user ID");
      return;
    }

    try {
      setSubscribingPlanId(planId);
      await subscribeToPlan(loggedUserId, planId, loggedUserAccessToken);
      toast.success("Subscribed to plan successfully");
    } catch (error) {
      toast.error(getApiError(error, "Subscription failed"));
    } finally {
      setSubscribingPlanId(null);
    }
  };

  // Plan search & pagination
  const filtered = plans.filter((p) =>
    [p.name, p.planType, p.description, ...(p.features || [])]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);

  // Feature CRUD
  const handleSaveFeature = async () => {
    const name = featureFormName.trim();
    if (!name || name.length < 2) {
      toast.error("Feature name must be at least 2 characters");
      return;
    }

    try {
      if (editFeature) {
        await updateFeature(editFeature.id, { name }, loggedUserAccessToken);
        toast.success("Feature updated");
      } else {
        await createFeature({ name }, loggedUserAccessToken);
        toast.success("Feature created");
      }
      setShowFeatureModal(false);
      setEditFeature(null);
      setFeatureFormName("");
      loadFeatures(featurePage);
    } catch (error) {
      toast.error(getApiError(error, editFeature ? "Feature update failed" : "Feature creation failed"));
    }
  };

  const handleBulkCreateFeatures = async () => {
    const names = bulkFeatureNames
      .map((n) => n.trim())
      .filter((n) => n.length >= 2);

    if (names.length === 0) {
      toast.error("Enter at least one valid feature name");
      return;
    }

    try {
      const response = await bulkCreateFeatures(names, loggedUserAccessToken);
      const msg = response?.message || "Features created";
      toast.success(msg);
      setShowBulkFeatureModal(false);
      setBulkFeatureNames([""]);
      loadFeatures(1);
    } catch (error) {
      toast.error(getApiError(error, "Bulk create failed"));
    }
  };

  const handleDeleteFeature = async (id) => {
    if (!confirm("Delete this feature?")) return;

    try {
      await deleteFeature(id, loggedUserAccessToken);
      toast.success("Feature deleted");
      loadFeatures(featurePage);
    } catch (error) {
      const msg = getApiError(error, "Unable to delete feature");
      toast.error(msg);
    }
  };

  const openFeatureModal = (feature = null) => {
    setEditFeature(feature);
    setFeatureFormName(feature ? feature.name : "");
    setShowFeatureModal(true);
  };

  // Stats
  const loadPlanStats = async (planId) => {
    if (!planId) {
      setPlanStats(null);
      return;
    }

    try {
      setStatsLoading(true);
      setStatsPlanId(planId);
      const response = await getPlanStats(planId, loggedUserAccessToken);
      setPlanStats(response?.data || response);
    } catch (error) {
      setPlanStats(null);
      toast.error(getApiError(error, "Unable to load plan stats"));
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`h-10 rounded-t-md px-4 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== PLANS TAB ===== */}
      {activeTab === "plans" && (
        <>
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
            <h1 className="text-xl font-bold">Plans</h1>
            <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:flex-1">
              <div className="min-w-0 flex-1">
                <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow sm:max-w-xxl">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search plan..."
                    className="w-full min-w-0 text-sm outline-none"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  setEditData(null);
                  setModalKey((key) => key + 1);
                  setIsOpen(true);
                }}
                className="flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm rounded w-full md:w-auto"
              >
                <Plus size={18} /> Add Plan
              </button>
            </div>
          </div>

          {/* Member View */}
          {isMemberPortal ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginated.map((p) => (
                <div key={p.id || p.name} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-950">{p.name}</h2>
                      <p className="mt-2 text-sm text-gray-600">{p.description || "Membership plan details."}</p>
                    </div>
                    {p.planType && (
                      <span className="whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-600">
                        {p.planType}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">Price</span>
                      <span>₹{p.price}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">Duration</span>
                      <span>{p.duration} days</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Features</span>
                      <p className="mt-1 text-gray-600">{(p.features || []).join(", ") || "No features listed."}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleSubscribe(p.id)}
                    disabled={subscribingPlanId === p.id}
                    className="mt-6 w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {subscribingPlanId === p.id ? "Subscribing..." : "Subscribe"}
                  </button>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">
                  No plans found
                </div>
              )}
            </div>
          ) : (
            /* Admin View */
            <div className="bg-white rounded shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm md:text-base">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left text-sm font-semibold">Name</th>
                      <th className="p-3 text-left text-sm font-semibold">Price</th>
                      <th className="p-3 text-left text-sm font-semibold">Duration</th>
                      <th className="p-3 text-left text-sm font-semibold">Type</th>
                      <th className="p-3 text-left text-sm font-semibold">Features</th>
                      <th className="p-3 text-center text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((p) => (
                      <tr key={p.id || p.name} className="border-t hover:bg-gray-50">
                        <td className="p-3 text-sm">{p.name}</td>
                        <td className="p-3 text-sm">₹{p.price}</td>
                        <td className="p-3 text-sm">{p.duration} days</td>
                        <td className="p-3 text-sm">{p.planType || "-"}</td>
                        <td className="p-3 text-sm">{(p.features || []).join(", ") || "-"}</td>
                        <td className="p-3">
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={() => {
                                setEditData(p);
                                setModalKey((key) => key + 1);
                                setIsOpen(true);
                              }}
                              className="text-blue-500 hover:scale-110 transition"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => void handleDelete(p.id)}
                              className="text-red-500 hover:scale-110 transition"
                            >
                              <Trash size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center p-6 text-gray-500">
                          No plans found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-3 p-4 border-t">
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages || 1}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Plan Modal */}
          <PlanModal
            key={modalKey}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            onSave={saveData}
            editData={editData}
            featuresList={features}
          />
        </>
      )}

      {/* ===== FEATURES TAB ===== */}
      {activeTab === "features" && (
        <div className="space-y-4">
          {/* Features Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
            <h1 className="text-xl font-bold">Features</h1>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded bg-white p-3 shadow">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search feature..."
                  className="min-w-0 text-sm outline-none"
                  value={featureSearch}
                  onChange={(e) => {
                    setFeatureSearch(e.target.value);
                    setFeaturePage(1);
                  }}
                />
              </div>
              <button
                onClick={() => openFeatureModal()}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm rounded"
              >
                <Plus size={18} /> Add Feature
              </button>
              <button
                onClick={() => {
                  setBulkFeatureNames([""]);
                  setShowBulkFeatureModal(true);
                }}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 text-sm rounded"
              >
                <Plus size={18} /> Bulk Create
              </button>
            </div>
          </div>

          {/* Features Table */}
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
                              onClick={() => openFeatureModal(feature)}
                              className="text-blue-500 hover:scale-110 transition"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => void handleDeleteFeature(feature.id)}
                              className="text-red-500 hover:scale-110 transition"
                            >
                              <Trash size={18} />
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

            {/* Feature Pagination */}
            <div className="flex justify-between items-center gap-3 p-4 border-t">
              <p className="text-sm text-gray-600">Page {featurePage} of {featureTotalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeaturePage((p) => Math.max(1, p - 1))}
                  disabled={featurePage <= 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setFeaturePage((p) => p + 1)}
                  disabled={featurePage >= featureTotalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Feature Modal (Single) */}
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
                  value={featureFormName}
                  onChange={(e) => setFeatureFormName(e.target.value)}
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
                    onClick={handleSaveFeature}
                    className="bg-blue-500 text-white px-4 py-2 text-sm rounded"
                  >
                    {editFeature ? "Update" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Create Modal */}
          {showBulkFeatureModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">Bulk Create Features</h2>
                <p className="text-sm text-gray-500 mb-3">
                  Add feature names below. Each name must be 2-100 characters.
                </p>
                <div className="space-y-2">
                  {bulkFeatureNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Feature ${i + 1}`}
                        className="flex-1 border p-2 text-sm"
                        value={name}
                        onChange={(e) => {
                          const next = [...bulkFeatureNames];
                          next[i] = e.target.value;
                          setBulkFeatureNames(next);
                        }}
                      />
                      {bulkFeatureNames.length > 1 && (
                        <button
                          onClick={() => setBulkFeatureNames((prev) => prev.filter((_, j) => j !== i))}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setBulkFeatureNames((prev) => [...prev, ""])}
                  className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus size={16} /> Add row
                </button>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => { setShowBulkFeatureModal(false); setBulkFeatureNames([""]); }}
                    className="px-4 py-2 text-sm border rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkCreateFeatures}
                    className="bg-emerald-600 text-white px-4 py-2 text-sm rounded"
                  >
                    Create All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== STATS TAB ===== */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Plan Stats</h1>

          <div className="flex flex-wrap items-center gap-3">
            <select
              className="border p-2 rounded text-sm min-w-[200px]"
              value={statsPlanId}
              onChange={(e) => loadPlanStats(e.target.value)}
            >
              <option value="">Select a plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {statsLoading && <span className="text-sm text-gray-500">Loading...</span>}
          </div>

          {planStats && !statsLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Plan Name</p>
                <p className="text-lg font-semibold text-gray-950 mt-1">{planStats.planName || "-"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Total Subscribers</p>
                <p className="text-lg font-semibold text-gray-950 mt-1">{planStats.totalSubscribers ?? 0}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Active Subscribers</p>
                <p className="text-lg font-semibold text-emerald-700 mt-1">{planStats.activeSubscribers ?? 0}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Expired Subscribers</p>
                <p className="text-lg font-semibold text-gray-500 mt-1">{planStats.expiredSubscribers ?? 0}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-lg font-semibold text-gray-950 mt-1">₹{planStats.totalRevenue ?? 0}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Monthly Revenue</p>
                <p className="text-lg font-semibold text-blue-700 mt-1">₹{planStats.monthlyRevenue ?? 0}</p>
              </div>
            </div>
          )}

          {!statsPlanId && !statsLoading && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
              Select a plan to view its statistics.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
