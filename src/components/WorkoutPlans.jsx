import { Fragment, useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Copy, Download, Dumbbell, Pencil, Plus, Search, Trash, X } from "lucide-react";
import toast from "react-hot-toast";
import { createWorkoutPlan, updateWorkoutPlan, deleteWorkoutPlan, cloneWorkoutPlan, createWorkoutDay, assignWorkoutToMember, assignExerciseToWorkoutDay, updateWorkoutDayExercise, removeWorkoutDayExercise, getApiError, getWorkoutDays } from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function metricValue(value) { return value === null || value === undefined || value === "" ? "-" : String(value); }
function emptyPlan() { return { name: "", description: "", goal: "STRENGTH", difficulty: "BEGINNER", duration: "", image: "" }; }

const goals = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_BURN"];
const difficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";
const adminPlanGridClass = "lg:grid-cols-[2rem_minmax(12rem,1fr)_9rem_9rem_6rem_5rem]";

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={`grid gap-1 text-xs font-semibold uppercase text-gray-500 ${className}`}>{label}{children}</label>;
}

function countOf(value) {
  return Array.isArray(value) ? value.length : Number(value || 0) || 0;
}

function assignmentPlanName(assignment, fallback = "Workout plan") {
  return assignment?.name || assignment?.title || fallback;
}

function assignmentStartDate(assignment) {
  return assignment?.startDate || assignment?.start_date || "";
}

function assignmentEndDate(assignment) {
  return assignment?.endDate || assignment?.end_date || "";
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
  return candidates.find(Array.isArray) || [];
}

function normalizePlanDays(plan) {
  if (!plan) return [];
  const candidates = [
    plan?.days,
    plan?.workoutDays,
    plan?.data?.days,
    plan?.data?.workoutDays,
  ];
  return candidates.find(Array.isArray) || [];
}

function planExerciseCount(plan) {
  const explicitCount = Number(plan?.totalExercises || plan?.exerciseCount || 0);
  if (explicitCount) return explicitCount;

  const days = normalizePlanDays(plan);
  return days.reduce((total, day) => total + normalizeDayExerciseLinks(day).length, 0);
}

function trainerAssignmentName(assignment) {
  return assignment?.trainer?.name || assignment?.trainer?.fullName || assignment?.user?.name || assignment?.user?.fullName || assignment?.trainerDetails?.name || assignment?.trainerDetails?.fullName || assignment?.trainerName || assignment?.userName || nameOf(assignment?.trainer || assignment?.user || assignment?.trainerDetails || assignment?.userDetails || assignment);
}

export default function WorkoutPlans(props) {
  const { user, role, canManage, canEdit, canDelete, canAssign, canManageAssignments, plans, setPlans, loading, planSearch, setPlanSearch, goalFilter, setGoalFilter, difficultyFilter, setDifficultyFilter, selectedPlanId, setSelectedPlanId, expandedPlanId, setExpandedPlanId, editingPlanId, setEditingPlanId, planForm, setPlanForm, filteredPlans, assignedMemberCount, memberWorkoutDaysCount, memberWorkoutExercisesCount, loadPlans, refreshSelectedPlan, selectedPlan, planTrainers, members, exercises = [], setActiveTab, showCreatePlanModal = false, setShowCreatePlanModal = () => {} } = props;

  const [showAddDayModal, setShowAddDayModal] = useState(false);
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showDayExerciseDetailsModal, setShowDayExerciseDetailsModal] = useState(false);
  const [selectedDayForExercise, setSelectedDayForExercise] = useState(null);
  const [selectedDayForDetails, setSelectedDayForDetails] = useState(null);
  const [editingExerciseLinkId, setEditingExerciseLinkId] = useState("");
  const [editingExerciseForm, setEditingExerciseForm] = useState({ sets: "", reps: "", duration: "", restTime: "" });
  const [dayForm, setDayForm] = useState({ title: "", dayNumber: "", notes: "" });
  const [assignmentForm, setAssignmentForm] = useState({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" });
  const [exerciseForm, setExerciseForm] = useState({ exerciseId: "", sets: "", reps: "", duration: "", restTime: "", orderIndex: "" });

  const handleSavePlan = async (event) => {
    event.preventDefault();
    if (!canManage || !planForm.name.trim()) {
      toast.error("Workout plan name is required");
      return;
    }

    const payload = {
      ...planForm,
      duration: planForm.duration ? Number(planForm.duration) : undefined,
    };

    try {
      if (editingPlanId) {
        await updateWorkoutPlan(editingPlanId, payload, user?.token);
        toast.success("Workout plan updated");
      } else {
        await createWorkoutPlan(payload, user?.token);
        toast.success("Workout plan created");
      }
      setPlanForm(emptyPlan());
      setEditingPlanId("");
      setShowCreatePlanModal(false);
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save workout plan"));
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm("Are you sure you want to delete this workout plan?")) return;
    try {
      await deleteWorkoutPlan(planId, user?.token);
      toast.success("Workout plan deleted");
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete plan"));
    }
  };

  const handleClonePlan = async (planId) => {
    try {
      await cloneWorkoutPlan(planId, {}, user?.token);
      toast.success("Workout plan cloned");
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to clone plan"));
    }
  };

  const handleExportCSV = () => {
    const headers = ["Workout", "Goal", "Difficulty", "Duration", "Days", "Description", "Trainers"];
    const rows = filteredPlans.map((plan) => {
      const totalDays = countOf(plan.days || plan.workoutDays || plan.totalDays);
      const trainers = (plan.trainers || plan.trainerAssignments || []).map(trainerAssignmentName).join("; ");
      return [
        plan.name || plan.title || assignmentPlanName(plan, "Workout plan"),
        titleCase(metricValue(plan.goal)),
        titleCase(metricValue(plan.difficulty)),
        metricValue(plan.duration),
        totalDays,
        (plan.description || "").slice(0, 100),
        trainers,
      ];
    });

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workout-plans-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const editPlan = (plan) => {
    setEditingPlanId(idOf(plan));
    setPlanForm({
      name: plan.name || plan.title || "",
      goal: plan.goal || goals[0],
      difficulty: plan.difficulty || difficulties[0],
      description: plan.description || "",
      duration: plan.duration || "",
      image: plan.image || "",
    });
    setShowCreatePlanModal(true);
  };

  const handleCreateDay = async (event) => {
    event.preventDefault();
    if (!selectedPlanId || !dayForm.title.trim() || !dayForm.dayNumber) {
      toast.error("Day title and day number are required");
      return;
    }
    try {
      await createWorkoutDay(selectedPlanId, { ...dayForm, dayNumber: Number(dayForm.dayNumber) }, user?.token);
      toast.success("Workout day created");
      setShowAddDayModal(false);
      setDayForm({ title: "", dayNumber: "", notes: "" });
      await refreshSelectedPlan();
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to create workout day"));
    }
  };

  const handleAssignMember = async (event) => {
    event.preventDefault();
    if (!selectedPlanId || !assignmentForm.memberId) {
      toast.error("Select a member to assign this workout plan");
      return;
    }
    try {
      const payload = { userId: assignmentForm.memberId };
      if (assignmentForm.startDate) payload.startDate = assignmentForm.startDate;
      if (assignmentForm.endDate) payload.endDate = assignmentForm.endDate;
      if (assignmentForm.repeatType && assignmentForm.repeatType !== "NONE") {
        payload.repeatType = assignmentForm.repeatType;
        if (assignmentForm.repeatEndDate) payload.repeatEndDate = assignmentForm.repeatEndDate;
        if (assignmentForm.repeatType === "CUSTOM" && assignmentForm.repeatDays.length) {
          const dayMap = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 };
          payload.repeatDays = assignmentForm.repeatDays.map((day) => dayMap[day] || day);
        }
      }
      await assignWorkoutToMember(selectedPlanId, payload, user?.token);
      toast.success("Workout assigned to member");
      setShowAssignMemberModal(false);
      setAssignmentForm({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" });
      await refreshSelectedPlan();
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign workout"));
    }
  };

  const handleLinkExercise = async (event) => {
    event.preventDefault();
    if (!selectedDayForExercise || !exerciseForm.exerciseId) {
      toast.error("Select an exercise to link to the workout day");
      return;
    }
    try {
      const payload = { exerciseId: exerciseForm.exerciseId };
      if (exerciseForm.sets !== "") payload.sets = Number(exerciseForm.sets);
      if (exerciseForm.reps !== "") payload.reps = Number(exerciseForm.reps);
      if (exerciseForm.duration !== "") payload.duration = Number(exerciseForm.duration);
      if (exerciseForm.restTime !== "") payload.restTime = Number(exerciseForm.restTime);
      if (exerciseForm.orderIndex !== "") payload.orderIndex = Number(exerciseForm.orderIndex);
      await assignExerciseToWorkoutDay(idOf(selectedDayForExercise), payload, user?.token);
      toast.success("Exercise linked to workout day");
      setShowExerciseModal(false);
      setSelectedDayForExercise(null);
      setExerciseForm({ exerciseId: "", sets: "", reps: "", duration: "", restTime: "", orderIndex: "" });
      await refreshSelectedPlan();
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to link exercise"));
    }
  };

  const startEditExerciseLink = (link) => {
    const linkId = idOf(link);
    setEditingExerciseLinkId(linkId);
    setEditingExerciseForm({
      sets: link?.sets ?? "",
      reps: link?.reps ?? "",
      duration: link?.duration ?? "",
      restTime: link?.restTime ?? "",
    });
  };

  const handleSaveExerciseLink = async (event) => {
    event.preventDefault();
    if (!editingExerciseLinkId) return;
    try {
      const payload = {};
      if (editingExerciseForm.sets !== "") payload.sets = Number(editingExerciseForm.sets);
      if (editingExerciseForm.reps !== "") payload.reps = Number(editingExerciseForm.reps);
      if (editingExerciseForm.duration !== "") payload.duration = Number(editingExerciseForm.duration);
      if (editingExerciseForm.restTime !== "") payload.restTime = Number(editingExerciseForm.restTime);
      await updateWorkoutDayExercise(editingExerciseLinkId, payload, user?.token);
      toast.success("Workout exercise updated");
      setEditingExerciseLinkId("");
      setEditingExerciseForm({ sets: "", reps: "", duration: "", restTime: "" });
      await refreshSelectedPlan();
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update workout exercise"));
    }
  };

  const handleDeleteExerciseLink = async (link) => {
    const linkId = idOf(link);
    if (!linkId || !window.confirm("Remove this linked exercise from the workout day?")) return;
    try {
      await removeWorkoutDayExercise(linkId, user?.token);
      toast.success("Workout exercise removed");
      setEditingExerciseLinkId("");
      setEditingExerciseForm({ sets: "", reps: "", duration: "", restTime: "" });
      await refreshSelectedPlan();
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to remove workout exercise"));
    }
  };

  const [hydratedPlanDays, setHydratedPlanDays] = useState([]);

  useEffect(() => {
    const planId = selectedPlanId || idOf(selectedPlan);
    if (!planId || !user?.token) {
      setHydratedPlanDays([]);
      return undefined;
    }

    let active = true;
    (async () => {
      try {
        const response = await getWorkoutDays(planId, user.token);
        const payload = response?.data || response;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.days)
              ? payload.days
              : Array.isArray(payload?.workoutDays)
                ? payload.workoutDays
                : [];

        if (active) setHydratedPlanDays(list);
      } catch {
        if (active) setHydratedPlanDays([]);
      }
    })();

    return () => { active = false; };
  }, [selectedPlanId, selectedPlan?.id, selectedPlan?._id, user?.token]);

  const openDayExerciseDetails = async (day) => {
    const planId = selectedPlanId || idOf(selectedPlan);
    setSelectedDayForDetails(day);
    if (!planId) {
      setShowDayExerciseDetailsModal(true);
      return;
    }

    try {
      const response = await getWorkoutDays(planId, user?.token);
      const apiDays = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : Array.isArray(response?.days)
              ? response.days
              : Array.isArray(response?.workoutDays)
                ? response.workoutDays
                : [];

      const matchedDay = apiDays.find((item) => idOf(item) === idOf(day))
        || apiDays.find((item) => String(item.dayNumber) === String(day?.dayNumber) && item.title === day?.title)
        || apiDays.find((item) => item.title === day?.title)
        || day;

      const matchedExerciseLinks = normalizeDayExerciseLinks(matchedDay);
      const hydratedDay = {
        ...day,
        ...matchedDay,
        exercises: matchedExerciseLinks.length ? matchedExerciseLinks : normalizeDayExerciseLinks(day),
      };

      setSelectedDayForDetails(hydratedDay);
      setShowDayExerciseDetailsModal(true);
    } catch (error) {
      toast.error(getApiError(error, "Unable to load workout day exercises"));
      setShowDayExerciseDetailsModal(true);
    }
  };

  const planDaysForSelected = selectedPlan ? (hydratedPlanDays.length ? hydratedPlanDays : (selectedPlan.days || selectedPlan.workoutDays || [])) : [];
  const selectedPlanExerciseCount = selectedPlan ? planExerciseCount({ ...selectedPlan, days: planDaysForSelected, workoutDays: planDaysForSelected }) : 0;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(620px,1fr)_minmax(330px,420px)]">
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
          <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3">
            <Search size={17} className="text-gray-400" />
            <input className="h-10 min-w-0 flex-1 text-sm outline-none" value={planSearch} onChange={(event) => setPlanSearch(event.target.value)} placeholder="Search workout plans..." />
          </div>
          <select className={inputClass} value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)}>
            <option value="">All Goals</option>
            {goals.map((goal) => <option key={goal} value={goal}>{titleCase(goal)}</option>)}
          </select>
          <select className={inputClass} value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
            <option value="">All Levels</option>
            {difficulties.map((level) => <option key={level} value={level}>{titleCase(level)}</option>)}
          </select>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          <div className={`hidden gap-3 bg-gray-100 px-0 py-3 text-xs font-semibold uppercase text-gray-500 lg:grid ${adminPlanGridClass} lg:items-center`}>
            <span aria-hidden="true"></span>
            <span>Workout</span>
           
          </div>
          {filteredPlans.map((plan) => {
            const planId = idOf(plan);
            const totalDays = countOf(plan.days || plan.workoutDays || plan.totalDays);
            const isExpanded = expandedPlanId === planId;
            return (
              <div key={planId} className={selectedPlanId === planId ? "bg-blue-50/40" : "bg-white"}>
                <div className={`grid gap-3 px-0 py-3 ${adminPlanGridClass} lg:items-center`}>
                  <button
                    type="button"
                    onClick={() => { setSelectedPlanId(planId); setExpandedPlanId(isExpanded ? "" : planId); }}
                    className={iconButtonClass}
                    aria-label={isExpanded ? "Collapse workout plan" : "Expand workout plan"}
                  >
                    <Plus size={17} className={`transition ${isExpanded ? "rotate-45" : ""}`} />
                  </button>
                  <button type="button" onClick={() => setSelectedPlanId(planId)} className="min-w-0 text-left">
                    <h3 className="truncate font-semibold text-gray-950">{plan.name || plan.title || assignmentPlanName(plan, "Workout plan")}</h3>
                  </button>
             
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="flex justify-between gap-5 lg:pe-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">Description</p>
                          <p className="mt-1 text-sm leading-6 text-gray-600">{plan.description || "No description added."}</p>
                        </div>
                        {/* <div className="mt-0">
                          <p className="text-xs font-semibold uppercase text-gray-500">Assigned Dates</p>
                          <p className="mt-2 text-sm text-gray-500">
                            {assignmentStartDate(plan) || assignmentEndDate(plan)
                              ? `${displayDate(assignmentStartDate(plan))} - ${displayDate(assignmentEndDate(plan))}`
                              : "No assignment window"}
                          </p>
                        </div> */}
                        {role === "member" && (
                          <div className="mt-0">
                            <p className="text-xs font-semibold uppercase text-gray-500">Trainer</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(plan.trainers || plan.trainerAssignments || []).length ? (
                                (plan.trainers || plan.trainerAssignments || []).map((trainer) => (
                                  <span key={idOf(trainer)} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{trainerAssignmentName(trainer)}</span>
                                ))
                              ) : (
                                <p className="text-sm text-gray-500">No trainer assigned</p>
                              )}
                            </div>
                          </div>
                        )}
                        {/* {role !== "member" && (
                          <div className="mt-0">
                            <p className="text-xs font-semibold uppercase text-gray-500">Trainers</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(plan.trainers || plan.trainerAssignments || []).length ? (
                                (plan.trainers || plan.trainerAssignments || []).map((t) => (
                                  <span key={idOf(t)} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{trainerAssignmentName(t)}</span>
                                ))
                              ) : (
                                <p className="text-sm text-gray-500">No trainers assigned</p>
                              )}
                            </div>
                          </div>
                        )} */}
                      </div>
                      {role === "member" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlanId(planId);
                            setActiveTab("days");
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          View Workout
                        </button>
                      )}
                      {canManage && (
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlanId(planId);
                              setActiveTab("days");
                            }}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                          >
                            Add Days
                          </button>
                          {canEdit && (
                            <button type="button" onClick={() => editPlan(plan)} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                              <Pencil size={14} />
                              Edit
                            </button>
                          )}
                          {canManage && (
                            <button type="button" onClick={() => handleClonePlan(planId)} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                              <Copy size={14} />
                              Clone
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" onClick={() => handleDeletePlan(planId)} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 transition hover:bg-red-50">
                              <Trash size={14} />
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!filteredPlans.length && (
            <div className="p-8 text-center text-sm text-gray-500">
              {loading ? "Loading workout plans..." : "No workout plans yet. Create your first plan to get started."}
            </div>
          )}
        </div>
      </Card>

      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Workout Planning</p>
                <h3 className="mt-1 text-xl font-bold text-gray-950">{editingPlanId ? "Edit Workout" : "Create Workout"}</h3>
              </div>
              <button type="button" onClick={() => { setShowCreatePlanModal(false); setEditingPlanId(""); setPlanForm(emptyPlan()); }} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSavePlan} className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Workout Name" className="md:col-span-2">
                <input className={inputClass} value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} placeholder="Strength Builder" />
              </Field>
              <Field label="Goal">
                <select className={inputClass} value={planForm.goal} onChange={(event) => setPlanForm({ ...planForm, goal: event.target.value })}>
                  {goals.map((goal) => <option key={goal} value={goal}>{titleCase(goal)}</option>)}
                </select>
              </Field>
              <Field label="Level">
                <select className={inputClass} value={planForm.difficulty} onChange={(event) => setPlanForm({ ...planForm, difficulty: event.target.value })}>
                  {difficulties.map((level) => <option key={level} value={level}>{titleCase(level)}</option>)}
                </select>
              </Field>
              <Field label="Duration">
                <input className={inputClass} type="number" min="1" value={planForm.duration} onChange={(event) => setPlanForm({ ...planForm, duration: event.target.value })} placeholder="30" />
              </Field>
              <Field label="Image URL">
                <input className={inputClass} type="url" value={planForm.image} onChange={(event) => setPlanForm({ ...planForm, image: event.target.value })} placeholder="https://example.com/image.jpg" />
              </Field>
              <Field label="Description" className="md:col-span-2">
                <textarea className="min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} placeholder="Plan focus" />
              </Field>
              <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => { setShowCreatePlanModal(false); setEditingPlanId(""); setPlanForm(emptyPlan()); }} className={buttonClass}>Cancel</button>
                <button type="submit" className={primaryButtonClass} disabled={!canManage}> {editingPlanId ? "Update Plan" : "Create Plan"} </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPlan && (
        <Card className="overflow-hidden">
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Workout Plan</p>
                <h3 className="mt-2 text-xl font-bold text-gray-950">{selectedPlan.name || selectedPlan.title || "Workout Plan"}</h3>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{titleCase(metricValue(selectedPlan.difficulty))}</span>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-semibold uppercase text-gray-500">Goal</p>
                <p className="mt-1 text-sm font-semibold text-gray-950">{titleCase(metricValue(selectedPlan.goal))}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-semibold uppercase text-gray-500">Duration</p>
                <p className="mt-1 text-sm font-semibold text-gray-950">{metricValue(selectedPlan.duration)}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h4 className="font-semibold text-gray-950">Plan Details</h4>
                <button type="button" onClick={() => setActiveTab("days")} className="text-xs font-semibold text-blue-600">View All Days</button>
              </div>
              <div className="divide-y divide-gray-100 px-4 py-2">
                <div className="flex items-center justify-between py-3">
                  <span className="text-xs font-semibold uppercase text-gray-500">Exercises</span>
                  <span className="text-sm font-bold text-gray-950">{selectedPlanExerciseCount}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-xs font-semibold uppercase text-gray-500">Difficulty</span>
                  <span className="text-sm font-bold text-gray-950">{titleCase(metricValue(selectedPlan.difficulty))}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-xs font-semibold uppercase text-gray-500">Schedule</span>
                  <span className="text-sm font-bold text-gray-950">{countOf(planDaysForSelected)} days</span>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h4 className="font-semibold text-gray-950">Workout Days</h4>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setDayForm({ title: "", dayNumber: String(planDaysForSelected.length + 1), notes: "" }); setShowAddDayModal(true); }} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                    <Plus size={14} /> Add Day
                  </button>
                  <button type="button" onClick={() => setActiveTab("days")} className="text-xs font-semibold text-blue-600">View All</button>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {planDaysForSelected.map((day, idx) => (
                  <div key={idOf(day)} className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-blue-50">
                    <div className="min-w-0 cursor-pointer" onClick={() => openDayExerciseDetails(day)}>
                      <span className="text-sm font-semibold text-gray-950">Day {idx + 1} - {day.title || "Workout Day"}</span>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                        <span>{normalizeDayExerciseLinks(day).length} exercises</span>
                        <span className="text-gray-300">•</span>
                        <span>{day.notes || "No notes"}</span>
                      </div>
                    </div>
                    <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedDayForExercise(day); setShowExerciseModal(true); }} className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 px-3 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700">
                      <Plus size={14} className="mr-1" /> Add Exercise
                    </button>
                  </div>
                ))}
                {!planDaysForSelected.length && (
                  <p className="px-4 py-4 text-sm text-gray-500">No workout days yet.</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowAssignMemberModal(true)} className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">Assign Members</button>
              {/* <button type="button" onClick={handleClonePlan.bind(null, idOf(selectedPlan))} className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50">Clone Plan</button> */}
            </div>
          </div>
        </Card>
      )}

      {showAddDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Workout Day</p>
                <h3 className="mt-1 text-xl font-bold text-gray-950">Add Workout Day</h3>
              </div>
              <button type="button" onClick={() => { setShowAddDayModal(false); setDayForm({ title: "", dayNumber: "", notes: "" }); }} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDay} className="grid gap-4 p-5">
              <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                Day Title
                <input className={inputClass} value={dayForm.title} onChange={(event) => setDayForm({ ...dayForm, title: event.target.value })} placeholder="Upper Body" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                Day Number
                <input className={inputClass} type="number" min="1" value={dayForm.dayNumber} onChange={(event) => setDayForm({ ...dayForm, dayNumber: event.target.value })} placeholder="1" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                Notes
                <textarea className="min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={dayForm.notes} onChange={(event) => setDayForm({ ...dayForm, notes: event.target.value })} placeholder="Day focus or notes" />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => { setShowAddDayModal(false); setDayForm({ title: "", dayNumber: "", notes: "" }); }} className={buttonClass}>Cancel</button>
                <button type="submit" className={primaryButtonClass}>Create Day</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDayExerciseDetailsModal && selectedDayForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Workout Day</p>
                <h3 className="mt-1 text-xl font-bold text-gray-950">{selectedDayForDetails.title || "Workout Day"}</h3>
              </div>
              <button type="button" onClick={() => { setShowDayExerciseDetailsModal(false); setSelectedDayForDetails(null); }} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="grid gap-2 text-xs font-semibold uppercase text-gray-500 sm:grid-cols-2">
                  <span>Day Number: {selectedDayForDetails.dayNumber || "-"}</span>
                  <span>Goal: {titleCase(metricValue(selectedDayForDetails.goal || selectedPlan?.goal))}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{selectedDayForDetails.notes || "No notes"}</p>
              </div>
              <div className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
                {normalizeDayExerciseLinks(selectedDayForDetails).length === 0 && (
                  <p className="p-4 text-sm text-gray-500">No linked exercises yet.</p>
                )}
                {normalizeDayExerciseLinks(selectedDayForDetails).map((link, index) => {
                  const exercise = link?.exercise || link?.workoutExercise?.exercise || link?.workoutExercise || link?.exerciseDetails || link;
                  const exName = nameOf(exercise);
                  const sets = link?.sets ?? link?.workoutExercise?.sets ?? exercise?.sets ?? "";
                  const reps = link?.reps ?? link?.workoutExercise?.reps ?? exercise?.reps ?? "";
                  const duration = link?.duration ?? link?.workoutExercise?.duration ?? exercise?.duration ?? "";
                  const rest = link?.restTime ?? link?.workoutExercise?.restTime ?? exercise?.restTime ?? "";
                  const editing = editingExerciseLinkId === idOf(link);
                  return (
                    <div key={idOf(link) || `${idOf(selectedDayForDetails)}-${index}`} className="px-4 py-3">
                      {editing ? (
                        <form onSubmit={handleSaveExerciseLink} className="grid gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="grid gap-1 text-[11px] font-semibold uppercase text-gray-500">
                              Sets
                              <input className={inputClass} type="number" min="0" value={editingExerciseForm.sets} onChange={(event) => setEditingExerciseForm({ ...editingExerciseForm, sets: event.target.value })} />
                            </label>
                            <label className="grid gap-1 text-[11px] font-semibold uppercase text-gray-500">
                              Reps
                              <input className={inputClass} type="number" min="0" value={editingExerciseForm.reps} onChange={(event) => setEditingExerciseForm({ ...editingExerciseForm, reps: event.target.value })} />
                            </label>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="grid gap-1 text-[11px] font-semibold uppercase text-gray-500">
                              Duration
                              <input className={inputClass} type="number" min="0" value={editingExerciseForm.duration} onChange={(event) => setEditingExerciseForm({ ...editingExerciseForm, duration: event.target.value })} />
                            </label>
                            <label className="grid gap-1 text-[11px] font-semibold uppercase text-gray-500">
                              Rest Time
                              <input className={inputClass} type="number" min="0" value={editingExerciseForm.restTime} onChange={(event) => setEditingExerciseForm({ ...editingExerciseForm, restTime: event.target.value })} />
                            </label>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button type="button" onClick={() => { setEditingExerciseLinkId(""); setEditingExerciseForm({ sets: "", reps: "", duration: "", restTime: "" }); }} className={buttonClass}>Cancel</button>
                            <button type="submit" className={primaryButtonClass}>Save</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-950">{exName}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                              {sets !== "" && sets !== null && <span>{sets} sets</span>}
                              {reps !== "" && reps !== null && <span>{reps} reps</span>}
                              {duration !== "" && duration !== null && <span>{duration}s</span>}
                              {rest !== "" && rest !== null && <span>rest {rest}s</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => startEditExerciseLink(link)} className={iconButtonClass} aria-label="Edit exercise link">
                              <Pencil size={14} />
                            </button>
                            <button type="button" onClick={() => handleDeleteExerciseLink(link)} className={iconButtonClass} aria-label="Delete exercise link">
                              <Trash size={14} />
                            </button>
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">#{index + 1}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showExerciseModal && selectedDayForExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Workout Day</p>
                <h3 className="mt-1 text-xl font-bold text-gray-950">Add Exercise</h3>
              </div>
              <button type="button" onClick={() => { setShowExerciseModal(false); setSelectedDayForExercise(null); setExerciseForm({ exerciseId: "", sets: "", reps: "", duration: "", restTime: "", orderIndex: "" }); }} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleLinkExercise} className="grid gap-4 p-5">
              <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                Exercise
                <select className={inputClass} value={exerciseForm.exerciseId} onChange={(event) => setExerciseForm({ ...exerciseForm, exerciseId: event.target.value })}>
                  <option value="">Select an exercise</option>
                  {(exercises || []).map((exercise) => (
                    <option key={idOf(exercise)} value={idOf(exercise)}>{exercise.name || exercise.title || exercise.exerciseName || "Exercise"}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Sets
                  <input className={inputClass} type="number" min="0" value={exerciseForm.sets} onChange={(event) => setExerciseForm({ ...exerciseForm, sets: event.target.value })} placeholder="3" />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Reps
                  <input className={inputClass} type="number" min="0" value={exerciseForm.reps} onChange={(event) => setExerciseForm({ ...exerciseForm, reps: event.target.value })} placeholder="12" />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Duration
                  <input className={inputClass} type="number" min="0" value={exerciseForm.duration} onChange={(event) => setExerciseForm({ ...exerciseForm, duration: event.target.value })} placeholder="30" />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Rest Time
                  <input className={inputClass} type="number" min="0" value={exerciseForm.restTime} onChange={(event) => setExerciseForm({ ...exerciseForm, restTime: event.target.value })} placeholder="60" />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Order
                  <input className={inputClass} type="number" min="1" value={exerciseForm.orderIndex} onChange={(event) => setExerciseForm({ ...exerciseForm, orderIndex: event.target.value })} placeholder="1" />
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => { setShowExerciseModal(false); setSelectedDayForExercise(null); setExerciseForm({ exerciseId: "", sets: "", reps: "", duration: "", restTime: "", orderIndex: "" }); }} className={buttonClass}>Cancel</button>
                <button type="submit" className={primaryButtonClass}>Link Exercise</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Workout Assignment</p>
                <h3 className="mt-1 text-xl font-bold text-gray-950">Assign Member</h3>
              </div>
              <button type="button" onClick={() => { setShowAssignMemberModal(false); setAssignmentForm({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" }); }} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssignMember} className="grid gap-4 p-5">
              <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                Member
                <select className={inputClass} value={assignmentForm.memberId} onChange={(event) => setAssignmentForm({ ...assignmentForm, memberId: event.target.value })}>
                  <option value="">Select a member</option>
                  {(members || []).map((member) => (
                    <option key={idOf(member)} value={idOf(member)}>{member.name || member.fullName || member.email || "Member"}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Start Date
                  <input className={inputClass} type="date" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, startDate: event.target.value })} />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  End Date
                  <input className={inputClass} type="date" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, endDate: event.target.value })} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Repeat Type
                  <select className={inputClass} value={assignmentForm.repeatType} onChange={(event) => setAssignmentForm({ ...assignmentForm, repeatType: event.target.value })}>
                    <option value="NONE">None</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Repeat End Date
                  <input className={inputClass} type="date" value={assignmentForm.repeatEndDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, repeatEndDate: event.target.value })} />
                </label>
              </div>
              {assignmentForm.repeatType === "CUSTOM" && (
                <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">
                  Repeat Days
                  <select className={inputClass} multiple value={assignmentForm.repeatDays} onChange={(event) => setAssignmentForm({ ...assignmentForm, repeatDays: Array.from(event.target.selectedOptions, (option) => option.value) })}>
                    <option value="MONDAY">Monday</option>
                    <option value="TUESDAY">Tuesday</option>
                    <option value="WEDNESDAY">Wednesday</option>
                    <option value="THURSDAY">Thursday</option>
                    <option value="FRIDAY">Friday</option>
                    <option value="SATURDAY">Saturday</option>
                    <option value="SUNDAY">Sunday</option>
                  </select>
                </label>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => { setShowAssignMemberModal(false); setAssignmentForm({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" }); }} className={buttonClass}>Cancel</button>
                <button type="submit" className={primaryButtonClass}>Assign Workout</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
