import { useState, useEffect } from "react";
import { Target, Plus, Trophy, Trash, Pencil, X, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import {
  createWorkoutGoal, getMyWorkoutGoals, getMyGoalById, updateGoal, deleteGoal,
  addMilestone, achieveGoal,
  getApiError
} from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function emptyGoal() { return { type: "STRENGTH", title: "", description: "", targetValue: "", unit: "kg", startDate: new Date().toISOString().slice(0, 10), targetDate: "" }; }
function emptyMilestone() { return { milestoneDate: "", value: "", notes: "" }; }

const goalTypes = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "CONSISTENCY", "CUSTOM"];
const goalStatuses = ["ACTIVE", "ACHIEVED", "CANCELLED"];

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const textareaClass = "min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

function ProgressBar({ current, target }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-gray-200">
      <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function WorkoutGoals({ user }) {
  const [activeGoals, setActiveGoals] = useState([]);
  const [achievedGoals, setAchievedGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [form, setForm] = useState(emptyGoal());
  const [expandedGoalId, setExpandedGoalId] = useState(null);
  const [addingMilestoneFor, setAddingMilestoneFor] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState(emptyMilestone());
  const [achievedOpen, setAchievedOpen] = useState(false);

  const token = user?.token || null;

  function setFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setMilestoneField(field, value) {
    setMilestoneForm((prev) => ({ ...prev, [field]: value }));
  }

  async function loadGoals() {
    try {
      const [activeRes, achievedRes] = await Promise.all([
        getMyWorkoutGoals({ status: "ACTIVE" }, token),
        getMyWorkoutGoals({ status: "ACHIEVED" }, token),
      ]);
      setActiveGoals(Array.isArray(activeRes) ? activeRes : activeRes?.goals || []);
      setAchievedGoals(Array.isArray(achievedRes) ? achievedRes : achievedRes?.goals || []);
    } catch (err) {
      toast.error(getApiError(err, "Failed to load goals"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, []);

  async function handleCreateOrUpdate(e) {
    e.preventDefault();
    const payload = { ...form };
    if (payload.targetValue) payload.targetValue = Number(payload.targetValue);
    try {
      if (editingGoal) {
        await updateGoal(idOf(editingGoal), payload, token);
        toast.success("Goal updated");
      } else {
        await createWorkoutGoal(payload, token);
        toast.success("Goal created");
      }
      setShowForm(false);
      setEditingGoal(null);
      setForm(emptyGoal());
      await loadGoals();
    } catch (err) {
      toast.error(getApiError(err, "Failed to save goal"));
    }
  }

  function startEdit(goal) {
    setEditingGoal(goal);
    setForm({
      type: goal.type || "STRENGTH",
      title: goal.title || "",
      description: goal.description || "",
      targetValue: goal.targetValue ?? "",
      unit: goal.unit || "kg",
      startDate: goal.startDate ? new Date(goal.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : "",
    });
    setShowForm(true);
    setExpandedGoalId(null);
    setAddingMilestoneFor(null);
  }

  function startCreate() {
    setEditingGoal(null);
    setForm(emptyGoal());
    setShowForm(true);
    setExpandedGoalId(null);
    setAddingMilestoneFor(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingGoal(null);
    setForm(emptyGoal());
  }

  async function handleDelete(goal) {
    if (!confirm("Delete this goal?")) return;
    try {
      await deleteGoal(idOf(goal), token);
      toast.success("Goal deleted");
      if (expandedGoalId === idOf(goal)) setExpandedGoalId(null);
      await loadGoals();
    } catch (err) {
      toast.error(getApiError(err, "Failed to delete goal"));
    }
  }

  async function handleAchieve(goal) {
    try {
      await achieveGoal(idOf(goal), token);
      toast.success("Goal achieved!");
      setExpandedGoalId(null);
      await loadGoals();
    } catch (err) {
      toast.error(getApiError(err, "Failed to achieve goal"));
    }
  }

  function toggleExpand(goalId) {
    setExpandedGoalId((prev) => (prev === goalId ? null : goalId));
    setAddingMilestoneFor(null);
  }

  function startAddMilestone(goalId) {
    setAddingMilestoneFor(goalId);
    setMilestoneForm(emptyMilestone());
  }

  function cancelAddMilestone() {
    setAddingMilestoneFor(null);
    setMilestoneForm(emptyMilestone());
  }

  async function handleAddMilestone(goalId) {
    const payload = { ...milestoneForm };
    if (payload.value) payload.value = Number(payload.value);
    try {
      await addMilestone(goalId, payload, token);
      toast.success("Milestone added");
      cancelAddMilestone();
      const updated = await getMyGoalById(goalId, token);
      const goal = updated?.goal || updated;
      setActiveGoals((prev) => prev.map((g) => (idOf(g) === goalId ? { ...g, ...goal } : g)));
    } catch (err) {
      toast.error(getApiError(err, "Failed to add milestone"));
    }
  }

  const milestones = (goal) => {
    const raw = goal.milestones || goal.Milestones || [];
    return Array.isArray(raw) ? raw : [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Fitness Goals</h2>
        {!showForm && (
          <button onClick={startCreate} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            New Goal
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreateOrUpdate} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingGoal ? "Edit Goal" : "New Goal"}
            </h3>
            <button type="button" onClick={cancelForm} className={iconButtonClass}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Type</label>
              <select value={form.type} onChange={(e) => setFormField("type", e.target.value)} className={inputClass}>
                {goalTypes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Title</label>
              <input value={form.title} onChange={(e) => setFormField("title", e.target.value)} placeholder="e.g. Bench Press 100kg" className={inputClass} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Description</label>
              <textarea value={form.description} onChange={(e) => setFormField("description", e.target.value)} placeholder="Optional details..." className={textareaClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Target Value</label>
              <input type="number" value={form.targetValue} onChange={(e) => setFormField("targetValue", e.target.value)} placeholder="e.g. 100" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Unit</label>
              <input value={form.unit} onChange={(e) => setFormField("unit", e.target.value)} placeholder="e.g. kg, reps, km" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setFormField("startDate", e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Target Date</label>
              <input type="date" value={form.targetDate} onChange={(e) => setFormField("targetDate", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={cancelForm} className={buttonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>
              {editingGoal ? "Update Goal" : "Create Goal"}
            </button>
          </div>
        </form>
      )}

      {activeGoals.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-14 text-gray-500">
          <Target className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium">No active goals yet</p>
          <p className="mt-1 text-xs">Click "New Goal" to set your first fitness goal.</p>
        </div>
      )}

      <div className="space-y-4">
        {activeGoals.map((goal) => {
          const gid = idOf(goal);
          const isExpanded = expandedGoalId === gid;
          const currentValue = Number(goal.currentValue || goal.current_value || 0);
          const targetValue = Number(goal.targetValue || goal.targetValue || 0);
          return (
            <div key={gid} className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-start justify-between p-4">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(gid)}>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 shrink-0 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{goal.title || "Untitled"}</h3>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {titleCase(goal.type || "STRENGTH")}
                    </span>
                  </div>
                  {goal.description && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{goal.description}</p>}
                  <div className="mt-3 space-y-1">
                    <ProgressBar current={currentValue} target={targetValue} />
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{currentValue} / {targetValue} {goal.unit || ""}</span>
                      <span>{displayDate(goal.targetDate)}</span>
                    </div>
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-1">
                  <button onClick={() => startAddMilestone(gid)} className={iconButtonClass} title="Add Milestone">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleAchieve(goal)} className={iconButtonClass} title="Achieve Goal">
                    <CheckCircle className="h-4 w-4" />
                  </button>
                  <button onClick={() => startEdit(goal)} className={iconButtonClass} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(goal)} className={iconButtonClass} title="Delete">
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {addingMilestoneFor === gid && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-700">Add Milestone</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Date</label>
                      <input type="date" value={milestoneForm.milestoneDate} onChange={(e) => setMilestoneField("milestoneDate", e.target.value)} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Value ({goal.unit || "units"})</label>
                      <input type="number" value={milestoneForm.value} onChange={(e) => setMilestoneField("value", e.target.value)} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Notes</label>
                      <input value={milestoneForm.notes} onChange={(e) => setMilestoneField("notes", e.target.value)} placeholder="Optional" className={inputClass} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={cancelAddMilestone} className={buttonClass}>Cancel</button>
                    <button onClick={() => handleAddMilestone(gid)} className={primaryButtonClass}>Add</button>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <h4 className="mb-3 text-xs font-semibold text-gray-700">Milestones</h4>
                  {milestones(goal).length === 0 ? (
                    <p className="text-xs text-gray-400">No milestones recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {milestones(goal).map((ms, idx) => (
                        <div key={idOf(ms) || idx} className="relative pl-4 border-l-2 border-blue-200">
                          <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-600" />
                          <p className="text-xs font-medium text-gray-800">{displayDate(ms.milestoneDate || ms.date)}</p>
                          {ms.value != null && <p className="text-xs text-gray-600">Value: {ms.value}</p>}
                          {ms.notes && <p className="text-xs text-gray-500">{ms.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {achievedGoals.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <button
            onClick={() => setAchievedOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Achieved Goals ({achievedGoals.length})
            </span>
            <span className={`transition-transform ${achievedOpen ? "rotate-180" : ""}`}>&#9660;</span>
          </button>
          {achievedOpen && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {achievedGoals.map((goal) => (
                <div key={idOf(goal)} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    <span className="text-sm font-medium text-gray-800 truncate">{goal.title || "Untitled"}</span>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{titleCase(goal.type || "")}</span>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    Achieved: {displayDate(goal.achievedAt || goal.achieved_at || goal.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
