import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Edit, Trash, CalendarDays, ListChecks, User, Clock, X, Package, Search, UserPlus, Eye } from "lucide-react";
import toast from "react-hot-toast";
import StatusBadge from "../components/StatusBadge";
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
  getNutritionDashboard,
  unwrapList,
  unwrapObject,
  getApiError,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { normalizeRole } from "../utils/rbac";
import MealPlanListView from "../components/MealPlanListView";
import MealPlanEditForm from "../components/MealPlanEditForm";
import NutritionDashboardView from "../components/NutritionDashboardView";
import MemberNutritionPortal from "../components/MemberNutritionPortal";
import TablePagination from "../components/TablePagination";

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
const sectionActionButtonClass = "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700";

function readPlanPage(payload, requestedPage, requestedLimit) {
  const rows = Array.isArray(payload?.data?.data)
    ? payload.data.data
    : Array.isArray(payload?.data)
      ? payload.data
    : Array.isArray(payload?.plans)
      ? payload.plans
      : Array.isArray(payload?.data?.plans)
        ? payload.data.plans
        : [];
  const pagination = payload?.data?.pagination || payload?.pagination || payload?.meta || payload?.data?.meta || {};
  const total = Number(pagination.total ?? pagination.totalCount ?? pagination.totalItems ?? payload?.total ?? rows.length);
  const limit = Number(pagination.limit ?? pagination.pageSize ?? requestedLimit) || requestedLimit;
  const page = Number(pagination.page ?? pagination.currentPage ?? requestedPage) || requestedPage;
  const totalPages = Number(pagination.totalPages ?? pagination.pages ?? payload?.totalPages) || Math.max(1, Math.ceil(total / limit));

  return { rows, pagination: { page, limit, total, totalPages } };
}

function normalizePlanNutrition(nutrition = {}) {
  return {
    calories: Number(nutrition.calories ?? nutrition.totalCalories ?? 0),
    proteinG: Number(nutrition.proteinG ?? nutrition.totalProteinG ?? 0),
    carbsG: Number(nutrition.carbsG ?? nutrition.totalCarbsG ?? 0),
    fatG: Number(nutrition.fatG ?? nutrition.totalFatG ?? 0),
  };
}

function NutritionModal({ title, description, onClose, children, footer = null, icon: Icon = Package, maxWidth = "max-w-2xl" }) {
  return createPortal((
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={`flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${title.replaceAll(" ", "-").toLowerCase()}-title`}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Icon size={18} /></div>
            <div>
              <h3 id={`${title.replaceAll(" ", "-").toLowerCase()}-title`} className="text-base font-bold text-[#0F172A]">{title}</h3>
              {description && <p className="mt-0.5 text-xs text-[#64748B]">{description}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label={`Close ${title}`}>
            <X size={17} />
          </button>
        </div>
        <div className="nutrition-modal-body flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">{footer}</div>}
      </div>
    </div>
  ), document.body);
}

function NutritionField({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-[#334155]">{label}</label>
      {children}
    </div>
  );
}

function FoodForm({ initial = {}, onSave, onCancel, formId = "", hideFooter = false }) {
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
      id={formId || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="grid gap-2"
    >
      <NutritionField label="Food Name *">
        <input
          placeholder="e.g. Grilled Chicken Breast"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border p-2 text-sm"
        />
      </NutritionField>

      <div className="grid gap-2 sm:grid-cols-2">
        <NutritionField label="Category">
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
        </NutritionField>

        <NutritionField label="Brand">
          <input
            placeholder="Brand name (optional)"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            className="w-full rounded-md border p-2 text-sm"
          />
        </NutritionField>
      </div>

      <NutritionField label="Serving size (label)">
        <input
          placeholder="e.g. 1 cup (100g)"
          value={form.servingSize}
          onChange={(e) => setForm({ ...form, servingSize: e.target.value })}
          className="w-full rounded-md border p-2 text-sm"
        />
      </NutritionField>

      <NutritionField label="Serving weight (g)">
        <input
          placeholder="e.g. 100"
          type="number"
          value={form.servingWeightG}
          onChange={(e) => setForm({ ...form, servingWeightG: e.target.value })}
          className="w-full rounded-md border p-2 text-sm"
        />
      </NutritionField>

      <div className="grid grid-cols-3 gap-2">
        <NutritionField label="Calories (kcal)">
          <input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 350" />
        </NutritionField>
        <NutritionField label="Protein (g)">
          <input type="number" value={form.proteinG} onChange={(e) => setForm({ ...form, proteinG: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 24" />
        </NutritionField>
        <NutritionField label="Carbs (g)">
          <input type="number" value={form.carbsG} onChange={(e) => setForm({ ...form, carbsG: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 45" />
        </NutritionField>
      </div>

      <NutritionField label="Fat (g)">
        <input type="number" value={form.fatG} onChange={(e) => setForm({ ...form, fatG: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 4.5" />
      </NutritionField>

      <div className="grid grid-cols-3 gap-2">
        <NutritionField label="Fiber (g)">
          <input type="number" value={form.fiberG} onChange={(e) => setForm({ ...form, fiberG: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 2" />
        </NutritionField>
        <NutritionField label="Sugar (g)">
          <input type="number" value={form.sugarG} onChange={(e) => setForm({ ...form, sugarG: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 2" />
        </NutritionField>
        <NutritionField label="Sodium (mg)">
          <input type="number" value={form.sodiumMg} onChange={(e) => setForm({ ...form, sodiumMg: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 120" />
        </NutritionField>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <NutritionField label="Cholesterol (mg)">
          <input type="number" value={form.cholesterolMg} onChange={(e) => setForm({ ...form, cholesterolMg: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 60" />
        </NutritionField>
        <NutritionField label="Saturated Fat (g)">
          <input type="number" value={form.saturatedFatG} onChange={(e) => setForm({ ...form, saturatedFatG: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 1.2" />
        </NutritionField>
        <NutritionField label="Trans Fat (g)">
          <input type="number" value={form.transFatG} onChange={(e) => setForm({ ...form, transFatG: e.target.value })} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. 0" />
        </NutritionField>
      </div>

      <NutritionField label="Barcode">
        <input placeholder="Scan or enter barcode number" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="w-full rounded-md border p-2 text-sm" />
      </NutritionField>

      {!hideFooter && (
        <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Food Item</button>
        </div>
      )}
    </form>
  );
}

function MealForm({ initial = {}, foods = [], onSave, onCancel, formId = "", hideFooter = false }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    image: "",
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
      id={formId || undefined}
      onSubmit={(e) => {
        e.preventDefault();

        const cleanedFoodItems = (form.foodItems || [])
          .filter((item) => item?.foodItemId)
          .map((item) => ({
            foodItemId: item.foodItemId,
            servings: Number(item.servings) > 0 ? Number(item.servings) : 0,
          }));

        onSave({
          name: form.name,
          description: form.description || "",
          mealType: form.mealType,
          image: form.image ?? "",
          foodItems: cleanedFoodItems,
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

          <div>
            <label className="block text-sm font-medium text-gray-700">Image URL</label>
            <input
              className="mt-2 w-full rounded-md border p-2 text-sm"
              placeholder="https://example.com/images/shake.jpg"
              value={form.image || ""}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Food Items</div>
              <button
                type="button"
                onClick={() => addRow("")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"
              >
                <Plus size={13} />
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
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs hover:bg-gray-50"
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
                      <div className="text-[10px] text-gray-500">{food ? `${food.category || ""}` : "Choose a food item"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition bg-red-50 hover:bg-red-80 text-red-600 hover:text-red-700 disabled:opacity-40"
                    >
                    <Trash size={15} />
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
                      <label className="text-xs text-gray-700">Serving</label>
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
          <div className="mt-4 space-y-3 text-xs text-gray-700">
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

      {!hideFooter && (
        <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Meal</button>
        </div>
      )}
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
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
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
                className="rounded-lg border px-3 py-2 text-sm text-red-600"
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
                        className="rounded-lg border px-3 py-2 text-sm text-red-600"
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
              className="mt-3 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white"
            >
              Add Meal
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Save Plan</button>
      </div>
    </form>
  );
}

export default function NutritionModule() {
  const { user } = useAuth();
  const token = user?.accessToken || user?.token;
  const isMemberPortal = normalizeRole(user?.role, user?.loginType) === "member";
  const [activeTab, setActiveTab] = useState("dashboard");
  const [meals, setMeals] = useState([]);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [planPagination, setPlanPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
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
  const [quickFoodModalOpen, setQuickFoodModalOpen] = useState(false);
  const [quickMealModalOpen, setQuickMealModalOpen] = useState(false);
  const [quickPlanModalOpen, setQuickPlanModalOpen] = useState(false);
  const quickPlanSaveRef = useRef(null);
  const [quickAssignmentModalOpen, setQuickAssignmentModalOpen] = useState(false);
  const [dietLogs, setDietLogs] = useState([]);
  const [dietLogLoading, setDietLogLoading] = useState(false);
  const [dietLogModalOpen, setDietLogModalOpen] = useState(false);
  const [dietLogEditing, setDietLogEditing] = useState(null);
  const [dietLogFilterUserId, setDietLogFilterUserId] = useState("");
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
  const [foodSearch, setFoodSearch] = useState("");
  const [foodCategoryFilter, setFoodCategoryFilter] = useState("ALL");
  const [foodPage, setFoodPage] = useState(1);
  const [mealPage, setMealPage] = useState(1);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState("ALL");
  const [assignmentPage, setAssignmentPage] = useState(1);

  const anyNutritionModalOpen = assignmentModalOpen || dietLogModalOpen || quickFoodModalOpen || quickMealModalOpen || quickPlanModalOpen || quickAssignmentModalOpen || Boolean(selectedPlan) || (activeTab === "foods" && showForm) || (activeTab === "meals" && showForm);

  useEffect(() => {
    if (!anyNutritionModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [anyNutritionModalOpen]);

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

  const loadPlans = async (page = planPagination.page, limit = planPagination.limit) => {
    setPlansLoading(true);
    setPlansError("");
    try {
      const response = await getPlans(page, limit, token);
      const result = readPlanPage(response, page, limit);
      setPlans(result.rows);
      setPlanPagination(result.pagination);
    } catch (err) {
      const message = getApiError(err, "Unable to load meal plans");
      setPlansError(message);
      setPlans([]);
      toast.error(message);
    } finally {
      setPlansLoading(false);
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

  const loadDietLogs = async () => {
    if (!isMemberPortal) return;

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
    if (isMemberPortal) return;
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
    if (!isMemberPortal && activeTab === "dietlog") {
      setActiveTab("dashboard");
    }
  }, [isMemberPortal, activeTab]);

  useEffect(() => {
    if (activeTab !== "dietlog" || !isMemberPortal) return;
    void loadDietLogs();
  }, [token, activeTab, dietLogFilterUserId, dietLogRange, isMemberPortal]);

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
      return true;
    } catch (err) {
      toast.error(getApiError(err, "Failed to save food"));
      return false;
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
      return true;
    } catch (err) {
      toast.error(getApiError(err, "Failed to save meal"));
      return false;
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
      void loadPlans(1, planPagination.limit);
      return true;
    } catch (err) {
      toast.error(getApiError(err, "Failed to save plan"));
      return false;
    }
  };

  const openQuickFoodModal = () => {
    setEditing(null);
    setQuickFoodModalOpen(true);
  };

  const openQuickMealModal = () => {
    setEditing(null);
    setQuickMealModalOpen(true);
  };

  const openQuickPlanModal = () => {
    setEditing({
      name: "",
      description: "",
      goal: "WEIGHT_LOSS",
      duration: 7,
      days: [{ dayNumber: 1, title: "Day 1", notes: "", meals: [{ mealId: "", mealType: "BREAKFAST", time: "08:00", notes: "", image: "" }] }],
    });
    setQuickPlanModalOpen(true);
  };

  const openQuickAssignmentModal = () => {
    setAssignmentEditing(null);
    setAssignmentForm({
      userId: "",
      mealPlanId: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      notes: "",
    });
    setQuickAssignmentModalOpen(true);
  };

  const closeQuickModals = () => {
    setQuickFoodModalOpen(false);
    setQuickMealModalOpen(false);
    setQuickPlanModalOpen(false);
    setQuickAssignmentModalOpen(false);
    setEditing(null);
  };

  const handleDeletePlan = async (plan) => {
    if (!confirm("Delete this plan?")) return;
    try {
      await deletePlan(plan.id || plan._id, token);
      toast.success("Plan deleted");
      if (selectedPlan && String(selectedPlan.id || selectedPlan._id) === String(plan.id || plan._id)) {
        setSelectedPlan(null);
      }
      const nextPage = plans.length === 1 && planPagination.page > 1 ? planPagination.page - 1 : planPagination.page;
      void loadPlans(nextPage, planPagination.limit);
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
      return true;
    } catch (err) {
      toast.error(getApiError(err, "Failed to save assignment"));
      return false;
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

  const loadPlanDetails = async (planId, openViewer = true) => {
    try {
      const response = await getPlanById(planId, token);
      const detail = unwrapObject(response);
      if (openViewer) setSelectedPlan(detail);
      return detail;
    } catch (err) {
      toast.error(getApiError(err, "Unable to load plan details"));
      return null;
    }
  };

  const handleViewPlan = async (plan) => {
    if (!plan) return;
    if (plan.id || plan._id) {
      await loadPlanDetails(plan.id || plan._id);
    } else {
      toast.error("Unable to identify this meal plan");
    }
  };

  const handleEditPlan = async (plan) => {
    const planId = plan?.id || plan?._id;
    if (!planId) {
      toast.error("Unable to identify this meal plan");
      return;
    }
    const detail = await loadPlanDetails(planId, false);
    if (detail) {
      setEditing(detail);
      setShowForm(true);
    }
  };

  const handlePlanPageChange = (page) => {
    void loadPlans(page, planPagination.limit);
  };

  const handlePlanLimitChange = (limit) => {
    void loadPlans(1, Number(limit));
  };

  const getPlanNutritionSummary = (plan) => {
    const apiNutrition = plan?.planNutrition || plan?.nutritionSummary;
    if (apiNutrition) return normalizePlanNutrition(apiNutrition);
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
    if (Array.isArray(plan?.dayNutrition)) {
      return plan.dayNutrition.map((day) => ({
        ...day,
        ...normalizePlanNutrition(day.nutrition || day),
      }));
    }
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
    ...(isMemberPortal ? [{ key: "dietlog", label: "Diet Log" }] : []),
  ];

  const renderTabContent = () => {
    if (activeTab === "foods") {
      const searchableFoodText = foodSearch.trim().toLowerCase();
      const filteredFoods = foods.filter((food) => {
        const matchesSearch = !searchableFoodText || [food.name, food.brand, food.category, food.barcode].filter(Boolean).join(" ").toLowerCase().includes(searchableFoodText);
        const matchesCategory = foodCategoryFilter === "ALL" || food.category === foodCategoryFilter;
        return matchesSearch && matchesCategory;
      });
      const foodItemsPerPage = 10;
      const foodTotalPages = Math.max(1, Math.ceil(filteredFoods.length / foodItemsPerPage));
      const paginatedFoods = filteredFoods.slice((foodPage - 1) * foodItemsPerPage, foodPage * foodItemsPerPage);
      const foodCategories = [...new Set(foods.map((food) => food.category).filter(Boolean))].sort();

      return (
        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold">Food Items</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">Create and manage nutrition food items for meals and plans.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm((s) => !s);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"
            >
              <Plus size={14} /> Add Food
            </button>
          </div>

          {showForm && (
            <NutritionModal
              title={editing ? "Edit Food Item" : "Add Food Item"}
              description="Define nutrition values, serving information, and barcode details."
              onClose={() => {
                setShowForm(false);
                setEditing(null);
              }}
              icon={UserPlus}
              footer={(
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditing(null);
                    }}
                    className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="food-item-form"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"
                  >
                    Save Food Item
                  </button>
                </>
              )}
            >
              <FoodForm
                initial={editing || {}}
                formId="food-item-form"
                hideFooter
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            </NutritionModal>
          )}

          <section className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <Search size={14} className="shrink-0 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Search food items by name, brand, or category..."
                  value={foodSearch}
                  onChange={(event) => {
                    setFoodSearch(event.target.value);
                    setFoodPage(1);
                  }}
                  className="w-full min-w-0 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                <span>Category:</span>
                <select
                  value={foodCategoryFilter}
                  onChange={(event) => {
                    setFoodCategoryFilter(event.target.value);
                    setFoodPage(1);
                  }}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"
                >
                  <option value="ALL">All</option>
                  {foodCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">Food Item</th>
                    <th className="px-4 py-3">Nutrition (per 100g)</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFoods.map((food) => (
                    <tr key={food.id || food._id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${getFoodBadgeStyle(food.category)}`}>
                            {String(food.name || "?").slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#0F172A]">{food.name || "Unnamed food"}</p>
                            <p className="text-[10px] text-[#94A3B8]">{food.brand || food.category || "Food item"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#0F172A]">
                          {food.category || "OTHER"} · {food.servingWeightG ? `${food.servingWeightG}g` : (food.servingSize || "100g")} · {food.calories ?? "-"} kcal
                        </div>
                        <div className="mt-1 text-[10px] text-[#94A3B8]">
                          Protein: {food.proteinG ?? "-"}g • Carbs: {food.carbsG ?? "-"}g • Fat: {food.fatG ?? "-"}g
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => { setEditing(food); setShowForm(true); }}
                            className="rounded-lg text-[#0D8252] transition hover:text-[#065F46]"
                            aria-label="Edit food"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(food)}
                            className="rounded-lg text-rose-500 transition hover:text-rose-700"
                            aria-label="Delete food"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredFoods.length && (
                    <tr>
                      <td colSpan="3" className="px-4 py-10 text-center text-xs text-[#64748B]">
                        No food items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
              <p>Page {foodPage} of {foodTotalPages} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {paginatedFoods.length} records</p>
              <TablePagination page={foodPage} totalPages={foodTotalPages} onPageChange={setFoodPage} previousLabel="Prev" />
            </div>
          </section>
        </section>
      );
    }

    if (activeTab === "meals") {
      const filteredMeals = meals.filter((meal) => {
        const matchesSearch = String(meal.name || "").toLowerCase().includes(mealSearch.toLowerCase());
        const matchesType = mealTypeFilter === "ALL" || meal.mealType === mealTypeFilter;
        return matchesSearch && matchesType;
      });
      const mealItemsPerPage = 10;
      const mealTotalPages = Math.max(1, Math.ceil(filteredMeals.length / mealItemsPerPage));
      const paginatedMeals = filteredMeals.slice((mealPage - 1) * mealItemsPerPage, mealPage * mealItemsPerPage);

      return (
        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold">Meals</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">Create meals by combining food items; nutrition is calculated from components.</p>
            </div>
            <button
              type="button"
              onClick={() => { setEditing(null); setShowForm((s) => !s); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"
            >
              <Plus size={14} /> Create Meal
            </button>
          </div>

          {showForm && (
            <NutritionModal
              title={editing ? "Edit Meal" : "Create Meal"}
              description="Assemble a familiar meal, configure portion sizes, and calculate macros."
              onClose={() => { setShowForm(false); setEditing(null); }}
              maxWidth="max-w-5xl"
              footer={(
                <>
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
                  <button type="submit" form="meal-tab-form" className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Meal</button>
                </>
              )}
            >
              <MealForm
                foods={foods}
                initial={editing || {}}
                formId="meal-tab-form"
                hideFooter
                onSave={async (payload) => {
                  if (await handleSaveMeal(payload, editing)) {
                    setShowForm(false);
                    setEditing(null);
                  }
                }}
                onCancel={() => { setShowForm(false); setEditing(null); }}
              />
            </NutritionModal>
          )}

          <section className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <Search size={14} className="shrink-0 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Search meals..."
                  value={mealSearch}
                  onChange={(event) => {
                    setMealSearch(event.target.value);
                    setMealPage(1);
                  }}
                  className="w-full min-w-0 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                <span>Meal Type:</span>
                <select
                  value={mealTypeFilter}
                  onChange={(event) => {
                    setMealTypeFilter(event.target.value);
                    setMealPage(1);
                  }}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"
                >
                  <option value="ALL">All Meal Types</option>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">Meal Name</th>
                    <th className="px-4 py-3">Nutrition / Macros</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMeals.map((meal) => {
                const badge = getMealTypeBadge(meal.mealType);
                return (
                  <tr key={meal.id || meal._id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${badge.className}`}>{String(meal.name || "?").slice(0, 2).toUpperCase()}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2"><p className="truncate font-bold text-[#0F172A]">{meal.name || "Unnamed meal"}</p><span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${badge.className}`}>{badge.label}</span></div>
                          <p className="truncate text-[10px] text-[#94A3B8]">{meal.description || "No description"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#0F172A]">{meal.nutrition?.calories ?? 0} kcal</div>
                      <div className="mt-1 text-[10px] text-[#94A3B8]">Protein: {meal.nutrition?.proteinG ?? 0}g • Carbs: {meal.nutrition?.carbsG ?? 0}g • Fat: {meal.nutrition?.fatG ?? 0}g</div>
                    </td>
                    <td className="px-4 py-3"><div className="flex justify-center gap-3"><button type="button" onClick={() => { setEditing(meal); setShowForm(true); }} className="rounded-lg text-[#0D8252] transition hover:text-[#065F46]" aria-label={`Edit ${meal.name}`}><Edit size={15} /></button><button type="button" onClick={() => void handleDeleteMeal(meal)} className="rounded-lg text-rose-500 transition hover:text-rose-700" aria-label={`Delete ${meal.name}`}><Trash size={14} /></button></div></td>
                  </tr>
                );
              })
                  }
                  {!filteredMeals.length && <tr><td colSpan="3" className="px-4 py-10 text-center text-xs text-[#64748B]">No meals found.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
              <p>Page {mealPage} of {mealTotalPages} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {paginatedMeals.length} records</p>
              <TablePagination page={mealPage} totalPages={mealTotalPages} onPageChange={setMealPage} previousLabel="Prev" />
            </div>
          </section>
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
          page={planPagination.page}
          limit={planPagination.limit}
          totalCount={planPagination.total}
          totalPages={planPagination.totalPages}
          loading={plansLoading}
          error={plansError}
          onPageChange={handlePlanPageChange}
          onLimitChange={handlePlanLimitChange}
          onRetry={() => void loadPlans()}
          onCreate={() => { setEditing({
            name: "",
            description: "",
            goal: "WEIGHT_LOSS",
            duration: 7,
            days: [
              {
                dayNumber: 1,
                title: "Day 1",
                notes: "",
                meals: [{ mealId: "", mealType: "BREAKFAST", time: "08:00", notes: "", image: "" }],
              },
            ],
          }); setShowForm(true); }}
          onView={(plan) => void handleViewPlan(plan)}
          onEdit={(plan) => void handleEditPlan(plan)}
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
      const filteredAssignments = assignments.filter((assignment) => {
        const memberName = assignment.user?.name || assignment.member?.name || assignment.memberName || assignment.userName || assignment.userId || assignment.memberId || "Unknown member";
        const planName = assignment.mealPlan?.name || assignment.plan?.name || assignment.planName || plans.find((plan) => (plan.id || plan._id) === assignment.mealPlanId || (plan.id || plan._id) === assignment.planId)?.name || "Unknown plan";
        const status = assignment.archived ? "Archived" : "Active";
        const matchesSearch = `${memberName} ${planName} ${assignment.notes || ""}`.toLowerCase().includes(assignmentSearch.toLowerCase());
        return matchesSearch && (assignmentStatusFilter === "ALL" || status === assignmentStatusFilter);
      });
      const assignmentItemsPerPage = 10;
      const assignmentTotalPages = Math.max(1, Math.ceil(filteredAssignments.length / assignmentItemsPerPage));
      const paginatedAssignments = filteredAssignments.slice((assignmentPage - 1) * assignmentItemsPerPage, assignmentPage * assignmentItemsPerPage);

      return (
        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold">Meal Plan Assignments</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">Assign meal plans to members and track upcoming schedules.</p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAssignmentModal()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"
            >
              <Plus size={16} /> Assign Plan
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Assignments", value: assignmentSummary.total },
              { label: "Active", value: assignmentSummary.active },
              { label: "Archived", value: assignmentSummary.archived },
              { label: "Members", value: assignmentSummary.members },
            ].map((stat) => (
              <div key={stat.label} className="flex min-h-[90px] items-center justify-between rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{stat.label}</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">{stat.value}</p></div>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#0D8252]"><ListChecks size={17} /></span>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <Search size={14} className="shrink-0 text-[#94A3B8]" />
                <input type="text" placeholder="Search assignments by member or meal plan..." value={assignmentSearch} onChange={(event) => { setAssignmentSearch(event.target.value); setAssignmentPage(1); }} className="w-full min-w-0 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]" />
              </div>
              <select value={assignmentStatusFilter} onChange={(event) => { setAssignmentStatusFilter(event.target.value); setAssignmentPage(1); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"><option value="ALL">All Statuses</option><option value="Active">Active</option><option value="Archived">Archived</option></select>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]"><tr>
                  <th className="px-4 py-3">Member</th><th className="px-4 py-3">Meal Plan</th><th className="px-4 py-3">Start Date</th><th className="px-4 py-3">End Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssignments.length ? (
                  paginatedAssignments.map((assignment) => {
                    const memberName = assignment.user?.name || assignment.member?.name || assignment.memberName || assignment.userName || assignment.userId || assignment.memberId || "Unknown member";
                    const planName = assignment.mealPlan?.name || assignment.plan?.name || assignment.planName || plans.find((plan) => (plan.id || plan._id) === assignment.mealPlanId || (plan.id || plan._id) === assignment.planId)?.name || "Unknown plan";
                    const status = assignment.archived ? "Archived" : "Active";
                    return (
                      <tr key={assignment.id || assignment._id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                        <td className="px-4 py-3 font-bold text-[#0F172A]">{memberName}</td>
                        <td className="px-4 py-3 font-semibold text-[#0F172A]">{planName}</td>
                        <td className="px-4 py-3">{assignment.startDate?.slice(0, 10) || "-"}</td>
                        <td className="px-4 py-3">{assignment.endDate?.slice(0, 10) || "-"}</td>
                        <td className="px-4 py-3"><StatusBadge status={status} label={status} /></td>
                        <td className="px-4 py-3">{assignment.notes || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenAssignmentModal(assignment)}
                              aria-label="Edit assignment"
                              className="rounded-lg text-[#0D8252] transition hover:text-[#065F46]"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteAssignment(assignment)}
                              aria-label="Remove assignment"
                              className="rounded-lg text-rose-500 transition hover:text-rose-700"
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
                    <td colSpan={7} className="px-4 py-10 text-center text-xs text-[#64748B]">
                      {assignmentLoading ? "Loading assignments..." : "No meal plan assignments found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between"><p>Page {assignmentPage} of {assignmentTotalPages} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {paginatedAssignments.length} records</p><TablePagination page={assignmentPage} totalPages={assignmentTotalPages} onPageChange={setAssignmentPage} previousLabel="Prev" /></div>
          </section>

          {assignmentModalOpen && (
            <NutritionModal
              title={assignmentEditing ? "Edit Assignment" : "Assign Meal Plan"}
              description="Choose a member, select a meal plan, and set the assignment date range."
              onClose={() => setAssignmentModalOpen(false)}
            >
              <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="-mx-5 -mb-4 mt-6 flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
                <button type="button" onClick={() => setAssignmentModalOpen(false)} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
                <button type="button" onClick={() => void handleSaveAssignment()} className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Assignment</button>
              </div>
            </NutritionModal>
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
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100 hover:text-blue-700"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteDietLog(log)}
                              aria-label="Delete diet log"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700"
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
                  <button type="button" onClick={() => setDietLogModalOpen(false)} className="rounded-lg text-gray-500 hover:text-gray-900">Close</button>
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
                            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
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
                        className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white"
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
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDietLog}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
      plans: "Create meal plans that include daily meals and assignment schedules.",
      assignments: "Assign meal plans to members and manage their schedule.",
      dietlog: "Track daily diet logs and member meal entries.",
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
        </div>
      </section>
    );
  };

  if (isMemberPortal) return <MemberNutritionPortal token={token} userId={currentUserId} />;

  return (
    <div className="p-3 sm:p-4 space-y-5">
      <section className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Nutrition Management</h1>
            <p className="mt-0.5 text-xs text-[#64748B]">Manage food items, meals, meal plans, and diet logs for your members.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#F8FAFC]"
            >
              <Plus size={13} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={openQuickPlanModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"
            >
              <Plus size={13} />
              Create Meal Plan
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[#E5EAF0] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-1 flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                activeTab === tab.key
                  ? "bg-[#0D8252] text-white shadow-sm"
                  : "bg-[#F8FAFC] text-[#475569] hover:bg-[#EEF2F7] hover:text-[#0F172A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "dashboard" && (
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold">Overview &amp; Statistics</h2>
              <p className="mt-1 text-xs text-[#64748B]">Daily nutrition analytics and active program summary</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openQuickFoodModal} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">
                <Plus size={13} />
                Add Food Item
              </button>
              <button type="button" onClick={openQuickMealModal} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">
                <Plus size={13} />
                Create Meal
              </button>
              <button type="button" onClick={openQuickPlanModal} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">
                <Plus size={13} />
                Create Meal Plan
              </button>
              <button type="button" onClick={openQuickAssignmentModal} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">
                <Plus size={13} />
                Assign Plan
              </button>
            </div>
          </div>
        </section>
      )}

      {renderTabContent()}

      {quickFoodModalOpen && (
        <NutritionModal
          title="Add Food Item"
          description="Define nutrition values, serving information, and barcode details."
          onClose={closeQuickModals}
          icon={UserPlus}
          footer={(
            <>
              <button type="button" onClick={closeQuickModals} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
              <button type="submit" form="add-food-item-form" className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Food Item</button>
            </>
          )}
        >
          <FoodForm
            initial={{}}
            formId="add-food-item-form"
            hideFooter
            onSave={async (payload) => {
              if (await handleSave(payload)) closeQuickModals();
            }}
            onCancel={closeQuickModals}
          />
        </NutritionModal>
      )}

      {quickMealModalOpen && (
        <NutritionModal
          title="Create Meal"
          description="Assemble a familiar meal, configure portion sizes, and calculate macros."
          onClose={closeQuickModals}
          maxWidth="max-w-5xl"
          footer={(
            <>
              <button type="button" onClick={closeQuickModals} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
              <button type="submit" form="create-meal-form" className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Meal</button>
            </>
          )}
        >
          <MealForm
            foods={foods}
            initial={{}}
            formId="create-meal-form"
            hideFooter
            onSave={async (payload) => {
              if (await handleSaveMeal(payload, null)) closeQuickModals();
            }}
            onCancel={closeQuickModals}
          />
        </NutritionModal>
      )}

      {quickPlanModalOpen && (
        <NutritionModal
          title="Meal Plan"
          description="Configure daily meals, goals, calorie targets, and meal distribution."
          onClose={closeQuickModals}
          maxWidth="max-w-5xl"
          footer={(
            <>
              <button type="button" onClick={closeQuickModals} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
              <button type="button" onClick={() => void quickPlanSaveRef.current?.()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Plan</button>
            </>
          )}
        >
          <MealPlanEditForm
            plan={editing || {}}
            meals={meals}
            embedded
            showEmbeddedFooter={false}
            saveActionRef={quickPlanSaveRef}
            getPlanNutritionSummary={getPlanNutritionSummary}
            onSave={async (payload) => {
              if (await handleSavePlan(payload, null)) closeQuickModals();
            }}
            onCancel={closeQuickModals}
          />
        </NutritionModal>
      )}

      {quickAssignmentModalOpen && (
        <NutritionModal
          title="Assign Meal Plan"
          description="Choose a member, select a meal plan, and set the assignment date range."
          onClose={closeQuickModals}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Member</label>
              <select
                value={assignmentForm.userId}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, userId: event.target.value }))}
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
                onChange={(event) => {
                  const mealPlanId = event.target.value;
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
                onChange={(event) => {
                  const startDate = event.target.value;
                  const selectedPlan = plans.find((plan) => (plan.id || plan._id) === assignmentForm.mealPlanId);
                  setAssignmentForm((prev) => ({ ...prev, startDate, endDate: selectedPlan ? computeEndDate(startDate, selectedPlan) : prev.endDate }));
                }}
                className="mt-2 w-full rounded-md border p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={assignmentForm.endDate}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, endDate: event.target.value }))}
                className="mt-2 w-full rounded-md border p-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <input
                type="text"
                value={assignmentForm.notes}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Optional details"
                className="mt-2 w-full rounded-md border p-2 text-sm"
              />
            </div>
          </div>
          <div className="-mx-5 -mb-4 mt-6 flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
            <button type="button" onClick={closeQuickModals} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button>
            <button type="button" onClick={async () => { if (await handleSaveAssignment()) setQuickAssignmentModalOpen(false); }} className="rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Save Assignment</button>
          </div>
        </NutritionModal>
      )}

      {selectedPlan && (
        <NutritionModal
          title={selectedPlan.name || "Meal Plan Details"}
          description={`${selectedPlan.goal || "Goal not set"} · ${selectedPlan.duration || selectedPlan.days?.length || 0} days`}
          onClose={() => setSelectedPlan(null)}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            {selectedPlan.description && <p className="text-sm text-slate-600">{selectedPlan.description}</p>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(getPlanNutritionSummary(selectedPlan)).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <p className="text-[10px] font-semibold uppercase text-[#64748B]">{label.replace("G", " (g)")}</p>
                  <p className="mt-1 text-sm font-bold text-[#0F172A]">{Math.round(value)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {(selectedPlan.days || []).map((day) => {
                const daySummary = getDailyNutritionSummary(selectedPlan).find((item) => Number(item.dayNumber) === Number(day.dayNumber));
                return (
                  <section key={day.dayNumber} className="rounded-lg border border-[#E2E8F0] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#0F172A]">{day.title || `Day ${day.dayNumber}`}</h4>
                      {daySummary && <span className="text-xs text-[#64748B]">{Math.round(daySummary.calories || 0)} kcal · P {Math.round(daySummary.proteinG || 0)}g · C {Math.round(daySummary.carbsG || 0)}g · F {Math.round(daySummary.fatG || 0)}g</span>}
                    </div>
                    {day.notes && <p className="mt-1 text-xs text-[#64748B]">{day.notes}</p>}
                    <div className="mt-3 space-y-2">
                      {(day.meals || []).map((scheduledMeal, index) => {
                        const meal = meals.find((item) => (item.id || item._id) === scheduledMeal.mealId) || scheduledMeal.meal || {};
                        return (
                          <div key={`${scheduledMeal.mealId || "meal"}-${index}`} className="flex items-center gap-3 rounded-md bg-[#F8FAFC] p-2">
                            {scheduledMeal.image && <img src={scheduledMeal.image} alt="" className="h-10 w-10 rounded object-cover" />}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-[#0F172A]">{meal.name || scheduledMeal.mealType || "Meal"}</p>
                              <p className="text-[10px] text-[#64748B]">{scheduledMeal.mealType || meal.mealType || "ANYTIME"}{scheduledMeal.time ? ` · ${scheduledMeal.time}` : ""}</p>
                              {scheduledMeal.notes && <p className="text-[10px] text-[#64748B]">{scheduledMeal.notes}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </NutritionModal>
      )}
    </div>
  );
}
