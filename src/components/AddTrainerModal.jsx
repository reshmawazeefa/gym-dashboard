import { useState } from "react";
import { UserPlus, X } from "lucide-react";

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

  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";

  const renderInput = (name, label, options = {}) => (
    <label className={options.full ? "sm:col-span-2" : ""}>
      <span className={labelClass}>{label}{options.required && <span className="text-red-500"> *</span>}</span>
      <input
        name={name}
        type={options.type || "text"}
        value={form[name] || ""}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        placeholder={options.placeholder || label}
        className={fieldClass}
        disabled={options.disabled}
      />
    </label>
  );

  const handleSubmit = () => {
    if (!form.name || !form.email || (!editData && (!form.password || !form.role))) {
      alert("Please fill all required fields");
      return;
    }

    onSave(normalizeFormDates(form));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><UserPlus size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">{editData ? "Edit Staff" : "Add Staff"}</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">{editData ? "Review and update this staff profile." : "Enter employee credentials, contact details, and role permissions."}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close staff modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {renderInput("name", "Full Name", { required: true, placeholder: "e.g. John Doe" })}
            {renderInput("email", "Email Address", { type: "email", required: true, disabled: Boolean(editData), placeholder: "e.g. name@gymmaster.com" })}
            {!editData && renderInput("password", "Temporary Password", { type: "password", required: true, placeholder: "••••••••" })}
            <label>
              <span className={labelClass}>Role{!editData && <span className="text-red-500"> *</span>}</span>
              <select name="role" className={fieldClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={Boolean(editData)}>
                <option value="">Select Role</option><option value="admin">Admin</option><option value="trainer">Trainer</option><option value="receptionist">Receptionist</option>
              </select>
            </label>
            {renderInput("phoneNumber", "Phone Number", { placeholder: "+1 (555) 000-0000" })}
            <label><span className={labelClass}>Gender</span><select name="gender" value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={fieldClass}><option value="">Select Gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label>
            {renderInput("dateOfBirth", "Date of Birth", { type: "date", placeholder: "dd-mm-yyyy" })}
            {renderInput("postalCode", "Postal / Zip Code", { placeholder: "e.g. 90210" })}
            {renderInput("addressLine1", "Address Line 1", { placeholder: "Street address or P.O. Box" })}
            {renderInput("addressLine2", "Address Line 2", { placeholder: "Apartment, suite, unit, etc." })}
            {renderInput("city", "City", { placeholder: "City" })}
            {renderInput("state", "State / Province", { placeholder: "State" })}
            {renderInput("country", "Country", { placeholder: "e.g. United States" })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button type="button" onClick={handleSubmit} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">{editData ? "Update" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
