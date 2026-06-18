import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash } from "lucide-react";
import toast from "react-hot-toast";

export default function MealPlanEditForm({ plan, meals, onSave, onCancel, getPlanNutritionSummary }) {
  const [editing, setEditing] = useState(plan);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  useEffect(() => {
    setEditing(plan);
    setSelectedDayIndex(0);
  }, [plan]);

  const currentDay = editing.days?.[selectedDayIndex];
  const planNutrition = getPlanNutritionSummary(editing);
  const daysCompleted = (editing.days || []).filter((day) => (day.meals || []).length > 0).length;

  const updateDay = (index, next) => {
    setEditing((prev) => {
      const days = [...(prev.days || [])];
      days[index] = { ...days[index], ...next };
      return { ...prev, days };
    });
  };

  const updateMeal = (dayIndex, mealIndex, next) => {
    setEditing((prev) => {
      const days = [...(prev.days || [])];
      const day = { ...days[dayIndex], meals: [...(days[dayIndex]?.meals || [])] };
      day.meals[mealIndex] = { ...day.meals[mealIndex], ...next };
      days[dayIndex] = day;
      return { ...prev, days };
    });
  };

  const addDay = () => {
    const nextDayNumber = (editing.days?.length ?? 0) + 1;
    setEditing((prev) => ({
      ...prev,
      days: [
        ...(prev.days || []),
        {
          dayNumber: nextDayNumber,
          title: `Day ${nextDayNumber}`,
          notes: "",
          meals: [{ mealId: "", mealType: "BREAKFAST", time: "08:00" }],
        },
      ],
      duration: (prev.days?.length ?? 0) + 1,
    }));
  };

  const removeDay = (index) => {
    if (editing.days?.length > 1) {
      setEditing((prev) => ({
        ...prev,
        days: prev.days?.filter((_, i) => i !== index),
      }));
      if (selectedDayIndex >= (editing.days?.length || 1) - 1) {
        setSelectedDayIndex(Math.max(0, (editing.days?.length || 1) - 2));
      }
    } else {
      toast.error("Plan must have at least 1 day");
    }
  };

  const addMeal = (dayIndex) => {
    setEditing((prev) => {
      const days = [...(prev.days || [])];
      const day = { ...days[dayIndex], meals: [...(days[dayIndex]?.meals || [])] };
      day.meals.push({ mealId: "", mealType: "BREAKFAST", time: "08:00" });
      days[dayIndex] = day;
      return { ...prev, days };
    });
  };

  const removeMeal = (dayIndex, mealIndex) => {
    setEditing((prev) => {
      const days = [...(prev.days || [])];
      const day = { ...days[dayIndex], meals: days[dayIndex]?.meals.filter((_, i) => i !== mealIndex) };
      days[dayIndex] = day;
      return { ...prev, days };
    });
  };

  const handleSave = () => {
    const payload = {
      name: editing.name,
      goal: editing.goal,
      duration: Number(editing.duration),
      days: editing.days.map((day) => ({
        dayNumber: Number(day.dayNumber),
        title: day.title,
        notes: day.notes,
        meals: (day.meals || []).map((meal) => ({
          mealId: meal.mealId,
          mealType: meal.mealType || "BREAKFAST",
          time: meal.time || "08:00",
        })),
      })),
    };
    onSave(payload, editing);
  };

  return (
    <section className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="text-blue-600 cursor-pointer hover:underline">Nutrition</span>
        <span>›</span>
        <span className="text-blue-600 cursor-pointer hover:underline">Meal Plans</span>
        <span>›</span>
        <span className="text-gray-900 font-medium">{plan.name ? "Edit Meal Plan" : "Create Meal Plan"}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-950">{editing.name || "Meal Plan"}</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save Plan
          </button>
        </div>
      </div>

      {/* Meal Plan Information */}
      <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h3 className="text-sm font-semibold text-gray-950 mb-4">Meal Plan Information</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Plan Name</label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Cutting Diet - 7 Day"
              className="mt-2 w-full rounded-md border p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Goal</label>
            <select
              value={editing.goal}
              onChange={(e) => setEditing({ ...editing, goal: e.target.value })}
              className="mt-2 w-full rounded-md border p-2 text-sm"
            >
              <option value="WEIGHT_LOSS">WEIGHT_LOSS</option>
              <option value="WEIGHT_GAIN">WEIGHT_GAIN</option>
              <option value="MAINTAIN_WEIGHT">MAINTAIN_WEIGHT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Duration (Days)</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                value={editing.duration}
                onChange={(e) => setEditing({ ...editing, duration: Number(e.target.value) })}
                className="mt-2 w-full rounded-md border p-2 text-sm"
              />
              {editing.duration === editing.days?.length && (
                <div className="absolute right-3 top-2.5 flex items-center gap-1 text-xs text-green-600">
                  ✓ Duration matches configured days
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr_350px]">
        {/* Left Sidebar - Days */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-950">Days ({editing.days?.length ?? 0})</h3>
            <div className="text-xs text-gray-500">{daysCompleted} of {editing.days?.length} completed</div>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${editing.days?.length ? (daysCompleted / editing.days.length) * 100 : 0}%` }}
            />
          </div>

          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {(editing.days || []).map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedDayIndex(index)}
                className={`w-full rounded-lg border-2 p-3 text-left transition ${
                  index === selectedDayIndex ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                        {day.dayNumber}
                      </span>
                      <span className="text-sm font-medium text-gray-900">Day {day.dayNumber}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{day.meals?.length || 0} meals</div>
                  </div>
                  {day.meals?.length > 0 ? (
                    <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 100 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={addDay}
            className="mt-4 w-full rounded-md border-2 border-dashed border-gray-300 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50"
          >
            + Add Day
          </button>
        </div>

        {/* Center - Day Details */}
        <div className="space-y-4">
          {currentDay && (
            <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-950">Day {currentDay.dayNumber}</h3>
                {(currentDay.meals?.length ?? 0) > 0 && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Complete</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeDay(selectedDayIndex)}
                className="mb-4 inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash size={14} /> Delete Day
              </button>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    value={currentDay.title}
                    onChange={(e) => updateDay(selectedDayIndex, { title: e.target.value })}
                    className="mt-2 w-full rounded-md border p-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea
                  value={currentDay.notes}
                  onChange={(e) => updateDay(selectedDayIndex, { notes: e.target.value })}
                  className="mt-2 w-full rounded-md border p-2 text-sm"
                  rows={3}
                  placeholder="Hydration focus"
                />
              </div>

              <div className="mt-6">
                <h4 className="mb-4 text-sm font-semibold text-gray-950">Meals</h4>
                <div className="space-y-3">
                  {(currentDay.meals || []).map((meal, mealIndex) => {
                    const mealObject = meals.find((m) => (m.id || m._id) === meal.mealId);
                    return (
                      <div key={mealIndex} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                                <span className="text-lg">🍽️</span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{mealObject?.name || "Select Meal"}</div>
                                <div className="text-xs text-gray-500">
                                  {meal.mealType} {mealObject && `• ${mealObject.nutrition?.calories || 0} kcal`}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" className="text-blue-600 hover:text-blue-700">
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMeal(selectedDayIndex, mealIndex)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <select
                            value={meal.mealId}
                            onChange={(e) => {
                              const selectedMeal = meals.find((m) => (m.id || m._id) === e.target.value);
                              updateMeal(selectedDayIndex, mealIndex, {
                                mealId: e.target.value,
                                mealType: selectedMeal?.mealType || meal.mealType || "BREAKFAST",
                              });
                            }}
                            className="w-full rounded-md border p-2 text-sm"
                          >
                            <option value="">Select meal</option>
                            {meals.map((m) => (
                              <option key={m.id || m._id} value={m.id || m._id}>
                                {m.name} ({m.mealType})
                              </option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={meal.time}
                            onChange={(e) => updateMeal(selectedDayIndex, mealIndex, { time: e.target.value })}
                            className="w-full rounded-md border p-2 text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => addMeal(selectedDayIndex)}
                  className="mt-4 w-full rounded-md border border-blue-600 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  + Add Meal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Nutrition Summary */}
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 h-fit">
          <h3 className="text-sm font-semibold text-gray-950">Nutrition Summary (Day {currentDay?.dayNumber})</h3>

          {/* Donut Chart */}
          <div className="mt-4 flex items-center justify-center">
            <div className="relative h-40 w-40">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="12"
                  strokeDasharray={`${(planNutrition.calories / 2000) * 282} 282`}
                  strokeDashoffset="0"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold text-gray-950">{Math.round(planNutrition.calories)}</div>
                <div className="text-xs text-gray-600">kcal</div>
                <div className="mt-1 text-xs text-gray-500">of 2000 kcal</div>
              </div>
            </div>
          </div>

          {/* Macro Breakdown */}
          <div className="mt-6 space-y-4">
            {[
              { label: "Calories", value: Math.round(planNutrition.calories), target: 2000, color: "bg-green-600" },
              { label: "Protein", value: Math.round(planNutrition.proteinG), target: 180, color: "bg-blue-600" },
              { label: "Carbs", value: Math.round(planNutrition.carbsG), target: 250, color: "bg-orange-500" },
              { label: "Fat", value: Math.round(planNutrition.fatG), target: 70, color: "bg-purple-600" },
            ].map((item) => {
              const percent = Math.min(100, (item.value / item.target) * 100);
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.value} / {item.target}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div className={`${item.color} h-full`} style={{ width: `${percent}%` }} />
                  </div>
                  <div className="mt-1 text-right text-xs text-gray-500">{Math.round(percent)}%</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
            ℹ Nutrition values are estimated based on selected meals.
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 flex-shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <div className="font-medium text-green-900">Tips</div>
            <div className="mt-1 text-sm text-green-800">Make sure each day has at least one meal and total days equals the duration.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
