import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash, Search } from "lucide-react";
import PlanModal from "../components/PlanModal";
import toast from "react-hot-toast";
import {
  createMembershipPlan,
  getMembershipPlans,
  updateMembershipPlan,
  getApiError,
} from "../services/api";

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 5;

  useEffect(() => {
    const loadPlans = async () => {
      const saved = JSON.parse(localStorage.getItem("plans")) || [];

      try {
        const response = await getMembershipPlans();
        const apiPlans = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
          ? response.data
          : [];

        if (apiPlans.length) {
          setPlans(apiPlans);
          localStorage.setItem("plans", JSON.stringify(apiPlans));
        } else {
          setPlans(saved);
        }
      } catch (error) {
        console.warn("Unable to load membership plans:", error);
        setPlans(saved);
      }
    };

    loadPlans();
  }, []);

  const saveData = async (data) => {
    const planName = data.name?.trim().toLowerCase();
    const editingPlanId = editData?.id || editData?._id;
    const duplicate = plans.some(
      (p) =>
        p.name?.trim().toLowerCase() === planName &&
        (!editData || (p.id || p._id) !== editingPlanId)
    );

    if (duplicate) {
      toast.error("Plan name must be unique");
      return;
    }

    let updated;

    const payload = {
      name: data.name,
      price: Number(data.price),
      duration: Number(data.duration),
      description: data.description,
      planType: data.planType,
      features: data.features,
    };

    if (editData) {
      try {
        const response = await updateMembershipPlan(editingPlanId, payload);
        const apiPlan = Array.isArray(response)
          ? response[0]
          : response?.data || response?.plan || response;

        updated = plans.map((p) =>
          (p.id || p._id) === editingPlanId ? { ...p, ...data, ...apiPlan } : p
        );
        toast.success("Plan updated");
      } catch (error) {
        toast.error(getApiError(error, "Plan update failed"));
        return;
      }
    } else {
      try {
        const response = await createMembershipPlan(payload);

        const apiPlan = Array.isArray(response)
          ? response[0]
          : response?.data || response?.plan || response;

        updated = [
          ...plans,
          {
            id: apiPlan.id || apiPlan._id || Date.now(),
            ...data,
          },
        ];

        toast.success("Plan created");
      } catch (error) {
        toast.error(getApiError(error, "Plan creation failed"));
        return;
      }
    }

    setPlans(updated);
    localStorage.setItem("plans", JSON.stringify(updated));
    setEditData(null);
  };

  const handleDelete = (id) => {
    if (!confirm("Delete this plan?")) return;

    const updated = plans.filter((p) => p.id !== id);
    setPlans(updated);
    localStorage.setItem("plans", JSON.stringify(updated));
    toast.error("Plan deleted");
  };

  // Search
  const filtered = plans.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);

return (
  <div className="p-4 md:p-6">

    {/* Header */}
    <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between mb-6">
      <h1 className="text-xl font-bold">Plans</h1>

      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow sm:max-w-xxl">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search plan..."
              className="w-full min-w-0 text-sm outline-none"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1); // reset page on search
              }}
            />
          </div>
        </div>

        <button
          onClick={() => {
            setEditData(null);
            setIsOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm rounded w-full md:w-auto"
        >
          <Plus size={18} /> Add Plan
        </button>
      </div>
    </div>

    {/* Table */}
    <div className="bg-white rounded shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm md:text-base">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left text-sm font-semibold">Name</th>
              <th className="p-3 text-left text-sm font-semibold">Price</th>
              <th className="p-3 text-left text-sm font-semibold">Duration</th>
              <th className="p-3 text-left text-sm font-semibold">Type</th>
              <th className="p-3 text-left text-sm font-semibold">Features</th>
              <th className="p-3 text-center text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-3 text-sm">{p.name}</td>
                <td className="p-3 text-sm">₹{p.price}</td>
                <td className="p-3 text-sm">{p.duration} days</td>
                <td className="p-3 text-sm">{p.planType || "-"}</td>
                <td className="p-3 text-sm">
                  {(p.features || []).join(", ") || "-"}
                </td>

                <td className="p-3">
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => {
                        setEditData(p);
                        setIsOpen(true);
                      }}
                      className="text-blue-500 hover:scale-110 transition"
                    >
                      <Edit size={18} />
                    </button>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-500 hover:scale-110 transition"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center p-6 text-gray-500">
                  No plans found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 p-4 border-t">
        <p className="text-sm text-gray-600">
          Page {currentPage} of {totalPages || 1}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Prev
          </button>

          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    {/* Modal */}
    <PlanModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSave={saveData}
      editData={editData}
    />
  </div>
);
}
