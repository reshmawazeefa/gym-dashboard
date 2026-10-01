import { useEffect, useState } from "react";
import { Wrench, X } from "lucide-react";

const maintenanceStatusOptions = ["PENDING", "COMPLETED", "CANCELLED"];

const inputClass =
  "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white";

const emptyForm = {
  equipmentId: "",
  title: "",
  description: "",
  maintenanceDate: "",
  cost: "",
  vendor: "",
  nextDueDate: "",
  status: "PENDING",
};

export default function EquipmentModal({ isOpen, onClose, onSave, editData, equipmentOptions = [], selectedEquipmentId = "" }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initialEquipmentId = editData?.equipmentId || selectedEquipmentId || equipmentOptions[0]?.id || "";
    if (editData) {
      setForm({
        equipmentId: editData.equipmentId || initialEquipmentId,
        title: editData.title || "",
        description: editData.description || "",
        maintenanceDate: editData.maintenanceDate || "",
        cost: editData.cost ?? "",
        vendor: editData.vendor || "",
        nextDueDate: editData.nextDueDate || "",
        status: editData.status || "PENDING",
      });
    } else {
      setForm({ ...emptyForm, equipmentId: initialEquipmentId });
    }
  }, [editData, isOpen, equipmentOptions, selectedEquipmentId]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.equipmentId) {
      alert("Please select an equipment before creating maintenance.");
      return;
    }
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
      await onSave(payload, form.equipmentId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Wrench size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">{editData ? "Update Maintenance" : "Add Maintenance Record"}</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">Track service work, costs, vendors, and maintenance schedules.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close maintenance modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="grid gap-1 text-xs font-semibold text-[#334155]">
            Equipment
            <select className={inputClass} value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}>
              <option value="">Select equipment</option>
              {equipmentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name || "Equipment"}{option.serialNumber ? ` — ${option.serialNumber}` : ""}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#334155]">
            Title
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Lubrication & Belt Check" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#334155]">
            Description
            <textarea className={textareaClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Routine monthly maintenance" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-[#334155]">
              Maintenance Date
              <input className={inputClass} type="date" value={form.maintenanceDate} onChange={(e) => setForm({ ...form, maintenanceDate: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#334155]">
              Next Due Date
              <input className={inputClass} type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-[#334155]">
              Cost
              <input className={inputClass} type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="150.00" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#334155]">
              Vendor
              <input className={inputClass} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="TechServ Solutions" />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-[#334155]">
            Status
            <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {maintenanceStatusOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0D8252] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Saving..." : editData ? "Update" : "Save"}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
