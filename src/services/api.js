import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "" : "https://79pgwtvr-3000.inc1.devtunnels.ms");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem("authSession")) || null;
  } catch {
    return null;
  }
}

export function getAuthToken() {
  const session = getStoredSession();
  return session?.accessToken || session?.token || session?.access_token || null;
}

export function getGymId() {
  return getStoredSession()?.gymId || "";
}

export function getAuthConfig(token) {
  const authToken = token || getAuthToken();
  return authToken
    ? { headers: { Authorization: `Bearer ${authToken}` } }
    : undefined;
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function extractToken(payload) {
  if (!payload || typeof payload !== "object") return "";

  const tokenKeys = ["token", "accessToken", "access_token", "jwt"];
  const queue = [payload];
  const seen = new Set();

  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);

    for (const key of tokenKeys) {
      if (typeof item[key] === "string" && item[key]) return item[key];
    }

    Object.values(item).forEach((value) => {
      if (value && typeof value === "object") queue.push(value);
    });
  }

  return "";
}

export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.classes)) return payload.classes;
  if (Array.isArray(payload?.gymClasses)) return payload.gymClasses;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.members)) return payload.members;
  if (Array.isArray(payload?.plans)) return payload.plans;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.classes)) return payload.data.classes;
  if (Array.isArray(payload?.data?.gymClasses)) return payload.data.gymClasses;
  if (Array.isArray(payload?.data?.users)) return payload.data.users;
  if (Array.isArray(payload?.data?.members)) return payload.data.members;
  if (Array.isArray(payload?.data?.plans)) return payload.data.plans;
  if (Array.isArray(payload?.result?.data)) return payload.result.data;
  return [];
}

export function unwrapObject(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.data && !Array.isArray(payload.data)) return payload.data;
  if (payload.data?.data && !Array.isArray(payload.data.data)) return payload.data.data;
  if (payload.user) return payload.user;
  if (payload.gym) return payload.gym;
  if (payload.result && !Array.isArray(payload.result)) return payload.result;
  return payload;
}

export function getApiError(error, fallback = "Something went wrong") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

export async function platformLogin(credentials) {
  const response = await api.post("/api/auth/platform/login", credentials);
  return response.data;
}

export async function createGym(payload) {
  const response = await api.post("/api/platform/create-gym", payload);
  return response.data;
}

export async function getPlatformGyms() {
  const response = await api.get("/api/platform/gyms");
  return response.data;
}

export async function getPlatformGym(id) {
  const response = await api.get(`/api/platform/gyms/${id}`);
  return response.data;
}

// ===== SaaS Features (Platform) =====
export async function createSaasFeature(payload) {
  const response = await api.post("/api/platform/saas-features", payload);
  return response.data;
}

export async function bulkCreateSaasFeatures(names) {
  const response = await api.post("/api/platform/saas-features/bulk", { names });
  return response.data;
}

export async function getSaasFeatures(params = {}) {
  const response = await api.get("/api/platform/saas-features", { params });
  return response.data;
}

export async function getSaasFeatureById(id) {
  const response = await api.get(`/api/platform/saas-features/${id}`);
  return response.data;
}

export async function updateSaasFeature(id, payload) {
  const response = await api.patch(`/api/platform/saas-features/${id}`, payload);
  return response.data;
}

export async function deleteSaasFeature(id) {
  const response = await api.delete(`/api/platform/saas-features/${id}`);
  return response.data;
}

// ===== SaaS Plans (Platform) =====
export async function createSaasPlan(payload) {
  const response = await api.post("/api/platform/saas-plans", payload);
  return response.data;
}

export async function getSaasPlans() {
  const response = await api.get("/api/platform/saas-plans");
  return response.data;
}

export async function getSaasPlanById(planId) {
  const response = await api.get(`/api/platform/saas-plans/${planId}`);
  return response.data;
}

export async function updateSaasPlan(planId, payload) {
  const response = await api.patch(`/api/platform/saas-plans/${planId}`, payload);
  return response.data;
}

export async function deleteSaasPlan(planId) {
  const response = await api.delete(`/api/platform/saas-plans/${planId}`);
  return response.data;
}

export async function getProfile(token = null) {
  const response = await api.get(`/api/profile`, getAuthConfig(token));
  // Return the inner `data` object expected from the profile endpoint
  return response.data?.data || response.data;
}

export async function updateGym(id, payload) {
  const response = await api.patch(`/api/gym/${id}`, payload);
  return response.data;
}

export async function gymOwnerLogin(credentials) {
  const response = await api.post("/api/auth/login", credentials);
  return response.data;
}

export async function gymUserLogin(credentials) {
  const response = await api.post("/api/auth/login", credentials);
  return response.data;
}

export async function registerGymMember(payload) {
  const response = await api.post("/api/auth/register", payload);
  return response.data;
}

export async function createGymStaff(payload) {
  const token = getAuthToken();
  if (!token) throw new Error("Login token is required to register staff");

  const response = await api.post("/api/auth/staff/create", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

export async function createMembershipPlan(payload, token = null) {
  const response = await api.post("/api/membership/plans", payload, getAuthConfig(token));
  return response.data;
}

export async function updateMembershipPlan(planId, payload, token = null) {
  const response = await api.patch(`/api/membership/plans/${planId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function getMembershipPlans(params = {}, token = null) {
  const response = await api.get("/api/membership/plans", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function deleteMembershipPlan(planId, token = null) {
  const response = await api.delete(`/api/membership/plans/${planId}`, getAuthConfig(token));
  return response.data;
}

export async function getPlanStats(planId, token = null) {
  const response = await api.get(`/api/membership/plans/${planId}/stats`, getAuthConfig(token));
  return response.data;
}

// ===== Membership Features =====
export async function createFeature(payload, token = null) {
  const response = await api.post("/api/membership/features", payload, getAuthConfig(token));
  return response.data;
}

export async function bulkCreateFeatures(names, token = null) {
  const response = await api.post("/api/membership/features/bulk", { names }, getAuthConfig(token));
  return response.data;
}

export async function getFeatures(params = {}, token = null) {
  const response = await api.get("/api/membership/features", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getFeatureById(id, token = null) {
  const response = await api.get(`/api/membership/features/${id}`, getAuthConfig(token));
  return response.data;
}

export async function updateFeature(id, payload, token = null) {
  const response = await api.patch(`/api/membership/features/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteFeature(id, token = null) {
  const response = await api.delete(`/api/membership/features/${id}`, getAuthConfig(token));
  return response.data;
}

export async function memberCheckIn(token) {
  const response = await api.post(
    "/api/attendance/member/check-in",
    {},
    getAuthConfig(token)
  );
  return response.data;
}

export async function trainerCheckIn(token) {
  const response = await api.post(
    "/api/attendance/trainer/check-in",
    {},
    getAuthConfig(token)
  );
  return response.data;
}

export async function selfCheckOut(token) {
  const response = await api.post(
    "/api/attendance/check-out",
    {},
    getAuthConfig(token)
  );
  return response.data;
}

export async function adminCheckIn(payload, token) {
  const response = await api.post(
    "/api/attendance/admin/check-in",
    payload,
    getAuthConfig(token)
  );
  return response.data;
}

export async function adminCheckOut(payload, token) {
  const response = await api.post(
    "/api/attendance/admin/check-out",
    payload,
    getAuthConfig(token)
  );
  return response.data;
}

export async function filterAttendance(params = {}, token = null) {
  const response = await api.get("/api/attendance/filter", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getTodayAttendance(token = null) {
  const response = await api.get("/api/attendance/today", getAuthConfig(token));
  return response.data;
}

export async function getUserAttendance(userId, token = null) {
  const response = await api.get(`/api/attendance/user/${userId}`, getAuthConfig(token));
  return response.data;
}

export async function getAttendanceStats(token = null) {
  const response = await api.get("/api/attendance/stats", getAuthConfig(token));
  return response.data;
}

export async function getActiveAttendance(token = null) {
  const response = await api.get("/api/attendance/active", getAuthConfig(token));
  return response.data;
}

export async function updateAttendance(attendanceId, payload, token = null) {
  const response = await api.patch(`/api/attendance/${attendanceId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteAttendance(attendanceId, token = null) {
  const response = await api.delete(`/api/attendance/${attendanceId}`, getAuthConfig(token));
  return response.data;
}

export async function getMonthlyAttendanceReport(params, token = null) {
  const response = await api.get("/api/attendance/report/monthly", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getAttendanceMemberSummary(userId, token = null) {
  const response = await api.get(`/api/attendance/member-summary/${userId}`, getAuthConfig(token));
  return response.data;
}

export async function getAbsentMembers(token = null) {
  const response = await api.get("/api/attendance/absent-members", getAuthConfig(token));
  return response.data;
}

export async function exportAttendance(params, token = null) {
  const response = await api.get("/api/attendance/export", {
    ...getAuthConfig(token),
    params,
    responseType: "blob",
  });
  return response;
}

export async function getAttendanceByDate(date, token = null) {
  const response = await api.get(`/api/attendance/date/${date}`, getAuthConfig(token));
  return response.data;
}

export async function getTrainerAttendance(trainerId, token = null) {
  const response = await api.get(`/api/attendance/trainer/${trainerId}`, getAuthConfig(token));
  return response.data;
}

export async function getLateCheckIns(params = {}, token = null) {
  const response = await api.get("/api/attendance/late-checkins", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getAttendanceList(token = null) {
  const response = await api.get("/api/attendance", getAuthConfig(token));
  return response.data;
}

export async function bulkCheckIn(records, token = null) {
  const response = await api.post("/api/attendance/admin/bulk-check-in", { records }, getAuthConfig(token));
  return response.data;
}

export async function bulkImportAttendance(records, token = null) {
  const response = await api.post("/api/attendance/admin/bulk-import", { records }, getAuthConfig(token));
  return response.data;
}

export async function getWeeklyAttendanceReport(params = {}, token = null) {
  const response = await api.get("/api/attendance/report/weekly", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getQuarterlyAttendanceReport(params = {}, token = null) {
  const response = await api.get("/api/attendance/report/quarterly", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getYearlyAttendanceReport(params = {}, token = null) {
  const response = await api.get("/api/attendance/report/yearly", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getAttendanceTrends(params = {}, token = null) {
  const response = await api.get("/api/attendance/report/trends", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getPeakHours(params = {}, token = null) {
  const response = await api.get("/api/attendance/report/peak-hours", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getAttendanceComparison(params = {}, token = null) {
  const response = await api.get("/api/attendance/report/comparison", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getRetentionMetrics(params = {}, token = null) {
  const response = await api.get("/api/attendance/report/retention", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getOccupancyReport(params = {}, token = null) {
  const response = await api.get("/api/attendance/report/occupancy", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getAttendanceDashboard(token = null) {
  const response = await api.get("/api/attendance/dashboard", getAuthConfig(token));
  return response.data;
}

export async function subscribeToPlan(userId, planId, token) {
  const response = await api.post(
    `/api/membership/subscribe/${userId}`,
    { planId },
    getAuthConfig(token)
  );
  return response.data;
}

// Nutrition APIs
export async function getFoods(token = null) {
  const response = await api.get("/api/nutrition/foods", getAuthConfig(token));
  return response.data;
}

export async function getFoodById(foodId, token = null) {
  const response = await api.get(`/api/nutrition/foods/${foodId}`, getAuthConfig(token));
  return response.data;
}

export async function createFood(payload, token = null) {
  const response = await api.post("/api/nutrition/foods", payload, getAuthConfig(token));
  return response.data;
}

export async function updateFood(foodId, payload, token = null) {
  const response = await api.patch(`/api/nutrition/foods/${foodId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteFood(foodId, token = null) {
  const response = await api.delete(`/api/nutrition/foods/${foodId}`, getAuthConfig(token));
  return response.data;
}

// Meals
export async function getMeals(token = null) {
  const response = await api.get("/api/nutrition/meals", getAuthConfig(token));
  return response.data;
}

export async function getMealById(mealId, token = null) {
  const response = await api.get(`/api/nutrition/meals/${mealId}`, getAuthConfig(token));
  return response.data;
}

export async function createMeal(payload, token = null) {
  const response = await api.post("/api/nutrition/meals", payload, getAuthConfig(token));
  return response.data;
}

export async function updateMeal(mealId, payload, token = null) {
  const response = await api.patch(`/api/nutrition/meals/${mealId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteMeal(mealId, token = null) {
  const response = await api.delete(`/api/nutrition/meals/${mealId}`, getAuthConfig(token));
  return response.data;
}

// Meal Plans
export async function getPlans(token = null) {
  const response = await api.get("/api/nutrition/plans", getAuthConfig(token));
  return response.data;
}

export async function getPlanById(planId, token = null) {
  const response = await api.get(`/api/nutrition/plans/${planId}`, getAuthConfig(token));
  return response.data;
}

export async function createPlan(payload, token = null) {
  const response = await api.post("/api/nutrition/plans", payload, getAuthConfig(token));
  return response.data;
}

export async function updatePlan(planId, payload, token = null) {
  const response = await api.patch(`/api/nutrition/plans/${planId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deletePlan(planId, token = null) {
  const response = await api.delete(`/api/nutrition/plans/${planId}`, getAuthConfig(token));
  return response.data;
}

// ===== Nutrition Assignments =====
export async function getNutritionAssignments(token = null) {
  const response = await api.get("/api/nutrition/assignments", getAuthConfig(token));
  return response.data;
}

export async function createNutritionAssignment(payload, token = null) {
  const response = await api.post("/api/nutrition/assignments", payload, getAuthConfig(token));
  return response.data;
}

export async function updateNutritionAssignment(id, payload, token = null) {
  const response = await api.patch(`/api/nutrition/assignments/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteNutritionAssignment(id, token = null) {
  const response = await api.delete(`/api/nutrition/assignments/${id}`, getAuthConfig(token));
  return response.data;
}

// ===== Diet Logs =====
export async function getMyDietLogs(params = {}, token = null) {
  const response = await api.get("/api/nutrition/diet-logs", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getUserDietLogs(userId, params = {}, token = null) {
  const response = await api.get(`/api/nutrition/diet-logs/user/${userId}`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function createDietLog(payload, token = null) {
  const response = await api.post("/api/nutrition/diet-logs", payload, getAuthConfig(token));
  return response.data;
}

export async function updateDietLog(id, payload, token = null) {
  const response = await api.patch(`/api/nutrition/diet-logs/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteDietLog(id, token = null) {
  const response = await api.delete(`/api/nutrition/diet-logs/${id}`, getAuthConfig(token));
  return response.data;
}

// ===== Nutrition Goals =====
export async function getMyGoals(token = null) {
  const response = await api.get("/api/nutrition/goals", getAuthConfig(token));
  return response.data;
}

export async function getUserGoals(userId, token = null) {
  const response = await api.get(`/api/nutrition/goals/user/${userId}`, getAuthConfig(token));
  return response.data;
}

export async function createGoal(payload, token = null) {
  const response = await api.post("/api/nutrition/goals", payload, getAuthConfig(token));
  return response.data;
}

// ===== Nutrition Dashboard =====
export async function getNutritionDashboard(token = null) {
  const response = await api.get("/api/nutrition/dashboard", getAuthConfig(token));
  return response.data;
}

export async function getNutritionMemberDashboard(userId) {
  const response = await api.get(`/api/nutrition/dashboard/user/${userId}`, getAuthConfig());
  return response.data;
}

// Class Management APIs
const CLASS_API_PREFIX = "/api/class/classes";

export async function createClass(classData, token) {
  const response = await api.post(
    CLASS_API_PREFIX,
    classData,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getAllClasses(token) {
  const response = await api.get(
    CLASS_API_PREFIX,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getClassById(classId, token, date = null) {
  const config = { ...getAuthConfig(token) };
  if (date) {
    config.params = { date };
  }
  const response = await api.get(
    `${CLASS_API_PREFIX}/${classId}`,
    config
  );
  return response.data;
}

export async function updateClass(classId, classData, token) {
  const response = await api.patch(
    `${CLASS_API_PREFIX}/${classId}`,
    classData,
    getAuthConfig(token)
  );
  return response.data;
}

export async function deleteClass(classId, token = null) {
  const response = await api.delete(
    `${CLASS_API_PREFIX}/${classId}`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function createClassSchedule(classId, scheduleData, token) {
  const response = await api.post(
    `${CLASS_API_PREFIX}/${classId}/schedules`,
    scheduleData,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getClassSchedules(classId, token = null) {
  const response = await api.get(
    `${CLASS_API_PREFIX}/${classId}/schedules`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function createClassSlot(classId, slotData, token) {
  const response = await api.post(
    `${CLASS_API_PREFIX}/${classId}/slots`,
    slotData,
    getAuthConfig(token)
  );
  return response.data;
}

export async function scheduleClass(classId, scheduleData, token) {
  return createClassSlot(classId, scheduleData, token);
}

export async function bookClass(classId, bookingData = {}, token) {
  const response = await api.post(
    `${CLASS_API_PREFIX}/${classId}/book`,
    bookingData,
    getAuthConfig(token)
  );
  return response.data;
}

export async function cancelBooking(bookingId, token = null) {
  const response = await api.patch(
    `/api/class/bookings/${bookingId}/cancel`,
    {},
    getAuthConfig(token)
  );
  return response.data;
}

export async function getSlotsBySchedule(scheduleId, token = null) {
  const response = await api.get(
    `/api/class/schedules/${scheduleId}/slots`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function updateClassSlot(slotId, payload, token = null) {
  const response = await api.patch(
    `/api/class/slots/${slotId}`,
    payload,
    getAuthConfig(token)
  );
  return response.data;
}

export async function deleteClassSlot(slotId, token = null) {
  const response = await api.delete(
    `/api/class/slots/${slotId}`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getMyBookings(token) {
  const response = await api.get(
    "/api/class/my-bookings",
    getAuthConfig(token)
  );
  return response.data;
}

export async function markAttendance(attendanceData, token = null) {
  const response = await api.post(
    "/api/class/attendance",
    attendanceData,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getTrainerClasses(token) {
  const response = await api.get(
    "/api/class/trainer/classes",
    getAuthConfig(token)
  );
  return response.data;
}

export async function getClassBookings(classId, token) {
  const response = await api.get(
    `${CLASS_API_PREFIX}/${classId}/bookings`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getClassAttendance(classId, token) {
  const response = await api.get(
    `${CLASS_API_PREFIX}/${classId}/attendance`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getClassSlots(classId, token = null) {
  const response = await api.get(
    `${CLASS_API_PREFIX}/${classId}/slots`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getAvailableMembers(classId, slotId, bookingDate, token = null) {
  const params = { slotId };
  if (bookingDate) params.bookingDate = bookingDate;
  const response = await api.get(
    `${CLASS_API_PREFIX}/${classId}/available-members`,
    { ...getAuthConfig(token), params }
  );
  return response.data;
}

export async function getSlotAttendance(slotId, token = null) {
  const response = await api.get(
    `/api/class/slots/${slotId}/attendance`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getMemberClassAttendance(userId, token = null) {
  const response = await api.get(
    `/api/class/members/${userId}/attendance`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function deleteClassSchedule(scheduleId, token = null) {
  const response = await api.delete(`/api/class/schedules/${scheduleId}`, getAuthConfig(token));
  return response.data;
}

export async function getSlotMembers(slotId, token = null) {
  const response = await api.get(`/api/class/slots/${slotId}/members`, getAuthConfig(token));
  return response.data;
}

export async function changeSlot(bookingId, payload, token = null) {
  const response = await api.post(`/api/class/bookings/${bookingId}/change-slot`, payload, getAuthConfig(token));
  return response.data;
}

export async function changeSlotPermanent(bookingId, payload, token = null) {
  const response = await api.post(`/api/class/bookings/${bookingId}/change-slot-permanent`, payload, getAuthConfig(token));
  return response.data;
}

export async function getBookingSlotChanges(bookingId, token = null) {
  const response = await api.get(`/api/class/bookings/${bookingId}/slot-changes`, getAuthConfig(token));
  return response.data;
}

const WORKOUT_API_PREFIX = "/api/workout";

export async function getWorkoutPlans(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/workouts`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getWorkoutPlan(planId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/workouts/${planId}`, getAuthConfig(token));
  return response.data;
}

export async function createWorkoutPlan(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/workouts`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateWorkoutPlan(planId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/workouts/${planId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteWorkoutPlan(planId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/workouts/${planId}`, getAuthConfig(token));
  return response.data;
}

export async function getWorkoutDays(planId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/workouts/${planId}/days`, getAuthConfig(token));
  return response.data;
}

export async function createWorkoutDay(planId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/workouts/${planId}/days`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateWorkoutDay(dayId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/days/${dayId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteWorkoutDay(dayId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/days/${dayId}`, getAuthConfig(token));
  return response.data;
}

export async function getExercises(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/exercises`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getExercise(exerciseId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}`, getAuthConfig(token));
  return response.data;
}

export async function createExercise(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/exercises`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateExercise(exerciseId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteExercise(exerciseId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}`, getAuthConfig(token));
  return response.data;
}

export async function assignExerciseToWorkoutDay(dayId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/days/${dayId}/exercises`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateWorkoutDayExercise(workoutExerciseId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/workout-exercises/${workoutExerciseId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function removeWorkoutDayExercise(workoutExerciseId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/workout-exercises/${workoutExerciseId}`, getAuthConfig(token));
  return response.data;
}

export async function assignTrainerToWorkoutPlan(planId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/workouts/${planId}/trainers`, payload, getAuthConfig(token));
  return response.data;
}

export async function getWorkoutTrainers(planId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/workouts/${planId}/trainers`, getAuthConfig(token));
  return response.data;
}

export async function removeWorkoutTrainerAssignment(planId, trainerId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/workouts/${planId}/trainers/${trainerId}`, getAuthConfig(token));
  return response.data;
}

export async function assignWorkoutToMember(planId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/workouts/${planId}/assign`, payload, getAuthConfig(token));
  return response.data;
}

export async function getMyWorkoutAssignments(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/workouts`, getAuthConfig(token));
  return response.data;
}

export async function getUserWorkouts(userId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/users/${userId}/workouts`, getAuthConfig(token));
  return response.data;
}

export async function submitWorkoutProgress(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/workouts/progress`, payload, getAuthConfig(token));
  return response.data;
}

export async function getWorkoutProgress(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/progress`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

// ===== Workout Sessions =====
export async function getWorkoutSessions(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/sessions`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getActiveSession(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/sessions/active`, getAuthConfig(token));
  return response.data;
}

export async function getMySessions(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/sessions`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getUserSessions(userId, params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/users/${userId}/sessions`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getWorkoutSessionById(sessionId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/sessions/${sessionId}`, getAuthConfig(token));
  return response.data;
}

export async function startWorkoutSession(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/sessions/start`, payload, getAuthConfig(token));
  return response.data;
}

export async function completeWorkoutSession(sessionId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/end`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateWorkoutSession(sessionId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/sessions/${sessionId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteWorkoutSession(sessionId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/sessions/${sessionId}`, getAuthConfig(token));
  return response.data;
}

// ===== Workout Sets =====
export async function getWorkoutSets(sessionId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/sets`, getAuthConfig(token));
  return response.data;
}

export async function logWorkoutSet(sessionId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/sets`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateWorkoutSet(sessionId, setId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/sets/${setId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteWorkoutSet(sessionId, setId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/sets/${setId}`, getAuthConfig(token));
  return response.data;
}

export async function getTenantUsers(role = "member", token = null) {
  const config = token ? getAuthConfig(token) : {};
  const response = await api.get("/api/tenant/user/", {
    params: { role },
    ...config,
  });
  return response.data;
}

export async function getTenantUser(id) {
  const response = await api.get(`/api/tenant/user/${id}`);
  return response.data;
}

export async function updateTenantUser(id, payload) {
  const response = await api.put(`/api/tenant/user/${id}`, payload);
  return response.data;
}

export async function deleteUser(id) {
  const response = await api.delete(`/api/tenant/user/${id}`);
  return response.data;
}

export async function getUserPermissions(userId) {
  const response = await api.get(`/api/tenant/users/${userId}/permissions`);
  return response.data;
}

export async function updateUserPermissions(userId, payload) {
  const response = await api.post(`/api/tenant/users/${userId}/permissions`, payload);
  return response.data;
}

export async function getAllCategories(token = null) {
  const response = await api.get("/api/products/category/", getAuthConfig(token));
  return response.data;
}

export async function createCategory(payload, token = null) {
  const response = await api.post("/api/products/category/", payload, getAuthConfig(token));
  return response.data;
}

export async function updateCategory(categoryId, payload, token = null) {
  const response = await api.patch(`/api/products/category/${categoryId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteCategory(categoryId, token = null) {
  const response = await api.delete(`/api/products/category/${categoryId}`, getAuthConfig(token));
  return response.data;
}

export async function getAllProducts(token = null) {
  const response = await api.get("/api/products/", getAuthConfig(token));
  return response.data;
}

export async function createProduct(payload, token = null) {
  const response = await api.post("/api/products/", payload, getAuthConfig(token));
  return response.data;
}

export async function updateProduct(productId, payload, token = null) {
  const response = await api.patch(`/api/products/${productId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteProduct(productId, token = null) {
  const response = await api.delete(`/api/products/${productId}`, getAuthConfig(token));
  return response.data;
}

export async function createFacility(payload, token = null) {
  const response = await api.post("/api/facilities", payload, getAuthConfig(token));
  return response.data;
}

export async function getFacilities(params = {}, token = null) {
  const response = await api.get("/api/facilities", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getFacilityById(facilityId, token = null) {
  const response = await api.get(`/api/facilities/${facilityId}`, getAuthConfig(token));
  return response.data;
}

export async function updateFacility(facilityId, payload, token = null) {
  const response = await api.patch(`/api/facilities/${facilityId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteFacility(facilityId, token = null) {
  const response = await api.delete(`/api/facilities/${facilityId}`, getAuthConfig(token));
  return response.data;
}

export async function toggleFacilityStatus(facilityId, payload, token = null) {
  const response = await api.patch(`/api/facilities/${facilityId}/status`, payload, getAuthConfig(token));
  return response.data;
}

export async function createFacilityMaintenance(payload, token = null) {
  const response = await api.post(`/api/facilities/maintenance`, payload, getAuthConfig(token));
  return response.data;
}

export async function getFacilityMaintenances(params = {}, token = null) {
  const response = await api.get(`/api/facilities/maintenance`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getFacilityMaintenanceById(maintenanceId, token = null) {
  const response = await api.get(`/api/facilities/maintenance/${maintenanceId}`, getAuthConfig(token));
  return response.data;
}

export async function updateFacilityMaintenance(maintenanceId, payload, token = null) {
  const response = await api.patch(`/api/facilities/maintenance/${maintenanceId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteFacilityMaintenance(maintenanceId, token = null) {
  const response = await api.delete(`/api/facilities/maintenance/${maintenanceId}`, getAuthConfig(token));
  return response.data;
}

// ===== Equipments =====
const EQUIPMENT_API_PREFIX = "/api/equipments";

export async function getEquipments(params = {}, token = null) {
  const response = await api.get(EQUIPMENT_API_PREFIX, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getEquipmentById(id, token = null) {
  const response = await api.get(`${EQUIPMENT_API_PREFIX}/${id}`, getAuthConfig(token));
  return response.data;
}

export async function createEquipment(payload, token = null) {
  const response = await api.post(EQUIPMENT_API_PREFIX, payload, getAuthConfig(token));
  return response.data;
}

export async function updateEquipment(id, payload, token = null) {
  const response = await api.patch(`${EQUIPMENT_API_PREFIX}/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteEquipment(id, token = null) {
  const response = await api.delete(`${EQUIPMENT_API_PREFIX}/${id}`, getAuthConfig(token));
  return response.data;
}

export async function getEquipmentMaintenances(equipmentId, token = null) {
  const response = await api.get(`${EQUIPMENT_API_PREFIX}/${equipmentId}/maintenance`, getAuthConfig(token));
  return response.data;
}

export async function createEquipmentMaintenance(equipmentId, payload, token = null) {
  const response = await api.post(`${EQUIPMENT_API_PREFIX}/${equipmentId}/maintenance`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateEquipmentMaintenance(maintenanceId, payload, token = null) {
  const response = await api.patch(`/api/equipments/maintenance/${maintenanceId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteEquipmentMaintenance(maintenanceId, token = null) {
  const response = await api.delete(`/api/equipments/maintenance/${maintenanceId}`, getAuthConfig(token));
  return response.data;
}

export default api;
