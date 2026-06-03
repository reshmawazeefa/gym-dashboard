import { useState } from "react";

const getEmptyForm = () => ({
  name: "",
  email: "",
  password: "",
  role: "",
  phoneNumber: "",
  gender: "",
  dateOfBirth: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
});

const formatDateValue = (value) => {
  if (!value) return "";

  const stringValue = String(value).trim();
  const isoDate = stringValue.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;

  const parsedDate = new Date(stringValue);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeRole = (value) => {
  if (!value) return "";

  const roleValue =
    typeof value === "object"
      ? value.name || value.role || value.code || value.type || value.value || ""
      : value;

  const normalized = String(roleValue)
    .trim()
    .toLowerCase()
    .replace(/^role[_-]/, "");

  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("trainer")) return "trainer";
  if (normalized.includes("reception")) return "receptionist";

  return normalized;
};

const normalizeFormDates = (data) => ({
  ...data,
  dateOfBirth: formatDateValue(data.dateOfBirth),
  role: normalizeRole(data.role),
});

export default function AddTrainerModal({
  isOpen,
  onClose,
  onSave,
  editData,
}) {
  const [form, setForm] = useState(() =>
    editData
      ? normalizeFormDates({ password: "", role: "", ...editData })
      : getEmptyForm()
  );

  if (!isOpen) return null;

  const fieldClass = "h-9 w-full rounded border px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const handleSubmit = () => {
    if (!form.name || !form.email || (!editData && (!form.password || !form.role))) {
      alert("Please fill all required fields");
      return;
    }

    onSave(normalizeFormDates(form));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-base font-bold">
          {editData ? "Edit Staff" : "Add Staff"}
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Name"
            className={fieldClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            type="email"
            placeholder="Email"
            className={fieldClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          {!editData && (
            <input
              type="password"
              placeholder="Password"
              className={fieldClass}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}

          {!editData && (
            <select
              className={fieldClass}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="">Select Role</option>
              <option value="admin">Admin</option>
              <option value="trainer">Trainer</option>
              <option value="receptionist">Receptionist</option>
            </select>
          )}

          <input
            placeholder="Phone Number"
            className={fieldClass}
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
          />

          <select
            className={fieldClass}
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="">Select Gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>

          <input
            type="date"
            placeholder="Date of Birth"
            className={fieldClass}
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />

          <input
            placeholder="Postal Code"
            className={fieldClass}
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          />

          <input
            placeholder="Address Line 1"
            className={fieldClass}
            value={form.addressLine1}
            onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
          />

          <input
            placeholder="Address Line 2"
            className={fieldClass}
            value={form.addressLine2}
            onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
          />

          <input
            placeholder="City"
            className={fieldClass}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />

          <input
            placeholder="State"
            className={fieldClass}
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          />

          <input
            placeholder="Country"
            className={fieldClass}
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
