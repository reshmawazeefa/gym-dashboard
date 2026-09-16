import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  MessageSquare,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getActiveSession,
  getApiError,
  getExercises,
  getMySessions,
  getMyWorkoutAssignments,
  getTenantUsers,
  getUserWorkouts,
  getWorkoutDays,
  getWorkoutPlans,
  getWorkoutSessionById,
  getWorkoutSessions,
  getWorkoutSets,
  startWorkoutSession,
  getWorkoutTrainers,
  getMyCalendar,
  unwrapList,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess, getStaffCategory, normalizeRole } from "../utils/rbac";
import WorkoutPlans from "./WorkoutPlans";
import WorkoutDays from "./WorkoutDays";
import WorkoutExercises from "./WorkoutExercises";
import WorkoutSessions from "./WorkoutSessions";
import WorkoutAssignments from "./WorkoutAssignments";
import WorkoutSchedules from "./WorkoutSchedules";
import WorkoutMeasurements from "./WorkoutMeasurements";
import WorkoutFeedback from "./WorkoutFeedback";
import WorkoutAnalytics from "./WorkoutAnalytics";
import WorkoutGoals from "./WorkoutGoals";

const goals = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_BURN"];
const difficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const muscleGroupOptions = ["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE", "FULL_BODY"];
const sessionStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const inputClass =
  "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const adminPlanGridClass = "lg:grid-cols-[2rem_minmax(12rem,1fr)_9rem_9rem_6rem_5rem]";
const lifecycleSteps = [
  {
    title: "Phase 1 — Build",
    detail: "Create exercises, workout plans, days, and add exercises to each day.",
    accent: "Build the structure",
  },
  {
    title: "Phase 2 — Assign",
    detail: "Send a workout plan to members with start dates, repeat schedules, and trainers.",
    accent: "Launch the program",
  },
  {
    title: "Phase 3 — Execute",
    detail: "Members start sessions, log sets, pause or resume, and finish workouts.",
    accent: "Capture training activity",
  },
  {
    title: "Phase 4 — Manage",
    detail: "Track progress with analytics, measurements, and trainer feedback.",
    accent: "Monitor progress",
  },
];

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

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }

function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }

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
    idOf(assignment?.assignment?.plan) ||
    idOf(assignment?.assignment?.workout) ||
    idOf(assignment?.assignment?.workoutPlan) ||
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

function planDays(plan) {
  return plan?.days || plan?.workoutDays || [];
}

function planExerciseCount(plan) {
  const explicitCount = Number(plan?.totalExercises || plan?.exerciseCount || 0);
  if (explicitCount) return explicitCount;
  return planDays(plan).reduce((total, day) => total + normalizeDayExerciseLinks(day).length, 0);
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

function calendarEvents(payload) {
  const source = payload?.data ?? payload?.calendar ?? payload;
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") return [];

  return Object.entries(source).flatMap(([date, items]) => {
    const events = Array.isArray(items) ? items : [items];
    return events.filter(Boolean).map((event) => ({
      ...event,
      date: event.date || event.scheduledDate || date,
    }));
  });
}

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
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
  const isReceptionist = role === "receptionist";
  const isWorkoutManager = role === "owner" || role === "admin" || role === "trainer";
  const canManage = !isMember && !isReceptionist && (isWorkoutManager || canAccess(user, "workouts", "create"));
  const canEdit = !isMember && !isReceptionist && (canManage || canAccess(user, "workouts", "edit") || canAccess(user, "workouts", "update"));
  const canManageAssignments = !isMember && !isReceptionist && (role === "owner" || role === "admin" || role === "trainer");
  const canDelete = !isMember && !isReceptionist && (canAccess(user, "workouts", "delete") || canAccess(user, "workouts", "remove"));
  const canAssign = !isMember && !isReceptionist && (canAccess(user, "workouts", "assign") || canManageAssignments || role === "trainer");
  const canSchedule = isMember || isReceptionist;
  const canSession = isMember || isReceptionist;
  const canViewProgress = isMember || isReceptionist;

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
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({ name: "", description: "", goal: goals[0], difficulty: difficulties[0], duration: "" });
  const [sessions, setSessions] = useState([]);
  const [setLogs, setSetLogs] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [sessionStatusFilter, setSessionStatusFilter] = useState("");
  const [sessionMemberSearch, setSessionMemberSearch] = useState("");
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [setLogsLoading, setSetLogsLoading] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionTotalPages, setSessionTotalPages] = useState(1);
  const [calendarData, setCalendarData] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());

  const selectedPlan = plans.find((plan) => idOf(plan) === selectedPlanId);
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
  const displayedMemberWorkouts = [];
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
  const scheduleDays = useMemo(() => {
    const seen = new Set();
    return [
      ...days.map((day) => ({ ...day, workoutPlan: selectedPlan })),
      ...plans.flatMap((plan) => planDays(plan).map((day) => ({ ...day, workoutPlan: plan }))),
    ].filter((day) => {
      const dayId = idOf(day);
      if (!dayId || seen.has(dayId)) return false;
      seen.add(dayId);
      return true;
    });
  }, [days, plans, selectedPlan]);

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
      response = isMember
        ? await getMyWorkoutAssignments(user?.token)
        : await getWorkoutPlans(params, user?.token);
    } catch (error) {
      throw error;
    }
    const nextPlans = listOf(response, ["plans", "workouts", "assignments"]).map(normalizeWorkoutPlan);
    const nextAssignments = listOf(response, ["assignments", "members", "memberAssignments", "workoutAssignments"]);
    setPlans(nextPlans);
    const nextDays = nextPlans.flatMap((plan) => planDays(plan));
    setDays(nextDays);
    setAssignments((current) => (nextAssignments.length ? nextAssignments : current));
    if (!selectedPlanId && nextPlans.length) setSelectedPlanId(idOf(nextPlans[0]));
    return nextPlans;
  };

  const loadExercises = async () => {
    try {
      const response = await getExercises({ search: exerciseSearch || undefined, muscleGroup: muscleFilter || undefined }, user?.token);
      const nextExercises = listOf(response, ["exercises"]);
      setExercises(nextExercises);
      return nextExercises;
    } catch (error) {
      setExercises([]);
      if (!isMember) {
        toast.error(getApiError(error, "Unable to load exercises"));
      }
      throw error;
    }
  };

  const loadUsers = async () => {
    if (isMember) return;
    const [memberResponse, trainerResponse] = await Promise.all([
      getTenantUsers("member", user?.token),
      getTenantUsers("trainer", user?.token),
    ]);
    const nextMembers = unwrapList(memberResponse);
    setMembers(nextMembers);
    setTrainers(unwrapList(trainerResponse));

    const assignmentResults = await Promise.allSettled(
      nextMembers.filter((member) => idOf(member)).map(async (member) => {
        const response = await getUserWorkouts(idOf(member), user?.token);
        return listOf(response, ["assignments", "workouts", "workoutAssignments", "plans"]).map((assignment) => ({
          ...assignment,
          userId: assignmentMemberId(assignment) || idOf(member),
          member: assignment?.member || member,
        }));
      })
    );
    setAssignments(assignmentResults
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value));
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

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      if (isMember) {
        const params = { page: sessionPage, limit: 20 };
        if (sessionStatusFilter) params.status = sessionStatusFilter;
        const response = await getMySessions(params, user?.token);
        const data = response?.data || response;
        setSessions(listOf(data, ["sessions", "workoutSessions", "data"]));
        setSessionTotalPages(data?.totalPages || data?.total_page || 1);
      } else {
        const params = {};
        if (sessionStatusFilter) params.status = sessionStatusFilter;
        if (sessionMemberSearch.trim()) params.memberSearch = sessionMemberSearch.trim();
        const response = await getWorkoutSessions(params, user?.token);
        setSessions(listOf(response, ["sessions", "workoutSessions"]));
      }
    } catch (error) {
      toast.error(getApiError(error, "Unable to load workout sessions"));
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadActiveSession = async () => {
    try {
      const response = await getActiveSession(user?.token);
      const data = response?.data || response;
      if (data?.id) {
        setActiveSession(data);
        setSelectedSessionId(data.id);
        setSetLogs(listOf(data, ["setLogs", "sets"]));
      }
    } catch {
      setActiveSession(null);
    }
  };

  const loadSetLogs = async (sessionId) => {
    if (!sessionId) {
      setSetLogs([]);
      return;
    }
    try {
      setSetLogsLoading(true);
      const response = await getWorkoutSets(sessionId, user?.token);
      setSetLogs(listOf(response, ["sets", "setLogs"]));
    } catch (error) {
      setSetLogs([]);
      toast.error(getApiError(error, "Unable to load set logs"));
    } finally {
      setSetLogsLoading(false);
    }
  };

  const refreshSelectedPlan = async () => {
    const refreshedPlans = await loadPlans();
    const nextDays = (refreshedPlans || plans).flatMap((plan) => planDays(plan));
    setDays(nextDays);
  };

  const handleMemberStartWorkout = async (workoutDayId) => {
    const assignment = selectedMemberAssignments[0];
    const response = await startWorkoutSession({
      workoutDayId,
      workoutPlanId: selectedPlanId,
      ...(idOf(assignment) && { assignmentId: idOf(assignment) }),
    }, user?.token);
    const startedSession = response?.data || response;
    setActiveSession(startedSession);
    setSelectedSessionId(idOf(startedSession));
    setActiveTab("sessions");
    await loadActiveSession();
  };

  const loadCalendar = async () => {
    setCalendarLoading(true);
    try {
      const response = await getMyCalendar({ month: calendarMonth, year: calendarYear }, user?.token);
      setCalendarData(calendarEvents(response));
    } catch (error) {
      toast.error(getApiError(error, "Unable to load calendar"));
      setCalendarData([]);
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    const loadInitial = async () => {
      try {
        setLoading(true);
        const initialLoads = [loadPlans(), loadExercises(), loadUsers()];
        const results = await Promise.allSettled(initialLoads);
        const plansResult = results[0];
        if (plansResult.status === "rejected") throw plansResult.reason;
        const sideLoadError = results.slice(1).find((result) => result.status === "rejected");
        if (sideLoadError && isCurrent && !isMember) {
          toast.error(getApiError(sideLoadError.reason, "Some workout module data could not be loaded"));
        }
        if (isCurrent && isMember) {
          void loadActiveSession();
        }
      } catch (error) {
        if (isCurrent) toast.error(getApiError(error, "Unable to load workout module"));
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    void loadInitial();
    return () => { isCurrent = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token, isMember]);

  useEffect(() => {
    if (activeTab !== "calendar") return;
    void loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, calendarMonth, calendarYear]);

  useEffect(() => {
    if (!canSession) return;
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatusFilter, sessionMemberSearch, sessionPage, canSession]);

  useEffect(() => {
    if (!canSession || String(activeSession?.status || "").toUpperCase() !== "IN_PROGRESS") return undefined;
    let isCurrent = true;

    const pollActiveSession = async () => {
      try {
        const response = await getActiveSession(user?.token);
        const data = response?.data || response;
        if (isCurrent) setActiveSession(data?.id ? data : null);
      } catch {
        // Keep the current session visible when a background poll fails.
      }
    };

    const interval = setInterval(pollActiveSession, 10000);
    return () => {
      isCurrent = false;
      clearInterval(interval);
    };
  }, [activeSession?.id, activeSession?.status, canSession, user?.token]);

  
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
    return () => { isCurrent = false; };
  }, [selectedPlanId, user?.token, isMember, selectedPlan?.trainers, selectedPlan?.trainerAssignments]);

  const tabs = [
    { key: "plans", label: isMember ? "My Workouts" : "Workout Plans" },
    { key: "days", label: isMember ? "Workout Details" : "Workout Days", hidden: !selectedPlanId },
    { key: "exercises", label: "Exercise Library", hidden: isMember || isReceptionist },
    { key: "assignments", label: "Assignments", hidden: isMember },
    { key: "sessions", label: "Sessions", hidden: !canSession },
    { key: "calendar", label: isMember ? "Schedule Calendar" : "Calendar", hidden: !isReceptionist && !isMember },
    { key: "schedules", label: "Schedules", hidden: !canSchedule },
    { key: "analytics", label: "Progress", hidden: !canViewProgress },
    { key: "measurements", label: "Measurements", hidden: !isMember },
    { key: "goals", label: "Goals", hidden: !isMember },
    { key: "feedback", label: "Trainer Feedback", hidden: !isWorkoutManager },
  ];

  const summaryCards = isMember
    ? [
        { label: "Today's Workout", value: activeSession ? "In progress" : plans[0]?.name || "No workout", icon: Dumbbell, hint: activeSession ? "Resume your active session" : "Next assigned workout" },
        { label: "This Week", value: sessions.filter((session) => session.status === "COMPLETED").length, icon: CalendarDays, hint: "Completed sessions" },
        { label: "Workout Streak", value: "-", icon: Activity, hint: "Keep training to build your streak" },
        { label: "Current Weight", value: "-", icon: BarChart3, hint: "Add a measurement" },
      ]
    : [
        { label: "Workout Plans", value: plans.length, icon: ClipboardList, hint: "Templates ready" },
        { label: "Exercises", value: exercises.length || memberWorkoutExercisesCount, icon: Activity, hint: "Library items" },
        { label: "Assigned Members", value: assignedMemberCount, icon: Users, hint: "Active recipients" },
        { label: "Trainers", value: assignedTrainerCount, icon: Dumbbell, hint: "Coaching coverage" },
      ];

  return (
    <div className="space-y-5">
      {/* <Card className="overflow-hidden border border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">Workout module</p>
            <h2 className="mt-2 text-2xl font-semibold">Build, assign, run, and track progress in one place</h2>
            <p className="mt-2 max-w-2xl text-sm text-blue-50">Manage workout plans, exercise libraries, member assignments, sessions, measurements, and analytics from a single streamlined experience.</p>
          </div>
          <div className="rounded-lg bg-white/15 px-4 py-3 text-sm backdrop-blur">
            <div className="font-semibold">Lifecycle</div>
            <div className="mt-1 text-blue-50">Build → Assign → Execute → Manage</div>
          </div>
        </div>
      </Card> */}

      {/* {!isMember && <section className="grid gap-3 lg:grid-cols-4">
        {lifecycleSteps.map((step, index) => (
          <Card key={step.title} className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
              {index + 1}. {step.title.split(" — ")[0]}
            </div>
            <h4 className="mt-2 text-sm font-semibold text-gray-950">{step.title}</h4>
            <p className="mt-2 text-sm text-gray-600">{step.detail}</p>
            <p className="mt-3 text-xs font-semibold text-gray-500">{step.accent}</p>
          </Card>
        ))}
      </section>} */}

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {tabs
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
          {canManage && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingPlanId("");
                  setPlanForm({ name: "", description: "", goal: goals[0], difficulty: difficulties[0], duration: "" });
                  setShowCreatePlanModal(true);
                }}
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Add workout
              </button>
            </div>
          )}
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="p-4">
            <card.icon size={20} className="text-blue-600" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="mt-1 text-xs text-gray-400">{card.hint}</p>
              </div>
              <p className="max-w-[10rem] text-right text-2xl font-bold text-gray-950">{card.value}</p>
            </div>
          </Card>
        ))}
      </section>

      {isMember && (
        <Card className="overflow-hidden border-l-4 border-l-blue-600">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Today's Workout</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                {activeSession?.workoutDay?.title || activeSession?.workoutPlan?.name || plans[0]?.name || "No workout scheduled"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {activeSession ? "Your workout is in progress. Continue logging your sets." : "Open your assigned plan to review the next workout."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeSession ? (
                <button type="button" className={primaryButtonClass} onClick={() => setActiveTab("sessions")}>
                  Resume Workout
                </button>
              ) : plans[0] ? (
                <button type="button" className={primaryButtonClass} onClick={() => { setSelectedPlanId(idOf(plans[0])); setActiveTab("days"); }}>
                  View Workout
                </button>
              ) : null}
              <button type="button" className={buttonClass} onClick={() => setActiveTab("schedules")}>
                View Schedule
              </button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === "plans" && (
        <WorkoutPlans
          user={user}
          role={role}
          canManage={canManage}
          canEdit={canEdit}
          canDelete={canDelete}
          canAssign={canAssign}
          canManageAssignments={canManageAssignments}
          plans={plans}
          setPlans={setPlans}
          loading={loading}
          planSearch={planSearch}
          setPlanSearch={setPlanSearch}
          goalFilter={goalFilter}
          setGoalFilter={setGoalFilter}
          difficultyFilter={difficultyFilter}
          setDifficultyFilter={setDifficultyFilter}
          selectedPlanId={selectedPlanId}
          setSelectedPlanId={setSelectedPlanId}
          expandedPlanId={expandedPlanId}
          setExpandedPlanId={setExpandedPlanId}
          editingPlanId={editingPlanId}
          setEditingPlanId={setEditingPlanId}
          planForm={planForm}
          setPlanForm={setPlanForm}
          filteredPlans={filteredPlans}
          assignedMemberCount={assignedMemberCount}
          memberWorkoutDaysCount={memberWorkoutDaysCount}
          memberWorkoutExercisesCount={memberWorkoutExercisesCount}
          loadPlans={loadPlans}
          refreshAssignments={loadUsers}
          refreshSelectedPlan={refreshSelectedPlan}
          selectedPlan={selectedPlan}
          planTrainers={planTrainers}
          members={members}
          exercises={exercises}
          setActiveTab={setActiveTab}
          showCreatePlanModal={showCreatePlanModal}
          setShowCreatePlanModal={setShowCreatePlanModal}
        />
      )}

      {activeTab === "days" && (
        <WorkoutDays
          user={user}
          role={role}
          canManage={canManage}
          canEdit={canEdit}
          canDelete={canDelete}
          selectedPlan={selectedPlan}
          selectedPlanId={selectedPlanId}
          days={days}
          setDays={setDays}
          selectedDayId={selectedDayId}
          setSelectedDayId={setSelectedDayId}
          activeSession={activeSession}
          assignmentId={idOf(selectedMemberAssignments[0])}
          onStartWorkout={handleMemberStartWorkout}
          onResumeWorkout={() => setActiveTab("sessions")}
          exercises={exercises}
          refreshSelectedPlan={refreshSelectedPlan}
        />
      )}

      {activeTab === "exercises" && (
        <WorkoutExercises
          user={user}
          role={role}
          canManage={canManage}
          canEdit={canEdit}
          canDelete={canDelete}
          exercises={exercises}
          setExercises={setExercises}
          exerciseSearch={exerciseSearch}
          setExerciseSearch={setExerciseSearch}
          muscleFilter={muscleFilter}
          setMuscleFilter={setMuscleFilter}
          filteredExercises={filteredExercises}
          loadExercises={loadExercises}
        />
      )}

      {activeTab === "sessions" && (
        <WorkoutSessions
          user={user}
          role={role}
          canManage={canManage}
          members={members}
          trainers={trainers}
          sessions={sessions}
          setSessions={setSessions}
          activeSession={activeSession}
          setActiveSession={setActiveSession}
          selectedSessionId={selectedSessionId}
          setSelectedSessionId={setSelectedSessionId}
          setLogs={setLogs}
          setSetLogs={setSetLogs}
          sessionStatusFilter={sessionStatusFilter}
          setSessionStatusFilter={setSessionStatusFilter}
          sessionMemberSearch={sessionMemberSearch}
          setSessionMemberSearch={setSessionMemberSearch}
          sessionsLoading={sessionsLoading}
          setSessionsLoading={setSessionsLoading}
          setLogsLoading={setLogsLoading}
          setSetLogsLoading={setSetLogsLoading}
          sessionPage={sessionPage}
          setSessionPage={setSessionPage}
          sessionTotalPages={sessionTotalPages}
          setSessionTotalPages={setSessionTotalPages}
          loadSessions={loadSessions}
          loadActiveSession={loadActiveSession}
          loadSetLogs={loadSetLogs}
        />
      )}

      {activeTab === "assignments" && !isMember && (
        <WorkoutAssignments
          user={user}
          role={role}
          canManage={canManage}
          canEdit={canEdit}
          canDelete={canDelete}
          canAssign={canAssign}
          canManageAssignments={canManageAssignments}
          plans={plans}
          selectedPlan={selectedPlan}
          selectedPlanId={selectedPlanId}
          members={members}
          trainers={trainers}
          assignments={assignments}
          setAssignments={setAssignments}
          planTrainers={planTrainers}
          setPlanTrainers={setPlanTrainers}
          loadPlans={loadPlans}
          refreshSelectedPlan={refreshSelectedPlan}
        />
      )}

      {activeTab === "schedules" && (
        <WorkoutSchedules
          user={user}
          role={role}
          canSchedule={canSchedule}
          canSession={canSession}
          workoutDays={scheduleDays}
          onSessionStarted={() => { setActiveTab("sessions"); void loadActiveSession(); }}
        />
      )}

      {activeTab === "analytics" && canViewProgress && (
        <WorkoutAnalytics user={user} />
      )}

      {activeTab === "feedback" && isWorkoutManager && (
        <WorkoutFeedback user={user} role={role} canManage={canManage} members={members} />
      )}

      {activeTab === "measurements" && isMember && (
        <WorkoutMeasurements user={user} />
      )}

      {activeTab === "calendar" && (
        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-950">Workout Calendar</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">View your scheduled workouts and sessions.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className={inputClass}
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(Number(e.target.value))}
              >
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className={inputClass}
                value={calendarYear}
                onChange={(e) => setCalendarYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="button" onClick={loadCalendar} className={primaryButtonClass} disabled={calendarLoading}>
                {calendarLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {calendarLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="px-2 py-3 border-r border-gray-100 last:border-r-0">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: new Date(calendarYear, calendarMonth - 1, 1).getDay() }, (_, idx) => (
                  <div key={`empty-start-${idx}`} className="min-h-28 border-r border-b border-gray-100 bg-gray-50" />
                ))}
                {Array.from({ length: new Date(calendarYear, calendarMonth, 0).getDate() }, (_, idx) => {
                  const day = idx + 1;
                  const dateKey = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = calendarData.filter((event) => {
                    const schedule = event.schedule || event.workoutSchedule || event;
                    const eventDate = event.date || schedule.scheduledDate || schedule.date || event.sessionDate || "";
                    return eventDate && String(eventDate).slice(0, 10) === dateKey;
                  });
                  return (
                    <div key={dateKey} className="min-h-28 border-r border-b border-gray-100 p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">{day}</span>
                        {dayEvents.length > 0 && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{dayEvents.length}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((event, idx) => {
                          const schedule = event.schedule || event.workoutSchedule || event;
                          const plan = event.workoutPlan || event.workout || event.plan || schedule.workoutPlan || schedule.workout || schedule.plan || {};
                          const eventTitle = event.title || schedule.title || event.workoutName || event.planName || plan.name || plan.title || event.name || "Workout";
                          const eventType = event.type || event.eventType || event.status || "";
                          const eventTime = event.time || schedule.scheduledTime || event.startTime || "";
                          return (
                            <div key={idOf(event) || `${dateKey}-${idx}`} className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-800 shadow-sm">
                              <div className="truncate">{eventTitle}</div>
                              {eventType && <span className="text-[10px] text-blue-700">{titleCase(eventType)}</span>}
                              {eventTime && <span className="ml-1 text-[10px] text-blue-700">{eventTime}</span>}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] font-semibold text-gray-500">+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {calendarData.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
                  <CalendarDays size={32} className="mb-2 text-gray-300" />
                  <p>No workout events for this month. Click "Load" to fetch data.</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

    </div>
  );
}
