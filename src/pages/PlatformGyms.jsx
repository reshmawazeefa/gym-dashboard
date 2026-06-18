import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Building2, Plus, RefreshCw, Search, X, Edit3, Trash2 } from "lucide-react";
import {
  createGym,
  getApiError,
  getPlatformGyms,
  updateGym,
  unwrapList,
  unwrapObject,
} from "../services/api";

const initialForm = {
  gymName: "",
  ownerName: "",
  email: "",
  password: "",
};

function normaliseGym(gym) {
  const owner = Array.isArray(gym.users) ? gym.users[0] : gym.users;

  return {
    id: gym.id || gym._id || gym.gymId || gym.email,
    gymName: gym.name || gym.gymName || gym.gym?.name || "-",
    ownerName:
      gym.ownerName || owner?.name || gym.owner?.name || gym.owner || "-",
    email:
      gym.email || gym.ownerEmail || gym.owner?.email || owner?.email || "-",
    status: gym.status || (gym.isActive === false ? "Inactive" : "Active"),
    createdAt: gym.createdAt?.slice?.(0, 10) || gym.created_at?.slice?.(0, 10) || "-",
  };
}

function AddGymModal({ isOpen, onClose, onCreate, onUpdate, editData, creating }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setForm({
          ...initialForm,
          ...editData,
          password: "",
        });
      } else {
        setForm(initialForm);
      }
    }
  }, [isOpen, editData]);

  if (!isOpen) return null;

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!form.gymName) {
      toast.error("Please enter gym name");
      return;
    }

    if (!editData && (!form.ownerName || !form.email || !form.password)) {
      toast.error("Please fill all fields");
      return;
    }

    if (editData) {
      onUpdate({ ...form, id: editData.id });
    } else {
      onCreate(form);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-950">
            {editData ? "Edit Gym" : "Add Gym"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <input
          className="mb-3 w-full rounded border p-3"
          placeholder="Gym name"
          value={form.gymName}
          onChange={(e) => updateField("gymName", e.target.value)}
        />
        {!editData && (
          <>
            <input
              className="mb-3 w-full rounded border p-3"
              placeholder="Owner name"
              value={form.ownerName}
              onChange={(e) => updateField("ownerName", e.target.value)}
            />
            <input
              type="email"
              className="mb-3 w-full rounded border p-3"
              placeholder="Owner email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
            <input
              type="password"
              className="mb-5 w-full rounded border p-3"
              placeholder="Password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
            />
          </>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={creating}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {editData ? "Save Changes" : creating ? "Creating..." : "Create Gym"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformGyms() {
  const [gyms, setGyms] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGym, setEditingGym] = useState(null);

  const loadGyms = async () => {
    try {
      setLoading(true);
      const response = await getPlatformGyms();
      const nextGyms = unwrapList(response).map(normaliseGym);
      setGyms(nextGyms);
      localStorage.setItem("platformGyms", JSON.stringify(nextGyms));
    } catch (error) {
      const saved = JSON.parse(localStorage.getItem("platformGyms")) || [];
      setGyms(saved);
      toast.error(getApiError(error, "Could not load gyms"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGyms();
  }, []);

  const handleCreateGym = async (payload) => {
    try {
      setCreating(true);
      const response = await createGym(payload);
      const createdGym = normaliseGym(unwrapObject(response));
      const nextGyms = createdGym.id ? [createdGym, ...gyms] : gyms;
      setGyms(nextGyms);
      localStorage.setItem("platformGyms", JSON.stringify(nextGyms));
      toast.success("Gym created");
      setModalOpen(false);
      await loadGyms();
    } catch (error) {
      toast.error(getApiError(error, "Gym creation failed"));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateGym = async (payload) => {
    try {
      setCreating(true);
      console.log("Updating gym with ID:", payload.id);
      console.log("Payload:", { name: payload.gymName });
      
      const response = await updateGym(payload.id, { name: payload.gymName });
      console.log("Update response:", response);
      
      const updated = gyms.map((gym) => (gym.id === payload.id ? { ...gym, ...payload } : gym));
      setGyms(updated);
      localStorage.setItem("platformGyms", JSON.stringify(updated));
      toast.success("Gym updated");
      setModalOpen(false);
      setEditingGym(null);
    } catch (error) {
      console.error("Update error:", error);
      console.error("Error response:", error.response?.data);
      toast.error(getApiError(error, "Gym update failed"));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGym = (id) => {
    if (!window.confirm("Delete this gym from the list?")) return;
    const updated = gyms.filter((gym) => gym.id !== id);
    setGyms(updated);
    localStorage.setItem("platformGyms", JSON.stringify(updated));
    toast.success("Gym removed");
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingGym(null);
  };

  const filteredGyms = gyms.filter((gym) =>
    [gym.gymName, gym.ownerName, gym.email, gym.status]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="text-blue-600" />
          <h1 className="text-xl font-bold">Gyms</h1>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-1">
          <div className="min-w-0 flex-1">
            <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow sm:max-w-xxl">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gyms..."
                className="w-full min-w-0 text-sm outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingGym(null);
              setModalOpen(true);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm text-white sm:flex-none"
          >
            <Plus size={18} /> Add Gym
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Gym Name</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
              <th className="hidden p-3 sm:table-cell">Created</th>
              <th className="p-3 text-center text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredGyms.map((gym) => (
              <tr key={gym.id} className="border-t">
                <td className="p-3 font-medium text-gray-950 text-sm">{gym.gymName}</td>
                <td className="p-3 text-sm">{gym.ownerName}</td>
                <td className="p-3 text-sm">{gym.email}</td>
                <td className="p-3">
                  <span
                    className={`rounded px-2 py-1 text-sm ${
                      gym.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {gym.status}
                  </span>
                </td>
                <td className="hidden p-3 sm:table-cell">{gym.createdAt}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGym(gym);
                        setModalOpen(true);
                      }}
                      className="text-blue-500 hover:scale-110 transition"
                      aria-label="Edit gym"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-square-pen"
                        aria-hidden="true"
                      >
                        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGym(gym.id)}
                      className="text-red-500 hover:scale-110 transition"
                      aria-label="Delete gym"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-trash"
                        aria-hidden="true"
                      >
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                        <path d="M3 6h18"></path>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredGyms.length === 0 && (
              <tr>
                <td colSpan="6" className="p-6 text-center text-gray-500">
                  {loading ? "Loading gyms..." : "No gyms found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddGymModal
        isOpen={modalOpen}
        onClose={closeModal}
        onCreate={handleCreateGym}
        onUpdate={handleUpdateGym}
        editData={editingGym}
        creating={creating}
      />
    </div>
  );
}
