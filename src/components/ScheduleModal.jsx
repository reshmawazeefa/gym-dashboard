import { useState, useEffect } from "react";
import { CalendarClock, X } from "lucide-react";
import toast from "react-hot-toast";

const empty = {
  classId: "",
  scheduleId: "",
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
  maxCapacity: "",
};

function getClassDuration(classItem = {}) {
  const duration = classItem.duration ?? classItem.durationMinutes ?? classItem.raw?.duration ?? classItem.raw?.durationMinutes;
  const minutes = Number(duration);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function shiftTime(value, minutesToAdd) {
  if (!value || !Number.isFinite(minutesToAdd)) return "";

  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";

  const totalMinutes = (hours * 60 + minutes + minutesToAdd + 24 * 60) % (24 * 60);
  const nextHours = Math.floor(totalMinutes / 60);
  const nextMinutes = totalMinutes % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

export default function ScheduleModal({ isOpen, onClose, onSave, editData, selectedClassId = "", selectedScheduleId = "", initialDayOfWeek = "", classes = [], purpose = "slot", saving = false }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editData) {
      setForm({
        classId: editData.classId || editData.classId || "",
        scheduleId: editData.scheduleId || editData.classScheduleId || editData.schedule?.id || editData.schedule?._id || "",
        dayOfWeek: String(editData.dayOfWeek ?? "1"),
        startTime: editData.startTime || "",
        endTime: editData.endTime || "",
        maxCapacity: editData.maxCapacity || editData.capacity || "",
      });
    } else {
      setForm({ ...empty, classId: selectedClassId, scheduleId: selectedScheduleId, dayOfWeek: initialDayOfWeek || empty.dayOfWeek });
    }
  }, [editData, initialDayOfWeek, isOpen, selectedClassId, selectedScheduleId]);

  if (!isOpen) return null;

  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white focus:ring-2 focus:ring-[#0D8252]/10";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";
  const selectedClass = classes.find((item) => String(item.id || item._id) === String(form.classId));
  const classType = selectedClass?.type || selectedClass?.raw?.type || "ONE_TIME";
  const classDuration = getClassDuration(selectedClass);
  const isRecurring = classType === "RECURRING";
  const isScheduleOnlyMode = purpose === "schedule";
  const isEditMode = Boolean(editData);

  const dayOptions = [
    { value: "0", label: "Sunday" },
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
  ];

  const handleSubmit = async () => {
    if (!form.classId) {
      toast.error("Select a class");
      return;
    }
    if (isScheduleOnlyMode) {
      if (form.dayOfWeek === "") {
        toast.error("Day is required for recurring classes");
        return;
      }
      const saved = await onSave({ classId: form.classId, scheduleId: form.scheduleId, dayOfWeek: form.dayOfWeek, classType });
      if (saved !== false) onClose();
      return;
    }

    if (!form.startTime || !form.endTime || !form.maxCapacity) {
      toast.error("Start time, end time, and capacity are required for class slots");
      return;
    }
    const capacity = Number(form.maxCapacity);
    if (!Number.isInteger(capacity) || capacity <= 0) {
      toast.error("Capacity must be a whole number greater than zero");
      return;
    }
    if (form.startTime >= form.endTime) {
      toast.error("End time must be later than start time");
      return;
    }

    const saved = await onSave({ ...form, classType });
    if (saved !== false) onClose();
  };

  const handleClassChange = (classId) => {
    const nextClass = classes.find((item) => String(item.id || item._id) === String(classId));
    const duration = getClassDuration(nextClass);

    setForm((current) => {
      const next = { ...current, classId };
      if (!duration || isScheduleOnlyMode) return next;
      if (next.startTime) return { ...next, endTime: shiftTime(next.startTime, duration) };
      if (next.endTime) return { ...next, startTime: shiftTime(next.endTime, -duration) };
      return next;
    });
  };

  const handleStartTimeChange = (startTime) => {
    setForm((current) => ({
      ...current,
      startTime,
      endTime: classDuration ? shiftTime(startTime, classDuration) : current.endTime,
    }));
  };

  const handleEndTimeChange = (endTime) => {
    setForm((current) => ({
      ...current,
      startTime: classDuration ? shiftTime(endTime, -classDuration) : current.startTime,
      endTime,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={!saving ? onClose : undefined}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><CalendarClock size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                {purpose === "schedule" ? (isEditMode ? "Edit Schedule" : "Add Schedule") : (isEditMode ? "Edit Slot" : "Add Slot")}
              </h2>
              <p className="mt-0.5 text-xs leading-4 text-[#64748B]">
                {isScheduleOnlyMode
                  ? "Create a recurring schedule by choosing a weekday. No time or capacity required."
                  : isRecurring
                  ? "For recurring classes, provide slot times and capacity. A weekday will be associated with the slot."
                  : "Provide time and capacity for this one-time class slot."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close schedule modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3">
            <label>
              <span className={`${labelClass} opacity-60`}>Class</span>
              <select value={form.classId} onChange={(e) => handleClassChange(e.target.value)} className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`} disabled>
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id || c._id || c.title} value={c.id || c._id}>{c.title || c.name}</option>
                ))}
              </select>
            </label>

            <div className={`grid gap-3 ${isScheduleOnlyMode ? "sm:grid-cols-1" : isRecurring ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              {isRecurring && (
                <label>
                  <span className={labelClass}>Day</span>
                  <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} className={fieldClass}>
                    {dayOptions.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {!isScheduleOnlyMode && (
                <>
                  <label>
                    <span className={labelClass}>Start Time</span>
                    <input type="time" value={form.startTime} onChange={(e) => handleStartTimeChange(e.target.value)} className={fieldClass} />
                  </label>
                  <label>
                    <span className={labelClass}>End Time</span>
                    <input type="time" value={form.endTime} onChange={(e) => handleEndTimeChange(e.target.value)} className={fieldClass} />
                  </label>
                </>
              )}
            </div>

            {!isScheduleOnlyMode && (
              <label>
                <span className={labelClass}>Session Capacity</span>
                <input type="number" min="1" value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} placeholder="Session capacity" className={fieldClass} />
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FBFCFD] px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void handleSubmit()} disabled={saving} className="inline-flex h-8 items-center justify-center rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
