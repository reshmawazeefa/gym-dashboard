import { createElement, useCallback, useEffect, useState } from "react";
import { Activity, CalendarDays, Download, Edit, Plus, Search, Trash, Users } from "lucide-react";
import AddMemberModal from "../components/AddMemberModal";
import TablePagination from "../components/TablePagination";
import StatusBadge from "../components/StatusBadge";
import toast from "react-hot-toast";
import {
  createTenantUser,
  getApiError,
  getTenantMember,
  getTenantMembers,
  updateTenantMember,
  updateTenantUserStatus,
  deleteUser,
  unwrapList,
  unwrapObject,
} from "../services/api";

const formatDateValue = (value) => {
  if (!value) return "";

  const stringValue = String(value).trim();
  const isoDate = stringValue.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;

  const parsedDate = new Date(stringValue);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateTimeValue = (value) => {
  const dateValue = formatDateValue(value);
  return dateValue ? `${dateValue}T00:00:00.000Z` : "";
};

function normaliseMember(user) {
  const planInfo = user.plan || {};
  const roleName = user.role || user.roles?.[0]?.role?.name || "member";

  return {
    id: user.id || user._id || user.userId || user.email,
    name: user.name || user.fullName || "",
    email: user.email || "",
    role: roleName,
    plan: user.planName || user.plan || (typeof planInfo === "string" ? planInfo : ""),
    planId:
      user.planId || user.plan?.id || user.planId ||
      (typeof planInfo === "object" ? planInfo.id : ""),
    planName:
      user.planName || user.plan ||
      (typeof planInfo === "object" ? planInfo.name : ""),
    duration:
      user.duration ||
      user.plan?.duration ||
      (typeof planInfo === "object" ? planInfo.duration : "") ||
      "",
    joinDate: formatDateValue(user.joinDate || user.createdAt?.slice?.(0, 10) || ""),
    expiryDate: formatDateValue(user.expiryDate || ""),
    phoneNumber: user.phoneNumber || "",
    addressLine1: user.addressLine1 || "",
    addressLine2: user.addressLine2 || "",
    city: user.city || "",
    state: user.state || "",
    country: user.country || "",
    postalCode: user.postalCode || "",
    gender: user.gender || "",
    dateOfBirth: formatDateValue(user.dateOfBirth || ""),
    profileImage: user.profileImage || "",
    status: user.status || (user.isActive === false ? "Inactive" : "Active"),
    raw: user,
  };
}
function isMemberActive(member) {
  return String(member?.status || "").trim().toUpperCase() !== "INACTIVE";
}

export default function Members() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [planFilter, setPlanFilter] = useState("All");
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [updatingStatus, setUpdatingStatus] = useState({});

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getTenantMembers();
      const nextMembers = unwrapList(response).map(normaliseMember);
      setMembers(nextMembers);
      localStorage.setItem("members", JSON.stringify(nextMembers));
    } catch {
      const stored = JSON.parse(localStorage.getItem("members")) || [];
      setMembers(stored);
      // toast.error(getApiError(error, "Could not load members"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMembers();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadMembers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearchTerm(searchTerm.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSave = async (data) => {
    try {
      if (editData) {
        const payload = {
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
          gender: data.gender,
          dateOfBirth: formatDateTimeValue(data.dateOfBirth),
        };
        const response = await updateTenantMember(editData.id, payload);
        const updatedUser = normaliseMember(unwrapObject(response));
        const nextMembers = members.map((u) => (u.id === updatedUser.id ? updatedUser : u));
        setMembers(nextMembers);
        localStorage.setItem("members", JSON.stringify(nextMembers));
        toast.success("Member updated successfully");
      } else {
        const createResponse = await createTenantUser({
          name: data.name,
          email: data.email,
          password: data.password,
          roleId: "member",
        });
        const createdUser = unwrapObject(createResponse);
        const createdUserId = createdUser.id || createdUser._id || createdUser.userId;
        const detailPayload = {
          phoneNumber: data.phoneNumber,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
          gender: data.gender,
          dateOfBirth: formatDateTimeValue(data.dateOfBirth),
          profileImage: data.profileImage,
        };

        if (createdUserId && Object.values(detailPayload).some(Boolean)) {
          await updateTenantMember(createdUserId, detailPayload);
        }

        toast.success("Member registered successfully");
        await loadMembers();
      }
    } catch (error) {
      toast.error(getApiError(error, editData ? "Member update failed" : "Member registration failed"));
    }
  };

  const handleView = async (user) => {
    try {
      const response = await getTenantMember(user.id);
      setEditData(normaliseMember(unwrapObject(response)));
      setIsModalOpen(true);
    } catch (error) {
      toast.error(getApiError(error, "Could not load member detail"));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this member?")) return;
    try {
      await deleteUser(id);
      const updated = members.filter((m) => m.id !== id);
      setMembers(updated);
      localStorage.setItem("members", JSON.stringify(updated));
      toast.success("Member deleted successfully");
    } catch (error) {
      toast.error(getApiError(error, "Could not delete member"));
    }
  };

  const handleStatusChange = async (member, nextIsActive) => {
    const id = member.id;
    if (updatingStatus[id]) return;
    try {
      setUpdatingStatus((s) => ({ ...s, [id]: true }));
      await updateTenantUserStatus(id, { isActive: nextIsActive });
      await loadMembers();
      toast.success("Member status updated");
    } catch (error) {
      toast.error(getApiError(error, "Could not update status"));
    } finally {
      setUpdatingStatus((s) => ({ ...s, [id]: false }));
    }
  };

  const filteredMembers = members.filter((m) => {
    const searchableFields = [
      m.name,
      m.email,
      m.phoneNumber,
      m.plan,
      m.planName,
      m.status,
      m.role,
      m.addressLine1,
      m.addressLine2,
      m.city,
      m.state,
      m.country,
      m.postalCode,
    ];
    const matchesSearch = !appliedSearchTerm || searchableFields.filter(Boolean).join(" ").toLowerCase().includes(appliedSearchTerm);
    const matchesStatus = statusFilter === "All" || m.status === statusFilter;
    const matchesPlan = planFilter === "All" || String(m.planId || m.planName || m.plan) === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const planOptions = [...new Map(
    members
      .filter((member) => member.planId || member.planName || member.plan)
      .map((member) => [String(member.planId || member.planName || member.plan), member.planName || member.plan || ""])
  ).entries()];

  const handleExportCSV = () => {
    if (exporting) return;
    setExporting(true);

    try {
      const headers = ["Name", "Email", "Phone", "Join Date", "Trainer", "Plan", "Status"];
      const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows = filteredMembers.map((member) => [
        member.name,
        member.email,
        member.phoneNumber,
        member.joinDate,
        member.raw?.trainer?.name || "",
        member.planName || member.plan || "",
        member.status,
      ]);
      const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "members.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} member${rows.length === 1 ? "" : "s"} exported`);
    } catch (error) {
      toast.error(getApiError(error, "Could not export members"));
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMembers = filteredMembers.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const activeMembers = members.filter((member) => member.status === "Active");
  const attendanceRecords = JSON.parse(localStorage.getItem("attendanceRecords") || "[]");
  const today = new Date().toISOString().split("T")[0];
  const todayCheckIns = attendanceRecords.filter((record) => record.date === today && ["Present", "Late"].includes(record.status)).length;
  const totalPagesLabel = totalPages || 1;

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
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Members Management</h1>
            <p className="mt-0.5 text-xs text-[#64748B]">Manage member roster, subscription validity, check-in profiles, and NFC turnstile credentials.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExportCSV} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-sm transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"><Download size={13} /> {exporting ? "Exporting..." : "Export CSV"}</button>
            <button type="button" onClick={() => { setEditData(null); setIsModalOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43]"><Plus size={14} /> Add Member</button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MemberStatCard label="Total Members" value={members.length} detail="+100%" caption="All verified active profiles" icon={Users} />
          <MemberStatCard label="Active Floor Sessions" value={activeMembers.length} detail="Currently Working Out" caption="Turnstile verified present" icon={Activity} />
          <MemberStatCard label="Today's Check-ins" value={todayCheckIns} detail="members today" caption="RFID & QR Gates operational" icon={CalendarDays} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#EEF2F4] p-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <Search size={14} className="shrink-0 text-[#94A3B8]" />
              <input type="text" placeholder="Search members by name, email, or phone..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full min-w-0 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
              <span>Status:</span>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"><option value="All">All</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
              {/* <span>Plan:</span>
              <select value={planFilter} onChange={(event) => { setPlanFilter(event.target.value); setCurrentPage(1); }} className="max-w-40 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#475569] outline-none"><option value="All">All Packages</option>{planOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> */}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Join Date</th>
                  <th className="px-4 py-3">Trainer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMembers.map((m) => (
                  <tr key={m.id} className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                    <td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[11px] font-bold text-[#0D8252]">{(m.name || "M").charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-bold text-[#0F172A]">{m.name || "Unnamed member"}</p><p className="text-[10px] text-[#94A3B8]">ID: #{String(m.id).slice(-6)}</p></div></div></td>
                    <td className="px-4 py-3">{m.email || "-"}</td>
                    <td className="px-4 py-3">{m.phoneNumber || "-"}</td>
                    <td className="px-4 py-3">{m.joinDate || "-"}</td>
                    <td className="px-4 py-3">{m.raw?.trainer?.name || "-"}</td>
                    <td className="px-4 py-3"><StatusBadge status={isMemberActive(m) ? "ACTIVE" : "INACTIVE"} label={isMemberActive(m) ? "Active" : "Inactive"} onClick={() => void handleStatusChange(m, !isMemberActive(m))} disabled={!!updatingStatus[m.id]} ariaLabel={`${isMemberActive(m) ? "Deactivate" : "Activate"} ${m.name || "member"}`} /></td>
                    <td className="px-4 py-3"><div className="flex justify-center gap-3"><button type="button" onClick={() => handleView(m)} className="rounded-lg text-[#0D8252] transition hover:text-[#065F46]" aria-label={`Edit ${m.name}`}><Edit size={15} /></button><button type="button" onClick={() => handleDelete(m.id)} className="rounded-lg text-rose-500 transition hover:text-rose-700" aria-label={`Delete ${m.name}`}><Trash size={14} /></button></div></td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-xs text-[#64748B]">{loading ? "Loading members..." : "No members found"}</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
            <p>Page {currentPage} of {totalPagesLabel} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {paginatedMembers.length} records</p>
            <TablePagination page={currentPage} totalPages={totalPagesLabel} onPageChange={setCurrentPage} previousLabel="Prev" />
          </div>
        </section>
      </div>

      {isModalOpen && (
        <AddMemberModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditData(null);
          }}
          onSave={handleSave}
          editData={editData}
        />
      )}
    </div>
  );
}

function MemberStatCard({ label, value, detail, caption, icon }) {
  return (
    <div className="flex min-h-[108px] items-center justify-between rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_3px_0_rgba(16,24,40,0.05)]">
      <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</p><div className="mt-1 flex items-center gap-2"><span className="text-2xl font-extrabold tracking-tight text-[#0F172A]">{value}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-[#0D8252]">{detail}</span></div><p className="mt-1 text-[10px] text-[#94A3B8]">{caption}</p></div>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#0D8252]">{createElement(icon, { size: 17 })}</span>
    </div>
  );
}
