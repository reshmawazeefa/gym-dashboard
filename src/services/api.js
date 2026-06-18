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
  if (Array.isArray(payload?.goals)) return payload.goals;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.goals)) return payload.data.goals;
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

export async function getMembershipPlans(token = null) {
  const response = await api.get("/api/membership/plans", getAuthConfig(token));
  return response.data;
}

export async function deleteMembershipPlan(planId, token = null) {
  const response = await api.delete(`/api/membership/plans/${planId}`, getAuthConfig(token));
  return response.data;
}

export async function memberCheckIn(payload, token) {
  const response = await api.post(
    "/api/attendance/member/check-in",
    payload,
    getAuthConfig(token)
  );
  return response.data;
}

export async function trainerCheckIn(payload, token) {
  const response = await api.post(
    "/api/attendance/trainer/check-in",
    payload,
    getAuthConfig(token)
  );
  return response.data;
}

export async function memberCheckOut(payload, token) {
  const response = await api.post(
    "/api/attendance/check-out",
    payload,
    getAuthConfig(token)
  );
  return response.data;
}

export async function trainerCheckOut(payload, token) {
  const response = await api.post(
    "/api/attendance/check-out",
    payload,
    getAuthConfig(token)
  );
  return response.data;
}

export async function attendanceCheckOut(payload, token) {
  const response = await api.post(
    "/api/attendance/check-out",
    payload,
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

export async function getNutritionAssignments(token = null) {
  const response = await api.get(`/api/nutrition/assignments`, getAuthConfig(token));
  return response.data;
}

// Nutrition Dashboard
/**
 * Gym-level nutrition dashboard
 * GET /nutrition/dashboard
 */
export async function getNutritionDashboard(token = null) {
  const response = await api.get(`/api/nutrition/dashboard`, getAuthConfig(token));
  return response.data;
}

/**
 * Member-level nutrition dashboard
 * GET /nutrition/dashboard/member/:userId
 */
export async function getNutritionMemberDashboard(userId, token = null) {
  const response = await api.get(`/api/nutrition/dashboard/member/${userId}`, getAuthConfig(token));
  return response.data;
}

export async function createNutritionAssignment(payload, token = null) {
  const response = await api.post(`/api/nutrition/assign`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateNutritionAssignment(assignmentId, payload, token = null) {
  const response = await api.patch(`/api/nutrition/assign/${assignmentId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteNutritionAssignment(assignmentId, token = null) {
  const response = await api.delete(`/api/nutrition/assign/${assignmentId}`, getAuthConfig(token));
  return response.data;
}

export async function getMyDietLogs(params = {}, token = null) {
  const response = await api.get(`/api/nutrition/my/logs`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getUserDietLogs(userId, params = {}, token = null) {
  const response = await api.get(`/api/nutrition/users/${userId}/logs`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function createDietLog(payload, token = null) {
  const response = await api.post(`/api/nutrition/diet-log`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateDietLog(logId, payload, token = null) {
  const response = await api.patch(`/api/nutrition/diet-log/${logId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteDietLog(logId, token = null) {
  const response = await api.delete(`/api/nutrition/diet-log/${logId}`, getAuthConfig(token));
  return response.data;
}

export async function getMyGoals(token = null) {
  const response = await api.get(`/api/nutrition/my/goals`, getAuthConfig(token));
  return response.data;
}

export async function getUserGoals(userId, token = null) {
  const response = await api.get(`/api/nutrition/goals/${userId}`, getAuthConfig(token));
  return response.data;
}

export async function createGoal(payload, token = null) {
  const response = await api.post(`/api/nutrition/goals`, payload, getAuthConfig(token));
  return response.data;
}

// Class Management APIs
const CLASS_API_BASE = "/api/class";
const CLASS_API_PREFIX = `${CLASS_API_BASE}/classes`;

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

export async function getClassById(classId, token) {
  const response = await api.get(
    `${CLASS_API_PREFIX}/${classId}`,
    getAuthConfig(token)
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

export async function bookOneTimeClass(classId, bookingData = {}, token = null) {
  return bookClass(
    classId,
    {
      ...bookingData,
      isPermanent: false,
    },
    token
  );
}

export async function bookRecurringClass(classId, bookingData = {}, token = null) {
  const recurringBookingData = { ...bookingData };
  delete recurringBookingData.isPermanent;
  return bookClass(classId, recurringBookingData, token);
}

export async function cancelClassBooking(classId, token = null) {
  const response = await api.patch(
    `${CLASS_API_PREFIX}/${classId}/book`,
    {},
    getAuthConfig(token)
  );
  return response.data;
}

export async function cancelBooking(classId, token) {
  return cancelClassBooking(classId, token);
}

export async function getSlotsBySchedule(scheduleId, token = null) {
  const response = await api.get(
    `${CLASS_API_BASE}/schedules/${scheduleId}/slots`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function updateClassSlot(slotId, payload, token = null) {
  const response = await api.patch(
    `${CLASS_API_BASE}/slots/${slotId}`,
    payload,
    getAuthConfig(token)
  );
  return response.data;
}

export async function deleteClassSlot(slotId, token = null) {
  const response = await api.delete(
    `${CLASS_API_BASE}/slots/${slotId}`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getMyBookings(token) {
  const response = await api.get(
    `${CLASS_API_PREFIX}/my-bookings`,
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

export default api;
