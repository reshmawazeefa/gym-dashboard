import React, { useState } from "react";
import { Archive, CheckCircle2, ClipboardList, Download, Edit, Eye, FilePenLine, Plus, Search, Trash } from "lucide-react";
import TablePagination from "./TablePagination";

const getPlanStatus = (plan) => (plan.draft ? "Draft" : plan.archived ? "Archived" : plan.isActive === false ? "Inactive" : "Active");
const formatCreatedDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString();
};

export default function MealPlanListView({ plans, meals, onCreate, onEdit, onView, onDelete, getPlanNutritionSummary, page, limit, totalCount, totalPages, loading, error, onPageChange, onLimitChange, onRetry }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [goalFilter, setGoalFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const activePlans = plans.filter((plan) => getPlanStatus(plan) === "Active").length;
  const draftPlans = plans.filter((plan) => getPlanStatus(plan) === "Draft").length;
  const archivedPlans = plans.filter((plan) => getPlanStatus(plan) === "Archived").length;

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch = String(plan.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGoal = goalFilter === "ALL" || plan.goal === goalFilter;
    const matchesStatus = statusFilter === "ALL" || getPlanStatus(plan) === statusFilter;
    return matchesSearch && matchesGoal && matchesStatus;
  });

  const paginatedPlans = filteredPlans;
  const resetPage = () => {
    if (page !== 1) onPageChange(1);
  };

  const handleExportCSV = () => {
    const headers = ["Plan Name", "Goal", "Duration (days)", "Meals Per Day", "Total Meals", "Calories (Avg)", "Status"];
    const rows = filteredPlans.map((plan) => {
      const totalMeals = plan.days?.reduce((sum, day) => sum + (day.meals?.length || 0), 0) || 0;
      const mealsPerDay = plan.days?.length ? Math.round(totalMeals / plan.days.length) : 0;
      const planNutrition = getPlanNutritionSummary(plan);
      const avgCalories = planNutrition?.calories ? Math.round(planNutrition.calories / (plan.duration || 1)) : 0;
      const status = getPlanStatus(plan);
      return [plan.name, plan.goal, plan.duration, mealsPerDay, totalMeals, avgCalories, status];
    });

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meal-plans-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { label: "Total Plans", value: totalCount, icon: ClipboardList, tone: "bg-orange-50 text-orange-500" },
    { label: "Active on Page", value: activePlans, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-500" },
    { label: "Draft on Page", value: draftPlans, icon: FilePenLine, tone: "bg-violet-50 text-violet-500" },
    { label: "Archived on Page", value: archivedPlans, icon: Archive, tone: "bg-amber-50 text-amber-600" },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-base font-bold">Meal Plans</h2>
          <p className="mt-0.5 text-xs text-[#64748B]">Create and manage meal plans for your clients.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex min-h-[100px] items-center justify-between rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">{value}</p></div>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
        <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <Search size={14} className="shrink-0 text-[#94A3B8]" />
            <input type="text" placeholder="Search meal plans by name..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); resetPage(); }} className="w-full min-w-0 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
            <select value={goalFilter} onChange={(event) => { setGoalFilter(event.target.value); resetPage(); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"><option value="ALL">All Goals</option><option value="WEIGHT_LOSS">WEIGHT_LOSS</option><option value="WEIGHT_GAIN">WEIGHT_GAIN</option><option value="MAINTAIN_WEIGHT">MAINTAIN_WEIGHT</option></select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); resetPage(); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"><option value="ALL">All Statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Draft">Draft</option><option value="Archived">Archived</option></select>
            <label className="flex items-center gap-1.5">Rows
              <select value={limit} onChange={(event) => onLimitChange(Number(event.target.value))} className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none">
                <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]"><tr><th className="px-4 py-3">Plan Name</th><th className="px-4 py-3">Goal</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Meals/Day</th><th className="px-4 py-3">Calories (Avg)</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="7" className="px-4 py-10 text-center text-xs text-[#64748B]">Loading meal plans...</td></tr>}
              {!loading && error && <tr><td colSpan="7" className="px-4 py-8 text-center text-xs text-rose-600">{error} <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">Retry</button></td></tr>}
              {!loading && !error && paginatedPlans.map((plan) => {
                const totalMeals = plan.days?.reduce((sum, day) => sum + (day.meals?.length || 0), 0) || 0;
                const mealsPerDay = plan.days?.length ? Math.round(totalMeals / plan.days.length) : 0;
                const planNutrition = getPlanNutritionSummary(plan);
                const avgCalories = planNutrition?.calories ? Math.round(planNutrition.calories / (plan.duration || 1)) : 0;
                const goalLabel = String(plan.goal || "MAINTAIN_WEIGHT").replaceAll("_", " ");
                const goalTone = plan.goal === "WEIGHT_GAIN" ? "bg-sky-50 text-sky-700" : plan.goal === "MAINTAIN_WEIGHT" ? "bg-slate-100 text-slate-700" : "bg-orange-50 text-orange-700";
                const status = getPlanStatus(plan);
                const statusTone = status === "Active" ? "bg-emerald-50 text-emerald-700" : status === "Inactive" ? "bg-slate-100 text-slate-600" : status === "Draft" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-700";
                return <tr key={plan.id || plan._id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]"><td className="px-4 py-3"><p className="font-bold text-[#0F172A]">{plan.name || "Unnamed plan"}</p><p className="text-[10px] text-[#94A3B8]">Created {formatCreatedDate(plan.createdAt)}</p></td><td className="px-4 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-bold uppercase ${goalTone}`}>{goalLabel}</span></td><td className="px-4 py-3"><p>{plan.duration || 0} days</p><p className="text-[10px] text-[#94A3B8]">{plan.days?.length || 0} scheduled days</p></td><td className="px-4 py-3">{mealsPerDay} meals</td><td className="px-4 py-3 font-semibold text-[#0F172A]">{avgCalories} kcal</td><td className="px-4 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-bold uppercase ${statusTone}`}>{status}</span></td><td className="px-4 py-3"><div className="flex justify-center gap-3"><button type="button" onClick={() => onView(plan)} className="rounded-lg text-slate-500 transition hover:text-slate-800" aria-label={`View ${plan.name}`} title="View plan"><Eye size={15} /></button><button type="button" onClick={() => onEdit(plan)} className="rounded-lg text-[#0D8252] transition hover:text-[#065F46]" aria-label={`Edit ${plan.name}`} title="Edit plan"><Edit size={15} /></button><button type="button" onClick={() => onDelete(plan)} className="rounded-lg text-rose-500 transition hover:text-rose-700" aria-label={`Delete ${plan.name}`} title="Delete plan"><Trash size={14} /></button></div></td></tr>;
              })}
              {!loading && !error && !filteredPlans.length && <tr><td colSpan="7" className="px-4 py-10 text-center text-xs text-[#64748B]">No meal plans found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between"><p>Page {page} of {totalPages} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {paginatedPlans.length} of {totalCount} records</p><TablePagination page={page} totalPages={totalPages} onPageChange={onPageChange} disabled={loading} previousLabel="Prev" /></div>
      </section>
    </section>
  );
}
