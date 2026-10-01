import { Plus, UserPlus } from "lucide-react";
import BookingModalShell from "./BookingModalShell";

export default function AssignMemberModal({
  isOpen,
  onClose,
  assignBookingDate,
  setAssignBookingDate,
  assignSlotId,
  setAssignSlotId,
  setAvailableMembers,
  visibleSlots,
  formatTime,
  loadAvailableMembers,
  availableMembers,
  handleAssignMember,
  saving,
}) {
  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";

  return (
    <BookingModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Member"
      description="Only members available for this slot and date are shown."
      icon={UserPlus}
      sizeClass="max-w-lg"
      footer={<button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>}
    >
      <div className="grid gap-3">
        <label>
          <span className={labelClass}>Date</span>
          <input type="date" value={assignBookingDate} onChange={(event) => setAssignBookingDate(event.target.value)} className={fieldClass} />
        </label>
        <label>
          <span className={labelClass}>Time Slot</span>
          <select value={assignSlotId} onChange={(event) => { setAssignSlotId(event.target.value); setAvailableMembers([]); }} className={fieldClass}>
            <option value="">Select slot</option>
            {visibleSlots.map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void loadAvailableMembers(assignSlotId, assignBookingDate)} disabled={!assignSlotId || saving} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50">
          <Plus size={14} />
          Find Available Members
        </button>
      </div>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {availableMembers.map((member) => (
          <div key={member.id || member.userId} className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{member.name || member.fullName}</p>
              <p className="text-xs text-[#64748B]">{member.email}</p>
            </div>
            <button type="button" onClick={() => void handleAssignMember(member.id || member.userId)} disabled={saving} className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0D8252] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:opacity-50">
              <Plus size={14} />
              Assign
            </button>
          </div>
        ))}
        {assignSlotId && !availableMembers.length && <p className="py-5 text-center text-xs text-[#64748B]">Find available members for this slot.</p>}
      </div>
    </BookingModalShell>
  );
}
