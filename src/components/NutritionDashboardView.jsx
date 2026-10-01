import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { Plus, ListChecks, User, Clock, Apple, UtensilsCrossed, ClipboardList, Activity } from "lucide-react";

const COLORS = ["#16a34a", "#f59e0b", "#ef4444"];

export default function NutritionDashboardView({ data = {} }) {
  const [activityRange, setActivityRange] = useState("7");
  const stats = [
    { label: "Total Food Items", value: data.totalFoodItems ?? 0, subtitle: "All food items", icon: Apple },
    { label: "Total Meals", value: data.totalMeals ?? 0, subtitle: "Created meals", icon: UtensilsCrossed },
    { label: "Meal Plans", value: data.totalPlans ?? 0, subtitle: "Active plans", icon: ClipboardList },
    { label: "Active Assignments", value: data.activeAssignments ?? 0, subtitle: "Currently assigned", icon: User },
    { label: "Today's Logs", value: data.todayLogs ?? 0, subtitle: "Logs recorded today", icon: Activity },
  ];

  const defaultSevenDayActivity = [8, 12, 10, 15, 18, 22, 17];
  const sevenDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const sevenDayActivity = (Array.isArray(data.activity) ? data.activity : defaultSevenDayActivity).slice(0, 7);
  const defaultThirtyDayActivity = [10, 14, 12, 18, 15];
  const thirtyDayActivity = Array.isArray(data.activity30)
    ? data.activity30.slice(0, 5)
    : Array.isArray(data.activity) && data.activity.length >= 30
      ? Array.from({ length: 5 }, (_, index) => {
          const week = data.activity.slice(index * 6, index * 6 + 6);
          return week.reduce((total, value) => total + Number(value || 0), 0) / (week.length || 1);
        })
      : defaultThirtyDayActivity;
  const lineData = (activityRange === "30" ? thirtyDayActivity : sevenDayActivity).map((value, index) => ({
    name: activityRange === "30" ? `Week ${index + 1}` : sevenDayLabels[index],
    value,
  }));
  const planDist = data.planDistribution || [
    { name: "Active", value: data.totalPlansActive ?? 5 },
    { name: "Expired", value: data.totalPlansExpired ?? 2 },
    { name: "Draft", value: data.totalPlansDraft ?? 1 },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="min-h-[116px] rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#0D8252] ring-1 ring-emerald-100">
                  <Icon size={16} />
                </span>
                <p className="text-right text-2xl font-extrabold leading-none tracking-tight text-[#0F172A]">{stat.value}</p>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{stat.label}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-[#94A3B8]">{stat.subtitle}</p>
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 md:grid-cols-[7fr_3fr]">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-[15px] font-semibold text-[#0F172A]">Nutrition Activity (Logs)</h4>
              <p className="mt-1 text-xs text-[#64748B]">Daily logs recorded in the selected period</p>
            </div>
            <div>
              <select
                value={activityRange}
                onChange={(event) => setActivityRange(event.target.value)}
                className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#334155] outline-none focus:border-[#0D8252]"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
              </select>
            </div>
          </div>
          <div className="h-[228px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  padding={{ left: 18, right: 18 }}
                  tickMargin={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                />
                <YAxis domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} width={28} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0EA5E9"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#F8FAFC", stroke: "#0EA5E9", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "#0EA5E9", stroke: "#F8FAFC", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h4 className="text-[15px] font-semibold text-[#0F172A]">Plan Distribution</h4>
            <p className="mt-1 text-xs text-[#64748B]">Distribution of meal plans</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="relative h-[170px] w-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planDist} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
                    {planDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[18px] font-bold leading-none text-[#0F172A]">{planDist.reduce((sum, item) => sum + Number(item.value || 0), 0)}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Total</span>
              </div>
            </div>
            <div className="mt-4 w-full space-y-2">
              {planDist.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-xs text-[#475569]">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, background: COLORS[i % COLORS.length], display: "inline-block", borderRadius: 4 }} />
                    <span>{p.name}</span>
                  </div>
                  <span className="font-medium text-[#0F172A]">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
