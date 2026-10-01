import React, { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Settings, Shield, Users, X } from "lucide-react";
import StaffPermissionsModal from "../components/StaffPermissionsModal";
import RolePermissionsModal from "../components/RolePermissionsModal";
import { getRoles, getTenantMembers, getTenantPermissions, getTenantUsers, unwrapList } from "../services/api";
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

function getGroupRows(staffByCategory, roles = []) {
  const roleRows = roles.length
    ? roles.map((role) => ({
        key: `role-${role.id || role._id || role.name}`,
        id: role.id || role._id || role.roleId,
        name: role.name || role.label || "Unnamed role",
        role: role.name || role.label || "Custom",
        type: "role",
        subjectId: `role:${role.id || role._id || role.roleId}`,
        targetUserIds: staffByCategory[String(role.name || "").toLowerCase()] || [],
        description: `Permissions assigned to the ${role.name || "custom"} role.`,
      }))
    : STAFF_ROLE_CATEGORIES.map((category) => ({
        key: `staff-${category.key}`,
        name: `Staff: ${category.label}`,
        role: category.label,
        type: "staff",
        subjectId: `category:staff:${category.key}`,
        targetUserIds: staffByCategory[category.key] || [],
        description: `Default module permissions for staff with the ${category.label} role.`,
      }));

  return [
    ...MEMBER_CATEGORIES.map((category) => ({
      key: `member-${category.key}`,
      name: category.label,
      role: "Member",
      type: "member",
      subjectId: `category:member:${category.key}`,
      description: "Default module permissions for all member accounts.",
    })),
    ...roleRows,
  ];
}

function getAllowedCount(subjectId) {
  const storedPermissions = readStoredPermissions(subjectId);
  return (storedPermissions || DEFAULT_CATEGORY_PERMISSIONS[subjectId] || []).length;
}

function getIndividualRole(user) {
  const role = user?.roles?.[0]?.role?.name || user?.role || user?.roleName || "member";
  return String(role).toLowerCase().includes("reception") ? "receptionist" : String(role).toLowerCase();
}

function formatRoleLabel(role) {
  return String(role || "member")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Permissions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffByCategory, setStaffByCategory] = useState({});
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);
  const [individuals, setIndividuals] = useState([]);
  const [individualSearch, setIndividualSearch] = useState("");
  const [selectedIndividualIds, setSelectedIndividualIds] = useState([]);
  const [loadingIndividuals, setLoadingIndividuals] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissionCatalog, setPermissionCatalog] = useState([]);

  const loadStaffTargets = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const responses = await Promise.allSettled([
        getTenantUsers("staff"),
        getTenantUsers("admin"),
        getTenantUsers("trainer"),
        getTenantUsers("receptionist"),
        getRoles(),
        getTenantPermissions(),
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
      const roleResponse = responses[4];
      const roleData = roleResponse?.status === "fulfilled" ? roleResponse.value : [];
      const roleList = roleData?.data?.roles || roleData?.roles || unwrapList(roleData);
      setRoles(Array.isArray(roleList) ? roleList : []);
      const catalogResponse = responses[5];
      const catalogData = catalogResponse?.status === "fulfilled" ? catalogResponse.value : {};
      const groups = catalogData?.data?.groups || catalogData?.groups || catalogData?.data || [];
      setPermissionCatalog(Array.isArray(groups) ? groups : []);
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

  const permissionGroups = useMemo(() => getGroupRows(staffByCategory, roles), [staffByCategory, roles]);
  const filteredGroups = permissionGroups.filter((group) =>
    (categoryFilter === "All" || group.role.toLowerCase() === categoryFilter.toLowerCase()) &&
    [group.name, group.role, group.type, group.subjectId, group.description]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const loadIndividuals = async () => {
    setLoadingIndividuals(true);
    try {
      const responses = await Promise.allSettled([
        getTenantMembers(),
        getTenantUsers("admin"),
        getTenantUsers("trainer"),
        getTenantUsers("receptionist"),
      ]);
      const loaded = responses.flatMap((response) => response.status === "fulfilled" ? unwrapList(response.value) : []);
      const storedStaff = JSON.parse(localStorage.getItem("staff") || "[]");
      const unique = [...loaded, ...storedStaff].reduce((map, person) => {
        const id = getUserId(person);
        if (id && !map.has(id)) map.set(id, person);
        return map;
      }, new Map());
      setIndividuals([...unique.values()].map((person) => ({
        ...person,
        id: getUserId(person),
        role: getIndividualRole(person),
      })));
    } finally {
      setLoadingIndividuals(false);
    }
  };

  const openIndividualModal = () => {
    setIndividualSearch("");
    setSelectedIndividualIds([]);
    setIsIndividualModalOpen(true);
    void loadIndividuals();
  };

  const closeIndividualModal = () => {
    setIsIndividualModalOpen(false);
    setIndividualSearch("");
    setSelectedIndividualIds([]);
  };

  const openSelectedPermissions = () => {
    if (!selectedIndividualIds.length) return;
    const selected = individuals.filter((person) => selectedIndividualIds.includes(person.id));
    setSelectedGroup({
      ...selected[0],
      label: selected.length === 1 ? selected[0].name : `${selected.length} Selected Individuals`,
      permissionScope: "category",
      permissionSubjectId: `individuals:${selectedIndividualIds.sort().join(",")}`,
      targetUserIds: selectedIndividualIds,
    });
    closeIndividualModal();
    setIsModalOpen(true);
  };

  const handleManageGroup = (group) => {
    if (group.type === "role" && group.id) {
      setSelectedRole(roles.find((role) => (role.id || role._id || role.roleId) === group.id) || group);
      setIsRoleModalOpen(true);
      return;
    }
    setSelectedGroup({
      ...group,
      label: group.name,
      permissionScope: "category",
      permissionSubjectId: group.subjectId,
      targetUserIds: group.targetUserIds || [],
    });
    setIsModalOpen(true);
  };

  const handleRoleUpdated = (updatedRole) => {
    if (!updatedRole?.id && !updatedRole?._id) return;
    setRoles((current) => current.map((role) => {
      const roleId = role.id || role._id || role.roleId;
      const updatedId = updatedRole.id || updatedRole._id || updatedRole.roleId;
      return roleId === updatedId ? { ...role, ...updatedRole } : role;
    }));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedGroup(null);
  };

  return (
    <div className="min-h-full bg-[#F8F9FB] p-4 text-[#1E293B] sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0D8252]">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-[#0D8252]" /> Live Facility Directory</span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="text-[#94A3B8]">Branch #01</span>
            </div> */}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Permissions</h1>
              {/* <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">{permissionGroups.length} Groups Configured</span> */}
            </div>
            <p className="mt-0.5 text-xs text-[#64748B]">Configure granular module access, staff categories, and member authorization levels.</p>
          </div>
          <button type="button" onClick={openIndividualModal} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">
            <Plus size={14} />
            Create Individual Permission
          </button>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PermissionStatCard label="Permission Groups" value={permissionGroups.length} detail="Groups" icon={Users} theme="blue" />
          <PermissionStatCard label="Staff Roles" value={roles.length || STAFF_ROLE_CATEGORIES.length} detail={loadingStaff ? "Syncing" : "Roles"} icon={Shield} theme="red" />
          <PermissionStatCard label="Modules" value={permissionCatalog.length || MODULE_PERMISSIONS.length} detail="Available" icon={Settings} theme="green" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 lg:max-w-sm">
              <Search size={14} className="shrink-0 text-[#94A3B8]" />
              <input type="text" placeholder="Search permission groups..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full min-w-0 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]" />
            </div>
            <div className="flex items-center gap-2">
  <label className="text-xs font-semibold text-[#475569]">
    Category:
  </label>

  <select
    value={categoryFilter}
    onChange={(event) => setCategoryFilter(event.target.value)}
    className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] outline-none"
  >
    <option value="All">All</option>
    <option value="Member">Member</option>
    <option value="Admin">Admin</option>
    <option value="Trainer">Trainer</option>
    <option value="Receptionist">Receptionist</option>
  </select>
</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Permission Group</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Permission Key</th>
                  <th className="px-4 py-3 text-center">Enabled Permissions</th>
                  <th className="px-4 py-3 text-center">Staff Targets</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((group) => (
                  <tr key={group.key} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                    <td className="px-4 py-3"><p className="font-bold text-[#0F172A]">{group.name}</p><p className="mt-1 max-w-[170px] text-[10px] leading-relaxed text-[#94A3B8]">{group.description}</p></td>
                    <td className="px-4 py-3"><span className="inline-flex rounded-md bg-[#F1F5F9] px-2 py-1 text-[10px] font-bold text-[#475569]">{group.role}</span></td>
                    <td className="px-4 py-3"><span className="rounded-md bg-[#F8FAFC] px-2 py-1 text-[10px] text-[#64748B]">{group.subjectId}</span></td>
                    <td className="px-4 py-3 text-center"><span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">{getAllowedCount(group.subjectId)}</span></td>
                    <td className="px-4 py-3 text-center"><span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">{group.type === "staff" ? group.targetUserIds.length : "-"}</span></td>
                    <td className="px-4 py-3 text-center">
                      {/* <button type="button" onClick={() => handleManageGroup(group)} className="text-[10px] font-semibold text-blue-600 transition hover:text-blue-800">↗ Manage Permissions</button> */}

                    <button type="button" class="text-[#0D8252] transition hover:text-[#065F46]" onClick={() => handleManageGroup(group)}  className="rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg></button>
                    
                    </td>
                  </tr>
                ))}
                {filteredGroups.length === 0 && <tr><td colSpan="6" className="px-4 py-10 text-center text-xs text-[#64748B]"><Users className="mx-auto mb-2 h-8 w-8 text-[#CBD5E1]" />No permission groups found</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
            <p>Showing 1 to {filteredGroups.length} of {permissionGroups.length} permission groups</p>
            <div className="flex items-center gap-1.5"><button type="button" disabled className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Previous</button><span className="rounded-lg bg-[#0D8252] px-3 py-1.5 font-bold text-white">1</span><button type="button" disabled className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Next</button></div>
          </div>
        </section>
      </div>

      {isIndividualModalOpen && (
        <IndividualPermissionModal
          individuals={individuals}
          searchTerm={individualSearch}
          selectedIds={selectedIndividualIds}
          loading={loadingIndividuals}
          onSearch={setIndividualSearch}
          onToggle={(id) => setSelectedIndividualIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}
          onReset={() => {
            setIndividualSearch("");
            setSelectedIndividualIds([]);
          }}
          onClose={closeIndividualModal}
          onContinue={openSelectedPermissions}
        />
      )}

      <StaffPermissionsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        staffMember={selectedGroup}
      />
      <RolePermissionsModal
        isOpen={isRoleModalOpen}
        role={selectedRole}
        onClose={() => {
          setIsRoleModalOpen(false);
          setSelectedRole(null);
        }}
        onUpdated={handleRoleUpdated}
      />
    </div>
  );
}

function IndividualPermissionModal({ individuals, searchTerm, selectedIds, loading, onSearch, onToggle, onReset, onClose, onContinue }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(null);
  const bodyRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRegionRef = useRef(null);
  const selectedIndividuals = individuals.filter((person) => selectedIds.includes(person.id));
  const visibleIndividuals = individuals.filter((person) =>
    [person.name, person.fullName, person.email, person.role, formatRoleLabel(person.role)]
      .filter(Boolean).join(" ").toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  useLayoutEffect(() => {
    if (!isDropdownOpen || !dropdownRef.current || !bodyRef.current) {
      setBodyHeight(null);
      return undefined;
    }

    const updateBodyHeight = () => {
      const searchRegionHeight = searchRegionRef.current?.scrollHeight || 0;
      const bodyStyles = bodyRef.current ? getComputedStyle(bodyRef.current) : null;
      const verticalPadding = bodyStyles
        ? parseFloat(bodyStyles.paddingTop) + parseFloat(bodyStyles.paddingBottom)
        : 0;
      const contentHeight = searchRegionHeight + verticalPadding;
      if (contentHeight) setBodyHeight(Math.ceil(contentHeight * 1.03));
    };

    updateBodyHeight();
    const observer = new ResizeObserver(updateBodyHeight);
    observer.observe(dropdownRef.current);
    observer.observe(bodyRef.current);
    window.addEventListener("resize", updateBodyHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBodyHeight);
    };
  }, [isDropdownOpen, loading, visibleIndividuals.length, selectedIndividuals.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[14px] border border-[#D8DEE8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
        <div className="flex items-start justify-between border-b border-[#E6EAF0] px-4 py-3">
          <div className="flex items-start gap-2.5"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Users size={15} /></div><div>
            <h2 className="text-base font-bold text-[#0F172A]">Create Individual Permission</h2>
            <p className="mt-0.5 text-xs text-[#64748B]">Select individuals to configure their permissions.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close individual permissions modal" className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"><X size={13} /></button>
        </div>
        <div ref={bodyRef} className="flex-none overflow-visible px-4 py-3 transition-[height] duration-200 ease-out" style={bodyHeight ? { height: `${bodyHeight}px` } : undefined}>
          <div ref={searchRegionRef} className="relative" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsDropdownOpen(false);
          }}>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#334155]">Select Individuals</span>
              <div className="flex items-center gap-2">
                <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-[#F8FAFC] px-3 py-2 transition ${isDropdownOpen ? "border-[#0D8252] bg-white" : "border-[#E2E8F0]"}`}>
                <Search size={14} className="shrink-0 text-[#94A3B8]" />
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    onSearch(event.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onClick={() => setIsDropdownOpen(true)}
                  placeholder="Search individuals"
                  className="w-full bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                />
                </div>
                <button type="button" onClick={onReset} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-white">Reset</button>
              </div>
            </label>

            {selectedIndividuals.length > 0 && (
              <p className="mt-1.5 text-[10px] text-[#0D8252]">
                Selected: {selectedIndividuals.map((person) => person.name || person.fullName || "Unnamed individual").join(", ")}
              </p>
            )}

            {isDropdownOpen && (
              <div ref={dropdownRef} className="mt-1 max-h-70 overflow-y-auto overflow-x-hidden rounded-xl border border-[#D8DEE8] bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.14)]" onMouseDown={(event) => event.preventDefault()}>
                {loading ? (
                  <div className="px-3 py-6 text-center text-xs text-[#64748B]">Loading individuals...</div>
                ) : visibleIndividuals.length ? (
                  <div className="space-y-1">
                    {visibleIndividuals.map((person) => (
                      <label key={person.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${selectedIds.includes(person.id) ? "border-emerald-200 bg-emerald-50" : "border-transparent hover:border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}>
                        <input type="checkbox" checked={selectedIds.includes(person.id)} onChange={() => onToggle(person.id)} className="h-3.5 w-3.5 accent-[#0D8252]" />
                        <span className="flex-1">
                          <span className="block text-xs font-semibold text-[#334155]">{person.name || person.fullName || "Unnamed individual"}</span>
                          <span className="mt-0.5 block text-[10px] text-[#94A3B8]">{formatRoleLabel(person.role)}{person.email ? ` · ${person.email}` : ""}</span>
                        </span>
                        {selectedIds.includes(person.id) && <span className="text-[10px] font-bold text-[#0D8252]">Selected</span>}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-[#64748B]">No individuals found</p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#E6EAF0] bg-[#FBFCFD] px-4 py-3"><button type="button" onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC]">Cancel</button><button type="button" onClick={onContinue} disabled={!selectedIds.length} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]">Continue</button></div>
      </div>
    </div>
  );
}

function PermissionStatCard({ label, value, detail, icon: Icon, theme }) {
  const themeClasses = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-rose-50 text-rose-500",
    green: "bg-emerald-50 text-[#0D8252]",
  };

  return (
    <div className="flex min-h-[108px] items-center justify-between rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
      <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</p><div className="mt-1 flex items-center gap-2"><span className="text-2xl font-extrabold tracking-tight text-[#0F172A]">{value}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">{detail}</span></div></div>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${themeClasses[theme]}`}>{createElement(Icon, { size: 17 })}</span>
    </div>
  );
}
