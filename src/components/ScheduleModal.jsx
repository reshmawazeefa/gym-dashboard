import { useState, useEffect } from "react";

const empty = {
  classId: "",
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
  maxCapacity: "",
};

export default function ScheduleModal({ isOpen, onClose, onSave, editData, classes = [], purpose = "slot" }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editData) {
      setForm({
        classId: editData.classId || editData.classId || "",
        dayOfWeek: String(editData.dayOfWeek ?? "1"),
        startTime: editData.startTime || "",
        endTime: editData.endTime || "",
        maxCapacity: editData.maxCapacity || editData.capacity || "",
      });
    } else {
      setForm(empty);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const fieldClass = "h-9 w-full rounded border px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const selectedClass = classes.find((item) => String(item.id || item._id) === String(form.classId));
  const classType = selectedClass?.type || selectedClass?.raw?.type || "ONE_TIME";
  const isRecurring = classType === "RECURRING";
  const isScheduleOnlyMode = purpose === "schedule";

  const dayOptions = [
    { value: "0", label: "Sunday" },
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
  ];

  const handleSubmit = () => {
    if (!form.classId) {
      alert("Select a class");
      return;
    }
    if (isScheduleOnlyMode) {
      if (form.dayOfWeek === "") {
        alert("Day is required for recurring classes");
        return;
      }
      onSave({ classId: form.classId, dayOfWeek: form.dayOfWeek, classType });
      onClose();
      return;
    }

    // For slot creation/edit, require times and capacity
    if (!form.startTime || !form.endTime || !form.maxCapacity) {
      alert("Start time, end time, and capacity are required for class slots");
      return;
    }

    onSave({ ...form, classType });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded bg-white p-4 shadow-xl">
        <h2 className="mb-1 text-base font-bold">
          {editData ? (purpose === "edit" ? "Edit Slot" : purpose === "schedule" ? "Edit Schedule" : "Edit Slot") : (purpose === "schedule" ? "Add Schedule" : "Add Class Slot")}
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          {isScheduleOnlyMode
            ? "Create a recurring schedule by choosing a weekday. No time or capacity required."
            : isRecurring
            ? "For recurring classes, provide slot times and capacity. A weekday will be associated with the slot."
            : "Provide time and capacity for this one-time class slot."}
        </p>

        <div className="grid gap-2">
          <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className={fieldClass}>
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id || c._id || c.title} value={c.id || c._id}>{c.title || c.name}</option>
            ))}
          </select>

          <div className={`grid gap-2 ${isScheduleOnlyMode ? "sm:grid-cols-1" : isRecurring ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {isRecurring && (
              <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} className={fieldClass}>
                {dayOptions.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            )}
            {!isScheduleOnlyMode && (
              <>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={fieldClass} />
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={fieldClass} />
              </>
            )}
          </div>

          {!isScheduleOnlyMode && (
            <input type="number" min="1" value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} placeholder="Session capacity" className={fieldClass} />
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSubmit} className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white">Save</button>
        </div>
      </div>
    </div>
  );
}
