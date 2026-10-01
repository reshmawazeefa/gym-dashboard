import { useState, useEffect } from "react";
import { Package, Search, X } from "lucide-react";

const PLAN_TYPE_DURATIONS = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  YEARLY: 365,
};

const DEFAULT_PLAN_TYPE = "QUARTERLY";

function emptyPlanForm() {
  return {
    name: "",
    price: "",
    duration: PLAN_TYPE_DURATIONS[DEFAULT_PLAN_TYPE],
    description: "",
    planType: DEFAULT_PLAN_TYPE,
    featureIds: [],
  };
}

function planFormFromEditData(editData, featuresList = []) {
  if (!editData) return emptyPlanForm();

  const planType = editData.planType || DEFAULT_PLAN_TYPE;

  let featureIds = editData.featureIds;
  if (!featureIds && editData.features) {
    const featureNames = Array.isArray(editData.features)
      ? editData.features
      : String(editData.features || "")
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);
    featureIds = featuresList
      .filter((f) => featureNames.includes(f.name))
      .map((f) => f.id);
  }

  return {
    name: editData.name || "",
    price: editData.price ?? "",
    duration: PLAN_TYPE_DURATIONS[planType] || editData.duration || "",
    description: editData.description || "",
    planType,
    featureIds: featureIds || [],
  };
}

export default function PlanModal({ isOpen, onClose, onSave, editData, featuresList = [] }) {
  const [form, setForm] = useState(() => planFormFromEditData(editData, featuresList));
  const [featureSearch, setFeatureSearch] = useState("");

  useEffect(() => {
    setForm(planFormFromEditData(editData, featuresList));
    setFeatureSearch("");
  }, [editData, featuresList]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!form.name || !form.price || !form.duration || !form.planType) return;

    onSave({
      name: form.name,
      price: form.price,
      duration: form.duration,
      description: form.description,
      planType: form.planType,
      featureIds: form.featureIds,
    });
    onClose();
  };

  const toggleFeature = (featureId) => {
    setForm((prev) => ({
      ...prev,
      featureIds: prev.featureIds.includes(featureId)
        ? prev.featureIds.filter((id) => id !== featureId)
        : [...prev.featureIds, featureId],
    }));
  };

  const filteredFeatures = featuresList.filter((feature) =>
    String(feature.name || "").toLowerCase().includes(featureSearch.trim().toLowerCase())
  );

  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Package size={18} /></div><div><h2 className="text-base font-bold text-[#0F172A]">{editData ? "Edit Plan" : "Add Plan"}</h2><p className="mt-0.5 text-xs text-[#64748B]">Create subscription packages, pricing tiers, and included amenities.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close plan modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className={labelClass}>Plan Name <span className="text-red-500">*</span></span><input
          type="text"
          placeholder="Plan name"
          className={fieldClass}
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        /></label>

        <label className="block"><span className={labelClass}>Price <span className="text-red-500">*</span></span><input
          type="number"
          placeholder="Price"
          className={fieldClass}
          value={form.price}
          onChange={(e) =>
            setForm({ ...form, price: e.target.value })
          }
        /></label>

        <label className="block"><span className={labelClass}>Duration (days)</span><div className="relative"><input
          type="number"
          placeholder="Duration (days)"
          className={`${fieldClass} bg-[#F1F5F9] text-[#64748B]`}
          value={form.duration}
          readOnly
        /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#94A3B8]">Days</span></div></label>

        <label className="block sm:col-span-2"><span className={labelClass}>Description</span><textarea
          placeholder="Description"
          className={`${fieldClass} h-20 py-2`}
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
        /></label>

        <label className="block sm:col-span-2"><span className={labelClass}>Plan Type</span>
        <select
          className={fieldClass}
          value={form.planType}
          onChange={(e) => {
            const planType = e.target.value;
            setForm({
              ...form,
              planType,
              duration: PLAN_TYPE_DURATIONS[planType],
            });
          }}
        >
          <option value="DAILY">DAILY</option>
          <option value="WEEKLY">WEEKLY</option>
          <option value="MONTHLY">MONTHLY</option>
          <option value="QUARTERLY">QUARTERLY</option>
          <option value="YEARLY">YEARLY</option>
        </select>
        </label>

        <div className="sm:col-span-2">
        <div className="mb-1 flex items-center justify-between"><label className="block text-xs font-semibold text-[#334155]">Features</label>{featuresList.length > 0 && <span className="text-[10px] text-[#0D8252]">{form.featureIds.length} Selected</span>}</div>
        {featuresList.length === 0 ? (
          <p className="mb-3 text-xs text-[#64748B]">No features available. Create features in the Features tab first.</p>
        ) : (
          <div className="mb-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2">
                <Search size={13} className="text-[#94A3B8]" />
                <input type="text" value={featureSearch} onChange={(event) => setFeatureSearch(event.target.value)} placeholder="Search features..." className="w-full bg-transparent text-xs text-[#334155] outline-none placeholder:text-[#94A3B8]" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setFeatureSearch("");
                  setForm((prev) => ({ ...prev, featureIds: [] }));
                }}
                disabled={!featureSearch && form.featureIds.length === 0}
                className="inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-[10px] font-semibold text-[#475569] transition hover:bg-[#EEF2F7] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset
              </button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto">
            {filteredFeatures.map((feature) => (
              <label key={feature.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#475569] hover:bg-white">
                <input
                  type="checkbox"
                  checked={form.featureIds.includes(feature.id)}
                  onChange={() => toggleFeature(feature.id)}
                  className="accent-[#0D8252]"
                />
                {feature.name}
              </label>
            ))}
            {filteredFeatures.length === 0 && <p className="px-2 py-3 text-xs text-[#64748B]">No matching features.</p>}
            </div>
          </div>
        )}
        </div>

        </div>

        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"
          >
            {editData ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
