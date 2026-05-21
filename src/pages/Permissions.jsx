import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Settings, Shield, Users } from "lucide-react";
import StaffPermissionsModal from "../components/StaffPermissionsModal";
import { getTenantUsers, unwrapList } from "../services/api";
import {
  DEFAULT_CATEGORY_PERMISSIONS,
  getStaffCategory,
  MEMBER_CATEGORIES,
  MODULE_PERMISSIONS,
  STAFF_ROLE_CATEGORIES,
} from "../utils/rbac";

function readStoredPermissions(subjectId) {
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

function getUserId(user) {
  return user?.id || user?._id || user?.userId || user?.email;
}

function getGroupRows(staffByCategory) {
  return [
    ...MEMBER_CATEGORIES.map((category) => ({
      key: `member-${category.key}`,
      name: category.label,
      role: "Member",
      type: "member",
      subjectId: `category:member:${category.key}`,
      description: "Default module permissions for all member accounts.",
    })),
    ...STAFF_ROLE_CATEGORIES.map((category) => ({
      key: `staff-${category.key}`,
      name: `Staff: ${category.label}`,
      role: category.label,
      type: "staff",
      subjectId: `category:staff:${category.key}`,
      targetUserIds: staffByCategory[category.key] || [],
      description: `Default module permissions for staff with the ${category.label} role.`,
    })),
  ];
}

function getAllowedCount(subjectId) {
  const storedPermissions = readStoredPermissions(subjectId);
  return (storedPermissions || DEFAULT_CATEGORY_PERMISSIONS[subjectId] || []).length;
}

export default function Permissions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffByCategory, setStaffByCategory] = useState({});
  const [loadingStaff, setLoadingStaff] = useState(false);

  const loadStaffTargets = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const responses = await Promise.allSettled([
        getTenantUsers("staff"),
        getTenantUsers("admin"),
        getTenantUsers("trainer"),
        getTenantUsers("receptionist"),
      ]);
      const apiStaff = responses.flatMap((response) =>
        response.status === "fulfilled" ? unwrapList(response.value) : []
      );
      const localStaff = JSON.parse(localStorage.getItem("staff") || "[]");
      const uniqueStaff = [...apiStaff, ...localStaff].reduce((map, user) => {
        const id = getUserId(user);
        if (id && !map.has(id)) map.set(id, user);
        return map;
      }, new Map());

      const groupedStaff = Array.from(uniqueStaff.values()).reduce((groups, user) => {
        const category = getStaffCategory(user);
        const id = getUserId(user);
        if (!groups[category]) groups[category] = [];
        groups[category].push(id);
        return groups;
      }, {});

      setStaffByCategory(groupedStaff);
    } catch (error) {
      console.warn("Unable to load staff targets:", error);
      const localStaff = JSON.parse(localStorage.getItem("staff") || "[]");
      const groupedStaff = localStaff.reduce((groups, user) => {
        const category = getStaffCategory(user);
        const id = getUserId(user);
        if (!id) return groups;
        if (!groups[category]) groups[category] = [];
        groups[category].push(id);
        return groups;
      }, {});
      setStaffByCategory(groupedStaff);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadStaffTargets);
  }, [loadStaffTargets]);

  const permissionGroups = useMemo(() => getGroupRows(staffByCategory), [staffByCategory]);
  const filteredGroups = permissionGroups.filter((group) =>
    [group.name, group.role, group.type, group.subjectId, group.description]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const handleManageGroup = (group) => {
    setSelectedGroup({
      ...group,
      label: group.name,
      permissionScope: "category",
      permissionSubjectId: group.subjectId,
      targetUserIds: group.targetUserIds || [],
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedGroup(null);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role Permissions</h1>
            <p className="text-gray-600">Manage permissions by Member and Staff role groups.</p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow md:max-w-md">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search permission groups..."
            className="w-full min-w-0 text-sm outline-none"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Permission Groups</p>
              <p className="text-2xl font-bold text-gray-900">{permissionGroups.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Staff Roles</p>
              <p className="text-2xl font-bold text-gray-900">{STAFF_ROLE_CATEGORIES.length}</p>
              {loadingStaff && <p className="mt-1 text-xs text-gray-500">Syncing staff targets...</p>}
            </div>
            <Shield className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Modules</p>
              <p className="text-2xl font-bold text-gray-900">{MODULE_PERMISSIONS.length}</p>
            </div>
            <Settings className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Permission Group
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Permission Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Enabled Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Staff Targets
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredGroups.map((group) => (
                <tr key={group.key} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{group.name}</div>
                    <div className="mt-1 text-sm text-gray-500">{group.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {group.type === "staff" ? "Staff Role" : "Member"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {group.subjectId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      {getAllowedCount(group.subjectId)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                      {group.type === "staff" ? group.targetUserIds.length : "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => handleManageGroup(group)}
                      className="rounded-md bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-900"
                    >
                      Manage Permissions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredGroups.length === 0 && (
          <div className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No permission groups found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search terms.</p>
          </div>
        )}
      </div>

      <StaffPermissionsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        staffMember={selectedGroup}
      />
    </div>
  );
}
