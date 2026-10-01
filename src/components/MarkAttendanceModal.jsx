import { useState, useEffect } from "react";
import { ClipboardCheck } from "lucide-react";
import BookingModalShell from "./BookingModalShell";

const empty = { bookingId: "", status: "PRESENT" };

export default function MarkAttendanceModal({ isOpen, onClose, onSave, editData, bookings = [] }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editData) {
      setForm({
        bookingId: editData.bookingId || editData.id || editData._id || "",
        status: editData.status || editData.attendanceStatus || "PRESENT",
      });
    } else {
      setForm(empty);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";

  const handleSubmit = () => {
    if (!form.bookingId) {
      alert("Select a booking");
      return;
    }

    onSave({ ...form });
    onClose();
  };

  return (
    <BookingModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Mark Attendance"
      description="Update the attendance status for this booking."
      icon={ClipboardCheck}
      sizeClass="max-w-md"
      footer={(
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button type="button" onClick={handleSubmit} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save</button>
        </>
      )}
    >
      <div className="grid gap-3">
        <label>
          <span className={labelClass}>Attendance Status</span>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fieldClass}>
            <option value="PRESENT">PRESENT</option>
            <option value="ABSENT">ABSENT</option>
            <option value="LATE">LATE</option>
            <option value="PENDING">PENDING</option>
          </select>
        </label>
      </div>
    </BookingModalShell>
  );
}
