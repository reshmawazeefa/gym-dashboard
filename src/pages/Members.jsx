import { useCallback, useEffect, useState } from "react";
import { Edit, Plus, RefreshCw, Search, Trash } from "lucide-react";
import AddMemberModal from "../components/AddMemberModal";
import toast from "react-hot-toast";
import {
  getApiError,
  getTenantUser,
  getTenantUsers,
  registerGymMember,
  updateTenantUser,
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

  return {
    id: user.id || user._id || user.userId || user.email,
    name: user.name || user.fullName || "",
    email: user.email || "",
    role: user.role || "member",
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

export default function Members() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [updatingStatus, setUpdatingStatus] = useState({});

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getTenantUsers("member");
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
        const response = await updateTenantUser(editData.id, payload);
        const updatedUser = normaliseMember(unwrapObject(response));
        const nextMembers = members.map((u) => (u.id === updatedUser.id ? updatedUser : u));
        setMembers(nextMembers);
        localStorage.setItem("members", JSON.stringify(nextMembers));
        toast.success("Member updated successfully");
      } else {
        await registerGymMember({
          name: data.name,
          email: data.email,
          gymId: data.gymId,
          password: data.password,
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
        });
        toast.success("Member registered successfully");
        await loadMembers();
      }
    } catch (error) {
      toast.error(getApiError(error, editData ? "Member update failed" : "Member registration failed"));
    }
  };

  const handleView = async (user) => {
    try {
      const response = await getTenantUser(user.id);
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

  const handleStatusChange = async (member, newStatus) => {
    const id = member.id;
    try {
      setUpdatingStatus((s) => ({ ...s, [id]: true }));
      const payload = { isActive: newStatus === "Active" };
      const response = await updateTenantUser(id, payload);
      const updated = normaliseMember(unwrapObject(response));
      const nextMembers = members.map((u) => (u.id === updated.id ? updated : u));
      setMembers(nextMembers);
      localStorage.setItem("members", JSON.stringify(nextMembers));
      toast.success("Member status updated");
    } catch (error) {
      toast.error(getApiError(error, "Could not update status"));
    } finally {
      setUpdatingStatus((s) => ({ ...s, [id]: false }));
    }
  };

  const filteredMembers = members.filter((m) =>
    [m.name, m.email, m.phoneNumber, m.plan, m.status, m.role]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMembers = filteredMembers.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">Members</h1>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-1">
          <div className="min-w-0 flex-1">
            <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow sm:max-w-xxl">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-w-0 text-sm outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setEditData(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded bg-blue-500 px-4 py-2 text-sm text-white sm:w-auto"
          >
            <Plus size={18} /> Add Member
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="hidden p-3 sm:table-cell">Join Date</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMembers.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-3 text-sm">{m.name}</td>
                <td className="p-3 text-sm">{m.email}</td>
                <td className="p-3 text-sm">{m.phoneNumber || "-"}</td>
                <td className="hidden p-3 sm:table-cell text-sm">{m.joinDate}</td>
                <td className="p-3">
                  <select
                    value={m.status}
                    onChange={(e) => handleStatusChange(m, e.target.value)}
                    disabled={!!updatingStatus[m.id]}
                    className={`rounded px-2 py-1 text-sm border focus:outline-none ${
                      m.status === "Active"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex justify-center gap-3">
                    <button onClick={() => handleView(m)} className="text-blue-500">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="text-red-500">
                      <Trash size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-500">
                  {loading ? "Loading members..." : "No members found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t p-4">
          <p className="text-sm">
            Page {currentPage} of {totalPages || 1}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="rounded bg-gray-200 px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages || 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="rounded bg-gray-200 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
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
