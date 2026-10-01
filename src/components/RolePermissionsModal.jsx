import { useEffect, useMemo, useState } from "react";
import { Save, Shield, X } from "lucide-react";
import toast from "react-hot-toast";
import { getApiError, getRole, getTenantPermissions, updateRole } from "../services/api";

function unwrapCatalog(response) {
  const groups = response?.data?.groups || response?.groups || response?.data || response;
  return Array.isArray(groups) ? groups : [];
}

function permissionKey(permission) {
  return permission?.permission?.key || permission?.key || permission?.permissionKey || "";
}

function normalizeCatalog(response) {
  return unwrapCatalog(response).flatMap((group) => {
    const module = group.module || group.moduleKey || group.name || "Other";
    return (Array.isArray(group.permissions) ? group.permissions : [])
      .map((permission) => ({
        key: permissionKey(permission),
        label: permission.label || permission.name || permissionKey(permission),
        module,
      }))
      .filter((permission) => permission.key);
  });
}

function unwrapRole(response) {
  return response?.data?.data || response?.data || response;
}

function existingPermissionKeys(roleResponse) {
  const role = unwrapRole(roleResponse) || {};
  return new Set((Array.isArray(role.permissions) ? role.permissions : [])
    .map((permission) => permissionKey(permission))
    .filter(Boolean));
}

export default function RolePermissionsModal({ isOpen, role, onClose, onUpdated }) {
  const [catalog, setCatalog] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !role?.id) return;

    let cancelled = false;
    const loadRolePermissions = async () => {
      setLoading(true);
      try {
        const [roleResponse, catalogResponse] = await Promise.all([
          getRole(role.id),
          getTenantPermissions(),
        ]);
        if (cancelled) return;
        setCatalog(normalizeCatalog(catalogResponse));
        setSelectedKeys(existingPermissionKeys(roleResponse));
      } catch (error) {
        if (!cancelled) toast.error(getApiError(error, "Could not load role permissions"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRolePermissions();
    return () => { cancelled = true; };
  }, [isOpen, role?.id]);

  const groupedCatalog = useMemo(() => catalog.reduce((groups, permission) => {
    if (!groups[permission.module]) groups[permission.module] = [];
    groups[permission.module].push(permission);
    return groups;
  }, {}), [catalog]);

  const toggle = (key) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const permissionKeys = [...selectedKeys];
      await updateRole(role.id, { permissionKeys });
      const refreshed = await getRole(role.id);
      const refreshedKeys = existingPermissionKeys(refreshed);
      setSelectedKeys(refreshedKeys.size ? refreshedKeys : new Set(permissionKeys));
      onUpdated?.(unwrapRole(refreshed));
      toast.success("Role permissions updated");
    } catch (error) {
      toast.error(getApiError(error, "Could not update role permissions"));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[14px] border border-[#D8DEE8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
        <div className="flex items-start justify-between border-b border-[#E6EAF0] px-4 py-3">
          <div className="flex items-start gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAFBF3] text-[#0D8252]"><Shield size={15} /></div><div><h2 className="text-base font-bold text-[#0F172A]">Edit Permissions</h2><p className="mt-0.5 text-xs text-[#64748B]">{role?.name || "Role"}</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close role permissions modal" className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-[#F1F5F9]"><X size={13} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {loading ? <div className="py-12 text-center text-xs text-[#64748B]">Loading permissions...</div> : Object.entries(groupedCatalog).map(([module, permissions]) => (
            <section key={module} className="mb-4">
              <h3 className="border-b border-[#E6EAF0] pb-2 text-xs font-bold text-[#334155]">{module}</h3>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {permissions.map((permission) => <label key={permission.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${selectedKeys.has(permission.key) ? "border-emerald-200 bg-emerald-50" : "border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white"}`}><input type="checkbox" checked={selectedKeys.has(permission.key)} onChange={() => toggle(permission.key)} className="h-3.5 w-3.5 accent-[#0D8252]" /><span className="min-w-0"><span className="block truncate font-semibold text-[#334155]">{permission.label}</span><span className="block truncate text-[10px] text-[#94A3B8]">{permission.key}</span></span></label>)}
              </div>
            </section>
          ))}
          {!loading && !catalog.length && <p className="py-10 text-center text-xs text-[#64748B]">No permissions available.</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#E6EAF0] bg-[#FBFCFD] px-4 py-3"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569]">Cancel</button><button type="button" onClick={save} disabled={saving || loading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : <><Save size={12} />Update</>}</button></div>
      </div>
    </div>
  );
}
