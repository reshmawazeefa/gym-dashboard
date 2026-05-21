import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  Pencil,
  Plus,
  Search,
  Trash,
  UserPlus,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  assignExerciseToWorkoutDay,
  assignTrainerToWorkoutPlan,
  assignWorkoutToMember,
  createExercise,
  createWorkoutDay,
  createWorkoutPlan,
  deleteExercise,
  deleteWorkoutDay,
  deleteWorkoutPlan,
  getApiError,
  getExercises,
  getMyWorkoutAssignments,
  getTenantUsers,
  getWorkoutDays,
  getWorkoutPlans,
  getWorkoutProgress,
  getWorkoutTrainers,
  removeWorkoutDayExercise,
  removeWorkoutTrainerAssignment,
  submitWorkoutProgress,
  updateExercise,
  updateWorkoutDay,
  updateWorkoutDayExercise,
  updateWorkoutPlan,
  unwrapList,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

const goals = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_BURN"];
const difficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const trainerRoles = ["PRIMARY", "ASSISTANT", "SUBSTITUTE"];
const completionStatuses = ["IN_PROGRESS", "COMPLETED", "SKIPPED"];
const inputClass =
  "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const textareaClass =
  "min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

function workoutRole(user) {
  const text = `${user?.loginType || ""} ${user?.role || ""} ${user?.staffRole || ""} ${user?.userRole || ""}`.toLowerCase();
  if (text.includes("owner")) return "owner";
  if (text.includes("admin")) return "admin";
  if (text.includes("trainer")) return "trainer";
  if (text.includes("member")) return "member";
  return "member";
}

function idOf(item) {
  return item?.id || item?._id || item?.uuid || item?.userId || "";
}

function nameOf(item) {
  return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-";
}

function listOf(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  return unwrapList(payload);
}

function metricValue(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function countOf(value) {
  return Array.isArray(value) ? value.length : Number(value || 0) || 0;
}

function emptyPlan() {
  return { name: "", description: "", goal: goals[0], difficulty: difficulties[0], duration: "" };
}

function emptyDay() {
  return { title: "", dayNumber: "", notes: "" };
}

function emptyExercise() {
  return { name: "", muscleGroup: "", instructions: "", videoUrl: "", calories: "" };
}

function emptyConfig() {
  return { exerciseId: "", sets: "", reps: "", duration: "", restTime: "" };
}

function emptyProgress() {
  return { workoutExerciseId: "", completedSets: "", completedReps: "", caloriesBurned: "", status: completionStatuses[0], notes: "" };
}

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`grid gap-1 text-xs font-semibold uppercase text-gray-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function SectionTitle({ icon, title, detail }) {
  const IconComponent = icon;

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-950 text-white">
        <IconComponent size={20} />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-950">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{detail}</p>
      </div>
    </div>
  );
}

export default function AdminWorkouts() {
  const { user } = useAuth();
  const role = workoutRole(user);
  const canManage = role === "owner" || role === "admin" || role === "trainer";
  const canManageAssignments = role === "owner" || role === "admin";
  const canDelete = role === "owner" || role === "admin";
  const isMember = role === "member";

  const [activeTab, setActiveTab] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [progress, setProgress] = useState([]);
  const [members, setMembers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [planTrainers, setPlanTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState("");
  const [editingPlanId, setEditingPlanId] = useState("");
  const [editingDayId, setEditingDayId] = useState("");
  const [editingExerciseId, setEditingExerciseId] = useState("");
  const [editingConfigId, setEditingConfigId] = useState("");
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [dayForm, setDayForm] = useState(emptyDay);
  const [exerciseForm, setExerciseForm] = useState(emptyExercise);
  const [configForm, setConfigForm] = useState(emptyConfig);
  const [trainerForm, setTrainerForm] = useState({ trainerId: "", role: trainerRoles[0] });
  const [memberForm, setMemberForm] = useState({ memberId: "", startDate: "", endDate: "" });
  const [progressForm, setProgressForm] = useState(emptyProgress);

  const selectedPlan = plans.find((plan) => idOf(plan) === selectedPlanId);
  const selectedDay = days.find((day) => idOf(day) === selectedDayId);
  const dayExercises = selectedDay?.exercises || selectedDay?.workoutExercises || selectedDay?.items || [];
  const muscleGroups = [...new Set(exercises.map((exercise) => exercise.muscleGroup).filter(Boolean))];
  const assignedTrainerCount = countOf(selectedPlan?.trainers || selectedPlan?.trainerAssignments || planTrainers);
  const assignedMemberCount = countOf(selectedPlan?.members || selectedPlan?.assignments || assignments);

  const filteredPlans = useMemo(() => {
    const query = planSearch.trim().toLowerCase();
    return plans.filter((plan) => {
      const matchesSearch = !query || [plan.name, plan.title, plan.description].join(" ").toLowerCase().includes(query);
      const matchesGoal = !goalFilter || plan.goal === goalFilter;
      const matchesDifficulty = !difficultyFilter || plan.difficulty === difficultyFilter;
      return matchesSearch && matchesGoal && matchesDifficulty;
    });
  }, [plans, planSearch, goalFilter, difficultyFilter]);

  const filteredExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    return exercises.filter((exercise) => {
      const matchesSearch = !query || [exercise.name, exercise.muscleGroup, exercise.instructions].join(" ").toLowerCase().includes(query);
      const matchesMuscle = !muscleFilter || exercise.muscleGroup === muscleFilter;
      return matchesSearch && matchesMuscle;
    });
  }, [exercises, exerciseSearch, muscleFilter]);

  const loadPlans = async () => {
    const params = {
      search: planSearch || undefined,
      goal: goalFilter || undefined,
      difficulty: difficultyFilter || undefined,
    };
    const response = isMember ? await getMyWorkoutAssignments(user?.token) : await getWorkoutPlans(params, user?.token);
    const nextPlans = listOf(response, ["plans", "workouts", "assignments"]);
    setPlans(nextPlans);
    setAssignments(listOf(response, ["assignments", "members"]));
    if (!selectedPlanId && nextPlans.length) setSelectedPlanId(idOf(nextPlans[0]));
  };

  const loadExercises = async () => {
    const response = await getExercises({ search: exerciseSearch || undefined, muscleGroup: muscleFilter || undefined }, user?.token);
    setExercises(listOf(response, ["exercises"]));
  };

  const loadProgress = async () => {
    if (!isMember) {
      setProgress([]);
      return;
    }
    const response = await getWorkoutProgress({}, user?.token);
    setProgress(listOf(response, ["progress", "history", "records"]));
  };

  const loadUsers = async () => {
    if (isMember) return;
    const [memberResponse, trainerResponse] = await Promise.all([
      getTenantUsers("member", user?.token),
      getTenantUsers("trainer", user?.token),
    ]);
    setMembers(unwrapList(memberResponse));
    setTrainers(unwrapList(trainerResponse));
  };

  useEffect(() => {
    let isCurrent = true;

    const loadInitial = async () => {
      try {
        setLoading(true);
        const tasks = [loadPlans(), loadExercises(), loadProgress(), loadUsers()];
        await Promise.all(tasks);
      } catch (error) {
        if (isCurrent) toast.error(getApiError(error, "Unable to load workout module"));
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void loadInitial();
    return () => {
      isCurrent = false;
    };
    // The loader functions intentionally use the current auth/session values for the initial module hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token, isMember]);

  useEffect(() => {
    if (!selectedPlanId) {
      return;
    }

    let isCurrent = true;
    const loadPlanDays = async () => {
      try {
        const response = await getWorkoutDays(selectedPlanId, user?.token);
        const nextDays = listOf(response, ["days", "workoutDays"]);
        if (isCurrent) {
          setDays(nextDays);
          setSelectedDayId((current) => (nextDays.some((day) => idOf(day) === current) ? current : idOf(nextDays[0]) || ""));
        }
      } catch (error) {
        if (isCurrent) {
          setDays(selectedPlan?.days || selectedPlan?.workoutDays || []);
          toast.error(getApiError(error, "Unable to load workout days"));
        }
      }
    };

    void loadPlanDays();
    return () => {
      isCurrent = false;
    };
  }, [selectedPlanId, user?.token, selectedPlan?.days, selectedPlan?.workoutDays]);

  useEffect(() => {
    if (!selectedPlanId || isMember) return;

    let isCurrent = true;
    const loadSelectedPlanTrainers = async () => {
      try {
        const response = await getWorkoutTrainers(selectedPlanId, user?.token);
        if (isCurrent) setPlanTrainers(listOf(response, ["trainers", "trainerAssignments"]));
      } catch {
        if (isCurrent) setPlanTrainers(selectedPlan?.trainers || selectedPlan?.trainerAssignments || []);
      }
    };

    void loadSelectedPlanTrainers();
    return () => {
      isCurrent = false;
    };
  }, [selectedPlanId, user?.token, isMember, selectedPlan?.trainers, selectedPlan?.trainerAssignments]);

  const refreshSelectedPlan = async () => {
    await loadPlans();
    if (selectedPlanId) {
      const response = await getWorkoutDays(selectedPlanId, user?.token);
      setDays(listOf(response, ["days", "workoutDays"]));
    }
  };

  const savePlan = async (event) => {
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

  const saveDay = async (event) => {
    event.preventDefault();
    if (!selectedPlanId || !dayForm.title.trim()) {
      toast.error("Select a plan and enter a day name");
      return;
    }

    const payload = {
      title: dayForm.title,
      dayNumber: dayForm.dayNumber ? Number(dayForm.dayNumber) : undefined,
      notes: dayForm.notes || undefined,
    };

    try {
      if (editingDayId) {
        await updateWorkoutDay(editingDayId, payload, user?.token);
        toast.success("Workout day updated");
      } else {
        await createWorkoutDay(selectedPlanId, payload, user?.token);
        toast.success("Workout day created");
      }
      setDayForm(emptyDay());
      setEditingDayId("");
      await refreshSelectedPlan();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save workout day"));
    }
  };

  const saveExercise = async (event) => {
    event.preventDefault();
    if (!canManage || !exerciseForm.name.trim()) {
      toast.error("Exercise name is required");
      return;
    }

    const payload = {
      ...exerciseForm,
      calories: exerciseForm.calories ? Number(exerciseForm.calories) : undefined,
    };

    try {
      if (editingExerciseId) {
        await updateExercise(editingExerciseId, payload, user?.token);
        toast.success("Exercise updated");
      } else {
        await createExercise(payload, user?.token);
        toast.success("Exercise created");
      }
      setExerciseForm(emptyExercise());
      setEditingExerciseId("");
      await loadExercises();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save exercise"));
    }
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    if (!selectedDayId || !configForm.exerciseId) {
      toast.error("Select a workout day and exercise");
      return;
    }

    const payload = {
      ...configForm,
      sets: configForm.sets ? Number(configForm.sets) : undefined,
      reps: configForm.reps ? Number(configForm.reps) : undefined,
      duration: configForm.duration ? Number(configForm.duration) : undefined,
      restTime: configForm.restTime ? Number(configForm.restTime) : undefined,
    };

    try {
      if (editingConfigId) {
        await updateWorkoutDayExercise(editingConfigId, payload, user?.token);
        toast.success("Workout exercise updated");
      } else {
        await assignExerciseToWorkoutDay(selectedDayId, payload, user?.token);
        toast.success("Exercise assigned to day");
      }
      setConfigForm(emptyConfig());
      setEditingConfigId("");
      await refreshSelectedPlan();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save workout exercise"));
    }
  };

  const saveTrainerAssignment = async (event) => {
    event.preventDefault();
    if (!canManageAssignments || !selectedPlanId || !trainerForm.trainerId) {
      toast.error("Select a plan and trainer");
      return;
    }

    try {
      await assignTrainerToWorkoutPlan(selectedPlanId, trainerForm, user?.token);
      setTrainerForm({ trainerId: "", role: trainerRoles[0] });
      toast.success("Trainer assigned");
      await loadPlans();
      const response = await getWorkoutTrainers(selectedPlanId, user?.token);
      setPlanTrainers(listOf(response, ["trainers", "trainerAssignments"]));
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign trainer"));
    }
  };

  const saveMemberAssignment = async (event) => {
    event.preventDefault();
    if (!canManage || !selectedPlanId || !memberForm.memberId) {
      toast.error("Select a plan and member");
      return;
    }

    try {
      await assignWorkoutToMember(
        selectedPlanId,
        { userId: memberForm.memberId, startDate: memberForm.startDate || undefined, endDate: memberForm.endDate || undefined },
        user?.token
      );
      setMemberForm({ memberId: "", startDate: "", endDate: "" });
      toast.success("Workout assigned to member");
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign workout"));
    }
  };

  const saveProgress = async (event) => {
    event.preventDefault();
    if (!progressForm.workoutExerciseId) {
      toast.error("Select a workout exercise");
      return;
    }

    const payload = {
      workoutExerciseId: progressForm.workoutExerciseId,
      completedSets: progressForm.completedSets ? Number(progressForm.completedSets) : undefined,
      completedReps: progressForm.completedReps ? Number(progressForm.completedReps) : undefined,
      caloriesBurned: progressForm.caloriesBurned ? Number(progressForm.caloriesBurned) : undefined,
      notes: progressForm.notes || undefined,
      completed: progressForm.status === "COMPLETED",
    };

    try {
      await submitWorkoutProgress(payload, user?.token);
      setProgressForm(emptyProgress());
      toast.success("Workout progress submitted");
      await loadProgress();
    } catch (error) {
      toast.error(getApiError(error, "Unable to submit progress"));
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
    });
    setActiveTab("plans");
  };

  const editDay = (day) => {
    setEditingDayId(idOf(day));
    setDayForm({ title: day.title || day.name || "", dayNumber: day.dayNumber || "", notes: day.notes || "" });
  };

  const editExercise = (exercise) => {
    setEditingExerciseId(idOf(exercise));
    setExerciseForm({
      name: exercise.name || "",
      muscleGroup: exercise.muscleGroup || "",
      instructions: exercise.instructions || "",
      videoUrl: exercise.videoUrl || "",
      calories: exercise.calories || exercise.caloriesBurned || "",
    });
    setActiveTab("exercises");
  };

  const editConfig = (item) => {
    setEditingConfigId(idOf(item));
    setConfigForm({
      exerciseId: item.exerciseId || idOf(item.exercise) || "",
      sets: item.sets || "",
      reps: item.reps || "",
      duration: item.duration || "",
      restTime: item.restTime || "",
    });
  };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle
            icon={Dumbbell}
            title="Workout Management"
            detail="Plans, workout days, exercise configuration, trainer assignment, member assignment, and progress tracking."
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {[
              { key: "plans", label: isMember ? "Assigned" : "Plans" },
              { key: "days", label: "Days" },
              { key: "exercises", label: "Exercises", hidden: isMember },
              { key: "assignments", label: "Assignments", hidden: isMember },
              { key: "progress", label: "Progress" },
            ]
              .filter((tab) => !tab.hidden)
              .map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
                    activeTab === tab.key ? "bg-gray-950 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
          </div>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Total Workouts", value: plans.length, icon: ClipboardList },
          { label: "Total Exercises", value: exercises.length, icon: Activity },
          { label: "Assigned Members", value: assignedMemberCount, icon: Users },
          { label: "Active Trainers", value: assignedTrainerCount, icon: Dumbbell },
        ].map((card) => (
          <Card key={card.label} className="p-4">
            <card.icon size={20} className="text-blue-600" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-950">{card.value}</p>
            </div>
          </Card>
        ))}
      </section>

      {activeTab === "plans" && (
        <section className={isMember ? "space-y-4" : "grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]"}>
          {!isMember && (
            <Card className="self-start p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-950">{editingPlanId ? "Edit Plan" : "Create Plan"}</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Add workout basics.</p>
                </div>
                <Plus size={18} className="mt-0.5 text-gray-400" />
              </div>
              <form onSubmit={savePlan} className="grid gap-2">
                <Field label="Plan Name">
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
            <div className="grid gap-3 border-b border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
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
            </div>
            <div className="divide-y divide-gray-100">
              <div className="hidden bg-gray-100 px-4 py-3 text-xs font-semibold uppercase text-gray-500 lg:grid lg:grid-cols-[minmax(10rem,1fr)_9rem_9rem_6rem_6rem_5rem_4rem] lg:items-center">
                <span>Workout</span>
                <span className="text-center">Goal</span>
                <span className="text-center">Difficulty</span>
                <span className="text-center">Duration</span>
                <span className="text-center">Trainers</span>
                <span className="text-center">Days</span>
                <span className="text-center">Expand</span>
              </div>
              {filteredPlans.map((plan) => {
                const planId = idOf(plan);
                const trainerCount = countOf(plan.trainers || plan.trainerAssignments);
                const totalDays = countOf(plan.days || plan.workoutDays || plan.totalDays);
                const isExpanded = expandedPlanId === planId;
                return (
                  <div key={planId} className={selectedPlanId === planId ? "bg-blue-50/40" : "bg-white"}>
                    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(10rem,1fr)_9rem_9rem_6rem_6rem_5rem_4rem] lg:items-center">
                      <button type="button" onClick={() => { setSelectedPlanId(planId); setExpandedPlanId(isExpanded ? "" : planId); }} className="min-w-0 text-left">
                        <h3 className="truncate font-semibold text-gray-950">{plan.name || plan.title || "Untitled plan"}</h3>
                      </button>
                      <span className="inline-flex h-7 items-center justify-center rounded-full bg-gray-100 px-3 text-xs font-semibold text-gray-700">{titleCase(metricValue(plan.goal))}</span>
                      <span className="inline-flex h-7 items-center justify-center rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-700">{titleCase(metricValue(plan.difficulty))}</span>
                      <div className="text-sm text-center">
                        <span className="text-gray-500 lg:hidden">Duration: </span>
                        <span className="font-semibold text-gray-950">{metricValue(plan.duration)}</span>
                      </div>
                      <div className="text-sm text-center">
                        <span className="text-gray-500 lg:hidden">Trainers: </span>
                        <span className="font-semibold text-gray-950">{trainerCount}</span>
                      </div>
                      <div className="text-sm text-center">
                        <span className="text-gray-500 lg:hidden">Days: </span>
                        <span className="font-semibold text-gray-950">{totalDays}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedPlanId(planId); setExpandedPlanId(isExpanded ? "" : planId); }}
                        className={iconButtonClass}
                        aria-label="Expand workout plan"
                      >
                        <ChevronDown size={17} className={`transition ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                          <div>
                            <p className="text-xs font-semibold uppercase text-gray-500">Description</p>
                            <p className="mt-1 text-sm leading-6 text-gray-600">{plan.description || "No description added."}</p>
                          </div>
                          {!isMember && (
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                            <button type="button" onClick={() => { setSelectedPlanId(planId); setActiveTab("days"); }} className={buttonClass}>
                              View
                            </button>
                            <button type="button" onClick={() => editPlan(plan)} className={buttonClass}>
                              <Pencil size={16} />
                              Edit
                            </button>
                            <button type="button" onClick={() => { setSelectedPlanId(planId); setActiveTab("assignments"); }} className={buttonClass}>
                              Assign Member
                            </button>
                            {canDelete && (
                              <button type="button" onClick={() => void deleteWorkoutPlan(planId, user?.token).then(loadPlans).then(() => toast.success("Workout plan deleted")).catch((error) => toast.error(getApiError(error, "Unable to delete plan")))} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                                <Trash size={16} />
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
                  {loading ? "Loading workout plans..." : "No workout plans found."}
                </div>
              )}
            </div>
          </Card>
        </section>
      )}

      {activeTab === "days" && (
        <section className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Card className="p-4">
            <SectionTitle icon={CalendarDays} title="Workout Days" detail="Create days and assign exercises to the selected plan." />
            <div className="mt-4 grid gap-3">
              <Field label="Workout Plan">
                <select className={inputClass} value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                  <option value="">Select plan</option>
                  {plans.map((plan) => <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title}</option>)}
                </select>
              </Field>
              {canManage && (
                <form onSubmit={saveDay} className="grid gap-3 border-t border-gray-200 pt-3">
                  <Field label="Day Name">
                    <input className={inputClass} value={dayForm.title} onChange={(event) => setDayForm({ ...dayForm, title: event.target.value })} placeholder="Chest Day" />
                  </Field>
                  <Field label="Day Number">
                    <input className={inputClass} type="number" value={dayForm.dayNumber} onChange={(event) => setDayForm({ ...dayForm, dayNumber: event.target.value })} placeholder="1" />
                  </Field>
                  <Field label="Notes">
                    <textarea className={textareaClass} value={dayForm.notes} onChange={(event) => setDayForm({ ...dayForm, notes: event.target.value })} placeholder="Warmup and focus notes" />
                  </Field>
                  <button type="submit" className={primaryButtonClass}>{editingDayId ? "Update Day" : "Create Day"}</button>
                </form>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <div className="grid content-start gap-2">
                {days.map((day) => (
                  <button key={idOf(day)} type="button" onClick={() => setSelectedDayId(idOf(day))} className={`rounded-md border p-3 text-left transition ${selectedDayId === idOf(day) ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <p className="font-semibold text-gray-950">Day {day.dayNumber || "-"} - {day.title || day.name || "Untitled"}</p>
                    <p className="mt-1 text-xs text-gray-500">{day.notes || "No notes"}</p>
                    <p className="mt-2 text-xs font-semibold text-gray-700">{countOf(day.exercises || day.workoutExercises)} exercises</p>
                    {canManage && (
                      <span className="mt-2 inline-flex gap-2">
                        <span onClick={(event) => { event.stopPropagation(); editDay(day); }} className="text-xs font-semibold text-blue-700">Edit</span>
                        {canDelete && <span onClick={(event) => { event.stopPropagation(); void deleteWorkoutDay(idOf(day), user?.token).then(refreshSelectedPlan).then(() => toast.success("Workout day deleted")).catch((error) => toast.error(getApiError(error, "Unable to delete day"))); }} className="text-xs font-semibold text-red-700">Delete</span>}
                      </span>
                    )}
                  </button>
                ))}
                {!days.length && <p className="rounded-md border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">No workout days found.</p>}
              </div>

              <div>
                {canManage && (
                  <form onSubmit={saveConfig} className="mb-4 grid gap-3 rounded-md border border-gray-200 p-4 md:grid-cols-5">
                    <Field label="Exercise" className="md:col-span-2">
                      <select className={inputClass} value={configForm.exerciseId} onChange={(event) => setConfigForm({ ...configForm, exerciseId: event.target.value })}>
                        <option value="">Select exercise</option>
                        {exercises.map((exercise) => <option key={idOf(exercise)} value={idOf(exercise)}>{exercise.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Sets"><input className={inputClass} type="number" value={configForm.sets} onChange={(event) => setConfigForm({ ...configForm, sets: event.target.value })} /></Field>
                    <Field label="Reps"><input className={inputClass} type="number" value={configForm.reps} onChange={(event) => setConfigForm({ ...configForm, reps: event.target.value })} /></Field>
                    <Field label="Rest"><input className={inputClass} value={configForm.restTime} onChange={(event) => setConfigForm({ ...configForm, restTime: event.target.value })} placeholder="60 sec" /></Field>
                    <Field label="Duration" className="md:col-span-2"><input className={inputClass} value={configForm.duration} onChange={(event) => setConfigForm({ ...configForm, duration: event.target.value })} placeholder="10 min" /></Field>
                    <button type="submit" className={`${primaryButtonClass} md:col-span-3`}>{editingConfigId ? "Update Configuration" : "Assign Exercise"}</button>
                  </form>
                )}

                <div className="overflow-hidden rounded-md border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="p-3">Exercise</th>
                        <th className="p-3">Sets</th>
                        <th className="p-3">Reps</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Rest</th>
                        {canManage && <th className="p-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dayExercises.map((item) => (
                        <tr key={idOf(item)}>
                          <td className="p-3 font-medium text-gray-950">{item.exercise?.name || item.exerciseName || exercises.find((exercise) => idOf(exercise) === item.exerciseId)?.name || "-"}</td>
                          <td className="p-3">{metricValue(item.sets)}</td>
                          <td className="p-3">{metricValue(item.reps)}</td>
                          <td className="p-3">{metricValue(item.duration)}</td>
                          <td className="p-3">{metricValue(item.restTime)}</td>
                          {canManage && (
                            <td className="p-3">
                              <div className="flex justify-end gap-1">
                                <button type="button" className={iconButtonClass} onClick={() => editConfig(item)} aria-label="Edit workout exercise"><Pencil size={16} /></button>
                                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50" onClick={() => void removeWorkoutDayExercise(idOf(item), user?.token).then(refreshSelectedPlan).then(() => toast.success("Exercise removed")).catch((error) => toast.error(getApiError(error, "Unable to remove exercise")))} aria-label="Remove workout exercise"><Trash size={16} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!dayExercises.length && (
                        <tr><td colSpan={canManage ? 6 : 5} className="p-6 text-center text-gray-500">No exercises configured for this day.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {activeTab === "exercises" && (
        <section className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
          {canManage && (
            <Card className="p-4">
              <SectionTitle icon={Activity} title={editingExerciseId ? "Edit Exercise" : "Create Exercise"} detail="Build the exercise library used by workout days." />
              <form onSubmit={saveExercise} className="mt-4 grid gap-3">
                <Field label="Exercise Name"><input className={inputClass} value={exerciseForm.name} onChange={(event) => setExerciseForm({ ...exerciseForm, name: event.target.value })} placeholder="Bench Press" /></Field>
                <Field label="Muscle Group"><input className={inputClass} value={exerciseForm.muscleGroup} onChange={(event) => setExerciseForm({ ...exerciseForm, muscleGroup: event.target.value })} placeholder="Chest" /></Field>
                <Field label="Video URL"><input className={inputClass} value={exerciseForm.videoUrl} onChange={(event) => setExerciseForm({ ...exerciseForm, videoUrl: event.target.value })} placeholder="https://..." /></Field>
                <Field label="Calories"><input className={inputClass} type="number" value={exerciseForm.calories} onChange={(event) => setExerciseForm({ ...exerciseForm, calories: event.target.value })} /></Field>
                <Field label="Instructions"><textarea className={textareaClass} value={exerciseForm.instructions} onChange={(event) => setExerciseForm({ ...exerciseForm, instructions: event.target.value })} /></Field>
                <button type="submit" className={primaryButtonClass}>{editingExerciseId ? "Update Exercise" : "Create Exercise"}</button>
              </form>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="grid gap-3 border-b border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3">
                <Search size={17} className="text-gray-400" />
                <input className="h-10 min-w-0 flex-1 text-sm outline-none" value={exerciseSearch} onChange={(event) => setExerciseSearch(event.target.value)} placeholder="Search exercises..." />
              </div>
              <select className={inputClass} value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)}>
                <option value="">All Muscle Groups</option>
                {muscleGroups.map((muscle) => <option key={muscle}>{muscle}</option>)}
              </select>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredExercises.map((exercise) => (
                <div key={idOf(exercise)} className="rounded-md border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-950">{exercise.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{exercise.instructions || "No instructions added."}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{metricValue(exercise.muscleGroup)}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{metricValue(exercise.calories || exercise.caloriesBurned)} cal</span>
                  </div>
                  {canManage && (
                    <div className="mt-4 flex gap-2">
                      <button type="button" className={buttonClass} onClick={() => editExercise(exercise)}><Pencil size={16} />Edit</button>
                      {canDelete && <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50" onClick={() => void deleteExercise(idOf(exercise), user?.token).then(loadExercises).then(() => toast.success("Exercise deleted")).catch((error) => toast.error(getApiError(error, "Unable to delete exercise")))}><Trash size={16} />Delete</button>}
                    </div>
                  )}
                </div>
              ))}
              {!filteredExercises.length && <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 md:col-span-2 xl:col-span-3">No exercises found.</div>}
            </div>
          </Card>
        </section>
      )}

      {activeTab === "assignments" && !isMember && (
        <section className="grid gap-5 xl:grid-cols-2">
          <Card className="p-4">
            <SectionTitle icon={Users} title="Trainer Assignment" detail="Owners and admins can assign trainers to workout plans." />
            <form onSubmit={saveTrainerAssignment} className="mt-4 grid gap-3">
              <Field label="Workout Plan"><select className={inputClass} value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>{plans.map((plan) => <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title}</option>)}</select></Field>
              <Field label="Trainer"><select className={inputClass} value={trainerForm.trainerId} onChange={(event) => setTrainerForm({ ...trainerForm, trainerId: event.target.value })}><option value="">Select trainer</option>{trainers.map((trainer) => <option key={idOf(trainer)} value={idOf(trainer)}>{nameOf(trainer)}</option>)}</select></Field>
              <Field label="Role"><select className={inputClass} value={trainerForm.role} onChange={(event) => setTrainerForm({ ...trainerForm, role: event.target.value })}>{trainerRoles.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></Field>
              <button type="submit" className={primaryButtonClass} disabled={!canManageAssignments}><UserPlus size={17} />Assign Trainer</button>
            </form>
            <div className="mt-4 grid gap-2">
              {(planTrainers.length ? planTrainers : selectedPlan?.trainers || selectedPlan?.trainerAssignments || []).map((assignment) => (
                <div key={idOf(assignment)} className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm">
                  <span>{assignment.trainer?.name || assignment.trainerName || nameOf(assignment)} <span className="text-xs text-gray-500">{titleCase(assignment.role)}</span></span>
                  {canManageAssignments && <button type="button" className="text-red-600" onClick={() => void removeWorkoutTrainerAssignment(selectedPlanId, assignment.trainerId || idOf(assignment.trainer) || idOf(assignment), user?.token).then(loadPlans).then(() => setPlanTrainers([]))}>Remove</button>}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle icon={UserPlus} title="Member Assignment" detail="Assign workout plans to members with start and end dates." />
            <form onSubmit={saveMemberAssignment} className="mt-4 grid gap-3">
              <Field label="Workout Plan"><select className={inputClass} value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>{plans.map((plan) => <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title}</option>)}</select></Field>
              <Field label="Member"><select className={inputClass} value={memberForm.memberId} onChange={(event) => setMemberForm({ ...memberForm, memberId: event.target.value })}><option value="">Select member</option>{members.map((member) => <option key={idOf(member)} value={idOf(member)}>{nameOf(member)}</option>)}</select></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start Date"><input className={inputClass} type="date" value={memberForm.startDate} onChange={(event) => setMemberForm({ ...memberForm, startDate: event.target.value })} /></Field>
                <Field label="End Date"><input className={inputClass} type="date" value={memberForm.endDate} onChange={(event) => setMemberForm({ ...memberForm, endDate: event.target.value })} /></Field>
              </div>
              <button type="submit" className={primaryButtonClass} disabled={!canManage}><UserPlus size={17} />Assign Workout</button>
            </form>
            <div className="mt-4 grid gap-2">
              {assignments.map((assignment) => (
                <div key={idOf(assignment)} className="rounded-md border border-gray-200 p-3 text-sm">
                  <p className="font-semibold text-gray-950">{assignment.member?.name || assignment.memberName || nameOf(assignment)}</p>
                  <p className="mt-1 text-gray-500">{assignment.startDate || "-"} to {assignment.endDate || "-"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {activeTab === "progress" && (
        <section className={`grid gap-5 ${isMember ? "xl:grid-cols-[24rem_minmax(0,1fr)]" : ""}`}>
          {isMember && (
            <Card className="p-4">
              <SectionTitle icon={CheckCircle2} title="Progress Tracking" detail="Submit completed sets, reps, calories, notes, and completion status." />
              <form onSubmit={saveProgress} className="mt-4 grid gap-3">
                <Field label="Workout Exercise">
                  <select className={inputClass} value={progressForm.workoutExerciseId} onChange={(event) => setProgressForm({ ...progressForm, workoutExerciseId: event.target.value })}>
                    <option value="">Select configured exercise</option>
                    {days.flatMap((day) => day.exercises || day.workoutExercises || []).map((item) => <option key={idOf(item)} value={idOf(item)}>{item.exercise?.name || item.exerciseName || idOf(item)}</option>)}
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Completed Sets"><input className={inputClass} type="number" value={progressForm.completedSets} onChange={(event) => setProgressForm({ ...progressForm, completedSets: event.target.value })} /></Field>
                  <Field label="Completed Reps"><input className={inputClass} type="number" value={progressForm.completedReps} onChange={(event) => setProgressForm({ ...progressForm, completedReps: event.target.value })} /></Field>
                </div>
                <Field label="Calories Burned"><input className={inputClass} type="number" value={progressForm.caloriesBurned} onChange={(event) => setProgressForm({ ...progressForm, caloriesBurned: event.target.value })} /></Field>
                <Field label="Completion Status"><select className={inputClass} value={progressForm.status} onChange={(event) => setProgressForm({ ...progressForm, status: event.target.value })}>{completionStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></Field>
                <Field label="Notes"><textarea className={textareaClass} value={progressForm.notes} onChange={(event) => setProgressForm({ ...progressForm, notes: event.target.value })} /></Field>
                <button type="submit" className={primaryButtonClass}>Submit Progress</button>
              </form>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-950">Progress History</h3>
              <p className="mt-1 text-sm text-gray-500">Member workout progress entries returned by the API.</p>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Exercise</th>
                    <th className="p-3">Sets</th>
                    <th className="p-3">Reps</th>
                    <th className="p-3">Calories</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {progress.map((item) => (
                    <tr key={idOf(item)}>
                      <td className="p-3 font-medium text-gray-950">{item.exercise?.name || item.exerciseName || item.workoutExerciseId || "-"}</td>
                      <td className="p-3">{metricValue(item.completedSets)}</td>
                      <td className="p-3">{metricValue(item.completedReps)}</td>
                      <td className="p-3">{metricValue(item.caloriesBurned)}</td>
                      <td className="p-3">{metricValue(item.status)}</td>
                      <td className="p-3">{metricValue(item.notes)}</td>
                    </tr>
                  ))}
                  {!progress.length && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No progress history found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
