import { RefreshCw } from "lucide-react";
import BookingModalShell from "./BookingModalShell";

export default function ChangeSlotModal({
  isOpen,
  onClose,
  booking,
  changeSlotTarget,
  setChangeSlotTarget,
  changeSlotType,
  setChangeSlotType,
  visibleSlots,
  formatTime,
  handleSlotChange,
  saving,
}) {
  if (!booking) return null;

  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";

  return (
    <BookingModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Change Slot"
      description={booking.memberName || "Member"}
      icon={RefreshCw}
      sizeClass="max-w-md"
      footer={(
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button type="button" disabled={!changeSlotTarget || saving} onClick={async () => { await handleSlotChange(booking.id || booking.bookingId, changeSlotTarget, changeSlotType === "permanent"); onClose(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50">Confirm Change</button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#64748B]">Current slot: <span className="font-semibold text-[#0F172A]">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span></div>
        <label>
          <span className={labelClass}>Change to</span>
          <select value={changeSlotTarget} onChange={(event) => setChangeSlotTarget(event.target.value)} className={fieldClass}>
            <option value="">Select new slot</option>
            {visibleSlots.filter((slot) => slot.id && slot.id !== booking.slotId).map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}
          </select>
        </label>
        <div className="space-y-2">
          <p className={labelClass}>Change type</p>
          <label className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${changeSlotType === "temporary" ? "border-[#B7E8CC] bg-[#F4FDF7]" : "border-[#E2E8F0]"}`}>
            <input type="radio" checked={changeSlotType === "temporary"} onChange={() => setChangeSlotType("temporary")} className="mt-0.5 accent-[#0D8252]" />
            <span><strong className="font-semibold text-[#334155]">This date only</strong><span className="block text-[#64748B]">Temporary change</span></span>
          </label>
          <label className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${changeSlotType === "permanent" ? "border-[#B7E8CC] bg-[#F4FDF7]" : "border-[#E2E8F0]"}`}>
            <input type="radio" checked={changeSlotType === "permanent"} onChange={() => setChangeSlotType("permanent")} className="mt-0.5 accent-[#0D8252]" />
            <span><strong className="font-semibold text-[#334155]">Permanently change slot</strong><span className="block text-[#64748B]">Future booking slot</span></span>
          </label>
        </div>
      </div>
    </BookingModalShell>
  );
}
