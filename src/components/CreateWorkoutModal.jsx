import { UserPlus, X } from "lucide-react";

const goals = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_BURN"];
const difficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

function titleCase(value) {
  return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

const inputClass = "h-8 w-full rounded-lg border border-[#E2E8F0]/20 bg-[#FBFCFD] px-3 text-xs text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252]/30 focus:bg-white disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]";
const primaryButtonClass = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60";

function Field({ label, children }) {
  return <label className="grid gap-1 text-xs font-semibold uppercase text-gray-500">{label}{children}</label>;
}

export default function CreateWorkoutModal({ isOpen, editingPlanId, planForm, setPlanForm, canManage, onSubmit, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><UserPlus size={15} /></div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">{editingPlanId ? "Edit Workout" : "Create Workout"}</h3>
              <p className="mt-0.5 text-xs leading-4 text-[#64748B]">Create or edit a plan with a name, goal, and schedule.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]" aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-2.5 p-4">
          <Field label="Workout Name">
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
          <Field label="Description">
            <textarea className="min-h-20 w-full rounded-lg border border-[#E2E8F0] bg-[#FBFCFD] px-3 py-2 text-xs text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0D8252] focus:bg-white" value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} placeholder="Plan focus" />
          </Field>
          <div className="mt-1 grid gap-1.5">
            <button type="submit" className={`${primaryButtonClass} w-full`} disabled={!canManage}>{editingPlanId ? "Update Plan" : "Create Plan"}</button>
            <button type="button" onClick={onClose} className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
