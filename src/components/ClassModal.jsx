import { useState, useEffect } from "react";

const empty = {
  name: "",
  description: "",
  capacity: "",
  duration: "",
  level: "BEGINNER",
  trainerId: "",
};

export default function ClassModal({ isOpen, onClose, onSave, editData, trainers = [] }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.title || editData.name || "",
        description: editData.description || "",
        capacity: editData.capacity || "",
        duration: editData.duration || "",
        level: editData.level || "BEGINNER",
        trainerId: editData.trainerId || "",
      });
    } else {
      setForm(empty);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const fieldClass = "h-9 w-full rounded border px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const handleSubmit = () => {
    if (!form.name || !form.capacity || !form.duration) {
      alert("Name, capacity and duration are required");
      return;
    }

    onSave({ ...form });
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
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              placeholder="Capacity"
              className={fieldClass}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
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
              <option value="BEGINNER">BEGINNER</option>
              <option value="INTERMEDIATE">INTERMEDIATE</option>
              <option value="ADVANCED">ADVANCED</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">Cancel</button>
          <button onClick={handleSubmit} className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white">{editData ? "Update" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
