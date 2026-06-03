import { useState, useEffect } from "react";

const empty = { bookingId: "", status: "PRESENT" };

export default function MarkAttendanceModal({ isOpen, onClose, onSave, editData, bookings = [] }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editData) setForm({ bookingId: editData.bookingId || editData.bookingId || "", status: editData.status || "PRESENT" });
    else setForm(empty);
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const fieldClass = "h-9 w-full rounded border px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const handleSubmit = () => {
    if (!form.bookingId) {
      alert("Select a booking");
      return;
    }

    onSave({ ...form });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-base font-bold">Mark Attendance</h2>

        <div className="grid gap-2">
          <select value={form.bookingId} onChange={(e) => setForm({ ...form, bookingId: e.target.value })} className={fieldClass}>
            <option value="">Select booking</option>
            {bookings.map((b) => (
              <option key={b.id || `${b.classTitle}-${b.date}`} value={b.id}>{b.classTitle} | {b.date ? new Date(b.date).toLocaleDateString() : b.date}</option>
            ))}
          </select>

          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fieldClass}>
            <option value="PRESENT">PRESENT</option>
            <option value="ABSENT">ABSENT</option>
            <option value="LATE">LATE</option>
          </select>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSubmit} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white">Save</button>
        </div>
      </div>
    </div>
  );
}
