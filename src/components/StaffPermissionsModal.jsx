import { useState, useEffect } from "react";
import { X, Save, User } from "lucide-react";
import toast from "react-hot-toast";
import { getTenantPermissions, getUserPermissions, updateUserPermissions, getApiError } from "../services/api";
import {
  getPermissionSubjectId,
} from "../utils/rbac";

function readPermissionCache(subject) {
  const subjectId = getPermissionSubjectId(subject);
  const legacyId = subject?.id || subject?._id || subject?.userId || subject?.email;

  try {
    const stored = localStorage.getItem(`permissions:${subjectId}`);
    if (stored !== null) return JSON.parse(stored);
    return legacyId
      ? JSON.parse(localStorage.getItem(`userPermissions:${legacyId}`) || "[]")
      : [];
  } catch {
    return [];
  }
}

const getUserId = (user) => user?.id || user?._id || user?.userId || user?.email;
const canUseApiPermissions = (subject) =>
  subject?.permissionScope !== "category" && getUserId(subject);
const canSyncCategoryToApi = (subject) =>
  subject?.permissionScope === "category" &&
  Array.isArray(subject?.targetUserIds) &&
  subject.targetUserIds.length > 0;
const hasOwnerRole = (subject) => {
  const roles = [
    subject?.role,
    ...(Array.isArray(subject?.roles) ? subject.roles.map((assignment) => assignment?.role?.name || assignment?.name) : []),
  ];
  return roles.some((role) => String(role || "").toLowerCase() === "owner");
};

function unwrapPermissionCatalog(response) {
  const groups = response?.data?.groups || response?.groups || response?.data || response;
  return Array.isArray(groups) ? groups : [];
}

function permissionKeyOf(permission) {
  return permission?.permissionKey || permission?.key || permission?.permission?.key || (typeof permission === "string" ? permission : "");
}

function permissionSet(values) {
  return new Set((Array.isArray(values) ? values : []).map(permissionKeyOf).filter(Boolean));
}

function normalizeCatalog(response) {
  return unwrapPermissionCatalog(response).flatMap((group) => {
    const moduleKey = group.module || group.moduleKey || group.name || "other";
    return (Array.isArray(group.permissions) ? group.permissions : []).map((permission) => ({
      permissionKey: permissionKeyOf(permission),
      moduleKey,
      category: group.module || moduleKey,
      label: permission.label || permission.name || permission.key || permissionKeyOf(permission),
    })).filter((permission) => permission.permissionKey);
  });
}

function normalizePermissionResponse(response, catalog) {
  const body = response?.data || response || {};
  const direct = body.permissions || body.customPermissions || body.directPermissions || [];
  const effective = permissionSet(body.effectivePermissions || body.effective || []);
  const directMap = new Map((Array.isArray(direct) ? direct : []).map((permission) => [permissionKeyOf(permission), permission]));

  return catalog.map((permission) => {
    const directPermission = directMap.get(permission.permissionKey);
    return {
      ...permission,
      allowed: directPermission ? directPermission.allowed === true : effective.has(permission.permissionKey),
      source: directPermission ? "custom" : effective.has(permission.permissionKey) ? "role" : "none",
    };
  });
}

export default function StaffPermissionsModal({ isOpen, onClose, staffMember }) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!staffMember) return;
      const userId = getUserId(staffMember);
      const savedPermissions = readPermissionCache(staffMember);

      setLoading(true);

      try {
        const catalogResponse = await getTenantPermissions();
        const nextCatalog = normalizeCatalog(catalogResponse);
        const targetUserId = userId || staffMember.targetUserIds?.[0];
        if (!targetUserId) {
          setPermissions(nextCatalog.map((permission) => ({ ...permission, allowed: false, source: "none" })));
          return;
        }

        const response = await getUserPermissions(targetUserId);
        setPermissions(normalizePermissionResponse(response, nextCatalog));
      } catch (error) {
        console.warn("Unable to load permissions:", error);
        const fallbackCatalog = savedPermissions.map((permissionKey) => ({ permissionKey, moduleKey: permissionKey.split(".")[0], category: permissionKey.split(".")[0], label: permissionKey }));
        setPermissions(fallbackCatalog.map((permission) => ({ ...permission, allowed: savedPermissions.includes(permission.permissionKey), source: "custom" })));
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && getUserId(staffMember)) {
      loadPermissions();
    } else if (isOpen && staffMember?.permissionScope === "category") {
      loadPermissions();
    }
  }, [isOpen, staffMember]);

  const handlePermissionChange = (permissionKey, allowed) => {
    setPermissions(prev =>
      prev.map(perm =>
        perm.permissionKey === permissionKey
          ? { ...perm, allowed }
          : perm
      )
    );
  };

  const handleSave = async () => {
    if (hasOwnerRole(staffMember)) {
      toast.error("Owner permissions cannot be modified");
      return;
    }

    const userId = getUserId(staffMember);
    const subjectId = getPermissionSubjectId(staffMember);
    if (!subjectId) return;

    const allowedPermissions = permissions
      .filter((perm) => perm.allowed)
      .map((perm) => perm.permissionKey);

    setSaving(true);
    try {
      const payload = {
        permissions: permissions.map(perm => ({
          permissionKey: perm.permissionKey,
          allowed: perm.allowed,
        })),
      };

      if (canUseApiPermissions(staffMember)) {
        await updateUserPermissions(userId, payload);
      } else if (canSyncCategoryToApi(staffMember)) {
        const results = await Promise.allSettled(
          staffMember.targetUserIds.map((targetUserId) =>
            updateUserPermissions(targetUserId, payload)
          )
        );
        const failedCount = results.filter((result) => result.status === "rejected").length;

        if (failedCount) {
          toast.error(`${failedCount} staff permission update${failedCount > 1 ? "s" : ""} failed`);
        }
      }

      localStorage.setItem(`permissions:${subjectId}`, JSON.stringify(allowedPermissions));
      toast.success(
        canSyncCategoryToApi(staffMember)
          ? `Permissions updated for ${staffMember.targetUserIds.length} staff user${staffMember.targetUserIds.length === 1 ? "" : "s"}`
          : "Permissions updated successfully"
      );
      onClose();
    } catch (error) {
      localStorage.setItem(`permissions:${subjectId}`, JSON.stringify(allowedPermissions));
      toast.success(getApiError(error, "Saved permissions locally"));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const groupedPermissions = permissions.reduce((acc, perm) => {
    const moduleKey = perm.moduleKey || perm.category || "other";
    if (!acc[moduleKey]) acc[moduleKey] = [];
    acc[moduleKey].push(perm);
    return acc;
  }, {});

  const toggleModule = (moduleKey, allowed) => {
    setPermissions((currentPermissions) =>
      currentPermissions.map((permission) =>
        permission.moduleKey === moduleKey ? { ...permission, allowed } : permission
      )
    );
  };

  const ownerPermissionsLocked = hasOwnerRole(staffMember);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[14px] border border-[#D8DEE8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
        <div className="flex items-start justify-between border-b border-[#E6EAF0] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><User size={15} /></div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Manage Permissions</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">{staffMember?.name || staffMember?.label || staffMember?.email} ({staffMember?.role || staffMember?.type})</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close permissions modal" className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#475569]"><X size={13} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-[#64748B]"><div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-[#DCE4EC] border-b-[#0D8252]" />Loading permissions...</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedPermissions).map(([moduleKey, perms]) => {
                const allEnabled = perms.length && perms.every((permission) => permission.allowed);

                return (
                  <section key={moduleKey}>
                    <div className="flex items-center justify-between border-b border-[#E6EAF0] pb-2">
                      <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#334155]"><span className="text-[#64748B]">▣</span>{moduleKey}</h3>
                      <label className="flex items-center gap-1 text-xs font-medium text-[#64748B]">
                        <input type="checkbox" checked={Boolean(allEnabled)} onChange={(event) => toggleModule(moduleKey, event.target.checked)} disabled={ownerPermissionsLocked} className="h-3 w-3 accent-[#0D8252]" />
                        Module access
                      </label>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {perms.map((permission) => (
                        <div key={permission.permissionKey} className="flex min-h-[38px] items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2 transition hover:bg-white">
                          <div className="min-w-0"><p className="truncate text-xs font-semibold text-[#334155]">{permission.label}</p><p className="truncate text-[10px] text-[#94A3B8]">{permission.permissionKey} · {permission.source}</p></div>
                          <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                            <input type="checkbox" className="peer sr-only" checked={permission.allowed} disabled={ownerPermissionsLocked} onChange={(event) => handlePermissionChange(permission.permissionKey, event.target.checked)} />
                            <span className="h-4 w-8 rounded-full bg-[#E2E8F0] transition peer-checked:bg-[#0D8252]" />
                            <span className="pointer-events-none absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                          </label>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E6EAF0] bg-[#FBFCFD] px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]" disabled={saving}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving || loading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-b-transparent" />Saving...</> : <><Save size={12} />Save Permissions</>}
          </button>
        </div>
      </div>
    </div>
  );
}
