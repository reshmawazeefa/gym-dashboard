import React, { useState } from "react";
import { Plus, Edit, Trash } from "lucide-react";

export default function MealPlanListView({ plans, meals, onCreate, onEdit, onDelete, token, getPlanNutritionSummary }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [goalFilter, setGoalFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const activePlans = plans.filter((p) => !p.archived).length;
  const draftPlans = plans.filter((p) => p.draft).length;
  const archivedPlans = plans.filter((p) => p.archived).length;

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch = plan.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGoal = goalFilter === "ALL" || plan.goal === goalFilter;
    const matchesStatus = statusFilter === "ALL" || (statusFilter === "Active" && !plan.archived) || (statusFilter === "Archived" && plan.archived);
    return matchesSearch && matchesGoal && matchesStatus;
  });

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-950">Meal Plans</h2>
          <p className="mt-2 text-sm text-gray-500">Create and manage meal plans for your clients.</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Create Meal Plan
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Plans", value: plans.length, icon: "📋" },
          { label: "Active Plans", value: activePlans, icon: "✅" },
          { label: "Draft Plans", value: draftPlans, icon: "📝" },
          { label: "Archived Plans", value: archivedPlans, icon: "📦" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{stat.icon}</div>
              <div>
                <div className="text-sm text-gray-600">{stat.label}</div>
                <div className="text-2xl font-bold text-gray-950">{stat.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search meal plans by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-4 pr-10 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <svg
            className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2">
          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="ALL">All Goals</option>
            <option value="WEIGHT_LOSS">WEIGHT_LOSS</option>
            <option value="WEIGHT_GAIN">WEIGHT_GAIN</option>
            <option value="MAINTAIN_WEIGHT">MAINTAIN_WEIGHT</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Plans Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">PLAN NAME</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">GOAL</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">DURATION</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">MEALS/DAY</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">CALORIES (AVG)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map((plan) => {
              const totalMeals = plan.days?.reduce((sum, day) => sum + (day.meals?.length || 0), 0) || 0;
              const mealsPerDay = plan.days?.length ? Math.round(totalMeals / plan.days.length) : 0;
              const planNutrition = getPlanNutritionSummary(plan);
              const avgCalories = planNutrition && planNutrition.calories ? Math.round(planNutrition.calories / (plan.duration || 1)) : 0;

              return (
                <tr key={plan.id || plan._id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{plan.name}</div>
                    <div className="text-sm text-gray-500">Created by You</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                      {plan.goal === "WEIGHT_LOSS" && "🔥 "}
                      {plan.goal === "WEIGHT_GAIN" && "💪 "}
                      {plan.goal === "MAINTAIN_WEIGHT" && "⚖️ "}
                      {plan.goal}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{plan.duration} days</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{mealsPerDay} meals</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{avgCalories} kcal</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(plan)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(plan)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredPlans.length && (
          <div className="flex items-center justify-center py-12 text-center">
            <div>
              <div className="text-gray-500">No meal plans found</div>
              <p className="mt-1 text-sm text-gray-600">Create your first meal plan to get started.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
