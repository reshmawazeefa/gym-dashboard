import { useState } from "react";
import { getGymId } from "../services/api";

const getEmptyForm = () => ({
  name: "",
  email: "",
  password: "",
  gymId: getGymId(),
  phoneNumber: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  gender: "",
  dateOfBirth: "",
  // profileImage: "",
  planId: "",
  planName: "",
  duration: "",
  joinDate: "",
  expiryDate: "",
  status: "Active",
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

const normalizeDateFields = (data) => ({
  ...data,
  dateOfBirth: formatDateValue(data.dateOfBirth),
  joinDate: formatDateValue(data.joinDate),
  expiryDate: formatDateValue(data.expiryDate),
});

export default function AddMemberModal({ isOpen, onClose, onSave, editData }) {
  const [form, setForm] = useState(() =>
    editData
      ? normalizeDateFields({
        password: "",
        gymId: getGymId(),
        status: "Active",
        ...editData,
      })
      : getEmptyForm()
  );

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };

    if (name === "joinDate" && form.planId) {
      const plans = JSON.parse(localStorage.getItem("plans")) || [];
      const selected = plans.find((p) => String(p.id) === String(form.planId));

      if (selected) {
        const join = new Date(value);
        const expiry = new Date(join);
        expiry.setDate(join.getDate() + Number(selected.duration));
        updatedForm.expiryDate = expiry.toISOString().split("T")[0];
      }
    }

    setForm(updatedForm);
  };

  const handleSubmit = () => {
    if (!form.name || (!editData && (!form.email || !form.password || !form.gymId))) {
      alert("Fill all required fields");
      return;
    }

    onSave(normalizeDateFields(form));
    onClose();
  };

  const fieldClass = "h-9 w-full rounded border px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-base font-bold">
          {editData ? "Member Detail" : "Add Member"}
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <input
            name="name"
            value={form.name || ""}
            onChange={handleChange}
            placeholder="Name"
            className={fieldClass}
          />

          <input
            name="email"
            type="email"
            value={form.email || ""}
            onChange={handleChange}
            placeholder="Email"
            className={fieldClass}
            disabled={Boolean(editData)}
          />

          {!editData && (
            <>
              <input
                name="gymId"
                value={form.gymId || ""}
                onChange={handleChange}
                placeholder="Gym ID"
                className="hidden"
                readOnly
                type="hidden"
              />

              <input
                name="password"
                type="password"
                value={form.password || ""}
                onChange={handleChange}
                placeholder="Password"
                className={fieldClass}
              />
            </>
          )}

          <input
            name="phoneNumber"
            value={form.phoneNumber || ""}
            onChange={handleChange}
            placeholder="Phone Number"
            className={fieldClass}
          />

          <select
            name="gender"
            value={form.gender || ""}
            onChange={handleChange}
            className={fieldClass}
          >
            <option value="">Select Gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>

          <input
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth || ""}
            onChange={handleChange}
            placeholder="Date of Birth"
            className={fieldClass}
          />

          <input
            name="postalCode"
            value={form.postalCode || ""}
            onChange={handleChange}
            placeholder="Postal Code"
            className={fieldClass}
          />

          <input
            name="addressLine1"
            value={form.addressLine1 || ""}
            onChange={handleChange}
            placeholder="Address Line 1"
            className={fieldClass}
          />

          <input
            name="addressLine2"
            value={form.addressLine2 || ""}
            onChange={handleChange}
            placeholder="Address Line 2"
            className={fieldClass}
          />

          <input
            name="city"
            value={form.city || ""}
            onChange={handleChange}
            placeholder="City"
            className={fieldClass}
          />

          <input
            name="state"
            value={form.state || ""}
            onChange={handleChange}
            placeholder="State"
            className={fieldClass}
          />

          <input
            name="country"
            value={form.country || ""}
            onChange={handleChange}
            placeholder="Country"
            className={fieldClass}
          />
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white"
          >
            {editData ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
