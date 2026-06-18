export const ACTIONS = ["view", "create", "edit", "delete"];

export const MODULE_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", actions: ["view"] },
  { key: "members", label: "Members", actions: ["read", "create", "update", "delete"] },
  { key: "plans", label: "Our Packages", actions: ["read", "create", "update", "delete"] },
  { key: "payments", label: "Payments", actions: ["read", "create", "update"] },
  { key: "staff", label: "Staff", actions: ["read", "create", "update", "delete"] },
  { key: "permissions", label: "Permissions", actions: ["read", "assign", "remove"] },
  { key: "gyms", label: "Platform Gyms", actions: ["read", "create", "edit", "delete"] },
  { key: "attendance", label: "Attendance" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "classes", label: "Classes" },
  { key: "workouts", label: "Workouts" },
  { key: "nutrition", label: "Nutrition" },
  { key: "products", label: "Products" },
  { key: "facilities", label: "Facilities" },
  { key: "facility-maintenance", label: "Facility Maintenance", actions: ["view", "create", "edit", "delete"] },
  { key: "finance", label: "Finance" },
  { key: "reports", label: "Reports", actions: ["view", "create"] },
  { key: "communication", label: "Communication" },
  { key: "reminders", label: "Reminders" },
  { key: "localization", label: "Languages" },
  { key: "integrations", label: "API & Stripe" },
];

export const MODULE_PERMISSION_MAP = MODULE_PERMISSIONS.reduce((map, module) => {
  map[module.key] = {
    ...module,
    actions: module.actions || ACTIONS,
  };
  return map;
}, {});

export const ROLE_LABELS = {
  platform_admin: "Platform Admin",
  gym_owner: "Gym Owner",
  staff: "Staff",
  member: "Member",
};

export const STAFF_ROLE_CATEGORIES = [
  { key: "admin", label: "Admin" },
  { key: "trainer", label: "Trainer" },
  { key: "receptionist", label: "Receptionist" },
];

export const MEMBER_CATEGORIES = [
  { key: "member", label: "Member" },
];

export const PERMISSION_TEMPLATES = [
  ...STAFF_ROLE_CATEGORIES.map((category) => ({
    ...category,
    type: "staff",
    subjectId: `category:staff:${category.key}`,
  })),
  ...MEMBER_CATEGORIES.map((category) => ({
    ...category,
    type: "member",
    subjectId: `category:member:${category.key}`,
  })),
];

const OWNER_MODULES = MODULE_PERMISSIONS.map((module) => module.key).filter((key) => key !== "gyms");
const STAFF_MODULES = [
  "dashboard",
  "members",
  "plans",
  "payments",
  "staff",
  "attendance",
  "classes",
  "workouts",
  "nutrition",
  "products",
  "facilities",
  "facility-maintenance",
  "reports",
  "communication",
  "reminders",
];
const MEMBER_MODULES = [
  "dashboard",
  "plans",
  "payments",
  "attendance",
  "classes",
  "workouts",
  "nutrition",
  "communication",
  "reminders",
];

function buildPermissions(moduleKeys, actionOverrides = {}) {
  return moduleKeys.flatMap((moduleKey) => {
    const module = MODULE_PERMISSION_MAP[moduleKey];
    if (!module) return [];

    const actions = actionOverrides[moduleKey] || module.actions;
    return actions.map((action) => permissionKey(moduleKey, action));
  });
}

export const DEFAULT_ROLE_PERMISSIONS = {
  platform_admin: buildPermissions(["dashboard", "gyms"]),
  gym_owner: buildPermissions(OWNER_MODULES),
  staff: buildPermissions(STAFF_MODULES, {
    permissions: [],
    finance: ["view"],
    reports: ["view", "create"],
  }),
  member: buildPermissions(MEMBER_MODULES, {
    dashboard: ["view"],
    plans: ["read"],
    payments: ["view", "create"],
    attendance: ["view"],
    subscriptions: ["view"],
    classes: ["view"],
    workouts: ["view"],
    nutrition: ["view"],
    communication: ["view"],
    reminders: ["view"],
  }),
};

export const DEFAULT_CATEGORY_PERMISSIONS = {
  "category:staff:admin": buildPermissions(STAFF_MODULES, {
    finance: ["view"],
    reports: ["view", "create"],
  }),
  "category:staff:trainer": buildPermissions(
    ["dashboard", "members", "attendance", "subscriptions", "classes", "workouts", "nutrition", "communication"],
    {
      members: ["read"],
      attendance: ["view", "create"],
      subscriptions: ["view", "create"],
      classes: ["view", "create", "edit", "delete"],
      workouts: ["view", "create", "edit"],
      nutrition: ["view", "create", "edit"],
      communication: ["view"],
    }
  ),
  "category:staff:receptionist": buildPermissions(
    ["dashboard", "members", "plans", "payments", "attendance", "subscriptions", "classes", "communication", "reminders"],
    {
      members: ["read", "create", "update"],
      plans: ["read"],
      payments: ["view", "create", "edit"],
      attendance: ["view", "create"],
      subscriptions: ["view", "create", "edit"],
      classes: ["view", "create", "edit", "delete"],
      communication: ["view", "create"],
      reminders: ["view", "create", "edit"],
    }
  ),
  "category:member:member": DEFAULT_ROLE_PERMISSIONS.member,
};

const OWNER_ROLES = new Set(["platform_admin", "gym_owner", "owner", "super_admin"]);
const STAFF_ROLES = new Set([
  "staff",
  "admin",
  "trainer",
  "receptionist",
  "receptionalist",
]);

export function normalizeRole(role, loginType = "") {
  const value = String(role || loginType || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (value === "platform" || value === "platform_admin") return "platform_admin";
  if (value === "gym_owner" || value === "owner") return "gym_owner";
  if (value === "gym_member" || value === "member") return "member";
  if (STAFF_ROLES.has(value) || loginType === "staff") return "staff";

  return value || "member";
}

export function normalizeCategory(value, fallback = "active") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getStaffCategory(user = {}) {
  const value = normalizeCategory(
    user.staffRole ||
      user.roleName ||
      user.designation ||
      user.position ||
      user.role ||
      user.userRole ||
      user.type,
    "staff"
  );

  if (value.includes("admin")) return "admin";
  if (value.includes("trainer")) return "trainer";
  if (value.includes("reception")) return "receptionist";
  return STAFF_ROLE_CATEGORIES.some((category) => category.key === value) ? value : "trainer";
}

export function getMemberCategory(user = {}) {
  return normalizeCategory(user.memberCategory || user.category, "member") === "member"
    ? "member"
    : "member";
}

export function getAccessCategory(user = {}) {
  const role = normalizeRole(user.role, user.loginType);

  if (role === "staff") return `category:staff:${getStaffCategory(user)}`;
  if (role === "member") return `category:member:${getMemberCategory(user)}`;

  return `role:${role}`;
}

export function getPermissionSubjectId(subject = {}) {
  if (subject.permissionSubjectId) return subject.permissionSubjectId;
  if (subject.subjectId) return subject.subjectId;
  if (subject.permissionScope === "category") return getAccessCategory(subject);
  const id = subject.id || subject._id || subject.userId || subject.email;
  return id ? `user:${id}` : getAccessCategory(subject);
}

function readStoredPermissions(subjectId) {
  if (!subjectId || typeof localStorage === "undefined") return null;

  try {
    const stored = localStorage.getItem(`permissions:${subjectId}`);
    if (stored !== null) return JSON.parse(stored);

    if (subjectId === "category:staff:receptionist") {
      const legacyStored = localStorage.getItem("permissions:category:staff:receptionalist");
      return legacyStored === null ? null : JSON.parse(legacyStored);
    }

    return null;
  } catch {
    return null;
  }
}

export function getRoleLabel(role, loginType = "") {
  const normalized = normalizeRole(role, loginType);
  return ROLE_LABELS[normalized] || String(role || loginType || "Member");
}

export function isPrivilegedRole(role, loginType = "") {
  return OWNER_ROLES.has(normalizeRole(role, loginType));
}

export function permissionKey(moduleKey, action = "view") {
  if (
    moduleKey === "members" ||
    moduleKey === "plans" ||
    moduleKey === "payments" ||
    moduleKey === "staff" ||
    moduleKey === "permissions" ||
    moduleKey === "gyms"
  ) {
    const namespace = moduleKey === "members"
      ? "member"
      : moduleKey === "plans"
      ? "plan"
      : moduleKey === "payments"
      ? "payment"
      : moduleKey === "permissions"
      ? "permission"
      : moduleKey === "gyms"
      ? "gyms"
      : "staff";

    if (action === "view" || action === "read") return `${namespace}.read`;
    if (moduleKey === "members" || moduleKey === "plans" || moduleKey === "payments" || moduleKey === "staff" || moduleKey === "gyms") {
      if (action === "create" || action === "assign") return `${namespace}.create`;
      if (action === "edit" || action === "update") return `${namespace}.update`;
      if (action === "delete" || action === "remove") return `${namespace}.delete`;
      return `${namespace}.${action}`;
    }
    if (action === "create" || action === "assign") return `${namespace}.assign`;
    if (action === "edit" || action === "update") return `${namespace}.assign`;
    if (action === "delete" || action === "remove") return `${namespace}.remove`;
    return `${namespace}.${action}`;
  }

  return `${moduleKey}.${action}`;
}

function normalizePermissionKey(permission) {
  const value = String(permission || "").trim().toLowerCase();
  if (!value) return "";

  if (/^[a-z0-9_]+$/.test(value) && MODULE_PERMISSION_MAP[value]) {
    if (value === "members") return "member.read";
    if (value === "plans") return "plan.read";
    if (value === "payments") return "payment.read";
    if (value === "staff") return "staff.read";
    if (value === "permissions") return "permission.read";
    if (value === "gyms") return "gyms.read";
    return `${value}.view`;
  }

  if (/^[a-z0-9_]+\.[a-z0-9_]+$/.test(value)) {
    const [moduleKey, action] = value.split(".");
    if (
      moduleKey === "members" ||
      moduleKey === "plans" ||
      moduleKey === "payments" ||
      moduleKey === "staff" ||
      moduleKey === "permissions"
    ) {
      const namespace = moduleKey === "members"
        ? "member"
        : moduleKey === "plans"
        ? "plan"
        : moduleKey === "payments"
        ? "payment"
        : moduleKey === "permissions"
        ? "permission"
        : "staff";
      if (action === "view" || action === "read") return `${namespace}.read`;
      if (moduleKey === "members" || moduleKey === "plans" || moduleKey === "payments" || moduleKey === "staff" || moduleKey === "gyms") {
        if (action === "create" || action === "assign") return `${namespace}.create`;
        if (action === "edit" || action === "update") return `${namespace}.update`;
        if (action === "delete" || action === "remove") return `${namespace}.delete`;
        return `${namespace}.${action}`;
      }
      if (action === "create" || action === "assign") return `${namespace}.assign`;
      if (action === "edit" || action === "update") return `${namespace}.assign`;
      if (action === "delete" || action === "remove") return `${namespace}.remove`;
    }
    return value;
  }

  return value;
}

export function normalizePermissions(permissions = []) {
  if (!Array.isArray(permissions)) return [];

  return permissions
    .map((permission) => {
      if (typeof permission === "string") return normalizePermissionKey(permission);
      if (!permission || permission.allowed === false) return "";
      return normalizePermissionKey(permission.permissionKey || permission.key || permission.name || "");
    })
    .filter(Boolean);
}

export function getUserPermissions(user) {
  if (!user) return [];
  const normalizedRole = normalizeRole(user.role, user.loginType);
  const explicitPermissions = normalizePermissions(user.permissions);
  const userPermissions = readStoredPermissions(getPermissionSubjectId(user));
  const categoryPermissions = readStoredPermissions(getAccessCategory(user));
  const defaultCategoryPermissions = DEFAULT_CATEGORY_PERMISSIONS[getAccessCategory(user)];

  if (explicitPermissions.length) return explicitPermissions;
  if (Array.isArray(userPermissions)) return normalizePermissions(userPermissions);
  if (Array.isArray(categoryPermissions)) return normalizePermissions(categoryPermissions);
  if (defaultCategoryPermissions?.length) return defaultCategoryPermissions;
  return DEFAULT_ROLE_PERMISSIONS[normalizedRole] || DEFAULT_ROLE_PERMISSIONS.member;
}

export function canAccess(user, moduleKey, action = "view") {
  if (!user) return false;
  const explicitPermissions = normalizePermissions(user.permissions);

  if (!explicitPermissions.length && isPrivilegedRole(user.role, user.loginType)) {
    return true;
  }

  const permissions = getUserPermissions(user);
  return permissions.includes(permissionKey(moduleKey, action));
}

export function getPermissionStateForUser(user) {
  const allowed = new Set(getUserPermissions(user));

  return MODULE_PERMISSIONS.flatMap((module) =>
    (module.actions || ACTIONS).map((action) => ({
      permissionKey: permissionKey(module.key, action),
      allowed: allowed.has(permissionKey(module.key, action)),
      label: `${module.label}: ${action[0].toUpperCase()}${action.slice(1)}`,
      category: module.label,
      moduleKey: module.key,
      action,
    }))
  );
}
