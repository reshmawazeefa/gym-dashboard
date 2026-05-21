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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded bg-white p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-bold">
          {editData ? "Member Detail" : "Add Member"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <input
            name="name"
            value={form.name || ""}
            onChange={handleChange}
            placeholder="Name"
            className="col-span-2 w-full border p-2 rounded"
          />

          <input
            name="email"
            type="email"
            value={form.email || ""}
            onChange={handleChange}
            placeholder="Email"
            className="col-span-2 w-full border p-2 rounded"
            disabled={Boolean(editData)}
          />

          {!editData && (
            <>
              <input
                name="gymId"
                value={form.gymId || ""}
                onChange={handleChange}
                placeholder="Gym ID"
                className="hidden w-full border p-2 rounded"
                readOnly
                type="hidden"
              />

              <input
                name="password"
                type="password"
                value={form.password || ""}
                onChange={handleChange}
                placeholder="Password"
                className="col-span-2 w-full border p-2 rounded"
              />
            </>
          )}

          <input
            name="phoneNumber"
            value={form.phoneNumber || ""}
            onChange={handleChange}
            placeholder="Phone Number"
            className="w-full border p-2 rounded"
          />

          <select
            name="gender"
            value={form.gender || ""}
            onChange={handleChange}
            className="w-full border p-2 rounded"
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
            className="w-full border p-2 rounded"
          />

          <input
            name="postalCode"
            value={form.postalCode || ""}
            onChange={handleChange}
            placeholder="Postal Code"
            className="w-full border p-2 rounded"
          />

          <input
            name="addressLine1"
            value={form.addressLine1 || ""}
            onChange={handleChange}
            placeholder="Address Line 1"
            className="col-span-2 w-full border p-2 rounded"
          />

          <input
            name="addressLine2"
            value={form.addressLine2 || ""}
            onChange={handleChange}
            placeholder="Address Line 2"
            className="col-span-2 w-full border p-2 rounded"
          />

          <input
            name="city"
            value={form.city || ""}
            onChange={handleChange}
            placeholder="City"
            className="w-full border p-2 rounded"
          />

          <input
            name="state"
            value={form.state || ""}
            onChange={handleChange}
            placeholder="State"
            className="w-full border p-2 rounded"
          />

          <input
            name="country"
            value={form.country || ""}
            onChange={handleChange}
            placeholder="Country"
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-sm hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            className="rounded bg-blue-500 px-4 py-2 text-sm text-white"
          >
            {editData ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
