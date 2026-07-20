import { useState, useEffect } from "react";
import { Activity, BarChart3, CalendarDays, Dumbbell, Flame, Trophy, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import toast from "react-hot-toast";
import {
  getMyAnalyticsDashboard, getVolumeTrend, getConsistency, getMyPRs, getMyHeatmap,
  getApiError
} from "../services/api";

function titleCase(value) {
  return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

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

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoading(true);
    Promise.all([
      getMyAnalyticsDashboard().catch((e) => { toast.error(getApiError(e, "Failed to load analytics dashboard")); return null; }),
      getConsistency().catch((e) => { toast.error(getApiError(e, "Failed to load consistency data")); return null; }),
    ]).then(([dash, cons]) => {
      if (!mounted) return;
      setDashboard(dash);
      setConsistency(cons);
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

  const handleTabChange = (tab) => {
    setAnalyticsTab(tab);
    if (tab === "prs" && !prs.length && !prsLoading) handleLoadPRs();
    if (tab === "heatmap" && !heatmap && !heatmapLoading) handleLoadHeatmap();
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
    { key: "consistency", label: "Consistency" },
    { key: "prs", label: "PRs" },
    { key: "heatmap", label: "Heatmap" },
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
    </div>
  );
}
