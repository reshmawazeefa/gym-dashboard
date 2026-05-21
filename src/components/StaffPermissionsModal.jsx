import { useState, useEffect } from "react";
import { X, Save, User } from "lucide-react";
import toast from "react-hot-toast";
import { getUserPermissions, updateUserPermissions, getApiError } from "../services/api";
import {
  getPermissionStateForUser,
  getPermissionSubjectId,
  MODULE_PERMISSIONS,
  normalizePermissions,
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

export default function StaffPermissionsModal({ isOpen, onClose, staffMember }) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!staffMember) return;
      const userId = getUserId(staffMember);
      const savedPermissions = readPermissionCache(staffMember);

      if (!canUseApiPermissions(staffMember) && !canSyncCategoryToApi(staffMember)) {
        setPermissions(
          getPermissionStateForUser({
            ...staffMember,
            permissions: savedPermissions,
          })
        );
        return;
      }

      setLoading(true);
      try {
        const response = await getUserPermissions(userId || staffMember.targetUserIds[0]);
        const userPermissions = normalizePermissions(
          Array.isArray(response)
            ? response
            : response?.permissions || response?.data?.permissions || response?.data || savedPermissions
        );

        setPermissions(
          getPermissionStateForUser({
            ...staffMember,
            permissions: userPermissions,
          })
        );
      } catch (error) {
        console.warn("Unable to load permissions:", error);

        setPermissions(
          getPermissionStateForUser({
            ...staffMember,
            permissions: savedPermissions.length ? savedPermissions : staffMember?.permissions,
          })
        );
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
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const toggleModule = (moduleKey, allowed) => {
    setPermissions((currentPermissions) =>
      currentPermissions.map((permission) =>
        permission.moduleKey === moduleKey ? { ...permission, allowed } : permission
      )
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Manage Permissions
              </h2>
              <p className="text-sm text-gray-600">
                {staffMember?.name || staffMember?.label || staffMember?.email} ({staffMember?.role || staffMember?.type})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading permissions...</span>
            </div>
          ) : (
            <div className="space-y-8">
              {MODULE_PERMISSIONS.map((module) => {
                const perms = groupedPermissions[module.label] || [];
                const allEnabled = perms.length && perms.every((permission) => permission.allowed);

                return (
                  <div key={module.key} className="space-y-3">
                    <div className="flex flex-col gap-3 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-base font-semibold text-gray-900">{module.label}</h3>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                        <span>Module access</span>
                        <input
                          type="checkbox"
                          checked={Boolean(allEnabled)}
                          onChange={(event) => toggleModule(module.key, event.target.checked)}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {perms.map((permission) => (
                        <div
                          key={permission.permissionKey}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm transition-colors hover:bg-gray-100"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {permission.label}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {permission.permissionKey}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={permission.allowed}
                              onChange={(e) =>
                                handlePermissionChange(
                                  permission.permissionKey,
                                  e.target.checked
                                )
                              }
                            />
                            <div className="h-5 w-10 rounded-full bg-gray-200 transition-colors peer-checked:bg-blue-600"></div>
                            <div className="pointer-events-none absolute left-0 top-0 h-5 w-5 translate-x-0 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-gray-200 bg-white px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors sm:w-auto"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors sm:w-auto"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Permissions
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
