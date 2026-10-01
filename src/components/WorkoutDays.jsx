import { Fragment, useEffect, useState } from "react";
import { Dumbbell, Edit, Play, Plus, Trash, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  createWorkoutDay, updateWorkoutDay, deleteWorkoutDay,
  updateWorkoutDayExercise, removeWorkoutDayExercise,
  getApiError, startWorkoutSession
} from "../services/api";
import TablePagination from "./TablePagination";
import AddExerciseModal from "./AddExerciseModal";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function emptyDay() { return { title: "", dayNumber: "", notes: "" }; }
function emptyConfig() { return { exerciseId: "", sets: "", reps: "", duration: "", restTime: "", supersetGroupId: "" }; }

const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const modalInputClass = "h-8 w-full rounded-lg border border-[#E2E8F0] bg-[#FBFCFD]/20 px-3 text-xs text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252]/30 focus:bg-white";
const modalButtonClass = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]";
const modalPrimaryButtonClass = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]";
const DAY_PAGE_SIZE = 10;

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={`grid gap-1 text-xs font-semibold uppercase text-gray-500 ${className}`}>{label}{children}</label>;
}

function normalizeDayExerciseLinks(day) {
  if (!day) return [];
  const candidates = [
    day?.exercises,
    day?.workoutExercises,
    day?.items,
    day?.links,
    day?.exerciseLinks,
    day?.workoutExerciseLinks,
    day?.exerciseLinksData,
    day?.data?.exercises,
    day?.data?.workoutExercises,
    day?.data?.items,
    day?.data?.links,
    day?.data?.exerciseLinks,
  ];
  return [...(candidates.find(Array.isArray) || [])]
    .sort((a, b) => Number(a?.orderIndex ?? Number.MAX_SAFE_INTEGER) - Number(b?.orderIndex ?? Number.MAX_SAFE_INTEGER));
}

export default function WorkoutDays(props) {
  const { user, role, canManage, canEdit, canDelete, selectedPlan, selectedPlanId, days, setDays, daysLoading, selectedDayId, setSelectedDayId, activeSession, assignmentId, onStartWorkout, onResumeWorkout, exercises, refreshSelectedPlan } = props;

  const [dayForm, setDayForm] = useState(emptyDay());
  const [editingDayId, setEditingDayId] = useState("");
  const [showDayForm, setShowDayForm] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [editingExerciseDay, setEditingExerciseDay] = useState(null);
  const [editingConfig, setEditingConfig] = useState(emptyConfig());
  const [dayPage, setDayPage] = useState(1);
  const [savingDay, setSavingDay] = useState(false);

  const closeDayModal = () => {
    setShowDayForm(false);
    setDayForm(emptyDay());
  };

  const openDayModal = () => {
    setEditingDayId("");
    const highestDayNumber = days.reduce((highest, day) => Math.max(highest, Number(day.dayNumber) || 0), 0);
    setDayForm({ ...emptyDay(), dayNumber: String(highestDayNumber + 1) });
    setShowDayForm(true);
  };

  useEffect(() => {
    if (!editingExercise) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [editingExercise]);

  const handleCreateDay = async (event) => {
    event.preventDefault();
    if (savingDay) return;
    const dayNumber = Number(dayForm.dayNumber);
    if (!dayForm.title.trim() || !dayForm.dayNumber) {
      toast.error("Day title and number are required");
      return;
    }
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      toast.error("Day number must be a positive whole number");
      return;
    }
    if (days.some((day) => Number(day.dayNumber) === dayNumber)) {
      toast.error("Day number must be unique within this workout plan");
      return;
    }
    if (!selectedPlanId) {
      toast.error("Select a workout plan before creating a workout day");
      return;
    }
    try {
      setSavingDay(true);
      const response = await createWorkoutDay(selectedPlanId, {
        dayNumber,
        title: dayForm.title.trim(),
        ...(dayForm.notes.trim() && { notes: dayForm.notes.trim() }),
      }, user?.token);
      const createdDay = response?.data?.data || response?.data || response;
      const newDay = {
        ...(createdDay && typeof createdDay === "object" ? createdDay : {}),
        dayNumber,
        title: dayForm.title.trim(),
        ...(dayForm.notes.trim() && { notes: dayForm.notes.trim() }),
        exercises: Array.isArray(createdDay?.exercises) ? createdDay.exercises : [],
      };
      setDays((current) => [...current.filter((day) => Number(day.dayNumber) !== dayNumber), newDay]
        .sort((first, second) => Number(first.dayNumber) - Number(second.dayNumber)));
      toast.success("Workout day created");
      closeDayModal();
      setDayPage(1);
      try {
        await refreshSelectedPlan();
      } catch (error) {
        toast.error(getApiError(error, "Workout day created, but the list could not be refreshed"));
      }
    } catch (error) {
      toast.error(getApiError(error, "Unable to create workout day"));
    } finally {
      setSavingDay(false);
    }
  };

  const handleUpdateDay = async (event) => {
    event.preventDefault();
    const dayNumber = Number(dayForm.dayNumber);
    const originalDay = days.find((day) => idOf(day) === editingDayId);
    if (!dayForm.title.trim() || !dayForm.dayNumber) {
      toast.error("Day title and number are required");
      return;
    }
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      toast.error("Day number must be a positive whole number");
      return;
    }
    if (days.some((day) => idOf(day) !== editingDayId && Number(day.dayNumber) === dayNumber)) {
      toast.error("Day number must be unique within this workout plan");
      return;
    }
    const payload = {};
    if (dayForm.title.trim() !== (originalDay?.title || "")) payload.title = dayForm.title.trim();
    if (dayNumber !== Number(originalDay?.dayNumber)) payload.dayNumber = dayNumber;
    if (dayForm.notes !== (originalDay?.notes || "")) payload.notes = dayForm.notes;
    if (!Object.keys(payload).length) {
      cancelEditDay();
      toast.success("No changes to save");
      return;
    }
    try {
      setSavingDay(true);
      const response = await updateWorkoutDay(editingDayId, payload, user?.token);
      const updatedDay = response?.data?.data || response?.data || response;
      setDays((current) => current.map((day) => idOf(day) === editingDayId
        ? { ...day, ...payload, ...(updatedDay && typeof updatedDay === "object" ? updatedDay : {}) }
        : day).sort((first, second) => Number(first.dayNumber) - Number(second.dayNumber)));
      toast.success("Workout day updated");
      setEditingDayId("");
      setDayForm(emptyDay());
      setDayPage(1);
      try {
        await refreshSelectedPlan();
      } catch (error) {
        toast.error(getApiError(error, "Workout day updated, but the list could not be refreshed"));
      }
    } catch (error) {
      toast.error(getApiError(error, "Unable to update workout day"));
    } finally {
      setSavingDay(false);
    }
  };

  const handleDeleteDay = async (dayId) => {
    if (!window.confirm("Are you sure you want to delete this workout day?")) return;
    try {
      setSavingDay(true);
      await deleteWorkoutDay(dayId, user?.token);
      setDays((current) => current.filter((day) => idOf(day) !== dayId));
      toast.success("Workout day deleted");
      if (selectedDayId === dayId) setSelectedDayId("");
      try {
        await refreshSelectedPlan();
      } catch (error) {
        toast.error(getApiError(error, "Workout day deleted, but the list could not be refreshed"));
      }
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete workout day"));
    } finally {
      setSavingDay(false);
    }
  };

  const handleStartWorkout = async (dayId) => {
    if (activeSession) {
      onResumeWorkout?.();
      return;
    }
    try {
      if (onStartWorkout) {
        await onStartWorkout(dayId);
      } else {
        await startWorkoutSession({ workoutDayId: dayId, workoutPlanId: selectedPlanId, ...(assignmentId && { assignmentId }) }, user?.token);
      }
      toast.success("Workout started");
    } catch (error) {
      toast.error(getApiError(error, "Unable to start workout"));
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

  useEffect(() => {
    if (!editingDayId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [editingDayId]);

  const startEditExercise = (we, day) => {
    setEditingExercise(we);
    setEditingExerciseDay(day);
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
      await updateWorkoutDayExercise(idOf(editingExercise), payload, user?.token);
      toast.success("Exercise updated");
      setEditingExercise(null);
      setEditingExerciseDay(null);
      setEditingConfig(emptyConfig());
      await refreshSelectedPlan();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update exercise"));
    }
  };

  const cancelEditExercise = () => {
    setEditingExercise(null);
    setEditingExerciseDay(null);
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

  const openAddExercise = (dayId) => {
    setSelectedDayId(dayId);
    setShowAddExerciseModal(true);
  };

  const sortedDays = [...days].sort((first, second) => Number(first.dayNumber) - Number(second.dayNumber));
  const dayTotalPages = Math.max(1, Math.ceil(sortedDays.length / DAY_PAGE_SIZE));
  const currentDayPage = Math.min(dayPage, dayTotalPages);
  const paginatedDays = sortedDays.slice((currentDayPage - 1) * DAY_PAGE_SIZE, currentDayPage * DAY_PAGE_SIZE);
  const editDayNumber = Number(dayForm.dayNumber);
  const editDayInvalid = !dayForm.title.trim() || !dayForm.dayNumber || !Number.isInteger(editDayNumber) || editDayNumber < 1 ||
    days.some((day) => idOf(day) !== editingDayId && Number(day.dayNumber) === editDayNumber);

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden rounded-xl border border-[#E5EAF0] shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-0">
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"><Dumbbell size={12} /></div>
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-bold text-[#0F172A]">{selectedPlan ? nameOf(selectedPlan) : "Workout Plan"}</h3>
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">{days.length} day(s) in this plan</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {role === "member" && selectedDayId && (
            <button type="button" onClick={() => handleStartWorkout(selectedDayId)} className={primaryButtonClass}>
              <Play size={15} />
              {activeSession ? "Resume Workout" : "Start Workout"}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={openDayModal}
              disabled={savingDay || daysLoading}
              className={modalPrimaryButtonClass}
            >
              <Plus size={13} />
              Add Day
            </button>
          )}
          </div>
        </div>

        <div className="border-t border-[#EEF2F4] p-3">
        <div className="space-y-3">
          {daysLoading ? (
            <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#FBFCFD] px-4 py-8 text-center text-xs text-[#94A3B8]">Loading workout days...</div>
          ) : paginatedDays.length ? paginatedDays.map((day) => {
            const dayId = idOf(day);
            const isSelected = selectedDayId === dayId;
            const dayExercises = normalizeDayExerciseLinks(day);
            return (
              <section key={dayId} className={`overflow-hidden rounded-lg border transition ${isSelected ? "border-[#A7E4C5]" : "border-[#E5EAF0] bg-white"}`}>
                <div className="flex flex-col gap-2 border-b border-[#EEF2F4] bg-[#FBFCFD] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={() => setSelectedDayId(isSelected ? "" : dayId)} className="min-w-0 rounded-lg text-left">
                    <p className="truncate text-sm font-bold text-[#0F172A]">Day {day.dayNumber}: {day.title || "Exercises"}</p>
                    <p className="mt-0.5 text-[11px] text-[#94A3B8]">{dayExercises.length} exercise{dayExercises.length === 1 ? "" : "s"}{day.notes ? ` - ${day.notes}` : ""}</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {canManage && role !== "member" && <button type="button" onClick={() => openAddExercise(dayId)} className={modalPrimaryButtonClass}><Plus size={13} /> Add Exercises</button>}
                    {canEdit && role !== "member" && <button type="button" onClick={() => startEditDay(day)} disabled={savingDay} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0D8252] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Edit day ${day.dayNumber}`}><Edit size={14} /></button>}
                    {canDelete && role !== "member" && <button type="button" onClick={() => handleDeleteDay(dayId)} disabled={savingDay} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition bg-rose-50 hover:bg-rose-60 text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Delete day ${day.dayNumber}`}><Trash size={13} /></button>}
                  </div>
                </div>
                <div className="space-y-1.5 p-2">
                  {dayExercises.map((workoutExercise) => {
                    const workoutExerciseId = idOf(workoutExercise);
                    const exercise = workoutExercise.exercise || workoutExercise.workoutExercise?.exercise || workoutExercise;
                    return (
                      <div key={workoutExerciseId} className="rounded-lg border border-[#EEF2F4] px-3 py-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <button type="button" onClick={() => setSelectedDayId(dayId)} className="min-w-0 flex-1 rounded-lg text-left">
                            <p className="truncate text-xs font-semibold text-[#0F172A]">{nameOf(exercise)}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#64748B]">
                              {workoutExercise.sets != null && workoutExercise.sets !== "" && <span>{workoutExercise.sets} sets</span>}
                              {workoutExercise.reps != null && workoutExercise.reps !== "" && <span>{workoutExercise.reps} reps</span>}
                              {workoutExercise.weight != null && workoutExercise.weight !== "" && <span>{workoutExercise.weight} kg</span>}
                              {workoutExercise.duration != null && workoutExercise.duration !== "" && <span>{workoutExercise.duration}s</span>}
                              {workoutExercise.restTime != null && workoutExercise.restTime !== "" && <span>{workoutExercise.restTime}s rest</span>}
                              {workoutExercise.supersetGroupId && <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-[#0D8252]">Superset</span>}
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            {canEdit && role !== "member" && <button type="button" onClick={() => startEditExercise(workoutExercise, day)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0D8252]" aria-label={`Edit ${nameOf(exercise)}`}><Edit size={15} /></button>}
                            {canDelete && role !== "member" && <button type="button" onClick={() => handleDeleteExercise(workoutExerciseId)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${nameOf(exercise)}`}><Trash size={12} /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!dayExercises.length && <p className="px-1 py-2 text-[10px] text-[#94A3B8]">No exercises added yet.</p>}
                </div>
                {role === "member" && <div className="border-t border-[#EEF2F4] px-2 py-2"><button type="button" onClick={() => handleStartWorkout(dayId)} className={`${modalPrimaryButtonClass} w-full`}><Play size={13} /> {activeSession ? "Resume Workout" : "Start Workout"}</button></div>}
              </section>
            );
          }) : (
            <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#FBFCFD] px-4 py-8 text-center text-xs text-[#94A3B8]">No workout days yet{canManage ? ". Add one to start building this plan." : "."}</div>
          )}
        </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <p>Page {currentDayPage} of {dayTotalPages} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {paginatedDays.length} records</p>
          <TablePagination page={currentDayPage} totalPages={dayTotalPages} onPageChange={setDayPage} previousLabel="Prev" />
        </div>

      </Card>

      {showDayForm && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && closeDayModal()}>
          <div role="dialog" aria-modal="true" aria-labelledby="add-day-title" className="w-full max-w-md overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Dumbbell size={15} /></div>
                <div>
                  <h3 id="add-day-title" className="text-base font-bold text-[#0F172A]">Add Days</h3>
                  <p className="mt-0.5 text-xs leading-4 text-[#64748B]">{days.length} day(s) in this plan</p>
                </div>
              </div>
              <button type="button" onClick={closeDayModal} disabled={savingDay} className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Close add days modal"><X size={14} /></button>
            </div>
            <form onSubmit={handleCreateDay}>
              <div className="grid gap-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Day Number"><input className={modalInputClass} type="number" min="1" value={dayForm.dayNumber} onChange={(event) => setDayForm({ ...dayForm, dayNumber: event.target.value })} placeholder="1" /></Field>
                <Field label="Title"><input className={modalInputClass} value={dayForm.title} onChange={(event) => setDayForm({ ...dayForm, title: event.target.value })} placeholder="Push Day" /></Field>
              </div>
              <Field label="Notes"><textarea className="min-h-20 w-full resize-y rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] px-3 py-2 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white" value={dayForm.notes} onChange={(event) => setDayForm({ ...dayForm, notes: event.target.value })} placeholder="Optional notes" /></Field>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FBFCFD] px-5 py-4">
                <button type="button" onClick={closeDayModal} disabled={savingDay} className={modalButtonClass}>Cancel</button>
                <button type="submit" disabled={savingDay} className={modalPrimaryButtonClass}>{savingDay ? "Creating..." : "Create Day"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingDayId && canEdit && role !== "member" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && !savingDay && cancelEditDay()}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-day-title" className="w-full max-w-md overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Dumbbell size={15} /></div>
                <div>
                  <h3 id="edit-day-title" className="text-base font-bold text-[#0F172A]">Edit Workout Day</h3>
                  <p className="mt-0.5 text-xs leading-4 text-[#64748B]">Update the selected day details</p>
                </div>
              </div>
              <button type="button" onClick={cancelEditDay} disabled={savingDay} className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Close edit workout day modal"><X size={14} /></button>
            </div>
            <form onSubmit={handleUpdateDay} className="grid gap-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Day Number"><input required className={modalInputClass} type="number" min="1" step="1" value={dayForm.dayNumber} onChange={(event) => setDayForm({ ...dayForm, dayNumber: event.target.value })} /></Field>
                <Field label="Title"><input required className={modalInputClass} value={dayForm.title} onChange={(event) => setDayForm({ ...dayForm, title: event.target.value })} /></Field>
              </div>
              <Field label="Notes"><textarea className="min-h-20 w-full resize-y rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] px-3 py-2 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white" value={dayForm.notes} onChange={(event) => setDayForm({ ...dayForm, notes: event.target.value })} placeholder="Optional notes" /></Field>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button type="submit" disabled={savingDay || editDayInvalid} className={modalPrimaryButtonClass}>{savingDay ? "Updating..." : "Update Day"}</button>
                <button type="button" onClick={cancelEditDay} disabled={savingDay} className={modalButtonClass}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3" onMouseDown={(event) => event.target === event.currentTarget && cancelEditExercise()}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-exercise-title" className="w-full max-w-sm rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.18)] sm:p-5" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Dumbbell size={15} /></div>
                <div className="min-w-0">
                  <h2 id="edit-exercise-title" className="truncate text-base font-bold text-[#0F172A]">{nameOf(editingExercise.exercise || editingExercise.workoutExercise?.exercise || editingExercise)}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[#64748B]">Name of the Day: <span className="rounded bg-[#EAFBF3] px-1.5 py-0.5 font-semibold text-[#0D8252]">{editingExerciseDay?.title || "Exercises"}</span></p>
                </div>
              </div>
              <button type="button" onClick={cancelEditExercise} className="shrink-0 rounded p-1 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#334155]" aria-label="Close edit exercise modal"><X size={14} /></button>
            </div>
            <form onSubmit={handleSaveExercise} className="rounded-lg border border-[#E2E8F0] p-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                <Field label="Sets"><input autoFocus className={modalInputClass} type="number" min="0" value={editingConfig.sets} onChange={(event) => setEditingConfig({ ...editingConfig, sets: event.target.value })} /></Field>
                <Field label="Reps"><input className={modalInputClass} type="number" min="0" value={editingConfig.reps} onChange={(event) => setEditingConfig({ ...editingConfig, reps: event.target.value })} /></Field>
                <Field label="Duration"><input className={modalInputClass} type="number" min="0" value={editingConfig.duration} onChange={(event) => setEditingConfig({ ...editingConfig, duration: event.target.value })} /></Field>
                <Field label="Rest"><input className={modalInputClass} type="number" min="0" value={editingConfig.restTime} onChange={(event) => setEditingConfig({ ...editingConfig, restTime: event.target.value })} /></Field>
              </div>
            </form>
            <div className="mt-3 flex justify-end flex-wrap items-center gap-2">
                <button type="button" onClick={cancelEditExercise} className={modalButtonClass}>Cancel</button>
                <button type="submit" className={modalPrimaryButtonClass}>Save</button>
              </div>
          </div>
        </div>
      )}

      {showAddExerciseModal && role !== "member" && (
        <AddExerciseModal
          isOpen
          day={days.find((day) => idOf(day) === selectedDayId)}
          exercises={exercises || []}
          user={user}
          onClose={() => setShowAddExerciseModal(false)}
          onLinked={refreshSelectedPlan}
        />
      )}
    </section>
  );
}
