import React, { useEffect, useState } from "react";
import { getNutritionMemberDashboard } from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function MemberNutritionOverview({ userId: propUserId }) {
  const { user } = useAuth();
  const currentUserId = propUserId || user?.id || user?._id || user?.userId || "";
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!currentUserId) return;
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await getNutritionMemberDashboard(currentUserId);
        const payload = res?.data || res || {};
        if (!mounted) return;
        setData(payload);
      } catch (err) {
        toast.error("Could not load member nutrition overview");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [currentUserId]);

  if (!currentUserId) return null;

  if (loading) return <div className="p-4 rounded bg-white text-sm text-gray-600">Loading nutrition overview...</div>;

  const today = data?.todayNutrition || {};
  const goal = data?.goal || {};
  const activePlan = data?.activePlan || null;

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <h3 className="text-lg font-semibold text-gray-900">Member Nutrition Overview</h3>
      {activePlan ? (
        <div className="mt-3">
          <div className="text-sm text-gray-700">Active Plan</div>
          <div className="mt-1 font-semibold text-gray-900">{activePlan.planName || activePlan.name || "-"}</div>
          <div className="text-sm text-gray-500">{activePlan.startDate ? `${new Date(activePlan.startDate).toLocaleDateString()} - ${new Date(activePlan.endDate).toLocaleDateString()}` : ""}</div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-500">No active plan</div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-gray-50 p-3">
          <div className="text-sm text-gray-700">Today's Nutrition</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{today.calories ?? 0} kcal</div>
          <div className="mt-1 text-sm text-gray-500">Protein {today.proteinG ?? 0}g • Carbs {today.carbsG ?? 0}g • Fat {today.fatG ?? 0}g</div>
        </div>

        <div className="rounded-md bg-gray-50 p-3">
          <div className="text-sm text-gray-700">Goals (per day)</div>
          <div className="mt-2 text-sm text-gray-500">Calories: {goal.caloriesPerDay ?? "-"} • Protein: {goal.proteinGPerDay ?? "-"}g</div>
          <div className="mt-1 text-sm text-gray-500">Carbs: {goal.carbsGPerDay ?? "-"}g • Fat: {goal.fatGPerDay ?? "-"}g</div>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <div>Meals logged today: <span className="font-semibold text-gray-900">{data?.mealsLoggedToday ?? 0}</span></div>
        <div className="mt-1">Week log count: <span className="font-semibold text-gray-900">{data?.weekLogCount ?? 0}</span> • Avg/day: <span className="font-semibold text-gray-900">{data?.weekAveragePerDay ?? 0}</span></div>
      </div>
    </div>
  );
}
