import { useState, useEffect } from "react";
import { Plus, Trash, UserPlus, Users, Pencil, X, CalendarDays, ArrowRightLeft } from "lucide-react";
import toast from "react-hot-toast";
import {
  assignTrainerToWorkoutPlan, getWorkoutTrainers, removeWorkoutTrainerAssignment,
  assignWorkoutToMember, getMyWorkoutAssignments, getUserWorkouts,
  updateWorkoutAssignment, unassignWorkout, reassignWorkout,
  getApiError
} from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function displayDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";
const softButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

const trainerRoles = ["PRIMARY", "ASSISTANT", "SUBSTITUTE"];
const repeatTypes = ["NONE", "DAILY", "WEEKLY", "CUSTOM"];
const dayOfWeekOptions = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function trainerAssignmentId(assignment) {
  return assignment?.trainerId || assignment?.userId || idOf(assignment?.trainer) || idOf(assignment?.user) || idOf(assignment?.trainerDetails) || idOf(assignment?.userDetails) || idOf(assignment) || "";
}

function trainerAssignmentName(assignment) {
  return assignment?.trainer?.name || assignment?.trainer?.fullName || assignment?.user?.name || assignment?.user?.fullName || assignment?.trainerDetails?.name || assignment?.trainerDetails?.fullName || assignment?.trainerName || assignment?.userName || nameOf(assignment?.trainer || assignment?.user || assignment?.trainerDetails || assignment?.userDetails || assignment);
}

function assignmentMemberId(assignment) {
  return assignment?.memberId || assignment?.userId || idOf(assignment?.member) || idOf(assignment?.user) || idOf(assignment?.memberDetails) || idOf(assignment?.userDetails) || "";
}

function assignmentMemberName(assignment) {
  return assignment?.member?.name || assignment?.member?.fullName || assignment?.user?.name || assignment?.user?.fullName || assignment?.memberDetails?.name || assignment?.memberDetails?.fullName || assignment?.memberName || assignment?.userName || nameOf(assignment?.member || assignment?.user || assignment?.memberDetails || assignment?.userDetails || assignment);
}

function assignmentDates(assignment) {
  const sd = assignment?.startDate || assignment?.start_date || assignment?.assignment?.startDate || assignment?.assignment?.start_date || "";
  const ed = assignment?.endDate || assignment?.end_date || assignment?.assignment?.endDate || assignment?.assignment?.end_date || "";
  return { startDate: sd, endDate: ed };
}

function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

export default function WorkoutAssignments(props) {
  const { user, role, canManage, canEdit, canDelete, canAssign, canManageAssignments, plans, selectedPlan, selectedPlanId, members, trainers, planTrainers, setPlanTrainers, assignments, setAssignments, loadPlans, refreshSelectedPlan } = props;

  const [trainerPlanId, setTrainerPlanId] = useState("");
  const [currentTrainers, setCurrentTrainers] = useState([]);
  const [trainerForm, setTrainerForm] = useState({ trainerId: "", role: "PRIMARY" });

  const [memberPlanId, setMemberPlanId] = useState("");
  const [currentMembers, setCurrentMembers] = useState([]);
  const [memberForm, setMemberForm] = useState({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [] });
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({ startDate: "", endDate: "" });
  const [confirmingId, setConfirmingId] = useState("");
  const [unassignReason, setUnassignReason] = useState("");
  const [unassignNote, setUnassignNote] = useState("");
  const [reassignId, setReassignId] = useState("");
  const [reassignForm, setReassignForm] = useState({ newPlanId: "", reason: "" });

  useEffect(() => {
    if (!trainerPlanId) { setCurrentTrainers([]); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await getWorkoutTrainers(trainerPlanId, user?.token);
        if (cancelled) return;
        const list = Array.isArray(response) ? response : (response?.trainers || response?.trainerAssignments || response?.data || []);
        setCurrentTrainers(list);
      } catch (error) {
        if (!cancelled) toast.error(getApiError(error, "Failed to load trainers"));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [trainerPlanId, user?.token]);

  useEffect(() => {
    if (!memberPlanId) { setCurrentMembers([]); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const plan = plans.find((p) => idOf(p) === memberPlanId);
        const planMembers = plan?.assignments || plan?.memberAssignments || plan?.workoutAssignments || plan?.members || [];
        const filtered = assignments.filter((a) => {
          const pid = a?.planId || a?.workoutId || a?.workoutPlanId || idOf(a?.plan) || idOf(a?.workout) || idOf(a?.workoutPlan);
          return String(pid) === String(memberPlanId);
        });
        if (!cancelled) setCurrentMembers(filtered.length ? filtered : planMembers);
      } catch (error) {
        if (!cancelled) setCurrentMembers([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [memberPlanId, plans, assignments, user?.token]);

  const handleAssignTrainer = async (e) => {
    e.preventDefault();
    if (!trainerPlanId || !trainerForm.trainerId) { toast.error("Select a plan and trainer"); return; }
    try {
      await assignTrainerToWorkoutPlan(trainerPlanId, { trainerId: trainerForm.trainerId, role: trainerForm.role }, user?.token);
      toast.success("Trainer assigned");
      setTrainerForm({ trainerId: "", role: "PRIMARY" });
      const response = await getWorkoutTrainers(trainerPlanId, user?.token);
      const list = Array.isArray(response) ? response : (response?.trainers || response?.trainerAssignments || response?.data || []);
      setCurrentTrainers(list);
      if (setPlanTrainers) setPlanTrainers(list);
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign trainer"));
    }
  };

  const handleRemoveTrainer = async (tId) => {
    if (!trainerPlanId) return;
    try {
      await removeWorkoutTrainerAssignment(trainerPlanId, tId, user?.token);
      toast.success("Trainer removed");
      setCurrentTrainers((prev) => prev.filter((t) => trainerAssignmentId(t) !== tId));
      if (setPlanTrainers) setPlanTrainers((prev) => prev.filter((t) => trainerAssignmentId(t) !== tId));
    } catch (error) {
      toast.error(getApiError(error, "Unable to remove trainer"));
    }
  };

  const handleAssignMember = async (e) => {
    e.preventDefault();
    if (!memberPlanId || !memberForm.memberId) { toast.error("Select a plan and member"); return; }
    try {
      const payload = { userId: memberForm.memberId };
      if (memberForm.startDate) payload.startDate = memberForm.startDate;
      if (memberForm.endDate) payload.endDate = memberForm.endDate;
      if (memberForm.repeatType && memberForm.repeatType !== "NONE") {
        payload.repeatType = memberForm.repeatType;
        if (memberForm.repeatType === "CUSTOM" && memberForm.repeatDays.length) {
          const dayMap = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 };
          payload.repeatDays = memberForm.repeatDays.map((d) => dayMap[d] || d);
        }
      }
      await assignWorkoutToMember(memberPlanId, payload, user?.token);
      toast.success("Workout assigned to member");
      setMemberForm({ memberId: "", startDate: "", endDate: "", repeatType: "NONE", repeatDays: [] });
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to assign workout"));
    }
  };

  const handleUpdateAssignment = async (aId) => {
    try {
      const payload = {};
      if (editForm.startDate) payload.startDate = editForm.startDate;
      if (editForm.endDate) payload.endDate = editForm.endDate;
      await updateWorkoutAssignment(aId, payload, user?.token);
      toast.success("Assignment updated");
      setEditingId("");
      setEditForm({ startDate: "", endDate: "" });
      if (setAssignments) {
        setAssignments((prev) => prev.map((a) => (idOf(a) === aId ? { ...a, ...payload } : a)));
      }
      setCurrentMembers((prev) => prev.map((a) => (idOf(a) === aId ? { ...a, ...payload } : a)));
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to update assignment"));
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
      if (setAssignments) setAssignments((prev) => prev.filter((a) => idOf(a) !== aId));
      setCurrentMembers((prev) => prev.filter((a) => idOf(a) !== aId));
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to unassign member"));
    }
  };

  const handleReassign = async (aId) => {
    if (!reassignForm.newPlanId) { toast.error("Select a new workout plan"); return; }
    try {
      await reassignWorkout(aId, { newPlanId: reassignForm.newPlanId, ...(reassignForm.reason && { reason: reassignForm.reason }) }, user?.token);
      toast.success("Workout reassigned");
      setReassignId("");
      setReassignForm({ newPlanId: "", reason: "" });
      await loadPlans();
    } catch (error) {
      toast.error(getApiError(error, "Unable to reassign workout"));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canManageAssignments && (
        <section className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 self-start">
          <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <UserPlus size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-950">Assign Trainers</h3>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Workout Plan</label>
              <select className={inputClass} value={trainerPlanId} onChange={(e) => setTrainerPlanId(e.target.value)}>
                <option value="">Select a plan</option>
                {plans.map((plan) => (
                  <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title || "Workout plan"}</option>
                ))}
              </select>
            </div>

            {trainerPlanId && (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500">Current Trainers</span>
                    <span className="text-xs text-gray-400">{currentTrainers.length}</span>
                  </div>
                  {currentTrainers.length === 0 ? (
                    <p className="py-3 text-center text-sm text-gray-400">No trainers assigned</p>
                  ) : (
                    <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                      {currentTrainers.map((t) => {
                        const tId = trainerAssignmentId(t);
                        return (
                          <div key={tId} className="flex items-center justify-between gap-2 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-900">{trainerAssignmentName(t)}</p>
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{t.role || "PRIMARY"}</span>
                            </div>
                            <button type="button" onClick={() => handleRemoveTrainer(tId)} className={iconButtonClass} title="Remove trainer">
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAssignTrainer} className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase text-gray-500">Add a trainer to this plan</p>
                  <select className={inputClass} value={trainerForm.trainerId} onChange={(e) => setTrainerForm({ ...trainerForm, trainerId: e.target.value })}>
                    <option value="">Select trainer</option>
                    {trainers.map((t) => (
                      <option key={idOf(t)} value={idOf(t)}>{nameOf(t)}</option>
                    ))}
                  </select>
                  <select className={inputClass} value={trainerForm.role} onChange={(e) => setTrainerForm({ ...trainerForm, role: e.target.value })}>
                    {trainerRoles.map((r) => (
                      <option key={r} value={r}>{titleCase(r)}</option>
                    ))}
                  </select>
                  <button type="submit" className={primaryButtonClass} disabled={!trainerForm.trainerId}>
                    <Plus size={16} /> Assign
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      )}

      {canAssign && (
        <section className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 self-start">
          <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <Users size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-950">Assign Members</h3>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Workout Plan</label>
              <select className={inputClass} value={memberPlanId} onChange={(e) => setMemberPlanId(e.target.value)}>
                <option value="">Select a plan</option>
                {plans.map((plan) => (
                  <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title || "Workout plan"}</option>
                ))}
              </select>
            </div>

            {memberPlanId && (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500">Current Members</span>
                    <span className="text-xs text-gray-400">{currentMembers.length}</span>
                  </div>
                  {currentMembers.length === 0 ? (
                    <p className="py-3 text-center text-sm text-gray-400">No members assigned</p>
                  ) : (
                    <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                      {currentMembers.map((a) => {
                        const aId = idOf(a);
                        const isEditing = editingId === aId;
                        const { startDate, endDate } = assignmentDates(a);
                        return (
                          <div key={aId} className="px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">{assignmentMemberName(a)}</p>
                                <p className="mt-0.5 text-xs text-gray-500">
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
                                    <button type="button" onClick={() => handleUnassign(aId)} className="inline-flex h-8 items-center justify-center rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white transition hover:bg-red-700">Confirm</button>
                                    <button type="button" onClick={() => { setConfirmingId(""); setUnassignReason(""); setUnassignNote(""); }} className={iconButtonClass} title="Cancel"><X size={15} /></button>
                                  </div>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => { setReassignId(aId); setReassignForm({ newPlanId: "", reason: "" }); }} className={iconButtonClass} title="Reassign to different plan"><ArrowRightLeft size={15} /></button>
                                    <button type="button" onClick={() => { setEditingId(aId); setEditForm({ startDate: toDateInputValue(startDate), endDate: toDateInputValue(endDate) }); }} className={iconButtonClass} title="Update dates"><Pencil size={15} /></button>
                                    <button type="button" onClick={() => setConfirmingId(aId)} className={iconButtonClass} title="Unassign"><Trash size={15} /></button>
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
                                <button type="button" onClick={() => handleUpdateAssignment(aId)} className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700">Save</button>
                                <button type="button" onClick={() => setEditingId("")} className={buttonClass}>Cancel</button>
                              </div>
                            )}
                            {reassignId === aId && (
                              <div className="mt-2 border-t border-gray-100 pt-2 space-y-2">
                                <p className="text-xs font-semibold uppercase text-gray-500">Reassign to New Plan</p>
                                <select className={inputClass} value={reassignForm.newPlanId} onChange={(e) => setReassignForm({ ...reassignForm, newPlanId: e.target.value })}>
                                  <option value="">Select new workout plan</option>
                                  {plans.filter((p) => idOf(p) !== memberPlanId).map((plan) => (
                                    <option key={idOf(plan)} value={idOf(plan)}>{plan.name || plan.title || "Workout plan"}</option>
                                  ))}
                                </select>
                                <input className={inputClass} value={reassignForm.reason} onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })} placeholder="Reason (optional)" />
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleReassign(aId)} className={primaryButtonClass} disabled={!reassignForm.newPlanId}>
                                    <ArrowRightLeft size={16} /> Reassign
                                  </button>
                                  <button type="button" onClick={() => { setReassignId(""); setReassignForm({ newPlanId: "", reason: "" }); }} className={buttonClass}>Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAssignMember} className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase text-gray-500">Assign this plan to a member</p>
                  <select className={inputClass} value={memberForm.memberId} onChange={(e) => setMemberForm({ ...memberForm, memberId: e.target.value })}>
                    <option value="">Select member</option>
                    {members.map((m) => (
                      <option key={idOf(m)} value={idOf(m)}>{nameOf(m)}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-xs font-semibold uppercase text-gray-500">Start</label>
                      <input type="date" className={inputClass} value={memberForm.startDate} onChange={(e) => setMemberForm({ ...memberForm, startDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs font-semibold uppercase text-gray-500">End</label>
                      <input type="date" className={inputClass} value={memberForm.endDate} onChange={(e) => setMemberForm({ ...memberForm, endDate: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-semibold uppercase text-gray-500">Repeat</label>
                    <select className={inputClass} value={memberForm.repeatType} onChange={(e) => setMemberForm({ ...memberForm, repeatType: e.target.value, repeatDays: e.target.value === "CUSTOM" ? memberForm.repeatDays : [] })}>
                      {repeatTypes.map((rt) => <option key={rt} value={rt}>{titleCase(rt)}</option>)}
                    </select>
                  </div>
                  {memberForm.repeatType === "CUSTOM" && (
                    <div>
                      <label className="mb-0.5 block text-xs font-semibold uppercase text-gray-500">Repeat Days</label>
                      <div className="flex flex-wrap gap-2">
                        {dayOfWeekOptions.map((day) => (
                          <label key={day} className="inline-flex items-center gap-1 text-xs text-gray-700">
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
                              className="rounded border-gray-300"
                            />
                            {day.slice(0, 3)}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="submit" className={primaryButtonClass} disabled={!memberForm.memberId}>
                    <Plus size={16} /> Assign
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
