import { useState, useEffect } from "react";

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

  const fieldClass = "h-9 w-full rounded border px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-base font-bold">{editData ? "Edit Class" : "Create Class"}</h2>

        <div className="grid gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Class name"
            className={fieldClass}
          />

          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            rows={3}
            className={fieldClass}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={form.trainerId}
              onChange={(e) => setForm({ ...form, trainerId: e.target.value })}
              className={fieldClass}
            >
              <option value="">Assign trainer</option>
              {trainers.map((t) => (
                <option key={t.id || t._id || t.userId || t.email || t.name} value={t.id || t._id || t.userId || t.email || t.name}>
                  {t.name || t.fullName || t.email}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              placeholder="Duration (minutes)"
              className={fieldClass}
            />
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              className={fieldClass}
            >
              <option value="ALL">ALL</option>
              <option value="BEGINNER">BEGINNER</option>
              <option value="INTERMEDIATE">INTERMEDIATE</option>
              <option value="ADVANCED">ADVANCED</option>
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={fieldClass}
            >
              <option value="ONE_TIME">One-time</option>
              <option value="RECURRING">Recurring</option>
            </select>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className={fieldClass}
            />
          </div>

          {form.type === "RECURRING" && (
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className={fieldClass}
            />
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSubmit} className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white">{editData ? "Update" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
