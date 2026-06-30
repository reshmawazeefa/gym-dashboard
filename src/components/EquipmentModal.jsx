import { useEffect, useState } from "react";

const maintenanceStatusOptions = ["PENDING", "COMPLETED", "CANCELLED"];

const inputClass =
  "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass =
  "min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const emptyForm = {
  title: "",
  description: "",
  maintenanceDate: "",
  cost: "",
  vendor: "",
  nextDueDate: "",
  status: "PENDING",
};

export default function EquipmentModal({ isOpen, onClose, onSave, editData }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        title: editData.title || "",
        description: editData.description || "",
        maintenanceDate: editData.maintenanceDate || "",
        cost: editData.cost ?? "",
        vendor: editData.vendor || "",
        nextDueDate: editData.nextDueDate || "",
        status: editData.status || "PENDING",
      });
    } else {
      setForm(emptyForm);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || form.title.trim().length < 2) {
      alert("Title is required (min 2 characters)");
      return;
    }
    if (!form.maintenanceDate) {
      alert("Maintenance date is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        maintenanceDate: new Date(form.maintenanceDate).toISOString(),
        cost: form.cost ? Number(form.cost) : undefined,
        vendor: form.vendor.trim() || undefined,
        nextDueDate: form.nextDueDate ? new Date(form.nextDueDate).toISOString() : undefined,
        status: form.status,
      };
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-base font-bold text-gray-950">
          {editData ? "Update Maintenance" : "Add Maintenance Record"}
        </h2>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-gray-700">
            Title
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Lubrication & Belt Check" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-gray-700">
            Description
            <textarea className={textareaClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Routine monthly maintenance" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Maintenance Date
              <input className={inputClass} type="date" value={form.maintenanceDate} onChange={(e) => setForm({ ...form, maintenanceDate: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Next Due Date
              <input className={inputClass} type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Cost
              <input className={inputClass} type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="150.00" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Vendor
              <input className={inputClass} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="TechServ Solutions" />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium text-gray-700">
            Status
            <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {maintenanceStatusOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : editData ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
