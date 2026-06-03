import { useState } from "react";

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
    features: "",
  };
}

function planFormFromEditData(editData) {
  if (!editData) return emptyPlanForm();

  const planType = editData.planType || DEFAULT_PLAN_TYPE;

  return {
    ...editData,
    duration: PLAN_TYPE_DURATIONS[planType] || editData.duration || "",
    features: Array.isArray(editData.features)
      ? editData.features.join(", ")
      : editData.features || "",
    planType,
  };
}

export default function PlanModal({ isOpen, onClose, onSave, editData }) {
  const [form, setForm] = useState(() => planFormFromEditData(editData));

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!form.name || !form.price || !form.duration || !form.planType) return;

    onSave({
      ...form,
      duration: PLAN_TYPE_DURATIONS[form.planType],
      features: form.features
        .split(",")
        .map((feature) => feature.trim())
        .filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded w-full max-w-md">

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

        <textarea
          placeholder="Features (comma separated, e.g. trainer, diet, steam)"
          className="w-full border p-2 mb-4"
          value={form.features}
          onChange={(e) =>
            setForm({ ...form, features: e.target.value })
          }
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-4 py-1 rounded"
          >
            {editData ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
