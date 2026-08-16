import { useState, useEffect } from "react";
import { Activity, BarChart3, CalendarDays, Dumbbell, Flame, Target, Timer, TrendingUp, Trophy, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import toast from "react-hot-toast";
import {
  getMyAnalyticsDashboard, getVolumeTrend, getConsistency, getMyPRs, getMyHeatmap,
  getDurationTrend, getCaloriesTrend, getExerciseDistribution, getVolumePerExercise,
  getWorkoutFrequency, getAdherenceTrend, getStrengthScore, getGoalHistory,
  getMyWorkoutGoals, getExercises, getExerciseProgress,
  getApiError
} from "../services/api";

function titleCase(value) {
  return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }

const CHART_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <div className={`flex h-11 w-11 items-center justify-center rounded-md ring-1 ${color || "bg-blue-50 text-blue-700 ring-blue-100"}`}>
        <Icon size={22} />
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium leading-5 text-gray-500">{label}</p>
        <p className="shrink-0 text-2xl font-bold leading-none text-gray-950">{value ?? "-"}</p>
      </div>
    </div>
  );
}

export default function WorkoutAnalytics({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [consistency, setConsistency] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [volumeMuscleGroup, setVolumeMuscleGroup] = useState("ALL");
  const [volumeDays, setVolumeDays] = useState(90);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsTab, setAnalyticsTab] = useState("overview");
  const [prs, setPrs] = useState([]);
  const [prsLoading, setPrsLoading] = useState(false);
  const [heatmap, setHeatmap] = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [durationTrend, setDurationTrend] = useState(null);
  const [durationLoading, setDurationLoading] = useState(false);
  const [durationDays, setDurationDays] = useState(90);
  const [caloriesTrend, setCaloriesTrend] = useState(null);
  const [caloriesLoading, setCaloriesLoading] = useState(false);
  const [caloriesDays, setCaloriesDays] = useState(90);
  const [exerciseDistribution, setExerciseDistribution] = useState(null);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [distributionDays, setDistributionDays] = useState(365);
  const [distributionLimit, setDistributionLimit] = useState(10);
  const [volumePerExercise, setVolumePerExercise] = useState(null);
  const [volumePerExerciseLoading, setVolumePerExerciseLoading] = useState(false);
  const [volumePerExerciseDays, setVolumePerExerciseDays] = useState(90);
  const [volumePerExerciseMG, setVolumePerExerciseMG] = useState("ALL");
  const [workoutFrequency, setWorkoutFrequency] = useState(null);
  const [frequencyLoading, setFrequencyLoading] = useState(false);
  const [frequencyDays, setFrequencyDays] = useState(365);
  const [adherenceTrend, setAdherenceTrend] = useState(null);
  const [adherenceLoading, setAdherenceLoading] = useState(false);
  const [adherenceDays, setAdherenceDays] = useState(90);
  const [strengthScore, setStrengthScore] = useState(null);
  const [strengthScoreLoading, setStrengthScoreLoading] = useState(false);
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [goalHistory, setGoalHistory] = useState(null);
  const [goalHistoryLoading, setGoalHistoryLoading] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [exerciseProgress, setExerciseProgress] = useState(null);
  const [exerciseProgressLoading, setExerciseProgressLoading] = useState(false);
  const [exerciseProgressDays, setExerciseProgressDays] = useState(365);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoading(true);
    Promise.all([
      getMyAnalyticsDashboard().catch((e) => { toast.error(getApiError(e, "Failed to load analytics dashboard")); return null; }),
      getConsistency().catch((e) => { toast.error(getApiError(e, "Failed to load consistency data")); return null; }),
      getExercises().then((res) => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.exercises) ? res.exercises : [];
        return list;
      }).catch(() => []),
    ]).then(([dash, cons, exList]) => {
      if (!mounted) return;
      setDashboard(dash);
      setConsistency(cons);
      if (exList.length) setExercises(exList);
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [user]);

  async function handleLoadVolume() {
    setVolumeLoading(true);
    try {
      const params = { days: volumeDays };
      if (volumeMuscleGroup !== "ALL") params.muscleGroup = volumeMuscleGroup;
      const data = await getVolumeTrend(params);
      setVolumeData(data);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load volume trend"));
    } finally {
      setVolumeLoading(false);
    }
  }

  async function handleLoadPRs() {
    setPrsLoading(true);
    try {
      const data = await getMyPRs();
      const list = Array.isArray(data) ? data : Array.isArray(data?.prs) ? data.prs : Array.isArray(data?.data) ? data.data : [];
      setPrs(list);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load personal records"));
    } finally {
      setPrsLoading(false);
    }
  }

  async function handleLoadHeatmap() {
    setHeatmapLoading(true);
    try {
      const data = await getMyHeatmap();
      setHeatmap(data);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load activity heatmap"));
    } finally {
      setHeatmapLoading(false);
    }
  }

  async function handleLoadDurationTrend() {
    setDurationLoading(true);
    try {
      const data = await getDurationTrend({ days: durationDays });
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setDurationTrend(list);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load duration trend"));
    } finally {
      setDurationLoading(false);
    }
  }

  async function handleLoadCaloriesTrend() {
    setCaloriesLoading(true);
    try {
      const data = await getCaloriesTrend({ days: caloriesDays });
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setCaloriesTrend(list);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load calories trend"));
    } finally {
      setCaloriesLoading(false);
    }
  }

  async function handleLoadExerciseDistribution() {
    setDistributionLoading(true);
    try {
      const data = await getExerciseDistribution({ days: distributionDays, limit: distributionLimit });
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setExerciseDistribution(list);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load exercise distribution"));
    } finally {
      setDistributionLoading(false);
    }
  }

  async function handleLoadVolumePerExercise() {
    setVolumePerExerciseLoading(true);
    try {
      const params = { days: volumePerExerciseDays };
      if (volumePerExerciseMG !== "ALL") params.muscleGroup = volumePerExerciseMG;
      const data = await getVolumePerExercise(params);
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setVolumePerExercise(list);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load volume per exercise"));
    } finally {
      setVolumePerExerciseLoading(false);
    }
  }

  async function handleLoadWorkoutFrequency() {
    setFrequencyLoading(true);
    try {
      const data = await getWorkoutFrequency({ days: frequencyDays });
      setWorkoutFrequency(data);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load workout frequency"));
    } finally {
      setFrequencyLoading(false);
    }
  }

  async function handleLoadAdherenceTrend() {
    setAdherenceLoading(true);
    try {
      const data = await getAdherenceTrend({ days: adherenceDays });
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setAdherenceTrend(list);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load adherence trend"));
    } finally {
      setAdherenceLoading(false);
    }
  }

  async function handleLoadStrengthScore() {
    setStrengthScoreLoading(true);
    try {
      const data = await getStrengthScore();
      setStrengthScore(data);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load strength score"));
    } finally {
      setStrengthScoreLoading(false);
    }
  }

  async function handleLoadGoals() {
    setGoalsLoading(true);
    try {
      const data = await getMyWorkoutGoals({ status: "ACTIVE" });
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.goals) ? data.goals : [];
      setGoals(list);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load goals"));
    } finally {
      setGoalsLoading(false);
    }
  }

  async function handleLoadGoalHistory(goalId) {
    if (!goalId) return;
    setGoalHistoryLoading(true);
    try {
      const data = await getGoalHistory(goalId);
      setGoalHistory(data);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load goal history"));
    } finally {
      setGoalHistoryLoading(false);
    }
  }

  async function handleLoadExerciseProgress() {
    if (!selectedExerciseId) return;
    setExerciseProgressLoading(true);
    try {
      const data = await getExerciseProgress(selectedExerciseId, { days: exerciseProgressDays });
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setExerciseProgress(list);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load exercise progress"));
    } finally {
      setExerciseProgressLoading(false);
    }
  }

  const handleTabChange = (tab) => {
    setAnalyticsTab(tab);
    if (tab === "prs" && !prs.length && !prsLoading) handleLoadPRs();
    if (tab === "heatmap" && !heatmap && !heatmapLoading) handleLoadHeatmap();
    if (tab === "duration" && !durationTrend && !durationLoading) handleLoadDurationTrend();
    if (tab === "calories" && !caloriesTrend && !caloriesLoading) handleLoadCaloriesTrend();
    if (tab === "distribution" && !exerciseDistribution && !distributionLoading) handleLoadExerciseDistribution();
    if (tab === "volume-per-exercise" && !volumePerExercise && !volumePerExerciseLoading) handleLoadVolumePerExercise();
    if (tab === "frequency" && !workoutFrequency && !frequencyLoading) handleLoadWorkoutFrequency();
    if (tab === "adherence" && !adherenceTrend && !adherenceLoading) handleLoadAdherenceTrend();
    if (tab === "strength-score" && !strengthScore && !strengthScoreLoading) handleLoadStrengthScore();
    if (tab === "goals" && !goals.length && !goalsLoading) handleLoadGoals();
    if (tab === "exercise-progress" && !exerciseProgress && !exerciseProgressLoading) { handleLoadGoals(); }
  };

  const muscleGroups = dashboard?.volumeByMuscleGroup || [];
  const recentPRs = dashboard?.recentPRs || [];

  const volumeTrend = volumeData?.volumeTrend || volumeData || [];
  const consistencyData = consistency || {};
  const sessionsByMonth = consistencyData?.sessionsByMonth || [];
  const sessionsByWeek = consistencyData?.sessionsByWeek || [];

  const statCards = [
    { icon: Dumbbell, label: "Total Sessions", value: dashboard?.totalSessions, color: "bg-blue-50 text-blue-700 ring-blue-100" },
    { icon: Activity, label: "Weekly Sessions", value: dashboard?.weeklySessions, color: "bg-green-50 text-green-700 ring-green-100" },
    { icon: Flame, label: "Current Streak", value: dashboard?.currentStreak, color: "bg-orange-50 text-orange-700 ring-orange-100" },
    { icon: TrendingUp, label: "Weekly Calories", value: dashboard?.weeklyCaloriesBurned, color: "bg-purple-50 text-purple-700 ring-purple-100" },
  ];

  const weekColumns = [
    { key: "week", label: "Week" },
    { key: "totalVolume", label: "Total Volume" },
  ];

  if (volumeTrend.length > 0 && volumeTrend[0].muscleGroups) {
    weekColumns.push({ key: "muscleGroups", label: "Breakdown" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  const analyticsTabs = [
    { key: "overview", label: "Overview" },
    { key: "volume", label: "Volume" },
    { key: "volume-per-exercise", label: "Vol. Per Exercise" },
    { key: "consistency", label: "Consistency" },
    { key: "prs", label: "PRs" },
    { key: "heatmap", label: "Heatmap" },
    { key: "duration", label: "Duration" },
    { key: "calories", label: "Calories" },
    { key: "distribution", label: "Exercise Dist." },
    { key: "frequency", label: "Frequency" },
    { key: "adherence", label: "Adherence" },
    { key: "strength-score", label: "Strength Score" },
    { key: "goals", label: "Goals" },
    { key: "exercise-progress", label: "Exercise Progress" },
  ];

  const heatmapData = heatmap?.heatmap || heatmap?.data || heatmap || [];
  const heatmapMax = heatmapData.reduce((max, d) => Math.max(max, d?.count || d?.sessions || 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Workout Analytics</h3>
        <p className="text-sm text-gray-500">Track your workout performance, volume trends, and consistency</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {analyticsTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
              analyticsTab === tab.key ? "bg-gray-950 text-white shadow-sm" : "text-gray-600 bg-white border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {analyticsTab === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} color={card.color} />
            ))}
          </div>

          {muscleGroups.length > 0 && (
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">Volume by Muscle Group</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {muscleGroups.map((mg) => (
                  <div key={mg.muscleGroup || mg._id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-700">{titleCase(mg.muscleGroup)}</span>
                    <span className="font-semibold text-gray-950">{mg.totalVolume ?? mg.volume ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentPRs.length > 0 && (
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center gap-2">
                <Flame size={18} className="text-orange-500" />
                <h4 className="text-sm font-semibold text-gray-900">Recent PRs</h4>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold uppercase text-gray-500">
                      <th className="pb-2 pr-4">Exercise</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Value</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPRs.map((pr, i) => (
                      <tr key={i} className="border-b border-gray-50 text-gray-700">
                        <td className="py-2 pr-4 font-medium">{pr.exerciseName || pr.exercise || "-"}</td>
                        <td className="py-2 pr-4 capitalize">{pr.type || pr.prType || "-"}</td>
                        <td className="py-2 pr-4 font-semibold">{pr.value ?? pr.prValue ?? "-"}</td>
                        <td className="py-2 text-gray-500">{pr.date ? new Date(pr.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {analyticsTab === "volume" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Volume Trend</h4>
              <p className="text-sm text-gray-500">Weekly training volume over time</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Muscle Group</label>
                <select
                  className={inputClass}
                  value={volumeMuscleGroup}
                  onChange={(e) => setVolumeMuscleGroup(e.target.value)}
                >
                  <option value="ALL">All Groups</option>
                  {muscleGroups.map((mg) => (
                    <option key={mg.muscleGroup || mg._id} value={mg.muscleGroup}>
                      {titleCase(mg.muscleGroup)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Days</label>
                <input
                  type="number"
                  className={inputClass}
                  value={volumeDays}
                  onChange={(e) => setVolumeDays(Number(e.target.value))}
                  min={7}
                  max={365}
                />
              </div>
              <button className={primaryButtonClass} onClick={handleLoadVolume} disabled={volumeLoading}>
                {volumeLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {volumeTrend.length > 0 ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  {volumeTrend[0]?.muscleGroups ? (
                    <>
                      <Legend />
                      {Object.keys(volumeTrend[0].muscleGroups).map((key, i) => (
                        <Bar key={key} dataKey={`muscleGroups.${key}`} name={titleCase(key)} fill={CHART_COLORS[i % CHART_COLORS.length]} stackId="stack" />
                      ))}
                    </>
                  ) : (
                    <Bar dataKey="totalVolume" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Click "Load" to view volume trend data
            </div>
          )}
        </div>
      )}

      {analyticsTab === "consistency" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-500" />
            <h4 className="text-sm font-semibold text-gray-900">Consistency</h4>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-md bg-gray-50 p-4 text-center">
              <p className="text-sm font-medium text-gray-500">Total Sessions (Year)</p>
              <p className="mt-1 text-3xl font-bold text-gray-950">{consistencyData?.totalSessions ?? "-"}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-4 text-center">
              <p className="text-sm font-medium text-gray-500">Consistency Rate</p>
              <p className="mt-1 text-3xl font-bold text-blue-600">{consistencyData?.consistencyPercentage ?? "-"}%</p>
            </div>
          </div>
          {sessionsByMonth.length > 0 && (
            <div className="mt-6">
              <h5 className="mb-3 text-sm font-semibold text-gray-700">Sessions by Month</h5>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sessionsByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="sessions" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {sessionsByWeek.length > 0 && (
            <div className="mt-6">
              <h5 className="mb-3 text-sm font-semibold text-gray-700">Sessions by Week</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold uppercase text-gray-500">
                      <th className="pb-2 pr-4">Week Starting</th>
                      <th className="pb-2">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionsByWeek.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 text-gray-700">
                        <td className="py-2 pr-4">
                          {row.weekStart || row.startDate
                            ? new Date(row.weekStart || row.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "-"}
                        </td>
                        <td className="py-2 font-semibold">{row.sessions ?? row.count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {analyticsTab === "prs" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-yellow-500" />
              <h4 className="text-sm font-semibold text-gray-900">Personal Records</h4>
            </div>
            <button className={primaryButtonClass} onClick={handleLoadPRs} disabled={prsLoading}>
              {prsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {prsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
          ) : prs.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold uppercase text-gray-500">
                    <th className="pb-2 pr-4">Exercise</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Value</th>
                    <th className="pb-2 pr-4">Reps</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.map((pr, i) => (
                    <tr key={idOf(pr) || i} className="border-b border-gray-50 text-gray-700">
                      <td className="py-2.5 pr-4 font-medium">{pr.exerciseName || pr.exercise?.name || pr.exercise || "-"}</td>
                      <td className="py-2.5 pr-4 capitalize">{titleCase(pr.type || pr.prType || "weight")}</td>
                      <td className="py-2.5 pr-4 font-semibold text-gray-950">{pr.value ?? pr.prValue ?? pr.weight ?? "-"}</td>
                      <td className="py-2.5 pr-4">{pr.reps ?? pr.actualReps ?? "-"}</td>
                      <td className="py-2.5 text-gray-500">
                        {pr.date || pr.achievedAt
                          ? new Date(pr.date || pr.achievedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              No personal records yet. Keep training to set new PRs!
            </div>
          )}
        </div>
      )}

      {analyticsTab === "heatmap" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-orange-500" />
              <h4 className="text-sm font-semibold text-gray-900">Activity Heatmap</h4>
            </div>
            <button className={primaryButtonClass} onClick={handleLoadHeatmap} disabled={heatmapLoading}>
              {heatmapLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {heatmapLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
          ) : heatmapData.length > 0 ? (
            <div className="mt-4">
              <div className="flex flex-wrap gap-1">
                {heatmapData.map((day, i) => {
                  const count = day?.count || day?.sessions || 0;
                  const intensity = count === 0 ? 0 : Math.min(Math.ceil((count / heatmapMax) * 4), 4);
                  const colors = ["bg-gray-100", "bg-green-200", "bg-green-300", "bg-green-500", "bg-green-700"];
                  const dateLabel = day?.date || day?.day || "";
                  return (
                    <div
                      key={i}
                      className={`h-3.5 w-3.5 rounded-sm ${colors[intensity]}`}
                      title={`${dateLabel}: ${count} session(s)`}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="h-3 w-3 rounded-sm bg-gray-100" />
                  <div className="h-3 w-3 rounded-sm bg-green-200" />
                  <div className="h-3 w-3 rounded-sm bg-green-300" />
                  <div className="h-3 w-3 rounded-sm bg-green-500" />
                  <div className="h-3 w-3 rounded-sm bg-green-700" />
                </div>
                <span>More</span>
              </div>
              {heatmap?.totalSessions !== undefined && (
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold">{heatmap.totalSessions}</span> total session(s) in the period
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              No heatmap data available yet. Complete workouts to see your activity pattern.
            </div>
          )}
        </div>
      )}

      {analyticsTab === "duration" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <Timer size={18} className="text-indigo-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Duration Trend</h4>
                <p className="text-sm text-gray-500">Session duration in minutes over time</p>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Days</label>
                <input type="number" className={inputClass} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} min={7} max={365} />
              </div>
              <button className={primaryButtonClass} onClick={handleLoadDurationTrend} disabled={durationLoading}>
                {durationLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {durationTrend && durationTrend.length > 0 ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={durationTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="durationMinutes" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Click "Load" to view duration trend data
            </div>
          )}
        </div>
      )}

      {analyticsTab === "calories" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-red-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Calories Trend</h4>
                <p className="text-sm text-gray-500">Calories burned per session over time</p>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Days</label>
                <input type="number" className={inputClass} value={caloriesDays} onChange={(e) => setCaloriesDays(Number(e.target.value))} min={7} max={365} />
              </div>
              <button className={primaryButtonClass} onClick={handleLoadCaloriesTrend} disabled={caloriesLoading}>
                {caloriesLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {caloriesTrend && caloriesTrend.length > 0 ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={caloriesTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="calories" stroke="#ef4444" fill="#fecaca" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Click "Load" to view calories trend data
            </div>
          )}
        </div>
      )}

      {analyticsTab === "distribution" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-teal-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Exercise Distribution</h4>
                <p className="text-sm text-gray-500">Top exercises by total set count</p>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Days</label>
                <input type="number" className={inputClass} value={distributionDays} onChange={(e) => setDistributionDays(Number(e.target.value))} min={7} max={365} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Limit</label>
                <input type="number" className={inputClass} value={distributionLimit} onChange={(e) => setDistributionLimit(Number(e.target.value))} min={5} max={50} />
              </div>
              <button className={primaryButtonClass} onClick={handleLoadExerciseDistribution} disabled={distributionLoading}>
                {distributionLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {exerciseDistribution && exerciseDistribution.length > 0 ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exerciseDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="exerciseName" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="totalSets" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Click "Load" to view exercise distribution
            </div>
          )}
        </div>
      )}

      {analyticsTab === "volume-per-exercise" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-cyan-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Volume Per Exercise</h4>
                <p className="text-sm text-gray-500">Total volume broken down by individual exercise</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Muscle Group</label>
                <select className={inputClass} value={volumePerExerciseMG} onChange={(e) => setVolumePerExerciseMG(e.target.value)}>
                  <option value="ALL">All Groups</option>
                  {["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE", "FULL_BODY"].map((mg) => (
                    <option key={mg} value={mg}>{titleCase(mg)}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Days</label>
                <input type="number" className={inputClass} value={volumePerExerciseDays} onChange={(e) => setVolumePerExerciseDays(Number(e.target.value))} min={7} max={365} />
              </div>
              <button className={primaryButtonClass} onClick={handleLoadVolumePerExercise} disabled={volumePerExerciseLoading}>
                {volumePerExerciseLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {volumePerExercise && volumePerExercise.length > 0 ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumePerExercise} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="exerciseName" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="totalVolume" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Click "Load" to view volume per exercise
            </div>
          )}
        </div>
      )}

      {analyticsTab === "frequency" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-amber-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Workout Frequency</h4>
                <p className="text-sm text-gray-500">When you typically train</p>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Days</label>
                <input type="number" className={inputClass} value={frequencyDays} onChange={(e) => setFrequencyDays(Number(e.target.value))} min={7} max={365} />
              </div>
              <button className={primaryButtonClass} onClick={handleLoadWorkoutFrequency} disabled={frequencyLoading}>
                {frequencyLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {workoutFrequency ? (
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              {workoutFrequency.byDayOfWeek && workoutFrequency.byDayOfWeek.length > 0 && (
                <div>
                  <h5 className="mb-3 text-sm font-semibold text-gray-700">By Day of Week</h5>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={workoutFrequency.byDayOfWeek} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {workoutFrequency.byTimeOfDay && workoutFrequency.byTimeOfDay.length > 0 && (
                <div>
                  <h5 className="mb-3 text-sm font-semibold text-gray-700">By Time of Day</h5>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={workoutFrequency.byTimeOfDay} dataKey="count" nameKey="period" cx="50%" cy="50%" outerRadius={80} label>
                          {workoutFrequency.byTimeOfDay.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Click "Load" to view workout frequency
            </div>
          )}
        </div>
      )}

      {analyticsTab === "adherence" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-emerald-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Adherence Trend</h4>
                <p className="text-sm text-gray-500">Scheduled vs completed vs missed workouts</p>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Days</label>
                <input type="number" className={inputClass} value={adherenceDays} onChange={(e) => setAdherenceDays(Number(e.target.value))} min={7} max={365} />
              </div>
              <button className={primaryButtonClass} onClick={handleLoadAdherenceTrend} disabled={adherenceLoading}>
                {adherenceLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {adherenceTrend && adherenceTrend.length > 0 ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={adherenceTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill="#16a34a" />
                  <Bar dataKey="missed" stackId="a" fill="#dc2626" />
                  <Bar dataKey="cancelled" stackId="a" fill="#9ca3af" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Click "Load" to view adherence trend
            </div>
          )}
        </div>
      )}

      {analyticsTab === "strength-score" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-yellow-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Strength Score</h4>
                <p className="text-sm text-gray-500">Composite score from top 5 estimated 1RMs</p>
              </div>
            </div>
            <button className={primaryButtonClass} onClick={handleLoadStrengthScore} disabled={strengthScoreLoading}>
              {strengthScoreLoading ? "Loading..." : "Load"}
            </button>
          </div>
          {strengthScoreLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
          ) : strengthScore ? (
            <div className="mt-4">
              <div className="rounded-md bg-gray-50 p-6 text-center">
                <p className="text-sm font-medium text-gray-500">Composite Strength Score</p>
                <p className="mt-2 text-5xl font-bold text-gray-950">{strengthScore.strengthScore ?? "-"}</p>
              </div>
              {strengthScore.topLifts && strengthScore.topLifts.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-semibold uppercase text-gray-500">
                        <th className="pb-2 pr-4">Exercise</th>
                        <th className="pb-2 pr-4">Weight</th>
                        <th className="pb-2 pr-4">Reps</th>
                        <th className="pb-2">Est. 1RM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strengthScore.topLifts.map((lift, i) => (
                        <tr key={i} className="border-b border-gray-50 text-gray-700">
                          <td className="py-2.5 pr-4 font-medium">{lift.exerciseName || "-"}</td>
                          <td className="py-2.5 pr-4">{lift.weight ?? "-"} kg</td>
                          <td className="py-2.5 pr-4">{lift.reps ?? "-"}</td>
                          <td className="py-2.5 font-semibold text-gray-950">{lift.estimated1RM ?? "-"} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Click "Load" to view your strength score
            </div>
          )}
        </div>
      )}

      {analyticsTab === "goals" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-violet-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Goal History</h4>
                <p className="text-sm text-gray-500">Track milestones toward your fitness goals</p>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Goal</label>
                <select className={inputClass} value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)}>
                  <option value="">Select a goal</option>
                  {goals.map((g) => (
                    <option key={g.id || g._id} value={g.id || g._id}>{g.title || g.name || "Untitled"}</option>
                  ))}
                </select>
              </div>
              <button className={buttonClass} onClick={handleLoadGoals} disabled={goalsLoading}>
                {goalsLoading ? "Loading..." : "Refresh Goals"}
              </button>
              <button className={primaryButtonClass} onClick={() => handleLoadGoalHistory(selectedGoalId)} disabled={!selectedGoalId || goalHistoryLoading}>
                {goalHistoryLoading ? "Loading..." : "Load History"}
              </button>
            </div>
          </div>
          {goalHistory ? (
            <div className="mt-4">
              <div className="rounded-md bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-700">{goalHistory.title || goalHistory.goalTitle || "-"}</p>
                <p className="text-xs text-gray-500">Target: {goalHistory.targetValue ?? "-"} | Current: {goalHistory.currentValue ?? "-"}</p>
              </div>
              {goalHistory.milestones && goalHistory.milestones.length > 0 ? (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={goalHistory.milestones} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                      {goalHistory.targetValue && (
                        <Line type="monotone" dataKey={() => goalHistory.targetValue} stroke="#dc2626" strokeDasharray="5 5" name="Target" dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No milestones recorded yet.</p>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Select a goal and click "Load History" to view milestone progression
            </div>
          )}
        </div>
      )}

      {analyticsTab === "exercise-progress" && (
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Exercise Progress</h4>
                <p className="text-sm text-gray-500">Weight/reps/1RM progression over time</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Exercise</label>
                <select className={inputClass} value={selectedExerciseId} onChange={(e) => setSelectedExerciseId(e.target.value)}>
                  <option value="">Select exercise</option>
                  {exercises.map((ex) => (
                    <option key={ex.id || ex._id} value={ex.id || ex._id}>{ex.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase text-gray-500">Days</label>
                <input type="number" className={inputClass} value={exerciseProgressDays} onChange={(e) => setExerciseProgressDays(Number(e.target.value))} min={7} max={365} />
              </div>
              <button className={primaryButtonClass} onClick={handleLoadExerciseProgress} disabled={!selectedExerciseId || exerciseProgressLoading}>
                {exerciseProgressLoading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>
          {exerciseProgress && exerciseProgress.length > 0 ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={exerciseProgress} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Weight (kg)" />
                  <Line type="monotone" dataKey="estimated1RM" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" name="Est. 1RM" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center rounded-md bg-gray-50 py-12 text-sm text-gray-400">
              Select an exercise and click "Load" to view progression
            </div>
          )}
        </div>
      )}
    </div>
  );
}
