import axios from "axios";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./authStore";
import { notifyError } from "./toastNotifications";

export { clearTokens, getAccessToken, getRefreshToken, loadRefreshToken, setTokens } from "./authStore";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "" : "https://gym-api.wazeefa.in");

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem("authSession")) || null;
  } catch {
    return null;
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export function getAuthToken() {
  return getAccessToken();
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

let isRefreshing = false;
let failedQueue = [];

function processRefreshQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/refresh-token") || originalRequest?.url?.includes("/auth/login");
    if (error.response?.status !== 401 || originalRequest?._retry || isAuthEndpoint) {
      if (!axios.isCancel(error)) notifyError(getApiError(error));
      return Promise.reject(error);
    }

    const storedRefreshToken = getRefreshToken();
    if (!storedRefreshToken) {
      localStorage.removeItem("authSession");
      window.dispatchEvent(new Event("auth:expired"));
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, { refreshToken: storedRefreshToken }, { headers: { "Content-Type": "application/json" } });
      const refreshed = response.data?.data || response.data;
      if (!refreshed.accessToken || !refreshed.refreshToken) throw new Error("Invalid refresh response");
      setTokens(refreshed.accessToken, refreshed.refreshToken);
      processRefreshQueue(null, refreshed.accessToken);
      originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processRefreshQueue(refreshError);
      clearTokens();
      localStorage.removeItem("authSession");
      window.dispatchEvent(new Event("auth:expired"));
      notifyError(getApiError(refreshError));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

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
  const data = error?.response?.data;
  const details = data?.errors || data?.details;

  if (Array.isArray(details)) {
    const firstMessage = details.find((item) => typeof item === "string" && item.trim());
    if (firstMessage) return firstMessage;

    const firstObjectMessage = details
      .map((item) => item?.message || item?.msg || item?.error)
      .find(Boolean);
    if (firstObjectMessage) return firstObjectMessage;
  }

  if (details && typeof details === "object") {
    const firstDetail = Object.values(details)
      .flat()
      .map((item) => (typeof item === "string" ? item : item?.message || item?.msg || item?.error))
      .find(Boolean);
    if (firstDetail) return firstDetail;
  }

  return (
    data?.message ||
    data?.error ||
    error?.message ||
    fallback
  );
}

export async function platformLogin(credentials) {
  const response = await api.post("/api/auth/platform/login", credentials);
  return response.data;
}

export async function platformRegister(payload) {
  const response = await api.post("/api/auth/platform/register", payload);
  return response.data;
}

export async function tenantLogin(credentials) {
  const response = await api.post("/api/auth/login", credentials);
  return response.data;
}

export async function getGymBySlug(slug) {
  const response = await api.get(`/api/auth/gym/${encodeURIComponent(slug)}`);
  return response.data;
}

export async function refreshAuthToken(token) {
  const response = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, { refreshToken: token }, { headers: { "Content-Type": "application/json" } });
  return response.data;
}

export async function logoutAuth(token, access = null) {
  const response = await api.post("/api/auth/logout", { refreshToken: token }, getAuthConfig(access));
  return response.data;
}

export async function logoutAllAuth(token = null) {
  const response = await api.post("/api/auth/logout-all", {}, getAuthConfig(token));
  return response.data;
}

export async function forgotPassword(payload) {
  const response = await api.post("/api/auth/forgot-password", payload);
  return response.data;
}

export async function sendRegistrationOtp(payload) {
  const response = await api.post("/api/auth/send-registration-otp", payload);
  return response.data;
}

export async function verifyRegistrationOtp(payload) {
  const response = await api.post("/api/auth/verify-registration-otp", payload);
  return response.data;
}

export async function startGymRegistration(payload) {
  const response = await api.post("/api/gym/register", payload);
  return response.data;
}

export async function verifyGymRegistration(payload) {
  const response = await api.post("/api/gym/register/verify", payload);
  return response.data;
}

export async function resendGymRegistrationOtp(payload) {
  const response = await api.post("/api/gym/register/resend-otp", payload);
  return response.data;
}

export async function verifyOtp(payload) {
  const response = await api.post("/api/auth/verify-otp", payload);
  return response.data;
}

export async function resetPassword(payload) {
  const response = await api.post("/api/auth/reset-password", payload);
  return response.data;
}

export async function platformForgotPassword(payload) {
  const response = await api.post("/api/auth/platform/forgot-password", payload);
  return response.data;
}

export async function platformVerifyOtp(payload) {
  const response = await api.post("/api/auth/platform/verify-otp", payload);
  return response.data;
}

export async function platformResetPassword(payload) {
  const response = await api.post("/api/auth/platform/reset-password", payload);
  return response.data;
}

export async function createGym(payload, token = null) {
  const response = await api.post("/api/gym", payload, getAuthConfig(token));
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

export async function getMyGym(token = null) {
  const response = await api.get("/api/gym/my-gym", getAuthConfig(token));
  return response.data;
}

export async function registerNotificationDeviceToken(payload, token = null) {
  const response = await api.post("/api/notification/register-token", payload, getAuthConfig(token));
  return response.data;
}

export async function unregisterNotificationDeviceToken(tokenValue, token = null) {
  const response = await api.delete(`/api/notification/unregister-token/${encodeURIComponent(tokenValue)}`, getAuthConfig(token));
  return response.data;
}

export async function getNotifications(params = {}, token = null) {
  const response = await api.get("/api/notification", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getUnreadNotificationCount(token = null) {
  const response = await api.get("/api/notification/unread-count", getAuthConfig(token));
  return response.data;
}

export async function markNotificationAsRead(notificationId, token = null) {
  const response = await api.put(`/api/notification/${notificationId}/read`, {}, getAuthConfig(token));
  return response.data;
}

export async function markAllNotificationsAsRead(token = null) {
  const response = await api.put("/api/notification/read-all", {}, getAuthConfig(token));
  return response.data;
}

export async function sendNotification(payload, token = null) {
  const response = await api.post("/api/notification/send", payload, getAuthConfig(token));
  return response.data;
}

export async function uploadNotificationImage(formData, token = null) {
  const response = await api.post("/api/upload", formData, {
    ...getAuthConfig(token),
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getSentNotifications(params = {}, token = null) {
  const response = await api.get("/api/notification/sent", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getSentNotificationById(notificationId, token = null) {
  const response = await api.get(`/api/notification/sent/${notificationId}`, getAuthConfig(token));
  return response.data;
}

export async function updateGym(id, payload) {
  const response = await api.patch(`/api/gym/${id}`, payload);
  return response.data;
}

export async function gymOwnerLogin(credentials) {
  return tenantLogin(credentials);
}

export async function gymUserLogin(credentials) {
  return tenantLogin(credentials);
}

export async function registerGymMember(payload, token = null) {
  const response = await api.post("/api/auth/register", payload, getAuthConfig(token));
  return response.data;
}

export async function createTenantUser(payload, token = null) {
  const response = await api.post("/api/tenant/create-user", payload, getAuthConfig(token));
  return response.data;
}

export async function createGymStaff(payload, token = null) {
  const authToken = token || getAuthToken();
  if (!authToken) throw new Error("Login token is required to register staff");

  const response = await api.post("/api/auth/staff/create", payload, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  return response.data;
}

export async function getOwnerProfile(token = null) {
  const response = await api.get("/api/profile", getAuthConfig(token));
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

export async function getMembershipDashboard(params = {}, token = null) {
  const response = await api.get("/api/membership/dashboard", { ...getAuthConfig(token), params });
  return response.data;
}

export async function getMembershipSubscriptions(params = {}, token = null) {
  const response = await api.get("/api/membership/subscriptions", { ...getAuthConfig(token), params });
  return response.data;
}

export async function getExpiringMemberships(params = {}, token = null) {
  const response = await api.get("/api/membership/subscriptions/expiring", { ...getAuthConfig(token), params });
  return response.data;
}

export async function assignMembership(payload, token = null) {
  const response = await api.post("/api/membership/subscriptions/assign", payload, getAuthConfig(token));
  return response.data;
}

export async function renewMembership(subscriptionId, payload = {}, token = null) {
  const response = await api.post(`/api/membership/subscriptions/${subscriptionId}/renew`, payload, getAuthConfig(token));
  return response.data;
}

export async function cancelMembership(subscriptionId, payload = {}, token = null) {
  const response = await api.patch(`/api/membership/subscriptions/${subscriptionId}/cancel`, payload, getAuthConfig(token));
  return response.data;
}

export async function getMembershipPayments(params = {}, token = null) {
  const response = await api.get("/api/membership/payments", { ...getAuthConfig(token), params });
  return response.data;
}

export async function createMembershipPayment(payload, token = null) {
  const response = await api.post("/api/membership/payments", payload, getAuthConfig(token));
  return response.data;
}

export async function getMyMembershipPayments(params = {}, token = null) {
  const response = await api.get("/api/membership/payments/me", { ...getAuthConfig(token), params });
  return response.data;
}

export async function updateMembershipSubscriptionPayment(subscriptionId, payload, token = null) {
  const response = await api.patch(`/api/membership/subscriptions/${encodeURIComponent(subscriptionId)}/payment`, payload, getAuthConfig(token));
  return response.data;
}

export async function exportMembershipPayments(params = {}, token = null) {
  const response = await api.get("/api/membership/payments/export", {
    ...getAuthConfig(token),
    params,
    responseType: "blob",
  });
  return response.data;
}

export async function getMembershipEarnings(params = {}, token = null) {
  const response = await api.get("/api/membership/analytics/earnings", { ...getAuthConfig(token), params });
  return response.data;
}

export async function getMemberSubscription(userId, token = null) {
  const response = await api.get(`/api/membership/subscriptions/user/${userId}`, getAuthConfig(token));
  return response.data;
}

export async function checkMembershipAccess(userId, token = null) {
  const response = await api.get(`/api/membership/subscriptions/check-access/${userId}`, getAuthConfig(token));
  return response.data;
}

export async function createMembershipCheckout(payload, token = null) {
  const response = await api.post("/api/membership/subscriptions/checkout", payload, getAuthConfig(token));
  return response.data;
}

export async function verifyMembershipCheckout(payload, token = null) {
  const response = await api.post("/api/membership/subscriptions/verify-payment", payload, getAuthConfig(token));
  return response.data;
}

// ===== SaaS Billing (Gym Owner / Tenant) =====
export async function getBillingPlans(params = {}, token = null) {
  const response = await api.get("/api/billing/plans", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function subscribeToBillingPlan(payload, token = null) {
  const response = await api.post("/api/billing/subscribe", payload, getAuthConfig(token));
  return response.data;
}

export async function createPaymentCheckout(payload, token = null) {
  const response = await api.post("/api/payment/checkout", payload, getAuthConfig(token));
  return response.data;
}

export async function verifyPayment(payload, token = null) {
  const response = await api.post("/api/payment/verify", payload, getAuthConfig(token));
  return response.data;
}

export async function getPaymentOrders(params = {}, token = null) {
  const response = await api.get("/api/payment/orders", {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getPaymentOrder(orderId, token = null) {
  const response = await api.get(`/api/payment/orders/${orderId}`, getAuthConfig(token));
  return response.data;
}

export async function createPaymentRefund(payload, token = null) {
  const response = await api.post("/api/payment/refunds", payload, getAuthConfig(token));
  return response.data;
}

export async function getCurrentSubscription(token = null) {
  const response = await api.get("/api/billing/subscription", getAuthConfig(token));
  return response.data;
}

export async function cancelSubscription(token = null) {
  const response = await api.patch("/api/billing/subscription/cancel", {}, getAuthConfig(token));
  return response.data;
}

export async function renewSubscription(token = null) {
  const response = await api.post("/api/billing/subscription/renew", {}, getAuthConfig(token));
  return response.data;
}

export async function upgradeSubscription(payload, token = null) {
  const response = await api.post("/api/billing/subscription/upgrade", payload, getAuthConfig(token));
  return response.data;
}

export async function getPaymentHistory(token = null) {
  const response = await api.get("/api/billing/payments", getAuthConfig(token));
  return response.data;
}

export async function recordBillingPayment(payload, token = null) {
  const response = await api.post("/api/billing/payments", payload, getAuthConfig(token));
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

export async function getAttendanceLogs(params = {}, token = null) {
  const response = await api.get("/api/attendance/logs", {
    ...getAuthConfig(token),
    params,
  });
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

function toReportIsoDateTime(value, boundary = "start") {
  if (!value || typeof value !== "string") return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value}${boundary === "end" ? "T23:59:59.999Z" : "T00:00:00.000Z"}`;
}

export async function getAttendanceComparison(params = {}, token = null) {
  const normalizedParams = {
    ...params,
    period1Start: toReportIsoDateTime(params.period1Start, "start"),
    period1End: toReportIsoDateTime(params.period1End, "end"),
    period2Start: toReportIsoDateTime(params.period2Start, "start"),
    period2End: toReportIsoDateTime(params.period2End, "end"),
  };
  const response = await api.get("/api/attendance/report/comparison", {
    ...getAuthConfig(token),
    params: normalizedParams,
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
export async function getPlans(page = 1, limit = 20, token = null) {
  const response = await api.get("/api/nutrition/plans", {
    ...getAuthConfig(token),
    params: { page, limit },
  });
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
  const response = await api.get("/api/nutrition/my/logs", {
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
  const response = await api.post("/api/nutrition/diet-log", payload, getAuthConfig(token));
  return response.data;
}

export async function updateDietLog(id, payload, token = null) {
  const response = await api.patch(`/api/nutrition/diet-log/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteDietLog(id, token = null) {
  const response = await api.delete(`/api/nutrition/diet-log/${id}`, getAuthConfig(token));
  return response.data;
}

// ===== Nutrition Goals =====
export async function getMyGoals(token = null) {
  const response = await api.get("/api/nutrition/my/goals", getAuthConfig(token));
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
  const endpoint = userId ? `/api/nutrition/dashboard/member/${userId}` : "/api/nutrition/dashboard/member/me";
  const response = await api.get(endpoint, getAuthConfig());
  return response.data;
}

export async function getMyNutritionPlan(token = null) {
  const response = await api.get("/api/nutrition/my/plan", getAuthConfig(token));
  return response.data;
}

// Class Management APIs
const CLASS_API_ROOT = "/api/class";
const CLASS_CLASSES_API = `${CLASS_API_ROOT}/classes`;

function getClassAuthConfig(token = null, params = null) {
  return params ? { ...getAuthConfig(token), params } : getAuthConfig(token);
}

function normalizeDayOfWeek(value) {
  if (value === null || value === undefined || value === "") return value;
  if (typeof value === "number") return value;

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber;

  const dayMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  return dayMap[String(value).trim().toLowerCase()] ?? value;
}

export async function createClass(classData, token = null) {
  const response = await api.post(CLASS_CLASSES_API, classData, getAuthConfig(token));
  return response.data;
}

export async function getAllClasses(token = null) {
  const response = await api.get(CLASS_CLASSES_API, getAuthConfig(token));
  return response.data;
}

export async function getClassById(classId, token = null, date = null) {
  const params = date ? { date } : null;
  const response = await api.get(`${CLASS_CLASSES_API}/${classId}`, getClassAuthConfig(token, params));
  return response.data;
}

export async function updateClass(classId, classData, token = null) {
  const response = await api.patch(`${CLASS_CLASSES_API}/${classId}`, classData, getAuthConfig(token));
  return response.data;
}

export async function deleteClass(classId, token = null) {
  const response = await api.delete(`${CLASS_CLASSES_API}/${classId}`, getAuthConfig(token));
  return response.data;
}

export async function getTrainerClasses(token = null) {
  const response = await api.get(`${CLASS_API_ROOT}/trainer/classes`, getAuthConfig(token));
  return response.data;
}

export async function createClassSchedule(classId, scheduleData, token = null) {
  const response = await api.post(
    `${CLASS_CLASSES_API}/${classId}/schedules`,
    { ...scheduleData, dayOfWeek: normalizeDayOfWeek(scheduleData?.dayOfWeek) },
    getAuthConfig(token)
  );
  return response.data;
}

export async function getClassSchedules(classId, token = null) {
  const response = await api.get(`${CLASS_CLASSES_API}/${classId}/schedules`, getAuthConfig(token));
  return response.data;
}

export async function updateClassSchedule(scheduleId, scheduleData, token = null) {
  const response = await api.patch(
    `${CLASS_API_ROOT}/schedules/${scheduleId}`,
    { ...scheduleData, dayOfWeek: normalizeDayOfWeek(scheduleData?.dayOfWeek) },
    getAuthConfig(token)
  );
  return response.data;
}

export async function deleteClassSchedule(scheduleId, token = null) {
  const response = await api.delete(`${CLASS_API_ROOT}/schedules/${scheduleId}`, getAuthConfig(token));
  return response.data;
}

export async function createClassSlot(classId, slotData, token = null) {
  const payload = {
    startTime: slotData.startTime,
    endTime: slotData.endTime,
    capacity: Number(slotData.capacity),
  };

  if (slotData.scheduleId) payload.scheduleId = String(slotData.scheduleId);

  const response = await api.post(`${CLASS_CLASSES_API}/${classId}/slots`, payload, getAuthConfig(token));
  return response.data;
}

export async function scheduleClass(classId, scheduleData, token = null) {
  return createClassSlot(classId, scheduleData, token);
}

export async function getClassSlots(classId, token = null) {
  const response = await api.get(`${CLASS_CLASSES_API}/${classId}/slots`, getAuthConfig(token));
  return response.data;
}

export async function getSlotsBySchedule(scheduleId, token = null) {
  const response = await api.get(`${CLASS_API_ROOT}/schedules/${scheduleId}/slots`, getAuthConfig(token));
  return response.data;
}

export async function updateClassSlot(slotId, payload, token = null) {
  const response = await api.patch(`${CLASS_API_ROOT}/slots/${slotId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteClassSlot(slotId, token = null) {
  const response = await api.delete(`${CLASS_API_ROOT}/slots/${slotId}`, getAuthConfig(token));
  return response.data;
}

export async function getSlotMembers(slotId, token = null) {
  const response = await api.get(`${CLASS_API_ROOT}/slots/${slotId}/members`, getAuthConfig(token));
  return response.data;
}

export async function bookClass(classId, bookingData = {}, token = null) {
  const response = await api.post(`${CLASS_CLASSES_API}/${classId}/book`, bookingData, getAuthConfig(token));
  return response.data;
}

export async function cancelBooking(bookingId, token = null) {
  const response = await api.patch(`${CLASS_API_ROOT}/bookings/${bookingId}/cancel`, {}, getAuthConfig(token));
  return response.data;
}

export async function getMyBookings(token = null) {
  const response = await api.get(`${CLASS_API_ROOT}/my-bookings`, getAuthConfig(token));
  return response.data;
}

export async function getClassBookings(classId, token = null) {
  const response = await api.get(`${CLASS_CLASSES_API}/${classId}/bookings`, getAuthConfig(token));
  return response.data;
}

export async function getAvailableMembers(classId, slotId, bookingDate, token = null) {
  const params = { slotId };
  if (bookingDate) params.bookingDate = bookingDate;
  const response = await api.get(`${CLASS_CLASSES_API}/${classId}/available-members`, getClassAuthConfig(token, params));
  return response.data;
}

export async function markAttendance(attendanceData, token = null) {
  const response = await api.post(`${CLASS_API_ROOT}/attendance`, attendanceData, getAuthConfig(token));
  return response.data;
}

export async function getClassAttendance(classId, token = null) {
  const response = await api.get(`${CLASS_CLASSES_API}/${classId}/attendance`, getAuthConfig(token));
  return response.data;
}

export async function getSlotAttendance(slotId, token = null) {
  const response = await api.get(`${CLASS_API_ROOT}/slots/${slotId}/attendance`, getAuthConfig(token));
  return response.data;
}

export async function getMemberClassAttendance(userId, token = null) {
  const response = await api.get(`${CLASS_API_ROOT}/members/${userId}/attendance`, getAuthConfig(token));
  return response.data;
}

export async function changeSlot(bookingId, payload, token = null) {
  const response = await api.post(`${CLASS_API_ROOT}/bookings/${bookingId}/change-slot`, payload, getAuthConfig(token));
  return response.data;
}

export async function changeSlotPermanent(bookingId, payload, token = null) {
  const response = await api.post(`${CLASS_API_ROOT}/bookings/${bookingId}/change-slot-permanent`, payload, getAuthConfig(token));
  return response.data;
}

export async function getBookingSlotChanges(bookingId, token = null) {
  const response = await api.get(`${CLASS_API_ROOT}/bookings/${bookingId}/slot-changes`, getAuthConfig(token));
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

export async function cloneWorkoutPlan(planId, payload = {}, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/workouts/${planId}/clone`, payload, getAuthConfig(token));
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

export async function forkExercise(exerciseId, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}/fork`, {}, getAuthConfig(token));
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

export async function bulkCreateExercises(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/exercises/bulk`, payload, getAuthConfig(token));
  return response.data;
}

export async function bulkDeleteExercises(payload, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/exercises/bulk`, {
    ...getAuthConfig(token),
    data: payload,
  });
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

export async function previewWorkoutAssignment(planId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/workouts/${planId}/assign/preview`, payload, getAuthConfig(token));
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

export async function getMyWorkouts(token = null) {
  return getMyWorkoutAssignments(token);
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

export async function pauseSession(sessionId, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/pause`, {}, getAuthConfig(token));
  return response.data;
}

export async function resumeSession(sessionId, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/resume`, {}, getAuthConfig(token));
  return response.data;
}

export async function substituteSessionExercise(sessionId, exerciseId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/exercises/${exerciseId}/substitute`, payload, getAuthConfig(token));
  return response.data;
}

export async function getSessionSwaps(sessionId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/swaps`, getAuthConfig(token));
  return response.data;
}

// ===== Workout Sets (single + bulk) =====
export async function getWorkoutSets(sessionId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/sets`, getAuthConfig(token));
  return response.data;
}

export async function logWorkoutSet(sessionId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/sets`, payload, getAuthConfig(token));
  return response.data;
}

export async function bulkLogSets(sessionId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/sessions/${sessionId}/bulk-sets`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateWorkoutSet(setId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/sessions/sets/${setId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteWorkoutSet(setId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/sessions/sets/${setId}`, getAuthConfig(token));
  return response.data;
}

// ===== Workout Assignments (admin) =====
export async function updateWorkoutAssignment(id, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/assignments/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function unassignWorkout(id, payload = {}, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/assignments/${id}`, {
    ...getAuthConfig(token),
    data: payload,
  });
  return response.data;
}

export async function reassignWorkout(assignmentId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/assignments/${assignmentId}/reassign`, payload, getAuthConfig(token));
  return response.data;
}

// ===== Workout Progress (admin) =====
export async function updateProgressEntry(id, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/progress/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteProgressEntry(id, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/progress/${id}`, getAuthConfig(token));
  return response.data;
}

// ===== Workout Schedules =====
export async function createSchedule(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/schedules`, payload, getAuthConfig(token));
  return response.data;
}

export async function getMySchedules(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/schedules`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getUpcomingSchedules(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/schedules/upcoming`, getAuthConfig(token));
  return response.data;
}

export async function updateSchedule(id, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/schedules/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteSchedule(id, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/schedules/${id}`, getAuthConfig(token));
  return response.data;
}

export async function checkInToSchedule(id, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/schedules/${id}/check-in`, {}, getAuthConfig(token));
  return response.data;
}

export async function getMyCalendar(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/calendar`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

// ===== Workout Measurements =====
export async function createMeasurement(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/measurements`, payload, getAuthConfig(token));
  return response.data;
}

export async function getMyMeasurements(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/measurements`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getLatestMeasurement(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/measurements/latest`, getAuthConfig(token));
  return response.data;
}

export async function updateMeasurement(id, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/measurements/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteMeasurement(id, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/measurements/${id}`, getAuthConfig(token));
  return response.data;
}

export async function getMeasurementTrends(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/measurements/trends`, getAuthConfig(token));
  return response.data;
}

// ===== Workout Goals =====
export async function createWorkoutGoal(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/goals`, payload, getAuthConfig(token));
  return response.data;
}

export async function getMyWorkoutGoals(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/goals`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getMyGoalById(id, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/goals/${id}`, getAuthConfig(token));
  return response.data;
}

export async function updateGoal(id, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/goals/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteGoal(id, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/goals/${id}`, getAuthConfig(token));
  return response.data;
}

export async function addMilestone(goalId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/goals/${goalId}/milestones`, payload, getAuthConfig(token));
  return response.data;
}

export async function achieveGoal(goalId, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/goals/${goalId}/achieve`, {}, getAuthConfig(token));
  return response.data;
}

// ===== Workout Feedback =====
export async function createFeedback(payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/feedback`, payload, getAuthConfig(token));
  return response.data;
}

export async function getMyFeedback(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/feedback`, getAuthConfig(token));
  return response.data;
}

export async function getUserFeedback(userId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/users/${userId}/feedback`, getAuthConfig(token));
  return response.data;
}

export async function markFeedbackRead(id, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/feedback/${id}/read`, {}, getAuthConfig(token));
  return response.data;
}

// ===== Workout Analytics =====
export async function getMyAnalyticsDashboard(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/dashboard`, getAuthConfig(token));
  return response.data;
}

export async function getVolumeTrend(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/volume`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getConsistency(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/consistency`, getAuthConfig(token));
  return response.data;
}

export async function getMyPRs(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/prs`, getAuthConfig(token));
  return response.data;
}

export async function getMyHeatmap(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/heatmap`, getAuthConfig(token));
  return response.data;
}

export async function getExerciseProgress(exerciseId, params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/exercises/${exerciseId}/progress`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getDurationTrend(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/duration-trend`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getCaloriesTrend(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/calories-trend`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getExerciseDistribution(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/exercise-distribution`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getVolumePerExercise(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/volume-per-exercise`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getWorkoutFrequency(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/workout-frequency`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getAdherenceTrend(params = {}, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/adherence-trend`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getGoalHistory(goalId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/goal-history/${goalId}`, getAuthConfig(token));
  return response.data;
}

export async function getStrengthScore(token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/my/analytics/strength-score`, getAuthConfig(token));
  return response.data;
}

// ===== Workout Supersets =====
export async function createSupersetGroup(dayId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/days/${dayId}/supersets`, payload, getAuthConfig(token));
  return response.data;
}

export async function getSupersetGroups(dayId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/days/${dayId}/supersets`, getAuthConfig(token));
  return response.data;
}

export async function updateSupersetGroup(id, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/days/supersets/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteSupersetGroup(id, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/days/supersets/${id}`, getAuthConfig(token));
  return response.data;
}

// ===== Workout Exercise Substitutions =====
export async function createSubstitution(exerciseId, payload, token = null) {
  const response = await api.post(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}/substitutions`, payload, getAuthConfig(token));
  return response.data;
}

export async function getSubstitutions(exerciseId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}/substitutions`, getAuthConfig(token));
  return response.data;
}

export async function deleteSubstitution(id, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/exercises/substitutions/${id}`, getAuthConfig(token));
  return response.data;
}

// ===== Workout Exercise Media =====
export async function uploadExerciseMedia(exerciseId, payload, token = null) {
  const config = getAuthConfig(token);

  if (payload instanceof FormData) {
    const formConfig = config ? { ...config, headers: { ...config.headers, "Content-Type": "multipart/form-data" } } : { headers: { "Content-Type": "multipart/form-data" } };
    const response = await api.post(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}/media`, payload, formConfig);
    return response.data;
  }

  const response = await api.post(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}/media`, payload, config);
  return response.data;
}

export async function getExerciseMedia(exerciseId, token = null) {
  const response = await api.get(`${WORKOUT_API_PREFIX}/exercises/${exerciseId}/media`, getAuthConfig(token));
  return response.data;
}

export async function updateExerciseMedia(mediaId, payload, token = null) {
  const response = await api.patch(`${WORKOUT_API_PREFIX}/exercises/media/${mediaId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteExerciseMedia(mediaId, token = null) {
  const response = await api.delete(`${WORKOUT_API_PREFIX}/exercises/media/${mediaId}`, getAuthConfig(token));
  return response.data;
}

export async function getTenantUsers(role = "member", token = null) {
  const config = token ? getAuthConfig(token) : {};
  const response = await api.get("/api/tenant/user", {
    params: { role },
    ...config,
  });
  return response.data;
}

export async function getTenantMembers(token = null) {
  const response = await api.get("/api/tenant/members", getAuthConfig(token));
  return response.data;
}

export async function getTenantMember(id, token = null) {
  const response = await api.get(`/api/tenant/members/${id}`, getAuthConfig(token));
  return response.data;
}

export async function updateTenantMember(id, payload, token = null) {
  const response = await api.patch(`/api/tenant/members/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function getTenantUser(id, token = null) {
  const response = await api.get(`/api/tenant/user/${id}`, getAuthConfig(token));
  return response.data;
}

export async function updateTenantUser(id, payload, token = null) {
  const response = await api.patch(`/api/tenant/user/${id}`, payload, getAuthConfig(token));
  return response.data;
}

export async function updateTenantUserStatus(id, payload, token = null) {
  const response = await api.patch(`/api/tenant/user/${id}/status`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteUser(id, token = null) {
  const response = await api.delete(`/api/tenant/user/${id}`, getAuthConfig(token));
  return response.data;
}

export async function getRoles(token = null) {
  const response = await api.get("/api/roles", getAuthConfig(token));
  return response.data;
}

export async function getRole(roleId, token = null) {
  const response = await api.get(`/api/roles/${roleId}`, getAuthConfig(token));
  return response.data;
}

export async function createRole(payload, token = null) {
  const response = await api.post("/api/roles", payload, getAuthConfig(token));
  return response.data;
}

export async function updateRole(roleId, payload, token = null) {
  const response = await api.patch(`/api/roles/${roleId}`, payload, getAuthConfig(token));
  return response.data;
}

export async function deleteRole(roleId, token = null) {
  const response = await api.delete(`/api/roles/${roleId}`, getAuthConfig(token));
  return response.data;
}

export async function assignTenantUserRole(userId, payload, token = null) {
  const response = await api.post(`/api/tenant/user/${userId}/assign-role`, payload, getAuthConfig(token));
  return response.data;
}

export async function getTenantPermissions(token = null) {
  const response = await api.get("/api/tenant/permissions", getAuthConfig(token));
  return response.data;
}

export async function getUserPermissions(userId, token = null) {
  const response = await api.get(`/api/tenant/users/${userId}/permissions`, getAuthConfig(token));
  return response.data;
}

export async function updateUserPermissions(userId, payload, token = null) {
  const response = await api.post(`/api/tenant/users/${userId}/permissions`, payload, getAuthConfig(token));
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

const PAYROLL_API_PREFIX = "/api/payroll";

export async function getPayrollStaff(params = {}, token = null) {
  const response = await api.get(`${PAYROLL_API_PREFIX}/staff`, { ...getAuthConfig(token), params });
  return response.data;
}

export async function getPayrollWages(params = {}, token = null) {
  const response = await api.get(`${PAYROLL_API_PREFIX}/wages`, { ...getAuthConfig(token), params });
  return response.data;
}

export async function createPayrollWage(payload, token = null) {
  const response = await api.post(`${PAYROLL_API_PREFIX}/wages`, payload, getAuthConfig(token));
  return response.data;
}

export async function updatePayrollWage(wageId, payload, token = null) {
  const response = await api.patch(`${PAYROLL_API_PREFIX}/wages/${encodeURIComponent(wageId)}`, payload, getAuthConfig(token));
  return response.data;
}

export async function endPayrollWage(wageId, token = null) {
  const response = await api.delete(`${PAYROLL_API_PREFIX}/wages/${encodeURIComponent(wageId)}`, getAuthConfig(token));
  return response.data;
}

export async function getPayrollWageSummary(userId, token = null) {
  const response = await api.get(`${PAYROLL_API_PREFIX}/wages/${encodeURIComponent(userId)}/summary`, getAuthConfig(token));
  return response.data;
}

export async function getPayrollAbsences(params = {}, token = null) {
  const response = await api.get(`${PAYROLL_API_PREFIX}/absences`, { ...getAuthConfig(token), params });
  return response.data;
}

export async function createPayrollAbsence(payload, token = null) {
  const response = await api.post(`${PAYROLL_API_PREFIX}/absences`, payload, getAuthConfig(token));
  return response.data;
}

export async function voidPayrollAbsence(absenceId, token = null) {
  const response = await api.post(`${PAYROLL_API_PREFIX}/absences/${encodeURIComponent(absenceId)}/void`, {}, getAuthConfig(token));
  return response.data;
}

export async function getPayrollHolidays(params = {}, token = null) {
  const response = await api.get(`${PAYROLL_API_PREFIX}/holidays`, { ...getAuthConfig(token), params });
  return response.data;
}

export async function createPayrollHoliday(payload, token = null) {
  const response = await api.post(`${PAYROLL_API_PREFIX}/holidays`, payload, getAuthConfig(token));
  return response.data;
}

export async function voidPayrollHoliday(holidayId, token = null) {
  const response = await api.post(`${PAYROLL_API_PREFIX}/holidays/${encodeURIComponent(holidayId)}/void`, {}, getAuthConfig(token));
  return response.data;
}

export async function getPayrollPayments(params = {}, token = null) {
  const response = await api.get(`${PAYROLL_API_PREFIX}/payments`, { ...getAuthConfig(token), params });
  return response.data;
}

export async function createPayrollPayment(payload, token = null) {
  const response = await api.post(`${PAYROLL_API_PREFIX}/payments`, payload, getAuthConfig(token));
  return response.data;
}

export async function voidPayrollPayment(paymentId, payload, token = null) {
  const response = await api.post(`${PAYROLL_API_PREFIX}/payments/${encodeURIComponent(paymentId)}/void`, payload, getAuthConfig(token));
  return response.data;
}

export async function getMyPayroll(token = null) {
  const response = await api.get(`${PAYROLL_API_PREFIX}/me`, getAuthConfig(token));
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

export async function bulkCreateEquipment(payload, token = null) {
  const response = await api.post(`${EQUIPMENT_API_PREFIX}/bulk`, payload, getAuthConfig(token));
  return response.data;
}

export async function bulkUpdateEquipment(payload, token = null) {
  const response = await api.patch(`${EQUIPMENT_API_PREFIX}/bulk`, payload, getAuthConfig(token));
  return response.data;
}

export async function bulkDeleteEquipment(payload, token = null) {
  const response = await api.delete(`${EQUIPMENT_API_PREFIX}/bulk`, {
    ...getAuthConfig(token),
    data: payload,
  });
  return response.data;
}

export async function exportEquipment(params = {}, token = null) {
  const response = await api.get(`${EQUIPMENT_API_PREFIX}/export`, {
    ...getAuthConfig(token),
    params,
    responseType: "text",
  });
  return response.data;
}

export async function getEquipmentDashboard(token = null) {
  const response = await api.get(`${EQUIPMENT_API_PREFIX}/dashboard`, getAuthConfig(token));
  return response.data;
}

export async function getEquipmentMaintenanceCostReport(params = {}, token = null) {
  const response = await api.get(`${EQUIPMENT_API_PREFIX}/reports/maintenance-costs`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getEquipmentWarrantyExpiryReport(params = {}, token = null) {
  const response = await api.get(`${EQUIPMENT_API_PREFIX}/reports/warranty-expiry`, {
    ...getAuthConfig(token),
    params,
  });
  return response.data;
}

export async function getEquipmentConditionSummaryReport(token = null) {
  const response = await api.get(`${EQUIPMENT_API_PREFIX}/reports/condition-summary`, getAuthConfig(token));
  return response.data;
}

export async function getEquipmentUtilizationReport(params = {}, token = null) {
  const response = await api.get(`${EQUIPMENT_API_PREFIX}/reports/utilization`, {
    ...getAuthConfig(token),
    params,
  });
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
