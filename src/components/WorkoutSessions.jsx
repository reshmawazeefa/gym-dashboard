import { Fragment, useEffect, useState, useRef } from "react";
import { ChevronDown, Pause, Play, Plus, Search, StopCircle, Trash, Clock, Target, Activity, ArrowRightLeft } from "lucide-react";
import toast from "react-hot-toast";
import StatusBadge from "./StatusBadge";
import {
  startWorkoutSession, getWorkoutSessionById, completeWorkoutSession, updateWorkoutSession, deleteWorkoutSession,
  getMySessions, getUserSessions, getWorkoutSets, logWorkoutSet, bulkLogSets, updateWorkoutSet, deleteWorkoutSet,
  pauseSession, resumeSession, substituteSessionExercise, getSessionSwaps, getApiError
} from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

const sessionStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const setTypeOptions = ["WARMUP", "WORKING", "DROP_SET", "FAILURE", "REST_PAUSE", "CARDIO"];
const rpeOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={`grid gap-1 text-xs font-semibold uppercase text-gray-500 ${className}`}>{label}{children}</label>;
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function computeDuration(startTime, endTime) {
  if (!startTime) return "-";
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return "-";
  const diff = Math.floor((end - start) / 1000);
  return formatElapsed(diff);
}

function emptySetForm() {
  return { workoutExerciseId: "", setNumber: "", setType: "WORKING", weight: "", actualReps: "", duration: "", rpe: "", notes: "" };
}

export default function WorkoutSessions(props) {
  const {
    user, role, canManage, members, trainers, sessions, setSessions,
    activeSession, setActiveSession, selectedSessionId, setSelectedSessionId,
    setLogs, setSetLogs, sessionStatusFilter, setSessionStatusFilter,
    sessionMemberSearch, setSessionMemberSearch,
    sessionsLoading, setSessionsLoading, setLogsLoading, setSetLogsLoading,
    sessionPage, setSessionPage, sessionTotalPages, setSessionTotalPages,
    loadSessions, loadActiveSession, loadSetLogs,
  } = props;

  const [startForm, setStartForm] = useState({ workoutPlanId: "", workoutDayId: "", assignmentId: "", notes: "" });
  const [endForm, setEndForm] = useState({ show: false, energyLevel: 5, mood: 5, notes: "" });
  const [setForm, setSetForm] = useState(emptySetForm());
  const [bulkSets, setBulkSets] = useState({ show: false, data: "" });
  const [editingSetId, setEditingSetId] = useState(null);
  const [editSetForm, setEditSetForm] = useState({});
  const [sessionExercises, setSessionExercises] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loggingSet, setLoggingSet] = useState(false);
  const [bulkLogging, setBulkLogging] = useState(false);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [sessionSwaps, setSessionSwaps] = useState([]);
  const [swapExerciseId, setSwapExerciseId] = useState("");
  const [swapOriginalExerciseId, setSwapOriginalExerciseId] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [showSwapForm, setShowSwapForm] = useState(false);
  const [completedExerciseIds, setCompletedExerciseIds] = useState(() => new Set());
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);

  useEffect(() => {
    if (!activeSession?.startTime) return undefined;

    const start = new Date(activeSession.startTime).getTime();
    const isPaused = String(activeSession.status || "").toUpperCase() === "PAUSED";
    const pauseTime = activeSession.pausedAt ? new Date(activeSession.pausedAt).getTime() : Date.now();
    const totalPausedSeconds = Number(activeSession.totalPausedSeconds || activeSession.pausedDuration || 0);
    const updateTimer = () => {
      const end = isPaused ? pauseTime : Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((end - start) / 1000) - totalPausedSeconds));
    };

    updateTimer();
    if (!isPaused) timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeSession?.startTime, activeSession?.status, activeSession?.pausedAt, activeSession?.totalPausedSeconds, activeSession?.pausedDuration]);

  useEffect(() => {
    if (!restRunning || restSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setRestSeconds((seconds) => {
        if (seconds <= 1) {
          setRestRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [restRunning, restSeconds]);

  useEffect(() => {
    loadActiveSession();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadExercisesForSession(selectedSessionId);
    }
  }, [selectedSessionId, sessions, activeSession]);

  const loadExercisesForSession = async (sessionId) => {
    if (!sessionId) {
      setSessionExercises([]);
      return;
    }

    setLoadingExercises(true);
    try {
      const sessionData = sessions.find((s) => idOf(s) === sessionId) || activeSession;
      let exercises = [];

      if (sessionData?.workoutDay?.exercises) {
        exercises = sessionData.workoutDay.exercises;
      } else {
        const response = await getWorkoutSessionById(sessionId, user?.token);
        const sessionDetail = response?.data || response;
        exercises = sessionDetail?.workoutDay?.exercises || [];
        if (sessionDetail?.setLogs) {
          setSetLogs(sessionDetail.setLogs);
        }
      }

      setSessionExercises(exercises);
    } catch {
      setSessionExercises([]);
    } finally {
      setLoadingExercises(false);
    }
  };

  const handleStartSession = async (event) => {
    event.preventDefault();
    setStarting(true);
    try {
      const payload = {
        ...(startForm.workoutPlanId && { workoutPlanId: startForm.workoutPlanId }),
        ...(startForm.workoutDayId && { workoutDayId: startForm.workoutDayId }),
        ...(startForm.assignmentId && { assignmentId: startForm.assignmentId }),
        ...(startForm.notes && { notes: startForm.notes }),
      };
      await startWorkoutSession(payload, user?.token);
      toast.success("Workout session started");
      setStartForm({ workoutPlanId: "", workoutDayId: "", assignmentId: "", notes: "" });
      await Promise.all([loadActiveSession(), loadSessions()]);
    } catch (error) {
      toast.error(getApiError(error, "Unable to start session"));
    } finally {
      setStarting(false);
    }
  };

  const handleEndSession = async (event) => {
    event.preventDefault();
    const sessionId = idOf(activeSession);
    if (!sessionId) return;
    setCompleting(true);
    try {
      await completeWorkoutSession(sessionId, {
        energyLevel: Number(endForm.energyLevel),
        mood: Number(endForm.mood),
        ...(endForm.notes && { notes: endForm.notes }),
      }, user?.token);
      toast.success("Session completed");
      setEndForm({ show: false, energyLevel: 5, mood: 5, notes: "" });
      await Promise.all([loadActiveSession(), loadSessions()]);
    } catch (error) {
      toast.error(getApiError(error, "Unable to complete session"));
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelSession = async () => {
    const sessionId = idOf(activeSession);
    if (!sessionId) return;
    if (!window.confirm("Cancel this workout session?")) return;
    try {
      await updateWorkoutSession(sessionId, { status: "CANCELLED" }, user?.token);
      toast.success("Session cancelled");
      await Promise.all([loadActiveSession(), loadSessions()]);
    } catch (error) {
      toast.error(getApiError(error, "Unable to cancel session"));
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Delete this workout session permanently?")) return;
    try {
      await deleteWorkoutSession(sessionId, user?.token);
      toast.success("Session deleted");
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setLogs([]);
        setSetLogs([]);
      }
      await loadSessions();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete session"));
    }
  };

  const handlePauseSession = async () => {
    const sessionId = idOf(activeSession);
    if (!sessionId) return;
    setPausing(true);
    try {
      const response = await pauseSession(sessionId, user?.token);
      const pausedSession = response?.data || response;
      toast.success("Session paused");
      setActiveSession((current) => current ? {
        ...current,
        ...(pausedSession && typeof pausedSession === "object" ? pausedSession : {}),
        status: "PAUSED",
        pausedAt: pausedSession?.pausedAt || current.pausedAt || new Date().toISOString(),
      } : current);
    } catch (error) {
      toast.error(getApiError(error, "Unable to pause session"));
    } finally {
      setPausing(false);
    }
  };

  const handleResumeSession = async () => {
    const sessionId = idOf(activeSession);
    if (!sessionId) return;
    setResuming(true);
    try {
      const response = await resumeSession(sessionId, user?.token);
      const resumedSession = response?.data || response;
      toast.success("Session resumed");
      setActiveSession((current) => current ? {
        ...current,
        ...(resumedSession && typeof resumedSession === "object" ? resumedSession : {}),
        status: "IN_PROGRESS",
      } : current);
    } catch (error) {
      toast.error(getApiError(error, "Unable to resume session"));
    } finally {
      setResuming(false);
    }
  };

  const loadSessionSwaps = async (sessionId) => {
    if (!sessionId) return;
    try {
      const response = await getSessionSwaps(sessionId, user?.token);
      const list = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.swaps) ? response.swaps : [];
      setSessionSwaps(list);
    } catch {
      setSessionSwaps([]);
    }
  };

  const handleSwapExercise = async () => {
    const sessionId = idOf(activeSession) || selectedSessionId;
    if (!sessionId || !swapOriginalExerciseId || !swapExerciseId) {
      toast.error("Select original and replacement exercises");
      return;
    }
    try {
      await substituteSessionExercise(sessionId, swapOriginalExerciseId, {
        substituteExerciseId: swapExerciseId,
        ...(swapReason && { reason: swapReason }),
      }, user?.token);
      toast.success("Exercise swapped");
      setShowSwapForm(false);
      setSwapOriginalExerciseId("");
      setSwapExerciseId("");
      setSwapReason("");
      await loadSessionSwaps(sessionId);
      loadSetLogs(sessionId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to swap exercise"));
    }
  };

  const handleSelectSession = (sessionId) => {
    setSelectedSessionId(sessionId);
    setSetLogsLoading(true);
    loadSetLogs(sessionId);
  };

  const handleLogSet = async (event) => {
    event.preventDefault();
    if (!selectedSessionId) {
      toast.error("No session selected");
      return;
    }
    if (!setForm.workoutExerciseId || !setForm.setNumber) {
      toast.error("Workout exercise and set number are required");
      return;
    }
    const workoutExercise = sessionExercises.find((ex) => idOf(ex) === setForm.workoutExerciseId);
    const exerciseId = workoutExercise?.exercise?.id || workoutExercise?.exercise?._id || workoutExercise?.exerciseId || workoutExercise?.exercise?.exerciseId;
    if (!exerciseId) {
      toast.error("Unable to determine exercise id for this workout exercise");
      return;
    }
    setLoggingSet(true);
    try {
      await logWorkoutSet(selectedSessionId, {
        workoutExerciseId: setForm.workoutExerciseId,
        exerciseId,
        setNumber: Number(setForm.setNumber),
        setType: setForm.setType,
        ...(setForm.weight !== "" && { weight: Number(setForm.weight) }),
        ...(setForm.actualReps !== "" && { actualReps: Number(setForm.actualReps) }),
        ...(setForm.duration !== "" && { duration: Number(setForm.duration) }),
        ...(setForm.rpe !== "" && { rpe: Number(setForm.rpe) }),
        ...(setForm.notes && { notes: setForm.notes }),
      }, user?.token);
      toast.success("Set logged");
      setSetForm(emptySetForm());
      setRestSeconds(90);
      setRestRunning(true);
      loadSetLogs(selectedSessionId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to log set"));
    } finally {
      setLoggingSet(false);
    }
  };

  const handleBulkLogSets = async (event) => {
    event.preventDefault();
    if (!selectedSessionId) {
      toast.error("No session selected");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(bulkSets.data);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
    } catch {
      toast.error("Enter valid JSON array of sets");
      return;
    }
    if (!parsed.length) {
      toast.error("At least one set is required");
      return;
    }
    setBulkLogging(true);
    try {
      await bulkLogSets(selectedSessionId, { sets: parsed }, user?.token);
      toast.success(`${parsed.length} set(s) logged`);
      setBulkSets({ show: false, data: "" });
      loadSetLogs(selectedSessionId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to bulk log sets"));
    } finally {
      setBulkLogging(false);
    }
  };

  const handleEditSet = async (setId) => {
    if (!editingSetId) return;
    try {
      const payload = {};
      if (editSetForm.weight !== undefined && editSetForm.weight !== "") payload.weight = Number(editSetForm.weight);
      if (editSetForm.actualReps !== undefined && editSetForm.actualReps !== "") payload.actualReps = Number(editSetForm.actualReps);
      if (editSetForm.duration !== undefined && editSetForm.duration !== "") payload.duration = Number(editSetForm.duration);
      if (editSetForm.rpe !== undefined && editSetForm.rpe !== "") payload.rpe = Number(editSetForm.rpe);
      if (editSetForm.setType !== undefined) payload.setType = editSetForm.setType;
      if (editSetForm.notes !== undefined) payload.notes = editSetForm.notes;
      if (!Object.keys(payload).length) {
        setEditingSetId(null);
        return;
      }
      await updateWorkoutSet(setId, payload, user?.token);
      toast.success("Set updated");
      setEditingSetId(null);
      setEditSetForm({});
      loadSetLogs(selectedSessionId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to update set"));
    }
  };

  const handleDeleteSet = async (setId) => {
    if (!window.confirm("Delete this set?")) return;
    try {
      await deleteWorkoutSet(setId, user?.token);
      toast.success("Set deleted");
      loadSetLogs(selectedSessionId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete set"));
    }
  };

  const startEditSet = (setItem) => {
    setEditingSetId(idOf(setItem));
    setEditSetForm({
      setType: setItem.setType || "WORKING",
      weight: setItem.weight ?? "",
      actualReps: setItem.actualReps ?? "",
      duration: setItem.duration ?? "",
      rpe: setItem.rpe ?? "",
      notes: setItem.notes || "",
    });
  };

  const cancelEditSet = () => {
    setEditingSetId(null);
    setEditSetForm({});
  };

  const handleStatusFilterChange = (value) => {
    setSessionStatusFilter(value);
    setSessionPage(1);
  };

  const handleMemberSearchChange = (value) => {
    setSessionMemberSearch(value);
    setSessionPage(1);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > sessionTotalPages) return;
    setSessionPage(page);
  };

  const activeExerciseList = sessionExercises.length
    ? sessionExercises
    : (activeSession?.workoutDay?.exercises || []);
  const loggedExerciseIds = new Set((Array.isArray(setLogs) ? setLogs : []).map((item) => item.workoutExerciseId || item.workoutExercise?.id));
  const currentExerciseIndex = Math.min(
    activeExerciseList.findIndex((exercise) => !completedExerciseIds.has(idOf(exercise)) && !loggedExerciseIds.has(idOf(exercise))) >= 0
      ? activeExerciseList.findIndex((exercise) => !completedExerciseIds.has(idOf(exercise)) && !loggedExerciseIds.has(idOf(exercise)))
      : Math.max(activeExerciseList.length - 1, 0),
    Math.max(activeExerciseList.length - 1, 0)
  );
  const currentExercise = activeExerciseList[currentExerciseIndex];
  const currentExerciseId = idOf(currentExercise);
  const currentExerciseLogs = (Array.isArray(setLogs) ? setLogs : []).filter(
    (item) => String(item.workoutExerciseId || item.workoutExercise?.id || "") === String(currentExerciseId)
  );
  const previousBest = currentExercise?.previousBest || currentExercise?.personalBest || currentExerciseLogs
    .filter((item) => item.weight !== null && item.weight !== undefined)
    .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))[0];
  const formatRest = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const pages = [];
  for (let i = 1; i <= sessionTotalPages; i++) {
    pages.push(i);
  }

  return (
    <section className="space-y-4">
      {activeSession ? (
        <Card className="overflow-hidden border-l-4 border-l-green-500">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-green-50 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-green-700">
                <Activity size={20} />
                <span className="text-lg font-bold tabular-nums">{formatElapsed(elapsedSeconds)}</span>
              </div>
              <div className="text-sm text-green-800">
                <p className="font-semibold">Session Active</p>
                <p className="text-green-600">ID: {idOf(activeSession)}</p>
                <p className="text-green-600">Started: {displayDate(activeSession.startTime)} {activeSession.startTime ? new Date(activeSession.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeSession.status === "PAUSED" ? (
                <button type="button" onClick={handleResumeSession} disabled={resuming} className="inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700">
                  <Play size={16} />
                  {resuming ? "Resuming..." : "Resume"}
                </button>
              ) : (
                <button type="button" onClick={handlePauseSession} disabled={pausing} className="inline-flex h-9 items-center gap-2 rounded-lg bg-yellow-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-yellow-600">
                  <Pause size={16} />
                  {pausing ? "Pausing..." : "Pause"}
                </button>
              )}
              <button type="button" onClick={() => setEndForm({ ...endForm, show: true })} className="inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700">
                <StopCircle size={16} />
                End Session
              </button>
              <button type="button" onClick={handleCancelSession} className={buttonClass}>
                Cancel Session
              </button>
            </div>
          </div>
          {endForm.show && (
            <form onSubmit={handleEndSession} className="grid gap-3 border-t border-green-200 bg-green-50/50 p-4 sm:grid-cols-3">
              <Field label="Energy Level (1-10)">
                <select className={inputClass} value={endForm.energyLevel} onChange={(e) => setEndForm({ ...endForm, energyLevel: e.target.value })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Mood (1-10)">
                <select className={inputClass} value={endForm.mood} onChange={(e) => setEndForm({ ...endForm, mood: e.target.value })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <textarea className="min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={endForm.notes} onChange={(e) => setEndForm({ ...endForm, notes: e.target.value })} placeholder="Session feedback" />
              </Field>
              <div className="flex items-end gap-2 sm:col-span-3">
                <button type="submit" className={primaryButtonClass} disabled={completing}>
                  {completing ? "Completing..." : "Complete Session"}
                </button>
                <button type="button" onClick={() => setEndForm({ ...endForm, show: false })} className={buttonClass}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {role === "member" && currentExercise && (
            <div className="border-t border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <button type="button" className="rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-900" onClick={() => setSelectedSessionId(null)}>
                    &larr; {activeSession?.workoutDay?.title || "Workout"}
                  </button>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Workout Timer</p>
                  <p className="text-3xl font-bold tabular-nums text-gray-950">{formatElapsed(elapsedSeconds)}</p>
                </div>
                <div className="text-right text-sm text-gray-600">
                  <p>Exercise <strong>{currentExerciseIndex + 1} of {activeExerciseList.length}</strong></p>
                  <p className="mt-1">{activeSession?.workoutDay?.title || activeSession?.workoutPlan?.name || "Active workout"}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <h3 className="text-xl font-bold uppercase text-gray-950">{nameOf(currentExercise.exercise || currentExercise)}</h3>
                  <p className="mt-1 text-sm text-gray-500">{currentExercise.exercise?.muscleGroup || currentExercise.muscleGroup || "-"}</p>
                  <div className="mt-4 flex flex-wrap gap-6 text-sm">
                    <div><p className="text-xs font-semibold uppercase text-gray-500">Target</p><p className="mt-1 font-semibold text-gray-900">{currentExercise.sets || "-"} x {currentExercise.reps || "-"}</p></div>
                    <div><p className="text-xs font-semibold uppercase text-gray-500">Previous Best</p><p className="mt-1 font-semibold text-gray-900">{previousBest ? `${previousBest.weight ?? "-"} kg x ${previousBest.actualReps ?? previousBest.reps ?? "-"}` : "-"}</p></div>
                    {currentExercise.restTime && <div><p className="text-xs font-semibold uppercase text-gray-500">Rest</p><p className="mt-1 font-semibold text-gray-900">{currentExercise.restTime}s</p></div>}
                  </div>
                </div>
                <div className="min-w-40 rounded-md border border-blue-100 bg-white p-3 text-center">
                  <p className="text-xs font-semibold uppercase text-gray-500">Rest Timer</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700">{formatRest(restSeconds)}</p>
                  <div className="mt-2 flex justify-center gap-2">
                    <button type="button" className={buttonClass} onClick={() => { setRestSeconds(90); setRestRunning(true); }}>
                      {restRunning ? "Reset" : "Start"}
                    </button>
                    {restRunning && <button type="button" className={buttonClass} onClick={() => setRestRunning(false)}>Pause</button>}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Set</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Kg</th><th className="px-3 py-2">Reps</th><th className="px-3 py-2">RPE</th></tr></thead>
                  <tbody>
                    {currentExerciseLogs.map((item, index) => <tr key={idOf(item) || index} className="border-t border-gray-100"><td className="px-3 py-2">{item.setNumber || index + 1}</td><td className="px-3 py-2">{titleCase(item.setType || "WORKING")}</td><td className="px-3 py-2">{item.weight ?? "-"}</td><td className="px-3 py-2">{item.actualReps ?? item.reps ?? "-"}</td><td className="px-3 py-2">{item.rpe ?? "-"}</td></tr>)}
                    {Array.from({ length: Math.max(0, Number(currentExercise.sets || 0) - currentExerciseLogs.length) }).map((_, index) => <tr key={`pending-${index}`} className="border-t border-gray-100 text-gray-400"><td className="px-3 py-2">{currentExerciseLogs.length + index + 1}</td><td className="px-3 py-2">Working</td><td className="px-3 py-2">-</td><td className="px-3 py-2">-</td><td className="px-3 py-2">-</td></tr>)}
                  </tbody>
                </table>
              </div>
              <button type="button" className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={() => setCompletedExerciseIds((current) => new Set([...current, currentExerciseId]))}>
                {completedExerciseIds.has(currentExerciseId) ? "Exercise Completed" : "Complete Exercise"}
              </button>
            </div>
          )}
        </Card>
      ) : canManage && (
        <Card className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-950">Start Workout Session</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">Start a fresh session and log your progress as you work out.</p>
            </div>
            <Play size={18} className="mt-0.5 text-gray-400" />
          </div>
          <form onSubmit={handleStartSession} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Workout Plan ID">
              <input className={inputClass} value={startForm.workoutPlanId} onChange={(e) => setStartForm({ ...startForm, workoutPlanId: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="Workout Day ID">
              <input className={inputClass} value={startForm.workoutDayId} onChange={(e) => setStartForm({ ...startForm, workoutDayId: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="Assignment ID">
              <input className={inputClass} value={startForm.assignmentId} onChange={(e) => setStartForm({ ...startForm, assignmentId: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="Notes">
              <input className={inputClass} value={startForm.notes} onChange={(e) => setStartForm({ ...startForm, notes: e.target.value })} placeholder="Optional notes" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="submit" className={primaryButtonClass} disabled={starting}>
                {starting ? "Starting..." : "Start Workout"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-4">
          {role !== "member" && <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-200 px-3">
            <Search size={17} className="text-gray-400" />
            <input className="h-10 min-w-0 flex-1 text-sm outline-none" value={sessionMemberSearch} onChange={(e) => handleMemberSearchChange(e.target.value)} placeholder="Search by member name or email..." />
          </div>}
          <select className={`${inputClass} w-44`} value={sessionStatusFilter} onChange={(e) => handleStatusFilterChange(e.target.value)}>
            <option value="">All Statuses</option>
            {(role === "member" ? ["COMPLETED", "CANCELLED"] : sessionStatuses).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        </div>

        {role === "member" ? (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {sessions.map((session) => {
              const sessionId = idOf(session);
              const startTime = session.startTime || session.start_date || session.startedAt;
              const endTime = session.endTime || session.end_date || session.endedAt || session.completedAt;
              const title = session.workoutDay?.title || session.workoutPlan?.name || session.workoutPlan?.title || "Workout session";
              return (
                <button key={sessionId} type="button" onClick={() => handleSelectSession(sessionId)} className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-950">{title}</h3>
                      <p className="mt-1 text-sm text-gray-500">{startTime ? displayDate(startTime) : "-"}</p>
                    </div>
                    <StatusBadge status={session.status || "SCHEDULED"} label={titleCase(session.status || "SCHEDULED")} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-xs text-gray-500">Duration</p><p className="mt-1 font-semibold text-gray-900">{computeDuration(startTime, endTime)}</p></div>
                    <div><p className="text-xs text-gray-500">Volume</p><p className="mt-1 font-semibold text-gray-900">{session.totalVolume ?? session.volume ?? "-"}</p></div>
                    <div><p className="text-xs text-gray-500">Calories</p><p className="mt-1 font-semibold text-gray-900">{session.calories ?? "-"}</p></div>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-blue-700">View session details</p>
                </button>
              );
            })}
            {!sessions.length && <div className="p-8 text-center text-xs text-gray-500 md:col-span-2">{sessionsLoading ? "Loading sessions..." : "No sessions yet. Start your first workout to see it here."}</div>}
          </div>
        ) : <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                {(role === "admin" || role === "trainer") && <th className="px-4 py-3">User</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Start Time</th>
                <th className="px-4 py-3">End Time</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((session) => {
                const sessionId = idOf(session);
                const isSelected = selectedSessionId === sessionId;
                const startTime = session.startTime || session.start_date || session.startedAt;
                const endTime = session.endTime || session.end_date || session.endedAt || session.completedAt;
                return (
                  <tr
                    key={sessionId}
                    className={`cursor-pointer transition hover:bg-gray-50 ${isSelected ? "bg-blue-50/40" : ""}`}
                    onClick={() => handleSelectSession(sessionId)}
                  >
                    {(role === "admin" || role === "trainer") && (
                      <td className="px-4 py-3 font-medium text-gray-800">{nameOf(session.user || session.member || session)}</td>
                    )}
                    <td className="px-4 py-3"><StatusBadge status={session.status || "SCHEDULED"} label={titleCase(session.status || "SCHEDULED")} /></td>
                    <td className="px-4 py-3 text-gray-600">{startTime ? displayDate(startTime) : "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{endTime ? displayDate(endTime) : "-"}</td>
                    <td className="px-4 py-3 font-medium tabular-nums text-gray-800">{computeDuration(startTime, endTime)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteSession(sessionId); }} className={iconButtonClass} title="Delete session">
                          <Trash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!sessions.length && (
            <div className="p-8 text-center text-xs text-gray-500">
              {sessionsLoading ? "Loading sessions..." : "No sessions yet. Start your first workout to see it here."}
            </div>
          )}
        </div>}

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <button type="button" className={buttonClass} disabled={sessionPage <= 1} onClick={() => handlePageChange(sessionPage - 1)}>
              Previous
            </button>
            <div className="flex items-center gap-1">
              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${p === sessionPage ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button type="button" className={buttonClass} disabled={sessionPage >= sessionTotalPages} onClick={() => handlePageChange(sessionPage + 1)}>
              Next
            </button>
        </div>
      </Card>

      {selectedSessionId && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="font-semibold text-gray-950">Workout Log</h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setShowSwapForm(!showSwapForm); if (!showSwapForm) { const sid = idOf(activeSession) || selectedSessionId; if (sid) loadSessionSwaps(sid); } }} className={buttonClass}>
                <ArrowRightLeft size={16} />
                Swap Exercise
              </button>
              <button type="button" onClick={() => setBulkSets({ ...bulkSets, show: !bulkSets.show })} className={buttonClass}>
                <Plus size={16} />
                Bulk Log
              </button>
            </div>
          </div>

          {showSwapForm && (
            <div className="border-b border-gray-200 bg-yellow-50/50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Swap Exercise in Session</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Original Exercise">
                  <select className={inputClass} value={swapOriginalExerciseId} onChange={(e) => setSwapOriginalExerciseId(e.target.value)}>
                    <option value="">Select exercise to replace</option>
                    {sessionExercises.map((ex) => (
                      <option key={idOf(ex)} value={idOf(ex)}>{nameOf(ex)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Replacement Exercise">
                  <select className={inputClass} value={swapExerciseId} onChange={(e) => setSwapExerciseId(e.target.value)}>
                    <option value="">Select replacement</option>
                    {sessionExercises.filter((ex) => idOf(ex) !== swapOriginalExerciseId).map((ex) => (
                      <option key={idOf(ex)} value={idOf(ex)}>{nameOf(ex)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Reason (optional)">
                  <input className={inputClass} value={swapReason} onChange={(e) => setSwapReason(e.target.value)} placeholder="Why swap?" />
                </Field>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={handleSwapExercise} className={primaryButtonClass} disabled={!swapOriginalExerciseId || !swapExerciseId}>
                  <ArrowRightLeft size={16} />
                  Swap
                </button>
                <button type="button" onClick={() => { setShowSwapForm(false); setSwapOriginalExerciseId(""); setSwapExerciseId(""); setSwapReason(""); }} className={buttonClass}>
                  Cancel
                </button>
              </div>
              {sessionSwaps.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Previous Swaps</p>
                  <ul className="space-y-1">
                    {sessionSwaps.map((swap, idx) => (
                      <li key={idOf(swap) || idx} className="text-xs text-gray-600">
                        {swap.originalExercise?.name || swap.originalExerciseName || swap.originalExerciseId || "?"} → {swap.substituteExercise?.name || swap.substituteExerciseName || swap.substituteExerciseId || "?"}
                        {swap.reason && <span className="text-gray-400"> ({swap.reason})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {bulkSets.show && (
            <form onSubmit={handleBulkLogSets} className="border-b border-gray-200 bg-gray-50 p-4">
              <Field label="Bulk Sets (JSON array)">
                <textarea
                  className="min-h-32 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                  value={bulkSets.data}
                  onChange={(e) => setBulkSets({ ...bulkSets, data: e.target.value })}
                  placeholder='[{"exerciseId":"...","setNumber":1,"setType":"WORKING","weight":50,"actualReps":10}]'
                />
              </Field>
              <div className="mt-3 flex gap-2">
                <button type="submit" className={primaryButtonClass} disabled={bulkLogging}>
                  {bulkLogging ? "Logging..." : "Log Sets"}
                </button>
                <button type="button" onClick={() => setBulkSets({ show: false, data: "" })} className={buttonClass}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <form onSubmit={handleLogSet} className="grid gap-3 border-b border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Workout Exercise">
              <select className={inputClass} value={setForm.workoutExerciseId} onChange={(e) => setSetForm({ ...setForm, workoutExerciseId: e.target.value })} disabled={loadingExercises}>
                <option value="">{loadingExercises ? "Loading..." : "Select workout exercise"}</option>
                {sessionExercises.map((ex) => {
                  const exId = idOf(ex);
                  const exName = ex.exercise?.name || ex.name || ex.exerciseName || ex.title || exId;
                  const details = ex.sets || ex.reps ? ` (${ex.sets || "?"}×${ex.reps || "?"})` : "";
                  return <option key={exId} value={exId}>{`${exName}${details}`}</option>;
                })}
              </select>
            </Field>
            <Field label="Set #">
              <input className={inputClass} type="number" min="1" value={setForm.setNumber} onChange={(e) => setSetForm({ ...setForm, setNumber: e.target.value })} placeholder="1" />
            </Field>
            <Field label="Type">
              <select className={inputClass} value={setForm.setType} onChange={(e) => setSetForm({ ...setForm, setType: e.target.value })}>
                {setTypeOptions.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </select>
            </Field>
            <Field label="Weight">
              <input className={inputClass} type="number" min="0" step="0.5" value={setForm.weight} onChange={(e) => setSetForm({ ...setForm, weight: e.target.value })} placeholder="kg" />
            </Field>
            <Field label="Reps">
              <input className={inputClass} type="number" min="0" value={setForm.actualReps} onChange={(e) => setSetForm({ ...setForm, actualReps: e.target.value })} placeholder="10" />
            </Field>
            <Field label="Duration (s)">
              <input className={inputClass} type="number" min="0" value={setForm.duration} onChange={(e) => setSetForm({ ...setForm, duration: e.target.value })} placeholder="60" />
            </Field>
            <Field label="RPE">
              <select className={inputClass} value={setForm.rpe} onChange={(e) => setSetForm({ ...setForm, rpe: e.target.value })}>
                <option value="">-</option>
                {rpeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <input className={inputClass} value={setForm.notes} onChange={(e) => setSetForm({ ...setForm, notes: e.target.value })} placeholder="Optional" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="submit" className={primaryButtonClass} disabled={loggingSet}>
                {loggingSet ? "Logging..." : "Log Set"}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Exercise</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Reps</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">RPE</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(Array.isArray(setLogs) ? setLogs : []).map((setItem) => {
                  const setId = idOf(setItem);
                  const isEditing = editingSetId === setId;
                  if (isEditing) {
                    return (
                      <tr key={setId} className="bg-blue-50/20">
                        <td className="px-4 py-2 text-gray-600">{setItem.setNumber || setItem.set_number || "-"}</td>
                        <td className="px-4 py-2">
                          <select className={`${inputClass} h-8`} value={editSetForm.setType || "WORKING"} onChange={(e) => setEditSetForm({ ...editSetForm, setType: e.target.value })}>
                            {setTypeOptions.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-gray-800">{nameOf(setItem.exercise || setItem.exerciseId || setItem)}</td>
                        <td className="px-4 py-2">
                          <input className={`${inputClass} h-8 w-20`} type="number" min="0" step="0.5" value={editSetForm.weight} onChange={(e) => setEditSetForm({ ...editSetForm, weight: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <input className={`${inputClass} h-8 w-16`} type="number" min="0" value={editSetForm.actualReps} onChange={(e) => setEditSetForm({ ...editSetForm, actualReps: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <input className={`${inputClass} h-8 w-16`} type="number" min="0" value={editSetForm.duration} onChange={(e) => setEditSetForm({ ...editSetForm, duration: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <select className={`${inputClass} h-8`} value={editSetForm.rpe} onChange={(e) => setEditSetForm({ ...editSetForm, rpe: e.target.value })}>
                            <option value="">-</option>
                            {rpeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input className={`${inputClass} h-8`} value={editSetForm.notes} onChange={(e) => setEditSetForm({ ...editSetForm, notes: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => handleEditSet(setId)} className="inline-flex h-7 items-center rounded-lg bg-blue-600 px-2 text-xs font-medium text-white hover:bg-blue-700">Save</button>
                            <button type="button" onClick={cancelEditSet} className="inline-flex h-7 items-center rounded-lg bg-gray-200 px-2 text-xs font-medium text-gray-700 hover:bg-gray-300">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={setId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{setItem.setNumber || setItem.set_number || "-"}</td>
                      <td className="px-4 py-3"><span className="inline-flex h-6 items-center rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-700">{titleCase(setItem.setType || "WORKING")}</span></td>
                      <td className="px-4 py-3 font-medium text-gray-800">{nameOf(setItem.exercise || setItem.exerciseId || setItem)}</td>
                      <td className="px-4 py-3 text-gray-600">{setItem.weight ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{setItem.actualReps ?? setItem.reps ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{setItem.duration ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{setItem.rpe ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-40 truncate">{setItem.notes || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => startEditSet(setItem)} className={iconButtonClass} title="Edit set">
                            <Activity size={15} />
                          </button>
                          <button type="button" onClick={() => handleDeleteSet(setId)} className={iconButtonClass} title="Delete set">
                            <Trash size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!Array.isArray(setLogs) || !setLogs.length) && (
              <div className="p-6 text-center text-sm text-gray-500">
                No sets logged yet. Use the form above to add your first set.
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
