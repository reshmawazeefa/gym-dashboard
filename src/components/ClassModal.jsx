import { useState, useEffect } from "react";
import { Dumbbell, X } from "lucide-react";

const empty = {
  name: "",
  description: "",
  duration: "",
  level: "ALL",
  trainerId: "",
  type: "ONE_TIME",
  startDate: "",
  endDate: "",
};

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

export default function ClassModal({ isOpen, onClose, onSave, editData, trainers = [] }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.title || editData.name || "",
        description: editData.description || "",
        duration: editData.duration || "",
        level: editData.level || "ALL",
        trainerId: editData.trainerId || "",
        type: editData.type || editData.classType || "ONE_TIME",
        startDate: toDatetimeLocal(editData.startDate || editData.date || ""),
        endDate: toDatetimeLocal(editData.endDate || ""),
      });
    } else {
      setForm(empty);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white focus:ring-2 focus:ring-[#0D8252]/10";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";

  const handleSubmit = () => {
    if (!form.name || !form.duration || !form.startDate) {
      alert("Name, duration, and start date are required");
      return;
    }

    if (form.type === "RECURRING") {
      if (!form.endDate) {
        alert("End date is required for recurring classes");
        return;
      }
      if (new Date(form.endDate) <= new Date(form.startDate)) {
        alert("End date must be after start date");
        return;
      }
    }

    const payload = {
      ...form,
      level: form.level || "ALL",
      duration: Number(form.duration),
      startDate: toIsoDateTime(form.startDate),
    };
    if (form.type === "RECURRING") {
      payload.endDate = toIsoDateTime(form.endDate);
    } else {
      payload.endDate = toIsoDateTime(form.startDate);
    }

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Dumbbell size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">{editData ? "Edit Class" : "Add Class"}</h2>
              <p className="mt-0.5 text-xs leading-4 text-[#64748B]">Configure scheduled class details, instructor assignment, and class timing.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close class modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3">
            <label>
              <span className={labelClass}>Class Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. High-Intensity Interval Training" className={fieldClass} />
            </label>

            <label>
              <span className={labelClass}>Description</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief summary of workout structure, prerequisites, and target members..." rows={3} className={`${fieldClass} h-auto min-h-20 resize-y`} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Assign Trainer</span>
                <select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })} className={fieldClass}>
                  <option value="">Select assigned trainer</option>
                  {trainers.map((t) => (
                    <option key={t.id || t._id || t.userId || t.email || t.name} value={t.id || t._id || t.userId || t.email || t.name}>{t.name || t.fullName || t.email}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Duration</span>
                <input type="number" min="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Duration (minutes)" className={fieldClass} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Class Level</span>
                <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={fieldClass}>
                  <option value="ALL">ALL (Open to All Levels)</option>
                  <option value="BEGINNER">BEGINNER</option>
                  <option value="INTERMEDIATE">INTERMEDIATE</option>
                  <option value="ADVANCED">ADVANCED</option>
                </select>
              </label>
              <label>
                <span className={labelClass}>Type</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={fieldClass}>
                  <option value="ONE_TIME">One-time</option>
                  <option value="RECURRING">Recurring</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Schedule Date &amp; Time</span>
                <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={fieldClass} />
              </label>
              {form.type === "RECURRING" && (
                <label>
                  <span className={labelClass}>End Date &amp; Time</span>
                  <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={fieldClass} />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FBFCFD] px-5 py-4">
          <button type="button" onClick={onClose} className="inline-flex h-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button type="button" onClick={handleSubmit} className="inline-flex h-8 items-center justify-center rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">{editData ? "Update Class" : "Save Class"}</button>
        </div>
      </div>
    </div>
  );
}
