import { useState } from "react";

export default function PaymentModal({
  isOpen,
  onClose,
  onSave,
  members,
  plans,
}) {
  const [form, setForm] = useState({
    member: "",
    plan: "",
    amount: "",
    date: "",
    status: "Paid",
  });

  if (!isOpen) return null;

  const handlePlanChange = (planName) => {
    const selected = plans.find((p) => p.name === planName);

    setForm({
      ...form,
      plan: planName,
      amount: selected?.price || "",
    });
  };

  const handleSubmit = () => {
    if (!form.member || !form.plan || !form.amount || !form.date)
      return;

    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded w-full max-w-md">

        <h2 className="text-lg font-bold mb-4">Add Payment</h2>

        {/* Member */}
        <select
        className="w-full border p-2 mb-3"
        value={form.member}
        onChange={(e) =>
            setForm({ ...form, member: e.target.value })
        }
        >
        <option value="">Select Member</option>

        {members.map((m) => (
            <option key={m.id} value={m.name || m.fullName || m.member_name}>
            {m.name || m.fullName || m.member_name}
            </option>
        ))}
        </select>

        {/* Plan */}
        <select
          className="w-full border p-2 mb-3"
          value={form.plan}
          onChange={(e) => handlePlanChange(e.target.value)}
        >
          <option value="">Select Plan</option>
          {plans.map((p) => (
            <option key={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Amount */}
        <input
          type="number"
          className="w-full border p-2 mb-3"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) =>
            setForm({ ...form, amount: e.target.value })
          }
        />

        {/* Date */}
        <input
          type="date"
          className="w-full border p-2 mb-3"
          value={form.date}
          onChange={(e) =>
            setForm({ ...form, date: e.target.value })
          }
        />

        {/* Status */}
        <select
          className="w-full border p-2 mb-4"
          value={form.status}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value })
          }
        >
          <option>Paid</option>
          <option>Pending</option>
        </select>

        <div className="flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-4 py-1 rounded"
          >
            Save
          </button>
        </div>

      </div>
    </div>
  );
}