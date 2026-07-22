import { Fragment, useState, useEffect } from "react";
import { ChevronDown, Dumbbell, Pencil, Plus, Search, Trash, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  getWorkoutDays,
  createWorkoutDay, updateWorkoutDay, deleteWorkoutDay,
  assignExerciseToWorkoutDay, updateWorkoutDayExercise, removeWorkoutDayExercise,
  createSupersetGroup, getSupersetGroups, updateSupersetGroup, deleteSupersetGroup,
  getApiError
} from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function emptyDay() { return { title: "", dayNumber: "", notes: "" }; }
function emptyConfig() { return { exerciseId: "", sets: "", reps: "", duration: "", restTime: "", supersetGroupId: "" }; }

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

const muscleGroupOptions = ["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE", "FULL_BODY"];
const trainerRoles = ["PRIMARY", "ASSISTANT", "SUBSTITUTE"];

function displayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={`grid gap-1 text-xs font-semibold uppercase text-gray-500 ${className}`}>{label}{children}</label>;
}

export default function WorkoutDays(props) {
  const { user, role, canManage, canEdit, canDelete, selectedPlan, selectedPlanId, days, setDays, selectedDayId, setSelectedDayId, exercises, refreshSelectedPlan } = props;

  const [dayForm, setDayForm] = useState(emptyDay());
  const [editingDayId, setEditingDayId] = useState("");
  const [showDayForm, setShowDayForm] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [exerciseConfig, setExerciseConfig] = useState(emptyConfig());
  const [editingExerciseId, setEditingExerciseId] = useState("");
  const [editingConfig, setEditingConfig] = useState(emptyConfig());
  const [supersetGroups, setSupersetGroups] = useState([]);
  const [supersetForm, setSupersetForm] = useState({ name: "", restAfterRound: "", orderIndex: "" });
  const [showSupersetForm, setShowSupersetForm] = useState(false);

  useEffect(() => {
    setSelectedDayId("");
    setEditingDayId("");
    setShowDayForm(false);
    setSelectedExerciseId("");
    setExerciseConfig(emptyConfig());
    setExerciseSearch("");
    setMuscleFilter("");
    if (!selectedPlanId) {
      setDays([]);
      return;
    }
    (async () => {
      try {
        const data = await getWorkoutDays(selectedPlanId, user?.token);
        const list = Array.isArray(data) ? data : data?.data || data?.days || [];
        setDays(list);
      } catch (error) {
        toast.error(getApiError(error, "Unable to load workout days"));
      }
    })();
  }, [selectedPlanId]);

  useEffect(() => {
    if (!selectedDayId) {
      setSupersetGroups([]);
      return;
    }
    (async () => {
      try {
        const data = await getSupersetGroups(selectedDayId, user?.token);
        const list = Array.isArray(data) ? data : data?.data || data?.supersets || [];
        setSupersetGroups(list);
      } catch (error) {
        toast.error(getApiError(error, "Unable to load superset groups"));
      }
    })();
  }, [selectedDayId]);

  const handleCreateDay = async (event) => {
    event.preventDefault();
    if (!dayForm.title.trim() || !dayForm.dayNumber) {
      toast.error("Day title and number are required");
      return;
    }
    try {
      await createWorkoutDay(selectedPlanId, { ...dayForm, dayNumber: Number(dayForm.dayNumber) }, user?.token);
      toast.success("Workout day created");
      setShowDayForm(false);
      setDayForm(emptyDay());
      const data = await getWorkoutDays(selectedPlanId, user?.token);
      setDays(Array.isArray(data) ? data : data?.data || data?.days || []);
    } catch (error) {
      toast.error(getApiError(error, "Unable to create workout day"));
    }
  };

  const handleUpdateDay = async (event) => {
    event.preventDefault();
    if (!dayForm.title.trim() || !dayForm.dayNumber) {
      toast.error("Day title and number are required");
      return;
    }
    try {
      await updateWorkoutDay(editingDayId, { ...dayForm, dayNumber: Number(dayForm.dayNumber) }, user?.token);
      toast.success("Workout day updated");
      setEditingDayId("");
      setDayForm(emptyDay());
      const data = await getWorkoutDays(selectedPlanId, user?.token);
      setDays(Array.isArray(data) ? data : data?.data || data?.days || []);
    } catch (error) {
      toast.error(getApiError(error, "Unable to update workout day"));
    }
  };

  const handleDeleteDay = async (dayId) => {
    if (!window.confirm("Are you sure you want to delete this workout day?")) return;
    try {
      await deleteWorkoutDay(dayId, user?.token);
      toast.success("Workout day deleted");
      if (selectedDayId === dayId) setSelectedDayId("");
      const data = await getWorkoutDays(selectedPlanId, user?.token);
      setDays(Array.isArray(data) ? data : data?.data || data?.days || []);
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete workout day"));
    }
  };

  const startEditDay = (day) => {
    setEditingDayId(idOf(day));
    setDayForm({
      title: day.title || "",
      dayNumber: day.dayNumber || "",
      notes: day.notes || "",
    });
    setShowDayForm(false);
  };

  const cancelEditDay = () => {
    setEditingDayId("");
    setDayForm(emptyDay());
  };

  const handleSelectExercise = (exerciseId) => {
    if (selectedExerciseId === exerciseId) {
      setSelectedExerciseId("");
      return;
    }
    setSelectedExerciseId(exerciseId);
    setExerciseConfig(emptyConfig());
  };

  const handleLinkExercise = async (event) => {
    event.preventDefault();
    if (!selectedExerciseId) {
      toast.error("Please select an exercise");
      return;
    }
    try {
      const payload = { exerciseId: selectedExerciseId };
      if (exerciseConfig.sets !== "") payload.sets = Number(exerciseConfig.sets);
      if (exerciseConfig.reps !== "") payload.reps = Number(exerciseConfig.reps);
      if (exerciseConfig.duration !== "") payload.duration = Number(exerciseConfig.duration);
      if (exerciseConfig.restTime !== "") payload.restTime = Number(exerciseConfig.restTime);
      if (exerciseConfig.supersetGroupId) payload.supersetGroupId = exerciseConfig.supersetGroupId;
      if (exerciseConfig.orderIndex !== "") payload.orderIndex = Number(exerciseConfig.orderIndex);
      await assignExerciseToWorkoutDay(selectedDayId, payload, user?.token);
      toast.success("Exercise linked to day");
      setSelectedExerciseId("");
      setExerciseConfig(emptyConfig());
      await refreshSelectedPlan();
    } catch (error) {
      toast.error(getApiError(error, "Unable to link exercise"));
    }
  };

  const startEditExercise = (we) => {
    setEditingExerciseId(idOf(we));
    setEditingConfig({
      exerciseId: we.exerciseId || idOf(we.exercise) || "",
      sets: we.sets ?? "",
      reps: we.reps ?? "",
      duration: we.duration ?? "",
      restTime: we.restTime ?? "",
      supersetGroupId: we.supersetGroupId || "",
    });
  };

  const handleSaveExercise = async (event) => {
    event.preventDefault();
    try {
      const payload = {};
      if (editingConfig.sets !== "") payload.sets = Number(editingConfig.sets);
      if (editingConfig.reps !== "") payload.reps = Number(editingConfig.reps);
      if (editingConfig.duration !== "") payload.duration = Number(editingConfig.duration);
      if (editingConfig.restTime !== "") payload.restTime = Number(editingConfig.restTime);
      await updateWorkoutDayExercise(editingExerciseId, payload, user?.token);
      toast.success("Exercise updated");
      setEditingExerciseId("");
      setEditingConfig(emptyConfig());
      await refreshSelectedPlan();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update exercise"));
    }
  };

  const cancelEditExercise = () => {
    setEditingExerciseId("");
    setEditingConfig(emptyConfig());
  };

  const handleDeleteExercise = async (workoutExerciseId) => {
    if (!window.confirm("Remove this exercise from the day?")) return;
    try {
      await removeWorkoutDayExercise(workoutExerciseId, user?.token);
      toast.success("Exercise removed");
      await refreshSelectedPlan();
    } catch (error) {
      toast.error(getApiError(error, "Unable to remove exercise"));
    }
  };

  const handleCreateSuperset = async (event) => {
    event.preventDefault();
    if (!supersetForm.name.trim()) {
      toast.error("Superset name is required");
      return;
    }
    try {
      const payload = { name: supersetForm.name };
      if (supersetForm.restAfterRound !== "") payload.restAfterRound = Number(supersetForm.restAfterRound);
      if (supersetForm.orderIndex !== "") payload.orderIndex = Number(supersetForm.orderIndex);
      await createSupersetGroup(selectedDayId, payload, user?.token);
      toast.success("Superset group created");
      setShowSupersetForm(false);
      setSupersetForm({ name: "", restAfterRound: "", orderIndex: "" });
      const data = await getSupersetGroups(selectedDayId, user?.token);
      setSupersetGroups(Array.isArray(data) ? data : data?.data || data?.supersets || []);
    } catch (error) {
      toast.error(getApiError(error, "Unable to create superset group"));
    }
  };

  const selectedDay = days.find((d) => idOf(d) === selectedDayId);
  const dayExercises = selectedDay?.exercises || [];

  const filteredExercises = (exercises || []).filter((ex) => {
    const nameMatch = !exerciseSearch || nameOf(ex).toLowerCase().includes(exerciseSearch.toLowerCase());
    const muscleMatch = !muscleFilter || (ex.muscleGroup || "").toUpperCase() === muscleFilter;
    return nameMatch && muscleMatch;
  });

  if (!selectedPlanId) {
    return (
      <Card className="p-8 text-center text-sm text-gray-500">
        Select a workout plan to manage its days and exercises.
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <Card className="p-3">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Dumbbell size={18} className="text-gray-400" />
              <h3 className="font-semibold text-gray-950">{selectedPlan ? nameOf(selectedPlan) : "Workout"} — Days</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">{days.length} day{days.length !== 1 ? "s" : ""} in this plan</p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => { setShowDayForm(!showDayForm); setEditingDayId(""); setDayForm(emptyDay()); }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} />
              {showDayForm ? "Close" : "Add Day"}
            </button>
          )}
        </div>

        {showDayForm && canManage && (
          <form onSubmit={handleCreateDay} className="mb-3 grid gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Day Number">
                <input className={inputClass} type="number" min="1" value={dayForm.dayNumber} onChange={(e) => setDayForm({ ...dayForm, dayNumber: e.target.value })} placeholder="1" />
              </Field>
              <Field label="Title">
                <input className={inputClass} value={dayForm.title} onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })} placeholder="Push Day" />
              </Field>
            </div>
            <Field label="Notes">
              <textarea className="min-h-16 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={dayForm.notes} onChange={(e) => setDayForm({ ...dayForm, notes: e.target.value })} placeholder="Optional notes" />
            </Field>
            <div className="flex gap-2">
              <button type="submit" className={primaryButtonClass}>Create Day</button>
              <button type="button" onClick={() => setShowDayForm(false)} className={buttonClass}>Cancel</button>
            </div>
          </form>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {days.length ? days.map((day) => {
            const dayId = idOf(day);
            const isSelected = selectedDayId === dayId;
            return (
              <button
                key={dayId}
                type="button"
                onClick={() => setSelectedDayId(isSelected ? "" : dayId)}
                className={`group flex flex-col gap-2 rounded-xl border p-4 text-left transition ${isSelected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-950">Day {day.dayNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                    {day.title || "Untitled"}
                  </span>
                </div>
                {day.notes && <p className="text-sm text-gray-500">{day.notes}</p>}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{(day.exercises || []).length} exercise{(day.exercises || []).length !== 1 ? "s" : ""}</span>
                  <span>{displayDate(day.date)}</span>
                </div>
              </button>
            );
          }) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
              No workout days yet.
              {canManage ? " Add one to start building this plan." : ""}
            </div>
          )}
        </div>

        {editingDayId && (
          <form onSubmit={handleUpdateDay} className="mt-3 grid gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Day Number">
                <input className={inputClass} type="number" min="1" value={dayForm.dayNumber} onChange={(e) => setDayForm({ ...dayForm, dayNumber: e.target.value })} />
              </Field>
              <Field label="Title">
                <input className={inputClass} value={dayForm.title} onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })} />
              </Field>
            </div>
            <Field label="Notes">
              <textarea className="min-h-16 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={dayForm.notes} onChange={(e) => setDayForm({ ...dayForm, notes: e.target.value })} />
            </Field>
            <div className="flex gap-2">
              <button type="submit" className={primaryButtonClass}>Update Day</button>
              <button type="button" onClick={cancelEditDay} className={buttonClass}>Cancel</button>
            </div>
          </form>
        )}
      </Card>

      {selectedDayId && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <Search size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-950">Exercise Library</h3>
            </div>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3">
                <Search size={16} className="text-gray-400" />
                <input className="h-9 min-w-0 flex-1 text-sm outline-none" value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Search exercises..." />
              </div>
              <select className={inputClass} value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)}>
                <option value="">All Muscle Groups</option>
                {muscleGroupOptions.map((mg) => <option key={mg} value={mg}>{titleCase(mg)}</option>)}
              </select>
            </div>
            <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {filteredExercises.map((ex) => {
                const exId = idOf(ex);
                const isExSelected = selectedExerciseId === exId;
                return (
                  <button
                    key={exId}
                    type="button"
                    onClick={() => handleSelectExercise(exId)}
                    className={`flex w-full items-center gap-3 px-2 py-2 text-left text-sm transition ${isExSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <Dumbbell size={15} className={isExSelected ? "text-blue-600" : "text-gray-400"} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium ${isExSelected ? "text-blue-700" : "text-gray-900"}`}>{nameOf(ex)}</p>
                      {ex.muscleGroup && <p className="text-xs text-gray-500">{titleCase(ex.muscleGroup)}</p>}
                    </div>
                  </button>
                );
              })}
              {filteredExercises.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">No exercises found.</p>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            {selectedExerciseId && (
              <Card className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-950">Link Exercise</h3>
                  <button type="button" onClick={() => setSelectedExerciseId("")} className={iconButtonClass} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  Configuring {nameOf((exercises || []).find((ex) => idOf(ex) === selectedExerciseId))}
                </p>
                <form onSubmit={handleLinkExercise} className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Sets">
                      <input className={inputClass} type="number" min="0" value={exerciseConfig.sets} onChange={(e) => setExerciseConfig({ ...exerciseConfig, sets: e.target.value })} placeholder="4" />
                    </Field>
                    <Field label="Reps">
                      <input className={inputClass} type="number" min="0" value={exerciseConfig.reps} onChange={(e) => setExerciseConfig({ ...exerciseConfig, reps: e.target.value })} placeholder="10" />
                    </Field>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Duration (seconds)">
                      <input className={inputClass} type="number" min="0" value={exerciseConfig.duration} onChange={(e) => setExerciseConfig({ ...exerciseConfig, duration: e.target.value })} placeholder="60" />
                    </Field>
                    <Field label="Rest (seconds)">
                      <input className={inputClass} type="number" min="0" value={exerciseConfig.restTime} onChange={(e) => setExerciseConfig({ ...exerciseConfig, restTime: e.target.value })} placeholder="90" />
                    </Field>
                  </div>
                  <Field label="Order Index">
                    <input className={inputClass} type="number" min="0" value={exerciseConfig.orderIndex} onChange={(e) => setExerciseConfig({ ...exerciseConfig, orderIndex: e.target.value })} placeholder="1" />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Field label="Superset Group">
                      <select className={inputClass} value={exerciseConfig.supersetGroupId} onChange={(e) => setExerciseConfig({ ...exerciseConfig, supersetGroupId: e.target.value })}>
                        <option value="">No superset</option>
                        {supersetGroups.map((sg) => <option key={idOf(sg)} value={idOf(sg)}>{sg.name || `Superset ${idOf(sg).slice(-4)}`}</option>)}
                      </select>
                    </Field>
                    <div className="flex items-end">
                      <button type="button" onClick={() => setShowSupersetForm(!showSupersetForm)} className={buttonClass}>
                        <Plus size={15} /> New
                      </button>
                    </div>
                  </div>
                  {showSupersetForm && (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-gray-500">New Superset</span>
                        <button type="button" onClick={() => setShowSupersetForm(false)} className={iconButtonClass} aria-label="Close">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid gap-2">
                        <Field label="Superset Name">
                          <input className={inputClass} value={supersetForm.name} onChange={(e) => setSupersetForm({ ...supersetForm, name: e.target.value })} placeholder="Superset A" />
                        </Field>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label="Rest After Round">
                            <input className={inputClass} type="number" min="0" value={supersetForm.restAfterRound} onChange={(e) => setSupersetForm({ ...supersetForm, restAfterRound: e.target.value })} placeholder="120" />
                          </Field>
                          <Field label="Order Index">
                            <input className={inputClass} type="number" min="0" value={supersetForm.orderIndex} onChange={(e) => setSupersetForm({ ...supersetForm, orderIndex: e.target.value })} placeholder="1" />
                          </Field>
                        </div>
                        <button type="button" onClick={handleCreateSuperset} className={primaryButtonClass}>Create Superset</button>
                      </div>
                    </div>
                  )}
                  <button type="submit" className={primaryButtonClass}>Link to Day</button>
                </form>
              </Card>
            )}

            <Card className="p-3">
              <h3 className="mb-2 font-semibold text-gray-950">
                {selectedDay ? `Day ${selectedDay.dayNumber}: ${selectedDay.title || "Untitled"}` : "Day"} — Exercises
              </h3>
              <div className="divide-y divide-gray-100">
                {dayExercises.map((we) => {
                  const weId = idOf(we);
                  const exercise = we.exercise || {};
                  const exName = nameOf(exercise);
                  const isEditingEx = editingExerciseId === weId;
                  return (
                    <div key={weId} className="py-2">
                      {isEditingEx ? (
                        <form onSubmit={handleSaveExercise} className="grid gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Field label="Sets">
                              <input className={inputClass} type="number" min="0" value={editingConfig.sets} onChange={(e) => setEditingConfig({ ...editingConfig, sets: e.target.value })} />
                            </Field>
                            <Field label="Reps">
                              <input className={inputClass} type="number" min="0" value={editingConfig.reps} onChange={(e) => setEditingConfig({ ...editingConfig, reps: e.target.value })} />
                            </Field>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Field label="Duration">
                              <input className={inputClass} type="number" min="0" value={editingConfig.duration} onChange={(e) => setEditingConfig({ ...editingConfig, duration: e.target.value })} />
                            </Field>
                            <Field label="Rest">
                              <input className={inputClass} type="number" min="0" value={editingConfig.restTime} onChange={(e) => setEditingConfig({ ...editingConfig, restTime: e.target.value })} />
                            </Field>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className={primaryButtonClass}>Save</button>
                            <button type="button" onClick={cancelEditExercise} className={buttonClass}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-3 px-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">{exName}</p>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                              {we.sets != null && we.sets !== "" && <span>{we.sets} sets</span>}
                              {we.reps != null && we.reps !== "" && <span>{we.reps} reps</span>}
                              {we.duration != null && we.duration !== "" && <span>{we.duration}s</span>}
                              {we.restTime != null && we.restTime !== "" && <span>rest {we.restTime}s</span>}
                              {we.supersetGroupId && <span className="font-medium text-blue-600">Superset</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <button type="button" onClick={() => startEditExercise(we)} className={iconButtonClass} aria-label="Edit exercise">
                                <Pencil size={13} />
                              </button>
                            )}
                            {canDelete && (
                              <button type="button" onClick={() => handleDeleteExercise(weId)} className={iconButtonClass} aria-label="Remove exercise">
                                <Trash size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {dayExercises.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">No exercises linked to this day. Select an exercise from the library and link it.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
