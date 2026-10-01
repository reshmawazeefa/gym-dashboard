const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["ACTIVE", "TRIAL", "TRIALING", "PAID", "COMPLETED"]);

export function isSubscriptionActive(status) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || "").trim().toUpperCase());
}

export function isSubscriptionRestricted(status) {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  return Boolean(normalizedStatus) && !ACTIVE_SUBSCRIPTION_STATUSES.has(normalizedStatus);
}