import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getApiError, getTenantUser, updateTenantUser, unwrapObject } from "../services/api";

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

const formatDateTimeValue = (value) => {
  const dateValue = formatDateValue(value);
  return dateValue ? `${dateValue}T00:00:00.000Z` : "";
};

function normaliseUser(user = {}) {
  return {
    id: user.id || user._id || user.userId || user.email || "",
    name: user.name || user.fullName || user.ownerName || "",
    email: user.email || user.ownerEmail || "",
    phoneNumber: user.phoneNumber || "",
    gender: user.gender || "",
    dateOfBirth: formatDateValue(user.dateOfBirth || user.dob || ""),
    addressLine1: user.addressLine1 || "",
    addressLine2: user.addressLine2 || "",
    city: user.city || "",
    state: user.state || "",
    country: user.country || "",
    postalCode: user.postalCode || "",
    profileImage: user.profileImage || "",
    raw: user,
  };
}

export default function StaffProfile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const loadProfile = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await getTenantUser(user.id);
      const profile = normaliseUser(unwrapObject(response));
      setForm(profile);
    } catch (error) {
      const fallback = normaliseUser(user);
      setForm(fallback);
      toast.error(getApiError(error, "Could not load profile details"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [user?.id]);

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("Unable to save profile. Missing user ID.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phoneNumber: form.phoneNumber,
        gender: form.gender,
        dateOfBirth: formatDateTimeValue(form.dateOfBirth),
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        state: form.state,
        country: form.country,
        postalCode: form.postalCode,
      };

      const response = await updateTenantUser(user.id, payload);
      const updated = normaliseUser(unwrapObject(response));
      setForm(updated);
      updateUser({ ...user, name: updated.name, email: updated.email });
      setEditMode(false);
      toast.success("Profile updated successfully.");
    } catch (error) {
      toast.error(getApiError(error, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 text-gray-500">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-950">Profile</h1>
            <p className="text-sm text-gray-500">Update your profile details.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditMode((current) => !current)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {editMode ? "Cancel" : "Edit Profile"}
            </button>
            {editMode && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Full Name</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.name}
              disabled={!editMode}
              onChange={(event) => handleChange("name", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              className="w-full rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-600 outline-none"
              value={form.email}
              disabled
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Phone</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.phoneNumber}
              disabled={!editMode}
              onChange={(event) => handleChange("phoneNumber", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Gender</label>
            <select
              value={form.gender}
              disabled={!editMode}
              onChange={(event) => handleChange("gender", event.target.value)}
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Date of Birth</label>
            <input
              type="date"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.dateOfBirth}
              disabled={!editMode}
              onChange={(event) => handleChange("dateOfBirth", event.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Address Line 1</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.addressLine1}
              disabled={!editMode}
              onChange={(event) => handleChange("addressLine1", event.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Address Line 2</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.addressLine2}
              disabled={!editMode}
              onChange={(event) => handleChange("addressLine2", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">City</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.city}
              disabled={!editMode}
              onChange={(event) => handleChange("city", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">State</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.state}
              disabled={!editMode}
              onChange={(event) => handleChange("state", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Country</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.country}
              disabled={!editMode}
              onChange={(event) => handleChange("country", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Postal Code</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.postalCode}
              disabled={!editMode}
              onChange={(event) => handleChange("postalCode", event.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
