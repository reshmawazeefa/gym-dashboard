const positiveStatuses = new Set([
  "ACTIVE",
  "ASSIGNED",
  "BOOKED",
  "CAPTURED",
  "COMPLETE",
  "COMPLETED",
  "ENABLED",
  "GENERATED",
  "PAID",
  "PRESENT",
  "READ",
  "SCHEDULED",
  "SENT",
  "SUCCESS",
]);

const negativeStatuses = new Set([
  "ABSENT",
  "BLOCKED",
  "CANCELLED",
  "CANCELED",
  "DECLINED",
  "DISABLED",
  "EXPIRED",
  "FAILED",
  "INACTIVE",
  "OUT_OF_SERVICE",
  "OVERDUE",
  "PAYMENT_FAILED",
]);

const attentionStatuses = new Set([
  "AUTO_CLOSED",
  "IN_PROGRESS",
  "LATE",
  "PENDING",
  "PENDING_PAYMENT",
  "REVIEW",
  "UNREAD",
]);

function getStatusTone(status) {
  const normalized = String(status || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (positiveStatuses.has(normalized)) {
    return { track: "bg-[#0D8252]", text: "text-[#0D8252]", isPositive: true };
  }
  if (negativeStatuses.has(normalized)) {
    return { track: "bg-red-200", text: "text-red-700", isPositive: false };
  }
  if (attentionStatuses.has(normalized)) {
    return { track: "bg-amber-200", text: "text-amber-700", isPositive: false };
  }
  return { track: "bg-gray-200", text: "text-gray-700", isPositive: false };
}

export default function StatusBadge({ status, label = status || "-", onClick, disabled = false, ariaLabel, children, className = "" }) {
  const tone = getStatusTone(status);
  const Wrapper = onClick ? "button" : children ? "label" : "span";

  return (
    <Wrapper
      {...(onClick ? { type: "button", onClick, disabled, "aria-label": ariaLabel } : {})}
      className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-left transition ${onClick ? "focus:outline-none focus:ring-2 focus:ring-[#0D8252]/20 disabled:cursor-not-allowed disabled:opacity-60" : children ? `text-[10px] font-semibold ${tone.text}` : ""} ${className}`}
    >
      <span aria-hidden="true" className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${onClick ? "cursor-pointer" : ""} ${tone.track}`}>
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${tone.isPositive ? "translate-x-4" : "translate-x-0"}`} />
      </span>
      {children || <span className={`text-[10px] font-semibold ${tone.text}`}>{label}</span>}
    </Wrapper>
  );
}