import { CalendarClock } from "lucide-react";
import BookingModalShell from "./BookingModalShell";

export default function SlotChangesModal({ isOpen, onClose, booking, slotChanges, formatDate, formatSlotRange }) {
  if (!booking) return null;

  return (
    <BookingModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Slot Change History"
      description={`${booking.memberName || "Member"} · ${formatDate(booking.date)}`}
      icon={CalendarClock}
      sizeClass="max-w-lg"
      footer={<button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Close</button>}
    >
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {slotChanges.length ? slotChanges.map((change) => (
          <div key={change.id || `${change.bookingId}-${change.createdAt}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[#0F172A]">{change.isPermanent ? "Permanent" : "Temporary"} slot change</p>
              {change.createdAt && <span className="text-xs text-[#64748B]">{formatDate(change.createdAt)}</span>}
            </div>
            <p className="mt-2 text-xs text-[#475569]">{formatSlotRange(change.oldSlot || change.previousSlot)} <span className="mx-1">→</span> {formatSlotRange(change.newSlot || change.nextSlot)}</p>
            {change.date && <p className="mt-1 text-xs text-[#64748B]">Booking date: {formatDate(change.date)}</p>}
          </div>
        )) : <p className="py-8 text-center text-sm text-[#64748B]">No slot changes found for this booking.</p>}
      </div>
    </BookingModalShell>
  );
}
