import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { getGymId } from "../services/api";

const getEmptyForm = () => ({
  name: "",
  email: "",
  password: "",
  roleId: "member",
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
    if (!form.name || (!editData && (!form.email || !form.password))) {
      alert("Fill all required fields");
      return;
    }

    onSave(normalizeDateFields(form));
    onClose();
  };

  const fieldClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";

  const renderInput = (name, label, options = {}) => (
    <label className={options.full ? "sm:col-span-2" : ""}>
      <span className={labelClass}>{label}{options.required && <span className="text-red-500"> *</span>}</span>
      <input
        name={name}
        type={options.type || "text"}
        value={form[name] || ""}
        onChange={handleChange}
        placeholder={options.placeholder || label}
        className={fieldClass}
        disabled={options.disabled}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><UserPlus size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">{editData ? "Member Detail" : "Add Member"}</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">{editData ? "Review and update this member profile." : "Create a new gym membership profile and generate access credentials."}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close member modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
          {renderInput("name", "Name", { required: true })}
          {renderInput("email", "Email", { type: "email", required: true, disabled: Boolean(editData) })}

          {!editData && (
            <>
              <input name="gymId" value={form.gymId || ""} onChange={handleChange} className="hidden" readOnly type="hidden" />
              {renderInput("password", "Password", { type: "password", required: true })}
            </>
          )}

          {renderInput("phoneNumber", "Phone Number", { required: true })}

          <label><span className={labelClass}>Gender</span><select name="gender" value={form.gender || ""} onChange={handleChange} className={fieldClass}><option value="">Select Gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label>

          {renderInput("dateOfBirth", "Date of Birth", { type: "date", placeholder: "dd-mm-yyyy" })}

          {renderInput("postalCode", "Postal Code")}

          {renderInput("addressLine1", "Address Line 1")}

          {renderInput("addressLine2", "Address Line 2")}

          {renderInput("city", "City")}

          {renderInput("state", "State")}

          {renderInput("country", "Country")}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button type="button" onClick={handleSubmit} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">
            {editData ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
