import { useEffect, useState } from "react";
import { CalendarDays, Download, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import TablePagination from "../components/TablePagination";
import {
  exportMembershipPayments,
  getApiError,
  getAuthToken,
  getMembershipPayments,
  getMembershipPlans,
} from "../services/api";
import { canAccess, getPortalKey } from "../utils/rbac";

const PAGE_LIMIT = 20;
const STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
const METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "ONLINE"];
const EMPTY_FILTERS = { status: "", method: "", planId: "", from: "", to: "", search: "" };
const controlClass = "h-9 min-w-0 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs text-[#475569] outline-none focus:border-[#0D8252]";

function recordsFrom(response) {
  const payload = response?.data ?? response ?? {};
  const data = payload?.data?.data ?? payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  return data?.items || data?.results || data?.rows || data?.plans || [];
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function selectedParams(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
}

function paymentStatusClass(status) {
  if (status === "PAID") return "bg-[#EAFBF3] text-[#0D8252]";
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

export default function PaymentsHistory() {
  const { user } = useAuth();
  const token = user?.accessToken || user?.token || getAuthToken();
  const isMember = getPortalKey(user) === "member";
  const canReadPayments = canAccess(user, "payments", "read");
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_LIMIT);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [planError, setPlanError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (isMember || !canReadPayments) return undefined;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const params = {
        page,
        limit,
        ...selectedParams(filters),
      };
      try {
        const response = await getMembershipPayments(params, token);
        if (!active) return;
        const payload = response?.data ?? response ?? {};
        const result = payload?.data ?? {};
        const responseMeta = result?.meta ?? {};
        setPayments(Array.isArray(result?.data) ? result.data : []);
        setMeta({
          page: Number(responseMeta.page) || page,
          limit: Number(responseMeta.limit) || limit,
          total: Number(responseMeta.total) || 0,
          totalPages: Math.max(1, Number(responseMeta.totalPages) || 1),
        });
      } catch (requestError) {
        if (!active) return;
        setPayments([]);
        setMeta({ page, limit, total: 0, totalPages: 1 });
        setError(getApiError(requestError, "Unable to load payment history."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [canReadPayments, filters, isMember, limit, page, reloadKey, token]);

  useEffect(() => {
    if (isMember || !canReadPayments) return undefined;
    let active = true;
    getMembershipPlans({ limit: 100 }, token)
      .then((response) => {
        if (active) setPlans(recordsFrom(response));
      })
      .catch((requestError) => {
        if (active) setPlanError(getApiError(requestError, "Membership plans are unavailable."));
      });
    return () => { active = false; };
  }, [canReadPayments, isMember, token]);

  const changeFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const csv = await exportMembershipPayments(selectedParams(filters), token);
      const url = URL.createObjectURL(csv instanceof Blob ? csv : new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "payment-history.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      toast.error(getApiError(requestError, "Unable to export payment history."));
    } finally {
      setExporting(false);
    }
  };

  if (isMember) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Payment History is not available in the Member Portal. View your own payments under Membership.</div>;
  }

  if (!canReadPayments) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">You do not have permission to view payment history.</div>;
  }

  return <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Payment History</h1><p className="mt-1 text-xs text-[#64748B]">Membership payments across all members.</p></div>
        <span className="text-xs text-[#64748B]">{meta.total} records</span>
      </header>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="font-semibold underline">Retry</button></div>}

      <section aria-label="Payment history" className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-4 border-b border-[#EEF2F4] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-sm font-bold text-[#0F172A]">Payment records</h2><p className="mt-1 text-[11px] text-[#94A3B8]">Search and filter membership transactions.</p></div>
            <button type="button" onClick={() => void exportCsv()} disabled={exporting} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-wait disabled:opacity-60"><Download size={14} />{exporting ? "Exporting..." : "Export CSV"}</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative sm:col-span-2"><span className="sr-only">Search by member name, phone, or email</span><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" /><input type="search" value={filters.search} onChange={(event) => changeFilter("search", event.target.value)} placeholder="Search member, phone, or email" className={`${controlClass} w-full pl-9`} /></label>
            <select aria-label="Payment status" value={filters.status} onChange={(event) => changeFilter("status", event.target.value)} className={controlClass}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            <select aria-label="Payment method" value={filters.method} onChange={(event) => changeFilter("method", event.target.value)} className={controlClass}><option value="">All methods</option>{METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}</select>
            <select aria-label="Membership plan" value={filters.planId} onChange={(event) => changeFilter("planId", event.target.value)} className={controlClass}><option value="">All plans</option>{plans.map((plan) => <option key={plan.id || plan._id} value={plan.id || plan._id}>{plan.name}</option>)}</select>
            <label className="flex h-9 min-w-0 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-2"><CalendarDays size={13} className="shrink-0 text-[#94A3B8]" /><span className="sr-only">From date</span><input aria-label="From date" type="date" value={filters.from} onChange={(event) => changeFilter("from", event.target.value)} className="min-w-0 flex-1 text-[10px] text-[#475569] outline-none" /></label>
            <label className="flex h-9 min-w-0 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-2"><CalendarDays size={13} className="shrink-0 text-[#94A3B8]" /><span className="sr-only">To date</span><input aria-label="To date" type="date" value={filters.to} onChange={(event) => changeFilter("to", event.target.value)} className="min-w-0 flex-1 text-[10px] text-[#475569] outline-none" /></label>
            <div className="flex items-center gap-2"><label htmlFor="payments-page-size" className="shrink-0 text-[11px] text-[#64748B]">Rows</label><select id="payments-page-size" aria-label="Rows per page" value={limit} onChange={(event) => { setLimit(Math.min(100, Number(event.target.value) || PAGE_LIMIT)); setPage(1); }} className={`${controlClass} flex-1`}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></div>
            <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }} disabled={Object.values(filters).every((value) => !value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:opacity-50">Reset filters</button>
          </div>
          {planError && <p role="status" className="text-[11px] text-amber-700">Plan choices could not be loaded: {planError}</p>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase text-[#64748B]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Payment Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Transaction ID</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-[#64748B]">Loading payment history...</td></tr> : error ? <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-rose-700">Payment records could not be loaded.</td></tr> : payments.length ? payments.map((payment) => <tr key={payment.id || payment._id} className="border-t border-[#EEF2F4] text-[#475569]"><td className="whitespace-nowrap px-4 py-3">{formatDate(payment.createdAt)}</td><td className="px-4 py-3 font-semibold text-[#334155]">{payment.member?.name || "-"}</td><td className="px-4 py-3">{payment.member?.phoneNumber || "-"}</td><td className="px-4 py-3">{payment.plan?.name || "-"}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-[#334155]">{formatMoney(payment.amount)}</td><td className="px-4 py-3">{String(payment.method || "-").replaceAll("_", " ")}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${paymentStatusClass(String(payment.status || "").toUpperCase())}`}>{payment.status || "-"}</span></td><td className="max-w-48 truncate px-4 py-3" title={payment.transactionId || "-"}>{payment.transactionId || "-"}</td></tr>) : <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-[#94A3B8]">No payments match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between"><span>Showing {payments.length ? (meta.page - 1) * meta.limit + 1 : 0}-{(meta.page - 1) * meta.limit + payments.length} of {meta.total}</span><TablePagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} disabled={loading} previousLabel="Prev" /></footer>
      </section>
    </div>
  </div>;
}