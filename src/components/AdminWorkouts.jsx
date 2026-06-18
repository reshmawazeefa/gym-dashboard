import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
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
  getUserWorkouts,
  getWorkoutDays,
  getWorkoutPlans,
  getWorkoutTrainers,
  removeWorkoutDayExercise,
  removeWorkoutTrainerAssignment,
  updateExercise,
  updateWorkoutDay,
  updateWorkoutDayExercise,
  updateWorkoutPlan,
  unwrapList,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess, getStaffCategory, normalizeRole } from "../utils/rbac";

const goals = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_BURN"];
const difficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const muscleGroupOptions = ["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE", "FULL_BODY"];
const trainerRoles = ["PRIMARY", "ASSISTANT", "SUBSTITUTE"];
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
const adminPlanGridClass = "lg:grid-cols-[2rem_minmax(12rem,1fr)_9rem_9rem_6rem_5rem]";

function workoutRole(user) {
  const normalizedRole = normalizeRole(user?.role, user?.loginType);
  const text = `${user?.loginType || ""} ${user?.role || ""} ${user?.staffRole || ""} ${user?.userRole || ""}`.toLowerCase();

  if (normalizedRole === "gym_owner" || normalizedRole === "platform_admin" || text.includes("owner")) return "owner";
  if (normalizedRole === "staff") {
    const staffCategory = getStaffCategory(user);
    if (staffCategory === "admin") return "admin";
    if (staffCategory === "trainer") return "trainer";
    return staffCategory;
  }
  if (text.includes("admin")) return "admin";
  if (text.includes("trainer")) return "trainer";
  if (normalizedRole === "member" || text.includes("member")) return "member";
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

function assignmentPlanId(assignment) {
  return (
    assignment?.planId ||
    assignment?.workoutId ||
    assignment?.workoutPlanId ||
    idOf(assignment?.plan) ||
    idOf(assignment?.workout) ||
    idOf(assignment?.workoutPlan) ||
    ""
  );
}

function assignmentMemberId(assignment) {
  return (
    assignment?.memberId ||
    assignment?.userId ||
    idOf(assignment?.member) ||
    idOf(assignment?.user) ||
    idOf(assignment?.memberDetails) ||
    idOf(assignment?.userDetails) ||
    ""
  );
}

function trainerAssignmentId(assignment) {
  return (
    assignment?.trainerId ||
    assignment?.userId ||
    idOf(assignment?.trainer) ||
    idOf(assignment?.user) ||
    idOf(assignment?.trainerDetails) ||
    idOf(assignment?.userDetails) ||
    idOf(assignment) ||
    ""
  );
}

function trainerAssignmentName(assignment) {
  return (
    assignment?.trainer?.name ||
    assignment?.trainer?.fullName ||
    assignment?.user?.name ||
    assignment?.user?.fullName ||
    assignment?.trainerDetails?.name ||
    assignment?.trainerDetails?.fullName ||
    assignment?.trainerName ||
    assignment?.userName ||
    nameOf(assignment?.trainer || assignment?.user || assignment?.trainerDetails || assignment?.userDetails || assignment)
  );
}

function assignmentStartDate(assignment) {
  return (
    assignment?.startDate ||
    assignment?.start_date ||
    assignment?.assignment?.startDate ||
    assignment?.assignment?.start_date ||
    assignment?.memberAssignment?.startDate ||
    assignment?.memberAssignment?.start_date ||
    assignment?.workoutAssignment?.startDate ||
    assignment?.workoutAssignment?.start_date ||
    assignment?.pivot?.startDate ||
    assignment?.pivot?.start_date ||
    ""
  );
}

function assignmentEndDate(assignment) {
  return (
    assignment?.endDate ||
    assignment?.end_date ||
    assignment?.assignment?.endDate ||
    assignment?.assignment?.end_date ||
    assignment?.memberAssignment?.endDate ||
    assignment?.memberAssignment?.end_date ||
    assignment?.workoutAssignment?.endDate ||
    assignment?.workoutAssignment?.end_date ||
    assignment?.pivot?.endDate ||
    assignment?.pivot?.end_date ||
    ""
  );
}

function assignmentMemberName(assignment) {
  return (
    assignment?.member?.name ||
    assignment?.member?.fullName ||
    assignment?.user?.name ||
    assignment?.user?.fullName ||
    assignment?.memberDetails?.name ||
    assignment?.memberDetails?.fullName ||
    assignment?.userDetails?.name ||
    assignment?.userDetails?.fullName ||
    assignment?.memberName ||
    assignment?.userName ||
    nameOf(assignment?.member || assignment?.user || assignment?.memberDetails || assignment?.userDetails || assignment)
  );
}

function assignmentPlanName(assignment, fallback = "Workout plan") {
  return (
    assignment?.plan?.name ||
    assignment?.plan?.title ||
    assignment?.workout?.name ||
    assignment?.workout?.title ||
    assignment?.workoutPlan?.name ||
    assignment?.workoutPlan?.title ||
    assignment?.workoutName ||
    assignment?.planName ||
    assignment?.name ||
    assignment?.title ||
    fallback
  );
}

function workoutFromAssignment(item) {
  return item?.workout || item?.plan || item?.workoutPlan || item?.workoutDetails || null;
}

function normalizeWorkoutPlan(item) {
  const workout = workoutFromAssignment(item);
  if (!workout) return item;

  return {
    ...item,
    ...workout,
    assignmentId: idOf(item),
    assignment: item,
    startDate: assignmentStartDate(item) || item.startDate || workout.startDate,
    endDate: assignmentEndDate(item) || item.endDate || workout.endDate,
  };
}

function planDays(plan) {
  return plan?.days || plan?.workoutDays || [];
}

function planExerciseCount(plan) {
  const explicitCount = Number(plan?.totalExercises || plan?.exerciseCount || 0);
  if (explicitCount) return explicitCount;
  return planDays(plan).reduce((total, day) => total + countOf(day.exercises || day.workoutExercises || day.items), 0);
}

function isMemberAssignment(assignment) {
  return Boolean(
    assignment?.member ||
      assignment?.user ||
      assignment?.memberDetails ||
      assignment?.userDetails ||
      assignment?.memberId ||
      assignment?.userId ||
      assignment?.memberName ||
      assignment?.userName ||
      assignmentStartDate(assignment) ||
      assignmentEndDate(assignment)
  );
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

function toApiDate(value) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function displayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
  const isMember = role === "member";
  const isWorkoutManager = role === "owner" || role === "admin" || role === "trainer";
  const canManage = !isMember && (isWorkoutManager || canAccess(user, "workouts", "create"));
  const canEdit = !isMember && (canManage || canAccess(user, "workouts", "edit") || canAccess(user, "workouts", "update"));
  const canManageAssignments = !isMember && (role === "owner" || role === "admin");
  const canDelete = !isMember && (canAccess(user, "workouts", "delete") || canAccess(user, "workouts", "remove"));

  const [activeTab, setActiveTab] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [members, setMembers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [userWorkouts, setUserWorkouts] = useState([]);
  const [planTrainers, setPlanTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userWorkoutsLoading, setUserWorkoutsLoading] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState("");
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
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

  const selectedPlan = plans.find((plan) => idOf(plan) === selectedPlanId);
  const selectedMember = members.find((member) => idOf(member) === memberForm.memberId);
  const selectedDay = days.find((day) => idOf(day) === selectedDayId);
  const dayExercises = selectedDay?.exercises || selectedDay?.workoutExercises || selectedDay?.items || [];
  const muscleGroups = muscleGroupOptions;
  const selectedMemberAssignments = useMemo(() => {
    const explicitPlanAssignments = [
      ...listOf(selectedPlan, ["assignments"]),
      ...listOf(selectedPlan, ["memberAssignments"]),
      ...listOf(selectedPlan, ["workoutAssignments"]),
    ];
    const topLevelAssignments = assignments.filter((assignment) => {
      const planId = assignmentPlanId(assignment);
      return (!planId || String(planId) === String(selectedPlanId)) && isMemberAssignment(assignment);
    });
    const memberFallback = explicitPlanAssignments.length || topLevelAssignments.length
      ? []
      : listOf(selectedPlan, ["members"]).map((member) => (
          member?.member || member?.user || member?.memberId || member?.userId
            ? member
            : {
                member,
                memberId: idOf(member),
                planId: selectedPlanId,
                startDate: assignmentStartDate(member),
                endDate: assignmentEndDate(member),
              }
        ));
    const seen = new Set();

    return [...explicitPlanAssignments, ...topLevelAssignments, ...memberFallback]
      .filter(isMemberAssignment)
      .filter((assignment) => {
        const key = [
          idOf(assignment),
          assignmentMemberId(assignment),
          assignmentPlanId(assignment) || selectedPlanId,
          assignmentStartDate(assignment),
          assignmentEndDate(assignment),
        ].filter(Boolean).join("|") || assignmentMemberName(assignment);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [assignments, selectedPlan, selectedPlanId]);
  const displayedMemberWorkouts = memberForm.memberId ? userWorkouts : selectedMemberAssignments;
  const assignedMemberCount = useMemo(() => {
    const seen = new Set();
    const memberAssignments = [
      ...assignments,
      ...plans.flatMap((plan) => [
        ...listOf(plan, ["assignments"]),
        ...listOf(plan, ["memberAssignments"]),
        ...listOf(plan, ["workoutAssignments"]),
        ...listOf(plan, ["members"]).map((member) => (
          member?.member || member?.user || member?.memberId || member?.userId
            ? member
            : { member, memberId: idOf(member), planId: idOf(plan) }
        )),
      ]),
    ];

    memberAssignments.filter(isMemberAssignment).forEach((assignment) => {
      const key = assignmentMemberId(assignment) || assignmentMemberName(assignment);
      if (key && key !== "-") seen.add(String(key));
    });

    return seen.size;
  }, [assignments, plans]);
  const assignedTrainerCount = useMemo(() => {
    const seen = new Set();
    const trainerAssignments = [
      ...planTrainers,
      ...plans.flatMap((plan) => [
        ...listOf(plan, ["trainers"]),
        ...listOf(plan, ["trainerAssignments"]),
      ]),
    ];

    trainerAssignments.forEach((assignment) => {
      const key = trainerAssignmentId(assignment) || trainerAssignmentName(assignment);
      if (key && key !== "-") seen.add(String(key));
    });

    return seen.size;
  }, [planTrainers, plans]);
  const memberWorkoutDaysCount = useMemo(() => plans.reduce((total, plan) => total + countOf(planDays(plan) || plan.totalDays), 0), [plans]);
  const memberWorkoutExercisesCount = useMemo(() => plans.reduce((total, plan) => total + planExerciseCount(plan), 0), [plans]);

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
    let response;
    try {
      response = await getWorkoutPlans(params, user?.token);
    } catch (error) {
      if (!isMember) throw error;
      response = await getMyWorkoutAssignments(user?.token);
    }
    const nextPlans = listOf(response, ["plans", "workouts", "assignments"]).map(normalizeWorkoutPlan);
    const nextAssignments = listOf(response, ["assignments", "members", "memberAssignments", "workoutAssignments"]);
    setPlans(nextPlans);
    setAssignments((current) => (nextAssignments.length ? nextAssignments : current));
    if (!selectedPlanId && nextPlans.length) setSelectedPlanId(idOf(nextPlans[0]));
  };

  const loadExercises = async () => {
    const response = await getExercises({ search: exerciseSearch || undefined, muscleGroup: muscleFilter || undefined }, user?.token);
    setExercises(listOf(response, ["exercises"]));
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

  const loadUserWorkouts = async (memberId) => {
    if (!memberId || isMember) {
      setUserWorkouts([]);
      return;
    }

    try {
      setUserWorkoutsLoading(true);
      const response = await getUserWorkouts(memberId, user?.token);
      setUserWorkouts(listOf(response, ["workouts", "assignments", "workoutAssignments", "plans"]));
    } catch (error) {
      setUserWorkouts([]);
      toast.error(getApiError(error, "Unable to load member workouts"));
    } finally {
      setUserWorkoutsLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;

    const loadInitial = async () => {
      try {
        setLoading(true);
        const results = await Promise.allSettled([loadPlans(), loadExercises(), loadUsers()]);
        const plansResult = results[0];
        if (plansResult.status === "rejected") throw plansResult.reason;
        const sideLoadError = results.slice(1).find((result) => result.status === "rejected");
        if (sideLoadError && isCurrent && !isMember) {
          toast.error(getApiError(sideLoadError.reason, "Some workout module data could not be loaded"));
        }
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
    if (!canManage || !exerciseForm.name.trim() || !exerciseForm.muscleGroup) {
      toast.error("Exercise name and muscle group are required");
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

    const payload = {
      userId: memberForm.memberId,
      startDate: toApiDate(memberForm.startDate),
      endDate: toApiDate(memberForm.endDate),
    };

    try {
      const response = await assignWorkoutToMember(selectedPlanId, payload, user?.token);
      const savedAssignment = response?.assignment || response?.data?.assignment || response?.data;
      const nextAssignment = savedAssignment && typeof savedAssignment === "object"
        ? savedAssignment
        : {
            ...payload,
            planId: selectedPlanId,
            memberId: memberForm.memberId,
            member: selectedMember,
            plan: selectedPlan,
          };
      setAssignments((current) => [nextAssignment, ...current.filter((assignment) => idOf(assignment) !== idOf(nextAssignment))]);
      await loadUserWorkouts(memberForm.memberId);
      setMemberForm((current) => ({ ...current, startDate: "", endDate: "" }));
      toast.success("Workout assigned to member");
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign workout"));
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
            detail="Plans, workout days, exercise configuration, trainer assignment, and member assignment."
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {[
              { key: "plans", label: "Plans" },
              { key: "days", label: "Days" },
              { key: "exercises", label: "Exercises" },
              { key: "assignments", label: "Assignments", hidden: isMember },
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
          { label: "Total Exercises", value: exercises.length || memberWorkoutExercisesCount, icon: Activity },
          { label: "Assigned Members", value: isMember ? plans.length : assignedMemberCount, icon: Users },
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
        <section className={canManage ? "grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]" : "space-y-4"}>
          {canManage && (
            <Card className="self-start p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-950">{editingPlanId ? "Edit Workout" : "Create Workout"}</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Add workout basics.</p>
                </div>
                <Plus size={18} className="mt-0.5 text-gray-400" />
              </div>
              <form onSubmit={savePlan} className="grid gap-2">
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
                            {!isMember && (
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
                          {!isMember && (
                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                              <button type="button" onClick={() => { setSelectedPlanId(planId); setActiveTab("days"); }} className="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                                View
                              </button>
                              {canEdit && (
                                <button type="button" onClick={() => editPlan(plan)} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                                  <Pencil size={14} />
                                  Edit
                                </button>
                              )}
                              {canManage && (
                                <button type="button" onClick={() => { setSelectedPlanId(planId); setActiveTab("assignments"); }} className="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                                  Assign Member
                                </button>
                              )}
                              {canDelete && (
                                <button type="button" onClick={() => void deleteWorkoutPlan(planId, user?.token).then(loadPlans).then(() => toast.success("Workout plan deleted")).catch((error) => toast.error(getApiError(error, "Unable to delete plan")))} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 transition hover:bg-red-50">
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
                  {loading ? "Loading workout plans..." : "No workout plans found."}
                </div>
              )}
            </div>
          </Card>
        </section>
      )}

      {activeTab === "days" && (
        <section className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
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

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-gray-500">Selected Plan</p>
                  <h3 className="mt-1 truncate text-base font-semibold text-gray-950">{selectedPlan?.name || selectedPlan?.title || "Choose a workout plan"}</h3>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="inline-flex h-8 items-center rounded-full bg-blue-50 px-3 text-blue-700">{days.length} days</span>
                  <span className="inline-flex h-8 items-center rounded-full bg-emerald-50 px-3 text-emerald-700">{countOf(dayExercises)} exercises</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {days.map((day) => {
                  const dayId = idOf(day);
                  const isSelected = selectedDayId === dayId;
                  return (
                    <div key={dayId} className={`flex min-w-[10.5rem] items-center gap-2 rounded-md border px-3 py-2 transition ${isSelected ? "border-blue-400 bg-blue-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                      <button type="button" onClick={() => setSelectedDayId(dayId)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-semibold text-gray-950">Day {day.dayNumber || "-"} - {day.title || day.name || "Untitled"}</span>
                        <span className="block text-xs text-gray-500">{countOf(day.exercises || day.workoutExercises)} exercises</span>
                      </button>
                      {canManage && (
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => editDay(day)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-blue-700 hover:bg-blue-100" aria-label="Edit workout day"><Pencil size={14} /></button>
                          {canDelete && (
                            <button type="button" onClick={() => void deleteWorkoutDay(dayId, user?.token).then(refreshSelectedPlan).then(() => toast.success("Workout day deleted")).catch((error) => toast.error(getApiError(error, "Unable to delete day")))} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-50" aria-label="Delete workout day">
                              <Trash size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!days.length && <p className="w-full rounded-md border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">No workout days found.</p>}
              </div>
            </div>

            <div className="p-4">
              <div className="grid gap-4">
                {canManage && (
                  <form onSubmit={saveConfig} className="grid gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-12 md:items-end">
                    <div className="md:col-span-12">
                      <p className="text-xs font-semibold uppercase text-gray-500">Assign Exercise</p>
                      <h3 className="mt-1 text-sm font-semibold text-gray-950">
                        {selectedDay ? `Day ${selectedDay.dayNumber || "-"} - ${selectedDay.title || selectedDay.name || "Untitled"}` : "Select a workout day"}
                      </h3>
                      {selectedDay?.notes && <p className="mt-1 text-sm text-gray-500">{selectedDay.notes}</p>}
                    </div>
                    <Field label="Exercise" className="md:col-span-4">
                      <select className={inputClass} value={configForm.exerciseId} onChange={(event) => setConfigForm({ ...configForm, exerciseId: event.target.value })}>
                        <option value="">Select exercise</option>
                        {exercises.map((exercise) => <option key={idOf(exercise)} value={idOf(exercise)}>{exercise.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Sets" className="md:col-span-2"><input className={inputClass} type="number" value={configForm.sets} onChange={(event) => setConfigForm({ ...configForm, sets: event.target.value })} /></Field>
                    <Field label="Reps" className="md:col-span-2"><input className={inputClass} type="number" value={configForm.reps} onChange={(event) => setConfigForm({ ...configForm, reps: event.target.value })} /></Field>
                    <Field label="Duration" className="md:col-span-2"><input className={inputClass} value={configForm.duration} onChange={(event) => setConfigForm({ ...configForm, duration: event.target.value })} placeholder="10 min" /></Field>
                    <Field label="Rest" className="md:col-span-2"><input className={inputClass} value={configForm.restTime} onChange={(event) => setConfigForm({ ...configForm, restTime: event.target.value })} placeholder="60 sec" /></Field>
                    <button type="submit" className={`${primaryButtonClass} md:col-span-12`} disabled={!selectedDayId}>{editingConfigId ? "Update Configuration" : "Assign Exercise"}</button>
                  </form>
                )}

                <div className="overflow-x-auto rounded-md border border-gray-200">
                  <table className="min-w-[36rem] w-full text-left text-sm">
                    <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="p-3">Exercise</th>
                        <th className="p-3 text-center">Sets</th>
                        <th className="p-3 text-center">Reps</th>
                        <th className="p-3 text-center">Duration</th>
                        <th className="p-3 text-center">Rest</th>
                        {canManage && <th className="p-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {dayExercises.map((item) => (
                        <tr key={idOf(item)} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-950">{item.exercise?.name || item.exerciseName || exercises.find((exercise) => idOf(exercise) === item.exerciseId)?.name || "-"}</td>
                          <td className="p-3 text-center">{metricValue(item.sets)}</td>
                          <td className="p-3 text-center">{metricValue(item.reps)}</td>
                          <td className="p-3 text-center">{metricValue(item.duration)}</td>
                          <td className="p-3 text-center">{metricValue(item.restTime)}</td>
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
                        <tr><td colSpan={canManage ? 6 : 5} className="p-8 text-center text-gray-500">No exercises configured for this day.</td></tr>
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
        <section className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
          {canManage && (
            <Card className="p-4">
              <SectionTitle icon={Activity} title={editingExerciseId ? "Edit Exercise" : "Create Exercise"} detail="Build the exercise library used by workout days." />
              <form onSubmit={saveExercise} className="mt-4 grid gap-3">
                <Field label="Exercise Name"><input className={inputClass} value={exerciseForm.name} onChange={(event) => setExerciseForm({ ...exerciseForm, name: event.target.value })} placeholder="Bench Press" /></Field>
                <Field label="Muscle Group">
                  <select className={inputClass} value={exerciseForm.muscleGroup} onChange={(event) => setExerciseForm({ ...exerciseForm, muscleGroup: event.target.value })}>
                    <option value="">Select muscle group</option>
                    {muscleGroupOptions.map((group) => (
                      <option key={group} value={group}>{titleCase(group)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Video URL"><input className={inputClass} value={exerciseForm.videoUrl} onChange={(event) => setExerciseForm({ ...exerciseForm, videoUrl: event.target.value })} placeholder="https://..." /></Field>
                <Field label="Calories"><input className={inputClass} type="number" value={exerciseForm.calories} onChange={(event) => setExerciseForm({ ...exerciseForm, calories: event.target.value })} /></Field>
                <Field label="Instructions"><textarea className={textareaClass} value={exerciseForm.instructions} onChange={(event) => setExerciseForm({ ...exerciseForm, instructions: event.target.value })} /></Field>
                <button type="submit" className={primaryButtonClass}>{editingExerciseId ? "Update Exercise" : <><Plus size={17} />Create Exercise</>}</button>
              </form>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Exercise Library</p>
                  <h3 className="mt-1 text-base font-semibold text-gray-950">{filteredExercises.length} of {exercises.length} exercises</h3>
                </div>
                {(exerciseSearch || muscleFilter) && (
                  <button type="button" className={buttonClass} onClick={() => { setExerciseSearch(""); setMuscleFilter(""); }}>
                    Clear Filters
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
                <div className="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <Search size={17} className="text-gray-400" />
                  <input className="min-w-0 flex-1 text-sm outline-none" value={exerciseSearch} onChange={(event) => setExerciseSearch(event.target.value)} placeholder="Search exercises..." />
                </div>
                <select className={inputClass} value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)}>
                  <option value="">All Muscle Groups</option>
                  {muscleGroups.map((muscle) => <option key={muscle} value={muscle}>{titleCase(muscle)}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-[32rem] w-full text-left text-xs">
                  <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="w-6 p-2"></th>
                      <th className="p-2">Exercise</th>
                      <th className="p-2 text-center">Group</th>
                      <th className="p-2 text-center">Cal</th>
                      <th className="p-2 text-center">Video</th>
                      {canManage && <th className="p-2 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredExercises.map((exercise) => {
                      const exerciseId = idOf(exercise);
                      const isExpanded = expandedExerciseId === exerciseId;
                      return (
                        <Fragment key={exerciseId}>
                          <tr key={exerciseId} className="hover:bg-gray-50">
                            <td className="p-2">
                              <button
                                type="button"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => setExpandedExerciseId(isExpanded ? "" : exerciseId)}
                                aria-label={isExpanded ? "Collapse exercise details" : "Expand exercise details"}
                              >
                                <ChevronDown size={14} className={`transition ${isExpanded ? "rotate-180" : ""}`} />
                              </button>
                            </td>
                            <td className="p-2">
                              <p className="max-w-40 truncate font-medium text-gray-950">{exercise.name || "Untitled"}</p>
                              <p className="truncate text-xs text-gray-400">{exercise.instructions ? exercise.instructions.slice(0, 30) : "-"}</p>
                            </td>
                            <td className="p-2 text-center">
                              <span className="inline-flex h-6 items-center rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-700">{metricValue(exercise.muscleGroup)}</span>
                            </td>
                            <td className="p-2 text-center text-xs font-medium text-gray-700">{metricValue(exercise.calories || exercise.caloriesBurned)}</td>
                            <td className="p-2 text-center">
                              <span className={`inline-flex h-6 items-center rounded-full px-1.5 text-xs font-medium ${exercise.videoUrl ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                                {exercise.videoUrl ? "Yes" : "No"}
                              </span>
                            </td>
                            {canManage && (
                              <td className="p-2">
                                <div className="flex justify-end gap-0.5">
                                  <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100" onClick={() => editExercise(exercise)} aria-label="Edit exercise"><Pencil size={14} /></button>
                                  {canDelete && <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50" onClick={() => void deleteExercise(exerciseId, user?.token).then(loadExercises).then(() => toast.success("Exercise deleted")).catch((error) => toast.error(getApiError(error, "Unable to delete exercise")))} aria-label="Delete exercise"><Trash size={14} /></button>}
                                </div>
                              </td>
                            )}
                          </tr>
                          {isExpanded && (
                            <tr key={`${exerciseId}-details`} className="bg-gray-50">
                              <td className="p-2"></td>
                              <td colSpan={canManage ? 5 : 4} className="p-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-gray-500">Instructions</p>
                                    <p className="mt-1 text-xs leading-5 text-gray-600 line-clamp-2">{exercise.instructions || "No instructions added."}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-gray-500">Video</p>
                                    <p className="mt-1 break-all text-xs leading-5 text-blue-600">{exercise.videoUrl ? <a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">View video</a> : "None"}</p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {!filteredExercises.length && (
                      <tr><td colSpan={canManage ? 6 : 5} className="p-4 text-center text-xs text-gray-500">No exercises found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </section>
      )}

      {activeTab === "assignments" && !isMember && (
        <section className="grid gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle icon={Users} title="Trainer Assignment" detail="Assign trainers to the selected workout plan." />
                <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-700">
                  {countOf(planTrainers.length ? planTrainers : selectedPlan?.trainers || selectedPlan?.trainerAssignments)} assigned
                </span>
              </div>
            </div>
            <div className="p-4">
              <form onSubmit={saveTrainerAssignment} className="grid gap-3 lg:grid-cols-2">
                <Field label="Workout Plan" className="lg:col-span-2"><select className={inputClass} value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>{plans.map((plan) => <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title}</option>)}</select></Field>
                <Field label="Trainer"><select className={inputClass} value={trainerForm.trainerId} onChange={(event) => setTrainerForm({ ...trainerForm, trainerId: event.target.value })}><option value="">Select trainer</option>{trainers.map((trainer) => <option key={idOf(trainer)} value={idOf(trainer)}>{nameOf(trainer)}</option>)}</select></Field>
                <Field label="Role"><select className={inputClass} value={trainerForm.role} onChange={(event) => setTrainerForm({ ...trainerForm, role: event.target.value })}>{trainerRoles.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></Field>
                <button type="submit" className={`${primaryButtonClass} lg:col-span-2`} disabled={!canManageAssignments}><UserPlus size={17} />Assign Trainer</button>
              </form>

              <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
                <div className="grid grid-cols-[minmax(0,1fr)_8rem] bg-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">
                  <span>Trainer</span>
                  <span className="text-right">Action</span>
                </div>
                <div className="divide-y divide-gray-100 bg-white">
                  {(planTrainers.length ? planTrainers : selectedPlan?.trainers || selectedPlan?.trainerAssignments || []).map((assignment) => (
                    <div key={idOf(assignment)} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 px-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-950">{assignment.trainer?.name || assignment.trainerName || nameOf(assignment)}</p>
                        <p className="mt-1 text-xs text-gray-500">{titleCase(assignment.role || "Assigned")}</p>
                      </div>
                      {canManageAssignments ? (
                        <button type="button" className="justify-self-end text-sm font-semibold text-red-600 hover:text-red-700" onClick={() => void removeWorkoutTrainerAssignment(selectedPlanId, assignment.trainerId || idOf(assignment.trainer) || idOf(assignment), user?.token).then(loadPlans).then(() => setPlanTrainers([]))}>Remove</button>
                      ) : (
                        <span className="justify-self-end text-xs text-gray-400">Locked</span>
                      )}
                    </div>
                  ))}
                  {!countOf(planTrainers.length ? planTrainers : selectedPlan?.trainers || selectedPlan?.trainerAssignments) && (
                    <div className="px-3 py-6 text-center text-sm text-gray-500">No trainers assigned to this plan.</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle icon={UserPlus} title="Member Assignment" detail="Assign workout plans with start and end dates." />
                <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
                  {displayedMemberWorkouts.length} assigned
                </span>
              </div>
            </div>
            <div className="p-4">
              <form onSubmit={saveMemberAssignment} className="grid gap-3 lg:grid-cols-2">
                <Field label="Workout Plan" className="lg:col-span-2"><select className={inputClass} value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>{plans.map((plan) => <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title}</option>)}</select></Field>
                <Field label="Member" className="lg:col-span-2">
                  <select
                    className={inputClass}
                    value={memberForm.memberId}
                    onChange={(event) => {
                      const memberId = event.target.value;
                      setMemberForm({ ...memberForm, memberId });
                      if (memberId) {
                        void loadUserWorkouts(memberId);
                      } else {
                        setUserWorkouts([]);
                      }
                    }}
                  >
                    <option value="">Select member</option>
                    {members.map((member) => <option key={idOf(member)} value={idOf(member)}>{nameOf(member)}</option>)}
                  </select>
                </Field>
                <Field label="Start Date"><input className={inputClass} type="date" value={memberForm.startDate} onChange={(event) => setMemberForm({ ...memberForm, startDate: event.target.value })} /></Field>
                <Field label="End Date"><input className={inputClass} type="date" value={memberForm.endDate} onChange={(event) => setMemberForm({ ...memberForm, endDate: event.target.value })} /></Field>
                <button type="submit" className={`${primaryButtonClass} lg:col-span-2`} disabled={!canManage}><UserPlus size={17} />Assign Workout</button>
              </form>

              <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
                <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] bg-gray-100 px-3 py-2 text-xs font-semibold uppercase text-gray-500">
                  <span>{memberForm.memberId ? "Workout Plan" : "Member"}</span>
                  <span className="text-center">Start</span>
                  <span className="text-center">End</span>
                </div>
                <div className="divide-y divide-gray-100 bg-white">
                  {displayedMemberWorkouts.map((assignment, index) => (
                    <div key={idOf(assignment) || `${assignmentMemberId(assignment) || assignmentPlanId(assignment) || "member-workout"}-${index}`} className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-3 px-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-950">{memberForm.memberId ? assignmentPlanName(assignment, selectedPlan?.name || selectedPlan?.title || "Workout plan") : assignmentMemberName(assignment)}</p>
                        <p className="mt-1 truncate text-xs text-gray-500">{memberForm.memberId ? selectedMember ? nameOf(selectedMember) : "Selected member" : assignmentPlanName(assignment, selectedPlan?.name || selectedPlan?.title || "Workout plan")}</p>
                      </div>
                      <span className="text-center text-xs font-medium text-gray-600">{displayDate(assignmentStartDate(assignment))}</span>
                      <span className="text-center text-xs font-medium text-gray-600">{displayDate(assignmentEndDate(assignment))}</span>
                    </div>
                  ))}
                  {userWorkoutsLoading && (
                    <div className="px-3 py-6 text-center text-sm text-gray-500">Loading member workouts...</div>
                  )}
                  {!userWorkoutsLoading && !displayedMemberWorkouts.length && (
                    <div className="px-3 py-6 text-center text-sm text-gray-500">{memberForm.memberId ? "No workouts assigned to this member." : "No members assigned yet."}</div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}


    </div>
  );
}
