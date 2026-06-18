import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Plus, ListChecks, User, Clock } from "lucide-react";

const COLORS = ["#16a34a", "#f59e0b", "#ef4444"];

export default function NutritionDashboardView({ data = {}, onQuickAction = () => {} }) {
  const stats = [
    { label: "Total Food Items", value: data.totalFoodItems ?? 0, subtitle: "All food items" },
    { label: "Total Meals", value: data.totalMeals ?? 0, subtitle: "Created meals" },
    { label: "Meal Plans", value: data.totalPlans ?? 0, subtitle: "Active plans" },
    { label: "Active Assignments", value: data.activeAssignments ?? 0, subtitle: "Currently assigned" },
    { label: "Today's Logs", value: data.todayLogs ?? 0, subtitle: "Logs recorded today" },
  ];

  const lineData = (data.activity || [8,12,10,15,18,22,17]).map((v, i) => ({ name: `Day ${i+1}`, value: v }));
  const planDist = data.planDistribution || [ { name: 'Active', value: data.totalPlansActive ?? 5 }, { name: 'Expired', value: data.totalPlansExpired ?? 2 }, { name: 'Draft', value: data.totalPlansDraft ?? 1 } ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Nutrition Dashboard</h3>
          <p className="text-sm text-gray-500">Track nutrition data, plans, assignments and logs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">Select range</div>
          <button className="rounded-md border px-3 py-2 text-sm">May 25 - Jun 01, 2026</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s, idx) => (
          <div key={s.label} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 flex flex-col">
            <div className="text-sm text-gray-500">{s.label}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</div>
            <div className="mt-1 text-sm text-gray-500">{s.subtitle}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="col-span-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Nutrition Activity (Logs)</h4>
              <p className="text-sm text-gray-500">Daily logs recorded in the selected period</p>
            </div>
            <div>
              <select className="rounded-md border px-2 py-1 text-sm">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
          </div>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <XAxis dataKey="name" tick={false} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Plan Distribution</h4>
            <p className="text-sm text-gray-500">Distribution of meal plans</p>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <ResponsiveContainer width={200} height={160}>
              <PieChart>
                <Pie data={planDist} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60}>
                  {planDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {planDist.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span style={{width:12,height:12,background:COLORS[i%COLORS.length],display:'inline-block',borderRadius:4}} />
                  <div>{p.name}</div>
                </div>
                <div className="text-gray-700">{p.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">Quick Actions</h4>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button onClick={() => onQuickAction('add-food')} className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <Plus /> Add Food Item
          </button>
          <button onClick={() => onQuickAction('create-meal')} className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <ListChecks /> Create Meal
          </button>
          <button onClick={() => onQuickAction('create-plan')} className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <User /> Create Meal Plan
          </button>
          <button onClick={() => onQuickAction('assign-plan')} className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <Clock /> Assign Plan
          </button>
        </div>
      </div>

      {/* Member overview removed for gym owner dashboard; appears in member portal only */}
    </div>
  );
}
