import { useState, useEffect, useRef } from "react";
import { Plus, Trash, UserPlus, Users, Edit, X, CalendarDays, ArrowRightLeft, ClipboardList, Search } from "lucide-react";
import toast from "react-hot-toast";
import {
  assignTrainerToWorkoutPlan, getWorkoutTrainers, removeWorkoutTrainerAssignment,
  assignWorkoutToMember,
  previewWorkoutAssignment,
  updateWorkoutAssignment, unassignWorkout, reassignWorkout,
  getApiError
} from "../services/api";
import TablePagination from "./TablePagination";
import StatusBadge from "./StatusBadge";
import { normalizeRepeatDays, validateWorkoutAssignment } from "../utils/workoutScheduling";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

const trainerRoles = ["PRIMARY", "ASSISTANT", "SUBSTITUTE"];
const repeatTypes = ["NONE", "DAILY", "WEEKLY", "CUSTOM"];
const dayOfWeekOptions = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const ASSIGNMENT_PAGE_SIZE = 10;

function trainerAssignmentId(assignment) {
  return assignment?.trainerId || assignment?.userId || idOf(assignment?.trainer) || idOf(assignment?.user) || idOf(assignment?.trainerDetails) || idOf(assignment?.userDetails) || idOf(assignment) || "";
}

function trainerAssignmentName(assignment) {
  return assignment?.trainer?.name || assignment?.trainer?.fullName || assignment?.user?.name || assignment?.user?.fullName || assignment?.trainerDetails?.name || assignment?.trainerDetails?.fullName || assignment?.trainerName || assignment?.userName || "Trainer";
}

function trainerAssignmentEmail(assignment) {
  return assignment?.trainer?.email || assignment?.user?.email || assignment?.trainerDetails?.email || assignment?.userDetails?.email || assignment?.trainerEmail || assignment?.email || "";
}

function trainerAssignmentsFromResponse(response) {
  const payload = response?.data || response || {};
  const data = payload?.data || payload;
  if (Array.isArray(data)) return data;
  return data?.trainers || data?.trainerAssignments || data?.items || [];
}

function trainerAssignmentDetail(assignment) {
  const assistant = assignment?.assistant?.name || assignment?.assistant?.fullName || assignment?.assistantTrainer?.name || assignment?.assistantTrainer?.fullName || assignment?.assistantName;
  return assistant || titleCase(assignment?.role || assignment?.assignment?.role || "PRIMARY");
}

function assignmentMemberName(assignment) {
  return assignment?.member?.name || assignment?.member?.fullName || assignment?.user?.name || assignment?.user?.fullName || assignment?.memberDetails?.name || assignment?.memberDetails?.fullName || assignment?.memberName || assignment?.userName || nameOf(assignment?.member || assignment?.user || assignment?.memberDetails || assignment?.userDetails || assignment);
}

function assignmentDates(assignment) {
  const sd = assignment?.startDate || assignment?.start_date || assignment?.assignment?.startDate || assignment?.assignment?.start_date || "";
  const ed = assignment?.endDate || assignment?.end_date || assignment?.assignment?.endDate || assignment?.assignment?.end_date || "";
  return { startDate: sd, endDate: ed };
}

function assignmentPlanId(assignment) {
  return (
    assignment?.planId ||
    assignment?.workoutId ||
    assignment?.workoutPlanId ||
    assignment?.assignment?.planId ||
    assignment?.assignment?.workoutId ||
    assignment?.assignment?.workoutPlanId ||
    idOf(assignment?.plan || assignment?.workout || assignment?.workoutPlan || assignment?.workoutDetails || assignment?.assignment?.plan || assignment?.assignment?.workout || assignment?.assignment?.workoutPlan) ||
    idOf(assignment?.memberAssignment?.plan || assignment?.memberAssignment?.workout || assignment?.memberAssignment?.workoutPlan) ||
    idOf(assignment?.workoutAssignment?.plan || assignment?.workoutAssignment?.workout || assignment?.workoutAssignment?.workoutPlan) ||
    ""
  );
}

function assignmentRecordId(assignment) {
  return (
    assignment?.id ||
    assignment?._id ||
    assignment?.uuid ||
    assignment?.assignmentId ||
    assignment?.memberAssignmentId ||
    assignment?.workoutAssignmentId ||
    assignment?.assignment?.id ||
    assignment?.assignment?._id ||
    assignment?.assignment?.uuid ||
    assignment?.memberAssignment?.id ||
    assignment?.memberAssignment?._id ||
    assignment?.workoutAssignment?.id ||
    assignment?.workoutAssignment?._id ||
    assignment?.workoutAssignment?.uuid ||
    ""
  );
}

function assignmentPlanName(assignment, plans) {
  const plan = assignment?.plan || assignment?.workout || assignment?.workoutPlan || assignment?.workoutDetails;
  const planId = assignmentPlanId(assignment);
  return plan?.name || plan?.title || assignment?.planName || assignment?.workoutName || plans.find((item) => String(idOf(item)) === String(planId))?.name || "Workout plan";
}

function assignmentAssignedBy(assignment) {
  const assignedBy = assignment?.assignedBy || assignment?.assignedByUser || assignment?.creator || assignment?.createdBy;
  return assignedBy?.name || assignedBy?.fullName || assignment?.assignedByName || nameOf(assignedBy) || "-";
}

function toDateInputValue(value) {
  if (!value) return "";
  const calendarDate = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (calendarDate) return calendarDate;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyReassignForm() {
  return { newPlanId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "", reason: "" };
}

function responseData(response) {
  const payload = response?.data || response || {};
  return payload?.data || payload;
}

function previewDates(preview) {
  const dates = preview?.schedules || preview?.dates || preview?.sessionDates || preview?.scheduleDates || preview?.generatedDates || preview?.sessions || [];
  return dates.map((entry) => typeof entry === "string" ? entry : entry?.date).filter(Boolean);
}

function repeatDaysLabel(days = []) {
  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return (Array.isArray(days) ? days : []).map((day) => {
    const numericDay = Number(day);
    return Number.isInteger(numericDay) && numericDay >= 1 && numericDay <= 7
      ? labels[numericDay - 1]
      : titleCase(day);
  }).join(", ") || "-";
}

export default function WorkoutAssignments(props) {
  const { user, role, canManage, canEdit, canDelete, canAssign, canManageAssignments, plans, selectedPlan, selectedPlanId, members, trainers, planTrainers, setPlanTrainers, assignments, setAssignments, loadPlans, refreshAssignments, refreshSelectedPlan } = props;

  const [trainerPlanId, setTrainerPlanId] = useState("");
  const [currentTrainers, setCurrentTrainers] = useState([]);
  const [trainerForm, setTrainerForm] = useState({ trainerId: "", role: "PRIMARY" });

  const [memberPlanId, setMemberPlanId] = useState("");
  const [currentMembers, setCurrentMembers] = useState([]);
  const [memberForm, setMemberForm] = useState({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" });
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({ startDate: "", endDate: "" });
  const [confirmingId, setConfirmingId] = useState("");
  const [unassignReason, setUnassignReason] = useState("");
  const [unassignNote, setUnassignNote] = useState("");
  const [reassignId, setReassignId] = useState("");
  const [reassignForm, setReassignForm] = useState(emptyReassignForm);
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showScheduleDatesModal, setShowScheduleDatesModal] = useState(false);
  const [schedulePreview, setSchedulePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [assigningWorkout, setAssigningWorkout] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [reassigningWorkout, setReassigningWorkout] = useState(false);
  const [removingTrainerId, setRemovingTrainerId] = useState("");
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [trainerLoadError, setTrainerLoadError] = useState("");
  const previewRequestId = useRef(0);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState("");
  const [assignmentPage, setAssignmentPage] = useState(1);

  const memberActionMode = editingId ? "edit" : reassignId ? "reassign" : confirmingId ? "unassign" : "assign";
  const visibleMembers = currentMembers;
  const selectedPlanMembers = memberPlanId
    ? currentMembers.filter((assignment) => String(assignmentPlanId(assignment)) === String(memberPlanId))
    : [];
  const filteredAssignments = visibleMembers.filter((assignment) => {
    const type = assignment.repeatType || assignment.assignment?.repeatType || "NONE";
    const query = assignmentSearch.trim().toLowerCase();
    const searchable = [
      assignmentMemberName(assignment),
      assignmentPlanName(assignment, plans),
      assignmentAssignedBy(assignment),
    ].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) && (!assignmentTypeFilter || type === assignmentTypeFilter);
  });
  const assignmentTotalPages = Math.max(1, Math.ceil(filteredAssignments.length / ASSIGNMENT_PAGE_SIZE));
  const currentAssignmentPage = Math.min(assignmentPage, assignmentTotalPages);
  const paginatedAssignments = filteredAssignments.slice(
    (currentAssignmentPage - 1) * ASSIGNMENT_PAGE_SIZE,
    currentAssignmentPage * ASSIGNMENT_PAGE_SIZE
  );
  const assignmentRangeStart = filteredAssignments.length ? (currentAssignmentPage - 1) * ASSIGNMENT_PAGE_SIZE + 1 : 0;
  const assignmentRangeEnd = Math.min(currentAssignmentPage * ASSIGNMENT_PAGE_SIZE, filteredAssignments.length);
  const selectedMemberPlan = plans.find((plan) => String(idOf(plan)) === String(memberPlanId)) || (String(idOf(selectedPlan)) === String(memberPlanId) ? selectedPlan : null);
  const previewPlanId = memberActionMode === "reassign" ? reassignForm.newPlanId : memberPlanId;
  const previewForm = memberActionMode === "reassign" ? reassignForm : memberForm;

  const openMemberAssignmentModal = () => {
    setEditingId("");
    setEditForm({ startDate: "", endDate: "" });
    setConfirmingId("");
    setUnassignReason("");
    setUnassignNote("");
    setReassignId("");
    setReassignForm(emptyReassignForm());
    setMemberForm({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" });
    setShowMemberModal(true);
  };

  const closeMemberModal = () => {
    setShowMemberModal(false);
    setEditingId("");
    setReassignId("");
    setConfirmingId("");
  };

  const openActionMemberModal = (assignment, mode) => {
    const planId = assignmentPlanId(assignment);
    if (planId) setMemberPlanId(planId);
    if (mode === "edit") {
      const { startDate, endDate } = assignmentDates(assignment);
      setEditingId(assignmentRecordId(assignment));
      setEditForm({ startDate: toDateInputValue(startDate), endDate: toDateInputValue(endDate) });
      setConfirmingId("");
      setReassignId("");
      setReassignForm(emptyReassignForm());
    } else if (mode === "reassign") {
      setReassignId(assignmentRecordId(assignment));
      const { startDate, endDate } = assignmentDates(assignment);
      setReassignForm({
        ...emptyReassignForm(),
        startDate: toDateInputValue(startDate),
        endDate: toDateInputValue(endDate),
        repeatType: assignment.repeatType || assignment.assignment?.repeatType || "NONE",
        repeatDays: normalizeRepeatDays(assignment.repeatDays || assignment.assignment?.repeatDays).map((day) => dayOfWeekOptions[day - 1]),
        repeatEndDate: toDateInputValue(assignment.repeatEndDate || assignment.assignment?.repeatEndDate),
      });
      setEditingId("");
      setConfirmingId("");
    } else if (mode === "unassign") {
      setConfirmingId(assignmentRecordId(assignment));
      setEditingId("");
      setReassignId("");
      setReassignForm(emptyReassignForm());
    }
    setShowMemberModal(true);
  };

  useEffect(() => {
    if (!trainerPlanId) { setCurrentTrainers([]); return; }
    let cancelled = false;
    const load = async () => {
      setLoadingTrainers(true);
      setTrainerLoadError("");
      try {
        const response = await getWorkoutTrainers(trainerPlanId, user?.token);
        if (cancelled) return;
        setCurrentTrainers(trainerAssignmentsFromResponse(response));
      } catch (error) {
        if (!cancelled) {
          setTrainerLoadError(getApiError(error, "Failed to load trainers"));
          toast.error(getApiError(error, "Failed to load trainers"));
        }
      } finally {
        if (!cancelled) setLoadingTrainers(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [trainerPlanId, user?.token]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const allAssignments = Array.isArray(assignments) ? assignments : [];
        if (!cancelled) setCurrentMembers(allAssignments);
      } catch (error) {
        if (!cancelled) setCurrentMembers([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [assignments]);

  useEffect(() => {
    if (!showScheduleDatesModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showScheduleDatesModal]);

  useEffect(() => {
    const requestId = ++previewRequestId.current;
    const shouldPreview = showMemberModal && (memberActionMode === "assign" || memberActionMode === "reassign");
    const validation = validateWorkoutAssignment(previewForm);
    if (!shouldPreview || !previewPlanId || validation.errors.length) {
      setSchedulePreview(null);
      setPreviewLoading(false);
      return undefined;
    }

    const repeatType = String(previewForm.repeatType || "NONE").toUpperCase();
    const previewPayload = {
      ...(memberActionMode === "assign" && memberForm.memberId ? { userId: memberForm.memberId } : {}),
      startDate: previewForm.startDate,
      ...(previewForm.endDate && { endDate: previewForm.endDate }),
      repeatType,
      ...(["WEEKLY", "CUSTOM"].includes(repeatType) && { repeatDays: normalizeRepeatDays(previewForm.repeatDays) }),
      ...(previewForm.repeatEndDate && { repeatEndDate: previewForm.repeatEndDate }),
    };

    const timeoutId = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const response = await previewWorkoutAssignment(previewPlanId, previewPayload, user?.token);
        const responseData = response?.data || response || {};
        const previewData = responseData?.data || responseData;
        const preview = previewData?.schedulePreview || previewData?.preview || previewData;
        if (requestId === previewRequestId.current) setSchedulePreview(preview);
      } catch (error) {
        if (requestId === previewRequestId.current) {
          setSchedulePreview(null);
          toast.error(getApiError(error, "Unable to preview workout schedule"));
        }
      } finally {
        if (requestId === previewRequestId.current) setPreviewLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      previewRequestId.current += 1;
    };
  }, [showMemberModal, memberActionMode, previewPlanId, previewForm.startDate, previewForm.endDate, previewForm.repeatType, previewForm.repeatDays, previewForm.repeatEndDate, memberForm.memberId, user?.token]);

  const handleAssignTrainer = async (e) => {
    e.preventDefault();
    if (!trainerPlanId || !trainerForm.trainerId) { toast.error("Select a plan and trainer"); return; }
    try {
      const assignResponse = await assignTrainerToWorkoutPlan(trainerPlanId, { trainerId: trainerForm.trainerId, role: trainerForm.role }, user?.token);
      toast.success(assignResponse?.message || "Trainer assigned");
      setShowTrainerModal(false);
      setTrainerForm({ trainerId: "", role: "PRIMARY" });
      const response = await getWorkoutTrainers(trainerPlanId, user?.token);
      const list = trainerAssignmentsFromResponse(response);
      setCurrentTrainers(list);
      if (setPlanTrainers) setPlanTrainers(list);
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign trainer"));
    }
  };

  const handleRemoveTrainer = async (tId) => {
    if (!trainerPlanId || !tId || removingTrainerId) return;
    try {
      setRemovingTrainerId(tId);
      const removeResponse = await removeWorkoutTrainerAssignment(trainerPlanId, tId, user?.token);
      toast.success(removeResponse?.message || "Trainer removed successfully");
      const response = await getWorkoutTrainers(trainerPlanId, user?.token);
      const refreshedTrainers = trainerAssignmentsFromResponse(response);
      setCurrentTrainers(refreshedTrainers);
      if (setPlanTrainers) setPlanTrainers(refreshedTrainers);
    } catch (error) {
      toast.error(getApiError(error, "Unable to remove trainer"));
    } finally {
      setRemovingTrainerId("");
    }
  };

  const handleAssignMember = async (e) => {
    e.preventDefault();
    if (assigningWorkout) return;
    if (!memberPlanId || !memberForm.memberId) { toast.error("Select a plan and member"); return; }
    const validation = validateWorkoutAssignment(memberForm);
    if (validation.errors.length) {
      toast.error(validation.errors[0]);
      return;
    }
    try {
      setAssigningWorkout(true);
      const repeatType = memberForm.repeatType || "NONE";
      const payload = { userId: memberForm.memberId, startDate: memberForm.startDate, repeatType };
      if (memberForm.startDate) payload.startDate = memberForm.startDate;
      if (memberForm.endDate) payload.endDate = memberForm.endDate;
      if (repeatType !== "NONE") {
        if (memberForm.repeatEndDate) payload.repeatEndDate = memberForm.repeatEndDate;
      }
      if (["WEEKLY", "CUSTOM"].includes(repeatType)) {
        payload.repeatDays = normalizeRepeatDays(memberForm.repeatDays);
      }
      const response = await assignWorkoutToMember(memberPlanId, payload, user?.token);
      toast.success(response?.message || "Workout assigned to member");
      setShowMemberModal(false);
      setMemberForm({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "" });
      await loadPlans();
      await refreshAssignments?.();
      await refreshSelectedPlan?.();
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign workout"));
    } finally {
      setAssigningWorkout(false);
    }
  };

  const handleUpdateAssignment = async (aId) => {
    if (updatingAssignment) return;
    try {
      setUpdatingAssignment(true);
      const payload = {};
      if (editForm.startDate) payload.startDate = editForm.startDate;
      if (editForm.endDate) payload.endDate = editForm.endDate;
      await updateWorkoutAssignment(aId, payload, user?.token);
      toast.success("Assignment updated");
      setEditingId("");
      setEditForm({ startDate: "", endDate: "" });
      setShowMemberModal(false);
      if (setAssignments) {
        setAssignments((prev) => prev.map((a) => (assignmentRecordId(a) === aId ? { ...a, ...payload } : a)));
      }
      setCurrentMembers((prev) => prev.map((a) => (assignmentRecordId(a) === aId ? { ...a, ...payload } : a)));
      await loadPlans();
      await refreshAssignments?.();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update assignment"));
    } finally {
      setUpdatingAssignment(false);
    }
  };

  const handleUnassign = async (aId) => {
    try {
      const payload = {};
      if (unassignReason) payload.reason = unassignReason;
      if (unassignNote) payload.note = unassignNote;
      await unassignWorkout(aId, payload, user?.token);
      toast.success("Member unassigned");
      setConfirmingId("");
      setUnassignReason("");
      setUnassignNote("");
      setShowMemberModal(false);
      if (setAssignments) setAssignments((prev) => prev.filter((a) => assignmentRecordId(a) !== aId));
      setCurrentMembers((prev) => prev.filter((a) => assignmentRecordId(a) !== aId));
      await loadPlans();
      await refreshAssignments?.();
    } catch (error) {
      toast.error(getApiError(error, "Unable to unassign member"));
    }
  };

  const handleReassign = async (aId) => {
    if (reassigningWorkout) return;
    if (!reassignForm.newPlanId) { toast.error("Select a new workout plan"); return; }
    const validation = validateWorkoutAssignment(reassignForm);
    if (validation.errors.length) {
      toast.error(validation.errors[0]);
      return;
    }
    try {
      setReassigningWorkout(true);
      const repeatType = reassignForm.repeatType || "NONE";
      const payload = {
        workoutPlanId: reassignForm.newPlanId,
        startDate: reassignForm.startDate,
        ...(reassignForm.endDate && { endDate: reassignForm.endDate }),
        repeatType,
        ...(repeatType !== "NONE" && reassignForm.repeatEndDate && { repeatEndDate: reassignForm.repeatEndDate }),
        ...(["WEEKLY", "CUSTOM"].includes(repeatType) && { repeatDays: normalizeRepeatDays(reassignForm.repeatDays) }),
        ...(reassignForm.reason && { reason: reassignForm.reason }),
      };
      const response = await reassignWorkout(aId, payload, user?.token);
      toast.success("Workout reassigned");
      setReassignId("");
      setReassignForm({ newPlanId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [], repeatEndDate: "", reason: "" });
      setShowMemberModal(false);
      await loadPlans();
      await refreshAssignments?.();
      await refreshSelectedPlan?.();
    } catch (error) {
      toast.error(getApiError(error, "Unable to reassign workout"));
    } finally {
      setReassigningWorkout(false);
    }
  };

  const renderSchedulePreview = () => {
    if (previewLoading) return <p className="text-xs text-[#64748B]">Updating schedule preview...</p>;
    if (!schedulePreview) return null;

    const dates = previewDates(schedulePreview);
    const totalSessions = Number(schedulePreview.totalSessions ?? schedulePreview.schedules?.length ?? dates.length) || 0;
    const unreachableDays = Array.isArray(schedulePreview.unreachableDays) ? schedulePreview.unreachableDays : [];
    const warnings = Array.isArray(schedulePreview.warnings) ? schedulePreview.warnings : [];

    return (
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-[#334155]">Schedule Preview</p>
          <button type="button" onClick={() => setShowScheduleDatesModal(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0D8252]/10 px-2.5 py-1 text-[10px] font-bold text-[#0D8252] transition hover:bg-[#0D8252]/15" aria-haspopup="dialog">
            <CalendarDays size={12} /> Total Sessions <span>{totalSessions}</span>
          </button>
        </div>
        <div className="mt-2 grid gap-x-4 gap-y-1 text-[10px] text-[#64748B] sm:grid-cols-2">
          <span>Start: <strong className="font-semibold text-[#334155]">{schedulePreview.startDate || "-"}</strong></span>
          <span>End: <strong className="font-semibold text-[#334155]">{schedulePreview.endDate || "-"}</strong></span>
          <span>Repeat: <strong className="font-semibold text-[#334155]">{titleCase(schedulePreview.repeatType || "NONE")}</strong></span>
          <span>Repeat days: <strong className="font-semibold text-[#334155]">{repeatDaysLabel(schedulePreview.repeatDays)}</strong></span>
          <span>Total plan days: <strong className="font-semibold text-[#334155]">{schedulePreview.totalPlanDays ?? "-"}</strong></span>
        </div>
        {dates.length > 0 && (
          <div className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto">
            {dates.map((date, index) => <span key={`${date}-${index}`} className="shrink-0 rounded-full bg-[#0D8252]/10 px-2.5 py-1 text-[10px] font-bold text-[#0D8252]">{date}</span>)}
          </div>
        )}
        {unreachableDays.length > 0 && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800">
            <p className="font-semibold">Unreachable workout days</p>
            <p className="mt-1">{unreachableDays.map((day) => typeof day === "string" ? titleCase(day) : day?.title || day?.name || (day?.dayNumber ? `Day ${day.dayNumber}` : "Workout day")).join(", ")}</p>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800">
            {warnings.map((warning, index) => <p key={warning?.code || warning?.message || index}>{typeof warning === "string" ? warning : warning?.message || "Schedule warning"}</p>)}
          </div>
        )}
        {schedulePreview.summary && <p className="mt-2 text-[10px] leading-4 text-[#64748B]">{schedulePreview.summary}</p>}
      </div>
    );
  };
  const scheduledPreviewDates = previewDates(schedulePreview);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-[#E5EAF0] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">Active Workout Assignments</h3>
            <p className="mt-0.5 text-[10px] text-[#94A3B8]">Overview of active coaches and enrolled gym members</p>
          </div>
          <div className="grid gap-2 sm:flex sm:items-center">
            <label className="flex h-8 min-w-0 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs text-[#94A3B8] sm:w-45">
              <Search size={13} />
              <input value={assignmentSearch} onChange={(event) => { setAssignmentSearch(event.target.value); setAssignmentPage(1); }} placeholder="Filter assignments..." className="min-w-0 flex-1 bg-transparent text-xs text-[#475569] outline-none placeholder:text-[#94A3B8]" />
            </label>
            <select value={assignmentTypeFilter} onChange={(event) => { setAssignmentTypeFilter(event.target.value); setAssignmentPage(1); }} className="h-8 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs text-[#475569] outline-none sm:w-24">
              <option value="">All Types</option>
              {repeatTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
            {canManageAssignments && (
              <button type="button" onClick={() => setShowTrainerModal(true)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">
                <UserPlus size={13} /> Assign Trainers
              </button>
            )}
            {canAssign && (
              <button type="button" onClick={openMemberAssignmentModal} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3 text-xs font-semibold text-white transition hover:bg-[#086B43]">
                <Users size={13} /> Assign Members
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left">
            <thead className="bg-[#FBFCFD] text-[9px] font-bold uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Workout Plan</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned By</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAssignments.map((assignment) => {
                const { startDate, endDate } = assignmentDates(assignment);
                const status = assignment.status || "ACTIVE";
                return (
                  <tr key={idOf(assignment)} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F172A]">{assignmentMemberName(assignment)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#475569]">{assignmentPlanName(assignment, plans)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">{displayDate(startDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">{displayDate(endDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={status} label={titleCase(status)} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">{assignmentAssignedBy(assignment)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center justify-left gap-1">
                        {canEdit && <button type="button" onClick={() => openActionMemberModal(assignment, "edit")} className={iconButtonClass} title="Update dates" aria-label="Update dates"><Edit size={14} /></button>}
                        {canAssign && <button type="button" onClick={() => openActionMemberModal(assignment, "reassign")} className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[10px] font-semibold text-[#475569] transition hover:bg-[#F8FAFC]" title="Reassign workout"><ArrowRightLeft size={12} /> Reassign</button>}
                        {canDelete && <button type="button" onClick={() => openActionMemberModal(assignment, "unassign")} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-rose-50 hover:text-rose-600" title="Unassign workout" aria-label="Unassign workout"><Trash size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!paginatedAssignments.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-[#64748B]">
                    {currentMembers.length ? "No assignments match these filters." : "No active assignments found for the workout plans."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#EEF2F4] bg-white px-5 py-3.5 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {assignmentRangeStart} to {assignmentRangeEnd} of {filteredAssignments.length} active assignments</span>
          <TablePagination page={currentAssignmentPage} totalPages={assignmentTotalPages} onPageChange={setAssignmentPage} />
        </div>
      </section>

      <div>
      {canManageAssignments && showTrainerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowTrainerModal(false); }}>
        <section className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><UserPlus size={18} /></div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Assign Trainers</h3>
                <p className="mt-0.5 text-xs text-[#64748B]">Assign trainers to a workout plan</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowTrainerModal(false)} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label="Close assign trainers modal"><X size={17} /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Workout Plan</label>
              <select
                className="h-9 w-full rounded-lg border border-[#0D8252]/20 bg-white px-3 text-xs text-[#334155] outline-none transition focus:ring-2 focus:ring-[#BFDBFE]"
                value={trainerPlanId}
                onChange={(e) => setTrainerPlanId(e.target.value)}
              >
                <option value="">Select a plan</option>
                {plans.map((plan) => (
                  <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title || "Workout plan"}</option>
                ))}
              </select>
            </div>

            <section className="rounded-lg border border-[#E2E8F0] bg-white p-3" aria-labelledby="current-trainers-heading">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 id="current-trainers-heading" className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Current Trainers</h4>
                {trainerPlanId && <span className="text-[10px] font-medium text-[#94A3B8]">{currentTrainers.length}</span>}
              </div>
              {!trainerPlanId ? (
                <p className="text-xs text-[#94A3B8]">Select a workout plan to view its assigned trainers.</p>
              ) : loadingTrainers ? (
                <p className="text-xs text-[#64748B]">Loading trainers...</p>
              ) : trainerLoadError ? (
                <p role="alert" className="text-xs text-red-600">{trainerLoadError}</p>
              ) : currentTrainers.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">No trainers are currently assigned to this plan.</p>
              ) : (
                <ul className="space-y-2">
                  {currentTrainers.map((trainer, index) => (
                    <li key={trainerAssignmentId(trainer) || `${trainerAssignmentName(trainer)}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-[#EEF2F4] bg-[#FBFCFD] px-3 py-2 text-xs font-medium text-[#334155]">
                      <div className="min-w-0">
                        <p className="truncate">{trainerAssignmentName(trainer)}</p>
                        <p className="mt-0.5 truncate text-[10px] font-normal text-[#64748B]">{trainerAssignmentEmail(trainer) || "No email provided"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-[#0D8252]/10 px-2 py-1 text-[9px] font-semibold text-[#0D8252]">{trainerAssignmentDetail(trainer)}</span>
                        <button type="button" onClick={() => void handleRemoveTrainer(trainerAssignmentId(trainer))} disabled={!canManageAssignments || removingTrainerId === trainerAssignmentId(trainer)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Remove ${trainerAssignmentName(trainer)}`} title="Remove trainer">
                          {removingTrainerId === trainerAssignmentId(trainer) ? <span className="text-[9px]">...</span> : <Trash size={13} />}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <form id="assign-trainer-form" onSubmit={handleAssignTrainer} className="space-y-3 rounded-lg border border-[#0D8252]/20 bg-[#FBFCFD] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Add a trainer to this plan</p>
              <select
                className="h-9 w-full rounded-lg border border-[#0D8252]/20 bg-white px-3 text-xs text-[#475569] outline-none transition focus:border-[#0D8252]/30 focus:ring-1 focus:ring-[#0D8252]/30"
                value={trainerForm.trainerId}
                onChange={(e) => setTrainerForm({ ...trainerForm, trainerId: e.target.value })}
              >
                <option value="">Select trainer</option>
                {trainers.map((t) => (
                  <option key={idOf(t)} value={idOf(t)}>{t.name || t.fullName || t.email || "Trainer"}</option>
                ))}
              </select>
              <select
                className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]"
                value={trainerForm.role}
                onChange={(e) => setTrainerForm({ ...trainerForm, role: e.target.value })}
              >
                {trainerRoles.map((r) => (
                  <option key={r} value={r}>{titleCase(r)}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!trainerPlanId || !trainerForm.trainerId}
                className="w-full justify-center inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0D8252] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={14} /> Assign
              </button>
            </form>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
            <button type="button" onClick={() => setShowTrainerModal(false)} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          </div>
        </section>
        </div>
      )}

      {(canAssign || canEdit || canDelete) && showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMemberModal(); }}>
        <section className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Users size={18} /></div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  {memberActionMode === "edit" ? "Edit Member Assignment" : memberActionMode === "reassign" ? "Reassign Workout" : memberActionMode === "unassign" ? "Unassign Member" : "Assign Member"}
                </h3>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {memberActionMode === "edit" ? "Update this member's workout dates." : memberActionMode === "reassign" ? "Choose a new workout plan for this member." : memberActionMode === "unassign" ? "Remove this member from the workout plan." : "Assign a workout plan to a gym member."}
                </p>
              </div>
            </div>
            <button type="button" onClick={closeMemberModal} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label="Close member assignment modal"><X size={17} /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {memberActionMode === "assign" && <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Workout Plan</label>
              <select className="h-9 w-full rounded-lg border border-[#0D8252]/20 bg-white px-3 text-xs text-[#334155] outline-none transition focus:ring-2 focus:ring-[#BFDBFE]/30" value={memberPlanId} onChange={(e) => setMemberPlanId(e.target.value)}>
                <option value="">Select a plan</option>
                {plans.map((plan) => (
                  <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title || "Workout plan"}</option>
                ))}
              </select>
            </div>}

            {memberActionMode === "assign" && (
              <section className="rounded-lg border border-[#E2E8F0] bg-white p-3" aria-labelledby="current-members-heading">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 id="current-members-heading" className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Current Members</h4>
                  {memberPlanId && <span className="text-[10px] font-medium text-[#94A3B8]">{selectedPlanMembers.length}</span>}
                </div>
                {!memberPlanId ? (
                  <p className="text-xs text-[#94A3B8]">Select a workout plan to view its assigned members.</p>
                ) : selectedPlanMembers.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">No members are currently assigned to this plan.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedPlanMembers.map((member, index) => (
                      <li key={assignmentRecordId(member) || idOf(member) || `${assignmentMemberName(member)}-${index}`} className="rounded-md border border-[#EEF2F4] bg-[#FBFCFD] px-3 py-2 text-xs font-medium text-[#334155]">
                        {assignmentMemberName(member)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {(memberActionMode === "assign" || memberPlanId) && (
              <>
                {memberActionMode !== "assign" && <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#334155]">Current Members</span>
                    <span className="text-xs text-gray-400">{visibleMembers.length}</span>
                  </div>
                  {visibleMembers.length === 0 ? (
                    <p className="py-3 text-center text-sm text-gray-400">No members assigned</p>
                  ) : (
                    <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                      {visibleMembers.map((a) => {
                        const aId = assignmentRecordId(a) || idOf(a);
                        const isEditing = editingId === aId;
                        const { startDate, endDate } = assignmentDates(a);
                        return (
                          <div key={aId} className="px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">{assignmentMemberName(a)}</p>
                                <p className="mt-0.5 text-[10px] text-gray-500">
                                  <CalendarDays size={12} className="inline -mt-0.5 me-1" />
                                  {displayDate(startDate)} – {displayDate(endDate)}
                                </p>
                                {a.status && (
                                  <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{titleCase(a.status)}</span>
                                )}
                              </div>
                               <div className="flex shrink-0 items-center gap-1">
                                {confirmingId === aId ? (
                                  <div className="flex items-center gap-2">
                                    <select className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs" value={unassignReason} onChange={(e) => setUnassignReason(e.target.value)}>
                                      <option value="">Select reason</option>
                                      <option value="MEMBER_REQUEST">Member request</option>
                                      <option value="TRAINER_DECISION">Trainer decision</option>
                                      <option value="INJURY">Injury</option>
                                      <option value="GOAL_COMPLETE">Goal complete</option>
                                      <option value="OTHER">Other</option>
                                    </select>
                                    <input className="h-8 rounded-md border border-gray-300 px-2 text-xs" placeholder="Optional note" value={unassignNote} onChange={(e) => setUnassignNote(e.target.value)} />
                                  </div>
                                ) : (
                                  <>
                                    {/* <button type="button" onClick={() => {
                                      const rowPlanId = assignmentPlanId(a);
                                      if (rowPlanId) setMemberPlanId(rowPlanId);
                                      setReassignId(aId);
                                      setReassignForm({ newPlanId: "", reason: "" });
                                    }} className={iconButtonClass} title="Reassign to different plan"><ArrowRightLeft size={15} /></button> */}
                                    <button type="button" onClick={() => {
                                      const { startDate, endDate } = assignmentDates(a);
                                      const rowPlanId = assignmentPlanId(a);
                                      if (rowPlanId) setMemberPlanId(rowPlanId);
                                      setEditingId(aId);
                                      setEditForm({ startDate: toDateInputValue(startDate), endDate: toDateInputValue(endDate) });
                                    }} className={iconButtonClass} title="Update dates"><Edit size={15} /></button>
                                    <button type="button" onClick={() => {
                                      const rowPlanId = assignmentPlanId(a);
                                      if (rowPlanId) setMemberPlanId(rowPlanId);
                                      setConfirmingId(aId);
                                    }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40" title="Unassign"><Trash size={15} /></button>
                                  </>
                                )}
                              </div>
                            </div>
                            {isEditing && (
                              <div className="mt-2 flex items-end gap-2 border-t border-gray-100 pt-2">
                                <div className="flex-1">
                                  <label className="mb-0.5 block text-xs font-semibold uppercase text-gray-500">Start</label>
                                  <input type="date" className={inputClass} value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
                                </div>
                                <div className="flex-1">
                                  <label className="mb-0.5 block text-xs font-semibold uppercase text-gray-500">End</label>
                                  <input type="date" className={inputClass} value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
                                </div>
                              </div>
                            )}
                            {reassignId === aId && (
                              <div className="mt-2 border-t border-gray-100 pt-2 space-y-2">
                                <p className="text-xs font-semibold text-[#334155]">Reassign to New Plan</p>
                                <select className={inputClass} value={reassignForm.newPlanId} onChange={(e) => setReassignForm({ ...reassignForm, newPlanId: e.target.value })}>
                                  <option value="">Select new workout plan</option>
                                  {plans.filter((p) => idOf(p) !== memberPlanId).map((plan) => (
                                    <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title || "Workout plan"}</option>
                                  ))}
                                </select>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="grid gap-1 text-[10px] font-semibold text-[#64748B]">Start Date<input type="date" className={inputClass} value={reassignForm.startDate} onChange={(event) => setReassignForm({ ...reassignForm, startDate: event.target.value })} /></label>
                                  <label className="grid gap-1 text-[10px] font-semibold text-[#64748B]">End Date<input type="date" className={inputClass} value={reassignForm.endDate} onChange={(event) => setReassignForm({ ...reassignForm, endDate: event.target.value })} /></label>
                                </div>
                                <label className="grid gap-1 text-[10px] font-semibold text-[#64748B]">Repeat Type
                                  <select className={inputClass} value={reassignForm.repeatType} onChange={(event) => setReassignForm({ ...reassignForm, repeatType: event.target.value, repeatDays: ["WEEKLY", "CUSTOM"].includes(event.target.value) ? reassignForm.repeatDays : [] })}>
                                    {repeatTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                                  </select>
                                </label>
                                {["WEEKLY", "CUSTOM"].includes(reassignForm.repeatType) && (
                                  <div>
                                    <p className="mb-1 text-[10px] font-semibold text-[#64748B]">Repeat Days</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                      {dayOfWeekOptions.map((day) => (
                                        <label key={day} className="inline-flex items-center gap-1 text-[10px] text-[#475569]">
                                          <input type="checkbox" checked={reassignForm.repeatDays.includes(day)} onChange={(event) => setReassignForm({ ...reassignForm, repeatDays: event.target.checked ? [...reassignForm.repeatDays, day] : reassignForm.repeatDays.filter((value) => value !== day) })} className="accent-[#0D8252]" />
                                          {day.slice(0, 3)}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {reassignForm.repeatType !== "NONE" && <label className="grid gap-1 text-[10px] font-semibold text-[#64748B]">Repeat End Date<input type="date" className={inputClass} value={reassignForm.repeatEndDate} onChange={(event) => setReassignForm({ ...reassignForm, repeatEndDate: event.target.value })} /></label>}
                                <input className={inputClass} value={reassignForm.reason} onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })} placeholder="Reason (optional)" />
                                {renderSchedulePreview()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>}

                {memberActionMode === "assign" && <form id="assign-member-form" onSubmit={handleAssignMember} className="space-y-3 rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Assign this plan to a member</p>
                  <select className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]" value={memberForm.memberId} onChange={(e) => setMemberForm({ ...memberForm, memberId: e.target.value })}>
                    <option value="">Select member</option>
                    {members.map((m) => (
                      <option key={idOf(m)} value={idOf(m)}>{nameOf(m)}</option>
                    ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">Start</label>
                      <input type="date" className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]" value={memberForm.startDate} onChange={(e) => setMemberForm({ ...memberForm, startDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">End</label>
                      <input type="date" className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]" value={memberForm.endDate} onChange={(e) => setMemberForm({ ...memberForm, endDate: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">Repeat</label>
                    <select className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]" value={memberForm.repeatType} onChange={(e) => setMemberForm({ ...memberForm, repeatType: e.target.value, repeatDays: ["WEEKLY", "CUSTOM"].includes(e.target.value) ? memberForm.repeatDays : [] })}>
                      {repeatTypes.map((rt) => <option key={rt} value={rt}>{titleCase(rt)}</option>)}
                    </select>
                  </div>
                  {(memberForm.repeatType === "WEEKLY" || memberForm.repeatType === "CUSTOM") && (
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">Repeat Days</label>
                      <div className="flex flex-wrap gap-6">
                        {dayOfWeekOptions.map((day) => (
                          <label key={day} className="inline-flex items-center gap-1 text-[10px] text-gray-700">
                            <input
                              type="checkbox"
                              checked={memberForm.repeatDays.includes(day)}
                              onChange={(e) => {
                                setMemberForm({
                                  ...memberForm,
                                  repeatDays: e.target.checked
                                    ? [...memberForm.repeatDays, day]
                                    : memberForm.repeatDays.filter((d) => d !== day),
                                });
                              }}
                              className="rounded border-[#0D8252]/20 accent-[#0D8252] focus:ring-2 focus:ring-[#0D8252]/20 cursor-pointer"
                            />
                            {day.slice(0, 3)}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* {memberForm.repeatType !== "NONE" && (
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">Repeat End Date</label>
                      <input type="date" className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]" value={memberForm.repeatEndDate} onChange={(e) => setMemberForm({ ...memberForm, repeatEndDate: e.target.value })} />
                    </div>
                  )} */}
                  {renderSchedulePreview()}
                  <button type="submit" disabled={assigningWorkout || !memberPlanId || !memberForm.memberId} className="inline-flex w-full justify-center h-8 items-center gap-1.5 rounded-lg bg-[#0D8252] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{assigningWorkout ? "Assigning..." : <><Plus size={14} /> Assign</>}</button>
                </form>}
              </>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
            <button type="button" onClick={closeMemberModal} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
            {memberActionMode === "edit" && <button type="button" onClick={() => handleUpdateAssignment(editingId)} disabled={!editingId || updatingAssignment} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50">{updatingAssignment ? "Updating..." : "Update Assignment"}</button>}
            {memberActionMode === "reassign" && <button type="button" onClick={() => handleReassign(reassignId)} disabled={!reassignId || !reassignForm.newPlanId || reassigningWorkout} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50">{reassigningWorkout ? "Reassigning..." : <><ArrowRightLeft size={14} /> Reassign</>}</button>}
            {memberActionMode === "unassign" && <button type="button" onClick={() => handleUnassign(confirmingId)} disabled={!confirmingId} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">Confirm Unassign</button>}
          </div>
        </section>
        </div>
      )}
      {showScheduleDatesModal && showMemberModal && schedulePreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/35 p-3 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setShowScheduleDatesModal(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="schedule-dates-title" className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><CalendarDays size={18} /></div>
                <div>
                  <h2 id="schedule-dates-title" className="text-base font-bold text-[#0F172A]">Scheduled Sessions</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">{schedulePreview.totalSessions ?? scheduledPreviewDates.length} session{(schedulePreview.totalSessions ?? scheduledPreviewDates.length) === 1 ? "" : "s"} scheduled</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowScheduleDatesModal(false)} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label="Close scheduled sessions modal"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {scheduledPreviewDates.length ? (
                <div className="flex flex-wrap gap-2">
                  {scheduledPreviewDates.map((date, index) => (
                    <span key={`${date}-${index}`} className="shrink-0 rounded-full bg-[#0D8252]/10 px-2.5 py-1 text-[10px] font-bold text-[#0D8252]">{date}</span>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-[#64748B]">No sessions scheduled.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={() => setShowScheduleDatesModal(false)} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Close</button>
            </div>
          </section>
        </div>
      )}
      </div>
    </div>
  );
}
