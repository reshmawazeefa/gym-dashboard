import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Edit, Trash, Search, BarChart3, Download, X, Check, CreditCard, Layers3, Users, Link2, HandCoins, Copy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PlanModal from "../components/PlanModal";
import StatusBadge from "../components/StatusBadge";
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

const managementTabs = [
  { key: "plans", label: "Plans" },
  { key: "features", label: "Features" },
  { key: "stats", label: "Stats" },
];

function CreatePaymentLinkModal({ plans, onClose }) {
  const [planId, setPlanId] = useState("");
  const [gatewayEnabled, setGatewayEnabled] = useState(true);
  const [gateway, setGateway] = useState("RAZORPAY");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const selectedPlan = plans.find((plan) => String(plan.id) === planId);
  const fieldClass = "h-9 w-full rounded-lg border border-[#0D8252] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white";
  const webhookUrl = "https://gym-api.wazeefa.in/api/payment/webhook/razorpay";

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" role="dialog" aria-modal="true" aria-labelledby="create-payment-link-title">
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Link2 size={18} /></div>
            <div><h2 id="create-payment-link-title" className="text-base font-bold text-[#0F172A]">Create Payment Link</h2><p className="mt-0.5 text-xs text-[#64748B]">Review plan details for a shareable payment link.</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Create Payment Link" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9]"><X size={17} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className="flex items-start gap-2 text-xs font-semibold text-[#334155]">
            <input type="checkbox" checked={gatewayEnabled} onChange={(event) => setGatewayEnabled(event.target.checked)} className="mt-0.5 accent-[#0D8252]" />
            <span>Enable Payment Gateway<span className="mt-0.5 block font-normal text-[#64748B]">Enable online payment collection for your gym.</span></span>
          </label>

          <fieldset disabled={!gatewayEnabled} className={`m-0 min-w-0 space-y-3 border-0 p-0 transition-opacity ${gatewayEnabled ? "" : "opacity-50"}`}>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#334155]">Payment Gateway</span>
            <select className={fieldClass} value={gateway} onChange={(event) => setGateway(event.target.value)}>
              <option value="RAZORPAY">Razorpay</option>
            </select>
            <span className="mt-1 block text-[10px] text-[#64748B]">Select your preferred payment provider.</span>
          </label>

          <div className="rounded-lg bg-[#0D8252] px-3 py-2.5 text-xs leading-4 text-white">
            <p className="font-bold">Razorpay Configuration</p>
            <p className="mt-1">To configure Razorpay:</p>
            <ol className="mt-2 text-xs list-decimal space-y-0.5 pl-4">
              <li>Sign up at Razorpay and open the Dashboard.</li>
              <li>Generate API keys from Account &amp; Settings.</li>
              <li>Use test keys while testing, then switch to live keys.</li>
              <li>Register the webhook URL below in Razorpay.</li>
            </ol>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#334155]">Razorpay Key ID</span>
            <input type="text" value={keyId} onChange={(event) => setKeyId(event.target.value)} placeholder="rzp_test_..." className={fieldClass} />
            <span className="mt-1 block text-[10px] text-[#64748B]">Your Razorpay Key ID starts with rzp_test_ or rzp_live_.</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#334155]">Razorpay Key Secret</span>
            <input type="password" value={keySecret} onChange={(event) => setKeySecret(event.target.value)} placeholder="Enter your key secret" className={fieldClass} />
            <span className="mt-1 block text-[10px] text-[#64748B]">Your Razorpay Key Secret is available in the Razorpay Dashboard.</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#334155]">Razorpay Webhook Secret</span>
            <input type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Enter webhook secret" className={fieldClass} />
            <span className="mt-1 block text-[10px] text-[#64748B]">Used to verify payment notifications from Razorpay.</span>
          </label>

          <div className="rounded-lg border border-[#0D8252]/30 bg-[#0D8252] p-2.5 text-xs text-white">
            <p className="font-bold">Webhook Configuration</p>
            <p className="mt-1 text-[10px]">Configure this webhook URL in your Razorpay Dashboard:</p>
            <div className="mt-1 flex min-w-0 items-center gap-1">
              <input readOnly value={webhookUrl} className="h-8 min-w-0 flex-1 rounded border border-[#0D8252]/30 bg-white px-2 text-xs text-[#334155]" />
              <button type="button" onClick={() => void navigator.clipboard?.writeText(webhookUrl)} aria-label="Copy webhook URL" title="Copy webhook URL" className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#086B43] text-white hover:bg-[#075334]"><Copy size={13} /></button>
            </div>
          </div>

          {/* <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#334155]">Plan</span>
              <select className={fieldClass} value={planId} onChange={(event) => setPlanId(event.target.value)}>
                <option value="">Select Plan</option>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#334155]">Amount</span>
              <input type="number" className={fieldClass} value={selectedPlan?.price ?? ""} readOnly placeholder="Select a plan" />
            </label>
          </div> */}
          <p className="rounded-lg border border-[#0D8252]/30 bg-[#0D8252]/10 px-3 py-2.5 text-xs leading-5 text-[#0D8252]">Payment link creation is not connected to a member payment API yet.</p>
          </fieldset>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button type="button" disabled={!gatewayEnabled || !gateway || !keyId || !keySecret || !webhookSecret || !selectedPlan} className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white opacity-50" title="Payment link API is not connected">Create Link</button>
        </div>
      </div>
    </div>
  ), document.body);
}

function ManualPaymentModal({ onClose, onContinue }) {
  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" role="dialog" aria-modal="true" aria-labelledby="manual-payment-title">
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><HandCoins size={18} /></div>
            <div><h2 id="manual-payment-title" className="text-base font-bold text-[#0F172A]">Manual Payment</h2><p className="mt-0.5 text-xs text-[#64748B]">Record payments received outside online checkout.</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Manual Payment" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9]"><X size={17} /></button>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-sm leading-6">You will need to handle the payment process manually and enter each payment history individually.</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button type="button" onClick={onContinue} className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Go to Payments</button>
        </div>
      </div>
    </div>
  ), document.body);
}

export default function Plans() {
  const { user } = useAuth();
  const loggedUserAccessToken = user?.accessToken || user?.token || getAuthToken();
  const isMemberPortal = user?.loginType === "member";
  const [activeTab, setActiveTab] = useState("plans");

  // Plans state
  const [plans, setPlans] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("LINK");
  const [paymentDialog, setPaymentDialog] = useState(null);
  const [editData, setEditData] = useState(null);
  const [modalKey, setModalKey] = useState(0);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [subscribingPlanId, setSubscribingPlanId] = useState(null);
  const [subscribedPlanIds, setSubscribedPlanIds] = useState(() => new Set());
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
  const [featureTotalCount, setFeatureTotalCount] = useState(0);

  // Stats state
  const [statsPlanId, setStatsPlanId] = useState("");
  const [planStats, setPlanStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsExporting, setStatsExporting] = useState(false);

  // Load plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await getMembershipPlans({}, loggedUserAccessToken);
        const apiPlans = unwrapList(response).map(normalizePlan);
        setPlans(apiPlans);
        setSubscribedPlanIds(new Set(
          apiPlans
            .filter((plan) => plan.raw?.isSubscribed || plan.raw?.subscribed || plan.raw?.hasSubscription)
            .map((plan) => String(plan.id))
        ));

        const defaultPlan = apiPlans.find((plan) =>
          String(plan.name || "").trim().toLowerCase() === "daily pass"
        );

        if (defaultPlan) {
          const defaultPlanId = String(defaultPlan.id);
          setStatsPlanId(defaultPlanId);
          void loadPlanStats(defaultPlanId);
        }
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
      const meta = response?.meta || data?.meta || {};
      setFeatures(list);
      setFeatureTotalCount(Number(meta.total ?? list.length ?? 0));
      setFeatureTotalPages(meta.totalPages || 1);
    } catch (error) {
      console.warn("Unable to load features:", error);
      setFeatures([]);
      setFeatureTotalCount(0);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const loadAllFeatures = async () => {
    try {
      const response = await getFeatures({ limit: 100 }, loggedUserAccessToken);
      const data = response?.data || response;
      const list = Array.isArray(data) ? data : unwrapList(data);
      const meta = response?.meta || data?.meta || {};
      setFeatureTotalCount(Number(meta.total ?? list.length ?? 0));
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

  useEffect(() => {
    if (!paymentDialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [paymentDialog]);

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
      const response = await subscribeToPlan(loggedUserId, planId, loggedUserAccessToken);
      const subscribedPlanId =
        response?.data?.planId ||
        response?.data?.plan?.id ||
        response?.planId ||
        response?.plan?.id ||
        planId;
      setSubscribedPlanIds((current) => new Set([...current, String(subscribedPlanId)]));
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
  const visibleTabs = isMemberPortal ? managementTabs.filter((tab) => tab.key === "plans") : managementTabs;
  const availableFeaturesCount = featureTotalCount || features.length;
  const activePlanCount = plans.length;
  const selectedPlan = plans.find((plan) => String(plan.id) === String(statsPlanId));
  const statsTrend = [
    { label: "Total", value: Number(planStats?.totalSubscribers || 0) },
    { label: "Active", value: Number(planStats?.activeSubscribers || 0) },
    { label: "Expired", value: Number(planStats?.expiredSubscribers || 0) },
  ];
  const revenueTrend = [
    { label: "Total", value: Number(planStats?.totalRevenue || 0) },
    { label: "Monthly", value: Number(planStats?.monthlyRevenue || 0) },
  ];

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
      if (planId === "ALL") {
        const responses = await Promise.all(plans.map((plan) => getPlanStats(plan.id, loggedUserAccessToken)));
        const stats = responses.map((response) => response?.data || response || {});
        setPlanStats({
          planName: "All Plans",
          totalSubscribers: stats.reduce((sum, item) => sum + Number(item.totalSubscribers || 0), 0),
          activeSubscribers: stats.reduce((sum, item) => sum + Number(item.activeSubscribers || 0), 0),
          expiredSubscribers: stats.reduce((sum, item) => sum + Number(item.expiredSubscribers || 0), 0),
          totalRevenue: stats.reduce((sum, item) => sum + Number(item.totalRevenue || 0), 0),
          monthlyRevenue: stats.reduce((sum, item) => sum + Number(item.monthlyRevenue || 0), 0),
        });
      } else {
        const response = await getPlanStats(planId, loggedUserAccessToken);
        setPlanStats(response?.data || response);
      }
    } catch (error) {
      setPlanStats(null);
      toast.error(getApiError(error, "Unable to load plan stats"));
    } finally {
      setStatsLoading(false);
    }
  };

  const handleExportStats = () => {
    if (!planStats || statsExporting) return;

    setStatsExporting(true);
    try {
      const rows = [
        ["Plan", planStats.planName || selectedPlan?.name || "Selected Plan"],
        ["Total Subscribers", planStats.totalSubscribers ?? 0],
        ["Active Subscribers", planStats.activeSubscribers ?? 0],
        ["Expired Subscribers", planStats.expiredSubscribers ?? 0],
        ["Total Revenue", planStats.totalRevenue ?? 0],
        ["Monthly Revenue", planStats.monthlyRevenue ?? 0],
      ];
      const csv = [
        ["Metric", "Value"],
        ...rows,
      ].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `plan-stats-${statsPlanId === "ALL" ? "all-plans" : "selected-plan"}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Stats exported successfully");
    } catch (error) {
      toast.error(getApiError(error, "Stats export failed"));
    } finally {
      setStatsExporting(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
      {activeTab === "plans" && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {/* <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0D8252]">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-[#0D8252]" /> Live Facility</span>
                <span className="text-[#CBD5E1]">•</span><span className="text-[#94A3B8]">Branch #01</span>
              </div> */}
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Plans</h1>
              <p className="mt-0.5 text-xs text-[#64748B]">Manage subscription packages, pricing tiers, and included amenities.</p>
            </div>
            {!isMemberPortal && (
              <div role="group" aria-label="Payment method" className="grid w-full grid-cols-2 rounded-lg border border-[#E2E8F0] bg-white p-1 sm:w-auto">
                <button
                  type="button"
                  aria-pressed={paymentMethod === "LINK"}
                  onClick={() => { setPaymentMethod("LINK"); setPaymentDialog("LINK"); }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${paymentMethod === "LINK" ? "bg-[#0D8252] text-white shadow-sm" : "text-[#475569] hover:bg-[#F8FAFC]"}`}
                >
                  <Link2 size={14} /> Create Payment Link
                </button>
                <button
                  type="button"
                  aria-pressed={paymentMethod === "MANUAL"}
                  onClick={() => { setPaymentMethod("MANUAL"); setPaymentDialog("MANUAL"); }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${paymentMethod === "MANUAL" ? "bg-[#0D8252] text-white shadow-sm" : "text-[#475569] hover:bg-[#F8FAFC]"}`}
                >
                  <HandCoins size={14} /> Manual Payment
                </button>
              </div>
            )}
          </div>
          {paymentDialog === "LINK" && <CreatePaymentLinkModal plans={plans} onClose={() => setPaymentDialog(null)} />}
          {paymentDialog === "MANUAL" && <ManualPaymentModal onClose={() => setPaymentDialog(null)} onContinue={() => { setPaymentMethod("LINK"); setPaymentDialog("LINK"); }} />}
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            
            <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Active Plans</p><div className="mt-1 flex items-center gap-2"><span className="text-2xl font-extrabold tracking-tight text-[#0F172A]">{activePlanCount}</span><span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-600">Active</span></div><p className="mt-1 text-[10px] text-[#94A3B8]">Daily to quarterly packages</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><CreditCard size={17} /></span></div>

            <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Features Defined</p><div className="mt-1 flex items-center gap-2"><span className="text-2xl font-extrabold tracking-tight text-[#0F172A]">{availableFeaturesCount}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">Available</span></div><p className="mt-1 text-[10px] text-[#94A3B8]">Gym amenities &amp; services</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#0D8252]"><Layers3 size={17} /></span></div>
          </div>
        </>
      )}
      {activeTab === "features" && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0D8252]">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-[#0D8252]" /> Live Facility</span>
                <span className="text-[#CBD5E1]">•</span><span className="text-[#94A3B8]">Branch #01</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Features</h1>
              <p className="mt-0.5 text-xs text-[#64748B]">Manage individual amenities, access privileges, and bundled perks.</p>
            </div>
            <span className="self-start rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-[#0D8252] sm:self-auto">{availableFeaturesCount} Active Features</span>
          </div>
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Total Features</p><div className="mt-1 flex items-center gap-2"><span className="text-2xl font-extrabold text-[#0F172A]">{availableFeaturesCount}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">Available</span></div><p className="mt-1 text-[10px] text-[#94A3B8]">Gym amenities &amp; services</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#0D8252]"><Layers3 size={17} /></span></div>
            <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Active Plans</p><div className="mt-1 flex items-center gap-2"><span className="text-2xl font-extrabold text-[#0F172A]">{plans.length}</span><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">Active</span></div><p className="mt-1 text-[10px] text-[#94A3B8]">Included in active subscriptions</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CreditCard size={17} /></span></div>
          </div>
        </>
      )}
      {activeTab === "stats" && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0D8252]">Membership Analytics</div><h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Plan Stats</h1><p className="mt-0.5 text-xs text-[#64748B]">Subscription volume, active member adoption, churn rates, and revenue performance.</p></div>
            <span className="self-start rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-[#0D8252] sm:self-auto">{plans.length} Packages</span>
          </div>
          <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Total Subscribers</p><p className="mt-2 text-2xl font-extrabold text-[#0F172A]">{planStats?.totalSubscribers ?? 0}</p><p className="mt-1 text-[10px] text-[#94A3B8]">All membership tiers</p></div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"><p className="text-[10px] font-bold uppercase tracking-wide text-[#0D8252]">Active Subscribers</p><p className="mt-2 text-2xl font-extrabold text-[#0D8252]">{planStats?.activeSubscribers ?? 0}</p><p className="mt-1 text-[10px] text-[#0D8252]">Currently active members</p></div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Monthly Revenue</p><p className="mt-2 text-2xl font-extrabold text-blue-700">₹{Number(planStats?.monthlyRevenue || 0).toLocaleString("en-IN")}</p><p className="mt-1 text-[10px] text-blue-700">Current cycle</p></div>
          </div>
        </>
      )}
      {/* Shared tab navigation */}
      {!isMemberPortal && (
        <div role="tablist" aria-label="Plans management views" className="flex gap-5 border-b border-[#E2E8F0]">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`h-10 px-1 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? "border-b-2 border-[#0D8252] text-[#0D8252]"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Only the selected tab renders below the shared header and navigation. */}
      <div className="min-h-0" role="tabpanel" aria-label={`${activeTab} content`}>
        {/* ===== PLANS TAB ===== */}
        {activeTab === "plans" && (
          <>
          {/* Header */}
          <div className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5 ${isMemberPortal ? "md:justify-end" : ""}`}>

            <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:flex-1">
              <div className={`min-w-0 flex-1 ${isMemberPortal ? "md:max-w-md md:ml-auto" : ""}`}>
                <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#FBFCFD] px-3 py-2">
                  <Search size={14} className="text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search plan..."
                    className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-[#94A3B8]"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              {!isMemberPortal && (
                <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
                  <button type="button" onClick={() => openFeatureModal()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#CFEFDB] bg-white px-3 py-2 text-xs font-semibold text-[#0D8252] transition hover:bg-[#F3FBF6] sm:flex-none">
                    <Plus size={13} /> Feature
                  </button>
                  <button type="button" onClick={() => { setBulkFeatureNames([""]); setShowBulkFeatureModal(true); }} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#CFEFDB] bg-[#F3FBF6] px-3 py-2 text-xs font-semibold text-[#0D8252] transition hover:bg-[#EAFBF3] sm:flex-none">
                    <Plus size={13} /> Bulk Feature
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditData(null);
                      setModalKey((key) => key + 1);
                      setIsOpen(true);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] sm:flex-none"
                  >
                    <Plus size={14} /> Plan
                  </button>
                </div>
              )}
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
                    disabled={subscribingPlanId === p.id || subscribedPlanIds.has(String(p.id))}
                    className={`mt-6 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      subscribedPlanIds.has(String(p.id)) ? "bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {subscribingPlanId === p.id
                      ? "Subscribing..."
                      : subscribedPlanIds.has(String(p.id))
                        ? "Subscribed"
                        : "Subscribe"}
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
            <div className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                    <tr>
                      <th className="px-4 py-3">Name</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Features</th><th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((p) => (
                      <tr key={p.id || p.name} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                        <td className="px-4 py-3 font-bold text-[#0F172A]">{p.name}</td>
                        <td className="px-4 py-3 font-semibold text-[#0F172A]">₹{p.price}</td>
                        <td className="px-4 py-3">{p.duration} days</td>
                        <td className="px-4 py-3"><span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">{p.planType || "-"}</span></td>
                        <td className="max-w-xs px-4 py-3 leading-relaxed">{(p.features || []).join(", ") || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={() => {
                                setEditData(p);
                                setModalKey((key) => key + 1);
                                setIsOpen(true);
                              }}
                              className="rounded-lg text-[#0D8252] transition hover:text-[#065F46]"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => void handleDelete(p.id)}
                              className="rounded-lg text-rose-500 transition hover:text-rose-700"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-4 py-10 text-center text-xs text-[#64748B]">
                          No plans found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-medium text-[#64748B]">Showing {filtered.length ? start + 1 : 0} to {Math.min(start + Math.min(itemsPerPage, filtered.length - start), filtered.length)} of {filtered.length} plans</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="rounded-lg bg-[#0D8252] px-3 py-1.5 font-bold text-white">{currentPage}</span>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#FBFCFD] px-3 py-2">
              <Search size={14} className="text-[#94A3B8]" />
              <input type="text" placeholder="Search feature..." className="w-full bg-transparent text-xs outline-none placeholder:text-[#94A3B8]" value={featureSearch} onChange={(e) => { setFeatureSearch(e.target.value); setFeaturePage(1); }} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setBulkFeatureNames([""]); setShowBulkFeatureModal(true); }} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#CFEFDB] bg-[#F3FBF6] px-3 py-2 text-xs font-semibold text-[#0D8252] sm:flex-none"><Plus size={13} /> Bulk Create</button>
              <button type="button" onClick={() => openFeatureModal()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3 py-2 text-xs font-semibold text-white hover:bg-[#086B43] sm:flex-none"><Plus size={13} /> Add Feature</button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Created At</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Actions</th></tr></thead><tbody>{featuresLoading ? <tr><td colSpan="4" className="px-4 py-10 text-center text-xs text-[#64748B]">Loading features...</td></tr> : features.map((feature) => <tr key={feature.id || feature._id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]"><td className="px-4 py-3 font-bold text-[#0F172A]">{feature.name}</td><td className="px-4 py-3">{feature.createdAt ? new Date(feature.createdAt).toLocaleDateString() : "-"}</td><td className="px-4 py-3"><StatusBadge status="ACTIVE" label="Active" /></td><td className="px-4 py-3"><div className="flex justify-center gap-3"><button type="button" onClick={() => openFeatureModal(feature)} className="rounded-lg text-[#0D8252] transition hover:text-[#065F46]" aria-label={`Edit ${feature.name}`}><Edit size={15} /></button><button type="button" onClick={() => void handleDeleteFeature(feature.id)} className="rounded-lg text-rose-500 transition hover:text-rose-700" aria-label={`Delete ${feature.name}`}><Trash size={14} /></button></div></td></tr>)}{!featuresLoading && features.length === 0 && <tr><td colSpan="4" className="px-4 py-10 text-center text-xs text-[#64748B]">No features found</td></tr>}</tbody></table></div>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-[#EEF2F4] p-4 text-xs sm:flex-row"><p className="text-[#64748B]">Showing {features.length} of {availableFeaturesCount} features</p><div className="flex gap-2"><button type="button" onClick={() => setFeaturePage((p) => Math.max(1, p - 1))} disabled={featurePage <= 1} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 font-semibold disabled:opacity-50">Prev</button><button type="button" onClick={() => setFeaturePage((p) => p + 1)} disabled={featurePage >= featureTotalPages} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 font-semibold disabled:opacity-50">Next</button></div></div>
          </div>
          </div>
        )}

      {showFeatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => { setShowFeatureModal(false); setEditFeature(null); }}>
          <div className="w-full max-w-md overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Layers3 size={18} /></div>
                <div><h2 className="text-base font-bold text-[#0F172A]">{editFeature ? "Edit Feature" : "Add Feature"}</h2><p className="mt-0.5 text-xs text-[#64748B]">Define an amenity included in your membership plans.</p></div>
              </div>
              <button type="button" onClick={() => { setShowFeatureModal(false); setEditFeature(null); }} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9]" aria-label="Close feature modal"><X size={17} /></button>
            </div>
            <div className="px-5 py-4"><label className="block text-xs font-semibold text-[#334155]"><span className="mb-1 block">Feature Name</span><input type="text" placeholder="Feature name" className="h-9 w-full rounded-lg border border-[#E2E8F0]/20 bg-[#F8FAFC] px-3 text-xs outline-none focus:border-[#0D8252]/30 focus:bg-white" value={featureFormName} onChange={(e) => setFeatureFormName(e.target.value)} autoFocus /></label></div>
            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] px-5 py-4"><button type="button" onClick={() => { setShowFeatureModal(false); setEditFeature(null); }} className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#475569]">Cancel</button><button type="button" onClick={handleSaveFeature} className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white">{editFeature ? "Update" : "Save"}</button></div>
          </div>
        </div>
      )}

      {showBulkFeatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setShowBulkFeatureModal(false)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Layers3 size={18} /></div><div><h2 className="text-base font-bold text-[#0F172A]">Bulk Create Features</h2><p className="mt-0.5 text-xs text-[#64748B]">Add multiple amenities to use across membership plans.</p></div></div><button type="button" onClick={() => setShowBulkFeatureModal(false)} className="rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Close bulk feature modal"><X size={17} /></button></div>
            <div className="flex-1 overflow-y-auto space-y-2 px-5 py-4"><p className="mb-3 text-xs text-[#64748B]">Each feature name must be 2-100 characters.</p>{bulkFeatureNames.map((name, i) => <div key={i} className="flex items-center gap-2"><input type="text" placeholder={`Feature ${i + 1}`} className="h-9 flex-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs outline-none focus:border-[#0D8252] focus:bg-white" value={name} onChange={(e) => { const next = [...bulkFeatureNames]; next[i] = e.target.value; setBulkFeatureNames(next); }} />{bulkFeatureNames.length > 1 && <button type="button" onClick={() => setBulkFeatureNames((prev) => prev.filter((_, j) => j !== i))} className="rounded-lg text-rose-500"><X size={16} /></button>}</div>)}<button type="button" onClick={() => setBulkFeatureNames((prev) => [...prev, ""])} className="rounded-lg mt-2 flex items-center gap-1 text-xs font-semibold text-[#0D8252]"><Plus size={14} /> Add row</button></div>
            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] px-5 py-4"><button type="button" onClick={() => { setShowBulkFeatureModal(false); setBulkFeatureNames([""]); }} className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#475569]">Cancel</button><button type="button" onClick={handleBulkCreateFeatures} className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white">Create All</button></div>
          </div>
        </div>
      )}

      {/* ===== STATS TAB ===== */}
        {activeTab === "stats" && (
          <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:justify-between"><label className="flex w-full items-center gap-3 sm:max-w-md"><span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Selected plan:</span><select className="h-9 min-w-0 flex-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0F172A] outline-none focus:border-[#0D8252]" value={statsPlanId} onChange={(e) => loadPlanStats(e.target.value)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button type="button" onClick={handleExportStats} disabled={!planStats || statsLoading || statsExporting} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"><Download size={14} /> {statsExporting ? "Exporting..." : "Export Report"}</button></div>

          {planStats && !statsLoading ? <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Plan Name</p><span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-[#64748B]">{selectedPlan?.planType || "Tier"}</span></div><p className="mt-4 text-lg font-bold text-[#0F172A]">{planStats.planName || selectedPlan?.name || "-"}</p><p className="mt-1 text-[10px] text-[#94A3B8]">{selectedPlan?.duration ? `Valid for ${selectedPlan.duration} days` : "Selected membership tier"}</p></div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Total Subscribers</p><span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-[#64748B]">Members</span></div><p className="mt-4 text-2xl font-extrabold text-[#0F172A]">{planStats.totalSubscribers ?? 0}</p><p className="mt-1 text-[10px] text-[#94A3B8]">Cumulative all-time sign-ups</p></div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-[#0D8252]">Active Subscribers</p><span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-[#0D8252]">Live</span></div><p className="mt-4 text-2xl font-extrabold text-[#0D8252]">{planStats.activeSubscribers ?? 0}</p><p className="mt-1 text-[10px] text-[#0D8252]">Current active conversion</p></div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Expired Subscribers</p><span className="rounded-md bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">Review</span></div><p className="mt-4 text-2xl font-extrabold text-[#0F172A]">{planStats.expiredSubscribers ?? 0}</p><p className="mt-1 text-[10px] text-[#94A3B8]">Passed expiry in recent period</p></div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Total Revenue</p><span className="rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-bold text-[#0D8252]">Rs.</span></div><p className="mt-4 text-2xl font-extrabold text-[#0F172A]">₹{Number(planStats.totalRevenue || 0).toLocaleString("en-IN")}</p><p className="mt-1 text-[10px] text-[#0D8252]">All-time plan revenue</p></div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Monthly Revenue</p><span className="rounded-md bg-blue-100 px-2 py-1 text-[9px] font-bold text-blue-700">Current cycle</span></div><p className="mt-4 text-2xl font-extrabold text-blue-700">₹{Number(planStats.monthlyRevenue || 0).toLocaleString("en-IN")}</p><p className="mt-1 text-[10px] text-blue-700">Current month contribution</p></div>
            </div>
            
          </> : <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#0D8252]"><BarChart3 size={20} /></div><h2 className="mt-3 text-sm font-bold text-[#0F172A]">Select a plan to view its statistics</h2><p className="mt-1 text-xs text-[#64748B]">Choose a membership tier above to load subscribers and revenue data.</p></div>}
          {statsLoading && <p className="text-center text-xs text-[#64748B]">Loading statistics...</p>}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
