import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { Building2, Check, Download, Edit, MapPin, Phone, Save, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app } from "../config/firebase";
import {
  getApiError,
  getMyGym,
  getProfile,
  uploadNotificationImage,
  updateGym,
  unwrapObject,
} from "../services/api";
import { resolveGymLogoUrl } from "../utils/gymLogo";

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
    logo: resolveGymLogoUrl(gym.logo),
    website: gym.website || "",
    status: gym.isActive === false ? "Inactive" : "Active",
    createdAt: gym.createdAt?.slice?.(0, 10) || gym.created_at?.slice?.(0, 10) || "",
    ownerName: gym.ownerName || owner?.name || gym.owner?.name || "",
    ownerEmail: gym.email || gym.ownerEmail || owner?.email || gym.owner?.email || "",
  };
}

export default function OwnerProfile() {
  const { user } = useAuth();
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
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
          <script>window.onload=function(){setTimeout(function(){window.print();window.close()},500)}</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleDownloadQR = () => {
    const svg = qrPrintRef.current?.querySelector("svg");
    if (!svg) return;

    const svgMarkup = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(svgBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${gym?.name || "gym-profile"}-qr-code.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const uploadLogoFile = async (file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const uploadResponse = await uploadNotificationImage(formData, user?.accessToken || user?.token);
      return uploadResponse?.data?.url ?? uploadResponse?.url ?? uploadResponse?.data?.imageUrl ?? "";
    } catch (error) {
      const message = String(error?.response?.data?.message || error?.message || "");
      if (!message.includes("ENOENT") && !message.includes("uploads/notifications")) throw error;

      const storage = getStorage(app);
      const storageRef = ref(storage, `gym-logos/${gym.id}/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
      return getDownloadURL(snapshot.ref);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !gym?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"].includes(file.type)) {
      toast.error("Only JPEG, PNG, WebP, GIF, and SVG logos are allowed");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    setLogoUploading(true);
    try {
      const logoUrl = await uploadLogoFile(file);
      if (!logoUrl) throw new Error("Upload succeeded but no logo URL was returned");

      const updateResponse = await updateGym(gym.id, { logo: logoUrl });
      const updatedGym = normaliseGym(unwrapObject(updateResponse));
      const nextLogo = updatedGym.logo || resolveGymLogoUrl(logoUrl);
      setGym((current) => ({ ...current, ...updatedGym, logo: nextLogo }));
      setForm((current) => ({ ...current, logo: nextLogo }));
      await loadGym();
      toast.success("Gym logo updated successfully.");
    } catch (error) {
      setLogoPreview("");
      toast.error(getApiError(error, "Failed to upload gym logo"));
    } finally {
      URL.revokeObjectURL(previewUrl);
      setLogoUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!gym?.id || !form.logo) return;

    setLogoUploading(true);
    try {
      const updateResponse = await updateGym(gym.id, { logo: "" });
      const updatedGym = normaliseGym(unwrapObject(updateResponse));
      setGym((current) => ({ ...current, ...updatedGym, logo: "" }));
      setForm((current) => ({ ...current, logo: "" }));
      setLogoPreview("");
      await loadGym();
      toast.success("Gym logo removed successfully.");
    } catch (error) {
      toast.error(getApiError(error, "Failed to remove gym logo"));
    } finally {
      setLogoUploading(false);
    }
  };

  const loadGym = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let gymData = null;

      // Prefer the tenant gym endpoint for the authenticated owner.
      try {
        const response = await getMyGym(user.accessToken || user.token);
        const profile = response?.data || response || {};
        gymData = profile?.gym || profile;
        if (profile?.user && gymData) {
          gymData.ownerName = profile.user.name;
          gymData.ownerEmail = profile.user.email;
        }
      } catch {
        const response = await getProfile(user.accessToken || user.token);
        const profile = response?.data || response || {};
        gymData = profile?.gym || null;
        if (profile?.user && gymData) {
          gymData.ownerName = profile.user.name;
          gymData.ownerEmail = profile.user.email;
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
      setLogoPreview("");
    } catch (error) {
      toast.error(getApiError(error, "Could not load gym details"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadGym);
    // loadGym reads the current authenticated session and is intentionally invoked on user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setForm((prev) => ({ ...prev, gymName: updatedGym.name, logo: updatedGym.logo || prev.logo }));
      setLogoPreview("");
      await loadGym();
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

  const inputClass = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white disabled:cursor-not-allowed disabled:text-[#64748B]";
  const labelClass = "mb-1 block text-xs font-semibold text-[#334155]";
  const profileName = gym?.ownerName || user?.name || gym?.name || "Gym Owner";
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || "G";

  const renderField = (label, field, icon, options = {}) => {
    const Icon = icon;
    return (
      <label className={options.full ? "sm:col-span-2" : ""}>
        <span className={labelClass}>{label}</span>
        <div className="relative">
          {Icon && <Icon size={11} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />}
          <input
            type={options.type || "text"}
            className={`${inputClass} ${options.tall ? "h-14 py-2" : ""} ${Icon ? "pl-7" : ""}`}
            value={options.value ?? form[field]}
            disabled={options.disabled ?? !editMode}
            onChange={options.onChange || ((event) => handleChange(field, event.target.value))}
            placeholder={options.placeholder}
          />
        </div>
      </label>
    );
  };

  return (
    <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0D8252]">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-[#0D8252]" /> Live Facility</span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="text-[#94A3B8]">Branch #01</span>
            </div> */}
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Profile &amp; Credentials</h1>
            <p className="mt-0.5 text-xs text-[#64748B]">Manage gym identity, contact credentials, and facility turnstile QR access code.</p>
          </div>
          <button type="button" onClick={() => setEditMode((current) => !current)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${editMode ? "border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]" : "bg-[#0D8252] text-white shadow-sm hover:bg-[#086B43]"}`}>
            {editMode ? <X size={13} /> : <Edit size={15} />}
            {editMode ? "Cancel Edit" : "Edit Profile"}
          </button>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[1.45fr_0.9fr]">
          <section className="rounded-2xl border border-[#E5EBEF] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-[#EEF2F4] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Gym Information &amp; Owner Profile</h2>
                <p className="mt-0.5 text-xs text-[#94A3B8]">Official operational records and regulatory credentials.</p>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F8FAFC] text-[#94A3B8]"><ShieldCheck size={13} /></span>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#EEF2F4] bg-[#F8FAFC] p-2.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50 text-[#0D8252]">
                {logoPreview || form.logo ? (
                  <img src={logoPreview || form.logo} alt="Gym logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-[#0D8252]">{profileInitial}</span>
                )}
              </div>
              <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#94A3B8]">PNG, JPG, WebP, GIF or SVG up to 5MB</p><p className="text-xs text-[#94A3B8]">Recommended square 400x400px.</p></div>
              <div className="flex items-center gap-2">
                <label className={`rounded-lg border border-[#DCE5EA] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#475569] ${!editMode || logoUploading ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#F8FAFC]"}`}>
                  {logoUploading ? "Uploading..." : "Upload New"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={handleLogoUpload} disabled={!editMode || logoUploading} className="sr-only" />
                </label>
                <button type="button" onClick={handleDeleteLogo} disabled={!editMode || !form.logo || logoUploading} aria-label="Delete gym logo" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
              {renderField("Gym Commercial Name", "gymName", Building2, { value: form.gymName })}
              {renderField("Official Website", "website", null, { placeholder: "https://www.example.com" })}
              {renderField("Registered Owner Entity", "owner", UserRound, { value: gym?.name || user?.name || "", disabled: true })}
              {renderField("Billing & Admin Email", "email", null, { type: "email", value: gym?.ownerEmail || user?.email || "", disabled: true })}
              {renderField("Primary Contact Phone", "phoneNumber1", Phone)}
              {renderField("Secondary Phone / Hotline", "phoneNumber2", Phone)}
              {renderField("City", "city", MapPin)}
              {renderField("State or Region", "state", MapPin)}
              {renderField("Address Line 1", "addressLine1", null, { tall: true })}
              {renderField("Address Line 2 (District/Zone)", "addressLine2", null, { tall: true })}
              {renderField("Country", "country", null)}
              {renderField("Postal / PIN Code", "postalCode", null)}
            </div>

            {/* <div className="mt-5 flex flex-col gap-3 border-t border-[#EEF2F4] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-xs text-[#94A3B8]"><Check size={11} className="text-[#0D8252]" /> All changes automatically cached. Last synced 2 hours ago.</p>
              {editMode && <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60"><Save size={12} /> {saving ? "Saving..." : "Save"}</button>}
            </div> */}
          </section>

          <section className="rounded-2xl border border-[#E5EBEF] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[#0D8252]"><Building2 size={14} /></span><div><h2 className="text-base font-bold text-[#0F172A]">QR Code</h2><p className="text-xs text-[#94A3B8]">Member Check-In Gate</p></div></div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">Member Check-In Gate</span>
            </div>
            <div ref={qrPrintRef} className="flex aspect-square items-center justify-center rounded-xl border border-[#E5EBEF] bg-white p-4">
              {gym?.id ? <QRCodeSVG value={gym.id} size={210} className="h-full w-full" /> : <span className="text-xs text-[#94A3B8]">QR unavailable</span>}
            </div>
            <button type="button" onClick={handlePrintQR} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] py-2 text-xs font-semibold text-white transition hover:bg-[#086B43]"><Download size={12} /> Print QR Code Poster</button>
            <button type="button" onClick={handleDownloadQR} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]"><Download size={12} /> Download High-Res SVG</button>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-relaxed text-[#64748B]"><p><strong className="text-[#0D8252]">Place this QR code at your entrance or reception front desk.</strong> Members scan this QR code to check in, ensuring accurate attendance tracking without manual authorization.</p></div>
          </section>
        </div>
      </div>
    </div>
  );
}
