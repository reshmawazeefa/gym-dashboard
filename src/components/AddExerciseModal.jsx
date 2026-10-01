import { useEffect, useState } from "react";
import { ChevronDown, Dumbbell, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { assignExerciseToWorkoutDay, createSupersetGroup, getApiError, getSupersetGroups } from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

const muscleGroupOptions = ["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE", "FULL_BODY"];
const fieldClass = "h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2 text-xs text-[#334155] outline-none focus:border-[#0D8252]";
const primaryButtonClass = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3 text-xs font-semibold text-white transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50";

function Field({ label, children }) {
  return <label className="grid min-w-0 gap-1 text-[9px] font-semibold uppercase text-[#64748B]">{label}{children}</label>;
}

export default function AddExerciseModal({ isOpen, day, exercises = [], user, onClose, onLinked }) {
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState(() => idOf(exercises[0]));
  const [config, setConfig] = useState(() => ({ exerciseId: idOf(exercises[0]), sets: "4", reps: "10", duration: "60", restTime: "90", orderIndex: "1", supersetGroupId: "" }));
  const [supersetGroups, setSupersetGroups] = useState([]);
  const [showSupersetForm, setShowSupersetForm] = useState(false);
  const [supersetForm, setSupersetForm] = useState({ name: "", restAfterRound: "120", orderIndex: "1" });
  const [saving, setSaving] = useState(false);
  const dayId = idOf(day);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !dayId) return undefined;
    let active = true;
    getSupersetGroups(dayId, user?.token).then((response) => {
      const list = Array.isArray(response) ? response : response?.data || response?.supersets || [];
      if (active) setSupersetGroups(list);
    }).catch((error) => {
      if (active) toast.error(getApiError(error, "Unable to load superset groups"));
    });
    return () => { active = false; };
  }, [isOpen, dayId, user?.token]);

  if (!isOpen || !day) return null;

  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch = !search || nameOf(exercise).toLowerCase().includes(search.toLowerCase());
    const matchesMuscle = !muscleFilter || (exercise.muscleGroup || "").toUpperCase() === muscleFilter;
    return matchesSearch && matchesMuscle;
  });
  const selectedExercise = exercises.find((exercise) => idOf(exercise) === selectedExerciseId);

  const selectExercise = (exerciseId) => {
    setSelectedExerciseId(exerciseId);
    setConfig((current) => ({ ...current, exerciseId }));
  };

  const handleCreateSuperset = async (event) => {
    event.preventDefault();
    if (!supersetForm.name.trim()) {
      toast.error("Superset name is required");
      return;
    }
    try {
      await createSupersetGroup(dayId, {
        name: supersetForm.name.trim(),
        restAfterRound: Number(supersetForm.restAfterRound || 0),
        orderIndex: Number(supersetForm.orderIndex || 0),
      }, user?.token);
      const response = await getSupersetGroups(dayId, user?.token);
      const list = Array.isArray(response) ? response : response?.data || response?.supersets || [];
      setSupersetGroups(list);
      const created = list.find((group) => group.name === supersetForm.name.trim());
      if (created) setConfig((current) => ({ ...current, supersetGroupId: idOf(created) }));
      setShowSupersetForm(false);
      setSupersetForm({ name: "", restAfterRound: "120", orderIndex: "1" });
      toast.success("Superset group created");
    } catch (error) {
      toast.error(getApiError(error, "Unable to create superset group"));
    }
  };

  const handleLinkExercise = async (event) => {
    event.preventDefault();
    if (!selectedExerciseId) {
      toast.error("Please select an exercise");
      return;
    }
    const payload = { exerciseId: selectedExerciseId };
    ["sets", "reps", "duration", "restTime", "orderIndex"].forEach((key) => {
      if (config[key] !== "") payload[key] = Number(config[key]);
    });
    if (config.supersetGroupId) payload.supersetGroupId = config.supersetGroupId;
    setSaving(true);
    try {
      await assignExerciseToWorkoutDay(dayId, payload, user?.token);
      toast.success("Exercise linked to day");
      onClose();
      await onLinked();
    } catch (error) {
      toast.error(getApiError(error, "Unable to link exercise"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-2 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Add exercise to workout day" className="relative flex max-h-[calc(100dvh-16px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.2)] min-[520px]:max-h-[calc(100dvh-32px)] min-[520px]:flex-row" onMouseDown={(event) => event.stopPropagation()}>
        <section className="flex min-h-0 flex-1 flex-col border-b border-[#E2E8F0] min-[520px]:border-b-0 min-[520px]:border-r">
          <header className="flex h-[3.5rem] shrink-0 items-center gap-2 border-b border-[#EEF2F4] px-4 text-base font-semibold text-[#334155]">
            Exercise Library
          </header>
          <div className="grid shrink-0 grid-cols-1 gap-2 p-3 min-[520px]:grid-cols-[minmax(0,1fr)_minmax(120px,0.6fr)]">
            <label className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-[#E2E8F0] px-2 text-[#94A3B8]">
              <Search size={12} />
              <input className="min-w-0 flex-1 text-xs text-[#334155] outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises..." />
            </label>
            <label className="relative flex h-9 min-w-0 items-center">
              <select className={`${fieldClass} appearance-none pr-6`} value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)}>
                <option value="">All Muscle Groups</option>
                {muscleGroupOptions.map((group) => <option key={group} value={group}>{titleCase(group)}</option>)}
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-2 text-[#64748B]" />
            </label>
          </div>
          <div className="min-h-0 flex-1 divide-y space-y-2 divide-[#F1F5F9] overflow-y-auto px-3 pb-3">
            {filteredExercises.map((exercise) => {
              const exerciseId = idOf(exercise);
              const selected = selectedExerciseId === exerciseId;
              return (
                <button key={exerciseId} type="button" onClick={() => selectExercise(exerciseId)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition ${selected ? "border border-[#C5EFD7] bg-[#F3FBF6]" : "border border-transparent hover:bg-[#F8FAFC]"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${selected ? "bg-[#E1F7E9] text-[#0D8252]" : "bg-[#F1F5F9] text-[#94A3B8]"}`}><Dumbbell size={11} /></span>
                  <span className="min-w-0">
                    <span className={`block truncate text-xs font-semibold ${selected ? "text-[#0D8252]" : "text-[#334155]"}`}>{nameOf(exercise)}</span>
                    <span className="block truncate text-[9px] text-[#94A3B8]">{titleCase(exercise.muscleGroup || "Full Body")}</span>
                  </span>
                </button>
              );
            })}
            {filteredExercises.length === 0 && <p className="py-5 text-center text-xs text-[#94A3B8]">No exercises found.</p>}
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col">
          <header className="flex h-[3.5rem] shrink-0 items-center justify-between border-b border-[#EEF2F4] px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Dumbbell size={15} /></div>
              <h2 className="truncate text-base font-semibold text-[#334155]">Link Exercise</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded p-1 text-[#94A3B8] hover:bg-[#F1F5F9]" aria-label="Close"><X size={13} /></button>
          </header>
          <p className="shrink-0 px-4 py-2 text-[10px] text-[#94A3B8]">{selectedExercise ? `Configuring ${nameOf(selectedExercise)}` : "Select an exercise to configure"}</p>
          <form onSubmit={handleLinkExercise} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Sets"><input className={fieldClass} type="number" min="0" value={config.sets} onChange={(event) => setConfig({ ...config, sets: event.target.value })} /></Field>
                <Field label="Reps"><input className={fieldClass} type="number" min="0" value={config.reps} onChange={(event) => setConfig({ ...config, reps: event.target.value })} /></Field>
                <Field label="Duration (seconds)"><input className={fieldClass} type="number" min="0" value={config.duration} onChange={(event) => setConfig({ ...config, duration: event.target.value })} /></Field>
                <Field label="Rest (seconds)"><input className={fieldClass} type="number" min="0" value={config.restTime} onChange={(event) => setConfig({ ...config, restTime: event.target.value })} /></Field>
              </div>
              <Field label="Order Index"><input className={fieldClass} type="number" min="0" value={config.orderIndex} onChange={(event) => setConfig({ ...config, orderIndex: event.target.value })} /></Field>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <Field label="Superset Group">
                  <select className={fieldClass} value={config.supersetGroupId} onChange={(event) => setConfig({ ...config, supersetGroupId: event.target.value })}>
                    <option value="">No superset</option>
                    {supersetGroups.map((group) => <option key={idOf(group)} value={idOf(group)}>{group.name || `Superset ${idOf(group).slice(-4)}`}</option>)}
                  </select>
                </Field>
                <button type="button" onClick={() => setShowSupersetForm(true)} className="inline-flex h-9 items-center gap-1 rounded-md border border-[#E2E8F0] px-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"><Plus size={11} /> New</button>
              </div>
            </div>
            <footer className="shrink-0 border-t border-[#EEF2F4] p-3 min-[520px]:p-2">
              <button type="submit" disabled={saving || !selectedExerciseId} className={`${primaryButtonClass} w-full`}>{saving ? "Linking..." : "Link to Day"}</button>
            </footer>
          </form>
        </section>

        {showSupersetForm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/45 p-3 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && setShowSupersetForm(false)}>
            <form onSubmit={handleCreateSuperset} className="w-full max-w-xs rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-[#334155]">NEW SUPERSET</h3>
                <button type="button" onClick={() => setShowSupersetForm(false)} className="rounded p-1 text-[#94A3B8] hover:bg-[#F1F5F9]" aria-label="Close new superset"><X size={12} /></button>
              </div>
              <div className="grid gap-2.5">
                <Field label="Superset Name"><input autoFocus className={fieldClass} value={supersetForm.name} onChange={(event) => setSupersetForm({ ...supersetForm, name: event.target.value })} placeholder="Superset A" /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Rest After Round"><input className={fieldClass} type="number" min="0" value={supersetForm.restAfterRound} onChange={(event) => setSupersetForm({ ...supersetForm, restAfterRound: event.target.value })} /></Field>
                  <Field label="Order Index"><input className={fieldClass} type="number" min="0" value={supersetForm.orderIndex} onChange={(event) => setSupersetForm({ ...supersetForm, orderIndex: event.target.value })} /></Field>
                </div>
                <button type="submit" className={`${primaryButtonClass} w-full`}>Create Superset</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}