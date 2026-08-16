import { useState, useEffect } from "react";
import { Pencil, Plus, Trash, X, LineChart } from "lucide-react";
import { LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import toast from "react-hot-toast";
import {
  createMeasurement, getMyMeasurements, getLatestMeasurement,
  updateMeasurement, deleteMeasurement, getMeasurementTrends,
  getApiError
} from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function emptyMeasurement() { return { date: new Date().toISOString().slice(0, 10), weight: "", bodyFat: "", chest: "", waist: "", hips: "", arms: "", thighs: "", calves: "", shoulders: "", notes: "", photoFront: "", photoSide: "", photoBack: "" }; }

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const textareaClass = "min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={`grid gap-1 text-xs font-semibold uppercase text-gray-500 ${className}`}>{label}{children}</label>;
}

export default function WorkoutMeasurements({ user }) {
  const [latest, setLatest] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyMeasurement());
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [inlineEditId, setInlineEditId] = useState("");
  const [inlineForm, setInlineForm] = useState(emptyMeasurement());

  const token = user?.token;

  const loadData = async () => {
    try {
      const [latestData, measurementsData, trendsData] = await Promise.all([
        getLatestMeasurement(token).catch(() => null),
        getMyMeasurements({ limit: 50 }, token),
        getMeasurementTrends(token).catch(() => []),
      ]);
      setLatest(latestData);
      setMeasurements(Array.isArray(measurementsData) ? measurementsData : measurementsData?.measurements || measurementsData?.data || []);
      setTrends(Array.isArray(trendsData) ? trendsData : trendsData?.trends || trendsData?.data || []);
    } catch (error) {
      toast.error(getApiError(error, "Unable to load measurements"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasFormData = (data) => {
    return Object.entries(data).some(([key, value]) => key !== "notes" && value !== "" && value !== null && value !== undefined);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!hasFormData(form)) {
      toast.error("At least one measurement field is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      const numberFields = ["weight", "bodyFat", "chest", "waist", "hips", "arms", "thighs", "calves", "shoulders"];
      for (const [key, value] of Object.entries(form)) {
        if (value !== "" && value !== null && value !== undefined) {
          payload[key] = numberFields.includes(key) ? Number(value) : value;
        }
      }
      if (editingId) {
        await updateMeasurement(editingId, payload, token);
        toast.success("Measurement updated");
      } else {
        await createMeasurement(payload, token);
        toast.success("Measurement created");
      }
      setForm(emptyMeasurement());
      setEditingId("");
      setShowForm(false);
      await loadData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save measurement"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this measurement?")) return;
    try {
      await deleteMeasurement(id, token);
      toast.success("Measurement deleted");
      await loadData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete measurement"));
    }
  };

  const startInlineEdit = (item) => {
    setInlineEditId(idOf(item));
    setInlineForm({
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : "",
      weight: item.weight ?? "",
      bodyFat: item.bodyFat ?? "",
      chest: item.chest ?? "",
      waist: item.waist ?? "",
      hips: item.hips ?? "",
      arms: item.arms ?? "",
      thighs: item.thighs ?? "",
      calves: item.calves ?? "",
      shoulders: item.shoulders ?? "",
      notes: item.notes ?? "",
      photoFront: item.photoFront ?? "",
      photoSide: item.photoSide ?? "",
      photoBack: item.photoBack ?? "",
    });
  };

  const handleInlineSave = async (id) => {
    if (!hasFormData(inlineForm)) {
      toast.error("At least one measurement field is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      const numberFields = ["weight", "bodyFat", "chest", "waist", "hips", "arms", "thighs", "calves", "shoulders"];
      for (const [key, value] of Object.entries(inlineForm)) {
        if (value !== "" && value !== null && value !== undefined) {
          payload[key] = numberFields.includes(key) ? Number(value) : value;
        }
      }
      await updateMeasurement(id, payload, token);
      toast.success("Measurement updated");
      setInlineEditId("");
      setInlineForm(emptyMeasurement());
      await loadData();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update measurement"));
    } finally {
      setSaving(false);
    }
  };

  const cancelInlineEdit = () => {
    setInlineEditId("");
    setInlineForm(emptyMeasurement());
  };

  const openCreateForm = () => {
    setEditingId("");
    setForm(emptyMeasurement());
    setShowForm(true);
  };

  const sortedMeasurements = [...measurements].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    return dateB - dateA;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-gray-500">Loading measurements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-950">Measurements</h2>
        <button type="button" onClick={openCreateForm} className={primaryButtonClass}>
          <Plus size={17} />
          Add New
        </button>
      </div>

      {latest && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-950">Latest Measurement</h3>
            <span className="text-xs text-gray-500">{displayDate(latest.date)}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {latest.weight !== null && latest.weight !== undefined && (
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Weight</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{latest.weight} <span className="text-xs font-normal text-gray-500">kg</span></p>
              </div>
            )}
            {latest.bodyFat !== null && latest.bodyFat !== undefined && (
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Body Fat</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{latest.bodyFat} <span className="text-xs font-normal text-gray-500">%</span></p>
              </div>
            )}
            {latest.chest !== null && latest.chest !== undefined && (
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Chest</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{latest.chest} <span className="text-xs font-normal text-gray-500">cm</span></p>
              </div>
            )}
            {latest.waist !== null && latest.waist !== undefined && (
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Waist</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{latest.waist} <span className="text-xs font-normal text-gray-500">cm</span></p>
              </div>
            )}
            {latest.arms !== null && latest.arms !== undefined && (
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Arms</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{latest.arms} <span className="text-xs font-normal text-gray-500">cm</span></p>
              </div>
            )}
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-950">{editingId ? "Edit Measurement" : "New Measurement"}</h3>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(""); setForm(emptyMeasurement()); }} className={iconButtonClass}>
              <X size={17} />
            </button>
          </div>
          <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date">
              <input className={inputClass} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Weight (kg)">
              <input className={inputClass} type="number" step="0.1" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="75" />
            </Field>
            <Field label="Body Fat (%)">
              <input className={inputClass} type="number" step="0.1" min="0" max="100" value={form.bodyFat} onChange={(e) => setForm({ ...form, bodyFat: e.target.value })} placeholder="15" />
            </Field>
            <Field label="Chest (cm)">
              <input className={inputClass} type="number" step="0.1" min="0" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} placeholder="100" />
            </Field>
            <Field label="Waist (cm)">
              <input className={inputClass} type="number" step="0.1" min="0" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} placeholder="85" />
            </Field>
            <Field label="Hips (cm)">
              <input className={inputClass} type="number" step="0.1" min="0" value={form.hips} onChange={(e) => setForm({ ...form, hips: e.target.value })} placeholder="95" />
            </Field>
            <Field label="Arms (cm)">
              <input className={inputClass} type="number" step="0.1" min="0" value={form.arms} onChange={(e) => setForm({ ...form, arms: e.target.value })} placeholder="35" />
            </Field>
            <Field label="Thighs (cm)">
              <input className={inputClass} type="number" step="0.1" min="0" value={form.thighs} onChange={(e) => setForm({ ...form, thighs: e.target.value })} placeholder="55" />
            </Field>
            <Field label="Calves (cm)">
              <input className={inputClass} type="number" step="0.1" min="0" value={form.calves} onChange={(e) => setForm({ ...form, calves: e.target.value })} placeholder="38" />
            </Field>
            <Field label="Shoulders (cm)">
              <input className={inputClass} type="number" step="0.1" min="0" value={form.shoulders} onChange={(e) => setForm({ ...form, shoulders: e.target.value })} placeholder="115" />
            </Field>
            <Field label="Notes" className="sm:col-span-2 lg:col-span-4">
              <textarea className={textareaClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
            </Field>
            <Field label="Photo Front URL" className="sm:col-span-2">
              <input className={inputClass} type="url" value={form.photoFront} onChange={(e) => setForm({ ...form, photoFront: e.target.value })} placeholder="https://example.com/front.jpg" />
            </Field>
            <Field label="Photo Side URL" className="sm:col-span-2">
              <input className={inputClass} type="url" value={form.photoSide} onChange={(e) => setForm({ ...form, photoSide: e.target.value })} placeholder="https://example.com/side.jpg" />
            </Field>
            <Field label="Photo Back URL" className="sm:col-span-2">
              <input className={inputClass} type="url" value={form.photoBack} onChange={(e) => setForm({ ...form, photoBack: e.target.value })} placeholder="https://example.com/back.jpg" />
            </Field>
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" className={primaryButtonClass} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(""); setForm(emptyMeasurement()); }} className={buttonClass}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {trends.length > 0 && (
        <Card className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <LineChart size={18} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-950">Trends</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLine data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(val) => displayDate(val)} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis yAxisId="weight" orientation="left" stroke="#3b82f6" tick={{ fontSize: 12 }} label={{ value: "Weight (kg)", angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "#6b7280" } }} />
              <YAxis yAxisId="bodyFat" orientation="right" stroke="#ef4444" tick={{ fontSize: 12 }} label={{ value: "Body Fat (%)", angle: 90, position: "insideRight", style: { fontSize: 12, fill: "#6b7280" } }} />
              <Tooltip labelFormatter={(val) => displayDate(val)} contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }} />
              <Legend />
              <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Weight (kg)" connectNulls />
              <Line yAxisId="bodyFat" type="monotone" dataKey="bodyFat" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Body Fat (%)" connectNulls />
            </RechartsLine>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-950">Measurement History</h3>
        </div>
        {sortedMeasurements.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No measurements recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Body Fat</th>
                  <th className="px-4 py-3">Chest</th>
                  <th className="px-4 py-3">Waist</th>
                  <th className="px-4 py-3">Arms</th>
                  <th className="px-4 py-3">Thighs</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedMeasurements.map((item) => {
                  const itemId = idOf(item);
                  const isEditing = inlineEditId === itemId;
                  return (
                    <tr key={itemId} className="group hover:bg-gray-50/50">
                      {isEditing ? (
                        <>
                          <td className="px-4 py-2">
                            <input className={inputClass} type="date" value={inlineForm.date} onChange={(e) => setInlineForm({ ...inlineForm, date: e.target.value })} />
                          </td>
                          <td className="px-4 py-2">
                            <input className={inputClass} type="number" step="0.1" min="0" value={inlineForm.weight} onChange={(e) => setInlineForm({ ...inlineForm, weight: e.target.value })} />
                          </td>
                          <td className="px-4 py-2">
                            <input className={inputClass} type="number" step="0.1" min="0" max="100" value={inlineForm.bodyFat} onChange={(e) => setInlineForm({ ...inlineForm, bodyFat: e.target.value })} />
                          </td>
                          <td className="px-4 py-2">
                            <input className={inputClass} type="number" step="0.1" min="0" value={inlineForm.chest} onChange={(e) => setInlineForm({ ...inlineForm, chest: e.target.value })} />
                          </td>
                          <td className="px-4 py-2">
                            <input className={inputClass} type="number" step="0.1" min="0" value={inlineForm.waist} onChange={(e) => setInlineForm({ ...inlineForm, waist: e.target.value })} />
                          </td>
                          <td className="px-4 py-2">
                            <input className={inputClass} type="number" step="0.1" min="0" value={inlineForm.arms} onChange={(e) => setInlineForm({ ...inlineForm, arms: e.target.value })} />
                          </td>
                          <td className="px-4 py-2">
                            <input className={inputClass} type="number" step="0.1" min="0" value={inlineForm.thighs} onChange={(e) => setInlineForm({ ...inlineForm, thighs: e.target.value })} />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => handleInlineSave(itemId)} disabled={saving} className={iconButtonClass} title="Save">
                                <Pencil size={15} />
                              </button>
                              <button type="button" onClick={cancelInlineEdit} className={iconButtonClass} title="Cancel">
                                <X size={15} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-950">{displayDate(item.date)}</td>
                          <td className="whitespace-nowrap px-4 py-3">{item.weight ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3">{item.bodyFat ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3">{item.chest ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3">{item.waist ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3">{item.arms ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3">{item.thighs ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                              <button type="button" onClick={() => startInlineEdit(item)} className={iconButtonClass} title="Edit">
                                <Pencil size={15} />
                              </button>
                              <button type="button" onClick={() => handleDelete(itemId)} className={`${iconButtonClass} hover:text-red-600`} title="Delete">
                                <Trash size={15} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
