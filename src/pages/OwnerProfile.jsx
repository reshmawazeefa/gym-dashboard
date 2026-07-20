import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import {
  getApiError,
  getPlatformGym,
  getPlatformGyms,
  getProfile,
  updateGym,
  updateTenantUser,
  unwrapList,
  unwrapObject,
} from "../services/api";

function normaliseGym(gym = {}) {
  const owner = Array.isArray(gym.users) ? gym.users[0] : gym.users;

  return {
    id: gym.id || gym._id || gym.gymId || "",
    name: gym.name || gym.gymName || gym.gym?.name || "",
    phoneNumber1: gym.phoneNumber1 || "",
    phoneNumber2: gym.phoneNumber2 || "",
    addressLine1: gym.addressLine1 || "",
    addressLine2: gym.addressLine2 || "",
    city: gym.city || "",
    state: gym.state || "",
    country: gym.country || "",
    postalCode: gym.postalCode || "",
    logo: gym.logo || "",
    website: gym.website || "",
    status: gym.isActive === false ? "Inactive" : "Active",
    createdAt: gym.createdAt?.slice?.(0, 10) || gym.created_at?.slice?.(0, 10) || "",
    ownerName: gym.ownerName || owner?.name || gym.owner?.name || "",
    ownerEmail: gym.email || gym.ownerEmail || owner?.email || gym.owner?.email || "",
  };
}

export default function OwnerProfile() {
  const { user, updateUser } = useAuth();
  const [gym, setGym] = useState(null);
  const [form, setForm] = useState({
    gymName: "",
    website: "",
    phoneNumber1: "",
    phoneNumber2: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    logo: null,
    isActive: true,
  });
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const qrPrintRef = useRef();

  const handlePrintQR = () => {
    const content = qrPrintRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head><title>Print QR Code</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;flex-direction:column;font-family:sans-serif;">
          ${content}
          <p style="margin-top:16px;font-size:14px;color:#666;">Gym ID: ${gym?.id}</p>
          <script>window.onload=function(){setTimeout(function(){window.print();window.close()},500)}</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const loadGym = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let gymData = null;

      // Prefer the profile endpoint which returns both `user` and `gym` objects
      try {
        const profile = await getProfile();
        gymData = profile?.gym || null;
        if (profile?.user && gymData) {
          gymData.ownerName = profile.user.name;
          gymData.ownerEmail = profile.user.email;
        }
      } catch (err) {
        if (user.gymId) {
          const response = await getPlatformGym(user.gymId);
          gymData = response;
        } else {
          const response = await getPlatformGyms();
          const allGyms = unwrapList(response);
          gymData = allGyms.find(
            (g) =>
              g.id === user.gymId ||
              g.gymId === user.gymId ||
              g.id === user.id ||
              g.email === user.email ||
              (Array.isArray(g.users) && g.users.some((member) => member.email === user.email))
          );
        }
      }

      const nextGym = normaliseGym(gymData);
      setGym(nextGym);
      setForm({
        gymName: nextGym.name,
        website: nextGym.website,
        phoneNumber1: nextGym.phoneNumber1,
        phoneNumber2: nextGym.phoneNumber2,
        addressLine1: nextGym.addressLine1,
        addressLine2: nextGym.addressLine2,
        city: nextGym.city,
        state: nextGym.state,
        country: nextGym.country,
        postalCode: nextGym.postalCode,
        logo: nextGym.logo,
        isActive: nextGym.status === "Active",
      });
    } catch (error) {
      toast.error(getApiError(error, "Could not load gym details"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGym();
  }, [user]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!gym?.id) {
      toast.error("Unable to save gym profile. Missing gym ID.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.gymName,
        phoneNumber1: form.phoneNumber1 || null,
        phoneNumber2: form.phoneNumber2 || null,
        addressLine1: form.addressLine1 || null,
        addressLine2: form.addressLine2 || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        postalCode: form.postalCode || null,
        logo: form.logo || null,
        website: form.website || null,
        isActive: form.isActive,
      };

      const response = await updateGym(gym.id, payload);
      const updatedGym = normaliseGym(unwrapObject(response));
      setGym(updatedGym);
      setForm((prev) => ({ ...prev, gymName: updatedGym.name }));
      setEditMode(false);
      toast.success("Gym profile updated successfully.");
    } catch (error) {
      toast.error(getApiError(error, "Failed to update gym profile"));
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
            <p className="text-sm text-gray-500">Gym owner profile and gym details.</p>
          </div>
          <button
            type="button"
            onClick={() => setEditMode((current) => !current)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {editMode ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Gym Name</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.gymName}
              disabled={!editMode}
              onChange={(event) => handleChange("gymName", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Website</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.website}
              disabled={!editMode}
              onChange={(event) => handleChange("website", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Owner</label>
            <input
              className="w-full rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-600 outline-none"
              value={gym?.ownerName || user?.name || ""}
              disabled
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              className="w-full rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-600 outline-none"
              value={gym?.ownerEmail || user?.email || ""}
              disabled
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Phone</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.phoneNumber1}
              disabled={!editMode}
              onChange={(event) => handleChange("phoneNumber1", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Secondary Phone</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.phoneNumber2}
              disabled={!editMode}
              onChange={(event) => handleChange("phoneNumber2", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">City</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.city}
              disabled={!editMode}
              onChange={(event) => handleChange("city", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">State</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.state}
              disabled={!editMode}
              onChange={(event) => handleChange("state", event.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Address</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.addressLine1}
              disabled={!editMode}
              onChange={(event) => handleChange("addressLine1", event.target.value)}
              placeholder="Address line 1"
            />
            <input
              className="mt-3 w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.addressLine2}
              disabled={!editMode}
              onChange={(event) => handleChange("addressLine2", event.target.value)}
              placeholder="Address line 2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Country</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.country}
              disabled={!editMode}
              onChange={(event) => handleChange("country", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Postal Code</label>
            <input
              className="w-full rounded border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500"
              value={form.postalCode}
              disabled={!editMode}
              onChange={(event) => handleChange("postalCode", event.target.value)}
            />
          </div>
        </div>

        {editMode && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-lg font-bold text-gray-950">QR Code</h2>
        <div className="flex flex-col items-center gap-4">
          <div ref={qrPrintRef} className="flex justify-center">
            {gym?.id && <QRCodeSVG value={gym.id} size={180} />}
          </div>
          <p className="text-sm text-gray-500">Gym ID: {gym?.id || "-"}</p>
          <button
            type="button"
            onClick={handlePrintQR}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Print QR Code
          </button>
        </div>
      </div>
    </div>
  );
}
