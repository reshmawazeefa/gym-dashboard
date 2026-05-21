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
  return getStoredSession()?.token || null;
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
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.members)) return payload.members;
  if (Array.isArray(payload?.data?.users)) return payload.data.users;
  if (Array.isArray(payload?.data?.members)) return payload.data.members;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

export function unwrapObject(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.data && !Array.isArray(payload.data)) return payload.data;
  if (payload.user) return payload.user;
  if (payload.gym) return payload.gym;
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

export async function updateGym(id, payload) {
  const response = await api.put(`/api/platform/gyms/${id}`, payload);
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

export async function createMembershipPlan(payload) {
  const response = await api.post("/api/membership/plans", payload);
  return response.data;
}

export async function updateMembershipPlan(planId, payload) {
  const response = await api.patch(`/api/membership/plans/${planId}`, payload);
  return response.data;
}

export async function getMembershipPlans() {
  const response = await api.get("/api/membership/plans");
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

// Class Management APIs
export async function createClass(classData, token) {
  const response = await api.post(
    "/api/class/",
    classData,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getAllClasses(token) {
  const response = await api.get(
    "/api/class/",
    getAuthConfig(token)
  );
  return response.data;
}

export async function getClassById(classId, token) {
  const response = await api.get(
    `/api/class/${classId}`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function scheduleClass(classId, scheduleData, token) {
  const response = await api.post(
    `/api/class/${classId}/schedules`,
    scheduleData,
    getAuthConfig(token)
  );
  return response.data;
}

export async function bookClass(classId, token) {
  const response = await api.post(
    `/api/class/${classId}/book`,
    {},
    getAuthConfig(token)
  );
  return response.data;
}

export async function cancelBooking(bookingId, token) {
  const response = await api.post(
    `/api/class/bookings/${bookingId}/cancel`,
    {},
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

export async function markAttendance(attendanceData, token) {
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
    `/api/class/${classId}/bookings`,
    getAuthConfig(token)
  );
  return response.data;
}

export async function getClassAttendance(classId, token) {
  const response = await api.get(
    `/api/class/${classId}/attendance`,
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

export default api;
