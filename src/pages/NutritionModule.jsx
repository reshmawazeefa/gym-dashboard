import React, { useEffect, useState } from "react";
import { Plus, Edit, Trash, CalendarDays, ListChecks, User, Clock } from "lucide-react";
import toast from "react-hot-toast";
import {
  getFoods,
  createFood,
  updateFood,
  deleteFood,
  getMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  getTenantUsers,
  getNutritionAssignments,
  createNutritionAssignment,
  updateNutritionAssignment,
  deleteNutritionAssignment,
  getMyDietLogs,
  getUserDietLogs,
  createDietLog,
  updateDietLog,
  deleteDietLog,
  getMyGoals,
  getUserGoals,
  createGoal,
  getNutritionDashboard,
  getNutritionMemberDashboard,
  unwrapList,
  unwrapObject,
  getApiError,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import MealPlanListView from "../components/MealPlanListView";
import MealPlanEditForm from "../components/MealPlanEditForm";
import NutritionDashboardView from "../components/NutritionDashboardView";

const MEAL_TYPE_BADGE_STYLES = {
  BREAKFAST: "bg-orange-100 text-orange-800",
  LUNCH: "bg-sky-100 text-sky-800",
  DINNER: "bg-violet-100 text-violet-800",
  SNACK: "bg-emerald-100 text-emerald-800",
  PRE_WORKOUT: "bg-yellow-100 text-yellow-900",
  POST_WORKOUT: "bg-red-100 text-red-800",
  ANYTIME: "bg-gray-100 text-gray-800",
};

const getMealTypeBadge = (type) => ({
  label: type || "ANYTIME",
  className: MEAL_TYPE_BADGE_STYLES[type] || MEAL_TYPE_BADGE_STYLES.ANYTIME,
});

const calculateMealNutrition = (foodItems, foods) => {
  return (foodItems || []).reduce(
    (acc, item) => {
      const food = foods.find((f) => (f.id || f._id) === item.foodItemId);
      if (!food || !item.servings) return acc;
      const servings = Number(item.servings) || 0;
      const servingWeightG = food.servingWeightG || 100;
      const factor = (servings * servingWeightG) / 100;

      acc.calories += Number(food.calories || 0) * factor;
      acc.proteinG += Number(food.proteinG || 0) * factor;
      acc.carbsG += Number(food.carbsG || 0) * factor;
      acc.fatG += Number(food.fatG || 0) * factor;
      acc.fiberG += Number(food.fiberG || 0) * factor;
      acc.sugarG += Number(food.sugarG || 0) * factor;
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 }
  );
};

const getFoodBadgeStyle = (category) => {
  const styles = {
    FRUIT: "bg-emerald-100 text-emerald-800",
    VEGETABLE: "bg-lime-100 text-lime-800",
    MEAT: "bg-rose-100 text-rose-800",
    FISH: "bg-cyan-100 text-cyan-800",
    DAIRY: "bg-sky-100 text-sky-800",
    GRAIN: "bg-amber-100 text-amber-800",
    LEGUME: "bg-emerald-100 text-emerald-800",
    NUT: "bg-orange-100 text-orange-800",
    SEED: "bg-violet-100 text-violet-800",
    OIL: "bg-amber-100 text-amber-800",
    BEVERAGE: "bg-blue-100 text-blue-800",
    SNACK: "bg-fuchsia-100 text-fuchsia-800",
    SUPPLEMENT: "bg-slate-100 text-slate-800",
    OTHER: "bg-gray-100 text-gray-800",
  };
  return styles[category] || styles.OTHER;
};

const sectionCardClass = "rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200";
const sectionActionButtonClass = "inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700";

function FoodForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    category: "OTHER",
    brand: "",
    servingSize: "",
    servingWeightG: "",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    fiberG: "",
    sugarG: "",
    sodiumMg: "",
    cholesterolMg: "",
    saturatedFatG: "",
    transFatG: "",
    barcode: "",
    ...initial,
  });

  useEffect(() => setForm((f) => ({ ...f, ...initial })), [initial]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="grid gap-2"
    >
      <input
        placeholder="Food name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-md border p-2 text-sm"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className="w-full rounded-md border p-2 text-sm"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option value="FRUIT">FRUIT</option>
          <option value="VEGETABLE">VEGETABLE</option>
          <option value="MEAT">MEAT</option>
          <option value="FISH">FISH</option>
          <option value="DAIRY">DAIRY</option>
          <option value="GRAIN">GRAIN</option>
          <option value="LEGUME">LEGUME</option>
          <option value="NUT">NUT</option>
          <option value="SEED">SEED</option>
          <option value="OIL">OIL</option>
          <option value="BEVERAGE">BEVERAGE</option>
          <option value="SNACK">SNACK</option>
          <option value="SUPPLEMENT">SUPPLEMENT</option>
          <option value="OTHER">OTHER</option>
        </select>

        <input
          placeholder="Brand"
          value={form.brand}
          onChange={(e) => setForm({ ...form, brand: e.target.value })}
          className="w-full rounded-md border p-2 text-sm"
        />
      </div>

      <input
        placeholder="Serving size (label)"
        value={form.servingSize}
        onChange={(e) => setForm({ ...form, servingSize: e.target.value })}
        className="w-full rounded-md border p-2 text-sm"
      />

      <input
        placeholder="Serving weight (g)"
        type="number"
        value={form.servingWeightG}
        onChange={(e) => setForm({ ...form, servingWeightG: e.target.value })}
        className="w-full rounded-md border p-2 text-sm"
      />

      <div className="grid grid-cols-3 gap-2">
        <input
          placeholder="Calories"
          type="number"
          value={form.calories}
          onChange={(e) => setForm({ ...form, calories: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
        <input
          placeholder="Protein (g)"
          type="number"
          value={form.proteinG}
          onChange={(e) => setForm({ ...form, proteinG: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
        <input
          placeholder="Carbs (g)"
          type="number"
          value={form.carbsG}
          onChange={(e) => setForm({ ...form, carbsG: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
      </div>

      <input
        placeholder="Fat (g)"
        type="number"
        value={form.fatG}
        onChange={(e) => setForm({ ...form, fatG: e.target.value })}
        className="w-full rounded-md border p-2 text-sm"
      />

      <div className="grid grid-cols-3 gap-2">
        <input
          placeholder="Fiber (g)"
          type="number"
          value={form.fiberG}
          onChange={(e) => setForm({ ...form, fiberG: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
        <input
          placeholder="Sugar (g)"
          type="number"
          value={form.sugarG}
          onChange={(e) => setForm({ ...form, sugarG: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
        <input
          placeholder="Sodium (mg)"
          type="number"
          value={form.sodiumMg}
          onChange={(e) => setForm({ ...form, sodiumMg: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input
          placeholder="Cholesterol (mg)"
          type="number"
          value={form.cholesterolMg}
          onChange={(e) => setForm({ ...form, cholesterolMg: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
        <input
          placeholder="Saturated Fat (g)"
          type="number"
          value={form.saturatedFatG}
          onChange={(e) => setForm({ ...form, saturatedFatG: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
        <input
          placeholder="Trans Fat (g)"
          type="number"
          value={form.transFatG}
          onChange={(e) => setForm({ ...form, transFatG: e.target.value })}
          className="rounded-md border p-2 text-sm"
        />
      </div>

      <input
        placeholder="Barcode"
        value={form.barcode}
        onChange={(e) => setForm({ ...form, barcode: e.target.value })}
        className="w-full rounded-md border p-2 text-sm"
      />

      <div className="flex gap-2">
        <button className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white">Save</button>
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function MealForm({ initial = {}, foods = [], onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    mealType: "ANYTIME",
    foodItems: [],
    searchFood: "",
    ...initial,
  });

  useEffect(() => setForm((f) => ({ ...f, ...initial })), [initial]);

  const addRow = (foodId) =>
    setForm((f) => ({
      ...f,
      foodItems: [...(f.foodItems || []), { foodItemId: foodId || "", servings: 1 }],
    }));

  const updateRow = (index, next) =>
    setForm((f) => ({
      ...f,
      foodItems: f.foodItems.map((r, i) => (i === index ? { ...r, ...next } : r)),
    }));

  const removeRow = (index) =>
    setForm((f) => ({ ...f, foodItems: f.foodItems.filter((_, i) => i !== index) }));

  const nutrition = calculateMealNutrition(form.foodItems, foods);
  const filteredFoods = foods.filter((food) =>
    food.name.toLowerCase().includes((form.searchFood || "").toLowerCase())
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name: form.name,
          description: form.description,
          mealType: form.mealType,
          foodItems: form.foodItems,
        });
      }}
      className="grid gap-4"
    >
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Meal Name *</label>
            <input
              className="mt-2 w-full rounded-md border p-2 text-sm"
              placeholder="Post Workout Shake"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="mt-2 w-full rounded-md border p-2 text-sm"
              placeholder="Quick recovery shake after workout"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Meal Type</label>
            <select
              className="mt-2 w-full rounded-md border p-2 text-sm"
              value={form.mealType}
              onChange={(e) => setForm({ ...form, mealType: e.target.value })}
            >
              <option value="BREAKFAST">BREAKFAST</option>
              <option value="LUNCH">LUNCH</option>
              <option value="DINNER">DINNER</option>
              <option value="SNACK">SNACK</option>
              <option value="PRE_WORKOUT">PRE_WORKOUT</option>
              <option value="POST_WORKOUT">POST_WORKOUT</option>
              <option value="ANYTIME">ANYTIME</option>
            </select>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Food Items</div>
              <button
                type="button"
                onClick={() => addRow("")}
                className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white"
              >
                Add
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 rounded-md border p-2 text-sm"
                placeholder="Search food item"
                value={form.searchFood}
                onChange={(e) => setForm({ ...form, searchFood: e.target.value })}
              />
            </div>
            <div className="mt-3 space-y-2">
              {filteredFoods.slice(0, 4).map((food) => (
                <button
                  key={food.id || food._id}
                  type="button"
                  onClick={() => addRow(food.id || food._id)}
                  className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span>{food.name}</span>
                  <span className="text-gray-500">+ Add</span>
                </button>
              ))}
              {!filteredFoods.length && (
                <div className="rounded-md border border-dashed border-gray-200 p-3 text-sm text-gray-500">No matching foods found.</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {(form.foodItems || []).map((row, idx) => {
              const food = foods.find((f) => (f.id || f._id) === row.foodItemId);
              return (
                <div key={idx} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{food?.name || "Select food item"}</div>
                      <div className="text-xs text-gray-500">{food ? `${food.category || ""}` : "Choose a food item"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="rounded-md border px-2 py-1 text-xs text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <select
                      value={row.foodItemId}
                      onChange={(e) => updateRow(idx, { foodItemId: e.target.value })}
                      className="rounded-md border p-2 text-sm"
                    >
                      <option value="">Select food</option>
                      {foods.map((f) => (
                        <option key={f.id || f._id} value={f.id || f._id}>{f.name}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-700">Serving</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={row.servings}
                        onChange={(e) => updateRow(idx, { servings: Number(e.target.value) })}
                        className="w-full rounded-md border p-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold text-gray-900">Nutrition Summary</div>
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Calories</span>
              <span className="font-semibold">{Math.round(nutrition.calories)} kcal</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Protein</span>
              <span className="font-semibold">{nutrition.proteinG.toFixed(1)} g</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Carbs</span>
              <span className="font-semibold">{nutrition.carbsG.toFixed(1)} g</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fat</span>
              <span className="font-semibold">{nutrition.fatG.toFixed(1)} g</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fiber</span>
              <span className="font-semibold">{nutrition.fiberG.toFixed(1)} g</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Sugar</span>
              <span className="font-semibold">{nutrition.sugarG.toFixed(1)} g</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[
              { label: "Protein", value: nutrition.proteinG, color: "bg-blue-600" },
              { label: "Carbs", value: nutrition.carbsG, color: "bg-cyan-500" },
              { label: "Fat", value: nutrition.fatG, color: "bg-amber-500" },
            ].map((item) => {
              const percent = Math.min(100, Math.round((item.value / Math.max(nutrition.calories, 1)) * 100));
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{item.label}</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div className={`${item.color} h-full`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Save Meal</button>
      </div>
    </form>
  );
}

function PlanForm({ initial = {}, meals = [], onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    goal: "MAINTAIN_WEIGHT",
    duration: 7,
    days: [],
    errors: {},
  });

  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: initial.name || "",
      goal: initial.goal || "MAINTAIN_WEIGHT",
      duration: initial.duration ?? 7,
      days: Array.isArray(initial.days)
        ? initial.days.map((day) => ({
            ...day,
            dayNumber: day.dayNumber ?? 1,
            title: day.title || `Day ${day.dayNumber || 1}`,
            notes: day.notes || "",
            meals: Array.isArray(day.meals)
              ? day.meals.map((meal) => ({
                  mealId: meal.mealId || "",
                  mealType: meal.mealType || "BREAKFAST",
                  time: meal.time || "08:00",
                }))
              : [{ mealId: "", mealType: "BREAKFAST", time: "08:00" }],
          }))
        : [{ dayNumber: 1, title: "Day 1", notes: "", meals: [{ mealId: "", mealType: "BREAKFAST", time: "08:00" }] }],
      errors: {},
    }));
  }, [initial]);

  const updateDay = (index, next) =>
    setForm((f) => {
      const days = [...f.days];
      days[index] = { ...days[index], ...next };
      return { ...f, days };
    });

  const updateMeal = (dayIndex, mealIndex, next) =>
    setForm((f) => {
      const days = [...f.days];
      const day = { ...days[dayIndex], meals: [...(days[dayIndex]?.meals || [])] };
      day.meals[mealIndex] = { ...day.meals[mealIndex], ...next };
      days[dayIndex] = day;
      return { ...f, days };
    });

  const addDay = () =>
    setForm((f) => ({
      ...f,
      days: [
        ...f.days,
        {
          dayNumber: f.days.length + 1,
          title: `Day ${f.days.length + 1}`,
          notes: "",
          meals: [{ mealId: "", mealType: "BREAKFAST", time: "08:00" }],
        },
      ],
    }));

  const removeDay = (index) =>
    setForm((f) => ({
      ...f,
      days: f.days.filter((_, i) => i !== index),
    }));

  const addMeal = (dayIndex) =>
    setForm((f) => {
      const days = [...f.days];
      const day = { ...days[dayIndex], meals: [...(days[dayIndex]?.meals || []), { mealId: "", mealType: "BREAKFAST", time: "08:00" }] };
      days[dayIndex] = day;
      return { ...f, days };
    });

  const removeMeal = (dayIndex, mealIndex) =>
    setForm((f) => {
      const days = [...f.days];
      const day = { ...days[dayIndex], meals: days[dayIndex]?.meals.filter((_, i) => i !== mealIndex) };
      days[dayIndex] = day;
      return { ...f, days };
    });

  const validate = () => {
    const errors = {};
    const duration = Number(form.duration);
    const days = Array.isArray(form.days) ? form.days : [];

    if (!form.name.trim()) {
      errors.name = "Plan name is required";
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      errors.duration = "Duration must be a positive integer";
    }

    if (days.length !== duration) {
      errors.duration = "Duration must match number of days";
    }

    const dayNumbers = new Set();

    days.forEach((day, index) => {
      const dayNumber = Number(day.dayNumber);
      if (!dayNumber || Number.isNaN(dayNumber) || dayNumber <= 0) {
        errors[`dayNumber_${index}`] = "Day number is required";
      } else if (dayNumbers.has(dayNumber)) {
        errors[`dayNumber_${index}`] = "Day number must be unique";
      } else {
        dayNumbers.add(dayNumber);
      }

      if (!day.title?.trim()) {
        errors[`dayTitle_${index}`] = "Day title is required";
      }

      if (!Array.isArray(day.meals) || !day.meals.length) {
        errors[`dayMeals_${index}`] = "At least one meal is required";
      }

      (day.meals || []).forEach((meal, mealIndex) => {
        if (!meal.mealId) {
          errors[`dayMeal_${index}_${mealIndex}`] = "Meal selection is required";
        }
        if (!meal.time?.trim()) {
          errors[`dayMealTime_${index}_${mealIndex}`] = "Meal time is required";
        }
      });
    });

    setForm((f) => ({ ...f, errors }));
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix plan validation issues before saving.");
      return;
    }

    onSave({
      name: form.name,
      goal: form.goal,
      duration: Number(form.duration),
      days: form.days.map((day) => ({
        dayNumber: Number(day.dayNumber),
        title: day.title,
        notes: day.notes,
        meals: (day.meals || []).map((meal) => ({
          mealId: meal.mealId,
          mealType: meal.mealType || "BREAKFAST",
          time: meal.time || "08:00",
        })),
      })),
    });
  };

  const getMealLabel = (mealId) => {
    const meal = meals.find((m) => (m.id || m._id) === mealId);
    return meal ? `${meal.name} (${meal.mealType})` : "Select meal";
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr]">
        <input
          placeholder="Plan name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border p-2 text-sm"
        />
        <select
          className="w-full rounded-md border p-2 text-sm"
          value={form.goal}
          onChange={(e) => setForm({ ...form, goal: e.target.value })}
        >
          <option value="WEIGHT_LOSS">WEIGHT_LOSS</option>
          <option value="WEIGHT_GAIN">WEIGHT_GAIN</option>
          <option value="MAINTAIN_WEIGHT">MAINTAIN_WEIGHT</option>
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr]">
        <input
          type="number"
          min="1"
          placeholder="Duration (days)"
          value={form.duration}
          onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
          className="w-full rounded-md border p-2 text-sm"
        />
        <div className="text-sm text-gray-600">
          Duration must equal the number of configured days.
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Days</div>
          <button
            type="button"
            onClick={addDay}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white"
          >
            Add Day
          </button>
        </div>

        {form.days.map((day, dayIndex) => (
          <div key={dayIndex} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="number"
                  min="1"
                  placeholder="Day Number"
                  value={day.dayNumber}
                  onChange={(e) => updateDay(dayIndex, { dayNumber: Number(e.target.value) })}
                  className="w-full rounded-md border p-2 text-sm"
                />
                <input
                  placeholder="Day title"
                  value={day.title}
                  onChange={(e) => updateDay(dayIndex, { title: e.target.value })}
                  className="w-full rounded-md border p-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeDay(dayIndex)}
                className="rounded-md border px-3 py-2 text-sm text-red-600"
              >
                Remove Day
              </button>
            </div>

            <textarea
              placeholder="Notes"
              value={day.notes}
              onChange={(e) => updateDay(dayIndex, { notes: e.target.value })}
              className="mt-3 w-full rounded-md border p-2 text-sm"
            />
            {form.errors[`dayMeals_${dayIndex}`] && (
              <div className="mt-1 text-sm text-red-600">{form.errors[`dayMeals_${dayIndex}`]}</div>
            )}

            <div className="mt-4 space-y-3">
              {(day.meals || []).map((meal, mealIndex) => (
                <div key={mealIndex} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                      <select
                        value={meal.mealId}
                        onChange={(e) => {
                          const selectedMeal = meals.find((m) => (m.id || m._id) === e.target.value);
                          updateMeal(dayIndex, mealIndex, {
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
                      <select
                        value={meal.mealType}
                        onChange={(e) => updateMeal(dayIndex, mealIndex, { mealType: e.target.value })}
                        className="w-full rounded-md border p-2 text-sm"
                      >
                        <option value="BREAKFAST">BREAKFAST</option>
                        <option value="LUNCH">LUNCH</option>
                        <option value="DINNER">DINNER</option>
                        <option value="SNACK">SNACK</option>
                        <option value="PRE_WORKOUT">PRE_WORKOUT</option>
                        <option value="POST_WORKOUT">POST_WORKOUT</option>
                        <option value="ANYTIME">ANYTIME</option>
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        type="time"
                        value={meal.time}
                        onChange={(e) => updateMeal(dayIndex, mealIndex, { time: e.target.value })}
                        className="w-full rounded-md border p-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeMeal(dayIndex, mealIndex)}
                        className="rounded-md border px-3 py-2 text-sm text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {form.errors[`dayMeal_${dayIndex}_${mealIndex}`] && (
                    <div className="mt-1 text-sm text-red-600">{form.errors[`dayMeal_${dayIndex}_${mealIndex}`]}</div>
                  )}
                  {form.errors[`dayMealTime_${dayIndex}_${mealIndex}`] && (
                    <div className="mt-1 text-sm text-red-600">{form.errors[`dayMealTime_${dayIndex}_${mealIndex}`]}</div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addMeal(dayIndex)}
              className="mt-3 rounded-md bg-slate-700 px-3 py-2 text-sm text-white"
            >
              Add Meal
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Save Plan</button>
      </div>
    </form>
  );
}

export default function NutritionModule() {
  const { user } = useAuth();
  const token = user?.accessToken || user?.token;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [meals, setMeals] = useState([]);
  const [plans, setPlans] = useState([]);
  const [foods, setFoods] = useState([]);
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    userId: "",
    mealPlanId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    notes: "",
  });
  const [assignmentEditing, setAssignmentEditing] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [dietLogs, setDietLogs] = useState([]);
  const [dietLogLoading, setDietLogLoading] = useState(false);
  const [dietLogModalOpen, setDietLogModalOpen] = useState(false);
  const [dietLogEditing, setDietLogEditing] = useState(null);
  const [dietLogFilterUserId, setDietLogFilterUserId] = useState("");
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalFilterUserId, setGoalFilterUserId] = useState("");
  const [goals, setGoals] = useState([]);
  const [goalForm, setGoalForm] = useState({
    goal: "MAINTAIN_WEIGHT",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    notes: "",
    userId: "",
  });
  const [dietLogRange, setDietLogRange] = useState(() => {
    const today = new Date();
    const prior = new Date(today);
    prior.setDate(prior.getDate() - 7);
    return {
      dateFrom: prior.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
    };
  });
  const [dietLogForm, setDietLogForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    mealType: "ANYTIME",
    notes: "",
    items: [{ foodItemId: "", servings: 1 }],
  });
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nutritionDashboard, setNutritionDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [mealSearch, setMealSearch] = useState("");
  const [mealTypeFilter, setMealTypeFilter] = useState("ALL");

  const loadFoods = async () => {
    try {
      const res = await getFoods(token);
      setFoods(unwrapList(res));
    } catch (err) {
      toast.error(getApiError(err, "Unable to load foods"));
    }
  };

  const loadMeals = async () => {
    try {
      const res = await getMeals(token);
      setMeals(unwrapList(res));
    } catch (err) {
      toast.error(getApiError(err, "Unable to load meals"));
    }
  };

  const loadPlans = async () => {
    try {
      const res = await getPlans(token);
      setPlans(unwrapList(res));
    } catch (err) {
      toast.error(getApiError(err, "Unable to load meal plans"));
    }
  };

  const loadMembers = async () => {
    try {
      const res = await getTenantUsers("member", token);
      setMembers(unwrapList(res));
    } catch (err) {
      toast.error(getApiError(err, "Unable to load members"));
    }
  };

  const currentUserId = user?.id || user?._id || user?.userId || "";

  const getMemberName = (log) => {
    if (!log) return "Self";
    if (log?.user?.name) return log.user.name;
    if (log?.user?.fullName) return log.user.fullName;
    if (log?.member?.name) return log.member.name;
    if (log?.member?.fullName) return log.member.fullName;

    const logMemberId =
      log.userId ||
      log.user?.id ||
      log.user?._id ||
      log.user?.userId ||
      log.memberId ||
      log.member?.id ||
      log.member?._id ||
      log.member?.userId ||
      "";

    const member = members.find((member) =>
      [member.id, member._id, member.userId, member.user?._id, member.user?.id, member.memberId]
        .includes(logMemberId)
    );

    return (
      member?.name ||
      member?.fullName ||
      log.userName ||
      log.memberName ||
      logMemberId ||
      "Self"
    );
  };

  const getGoalMemberName = (goal) => {
    if (!goal) return "Self";
    if (goal?.user?.name) return goal.user.name;
    if (goal?.user?.fullName) return goal.user.fullName;
    if (goal?.member?.name) return goal.member.name;
    if (goal?.member?.fullName) return goal.member.fullName;

    const goalUserId = goal.userId || goal.memberId || goal.user?.id || goal.user?._id || goal.user?.userId || "";
    const member = members.find((member) =>
      [member.id, member._id, member.userId, member.user?._id, member.user?.id, member.memberId].includes(goalUserId)
    );

    return member?.name || member?.fullName || goal.userName || goal.memberName || goalUserId || "Self";
  };

  const loadAssignments = async () => {
    try {
      setAssignmentLoading(true);
      const res = await getNutritionAssignments(token);
      setAssignments(unwrapList(res));
    } catch (err) {
      toast.error(getApiError(err, "Unable to load assignments"));
    } finally {
      setAssignmentLoading(false);
    }
  };

  const dateKey = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
  };

  const loadGoals = async () => {
    try {
      setGoalLoading(true);
      const res = goalFilterUserId ? await getUserGoals(goalFilterUserId, token) : await getMyGoals(token);
      const list = unwrapList(res);
      if (Array.isArray(list) && list.length > 0) {
        setGoals(list);
      } else {
        const payload = unwrapObject(res);
        const isWrappedArray = payload && typeof payload === "object" && Array.isArray(payload.data);
        if (payload && !Array.isArray(payload) && !isWrappedArray && Object.keys(payload).length > 0) {
          setGoals([payload]);
        } else {
          setGoals(list);
        }
      }
    } catch (err) {
      toast.error(getApiError(err, "Unable to load goals"));
    } finally {
      setGoalLoading(false);
    }
  };

  const loadDietLogs = async () => {
    try {
      setDietLogLoading(true);
      const params = {
        dateFrom: dietLogRange.dateFrom,
        dateTo: dietLogRange.dateTo,
      };
      const res = dietLogFilterUserId
        ? await getUserDietLogs(dietLogFilterUserId, params, token)
        : await getMyDietLogs(params, token);
      setDietLogs(unwrapList(res));
    } catch (err) {
      toast.error(getApiError(err, "Unable to load diet logs"));
    } finally {
      setDietLogLoading(false);
    }
  };

  const handleOpenGoalModal = () => {
    setGoalForm((prev) => ({
      ...prev,
      goal: "MAINTAIN_WEIGHT",
      calories: "",
      proteinG: "",
      carbsG: "",
      fatG: "",
      notes: "",
      userId: goalFilterUserId || "",
    }));
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async () => {
    try {
      const payload = {
        goal: goalForm.goal || "MAINTAIN_WEIGHT",
        calories: Number(goalForm.calories) || 0,
        proteinG: Number(goalForm.proteinG) || 0,
        carbsG: Number(goalForm.carbsG) || 0,
        fatG: Number(goalForm.fatG) || 0,
        notes: goalForm.notes || "",
      };

      if (goalForm.userId) {
        payload.userId = goalForm.userId;
      }

      await createGoal(payload, token);
      toast.success("Goal saved");
      setGoalModalOpen(false);
      setGoalForm({
        goal: "MAINTAIN_WEIGHT",
        calories: "",
        proteinG: "",
        carbsG: "",
        fatG: "",
        notes: "",
        userId: "",
      });
      void loadGoals();
    } catch (err) {
      toast.error(getApiError(err, "Failed to save goal"));
    }
  };

  const handleOpenDietLogModal = (log = null) => {
    if (log) {
      setDietLogEditing(log);
      setDietLogForm({
        date: dateKey(log.date || log.entryDate || log.createdAt) || new Date().toISOString().slice(0, 10),
        mealType: log.mealType || "ANYTIME",
        notes: log.notes || "",
        items: Array.isArray(log.items) && log.items.length ? log.items.map((item) => ({
          foodItemId: item.foodItemId || item.foodId || "",
          servings: item.servings != null ? item.servings : 1,
        })) : [{ foodItemId: "", servings: 1 }],
      });
    } else {
      setDietLogEditing(null);
      setDietLogForm({
        date: new Date().toISOString().slice(0, 10),
        mealType: "ANYTIME",
        notes: "",
        items: [{ foodItemId: "", servings: 1 }],
      });
    }
    setDietLogModalOpen(true);
  };

  const handleSaveDietLog = async () => {
    try {
      const payload = {
        date: dateKey(dietLogForm.date),
        mealType: dietLogForm.mealType || "ANYTIME",
        notes: dietLogForm.notes,
        items: (dietLogForm.items || []).map((item) => ({
          foodItemId: item.foodItemId,
          servings: Number(item.servings) || 0,
        })),
      };

      if (dietLogEditing && (dietLogEditing.id || dietLogEditing._id)) {
        await updateDietLog(dietLogEditing.id || dietLogEditing._id, payload, token);
        toast.success("Diet log updated");
      } else {
        await createDietLog(payload, token);
        toast.success("Diet log saved");
      }

      setDietLogModalOpen(false);
      setDietLogEditing(null);
      setDietLogForm({
        date: new Date().toISOString().slice(0, 10),
        mealType: "ANYTIME",
        notes: "",
        items: [{ foodItemId: "", servings: 1 }],
      });
      void loadDietLogs();
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error("A diet log already exists for this date and meal type.");
      } else {
        toast.error(getApiError(err, "Failed to save diet log"));
      }
    }
  };

  const handleDeleteDietLog = async (log) => {
    if (!confirm("Delete this diet log entry?")) return;
    try {
      await deleteDietLog(log.id || log._id, token);
      toast.success("Diet log removed");
      void loadDietLogs();
    } catch (err) {
      toast.error(getApiError(err, "Failed to delete diet log"));
    }
  };

  const getPlanDurationDays = (plan) => {
    const duration = Number(plan?.duration ?? plan?.durationDays ?? plan?.validityDays);
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  };

  const computeEndDate = (startDate, plan) => {
    if (!startDate || !plan) return "";
    const durationDays = getPlanDurationDays(plan);
    if (!durationDays) return "";

    const date = new Date(startDate);
    date.setDate(date.getDate() + durationDays);
    return date.toISOString().slice(0, 10);
  };

  useEffect(() => {
    void loadFoods();
    void loadMeals();
    void loadPlans();
    void loadMembers();
    void loadAssignments();
    void loadNutritionDashboard();
  }, [token]);

  const loadNutritionDashboard = async () => {
    try {
      setDashboardLoading(true);
      const res = await getNutritionDashboard(token);
      const data = unwrapObject(res);
      setNutritionDashboard(data || {});
    } catch (err) {
      toast.error(getApiError(err, "Unable to load nutrition dashboard"));
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "dietlog") return;
    void loadDietLogs();
  }, [token, activeTab, dietLogFilterUserId, dietLogRange]);

  useEffect(() => {
    if (activeTab !== "goals") return;
    void loadGoals();
  }, [token, activeTab, goalFilterUserId]);

  const handleSave = async (payload) => {
    try {
      // Normalize payload: convert numeric strings to numbers and ensure expected keys
      const normalized = {
        name: payload.name || "",
        category: payload.category || "OTHER",
        brand: payload.brand || "",
        calories: payload.calories !== "" && payload.calories != null ? Number(payload.calories) : undefined,
        proteinG: payload.proteinG !== "" && payload.proteinG != null ? Number(payload.proteinG) : undefined,
        carbsG: payload.carbsG !== "" && payload.carbsG != null ? Number(payload.carbsG) : undefined,
        fatG: payload.fatG !== "" && payload.fatG != null ? Number(payload.fatG) : undefined,
        fiberG: payload.fiberG !== "" && payload.fiberG != null ? Number(payload.fiberG) : undefined,
        sugarG: payload.sugarG !== "" && payload.sugarG != null ? Number(payload.sugarG) : undefined,
        sodiumMg: payload.sodiumMg !== "" && payload.sodiumMg != null ? Number(payload.sodiumMg) : undefined,
        cholesterolMg: payload.cholesterolMg !== "" && payload.cholesterolMg != null ? Number(payload.cholesterolMg) : undefined,
        saturatedFatG: payload.saturatedFatG !== "" && payload.saturatedFatG != null ? Number(payload.saturatedFatG) : undefined,
        transFatG: payload.transFatG !== "" && payload.transFatG != null ? Number(payload.transFatG) : undefined,
        servingSize: payload.servingSize || "",
        servingWeightG: payload.servingWeightG !== "" && payload.servingWeightG != null ? Number(payload.servingWeightG) : undefined,
        barcode: payload.barcode || "",
      };

      // Strip undefined fields so API receives only provided values
      Object.keys(normalized).forEach((k) => normalized[k] === undefined && delete normalized[k]);

      if (editing) {
        await updateFood(editing.id || editing._id, normalized, token);
        toast.success("Food updated");
      } else {
        await createFood(normalized, token);
        toast.success("Food created");
      }
      setShowForm(false);
      setEditing(null);
      void loadFoods();
    } catch (err) {
      toast.error(getApiError(err, "Failed to save food"));
    }
  };

  const handleDelete = async (item) => {
    if (!confirm("Delete this food item?")) return;
    try {
      await deleteFood(item.id || item._id, token);
      toast.success("Food deleted");
      void loadFoods();
    } catch (err) {
      toast.error(getApiError(err, "Failed to delete food"));
    }
  };

  /* Meals handlers */
  const handleSaveMeal = async (payload, editingMeal) => {
    try {
      if (editingMeal) {
        await updateMeal(editingMeal.id || editingMeal._id, payload, token);
        toast.success("Meal updated");
      } else {
        await createMeal(payload, token);
        toast.success("Meal created");
      }
      setShowForm(false);
      setEditing(null);
      void loadMeals();
    } catch (err) {
      toast.error(getApiError(err, "Failed to save meal"));
    }
  };

  const handleDeleteMeal = async (meal) => {
    if (!confirm("Delete this meal?")) return;
    try {
      await deleteMeal(meal.id || meal._id, token);
      toast.success("Meal deleted");
      void loadMeals();
    } catch (err) {
      toast.error(getApiError(err, "Failed to delete meal"));
    }
  };

  /* Meal Plans handlers */
  const handleSavePlan = async (payload, editingPlan) => {
    try {
      const planId = editingPlan?.id || editingPlan?._id;
      if (planId) {
        await updatePlan(planId, payload, token);
        toast.success("Plan updated");
      } else {
        await createPlan(payload, token);
        toast.success("Plan created");
      }
      setShowForm(false);
      setEditing(null);
      void loadPlans();
    } catch (err) {
      toast.error(getApiError(err, "Failed to save plan"));
    }
  };

  const handleDeletePlan = async (plan) => {
    if (!confirm("Delete this plan?")) return;
    try {
      await deletePlan(plan.id || plan._id, token);
      toast.success("Plan deleted");
      if (selectedPlan && (selectedPlan.id || selectedPlan._id) === (plan.id || plan._id)) {
        setSelectedPlan(null);
      }
      void loadPlans();
    } catch (err) {
      toast.error(getApiError(err, "Failed to delete plan"));
    }
  };

  const handleOpenAssignmentModal = (assignment = null) => {
    if (assignment) {
      setAssignmentEditing(assignment);
      setAssignmentForm({
        userId:
          assignment.userId ||
          assignment.memberId ||
          assignment.member?.id ||
          assignment.member?._id ||
          "",
        mealPlanId:
          assignment.mealPlanId ||
          assignment.planId ||
          assignment.plan?.id ||
          assignment.plan?._id ||
          "",
        startDate: assignment.startDate ? assignment.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        endDate: assignment.endDate ? assignment.endDate.slice(0, 10) : "",
        notes: assignment.notes || "",
      });
    } else {
      setAssignmentEditing(null);
      setAssignmentForm({
        userId: "",
        mealPlanId: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        notes: "",
      });
    }
    setAssignmentModalOpen(true);
  };

  const formatAssignmentDate = (dateValue) => {
    if (!dateValue) return undefined;
    const parsed = new Date(dateValue);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
  };

  const handleSaveAssignment = async () => {
    try {
      const payload = {
        userId: assignmentForm.userId,
        mealPlanId: assignmentForm.mealPlanId,
        startDate: formatAssignmentDate(assignmentForm.startDate),
        notes: assignmentForm.notes,
      };

      const formattedEndDate = formatAssignmentDate(assignmentForm.endDate);
      if (formattedEndDate) {
        payload.endDate = formattedEndDate;
      }

      if (assignmentEditing && (assignmentEditing.id || assignmentEditing._id)) {
        await updateNutritionAssignment(assignmentEditing.id || assignmentEditing._id, payload, token);
        toast.success("Assignment updated");
      } else {
        await createNutritionAssignment(payload, token);
        toast.success("Plan assigned");
      }

      setAssignmentModalOpen(false);
      setAssignmentEditing(null);
      setAssignmentForm({
        userId: "",
        mealPlanId: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        notes: "",
      });
      void loadAssignments();
    } catch (err) {
      toast.error(getApiError(err, "Failed to save assignment"));
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    if (!confirm("Remove this meal plan assignment?")) return;
    try {
      await deleteNutritionAssignment(assignment.id || assignment._id, token);
      toast.success("Assignment removed");
      void loadAssignments();
    } catch (err) {
      toast.error(getApiError(err, "Failed to remove assignment"));
    }
  };

  const loadPlanDetails = async (planId) => {
    try {
      const response = await getPlanById(planId, token);
      setSelectedPlan(response);
    } catch (err) {
      toast.error(getApiError(err, "Unable to load plan details"));
    }
  };

  const handleViewPlan = async (plan) => {
    if (!plan) return;
    if (plan.id || plan._id) {
      await loadPlanDetails(plan.id || plan._id);
    } else {
      setSelectedPlan(plan);
    }
  };

  const getPlanNutritionSummary = (plan) => {
    if (!plan || !Array.isArray(plan.days)) return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    const mealMap = new Map(meals.map((meal) => [(meal.id || meal._id), meal]));
    return plan.days.reduce(
      (acc, day) => {
        (day.meals || []).forEach((scheduledMeal) => {
          const meal = mealMap.get(scheduledMeal.mealId);
          if (!meal || !meal.nutrition) return;
          acc.calories += Number(meal.nutrition.calories || 0);
          acc.proteinG += Number(meal.nutrition.proteinG || 0);
          acc.carbsG += Number(meal.nutrition.carbsG || 0);
          acc.fatG += Number(meal.nutrition.fatG || 0);
        });
        return acc;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
  };

  const getDailyNutritionSummary = (plan) => {
    if (!plan || !Array.isArray(plan.days)) return [];
    const mealMap = new Map(meals.map((meal) => [(meal.id || meal._id), meal]));
    return plan.days.map((day) => {
      const summary = (day.meals || []).reduce(
        (acc, scheduledMeal) => {
          const meal = mealMap.get(scheduledMeal.mealId);
          if (!meal || !meal.nutrition) return acc;
          acc.calories += Number(meal.nutrition.calories || 0);
          acc.proteinG += Number(meal.nutrition.proteinG || 0);
          acc.carbsG += Number(meal.nutrition.carbsG || 0);
          acc.fatG += Number(meal.nutrition.fatG || 0);
          return acc;
        },
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      );
      return {
        dayNumber: day.dayNumber,
        title: day.title,
        ...summary,
      };
    });
  };

  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "foods", label: "Food Items" },
    { key: "meals", label: "Meals" },
    { key: "plans", label: "Meal Plans" },
    { key: "assignments", label: "Assignments" },
    { key: "dietlog", label: "Diet Log" },
    { key: "goals", label: "Goals" },
  ];

  const renderTabContent = () => {
    if (activeTab === "foods") {
      return (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-950">Food Items</h2>
              <p className="text-sm text-gray-500">Create and manage nutrition food items for meals and plans.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm((s) => !s);
              }}
              className={sectionActionButtonClass}
            >
              <Plus size={14} /> Add Food
            </button>
          </div>

          {showForm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              <div
                className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-xl ring-1 ring-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <FoodForm
                  initial={editing || {}}
                  onSave={handleSave}
                  onCancel={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                />
              </div>
            </div>
          )}

          <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Food Item</th>
                    <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Nutrition (per 100g)</th>
                    <th scope="col" className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {foods.map((food) => (
                    <tr key={food.id || food._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg font-semibold ${getFoodBadgeStyle(food.category)}`}>
                            {String(food.name || "?").slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <div className="font-medium text-gray-900">{food.name}</div>
                            <div className="text-sm text-gray-500">
                              {food.brand || food.category || "Food item"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-600">
                        <div className="font-semibold text-gray-900">
                          {food.category || "OTHER"} • {food.servingWeightG ? `${food.servingWeightG}g` : (food.servingSize || "100g")} • {food.calories ?? "-"} kcal
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          Protein: {food.proteinG ?? "-"}g • Carbs: {food.carbsG ?? "-"}g • Fat: {food.fatG ?? "-"}g
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setEditing(food); setShowForm(true); }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
                            aria-label="Edit food"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(food)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                            aria-label="Delete food"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!foods.length && (
                    <tr>
                      <td colSpan="3" className="px-6 py-6 text-center text-sm text-gray-500">
                        No food items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          </section>
      );
    }

    if (activeTab === "meals") {
      const filteredMeals = meals.filter((meal) => {
        const matchesSearch = meal.name.toLowerCase().includes(mealSearch.toLowerCase());
        const matchesType = mealTypeFilter === "ALL" || meal.mealType === mealTypeFilter;
        return matchesSearch && matchesType;
      });

      return (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-950">Meals</h2>
              <p className="text-sm text-gray-500">Create meals by combining food items; nutrition is calculated from components.</p>
            </div>
            <button
              type="button"
              onClick={() => { setEditing(null); setShowForm((s) => !s); }}
              className={sectionActionButtonClass}
            >
              <Plus size={14} /> Create Meal
            </button>
          </div>

          <div className={sectionCardClass}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Search Meal</label>
                <input
                  type="text"
                  value={mealSearch}
                  onChange={(e) => setMealSearch(e.target.value)}
                  placeholder="Search meal"
                  className="mt-2 w-full rounded-md border p-3 text-sm"
                />
              </div>
              <div className="w-full lg:w-64">
                <label className="text-sm font-medium text-gray-700">Meal Type</label>
                <select
                  value={mealTypeFilter}
                  onChange={(e) => setMealTypeFilter(e.target.value)}
                  className="mt-2 w-full rounded-md border p-3 text-sm"
                >
                  <option value="ALL">All Types</option>
                  <option value="BREAKFAST">BREAKFAST</option>
                  <option value="LUNCH">LUNCH</option>
                  <option value="DINNER">DINNER</option>
                  <option value="SNACK">SNACK</option>
                  <option value="PRE_WORKOUT">PRE_WORKOUT</option>
                  <option value="POST_WORKOUT">POST_WORKOUT</option>
                  <option value="ANYTIME">ANYTIME</option>
                </select>
              </div>
            </div>
          </div>

          {showForm && (
            <div className={sectionCardClass}>
              <MealForm foods={foods} initial={editing || {}} onSave={(payload) => handleSaveMeal(payload, editing)} onCancel={() => { setShowForm(false); setEditing(null); }} />
            </div>
          )}

          <div className="grid gap-3">
            {filteredMeals.length ? (
              filteredMeals.map((meal) => {
                const badge = getMealTypeBadge(meal.mealType);
                return (
                  <div key={meal.id || meal._id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-950">{meal.name}</h3>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{meal.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { setEditing(meal); setShowForm(true); }} className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
                          <Edit size={14} /> Edit
                        </button>
                        <button type="button" onClick={() => void handleDeleteMeal(meal)} className="rounded-md border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50">
                          <Trash size={14} /> Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-gray-50 p-3 text-sm">
                        <div className="text-xs text-gray-500">Calories</div>
                        <div className="mt-1 text-lg font-semibold text-gray-950">{meal.nutrition?.calories ?? 0} kcal</div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 text-sm">
                        <div className="text-xs text-gray-500">Protein</div>
                        <div className="mt-1 text-lg font-semibold text-gray-950">{meal.nutrition?.proteinG ?? 0} g</div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 text-sm">
                        <div className="text-xs text-gray-500">Carbs</div>
                        <div className="mt-1 text-lg font-semibold text-gray-950">{meal.nutrition?.carbsG ?? 0} g</div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 text-sm">
                        <div className="text-xs text-gray-500">Fat</div>
                        <div className="mt-1 text-lg font-semibold text-gray-950">{meal.nutrition?.fatG ?? 0} g</div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">No meals found.</div>
            )}
          </div>
        </section>
      );
    }
    if (activeTab === "plans") {
      if (showForm && editing) {
        return <MealPlanEditForm plan={editing} meals={meals} onSave={handleSavePlan} onCancel={() => { setShowForm(false); setEditing(null); }} getPlanNutritionSummary={getPlanNutritionSummary} />;
      }

      return (
        <MealPlanListView
          plans={plans}
          meals={meals}
          onCreate={() => { setEditing({
            name: "",
            goal: "WEIGHT_LOSS",
            duration: 7,
            days: [
              {
                dayNumber: 1,
                title: "Day 1",
                notes: "",
                meals: [{ mealId: "", mealType: "BREAKFAST", time: "08:00" }],
              },
            ],
          }); setShowForm(true); }}
          onEdit={(plan) => { setEditing(plan); setShowForm(true); }}
          onDelete={handleDeletePlan}
          getPlanNutritionSummary={getPlanNutritionSummary}
        />
      );
    }

    if (activeTab === "assignments") {
      const assignmentSummary = {
        total: assignments.length,
        active: assignments.filter((item) => !item.archived).length,
        archived: assignments.filter((item) => item.archived).length,
        members: new Set(assignments.map((item) => item.memberId || item.member?.id || item.member?._id)).size,
      };
      const filteredAssignments = assignments;

      return (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-950">Meal Plan Assignments</h2>
              <p className="mt-1 text-sm text-gray-600">Assign meal plans to members and track upcoming schedules.</p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAssignmentModal()}
              className={sectionActionButtonClass}
            >
              <Plus size={16} /> Assign Plan
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Assignments", value: assignmentSummary.total },
              { label: "Active", value: assignmentSummary.active },
              { label: "Archived", value: assignmentSummary.archived },
              { label: "Members", value: assignmentSummary.members },
            ].map((stat) => (
              <div key={stat.label} className={sectionCardClass}>
                <div className="text-sm text-gray-500">{stat.label}</div>
                <div className="mt-2 text-3xl font-semibold text-gray-950">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-700">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Meal Plan</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length ? (
                  filteredAssignments.map((assignment) => {
                    const memberName = assignment.user?.name || assignment.member?.name || assignment.memberName || assignment.userName || assignment.userId || assignment.memberId || "Unknown member";
                    const planName = assignment.mealPlan?.name || assignment.plan?.name || assignment.planName || plans.find((plan) => (plan.id || plan._id) === assignment.mealPlanId || (plan.id || plan._id) === assignment.planId)?.name || "Unknown plan";
                    const status = assignment.archived ? "Archived" : "Active";
                    return (
                      <tr key={assignment.id || assignment._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-900">{memberName}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{planName}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{assignment.startDate?.slice(0, 10) || "-"}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{assignment.endDate?.slice(0, 10) || "-"}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">{assignment.notes || "—"}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenAssignmentModal(assignment)}
                              aria-label="Edit assignment"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100 hover:text-blue-700"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteAssignment(assignment)}
                              aria-label="Remove assignment"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                      {assignmentLoading ? "Loading assignments..." : "No meal plan assignments found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {assignmentModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
              <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-950">{assignmentEditing ? "Edit Assignment" : "Assign Meal Plan"}</h3>
                    <p className="mt-1 text-sm text-gray-500">Choose a member, select a meal plan, and set the assignment date range.</p>
                  </div>
                  <button type="button" onClick={() => setAssignmentModalOpen(false)} className="text-gray-500 hover:text-gray-900">Close</button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Member</label>
                    <select
                      value={assignmentForm.userId}
                      onChange={(e) => setAssignmentForm((prev) => ({ ...prev, userId: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    >
                      <option value="">Select member</option>
                      {members.map((member) => (
                        <option key={member.id || member._id} value={member.id || member._id}>{member.name || member.email || "Member"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Meal Plan</label>
                    <select
                      value={assignmentForm.mealPlanId}
                      onChange={(e) => {
                        const mealPlanId = e.target.value;
                        const selectedPlan = plans.find((plan) => (plan.id || plan._id) === mealPlanId);
                        setAssignmentForm((prev) => ({
                          ...prev,
                          mealPlanId,
                          endDate: prev.startDate ? computeEndDate(prev.startDate, selectedPlan) : prev.endDate,
                        }));
                      }}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    >
                      <option value="">Select meal plan</option>
                      {plans.map((plan) => (
                        <option key={plan.id || plan._id} value={plan.id || plan._id}>{plan.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                    <input
                      type="date"
                      value={assignmentForm.startDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        const selectedPlan = plans.find((plan) => (plan.id || plan._id) === assignmentForm.mealPlanId);
                        setAssignmentForm((prev) => ({
                          ...prev,
                          startDate,
                          endDate: selectedPlan ? computeEndDate(startDate, selectedPlan) : prev.endDate,
                        }));
                      }}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                    <input
                      type="date"
                      value={assignmentForm.endDate}
                      onChange={(e) => setAssignmentForm((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <input
                      type="text"
                      value={assignmentForm.notes}
                      onChange={(e) => setAssignmentForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional details"
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setAssignmentModalOpen(false)}
                    className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAssignment}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Save Assignment
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      );
    }

    if (activeTab === "dietlog") {
      const todayKey = dateKey(new Date());
      const totalItems = dietLogs.reduce((sum, log) => sum + (Array.isArray(log.items) ? log.items.length : 0), 0);
      const logSummary = {
        total: dietLogs.length,
        today: dietLogs.filter((log) => dateKey(log.date || log.entryDate || log.createdAt) === todayKey).length,
        members: new Set(dietLogs.map((log) => log.user?.id || log.user?._id || log.userId || log.user?.userId || log.user?.name || log.user?.fullName)).size,
        items: totalItems,
      };
      const recentLogs = [...dietLogs]
        .sort((a, b) => new Date(b.entryDate || b.createdAt) - new Date(a.entryDate || a.createdAt))
        .slice(0, 6);
      const dateCounts = dietLogs.reduce((acc, log) => {
        const key = dateKey(log.entryDate || log.createdAt);
        if (!key) return acc;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const calendarRows = Object.entries(dateCounts)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .slice(0, 8);

      return (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-950">Diet Log</h2>
              <p className="mt-1 text-sm text-gray-600">View and track daily meal entries, calories, and member logs.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Member</label>
                  <select
                    value={dietLogFilterUserId}
                    onChange={(e) => setDietLogFilterUserId(e.target.value)}
                    className="mt-2 w-full rounded-md border p-2 text-sm"
                  >
                    <option value="">My logs</option>
                    {members.map((member) => (
                      <option key={member.id || member._id} value={member.id || member._id}>
                        {member.name || member.email || "Member"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Date Range</label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      type="date"
                      value={dietLogRange.dateFrom}
                      onChange={(e) => setDietLogRange((prev) => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full rounded-md border p-2 text-sm"
                    />
                    <input
                      type="date"
                      value={dietLogRange.dateTo}
                      onChange={(e) => setDietLogRange((prev) => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full rounded-md border p-2 text-sm"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenDietLogModal()}
                className={sectionActionButtonClass}
              >
                <Plus size={16} /> Add Log
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Entries", value: logSummary.total, icon: ListChecks },
              { label: "Today", value: logSummary.today, icon: Clock },
              { label: "Members", value: logSummary.members, icon: User },
              { label: "Items", value: `${logSummary.items}` },
            ].map((stat) => (
              <div key={stat.label} className={sectionCardClass}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-gray-500">{stat.label}</div>
                    <div className="mt-2 text-3xl font-semibold text-gray-950">{stat.value}</div>
                  </div>
                  {stat.icon && <stat.icon className="h-6 w-6 text-gray-400" />}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className={sectionCardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-950">Recent Entries</h3>
                  <p className="mt-1 text-sm text-gray-500">Latest meal log entries across your selected member or profile.</p>
                </div>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {recentLogs.length} Recent
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {recentLogs.length ? (
                  recentLogs.map((log) => (
                    <div key={log.id || log._id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{log.mealType || "ANYTIME"}</div>
                          <div className="mt-1 text-sm text-gray-600">
                            {Array.isArray(log.items) && log.items.length
                              ? log.items.map((item) => {
                                  const food = foods.find((food) => (food.id || food._id) === item.foodItemId);
                                  return `${item.servings} x ${food?.name || item.foodItemId || "Food"}`;
                                }).join(", ")
                              : "No items logged"}
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>{dateKey(log.date || log.entryDate || log.createdAt)}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{getMemberName(log)}</span>
                        {log.notes && <span>• {log.notes}</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                    No recent diet logs found.
                  </div>
                )}
              </div>
            </div>

            <div className={sectionCardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-950">Calendar Snapshot</h3>
                  <p className="mt-1 text-sm text-gray-500">Dates with logged entries and activity counts.</p>
                </div>
                <CalendarDays className="h-6 w-6 text-gray-400" />
              </div>
              <div className="mt-5 grid gap-2">
                {calendarRows.length ? (
                  calendarRows.map(([date, count]) => (
                    <div key={date} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{date}</div>
                        <div className="text-xs text-gray-500">{count} log{count === 1 ? "" : "s"}</div>
                      </div>
                      <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{count}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                    No logged dates available yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-700">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Meal Type</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dietLogs.length ? (
                  dietLogs.map((log) => {
                    const memberName = getMemberName(log);
                    return (
                      <tr key={log.id || log._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-900">{memberName}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{dateKey(log.date || log.entryDate || log.createdAt) || "-"}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{log.mealType || "ANYTIME"}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 break-words">
                          {Array.isArray(log.items) && log.items.length
                            ? log.items
                                .map((item) => {
                                  const foodName = item.foodItem?.name || foods.find((food) => (food.id || food._id) === item.foodItemId)?.name;
                                  return `${item.servings} x ${foodName || item.foodItemId}`;
                                })
                                .join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">{log.notes || "—"}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDietLogModal(log)}
                              aria-label="Edit diet log"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100 hover:text-blue-700"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteDietLog(log)}
                              aria-label="Delete diet log"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                      {dietLogLoading ? "Loading diet logs..." : "No diet logs found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {dietLogModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6">
              <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-950">{dietLogEditing ? "Edit Diet Log" : "Add Diet Log"}</h3>
                    <p className="mt-1 text-sm text-gray-500">Record meal entries, calories, and notes for members or yourself.</p>
                  </div>
                  <button type="button" onClick={() => setDietLogModalOpen(false)} className="text-gray-500 hover:text-gray-900">Close</button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <input
                      type="date"
                      value={dietLogForm.date}
                      onChange={(e) => setDietLogForm((prev) => ({ ...prev, date: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Meal Type</label>
                    <select
                      value={dietLogForm.mealType}
                      onChange={(e) => setDietLogForm((prev) => ({ ...prev, mealType: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    >
                      <option value="BREAKFAST">BREAKFAST</option>
                      <option value="LUNCH">LUNCH</option>
                      <option value="DINNER">DINNER</option>
                      <option value="SNACK">SNACK</option>
                      <option value="PRE_WORKOUT">PRE_WORKOUT</option>
                      <option value="POST_WORKOUT">POST_WORKOUT</option>
                      <option value="ANYTIME">ANYTIME</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Items</label>
                    <div className="mt-2 space-y-3">
                      {(dietLogForm.items || []).map((item, index) => (
                        <div key={`${item.foodItemId}-${index}`} className="grid gap-2 lg:grid-cols-[1.8fr_1fr_auto] items-end">
                          <div>
                            <label className="sr-only">Food item</label>
                            <select
                              value={item.foodItemId}
                              onChange={(e) => {
                                const nextItems = [...dietLogForm.items];
                                nextItems[index] = { ...nextItems[index], foodItemId: e.target.value };
                                setDietLogForm((prev) => ({ ...prev, items: nextItems }));
                              }}
                              className="w-full rounded-md border p-2 text-sm"
                            >
                              <option value="">Select food item</option>
                              {foods.map((food) => (
                                <option key={food.id || food._id} value={food.id || food._id}>
                                  {food.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="sr-only">Servings</label>
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={item.servings}
                              onChange={(e) => {
                                const nextItems = [...dietLogForm.items];
                                nextItems[index] = { ...nextItems[index], servings: e.target.value };
                                setDietLogForm((prev) => ({ ...prev, items: nextItems }));
                              }}
                              className="w-full rounded-md border p-2 text-sm"
                              placeholder="Servings"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDietLogForm((prev) => ({
                                ...prev,
                                items: prev.items.filter((_, i) => i !== index),
                              }));
                            }}
                            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDietLogForm((prev) => ({
                          ...prev,
                          items: [...(prev.items || []), { foodItemId: "", servings: 1 }],
                        }))}
                        className="rounded-md bg-slate-700 px-3 py-2 text-sm text-white"
                      >
                        Add Item
                      </button>
                    </div>
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <textarea
                      rows={3}
                      value={dietLogForm.notes}
                      onChange={(e) => setDietLogForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional notes"
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setDietLogModalOpen(false)}
                    className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDietLog}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Save Log
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      );
    }

    if (activeTab === "goals") {
      const goalSummary = {
        total: goals.length,
        members: new Set(goals.map((goal) => goal.user?.id || goal.user?._id || goal.userId || goal.memberId || goal.user?.userId)).size,
        averageCalories:
          goals.length > 0 ? Math.round(goals.reduce((sum, goal) => sum + (Number(goal.caloriesPerDay) || 0), 0) / goals.length) : 0,
        averageProtein:
          goals.length > 0 ? Math.round(goals.reduce((sum, goal) => sum + (Number(goal.proteinGPerDay) || 0), 0) / goals.length) : 0,
      };

      return (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-950">Nutrition Goals</h2>
              <p className="mt-1 text-sm text-gray-600">Define member targets for calories and macronutrients.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Member</label>
                  <select
                    value={goalFilterUserId}
                    onChange={(e) => setGoalFilterUserId(e.target.value)}
                    className="mt-2 w-full rounded-md border p-2 text-sm"
                  >
                    <option value="">My goals</option>
                    {members.map((member) => (
                      <option key={member.id || member._id} value={member.id || member._id}>
                        {member.name || member.email || "Member"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenGoalModal}
                className={sectionActionButtonClass}
              >
                <Plus size={16} /> Add Goal
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Goals Set", value: goalSummary.total },
              { label: "Members", value: goalSummary.members },
              { label: "Avg Calories", value: `${goalSummary.averageCalories} kcal` },
              { label: "Avg Protein", value: `${goalSummary.averageProtein} g` },
            ].map((stat) => (
              <div key={stat.label} className={sectionCardClass}>
                <div className="text-sm text-gray-500">{stat.label}</div>
                <div className="mt-2 text-3xl font-semibold text-gray-950">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className={sectionCardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-950">Goal Overview</h3>
                <p className="mt-1 text-sm text-gray-500">All nutrition targets for your selected member or profile.</p>
              </div>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {goals.length} Goals
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {goals.length ? (
                goals.map((goal) => (
                  <div key={goal.id || goal._id || `${goal.userId || goal.memberId}-${goal.goal}`}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{getGoalMemberName(goal)}</div>
                        <div className="mt-1 text-sm text-gray-600">{goal.goal || "MAINTAIN_WEIGHT"}</div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-5 text-sm text-gray-700">
                        <div>
                          <div className="text-xs text-gray-500">Calories</div>
                          <div className="mt-1 font-semibold">{goal.caloriesPerDay ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Protein</div>
                          <div className="mt-1 font-semibold">{goal.proteinGPerDay ?? 0}g</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Carbs</div>
                          <div className="mt-1 font-semibold">{goal.carbsGPerDay ?? 0}g</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Fat</div>
                          <div className="mt-1 font-semibold">{goal.fatGPerDay ?? 0}g</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Fiber</div>
                          <div className="mt-1 font-semibold">{goal.fiberGPerDay ?? 0}g</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4 text-sm text-gray-700">
                        <div>
                          <div className="text-xs text-gray-500">Sugar</div>
                          <div className="mt-1 font-semibold">{goal.sugarGPerDay ?? 0}g</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Sodium</div>
                          <div className="mt-1 font-semibold">{goal.sodiumMgPerDay ?? 0}mg</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Water</div>
                          <div className="mt-1 font-semibold">{goal.waterMlPerDay ?? 0}ml</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Active</div>
                          <div className="mt-1 font-semibold">{goal.isActive ? "Yes" : "No"}</div>
                        </div>
                      </div>
                      {goal.startDate && (
                        <div className="mt-3 text-xs text-gray-500">
                          Started: {new Date(goal.startDate).toLocaleDateString()} {goal.endDate && `to ${new Date(goal.endDate).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                  {goalLoading ? "Loading goals..." : "No nutrition goals found."}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-700">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Calories</th>
                  <th className="px-4 py-3">Protein</th>
                  <th className="px-4 py-3">Carbs</th>
                  <th className="px-4 py-3">Fat</th>
                  <th className="px-4 py-3">Fiber</th>
                  <th className="px-4 py-3">Sugar</th>
                  <th className="px-4 py-3">Sodium</th>
                  <th className="px-4 py-3">Water</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                </tr>
              </thead>
              <tbody>
                {goals.length ? (
                  goals.map((goal) => (
                    <tr key={goal.id || goal._id || `${goal.userId || goal.memberId}-${goal.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{getGoalMemberName(goal)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.caloriesPerDay ?? 0}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.proteinGPerDay ?? 0}g</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.carbsGPerDay ?? 0}g</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.fatGPerDay ?? 0}g</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.fiberGPerDay ?? 0}g</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.sugarGPerDay ?? 0}g</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.sodiumMgPerDay ?? 0}mg</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.waterMlPerDay ?? 0}ml</td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${goal.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                          {goal.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.startDate ? new Date(goal.startDate).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{goal.endDate ? new Date(goal.endDate).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-sm text-gray-500">
                      {goalLoading ? "Loading goals..." : "No nutrition goals found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {goalModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6">
              <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-950">Add Nutrition Goal</h3>
                    <p className="mt-1 text-sm text-gray-500">Set calorie and macronutrient targets for a member or yourself.</p>
                  </div>
                  <button type="button" onClick={() => setGoalModalOpen(false)} className="text-gray-500 hover:text-gray-900">Close</button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Member</label>
                    <select
                      value={goalForm.userId}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, userId: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    >
                      <option value="">Self</option>
                      {members.map((member) => (
                        <option key={member.id || member._id} value={member.id || member._id}>
                          {member.name || member.email || "Member"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Goal</label>
                    <select
                      value={goalForm.goal}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, goal: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                    >
                      <option value="WEIGHT_LOSS">WEIGHT_LOSS</option>
                      <option value="WEIGHT_GAIN">WEIGHT_GAIN</option>
                      <option value="MAINTAIN_WEIGHT">MAINTAIN_WEIGHT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Calories</label>
                    <input
                      type="number"
                      min="0"
                      value={goalForm.calories}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, calories: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Protein (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={goalForm.proteinG}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, proteinG: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Carbs (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={goalForm.carbsG}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, carbsG: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fat (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={goalForm.fatG}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, fatG: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <textarea
                      rows={4}
                      value={goalForm.notes}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, notes: e.target.value }))}
                      className="mt-2 w-full rounded-md border p-2 text-sm"
                      placeholder="Optional notes"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setGoalModalOpen(false)}
                    className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGoal}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Save Goal
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      );
    }

    if (activeTab === "dashboard") {
      return (
        <section>
          <NutritionDashboardView
            data={nutritionDashboard || {}}
            onQuickAction={(action) => {
              if (action === "add-food") setActiveTab("foods");
              if (action === "create-meal") setActiveTab("meals");
              if (action === "create-plan") setActiveTab("plans");
              if (action === "assign-plan") setActiveTab("assignments");
            }}
          />
        </section>
      );
    }

    const placeholderText = {
      meals: "Build meals by combining food items and servings.",
      plans: "Create meal plans that include daily meals and goals.",
      assignments: "Assign meal plans to members and manage their schedule.",
      dietlog: "Track daily diet logs and member meal entries.",
      goals: "Set nutrition goals and macro targets for members.",
    };

    return (
      <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-2xl font-semibold text-gray-950">{tabs.find((tab) => tab.key === activeTab)?.label}</h2>
        <p className="mt-2 text-sm text-gray-500">{placeholderText[activeTab]}</p>
        <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          {activeTab === "meals" && (
            <>
              <p className="font-medium text-gray-900">Meals are not configured yet.</p>
              <p className="mt-2">Use food items to compose meals and calculate nutrition automatically.</p>
            </>
          )}
          {activeTab === "plans" && (
            <>
              <p className="font-medium text-gray-900">Meal Plans will show here.</p>
              <p className="mt-2">Create weekly or custom-duration plans for members.</p>
            </>
          )}
          {activeTab === "assignments" && (
            <>
              <p className="font-medium text-gray-900">Meal Plan Assignments are empty.</p>
              <p className="mt-2">Assign plans to members and monitor active schedules.</p>
            </>
          )}
          {activeTab === "dietlog" && (
            <>
              <p className="font-medium text-gray-900">Diet logs will appear here.</p>
              <p className="mt-2">Log meals for each member and compare against their goals.</p>
            </>
          )}
          {activeTab === "goals" && (
            <>
              <p className="font-medium text-gray-900">Nutrition goals are not set.</p>
              <p className="mt-2">Define calories and macro targets for members and programs.</p>
            </>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Nutrition</h1>
            <p className="text-sm text-gray-500">Create food items, meals, plans, assignments, logs, and goals.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-gray-950 text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {renderTabContent()}
    </div>
  );
}
