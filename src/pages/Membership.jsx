import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Download, Plus, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { canAccess, getPortalKey } from "../utils/rbac";
import {
  assignMembership,
  cancelMembership,
  checkMembershipAccess,
  createFeature,
  createMembershipCheckout,
  createMembershipPayment,
  createMembershipPlan,
  deleteFeature,
  deleteMembershipPlan,
  exportMembershipPayments,
  getApiError,
  getAuthToken,
  getExpiringMemberships,
  getFeatures,
  getMemberSubscription,
  getMembershipDashboard,
  getMembershipEarnings,
  getMembershipPayments,
  getMembershipSubscriptions,
  getMembershipPlans,
  getMyMembershipPayments,
  getPlanStats,
  getTenantMembers,
  renewMembership,
  updateFeature,
  updateMembershipSubscriptionPayment,
  updateMembershipPlan,
  verifyMembershipCheckout,
} from "../services/api";

const PAGE_SIZE = 10;
const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "ONLINE"];
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
const fieldClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-700";
const panelClass = "border border-slate-200 bg-white";

function unwrapPayload(response) {
  return response?.data?.data ?? response?.data ?? response ?? {};
}

function listFrom(response) {
  const payload = unwrapPayload(response);
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.results || payload?.rows || payload?.subscriptions || payload?.payments || payload?.plans || [];
}

function objectFrom(response, keys = []) {
  const payload = unwrapPayload(response);
  for (const key of keys) if (payload?.[key]) return payload[key];
  return payload;
}

function idOf(record = {}) {
  return record.id || record._id || record.userId || record.memberId || "";
}

function relatedSubscriptionId(payment, subscriptionRecords = []) {
  const directReference = payment?.subscriptionId || payment?.membershipSubscriptionId
    || (typeof payment?.subscription === "string" ? payment.subscription : idOf(payment?.subscription || {}));
  if (directReference) return String(directReference);

  const paymentId = idOf(payment);
  const transactionId = payment?.transactionId || payment?.referenceId || payment?.razorpayPaymentId;
  const nestedMatches = subscriptionRecords.filter((subscription) => {
    const linkedPayments = [
      ...(Array.isArray(subscription.payments) ? subscription.payments : []),
      ...(Array.isArray(subscription.paymentHistory) ? subscription.paymentHistory : []),
      subscription.payment,
      subscription.latestPayment,
    ].filter(Boolean);
    return linkedPayments.some((linkedPayment) => (
      (paymentId && idOf(linkedPayment) === paymentId)
      || (transactionId && [linkedPayment.transactionId, linkedPayment.referenceId, linkedPayment.razorpayPaymentId].includes(transactionId))
    ));
  });
  if (nestedMatches.length === 1) return String(idOf(nestedMatches[0]) || "");

  const memberId = idOf(payment?.member || payment?.user || {}) || payment?.memberId || payment?.userId;
  const planId = payment?.planId || idOf(payment?.plan || {});
  if (!memberId || !planId) return "";
  const sameMemberAndPlan = subscriptionRecords.filter((subscription) => {
    const subscriptionMemberId = idOf(subscription.member || subscription.user || {}) || subscription.memberId || subscription.userId;
    const subscriptionPlanId = subscription.planId || idOf(subscription.plan || {});
    return String(subscriptionMemberId || "") === String(memberId) && String(subscriptionPlanId || "") === String(planId);
  });
  return sameMemberAndPlan.length === 1 ? String(idOf(sameMemberAndPlan[0]) || "") : "";
}

function memberName(record = {}) {
  return record.member?.name || record.member?.fullName || record.user?.name || record.user?.fullName || record.memberName || record.userName || record.name || "Member";
}

function planName(record = {}) {
  return record.plan?.name || record.membershipPlan?.name || record.planName || "-";
}

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusText(record = {}) {
  return String(record.status || record.paymentStatus || "PENDING").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function earningsSeries(data = {}, group = "monthly") {
  const series = group === "yearly" ? data.yearlySeries : data.last12Months;
  return (Array.isArray(series) ? series : []).map((item) => ({
    label: group === "yearly" ? String(item.year) : item.month,
    revenue: Number(item.revenue || 0),
  }));
}

function normalizePlan(plan = {}) {
  const rawFeatures = plan.features || plan.planFeatures || [];
  return {
    ...plan,
    id: idOf(plan),
    name: plan.name || "",
    price: Number(plan.price || 0),
    duration: Number(plan.duration || 0),
    planType: plan.planType || "",
    features: Array.isArray(rawFeatures) ? rawFeatures.map((feature) => typeof feature === "string" ? feature : feature.name).filter(Boolean) : String(rawFeatures).split(",").map((item) => item.trim()).filter(Boolean),
  };
}

async function loadRazorpayScript() {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function Metric({ label, value, note }) {
  return <div className={`${panelClass} p-4`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>{note && <p className="mt-1 text-xs text-slate-500">{note}</p>}</div>;
}

function Modal({ title, description, onClose, children }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><button type="button" aria-label="Close" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>
      <div className="p-5">{children}</div>
    </section>
  </div>;
}

export default function Membership() {
  const { user } = useAuth();
  const token = user?.accessToken || user?.token || getAuthToken();
  const isMember = getPortalKey(user) === "member";
  const userId = user?.id || user?._id || user?.userId || user?.memberId || user?.user?.id || user?.user?._id || "";
  const canReadPlans = canAccess(user, "plans", "read");
  const canManagePlans = !isMember && canAccess(user, "gym.settings", "update");
  const canReadSubscriptions = !isMember && canAccess(user, "subscriptions", "read");
  const canCreateSubscriptions = !isMember && canAccess(user, "subscriptions", "create") && canReadPlans && canAccess(user, "members", "read");
  const canAssignSubscriptions = canCreateSubscriptions;
  const canUpdateSubscriptions = !isMember && canAccess(user, "subscriptions", "update");
  const canReadPayments = !isMember && canAccess(user, "payments", "read");
  const canCreatePayments = !isMember && canAccess(user, "payments", "create");
  const canUpdatePayments = !isMember && canAccess(user, "payments", "update");
  const canReadDashboard = !isMember && canReadPlans && canReadSubscriptions && canReadPayments;
  const [section, setSection] = useState(isMember ? "my-membership" : canReadDashboard ? "dashboard" : canReadSubscriptions ? "subscriptions" : canReadPayments ? "payments" : canReadPlans ? "plans" : "dashboard");
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [earnings, setEarnings] = useState([]);
  const [earningsSummary, setEarningsSummary] = useState({});
  const [earningsGroup, setEarningsGroup] = useState("monthly");
  const [mySubscription, setMySubscription] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState("");
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingFeature, setEditingFeature] = useState(null);
  const [planForm, setPlanForm] = useState({ name: "", price: "", duration: "", planType: "", description: "", featureIds: [] });
  const [featureName, setFeatureName] = useState("");
  const [assignForm, setAssignForm] = useState({ memberId: "", planId: "", paymentMethod: "CASH", amount: "", status: "PAID", transactionId: "", notes: "" });
  const [paymentForm, setPaymentForm] = useState({ subscriptionId: "", amount: "", paymentMethod: "CASH", transactionId: "", notes: "" });
  const [subscriptionFilters, setSubscriptionFilters] = useState({ status: "", planId: "", expiring: false });
  const [paymentFilters, setPaymentFilters] = useState({ search: "", status: "", paymentMethod: "", planId: "", startDate: "", endDate: "" });
  const [paymentPage, setPaymentPage] = useState(1);
  const [myPayments, setMyPayments] = useState([]);
  const [updatingPaymentId, setUpdatingPaymentId] = useState("");

  const refreshMemberData = useCallback(async () => {
    if (!userId) return;
    const [subscriptionResult, accessResult, paymentsResult] = await Promise.allSettled([
      getMemberSubscription(userId, token),
      checkMembershipAccess(userId, token),
      getMyMembershipPayments({ page: 1, limit: 100 }, token),
    ]);
    if (subscriptionResult.status === "fulfilled") setMySubscription(objectFrom(subscriptionResult.value, ["subscription", "activeSubscription"]));
    if (accessResult.status === "fulfilled") setAccess(objectFrom(accessResult.value, ["access", "result"]));
    if (paymentsResult.status === "fulfilled") setMyPayments(listFrom(paymentsResult.value));
  }, [token, userId]);

  const refreshStaffData = useCallback(async () => {
    const requests = [];
    let loadedSubscriptions = [];
    if (canReadPlans) requests.push(getMembershipPlans({}, token));
    if (canReadSubscriptions) requests.push(subscriptionFilters.expiring ? getExpiringMemberships({ status: subscriptionFilters.status, planId: subscriptionFilters.planId }, token) : getMembershipSubscriptions({ status: subscriptionFilters.status, planId: subscriptionFilters.planId }, token));
    if (canReadPayments) requests.push(getMembershipPayments({ page: 1, limit: 100 }, token));
    if (section === "dashboard" && canReadDashboard) requests.push(getMembershipDashboard({}, token));
    if (section === "features") requests.push(getFeatures({ limit: 100 }, token));
    if (section === "earnings") requests.push(getMembershipEarnings({ groupBy: earningsGroup }, token));
    if (section === "subscriptions" && canAssignSubscriptions) requests.push(getTenantMembers(token));
    const results = await Promise.allSettled(requests);
    let index = 0;
    if (canReadPlans) {
      if (results[index]?.status === "fulfilled") setPlans(listFrom(results[index].value).map(normalizePlan));
      index += 1;
    }
    if (canReadSubscriptions) {
      if (results[index]?.status === "fulfilled") {
        loadedSubscriptions = listFrom(results[index].value);
        setSubscriptions(loadedSubscriptions);
      }
      index += 1;
    }
    if (canReadPayments) {
      if (results[index]?.status === "fulfilled") {
        setPayments(listFrom(results[index].value).map((payment) => ({
          ...payment,
          subscriptionId: relatedSubscriptionId(payment, loadedSubscriptions) || payment.subscriptionId,
        })));
      }
      index += 1;
    }
    if (section === "dashboard" && canReadDashboard) {
      if (results[index]?.status === "fulfilled") setDashboard(objectFrom(results[index].value, ["dashboard", "summary"]));
      index += 1;
    }
    if (section === "features") {
      if (results[index]?.status === "fulfilled") setFeatures(listFrom(results[index].value));
      index += 1;
    }
    if (section === "earnings") {
      if (results[index]?.status === "fulfilled") {
        const data = objectFrom(results[index].value, ["earnings"]);
        setEarningsSummary(data);
        setEarnings(earningsSeries(data, earningsGroup));
      }
      index += 1;
    }
    if (section === "subscriptions" && canAssignSubscriptions && results[index]?.status === "fulfilled") setMembers(listFrom(results[index].value));
  }, [canAssignSubscriptions, canReadDashboard, canReadPayments, canReadPlans, canReadSubscriptions, earningsGroup, section, subscriptionFilters.expiring, subscriptionFilters.planId, subscriptionFilters.status, token]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (isMember) {
          if (canReadPlans) {
            const plansResult = await getMembershipPlans({}, token);
            if (!active) return;
            setPlans(listFrom(plansResult).map(normalizePlan));
          }
          await refreshMemberData();
        } else {
          await refreshStaffData();
        }
      } catch (error) {
        if (active) toast.error(getApiError(error, "Unable to load membership data"));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [canReadPlans, isMember, refreshMemberData, refreshStaffData, token]);

  const runMemberCheckout = async (plan) => {
    if (!userId) {
      toast.error("Your member account could not be identified.");
      return;
    }
    setBusy(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Razorpay checkout could not be loaded.");
      const result = objectFrom(await createMembershipCheckout({ userId, planId: plan.id, paymentMethod: "ONLINE" }, token), ["checkout", "order", "data"]);
      const key = result.keyId || result.razorpayKeyId || result.key;
      const orderId = result.orderId || result.razorpayOrderId || result.id;
      if (!key || !orderId || !window.Razorpay) throw new Error("The payment service did not return a valid Razorpay order.");
      const checkout = new window.Razorpay({
        key,
        order_id: orderId,
        amount: result.amount,
        currency: result.currency || "INR",
        name: result.gymName || "Gym Membership",
        description: plan.name,
        prefill: { name: user?.name || user?.fullName || "", email: user?.email || "", contact: user?.phone || user?.phoneNumber || "" },
        handler: async (gatewayResult) => {
          try {
            await verifyMembershipCheckout({
              userId,
              planId: plan.id,
              paymentMethod: "ONLINE",
              razorpay_order_id: gatewayResult.razorpay_order_id,
              razorpay_payment_id: gatewayResult.razorpay_payment_id,
              razorpay_signature: gatewayResult.razorpay_signature,
            }, token);
            toast.success("Payment captured and membership activated.");
            await refreshMemberData();
          } catch (error) {
            toast.error(getApiError(error, "Payment verification failed. Your membership was not created."));
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", (event) => {
        setBusy(false);
        toast.error(event?.error?.description || "Membership payment failed.");
      });
      checkout.open();
    } catch (error) {
      setBusy(false);
      toast.error(getApiError(error, "Unable to start membership checkout"));
    }
  };

  const savePlan = async (event) => {
    event.preventDefault();
    if (!canManagePlans) return;
    const payload = { ...planForm, price: Number(planForm.price), duration: Number(planForm.duration) };
    try {
      if (editingPlan) await updateMembershipPlan(editingPlan.id, payload, token);
      else await createMembershipPlan(payload, token);
      toast.success(editingPlan ? "Plan updated" : "Plan created");
      setModal("");
      await refreshStaffData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save plan"));
    }
  };

  const removePlan = async (plan) => {
    if (!canManagePlans || !window.confirm(`Delete ${plan.name}?`)) return;
    try {
      await deleteMembershipPlan(plan.id, token);
      setPlans((current) => current.filter((item) => item.id !== plan.id));
      toast.success("Plan deleted");
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete plan"));
    }
  };

  const saveFeature = async (event) => {
    event.preventDefault();
    if (!canManagePlans || !featureName.trim()) return;
    try {
      if (editingFeature) await updateFeature(idOf(editingFeature), { name: featureName.trim() }, token);
      else await createFeature({ name: featureName.trim() }, token);
      setModal("");
      setFeatureName("");
      await refreshStaffData();
      toast.success(editingFeature ? "Feature updated" : "Feature created");
    } catch (error) {
      toast.error(getApiError(error, "Unable to save feature"));
    }
  };

  const removeFeature = async (feature) => {
    if (!canManagePlans || !window.confirm(`Delete ${feature.name}?`)) return;
    try {
      await deleteFeature(idOf(feature), token);
      setFeatures((current) => current.filter((item) => idOf(item) !== idOf(feature)));
      toast.success("Feature deleted");
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete feature"));
    }
  };

  const submitAssignment = async (event) => {
    event.preventDefault();
    if (!canAssignSubscriptions) return;
    try {
      await assignMembership({ ...assignForm, amount: Number(assignForm.amount), paymentMethod: assignForm.paymentMethod }, token);
      toast.success("Membership and payment recorded");
      setModal("");
      setAssignForm({ memberId: "", planId: "", paymentMethod: "CASH", amount: "", status: "PAID", transactionId: "", notes: "" });
      await refreshStaffData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign membership"));
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!canCreatePayments) return;
    try {
      await createMembershipPayment({ ...paymentForm, amount: Number(paymentForm.amount) }, token);
      toast.success("Membership payment recorded");
      setModal("");
      setPaymentForm({ subscriptionId: "", amount: "", paymentMethod: "CASH", transactionId: "", notes: "" });
      await refreshStaffData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to record membership payment"));
    }
  };

  const renewStaffMembership = async (subscription) => {
    if (!canUpdateSubscriptions) return;
    const selectedPlan = plans.find((plan) => String(plan.id) === String(subscription.planId || subscription.plan?.id));
    try {
      await renewMembership(idOf(subscription), { planId: selectedPlan?.id, paymentMethod: "CASH", amount: selectedPlan?.price || subscription.amount, status: "PAID" }, token);
      toast.success("Membership renewed");
      await refreshStaffData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to renew membership"));
    }
  };

  const cancelStaffMembership = async (subscription) => {
    if (!canUpdateSubscriptions || !window.confirm(`Cancel the membership for ${memberName(subscription)}?`)) return;
    try {
      await cancelMembership(idOf(subscription), {}, token);
      toast.success("Membership cancelled");
      await refreshStaffData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to cancel membership"));
    }
  };

  const filteredPayments = useMemo(() => payments.filter((payment) => {
    const searchText = `${memberName(payment)} ${planName(payment)} ${payment.transactionId || payment.referenceId || ""}`.toLowerCase();
    const paymentDate = String(payment.paidAt || payment.paymentDate || payment.createdAt || "").slice(0, 10);
    return (!paymentFilters.search || searchText.includes(paymentFilters.search.toLowerCase()))
      && (!paymentFilters.status || String(payment.status || "").toUpperCase() === paymentFilters.status)
      && (!paymentFilters.paymentMethod || String(payment.paymentMethod || "").toUpperCase() === paymentFilters.paymentMethod)
      && (!paymentFilters.planId || String(payment.planId || payment.plan?.id) === paymentFilters.planId)
      && (!paymentFilters.startDate || paymentDate >= paymentFilters.startDate)
      && (!paymentFilters.endDate || paymentDate <= paymentFilters.endDate);
  }), [payments, paymentFilters]);
  const visiblePayments = filteredPayments.slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE);

  const exportPayments = async () => {
    if (!canReadPayments) return;
    const params = { ...paymentFilters, page: undefined, limit: undefined };
    try {
      const csv = await exportMembershipPayments(params, token);
      const url = URL.createObjectURL(csv instanceof Blob ? csv : new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "membership-payment-history.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiError(error, "Unable to export payment history"));
    }
  };

  const updatePaymentStatus = async (payment, status) => {
    if (!canUpdatePayments) return;
    const paymentId = idOf(payment);
    setUpdatingPaymentId(paymentId);
    try {
      let subscriptionRecords = subscriptions;
      let subscriptionId = relatedSubscriptionId(payment, subscriptionRecords);
      if (!subscriptionId) {
        const response = await getMembershipSubscriptions({}, token);
        subscriptionRecords = listFrom(response);
        setSubscriptions(subscriptionRecords);
        subscriptionId = relatedSubscriptionId(payment, subscriptionRecords);
      }
      if (!subscriptionId) {
        toast.error("Unable to identify the membership subscription for this payment.");
        return;
      }

      const paymentMethod = String(payment.paymentMethod || payment.method || "").toUpperCase();
      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        toast.error("A valid payment method is required to update this payment.");
        return;
      }
      const normalizedStatus = status === "PARTIAL" ? "PARTIALLY_REFUNDED" : status;
      if (!PAYMENT_STATUSES.includes(normalizedStatus)) {
        toast.error("Select a supported payment status.");
        return;
      }
      const payload = { status: normalizedStatus, paymentMethod };
      if (payment.transactionId) payload.transactionId = payment.transactionId;
      if (payment.notes) payload.notes = payment.notes;

      await updateMembershipSubscriptionPayment(subscriptionId, payload, token);
      try {
        const refreshed = await getMembershipPayments({ page: 1, limit: 100 }, token);
        setPayments(listFrom(refreshed).map((item) => ({
          ...item,
          subscriptionId: relatedSubscriptionId(item, subscriptionRecords) || item.subscriptionId,
        })));
        toast.success("Payment status updated");
      } catch (refreshError) {
        toast.error(getApiError(refreshError, "Payment status updated, but history could not be refreshed."));
      }
    } catch (error) {
      toast.error(getApiError(error, "Unable to update payment status"));
    } finally {
      setUpdatingPaymentId("");
    }
  };

  const loadEarnings = async (group) => {
    setEarningsGroup(group);
    try {
      const data = objectFrom(await getMembershipEarnings({ groupBy: group }, token), ["earnings"]);
      setEarningsSummary(data);
      setEarnings(earningsSeries(data, group));
    } catch (error) {
      toast.error(getApiError(error, "Unable to load earnings"));
    }
  };

  const loadPlanRevenue = useCallback(async () => Promise.all(plans.map(async (plan) => {
    try {
      const stats = objectFrom(await getPlanStats(plan.id, token), ["stats"]);
      return { name: plan.name, revenue: Number(stats.totalRevenue || stats.revenue || 0) };
    } catch {
      return { name: plan.name, revenue: 0 };
    }
  })), [plans, token]);
  const [planRevenue, setPlanRevenue] = useState([]);

  useEffect(() => {
    if (canReadDashboard && section === "dashboard" && plans.length) void loadPlanRevenue().then(setPlanRevenue);
  }, [canReadDashboard, section, loadPlanRevenue, plans]);

  const openPlanForm = (plan = null) => {
    setEditingPlan(plan);
    setPlanForm(plan ? { name: plan.name, price: plan.price, duration: plan.duration, planType: plan.planType, description: plan.description || "", featureIds: plan.featureIds || [] } : { name: "", price: "", duration: "", planType: "", description: "", featureIds: [] });
    setModal("plan");
  };

  const navItems = isMember
    ? [{ key: "my-membership", label: "My Membership" }, { key: "plans", label: "Available Plans" }, { key: "my-payments", label: "My Payment History" }]
    : [
      ...(canReadDashboard ? [{ key: "dashboard", label: "Dashboard" }] : []),
      ...(canReadPlans ? [{ key: "plans", label: "Plans" }] : []),
      ...(canManagePlans ? [{ key: "features", label: "Features" }] : []),
      ...(canReadSubscriptions ? [{ key: "subscriptions", label: "Subscriptions" }] : []),
      ...(canReadPayments ? [{ key: "payments", label: "Payment History" }] : []),
      ...(canReadPayments ? [{ key: "earnings", label: "Earnings" }] : []),
    ];

  const memberCurrent = mySubscription?.subscription || mySubscription?.activeSubscription || mySubscription;
  const activeStatus = access?.hasAccess ?? access?.allowed ?? access?.isActive ?? ["ACTIVE", "TRIAL"].includes(String(memberCurrent?.status || "").toUpperCase());
  const currentPlan = memberCurrent?.plan || memberCurrent?.membershipPlan || {};
  const metric = (...keys) => {
    for (const key of keys) if (dashboard[key] !== undefined) return dashboard[key];
    return 0;
  };

  return <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Membership</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{isMember ? "Your membership" : "Membership management"}</h1><p className="mt-1 text-sm text-slate-500">{isMember ? "Plans, access status, and your payment records." : "Plans, subscriptions, payments, and revenue."}</p></div>{!isMember && <div className="flex gap-2">{section === "payments" && canCreatePayments && canReadSubscriptions && <button type="button" onClick={() => setModal("record-payment")} className="inline-flex h-9 items-center gap-2 bg-emerald-800 px-3 text-sm font-semibold text-white"><Plus size={15} /> Record payment</button>}<button type="button" onClick={() => void refreshStaffData()} className="inline-flex h-9 items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"><RefreshCw size={14} /> Refresh</button></div>}</header>
      <nav aria-label="Membership views" className="flex gap-5 overflow-x-auto border-b border-slate-300">{navItems.map((item) => <button key={item.key} type="button" onClick={() => { if (section !== item.key) setLoading(true); setSection(item.key); }} className={`shrink-0 border-b-2 px-1 py-3 text-sm font-semibold ${section === item.key ? "border-emerald-800 text-emerald-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{item.label}</button>)}</nav>
      {updatingPaymentId && <p role="status" className="text-sm text-slate-500">Updating payment status...</p>}
      {loading ? <div className="py-16 text-center text-sm text-slate-500">Loading membership...</div> : <>
        {section === "earnings" && !isMember && canReadPayments && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total Earnings" value={money(earningsSummary.totalEarnings)} note={`${earningsSummary.totalPaidCount || 0} paid payments`} />
            <Metric label={earningsGroup === "yearly" ? "Current Year" : "Current Month"} value={money(earningsGroup === "yearly" ? earningsSummary.currentYear : earningsSummary.currentMonth)} note="Paid payments only" />
            <Metric label={earningsGroup === "yearly" ? "Previous Year" : "Previous Month"} value={money(earningsGroup === "yearly" ? earningsSummary.previousYear : earningsSummary.previousMonth)} note="Paid payments only" />
            <Metric label="Chart Periods" value={earnings.length} note={earningsGroup === "yearly" ? "Last 5 years" : "Last 12 months"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={`${panelClass} p-4`}><h3 className="font-bold text-slate-950">Payments by status</h3><div className="mt-3 divide-y divide-slate-200">{Object.entries(earningsSummary.byStatus || {}).map(([status, totals]) => <div key={status} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-semibold">{status.replaceAll("_", " ")}</span><span className="text-slate-600">{totals.count} · {money(totals.amount)}</span></div>)}{!Object.keys(earningsSummary.byStatus || {}).length && <p className="py-5 text-sm text-slate-500">No status totals available.</p>}</div></section>
            <section className={`${panelClass} p-4`}><h3 className="font-bold text-slate-950">Paid payments by method</h3><div className="mt-3 divide-y divide-slate-200">{(earningsSummary.byMethod || []).map((method) => <div key={method.method} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-semibold">{String(method.method || "Other").replaceAll("_", " ")}</span><span className="text-slate-600">{method.count} · {money(method.amount)}</span></div>)}{!earningsSummary.byMethod?.length && <p className="py-5 text-sm text-slate-500">No paid method totals available.</p>}</div></section>
          </div>
        </>}
        {section === "dashboard" && canReadDashboard && <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active Members" value={metric("activeMembers", "activeSubscriptions")} /><Metric label="Expired Members" value={metric("expiredMembers", "expiredSubscriptions")} /><Metric label="Pending Payments" value={metric("pendingPayments")} /><Metric label="Monthly Revenue" value={money(metric("monthlyRevenue", "revenueThisMonth"))} /></div>
          <div className="grid gap-5 xl:grid-cols-2"><section className={`${panelClass} p-4`}><div className="mb-4"><h2 className="font-bold text-slate-950">Revenue by Membership Plan</h2><p className="mt-1 text-xs text-slate-500">Collected revenue across available plans.</p></div><div className="h-64">{planRevenue.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={planRevenue}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => money(value)} /><Bar dataKey="revenue" fill="#087f5b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="py-16 text-center text-sm text-slate-500">No revenue data available.</p>}</div></section>
            <section className={`${panelClass} p-4`}><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-950">Membership overview</h2><p className="mt-1 text-xs text-slate-500">Current subscription counts.</p></div><button type="button" onClick={() => setSection("subscriptions")} className="text-sm font-semibold text-emerald-800 hover:underline">View subscriptions</button></div><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Total Subscriptions" value={metric("totalSubscriptions", "totalMembers")} /><Metric label="Expiring Soon" value={metric("expiringSoon", "expiringMemberships")} /></div></section>
          </div>
        </section>}

        {section === "my-membership" && isMember && <section className="space-y-5">
          <div className={`${panelClass} p-5 sm:p-6`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current membership</p><h2 className="mt-2 text-xl font-bold text-slate-950">{currentPlan.name || planName(memberCurrent) || "No active plan"}</h2><p className="mt-1 text-sm text-slate-500">{currentPlan.planType || memberCurrent?.planType || "Membership"}</p></div><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold ${activeStatus ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}><ShieldCheck size={14} />{activeStatus ? "Active" : statusText(memberCurrent)}</span></div><dl className="mt-6 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-3"><div><dt className="text-xs font-semibold text-slate-500">Start date</dt><dd className="mt-1 text-sm font-semibold">{dateText(memberCurrent?.startDate || memberCurrent?.startedAt)}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Expiry date</dt><dd className="mt-1 text-sm font-semibold">{dateText(memberCurrent?.expiryDate || memberCurrent?.endDate || memberCurrent?.expiresAt)}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Access</dt><dd className="mt-1 text-sm font-semibold">{activeStatus ? "Access granted" : "Access unavailable"}</dd></div></dl>{memberCurrent && <button type="button" disabled={busy} onClick={() => void runMemberCheckout(plans.find((plan) => String(plan.id) === String(memberCurrent.planId || currentPlan.id)) || normalizePlan(currentPlan))} className="mt-5 inline-flex h-10 items-center gap-2 bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"><RefreshCw size={15} /> Renew membership</button>}</div>
          <div><h2 className="mb-3 text-lg font-bold text-slate-950">Available plans</h2><PlanGrid plans={plans} onSubscribe={runMemberCheckout} busy={busy} /></div>
        </section>}

        {section === "plans" && <section className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">{isMember ? "Available plans" : "Membership plans"}</h2><p className="mt-1 text-sm text-slate-500">Monthly, quarterly, yearly, and other gym plans.</p></div>{!isMember && canManagePlans && <button type="button" onClick={() => openPlanForm()} className="inline-flex h-9 items-center gap-2 bg-emerald-800 px-3 text-sm font-semibold text-white hover:bg-emerald-900"><Plus size={15} /> Add plan</button>}</div>{isMember ? <PlanGrid plans={plans} onSubscribe={runMemberCheckout} busy={busy} /> : <div className={`${panelClass} overflow-x-auto`}><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Features</th>{canManagePlans && <th className="px-4 py-3">Actions</th>}</tr></thead><tbody>{plans.map((plan) => <tr key={plan.id} className="border-t border-slate-200"><td className="px-4 py-3 font-semibold">{plan.name}</td><td className="px-4 py-3">{money(plan.price)}</td><td className="px-4 py-3">{plan.duration} days</td><td className="px-4 py-3">{plan.planType || "-"}</td><td className="px-4 py-3">{plan.features.join(", ") || "-"}</td>{canManagePlans && <td className="px-4 py-3"><div className="flex gap-3"><button type="button" onClick={() => openPlanForm(plan)} className="font-semibold text-emerald-800 hover:underline">Edit</button><button type="button" onClick={() => void removePlan(plan)} className="font-semibold text-rose-700 hover:underline">Delete</button></div></td>}</tr>)}{!plans.length && <tr><td colSpan={canManagePlans ? 6 : 5} className="px-4 py-10 text-center text-slate-500">No membership plans available.</td></tr>}</tbody></table></div>}</section>}

        {section === "features" && !isMember && canManagePlans && <section className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-950">Membership features</h2><p className="mt-1 text-sm text-slate-500">Manage amenities available to attach to plans.</p></div><button type="button" onClick={() => { setEditingFeature(null); setFeatureName(""); setModal("feature"); }} className="inline-flex h-9 items-center gap-2 bg-emerald-800 px-3 text-sm font-semibold text-white"><Plus size={15} /> Add feature</button></div><div className={`${panelClass} overflow-hidden`}><ul className="divide-y divide-slate-200">{features.map((feature) => <li key={idOf(feature)} className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-sm font-semibold">{feature.name}</span><div className="flex gap-3"><button type="button" onClick={() => { setEditingFeature(feature); setFeatureName(feature.name); setModal("feature"); }} className="text-sm font-semibold text-emerald-800">Edit</button><button type="button" onClick={() => void removeFeature(feature)} className="text-sm font-semibold text-rose-700">Delete</button></div></li>)}{!features.length && <li className="px-4 py-10 text-center text-sm text-slate-500">No features found.</li>}</ul></div></section>}

        {section === "subscriptions" && !isMember && canReadSubscriptions && <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">Member subscriptions</h2><p className="mt-1 text-sm text-slate-500">Review status, manage renewals, and find expiring memberships.</p></div>{canCreateSubscriptions && <button type="button" onClick={() => setModal("assign")} className="inline-flex h-9 items-center gap-2 bg-emerald-800 px-3 text-sm font-semibold text-white"><Plus size={15} /> Assign member</button>}</div><div className="flex flex-wrap gap-2"><select className={`${fieldClass} max-w-48`} value={subscriptionFilters.status} onChange={(event) => setSubscriptionFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{["ACTIVE", "EXPIRED", "PENDING", "CANCELLED"].map((status) => <option key={status} value={status}>{status}</option>)}</select><select className={`${fieldClass} max-w-56`} value={subscriptionFilters.planId} onChange={(event) => setSubscriptionFilters((current) => ({ ...current, planId: event.target.value }))}><option value="">All plans</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><label className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm"><input type="checkbox" checked={subscriptionFilters.expiring} onChange={(event) => setSubscriptionFilters((current) => ({ ...current, expiring: event.target.checked }))} /> Expiring soon</label></div><div className={`${panelClass} overflow-x-auto`}><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{subscriptions.map((subscription) => <tr key={idOf(subscription)} className="border-t border-slate-200"><td className="px-4 py-3 font-semibold">{memberName(subscription)}</td><td className="px-4 py-3">{planName(subscription)}</td><td className="px-4 py-3">{dateText(subscription.startDate || subscription.startedAt)}</td><td className="px-4 py-3">{dateText(subscription.expiryDate || subscription.endDate || subscription.expiresAt)}</td><td className="px-4 py-3">{statusText(subscription)}</td><td className="px-4 py-3"><div className="flex gap-3">{canUpdateSubscriptions && <><button type="button" onClick={() => void renewStaffMembership(subscription)} className="font-semibold text-emerald-800">Renew</button><button type="button" onClick={() => void cancelStaffMembership(subscription)} className="font-semibold text-rose-700">Cancel</button></>}</div></td></tr>)}{!subscriptions.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">No subscriptions found.</td></tr>}</tbody></table></div></section>}

        {section === "payments" && !isMember && canReadPayments && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">Membership payment history</h2><p className="mt-1 text-sm text-slate-500">Search, filter, update status, and export collected payments.</p></div><button type="button" onClick={() => void exportPayments()} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"><Download size={15} /> Export CSV</button></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><label className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input className={`${fieldClass} pl-9`} placeholder="Search member, plan, transaction" value={paymentFilters.search} onChange={(event) => { setPaymentFilters((current) => ({ ...current, search: event.target.value })); setPaymentPage(1); }} /></label><select className={fieldClass} value={paymentFilters.status} onChange={(event) => setPaymentFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select><select className={fieldClass} value={paymentFilters.paymentMethod} onChange={(event) => setPaymentFilters((current) => ({ ...current, paymentMethod: event.target.value }))}><option value="">All methods</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}</select><select className={fieldClass} value={paymentFilters.planId} onChange={(event) => setPaymentFilters((current) => ({ ...current, planId: event.target.value }))}><option value="">All plans</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><input aria-label="From date" type="date" className={fieldClass} value={paymentFilters.startDate} onChange={(event) => setPaymentFilters((current) => ({ ...current, startDate: event.target.value }))} /><input aria-label="To date" type="date" className={fieldClass} value={paymentFilters.endDate} onChange={(event) => setPaymentFilters((current) => ({ ...current, endDate: event.target.value }))} /></div><div className={`${panelClass} overflow-x-auto`}><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Transaction ID</th></tr></thead><tbody>{visiblePayments.map((payment) => <tr key={idOf(payment)} className="border-t border-slate-200"><td className="whitespace-nowrap px-4 py-3">{dateText(payment.paidAt || payment.paymentDate || payment.createdAt)}</td><td className="px-4 py-3 font-semibold">{memberName(payment)}</td><td className="px-4 py-3">{payment.member?.phone || payment.member?.phoneNumber || payment.phone || "-"}</td><td className="px-4 py-3">{planName(payment)}</td><td className="px-4 py-3">{money(payment.amount)}</td><td className="px-4 py-3">{String(payment.paymentMethod || payment.method || "-").replaceAll("_", " ")}</td><td className="px-4 py-3">{canUpdatePayments ? <select aria-label={`Update payment status for ${memberName(payment)}`} disabled={updatingPaymentId === idOf(payment)} className="border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-50" value={String(payment.status || "PENDING").toUpperCase() === "PARTIAL" ? "PARTIALLY_REFUNDED" : String(payment.status || "PENDING").toUpperCase()} onChange={(event) => void updatePaymentStatus(payment, event.target.value)}>{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select> : statusText(payment)}</td><td className="px-4 py-3">{payment.transactionId || payment.referenceId || payment.razorpayPaymentId || "-"}</td></tr>)}{!visiblePayments.length && <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-500">No payment records match these filters.</td></tr>}</tbody></table></div><div className="flex items-center justify-between text-sm text-slate-500"><span>{filteredPayments.length} records</span><div className="flex items-center gap-3"><button type="button" disabled={paymentPage <= 1} onClick={() => setPaymentPage((page) => page - 1)} className="font-semibold disabled:opacity-40">Previous</button><span>{paymentPage} / {Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE))}</span><button type="button" disabled={paymentPage >= Math.ceil(filteredPayments.length / PAGE_SIZE)} onClick={() => setPaymentPage((page) => page + 1)} className="font-semibold disabled:opacity-40">Next</button></div></div></section>}

        {section === "earnings" && !isMember && canReadPayments && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">Membership earnings</h2><p className="mt-1 text-sm text-slate-500">Revenue analytics grouped over time.</p></div><div role="group" aria-label="Earnings grouping" className="flex border border-slate-300 bg-white p-1"><button type="button" aria-pressed={earningsGroup === "monthly"} onClick={() => void loadEarnings("monthly")} className={`px-3 py-1.5 text-sm font-semibold ${earningsGroup === "monthly" ? "bg-emerald-800 text-white" : "text-slate-600"}`}>Monthly</button><button type="button" aria-pressed={earningsGroup === "yearly"} onClick={() => void loadEarnings("yearly")} className={`px-3 py-1.5 text-sm font-semibold ${earningsGroup === "yearly" ? "bg-emerald-800 text-white" : "text-slate-600"}`}>Yearly</button></div></div><div className={`${panelClass} p-4`}><div className="h-80">{earnings.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={earnings}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => money(value)} /><Bar dataKey="revenue" fill="#087f5b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="py-24 text-center text-sm text-slate-500">No earnings data available.</p>}</div></div></section>}

        {section === "my-payments" && isMember && <section className="space-y-4"><div><h2 className="text-lg font-bold text-slate-950">My payment history</h2><p className="mt-1 text-sm text-slate-500">Payments recorded for your membership only.</p></div><div className={`${panelClass} overflow-x-auto`}><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Transaction ID</th></tr></thead><tbody>{myPayments.map((payment) => <tr key={idOf(payment)} className="border-t border-slate-200"><td className="px-4 py-3">{dateText(payment.paidAt || payment.paymentDate || payment.createdAt)}</td><td className="px-4 py-3">{planName(payment)}</td><td className="px-4 py-3">{money(payment.amount)}</td><td className="px-4 py-3">{String(payment.paymentMethod || "-").replaceAll("_", " ")}</td><td className="px-4 py-3">{statusText(payment)}</td><td className="px-4 py-3">{payment.transactionId || payment.razorpayPaymentId || "-"}</td></tr>)}{!myPayments.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">No membership payments found.</td></tr>}</tbody></table></div></section>}
      </>}
    </div>

    {modal === "plan" && <Modal title={editingPlan ? "Edit membership plan" : "Create membership plan"} description="Set plan pricing, duration, type, and included features." onClose={() => setModal("")}><form onSubmit={savePlan} className="space-y-3"><label className="block text-sm font-semibold">Plan name<input required className={`${fieldClass} mt-1`} value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Price<input required min="0" type="number" className={`${fieldClass} mt-1`} value={planForm.price} onChange={(event) => setPlanForm((current) => ({ ...current, price: event.target.value }))} /></label><label className="block text-sm font-semibold">Duration (days)<input required min="1" type="number" className={`${fieldClass} mt-1`} value={planForm.duration} onChange={(event) => setPlanForm((current) => ({ ...current, duration: event.target.value }))} /></label></div><label className="block text-sm font-semibold">Plan type<input className={`${fieldClass} mt-1`} placeholder="Monthly, Quarterly, Yearly, or custom" value={planForm.planType} onChange={(event) => setPlanForm((current) => ({ ...current, planType: event.target.value }))} /></label><label className="block text-sm font-semibold">Description<textarea className="mt-1 min-h-20 w-full border border-slate-300 p-3 text-sm" value={planForm.description} onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))} /></label><fieldset className="space-y-2"><legend className="text-sm font-semibold">Features</legend>{features.map((feature) => <label key={idOf(feature)} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={planForm.featureIds.includes(idOf(feature))} onChange={(event) => setPlanForm((current) => ({ ...current, featureIds: event.target.checked ? [...current.featureIds, idOf(feature)] : current.featureIds.filter((id) => id !== idOf(feature)) }))} />{feature.name}</label>)}</fieldset><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal("")} className="h-9 border border-slate-300 px-4 text-sm font-semibold">Cancel</button><button type="submit" className="h-9 bg-emerald-800 px-4 text-sm font-semibold text-white">{editingPlan ? "Save changes" : "Create plan"}</button></div></form></Modal>}
    {modal === "feature" && <Modal title={editingFeature ? "Edit feature" : "Create feature"} description="Features appear on membership plans." onClose={() => setModal("")}><form onSubmit={saveFeature} className="space-y-4"><label className="block text-sm font-semibold">Feature name<input required minLength="2" className={`${fieldClass} mt-1`} value={featureName} onChange={(event) => setFeatureName(event.target.value)} /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setModal("")} className="h-9 border border-slate-300 px-4 text-sm font-semibold">Cancel</button><button type="submit" className="h-9 bg-emerald-800 px-4 text-sm font-semibold text-white">Save feature</button></div></form></Modal>}
    {modal === "record-payment" && <Modal title="Record membership payment" description="Record a payment against an existing subscription." onClose={() => setModal("")}><form onSubmit={submitPayment} className="space-y-3"><label className="block text-sm font-semibold">Subscription<select required className={`${fieldClass} mt-1`} value={paymentForm.subscriptionId} onChange={(event) => setPaymentForm((current) => ({ ...current, subscriptionId: event.target.value }))}><option value="">Select subscription</option>{subscriptions.map((subscription) => <option key={idOf(subscription)} value={idOf(subscription)}>{memberName(subscription)} · {planName(subscription)}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Amount<input required min="0" type="number" className={`${fieldClass} mt-1`} value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} /></label><label className="block text-sm font-semibold">Payment method<select className={`${fieldClass} mt-1`} value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}</select></label></div><label className="block text-sm font-semibold">Transaction ID<input className={`${fieldClass} mt-1`} value={paymentForm.transactionId} onChange={(event) => setPaymentForm((current) => ({ ...current, transactionId: event.target.value }))} /></label><label className="block text-sm font-semibold">Notes<input className={`${fieldClass} mt-1`} value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} /></label><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal("")} className="h-9 border border-slate-300 px-4 text-sm font-semibold">Cancel</button><button type="submit" className="h-9 bg-emerald-800 px-4 text-sm font-semibold text-white">Record payment</button></div></form></Modal>}
    {modal === "assign" && <Modal title="Assign membership" description="Choose a member and plan, then record payment in the same transaction." onClose={() => setModal("")}><form onSubmit={submitAssignment} className="space-y-3"><label className="block text-sm font-semibold">Member<select required className={`${fieldClass} mt-1`} value={assignForm.memberId} onChange={(event) => setAssignForm((current) => ({ ...current, memberId: event.target.value }))}><option value="">Select member</option>{members.map((member) => <option key={idOf(member)} value={idOf(member)}>{member.name || member.fullName || member.email || idOf(member)}</option>)}</select></label><label className="block text-sm font-semibold">Plan<select required className={`${fieldClass} mt-1`} value={assignForm.planId} onChange={(event) => { const selected = plans.find((plan) => String(plan.id) === event.target.value); setAssignForm((current) => ({ ...current, planId: event.target.value, amount: selected?.price ?? current.amount })); }}><option value="">Select plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Payment method<select className={`${fieldClass} mt-1`} value={assignForm.paymentMethod} onChange={(event) => setAssignForm((current) => ({ ...current, paymentMethod: event.target.value }))}>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}</select></label><label className="block text-sm font-semibold">Amount<input required min="0" type="number" className={`${fieldClass} mt-1`} value={assignForm.amount} onChange={(event) => setAssignForm((current) => ({ ...current, amount: event.target.value }))} /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Payment status<select className={`${fieldClass} mt-1`} value={assignForm.status} onChange={(event) => setAssignForm((current) => ({ ...current, status: event.target.value }))}><option value="PAID">Paid</option><option value="PENDING">Pending</option><option value="PARTIAL">Partial</option></select></label><label className="block text-sm font-semibold">Transaction ID<input className={`${fieldClass} mt-1`} value={assignForm.transactionId} onChange={(event) => setAssignForm((current) => ({ ...current, transactionId: event.target.value }))} /></label></div><label className="block text-sm font-semibold">Payment notes<input className={`${fieldClass} mt-1`} value={assignForm.notes} onChange={(event) => setAssignForm((current) => ({ ...current, notes: event.target.value }))} /></label><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal("")} className="h-9 border border-slate-300 px-4 text-sm font-semibold">Cancel</button><button type="submit" className="h-9 bg-emerald-800 px-4 text-sm font-semibold text-white">Assign and record</button></div></form></Modal>}
  </main>;
}

function PlanGrid({ plans, onSubscribe, busy }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{plans.map((plan) => <article key={plan.id} className={`${panelClass} flex flex-col p-5`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-950">{plan.name}</h3><p className="mt-1 text-sm text-slate-500">{plan.description || "Membership plan"}</p></div>{plan.planType && <span className="bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900">{plan.planType}</span>}</div><p className="mt-5 text-2xl font-bold text-slate-950">{money(plan.price)}<span className="ml-1 text-xs font-medium text-slate-500">/ {plan.duration} days</span></p><ul className="mt-4 flex-1 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">{plan.features.map((feature) => <li key={feature} className="flex items-center gap-2"><Check size={14} className="text-emerald-800" />{feature}</li>)}{!plan.features.length && <li>Plan benefits are available at the gym.</li>}</ul><button type="button" disabled={busy} onClick={() => void onSubscribe(plan)} className="mt-5 h-10 bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{busy ? "Opening checkout..." : "Subscribe online"}</button></article>)}{!plans.length && <p className="col-span-full border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No plans available right now.</p>}</div>;
}