import { Fragment, useState } from "react";
import { ChevronDown, Copy, Download, Dumbbell, Pencil, Plus, Search, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { createWorkoutPlan, updateWorkoutPlan, deleteWorkoutPlan, cloneWorkoutPlan, getApiError } from "../services/api";

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

function trainerAssignmentName(assignment) {
  return assignment?.trainer?.name || assignment?.trainer?.fullName || assignment?.user?.name || assignment?.user?.fullName || assignment?.trainerDetails?.name || assignment?.trainerDetails?.fullName || assignment?.trainerName || assignment?.userName || nameOf(assignment?.trainer || assignment?.user || assignment?.trainerDetails || assignment?.userDetails || assignment);
}

export default function WorkoutPlans(props) {
  const { user, role, canManage, canEdit, canDelete, canAssign, canManageAssignments, plans, setPlans, loading, planSearch, setPlanSearch, goalFilter, setGoalFilter, difficultyFilter, setDifficultyFilter, selectedPlanId, setSelectedPlanId, expandedPlanId, setExpandedPlanId, editingPlanId, setEditingPlanId, planForm, setPlanForm, filteredPlans, assignedMemberCount, memberWorkoutDaysCount, memberWorkoutExercisesCount, loadPlans, refreshSelectedPlan, selectedPlan, planTrainers, setActiveTab } = props;

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
  };

  return (
    <section className={canManage ? "grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]" : "space-y-4"}>
      {canManage && (
        <Card className="self-start p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-950">{editingPlanId ? "Edit Workout" : "Create Workout"}</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">Create a clear plan with a name, goal, and schedule.</p>
            </div>
            <Plus size={18} className="mt-0.5 text-gray-400" />
          </div>
          <form onSubmit={handleSavePlan} className="grid gap-2">
            <Field label="Workout Name">
              <input className={inputClass} value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} placeholder="Strength Builder" />
            </Field>
            <div className="grid gap-2">
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
            </div>
            <Field label="Duration">
              <input className={inputClass} type="number" min="1" value={planForm.duration} onChange={(event) => setPlanForm({ ...planForm, duration: event.target.value })} placeholder="30" />
            </Field>
            <Field label="Image URL">
              <input className={inputClass} type="url" value={planForm.image} onChange={(event) => setPlanForm({ ...planForm, image: event.target.value })} placeholder="https://example.com/image.jpg" />
            </Field>
            <Field label="Description">
              <textarea className="min-h-20 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} placeholder="Plan focus" />
            </Field>
            <button type="submit" className={primaryButtonClass} disabled={!canManage}>
              {editingPlanId ? "Update Plan" : "Create Plan"}
            </button>
            {editingPlanId && (
              <button type="button" onClick={() => { setEditingPlanId(""); setPlanForm(emptyPlan()); }} className={buttonClass}>
                Cancel
              </button>
            )}
          </form>
        </Card>
      )}

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
            <span className="text-center">Goal</span>
            <span className="text-center">Difficulty</span>
            <span className="text-center">Duration</span>
            <span className="text-center">Days</span>
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
                  <span className="inline-flex h-7 items-center justify-center rounded-full bg-gray-100 px-3 text-xs font-semibold text-gray-700">{titleCase(metricValue(plan.goal))}</span>
                  <span className="inline-flex h-7 items-center justify-center rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-700">{titleCase(metricValue(plan.difficulty))}</span>
                  <div className="text-sm text-center">
                    <span className="text-gray-500 lg:hidden">Duration: </span>
                    <span className="font-semibold text-gray-950">{metricValue(plan.duration)}</span>
                  </div>
                  <div className="text-sm text-center">
                    <span className="text-gray-500 lg:hidden">Days: </span>
                    <span className="font-semibold text-gray-950">{totalDays}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="flex justify-between gap-5 lg:pe-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500">Description</p>
                          <p className="mt-1 text-sm leading-6 text-gray-600">{plan.description || "No description added."}</p>
                        </div>
                        <div className="mt-0">
                          <p className="text-xs font-semibold uppercase text-gray-500">Assigned Dates</p>
                          <p className="mt-2 text-sm text-gray-500">
                            {assignmentStartDate(plan) || assignmentEndDate(plan)
                              ? `${displayDate(assignmentStartDate(plan))} - ${displayDate(assignmentEndDate(plan))}`
                              : "No assignment window"}
                          </p>
                        </div>
                        {role !== "member" && (
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
                        )}
                      </div>
                      {role !== "member" && (
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
    </section>
  );
}
