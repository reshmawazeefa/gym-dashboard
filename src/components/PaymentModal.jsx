import { useState } from "react";

export default function PaymentModal({ isOpen, onClose, onSave, members, plans }) {
  const [form, setForm] = useState({
    member: "",
    plan: "",
    amount: "",
    date: "",
    status: "Paid",
  });

  if (!isOpen) return null;

  const handlePlanChange = (planName) => {
    const selected = plans.find((plan) => plan.name === planName);
    setForm({
      ...form,
      plan: planName,
      amount: selected?.price || "",
    });
  };

  const handleSubmit = () => {
    if (!form.member || !form.plan || !form.amount || !form.date) return;

    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Add Payment</h2>

        <select
          className="mb-3 w-full border p-2"
          value={form.member}
          onChange={(event) => setForm({ ...form, member: event.target.value })}
        >
          <option value="">Select Member</option>
          {members.map((member) => (
            <option key={member.id} value={member.name || member.fullName || member.member_name}>
              {member.name || member.fullName || member.member_name}
            </option>
          ))}
        </select>

        <select
          className="mb-3 w-full border p-2"
          value={form.plan}
          onChange={(event) => handlePlanChange(event.target.value)}
        >
          <option value="">Select Plan</option>
          {plans.map((plan) => (
            <option key={plan.id}>{plan.name}</option>
          ))}
        </select>

        <input
          type="number"
          className="mb-3 w-full border p-2"
          placeholder="Amount"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
        />

        <input
          type="date"
          className="mb-3 w-full border p-2"
          value={form.date}
          onChange={(event) => setForm({ ...form, date: event.target.value })}
        />

        <select
          className="mb-4 w-full border p-2"
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value })}
        >
          <option>Paid</option>
          <option>Pending</option>
        </select>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg">Cancel</button>
          <button type="button" onClick={handleSubmit} className="rounded-lg bg-blue-500 px-4 py-1 text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}