import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash } from "lucide-react";
import toast from "react-hot-toast";

export default function MealPlanEditForm({ plan, meals, onSave, onCancel, getPlanNutritionSummary, embedded = false, showEmbeddedFooter = true, saveActionRef = null }) {
  const [editing, setEditing] = useState(plan);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [mealEditDraft, setMealEditDraft] = useState(null);

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
    const nextDayNumber = Math.max(0, ...(editing.days || []).map((day) => Number(day.dayNumber) || 0)) + 1;
    setEditing((prev) => ({
      ...prev,
      days: [
        ...(prev.days || []),
        {
          dayNumber: nextDayNumber,
          title: `Day ${nextDayNumber}`,
          notes: "",
          meals: [{ mealId: "", mealType: "BREAKFAST", time: "08:00", notes: "", image: "" }],
        },
      ],
      duration: (prev.days?.length ?? 0) + 1,
    }));
  };

  const removeDay = (index) => {
    if (editing.days?.length > 1) {
      const remainingDays = editing.days.filter((_, i) => i !== index);
      setEditing((prev) => ({
        ...prev,
        days: remainingDays,
        duration: remainingDays.length,
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
      day.meals.push({ mealId: "", mealType: "BREAKFAST", time: "08:00", notes: "", image: "" });
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

  const openMealEditor = (dayIndex, mealIndex, meal) => {
    setMealEditDraft({ dayIndex, mealIndex, meal: { ...meal } });
  };

  const saveMealEditor = () => {
    if (!mealEditDraft) return;
    updateMeal(mealEditDraft.dayIndex, mealEditDraft.mealIndex, mealEditDraft.meal);
    setMealEditDraft(null);
  };

  const handleSave = () => {
    const days = editing.days || [];
    const dayNumbers = days.map((day) => Number(day.dayNumber));
    if (!editing.name?.trim() || !editing.goal) {
      toast.error("Plan name and goal are required");
      return;
    }
    if (Number(editing.duration) !== days.length) {
      toast.error("Duration must match the number of configured days");
      return;
    }
    if (!days.length || days.some((day) => !(day.meals || []).length)) {
      toast.error("Each day must contain at least one meal");
      return;
    }
    if (new Set(dayNumbers).size !== dayNumbers.length) {
      toast.error("Each day number must be unique");
      return;
    }

    const payload = {
      name: editing.name,
      description: editing.description || "",
      goal: editing.goal,
      duration: Number(editing.duration),
      days: days.map((day) => ({
        dayNumber: Number(day.dayNumber),
        title: day.title,
        notes: day.notes,
        meals: (day.meals || []).map((meal) => ({
          mealId: meal.mealId,
          mealType: meal.mealType || "BREAKFAST",
          time: meal.time || "08:00",
          notes: meal.notes || "",
          image: meal.image ?? "",
        })),
      })),
    };
    onSave(payload, editing);
  };

  useEffect(() => {
    if (!saveActionRef) return undefined;
    saveActionRef.current = handleSave;
    return () => {
      if (saveActionRef.current === handleSave) saveActionRef.current = null;
    };
  }, [saveActionRef, editing]);

  return (
    <section className={embedded ? "space-y-3" : "space-y-4"}>
      {!embedded && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-blue-600 cursor-pointer hover:underline">Nutrition</span>
          <span>›</span>
          <span className="text-blue-600 cursor-pointer hover:underline">Meal Plans</span>
          <span>›</span>
          <span className="text-gray-900 font-medium">{plan.name ? "Edit Meal Plan" : "Create Meal Plan"}</span>
        </div>
      )}

      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">{editing.name || "Meal Plan"}</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save Plan</button>
          </div>
        </div>
      )}

      {/* Meal Plan Information */}
      <div className={`rounded-lg bg-white ring-1 ring-gray-200 ${embedded ? "p-3" : "p-6"}`}>
        {/* <h3 className="mb-3 text-sm font-semibold text-gray-950">Meal Plan Information</h3> */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Plan Name</label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Cutting Diet - 7 Day"
              className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Goal</label>
            <select
              value={editing.goal}
              onChange={(e) => setEditing({ ...editing, goal: e.target.value })}
              className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white"
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
                className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white"
              />
              {editing.duration === editing.days?.length && (
                <div className="absolute right-3 top-2.5 flex items-center gap-1 text-xs text-green-600">
                  ✓ Duration matches configured days
                </div>
              )}
            </div>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <input
              type="text"
              value={editing.description || ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] outline-none transition focus:border-[#0D8252] focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
        {/* Left Sidebar - Days */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 h-fit">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-950">Days ({editing.days?.length ?? 0})</h3>
            <div className="text-xs text-gray-500">{daysCompleted} of {editing.days?.length} completed</div>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-[#0D8252] transition-all"
              style={{ width: `${editing.days?.length ? (daysCompleted / editing.days.length) * 100 : 0}%` }}
            />
          </div>

          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {(editing.days || []).map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedDayIndex(index)}
                className={`w-full rounded-lg border-1 p-3 text-left transition ${
                  index === selectedDayIndex ? "border-[#0D8252] bg-[#0D8252]/10" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0D8252] text-xs font-bold text-white">
                        {day.dayNumber}
                      </span>
                      <span className="text-sm font-medium text-gray-900">Day {day.dayNumber}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{day.meals?.length || 0} meals</div>
                  </div>
                  {/* {day.meals?.length > 0 ? (
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
                  )} */}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={addDay}
            className="mt-4 w-full rounded-lg border-2 border-dashed border-gray-300 py-2 text-xs font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50"
          >
            + Add Day
          </button>
        </div>

        {/* Center - Day Details */}
        <div className="space-y-4">
          {currentDay && (
            <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-950">Day {currentDay.dayNumber}</h3>
                <div className="flex items-center gap-2">
                  {(currentDay.meals?.length ?? 0) > 0 && (
                    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-medium leading-none text-green-700">Complete</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeDay(selectedDayIndex)}
                    aria-label={`Delete Day ${currentDay.dayNumber}`}
                    title="Delete day"
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-1">
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
                <div className="space-y-5">
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
                            <button
                              type="button"
                              onClick={() => openMealEditor(selectedDayIndex, mealIndex, meal)}
                              aria-label={`Edit meal ${mealObject?.name || mealIndex + 1}`}
                              title="Edit scheduled meal"
                              className="rounded-lg text-blue-600 hover:text-blue-700"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMeal(selectedDayIndex, mealIndex)}
                              className="rounded-lg text-red-600 hover:text-red-700"
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
                          <input
                            type="text"
                            value={meal.notes || ""}
                            onChange={(e) => updateMeal(selectedDayIndex, mealIndex, { notes: e.target.value })}
                            placeholder="Meal notes (optional)"
                            className="w-full rounded-md border p-2 text-sm"
                          />
                          <input
                            type="url"
                            value={meal.image ?? ""}
                            onChange={(e) => updateMeal(selectedDayIndex, mealIndex, { image: e.target.value })}
                            placeholder="Meal image URL (optional)"
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
                  className="mt-4 w-full rounded-lg border border-[#0D8252] py-2 text-xs font-medium text-[#0D8252] hover:bg-[#0D8252] hover:text-white transition"
                >
                  + Add Meal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Nutrition Summary */}
        <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200 h-fit">
          <h3 className="text-sm font-semibold text-gray-950">Nutrition Summary (Day {currentDay?.dayNumber})</h3>

          {/* Donut Chart */}
          <div className="mt-4 flex items-center justify-center">
            <div className="relative aspect-square w-full max-w-40">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="12"
                  strokeDasharray={`${(planNutrition.calories / 2000) * 251} 251`}
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
                  <div className="flex items-center justify-between text-xs">
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

          <div className="mt-4 rounded-lg border border-[#0D8252]/30 bg-[#0D8252]/10 p-3 text-xs text-[#0D8252]">
            ℹ Nutrition values are estimated based on selected meals.
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-lg border border-[#0D8252]/30 bg-green-50 p-4">
        <div className="flex gap-3 items-center justify-center">
          <svg className="h-5 w-5 flex-shrink-0 text-[#0D8252]" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <div className="text-xs text-green-800">Tips : Make sure each day has at least one meal and total days equals the duration.</div>
          </div>
        </div>
      </div>

      {mealEditDraft && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMealEditDraft(null);
          }}
          role="presentation"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveMealEditor();
            }}
            className="w-full max-w-md space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-scheduled-meal-title"
          >
            <div>
              <h3 id="edit-scheduled-meal-title" className="text-base font-bold text-[#0F172A]">Edit Scheduled Meal</h3>
              <p className="mt-1 text-xs text-[#64748B]">Day {editing.days?.[mealEditDraft.dayIndex]?.dayNumber}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Meal</label>
                <select
                  value={mealEditDraft.meal.mealId || ""}
                  onChange={(event) => {
                    const selectedMeal = meals.find((item) => (item.id || item._id) === event.target.value);
                    setMealEditDraft((prev) => ({
                      ...prev,
                      meal: {
                        ...prev.meal,
                        mealId: event.target.value,
                        mealType: selectedMeal?.mealType || prev.meal.mealType || "BREAKFAST",
                      },
                    }));
                  }}
                  className="mt-1 w-full rounded-md border p-2 text-sm"
                >
                  <option value="">Select meal</option>
                  {meals.map((item) => (
                    <option key={item.id || item._id} value={item.id || item._id}>{item.name} ({item.mealType})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Time</label>
                <input
                  type="time"
                  value={mealEditDraft.meal.time || "08:00"}
                  onChange={(event) => setMealEditDraft((prev) => ({ ...prev, meal: { ...prev.meal, time: event.target.value } }))}
                  className="mt-1 w-full rounded-md border p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Notes (Optional)</label>
                <input
                  type="text"
                  value={mealEditDraft.meal.notes || ""}
                  onChange={(event) => setMealEditDraft((prev) => ({ ...prev, meal: { ...prev.meal, notes: event.target.value } }))}
                  className="mt-1 w-full rounded-md border p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Image URL (Optional)</label>
                <input
                  type="url"
                  value={mealEditDraft.meal.image ?? ""}
                  onChange={(event) => setMealEditDraft((prev) => ({ ...prev, meal: { ...prev.meal, image: event.target.value } }))}
                  placeholder="https://example.com/image.jpg"
                  className="mt-1 w-full rounded-md border p-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3">
              <button type="button" onClick={() => setMealEditDraft(null)} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#475569]">Cancel</button>
              <button type="submit" className="rounded-lg bg-[#0D8252] px-3 py-2 text-xs font-semibold text-white hover:bg-[#086B43]">Apply Changes</button>
            </div>
          </form>
        </div>
      )}

      {embedded && showEmbeddedFooter && (
        <div className="sticky bottom-0 z-10 -mx-5 -mb-4 mt-4 flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4 shadow-[0_-4px_12px_rgba(15,23,42,0.04)]">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button type="button" onClick={handleSave} className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Plan</button>
        </div>
      )}
    </section>
  );
}
