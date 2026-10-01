import { Fragment, useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Copy, Download, Dumbbell, Edit, Plus, Search, Trash, X } from "lucide-react";
import toast from "react-hot-toast";
import { deleteWorkoutPlan, cloneWorkoutPlan, createWorkoutDay, assignWorkoutToMember, assignExerciseToWorkoutDay, updateWorkoutDayExercise, removeWorkoutDayExercise, getApiError, getWorkoutDays } from "../services/api";
import TablePagination from "./TablePagination";
import { generateWorkoutSchedule, normalizeRepeatDays, validateWorkoutAssignment } from "../utils/workoutScheduling";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function metricValue(value) { return value === null || value === undefined || value === "" ? "-" : String(value); }
function emptyDay() { return { title: "", dayNumber: "", notes: "" }; }

const goals = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_BURN"];
const difficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const PLAN_PAGE_SIZE = 10;

const inputClass = "h-8 w-full rounded-lg border border-[#E2E8F0]/20 bg-[#FBFCFD]/20 px-3 text-xs text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252]/30 focus:bg-white disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
const buttonClass = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";
const adminPlanGridClass = "lg:grid-cols-[minmax(16rem,1.6fr)_minmax(10rem,1fr)_8rem_7rem_minmax(14rem,auto)]";

function Card({ children, className = "" }) {
  return <section className={`rounded-xl border border-[#E5EAF0] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] ${className}`}>{children}</section>;
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
  const candidates = [plan?.days, plan?.workoutDays, plan?.data?.days, plan?.data?.workoutDays];
  return candidates.find(Array.isArray) || [];
}

function planExerciseCount(plan) {
  const explicitCount = Number(plan?.totalExercises || plan?.exerciseCount || 0);
  if (explicitCount) return explicitCount;
  return normalizePlanDays(plan).reduce((total, day) => total + normalizeDayExerciseLinks(day).length, 0);
}

function trainerAssignmentName(assignment) {
  return assignment?.trainer?.name || assignment?.trainer?.fullName || assignment?.user?.name || assignment?.user?.fullName || assignment?.trainerDetails?.name || assignment?.trainerDetails?.fullName || assignment?.trainerName || assignment?.userName || nameOf(assignment?.trainer || assignment?.user || assignment?.trainerDetails || assignment?.userDetails || assignment);
}

export default function WorkoutPlans(props) {
  const { user, role, canManage, canEdit, canDelete, canAssign, canManageAssignments, plans, setPlans, loading, planSearch, setPlanSearch, goalFilter, setGoalFilter, difficultyFilter, setDifficultyFilter, selectedPlanId, setSelectedPlanId, expandedPlanId, setExpandedPlanId, editingPlanId, setEditingPlanId, planForm, setPlanForm, filteredPlans, assignedMemberCount, memberWorkoutDaysCount, memberWorkoutExercisesCount, loadPlans, refreshSelectedPlan, selectedPlan, planTrainers, members, exercises = [], setActiveTab, setShowCreatePlanModal = () => {} } = props;

  const [showAddDayModal, setShowAddDayModal] = useState(false);
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showDayExerciseDetailsModal, setShowDayExerciseDetailsModal] = useState(false);
  const [addDayPlanDayCount, setAddDayPlanDayCount] = useState(0);
  const [savingDay, setSavingDay] = useState(false);
  const [planPage, setPlanPage] = useState(1);
  const [selectedDayForExercise, setSelectedDayForExercise] = useState(null);
  const [selectedDayForDetails, setSelectedDayForDetails] = useState(null);
  const [editingExerciseLinkId, setEditingExerciseLinkId] = useState("");
  const [editingExerciseForm, setEditingExerciseForm] = useState({ sets: "", reps: "", duration: "", restTime: "" });
  const [dayForm, setDayForm] = useState(emptyDay());
  const [assignmentForm, setAssignmentForm] = useState({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" });
  const [exerciseForm, setExerciseForm] = useState({ exerciseId: "", sets: "", reps: "", duration: "", restTime: "", orderIndex: "" });

  const closeAddDayModal = () => {
    setShowAddDayModal(false);
    setAddDayPlanDayCount(0);
    setDayForm(emptyDay());
  };

  const openAddDayModal = (planId, dayCount) => {
    setSelectedPlanId(planId);
    setAddDayPlanDayCount(dayCount);
    setDayForm({ ...emptyDay(), dayNumber: String(dayCount + 1) });
    setShowAddDayModal(true);
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm("Are you sure you want to delete this workout plan?")) return;
    try {
      await deleteWorkoutPlan(planId, user?.token);
      toast.success("Workout plan deleted");
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete workout plan"));
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
    const plan = plans.find((item) => String(idOf(item)) === String(selectedPlanId));
    const currentDays = String(idOf(selectedPlan)) === String(selectedPlanId) && hydratedPlanDays.length
      ? hydratedPlanDays
      : normalizePlanDays(plan);
    if (currentDays.some((day) => Number(day.dayNumber) === dayNumber)) {
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
      const nextDays = [...currentDays.filter((day) => Number(day.dayNumber) !== dayNumber), newDay]
        .sort((first, second) => Number(first.dayNumber) - Number(second.dayNumber));
      setPlans((current) => current.map((item) => {
        if (String(idOf(item)) !== String(selectedPlanId)) return item;
        const itemDays = [...normalizePlanDays(item).filter((day) => Number(day.dayNumber) !== dayNumber), newDay]
          .sort((first, second) => Number(first.dayNumber) - Number(second.dayNumber));
        const hasDayList = Array.isArray(item.days) || Array.isArray(item.workoutDays);
        return {
          ...item,
          ...(hasDayList ? { days: itemDays, workoutDays: itemDays } : {}),
          totalDays: hasDayList ? itemDays.length : countOf(item.totalDays) + 1,
        };
      }));
      if (String(idOf(selectedPlan)) === String(selectedPlanId)) setHydratedPlanDays(nextDays);
      toast.success("Workout day created");
      closeAddDayModal();
      try {
        const refreshedDays = await refreshSelectedPlan();
        if (Array.isArray(refreshedDays) && String(idOf(selectedPlan)) === String(selectedPlanId)) {
          setHydratedPlanDays(refreshedDays);
        }
      } catch (error) {
        toast.error(getApiError(error, "Workout day created, but the list could not be refreshed"));
      }
      try {
        await loadPlans();
      } catch (error) {
        toast.error(getApiError(error, "Workout day created, but workout plans could not be refreshed"));
      }
    } catch (error) {
      toast.error(getApiError(error, "Unable to create workout day"));
    } finally {
      setSavingDay(false);
    }
  };

  const handleAssignMember = async (event) => {
    event.preventDefault();
    if (!selectedPlanId || !assignmentForm.memberId) {
      toast.error("Select a member to assign this workout plan");
      return;
    }
    const validation = validateWorkoutAssignment(assignmentForm);
    if (validation.errors.length) {
      toast.error(validation.errors[0]);
      return;
    }
    try {
      const payload = { userId: assignmentForm.memberId };
      if (assignmentForm.startDate) payload.startDate = assignmentForm.startDate;
      if (assignmentForm.endDate) payload.endDate = assignmentForm.endDate;
      if (assignmentForm.repeatType && assignmentForm.repeatType !== "NONE") {
        payload.repeatType = assignmentForm.repeatType;
        if (assignmentForm.repeatEndDate) payload.repeatEndDate = assignmentForm.repeatEndDate;
        payload.repeatDays = normalizeRepeatDays(assignmentForm.repeatDays);
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

  useEffect(() => {
    if (!showAddDayModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showAddDayModal]);

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
  const assignmentSchedulePreview = selectedPlan
    ? generateWorkoutSchedule({
        workoutDays: planDaysForSelected,
        startDate: assignmentForm.startDate,
        endDate: assignmentForm.endDate,
        repeatEndDate: assignmentForm.repeatEndDate,
        repeatType: assignmentForm.repeatType,
        repeatDays: assignmentForm.repeatDays,
      })
    : null;
  const selectedPlanExerciseCount = selectedPlan ? planExerciseCount({ ...selectedPlan, days: planDaysForSelected, workoutDays: planDaysForSelected }) : 0;
  const planTotalPages = Math.max(1, Math.ceil(filteredPlans.length / PLAN_PAGE_SIZE));
  const currentPlanPage = Math.min(planPage, planTotalPages);
  const planPageStart = (currentPlanPage - 1) * PLAN_PAGE_SIZE;
  const paginatedPlans = filteredPlans.slice(planPageStart, planPageStart + PLAN_PAGE_SIZE);

  return (
    <section className="grid gap-4">
      <Card className="overflow-hidden">
        <div className="grid gap-2.5 border-b border-[#EEF2F4] p-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <div className="flex h-8 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] px-2.5 focus-within:border-[#0D8252] focus-within:bg-white">
            <Search size={14} className="text-[#94A3B8]" />
            <input className="h-7 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#94A3B8]" value={planSearch} onChange={(event) => { setPlanSearch(event.target.value); setPlanPage(1); }} placeholder="Search workout plans..." />
          </div>
          <label className="flex h-8 w-full items-center gap-2">
            <span className="text-xs font-semibold text-[#475569]">Goal</span>
            <select className={`${inputClass} min-w-0`} value={goalFilter} onChange={(event) => { setGoalFilter(event.target.value); setPlanPage(1); }}>
              <option value="">All</option>
              {goals.map((goal) => <option key={goal} value={goal}>{titleCase(goal)}</option>)}
            </select>
          </label>
          <label className="flex h-8 w-full items-center gap-2">
            <span className="text-xs font-semibold text-[#475569]">Levels</span>
            <select className={`${inputClass} min-w-0`} value={difficultyFilter} onChange={(event) => { setDifficultyFilter(event.target.value); setPlanPage(1); }}>
              <option value="">All</option>
              {difficulties.map((level) => <option key={level} value={level}>{titleCase(level)}</option>)}
            </select>
          </label>
        </div>
        <div className="divide-y divide-gray-100">
          <div className={`hidden gap-3 bg-[#F8FAFC] px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-[#64748B] lg:grid ${adminPlanGridClass} lg:items-center`}>
            <span>Workout Plan</span>
            <span>Trainers</span>
            <span>Goal</span>
            <span>Duration</span>
            <span>Actions</span>
          </div>
          {paginatedPlans.map((plan) => {
            const planId = idOf(plan);
            const totalDays = countOf(plan.days || plan.workoutDays || plan.totalDays);
            const isExpanded = expandedPlanId === planId;
            return (
              <div key={planId} className={selectedPlanId === planId ? "bg-white" : "bg-white"}>
                <div className={`grid gap-3 px-3 py-3 text-xs ${adminPlanGridClass} lg:items-center`}>
                  <button type="button" onClick={() => setSelectedPlanId(planId)} className="rounded-lg min-w-0 text-left">
                    <h3 className="truncate text-xs font-bold text-[#0F172A]">{plan.name || plan.title || assignmentPlanName(plan, "Workout plan")}</h3>
                    <p className="mt-0.5 truncate text-[10px] text-[#94A3B8]">{plan.description || "Workout plan"}</p>
                  </button>
                  <div className="hidden min-w-0 lg:block">
                    {(plan.trainers || plan.trainerAssignments || []).length ? <p className="truncate text-xs text-[#475569]">{(plan.trainers || plan.trainerAssignments || []).map(trainerAssignmentName).join(", ")}</p> : <p className="text-xs text-[#94A3B8]">No trainers assigned</p>}
                  </div>
                  <span className="hidden w-fit rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 lg:inline-flex">{titleCase(metricValue(plan.goal))}</span>
                  <span className="hidden whitespace-nowrap text-xs font-semibold text-[#334155] lg:inline">{metricValue(plan.duration)} mins</span>
                  <div className="hidden shrink-0 items-center justify-left gap-1 whitespace-nowrap lg:flex lg:flex-nowrap">
                    <button type="button" onClick={() => openAddDayModal(planId, totalDays)} className="inline-flex h-8 items-center rounded-lg border border-[#E2E8F0] px-3 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]">Add Days</button>
                    {canEdit && <button type="button" onClick={() => editPlan(plan)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition hover:bg-[#F8FAFC] hover:text-[#0D8252]" aria-label="Edit workout plan"><Edit size={15} /></button>}
                    {canManage && <button type="button" onClick={() => handleClonePlan(planId)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition hover:bg-[#F8FAFC] hover:text-[#0D8252]" aria-label="Clone workout plan"><Copy size={13} /></button>}
                    {canDelete && <button type="button" onClick={() => handleDeletePlan(planId)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-600" aria-label="Delete workout plan"><Trash size={13} /></button>}
                  </div>
                </div>
                {false && isExpanded && (
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
                          className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
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
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                          >
                            Add Days
                          </button>
                          {canEdit && (
                            <button type="button" onClick={() => editPlan(plan)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                              <Edit size={15} />
                              Edit
                            </button>
                          )}
                          {canManage && (
                            <button type="button" onClick={() => handleClonePlan(planId)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                              <Copy size={14} />
                              Clone
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" onClick={() => handleDeletePlan(planId)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 transition hover:bg-red-50">
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
            <div className="p-8 text-center text-xs text-gray-500">
              {loading ? "Loading workout plans..." : "No workout plans yet. Create your first plan to get started."}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <p>Page {currentPlanPage} of {planTotalPages} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {paginatedPlans.length} records</p>
          <TablePagination page={currentPlanPage} totalPages={planTotalPages} onPageChange={setPlanPage} previousLabel="Prev" />
        </div>
      </Card>

      {false && selectedPlan && (
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
                <button type="button" onClick={() => setActiveTab("days")} className="rounded-lg text-xs font-semibold text-blue-600">View All Days</button>
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
                  <button type="button" onClick={() => openAddDayModal(idOf(selectedPlan), planDaysForSelected.length)} className="rounded-lg inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                    <Plus size={14} /> Add Day
                  </button>
                  <button type="button" onClick={() => setActiveTab("days")} className="rounded-lg text-xs font-semibold text-blue-600">View All</button>
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
                    <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedDayForExercise(day); setShowExerciseModal(true); }} className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-3 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700">
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
              <button type="button" onClick={() => setShowAssignMemberModal(true)} className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">Assign Members</button>
              {/* <button type="button" onClick={handleClonePlan.bind(null, idOf(selectedPlan))} className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50">Clone Plan</button> */}
            </div>
          </div>
        </Card>
      )}

      {showAddDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && !savingDay && closeAddDayModal()}>
          <div role="dialog" aria-modal="true" aria-labelledby="add-workout-day-title" className="w-full max-w-md overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Dumbbell size={15} /></div>
                <div>
                  <h3 id="add-workout-day-title" className="text-base font-bold text-[#0F172A]">Add Days</h3>
                  <p className="mt-0.5 text-xs leading-4 text-[#64748B]">{addDayPlanDayCount} day(s) in this plan</p>
                </div>
              </div>
              <button type="button" onClick={closeAddDayModal} disabled={savingDay} className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Close add days modal">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateDay}>
              <div className="grid gap-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Day Number">
                  <input className={inputClass} type="number" min="1" value={dayForm.dayNumber} onChange={(event) => setDayForm({ ...dayForm, dayNumber: event.target.value })} placeholder="1" />
                </Field>
                <Field label="Title">
                  <input className={inputClass} value={dayForm.title} onChange={(event) => setDayForm({ ...dayForm, title: event.target.value })} placeholder="Push Day" />
                </Field>
              </div>
              <Field label="Notes">
                <textarea className="min-h-20 w-full resize-y rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] px-3 py-2 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white" value={dayForm.notes} onChange={(event) => setDayForm({ ...dayForm, notes: event.target.value })} placeholder="Optional notes" />
              </Field>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#FBFCFD] px-5 py-4">
                <button type="button" onClick={closeAddDayModal} disabled={savingDay} className={buttonClass}>Cancel</button>
                <button type="submit" disabled={savingDay} className={primaryButtonClass}>{savingDay ? "Creating..." : "Create Day"}</button>
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
              <button type="button" onClick={() => { setShowDayExerciseDetailsModal(false); setSelectedDayForDetails(null); }} className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950" aria-label="Close">
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
                              <Edit size={15} />
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
              <button type="button" onClick={() => { setShowExerciseModal(false); setSelectedDayForExercise(null); setExerciseForm({ exerciseId: "", sets: "", reps: "", duration: "", restTime: "", orderIndex: "" }); }} className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950" aria-label="Close">
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
              <button type="button" onClick={() => { setShowAssignMemberModal(false); setAssignmentForm({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" }); }} className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950" aria-label="Close">
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
              {(assignmentForm.repeatType === "WEEKLY" || assignmentForm.repeatType === "CUSTOM") && (
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
              {assignmentSchedulePreview && (
                <div className="rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] p-3 text-xs normal-case">
                  <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[#334155]">Schedule Preview</span><span className="font-semibold text-[#0D8252]">{assignmentSchedulePreview.schedules.length} session{assignmentSchedulePreview.schedules.length === 1 ? "" : "s"}</span></div>
                  {assignmentSchedulePreview.schedules.length > 0 && <p className="mt-1 text-[#64748B]">{assignmentSchedulePreview.schedules.slice(0, 5).map((item) => item.date).join(" · ")}{assignmentSchedulePreview.schedules.length > 5 ? " · ..." : ""}</p>}
                  {assignmentSchedulePreview.warnings.length > 0 && <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-700">{assignmentSchedulePreview.warnings.map((warning) => <p key={warning.workoutDayId}>{warning.message}</p>)}</div>}
                </div>
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
