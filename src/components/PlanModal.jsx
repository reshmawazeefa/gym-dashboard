import { useState, useEffect } from "react";

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

  useEffect(() => {
    setForm(planFormFromEditData(editData, featuresList));
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded w-full max-w-md max-h-[90vh] overflow-y-auto">

        <h2 className="text-lg font-bold mb-4">
          {editData ? "Edit Plan" : "Add Plan"}
        </h2>

        <input
          type="text"
          placeholder="Plan name"
          className="w-full border p-2 mb-3"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        />

        <input
          type="number"
          placeholder="Price"
          className="w-full border p-2 mb-3"
          value={form.price}
          onChange={(e) =>
            setForm({ ...form, price: e.target.value })
          }
        />

        <input
          type="number"
          placeholder="Duration (days)"
          className="w-full border p-2 mb-4 bg-gray-100 text-gray-700"
          value={form.duration}
          readOnly
        />

        <textarea
          placeholder="Description"
          className="w-full border p-2 mb-3"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plan Type
        </label>
        <select
          className="w-full border p-2 mb-3"
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

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Features
        </label>
        {featuresList.length === 0 ? (
          <p className="mb-3 text-sm text-gray-500">No features available. Create features in the Features tab first.</p>
        ) : (
          <div className="mb-4 max-h-48 overflow-y-auto border rounded p-2 space-y-1">
            {featuresList.map((feature) => (
              <label key={feature.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.featureIds.includes(feature.id)}
                  onChange={() => toggleFeature(feature.id)}
                  className="accent-blue-600"
                />
                {feature.name}
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-4 py-2 text-sm rounded"
          >
            {editData ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
