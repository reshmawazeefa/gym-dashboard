import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Eye, FileText, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { getApiError, getAuthToken, getPaymentOrder, getPaymentOrders, getPayrollPayments } from "../services/api";
import TablePagination from "../components/TablePagination";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 100;
const TABLE_PAGE_SIZE = 10;
const MEMBER_TYPES = ["Membership Plan", "Renewal", "Registration", "Add-on", "Product", "Other"];
const STAFF_TYPES = ["Salary", "Advance", "Bonus", "Deduction", "Reimbursement"];
const METHODS = ["Cash", "Card", "UPI", "Bank Transfer"];
const STATUSES = ["Paid", "Pending", "Partial", "Refunded", "Failed", "Waived"];
const EMPTY_FILTERS = { search: "", type: "", method: "", status: "", startDate: "", endDate: "" };

function unwrapList(response) {
  const payload = response?.data ?? response ?? {};
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  return data?.items || data?.results || data?.rows || payload?.items || [];
}

function unwrapMeta(response) {
  const payload = response?.data ?? response ?? {};
  return payload?.meta || payload?.data?.meta || {};
}

async function getAllPages(fetchPage, token) {
  const records = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetchPage({ page, limit: PAGE_SIZE }, token);
    const batch = unwrapList(response);
    records.push(...batch);
    const meta = unwrapMeta(response);
    totalPages = Number(meta.totalPages || meta.pages || 0) || (batch.length === PAGE_SIZE ? page + 1 : page);
    page += 1;
  } while (page <= totalPages && page <= 100);
  return records;
}

function idOf(record) {
  return String(record?.paymentId || record?.id || record?._id || record?.orderId || record?.uuid || "");
}

function fullName(record) {
  return record?.member?.name || record?.member?.fullName || record?.staff?.name || record?.staff?.fullName
    || record?.user?.name || record?.user?.fullName || record?.customer?.name || record?.memberName
    || record?.staffName || record?.userName || record?.name || "-";
}

function paymentStatus(record) {
  const value = String(record?.status || "").trim().toUpperCase().replaceAll(" ", "_");
  if (["PAID", "CAPTURED", "SETTLED", "RECORDED", "SUCCESS", "COMPLETED"].includes(value)) return "Paid";
  if (["PARTIAL", "PARTIALLY_PAID"].includes(value)) return "Partial";
  if (["REFUNDED", "REFUND", "PARTIALLY_REFUNDED"].includes(value)) return "Refunded";
  if (["VOID", "CANCELLED", "CANCELED", "WAIVED", "WRITTEN_OFF", "WRITTEN_OFF"].includes(value)) return "Waived";
  if (["FAILED", "PAYMENT_FAILED", "EXPIRED"].includes(value)) return "Failed";
  if (["PENDING", "CREATED", "AUTHORIZED", "PENDING_PAYMENT", "PROCESSING"].includes(value)) return "Pending";
  return value ? value.replaceAll("_", " ") : "Pending";
}

function normalizeType(record, scope) {
  if (scope === "staff") {
    const staffType = String(record?.paymentType || record?.type || "salary").toLowerCase();
    if (staffType.includes("advance")) return "Advance";
    if (staffType.includes("bonus")) return "Bonus";
    if (staffType.includes("deduction")) return "Deduction";
    if (staffType.includes("reimburse")) return "Reimbursement";
    return "Salary";
  }
  const raw = String(record?.paymentType || record?.category || record?.purpose || record?.type || "").toLowerCase();
  if (raw.includes("renew")) return "Renewal";
  if (raw.includes("registration")) return "Registration";
  if (raw.includes("addon") || raw.includes("add-on")) return "Add-on";
  if (raw.includes("product")) return "Product";
  if (raw.includes("membership") || raw.includes("plan") || record?.plan || record?.membershipPlan) return "Membership Plan";
  return "Other";
}

function normalizePayment(record, scope) {
  const transaction = record?.transactions?.[0] || record?.transaction || {};
  const paymentDate = record?.paidOn || record?.paidAt || record?.paymentDate || record?.date || record?.createdAt || "";
  const purpose = String(record?.purpose || "").toUpperCase();
  const amount = Number(record?.amount ?? record?.totalAmount ?? 0) || 0;
  const paidAmount = Number(record?.paidAmount ?? record?.amountPaid ?? record?.collectedAmount ?? 0) || 0;
  if (scope === "member" && purpose.includes("SAAS")) return null;
  return {
    id: idOf(record) || `${scope}-${paymentDate}-${record?.amount || 0}`,
    reference: record?.referenceId || record?.receiptNumber || record?.providerOrderId || idOf(record) || "-",
    person: fullName(record),
    scope,
    type: normalizeType(record, scope),
    amount,
    method: record?.paymentMethod || record?.method || transaction?.paymentMethod || transaction?.method || "-",
    paymentDate,
    dueDate: record?.dueDate || record?.dueOn || record?.expectedDate || "",
    status: paymentStatus(record),
    transactionId: record?.transactionId || record?.providerPaymentId || transaction?.providerPaymentId || transaction?.paymentId || record?.bankReference || "-",
    pendingAmount: Number(record?.pendingAmount ?? record?.dueAmount ?? record?.remainingAmount ?? Math.max(0, amount - paidAmount)) || 0,
    refundedAmount: Number(record?.refundedAmount ?? record?.refundAmount ?? 0) || 0,
    raw: record,
  };
}

function asDate(value) {
  if (!value) return null;
  const calendarDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (calendarDate) return new Date(Number(calendarDate[1]), Number(calendarDate[2]) - 1, Number(calendarDate[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = asDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(value) {
  const date = asDate(value);
  return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
}

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function isLoss(payment) {
  return ["Waived", "Cancelled", "Canceled", "Written Off"].includes(payment.status);
}

function collected(payment) {
  if (payment.status === "Paid") return payment.amount;
  return payment.status === "Partial" ? Math.max(0, payment.amount - payment.pendingAmount) : 0;
}

function refunded(payment) {
  return payment.status === "Refunded" ? (payment.refundedAmount || payment.amount) : payment.refundedAmount;
}

function pending(payment) {
  return ["Pending", "Partial"].includes(payment.status) ? payment.pendingAmount : 0;
}

function aggregate(payments) {
  const totalCollected = payments.reduce((sum, payment) => sum + collected(payment), 0);
  const totalPending = payments.reduce((sum, payment) => sum + pending(payment), 0);
  const totalRefunded = payments.reduce((sum, payment) => sum + refunded(payment), 0);
  const totalLoss = payments.filter(isLoss).reduce((sum, payment) => sum + payment.amount, 0);
  return { totalCollected, totalPending, totalRefunded, totalLoss, netIncome: totalCollected - totalRefunded - totalLoss };
}

function cleanCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function saveCsv(payments) {
  const header = ["Payment ID", "Member / Staff", "Payment For", "Amount", "Payment Method", "Payment Date", "Due Date", "Status", "Transaction ID", "Type"];
  const rows = payments.map((payment) => [payment.reference, payment.person, payment.type, payment.amount, payment.method, dateKey(payment.paymentDate), dateKey(payment.dueDate), payment.status, payment.transactionId, payment.scope]);
  const content = [header, ...rows].map((row) => row.map(cleanCsv).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "payment-history.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printReceipt(payment) {
  const receiptWindow = window.open("", "_blank", "width=720,height=800");
  if (!receiptWindow) {
    toast.error("Allow pop-ups to open the receipt.");
    return;
  }
  const escape = (value) => String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  receiptWindow.document.write(`<!doctype html><html><head><title>Payment Receipt</title><style>body{font:14px Arial,sans-serif;color:#0f172a;padding:40px}main{max-width:560px;margin:auto;border:1px solid #dbe3e8;border-radius:12px;padding:28px}h1{font-size:22px}h1,small{color:#0d8252}.row{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid #e8edf0}.row span:first-child{color:#64748b}@media print{body{padding:0}main{border:0}}</style></head><body><main><small>PAYMENT RECEIPT</small><h1>${escape(payment.person)}</h1><div class="row"><span>Payment ID</span><strong>${escape(payment.reference)}</strong></div><div class="row"><span>Payment For</span><strong>${escape(payment.type)}</strong></div><div class="row"><span>Amount</span><strong>${escape(money(payment.amount))}</strong></div><div class="row"><span>Method</span><strong>${escape(payment.method)}</strong></div><div class="row"><span>Payment Date</span><strong>${escape(displayDate(payment.paymentDate))}</strong></div><div class="row"><span>Status</span><strong>${escape(payment.status)}</strong></div><div class="row"><span>Transaction ID</span><strong>${escape(payment.transactionId)}</strong></div></main><script>window.onload=()=>window.print()</script></body></html>`);
  receiptWindow.document.close();
}

function DetailModal({ payment, receipt, onClose }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  const rows = [["Payment ID", payment.reference], ["Member / Staff", payment.person], ["Payment For", payment.type], ["Amount", money(payment.amount)], ["Payment Method", payment.method], ["Payment Date", displayDate(payment.paymentDate)], ["Due Date", displayDate(payment.dueDate)], ["Status", payment.status], ["Transaction ID", payment.transactionId]];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="payment-detail-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
      <header className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><FileText size={18} /></span><div><h2 id="payment-detail-title" className="text-base font-bold text-[#0F172A]">{receipt ? "Payment Receipt" : "Payment Details"}</h2><p className="mt-0.5 text-xs text-[#64748B]">{payment.reference}</p></div></div><button type="button" onClick={onClose} aria-label="Close payment details" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9]"><X size={17} /></button></header>
      <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] p-3"><p className="text-[10px] font-bold uppercase text-[#94A3B8]">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[#334155]">{value || "-"}</p></div>)}</div>
      <footer className="flex justify-end gap-2 border-t border-[#E2E8F0] px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#475569]">Close</button><button type="button" onClick={() => printReceipt(payment)} className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white hover:bg-[#086B43]">Print receipt</button></footer>
    </section>
  </div>;
}

export default function Payments() {
  const { user } = useAuth();
  const token = user?.accessToken || user?.token || getAuthToken();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceErrors, setSourceErrors] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [reportPeriod, setReportPeriod] = useState("monthly");
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [tablePage, setTablePage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [memberResult, staffResult] = await Promise.allSettled([
        getAllPages(getPaymentOrders, token),
        getAllPages(getPayrollPayments, token),
      ]);
      if (!active) return;
      const nextPayments = [];
      const errors = [];
      if (memberResult.status === "fulfilled") nextPayments.push(...memberResult.value.map((record) => normalizePayment(record, "member")).filter(Boolean));
      else errors.push(`Member payments: ${getApiError(memberResult.reason, "Unable to load member transactions")}`);
      if (staffResult.status === "fulfilled") nextPayments.push(...staffResult.value.map((record) => normalizePayment(record, "staff")));
      else errors.push(`Staff payments: ${getApiError(staffResult.reason, "Unable to load staff transactions")}`);
      setPayments(nextPayments.sort((first, second) => (asDate(second.paymentDate)?.getTime() || 0) - (asDate(first.paymentDate)?.getTime() || 0)));
      setSourceErrors(errors);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [token]);

  const scopedPayments = useMemo(() => activeTab === "all" ? payments : payments.filter((payment) => payment.scope === (activeTab === "members" ? "member" : "staff")), [activeTab, payments]);
  const filteredPayments = useMemo(() => scopedPayments.filter((payment) => {
    const query = filters.search.trim().toLowerCase();
    const searchMatch = !query || [payment.reference, payment.person, payment.transactionId].some((value) => String(value || "").toLowerCase().includes(query));
    const methodMatch = !filters.method || payment.method.toLowerCase().replaceAll("_", " ") === filters.method.toLowerCase();
    const paymentDate = dateKey(payment.paymentDate);
    const dateMatch = (!filters.startDate || paymentDate >= filters.startDate) && (!filters.endDate || paymentDate <= filters.endDate);
    return searchMatch && (!filters.type || payment.type.toLowerCase() === filters.type.toLowerCase()) && methodMatch && (!filters.status || payment.status.toLowerCase() === filters.status.toLowerCase()) && dateMatch;
  }), [filters, scopedPayments]);

  const now = new Date();
  const monthlyPayments = scopedPayments.filter((payment) => {
    const date = asDate(payment.paymentDate);
    return date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const yearlyPayments = scopedPayments.filter((payment) => asDate(payment.paymentDate)?.getFullYear() === now.getFullYear());
  const summaries = [
    { label: "Monthly Income", value: monthlyPayments.reduce((sum, payment) => sum + collected(payment), 0), detail: "Collected this month", icon: <CalendarDays size={18} />, color: "text-[#0D8252]", surface: "bg-[#EAFBF3]" },
    { label: "Pending Payments", value: scopedPayments.reduce((sum, payment) => sum + pending(payment), 0), detail: "Outstanding balance", icon: <FileText size={18} />, color: "text-amber-700", surface: "bg-amber-50" },
    { label: "Monthly Loss / Waived", value: monthlyPayments.reduce((sum, payment) => sum + (isLoss(payment) ? payment.amount : 0) + refunded(payment), 0), detail: "Refunded, waived, or cancelled", icon: <X size={18} />, color: "text-rose-700", surface: "bg-rose-50" },
    { label: "Yearly Income", value: yearlyPayments.reduce((sum, payment) => sum + collected(payment), 0), detail: "Collected this year", icon: <Download size={18} />, color: "text-sky-700", surface: "bg-sky-50" },
  ];

  const availableYears = [...new Set(scopedPayments.map((payment) => asDate(payment.paymentDate)?.getFullYear()).filter(Boolean))].sort((first, second) => second - first);
  if (!availableYears.includes(now.getFullYear())) availableYears.unshift(now.getFullYear());
  const reportRows = reportPeriod === "monthly"
    ? Array.from({ length: 12 }, (_, index) => {
      const monthPayments = scopedPayments.filter((payment) => {
        const date = asDate(payment.paymentDate);
        return date?.getFullYear() === Number(reportYear) && date.getMonth() === index;
      });
      return { label: new Date(Number(reportYear), index, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }), ...aggregate(monthPayments) };
    })
    : availableYears.map((year) => ({ label: String(year), ...aggregate(scopedPayments.filter((payment) => asDate(payment.paymentDate)?.getFullYear() === year)) }));

  const reportSize = reportPeriod === "monthly" ? 6 : 5;
  const reportTotalPages = Math.max(1, Math.ceil(reportRows.length / reportSize));
  const visibleReportRows = reportRows.slice((reportPage - 1) * reportSize, reportPage * reportSize);
  const tableTotalPages = Math.max(1, Math.ceil(filteredPayments.length / TABLE_PAGE_SIZE));
  const visiblePayments = filteredPayments.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);
  const typeOptions = activeTab === "members" ? MEMBER_TYPES : activeTab === "staff" ? STAFF_TYPES : [...MEMBER_TYPES, ...STAFF_TYPES];

  const changeTab = (tab) => { setActiveTab(tab); setTablePage(1); setReportPage(1); setFilters(EMPTY_FILTERS); };
  const changeFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setTablePage(1); };
  const resetFilters = () => { setFilters(EMPTY_FILTERS); setTablePage(1); };

  const openDetails = async (payment, receipt = false) => {
    setSelectedPayment(payment);
    setShowReceipt(receipt);
    if (payment.scope !== "member" || !payment.raw?.id && !payment.raw?._id) return;
    setDetailsLoading(true);
    try {
      const response = await getPaymentOrder(payment.raw.id || payment.raw._id, token);
      const detail = response?.data?.data || response?.data || response;
      setSelectedPayment(normalizePayment({ ...payment.raw, ...detail }, "member") || payment);
    } catch (error) {
      toast.error(getApiError(error, "Unable to load payment details"));
    } finally {
      setDetailsLoading(false);
    }
  };

  return <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Payment History</h1><p className="mt-0.5 text-xs text-[#64748B]">Member Payment Collections & Staff Payments  </p></div>
        <span className="text-xs text-[#64748B]">{scopedPayments.length} transactions</span>
      </header>

      <div role="tablist" aria-label="Payment type" className="flex gap-5 border-b border-[#E2E8F0]">
        {[ ["all", "All"], ["members", "Members"], ["staff", "Staff"] ].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeTab === key} onClick={() => changeTab(key)} className={`h-10 px-1 text-xs font-semibold transition ${activeTab === key ? "border-b-2 border-[#0D8252] text-[#0D8252]" : "text-[#64748B] hover:text-[#0F172A]"}`}>{label}</button>)}
      </div>

      {sourceErrors.length > 0 && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Some payment sources could not be loaded: {sourceErrors.join("; ")}</div>}

      <section aria-label="Payment summaries" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map(({ label, value, detail, icon, color, surface }) => <article key={label} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</p><p className="mt-2 text-xl font-extrabold text-[#0F172A]">{money(value)}</p><p className="mt-1 text-[10px] text-[#94A3B8]">{detail}</p></div><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${surface} ${color}`}>{icon}</span></article>)}
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#EEF2F4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-[#0F172A]">Monthly &amp; Yearly Report</h2><p className="mt-0.5 text-[11px] text-[#94A3B8]">Calculated from the selected payment records.</p></div><div className="flex flex-wrap items-center gap-2"><div role="tablist" aria-label="Report period" className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1"><button role="tab" aria-selected={reportPeriod === "monthly"} type="button" onClick={() => { setReportPeriod("monthly"); setReportPage(1); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${reportPeriod === "monthly" ? "bg-[#0D8252] text-white" : "text-[#64748B]"}`}>Monthly Report</button><button role="tab" aria-selected={reportPeriod === "yearly"} type="button" onClick={() => { setReportPeriod("yearly"); setReportPage(1); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${reportPeriod === "yearly" ? "bg-[#0D8252] text-white" : "text-[#64748B]"}`}>Yearly Report</button></div>{reportPeriod === "monthly" && <select aria-label="Report year" value={reportYear} onChange={(event) => { setReportYear(event.target.value); setReportPage(1); }} className="h-8 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs text-[#475569]">{availableYears.map((year) => <option key={year}>{year}</option>)}</select>}</div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase text-[#64748B]"><tr><th className="px-4 py-3">{reportPeriod === "monthly" ? "Month" : "Year"}</th><th className="px-4 py-3">Total Collected</th><th className="px-4 py-3">Pending</th><th className="px-4 py-3">Refunded</th><th className="px-4 py-3">Loss / Waived</th><th className="px-4 py-3">Net Income</th></tr></thead><tbody>{visibleReportRows.map((row) => <tr key={row.label} className="border-t border-[#EEF2F4] text-[#475569]"><td className="px-4 py-3 font-semibold text-[#334155]">{row.label}</td><td className="px-4 py-3">{money(row.totalCollected)}</td><td className="px-4 py-3">{money(row.totalPending)}</td><td className="px-4 py-3">{money(row.totalRefunded)}</td><td className="px-4 py-3">{money(row.totalLoss)}</td><td className="px-4 py-3 font-semibold text-[#0D8252]">{money(row.netIncome)}</td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B]"><span>{reportRows.length} report periods</span><TablePagination page={reportPage} totalPages={reportTotalPages} onPageChange={setReportPage} previousLabel="Prev" /></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-[#0F172A]">Payment History</h2><p className="mt-0.5 text-[11px] text-[#94A3B8]">Search and filter transactions.</p></div><button type="button" onClick={() => { saveCsv(filteredPayments); toast.success("Payment history exported"); }} disabled={!filteredPayments.length} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50"><Download size={14} />Export CSV</button></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <label className="relative sm:col-span-2"><span className="sr-only">Search payments</span><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" /><input type="search" value={filters.search} onChange={(event) => changeFilter("search", event.target.value)} placeholder="Search ID, person, transaction..." className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] pl-9 pr-3 text-xs outline-none focus:border-[#0D8252]" /></label>
            <select aria-label="Payment type" value={filters.type} onChange={(event) => changeFilter("type", event.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs text-[#475569]"><option value="">All payment types</option>{typeOptions.map((type) => <option key={type}>{type}</option>)}</select>
            <select aria-label="Payment method" value={filters.method} onChange={(event) => changeFilter("method", event.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs text-[#475569]"><option value="">All methods</option>{METHODS.map((method) => <option key={method}>{method}</option>)}</select>
            <select aria-label="Payment status" value={filters.status} onChange={(event) => changeFilter("status", event.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs text-[#475569]"><option value="">All statuses</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
            <button type="button" onClick={resetFilters} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Reset</button>
            <label className="flex h-9 items-center gap-1 rounded-lg border border-[#E2E8F0] px-2"><CalendarDays size={13} className="shrink-0 text-[#94A3B8]" /><span className="sr-only">Start date</span><input aria-label="Start date" type="date" value={filters.startDate} onChange={(event) => changeFilter("startDate", event.target.value)} className="min-w-0 flex-1 text-[10px] text-[#475569] outline-none" /></label>
            <label className="flex h-9 items-center gap-1 rounded-lg border border-[#E2E8F0] px-2"><CalendarDays size={13} className="shrink-0 text-[#94A3B8]" /><span className="sr-only">End date</span><input aria-label="End date" type="date" value={filters.endDate} onChange={(event) => changeFilter("endDate", event.target.value)} className="min-w-0 flex-1 text-[10px] text-[#475569] outline-none" /></label>
          </div>
        </div>
        {loading ? <div className="p-10 text-center text-sm text-[#64748B]">Loading payment history...</div> : <>
          <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-xs"><thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase text-[#64748B]"><tr><th className="px-4 py-3">Payment ID</th><th className="px-4 py-3">Member / Staff</th><th className="px-4 py-3">Payment For</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Payment Method</th><th className="px-4 py-3">Payment Date</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Transaction ID</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{visiblePayments.map((payment) => <tr key={`${payment.scope}-${payment.id}`} className="border-t border-[#EEF2F4] text-[#475569]"><td className="max-w-36 truncate px-4 py-3 font-semibold text-[#334155]" title={payment.reference}>{payment.reference}</td><td className="px-4 py-3"><span className="font-semibold text-[#334155]">{payment.person}</span><span className="ml-1 text-[10px] text-[#94A3B8]">{payment.scope === "member" ? "Member" : "Staff"}</span></td><td className="px-4 py-3">{payment.type}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-[#334155]">{money(payment.amount)}</td><td className="px-4 py-3">{payment.method.replaceAll("_", " ")}</td><td className="whitespace-nowrap px-4 py-3">{displayDate(payment.paymentDate)}</td><td className="whitespace-nowrap px-4 py-3">{displayDate(payment.dueDate)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${payment.status === "Paid" ? "bg-[#EAFBF3] text-[#0D8252]" : ["Pending", "Partial"].includes(payment.status) ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{payment.status}</span></td><td className="max-w-36 truncate px-4 py-3" title={payment.transactionId}>{payment.transactionId}</td><td className="whitespace-nowrap px-4 py-3"><button type="button" onClick={() => void openDetails(payment)} aria-label={`View payment ${payment.reference}`} className="mr-2 inline-flex items-center gap-1 font-semibold text-[#0D8252] hover:text-[#086B43]"><Eye size={13} />View</button><button type="button" onClick={() => void openDetails(payment, true)} aria-label={`Open receipt for ${payment.reference}`} className="inline-flex items-center gap-1 font-semibold text-[#475569] hover:text-[#0D8252]"><FileText size={13} />Receipt</button>{payment.raw?.editable === true && <button type="button" disabled title="This payment source does not provide an edit API" className="ml-2 font-semibold text-[#94A3B8]">Edit</button>}</td></tr>)}
            {!visiblePayments.length && <tr><td colSpan="10" className="px-4 py-12 text-center text-sm text-[#94A3B8]">{sourceErrors.length && !payments.length ? "Payment records are unavailable." : "No payments match these filters."}</td></tr>}</tbody></table></div>
          <div className="flex items-center justify-between border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B]"><span>{filteredPayments.length} records</span><TablePagination page={tablePage} totalPages={tableTotalPages} onPageChange={setTablePage} previousLabel="Prev" /></div>
        </>}
      </section>
    </div>
    {selectedPayment && <DetailModal payment={selectedPayment} receipt={showReceipt} onClose={() => { setSelectedPayment(null); setShowReceipt(false); }} />}
    {detailsLoading && <div role="status" className="fixed bottom-4 right-4 rounded-lg bg-white px-3 py-2 text-xs text-[#475569] shadow-lg">Loading payment details...</div>}
  </div>;
}
