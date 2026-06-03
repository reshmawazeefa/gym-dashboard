import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash, Search } from "lucide-react";
import PlanModal from "../components/PlanModal";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  createMembershipPlan,
  deleteMembershipPlan,
  getMembershipPlans,
  subscribeToPlan,
  updateMembershipPlan,
  getApiError,
  getAuthToken,
  unwrapList,
  unwrapObject,
} from "../services/api";

function normalizePlan(plan = {}) {
  const features = Array.isArray(plan.features)
    ? plan.features
    : String(plan.features || "")
        .split(",")
        .map((feature) => feature.trim())
        .filter(Boolean);

  return {
    id: plan.id || plan._id || plan.planId || plan.name,
    name: plan.name || "",
    price: plan.price ?? "",
    duration: plan.duration ?? "",
    description: plan.description || "",
    planType: plan.planType || "",
    features,
    raw: plan,
  };
}

function unwrapPlan(payload) {
  if (Array.isArray(payload)) return normalizePlan(payload[0] || {});
  const objectPayload = unwrapObject(payload);
  return normalizePlan(objectPayload.plan || objectPayload.membershipPlan || objectPayload);
}

export default function Plans() {
  const { user } = useAuth();
  const loggedUserAccessToken = user?.accessToken || user?.token || getAuthToken();
  const [plans, setPlans] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [modalKey, setModalKey] = useState(0);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [subscribingPlanId, setSubscribingPlanId] = useState(null);

  const isMemberPortal = user?.loginType === "member";
  const itemsPerPage = 5;

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await getMembershipPlans(loggedUserAccessToken);
        const apiPlans = unwrapList(response).map(normalizePlan);
        setPlans(apiPlans);
      } catch (error) {
        console.warn("Unable to load membership plans:", error);
        setPlans([]);
      }
    };

    loadPlans();
  }, [loggedUserAccessToken]);

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
        const response = await updateMembershipPlan(editingPlanId, payload, loggedUserAccessToken);
        const apiPlan = unwrapPlan(response);

        updated = plans.map((p) =>
          p.id === editingPlanId ? { ...p, ...apiPlan } : p
        );
        toast.success("Plan updated");
      } catch (error) {
        toast.error(getApiError(error, "Plan update failed"));
        return;
      }
    } else {
      try {
        const response = await createMembershipPlan(payload, loggedUserAccessToken);
        const apiPlan = unwrapPlan(response);

        updated = [
          ...plans,
          apiPlan.id ? apiPlan : normalizePlan({ id: Date.now(), ...payload }),
        ];

        toast.success("Plan created");
      } catch (error) {
        toast.error(getApiError(error, "Plan creation failed"));
        return;
      }
    }

    setPlans(updated);
    setEditData(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this plan?")) return;

    try {
      await deleteMembershipPlan(id, loggedUserAccessToken);
      const updated = plans.filter((p) => p.id !== id);
      setPlans(updated);
      toast.success("Plan deleted");
    } catch (error) {
      toast.error(getApiError(error, "Plan delete failed"));
    }
  };

  const getUserId = (user) =>
    user?.id || user?._id || user?.userId || user?.memberId || "";

  const loggedUserId = getUserId(user);

  const handleSubscribe = async (planId) => {
    if (!loggedUserId) {
      toast.error("Unable to subscribe without a valid user ID");
      return;
    }

    try {
      setSubscribingPlanId(planId);
      await subscribeToPlan(loggedUserId, planId, loggedUserAccessToken);
      toast.success("Subscribed to plan successfully");
    } catch (error) {
      toast.error(getApiError(error, "Subscription failed"));
    } finally {
      setSubscribingPlanId(null);
    }
  };

  // Search
  const filtered = plans.filter((p) =>
    [p.name, p.planType, p.description, ...(p.features || [])]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
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
            setModalKey((key) => key + 1);
            setIsOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm rounded w-full md:w-auto"
        >
          <Plus size={18} /> Add Plan
        </button>
      </div>
    </div>

    {isMemberPortal ? (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {paginated.map((p) => (
          <div key={p.id || p.name} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">{p.name}</h2>
                <p className="mt-2 text-sm text-gray-600">{p.description || "Membership plan details."}</p>
              </div>
              {p.planType && (
                <span className="whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-600">
                  {p.planType}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">Price</span>
                <span>₹{p.price}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">Duration</span>
                <span>{p.duration} days</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Features</span>
                <p className="mt-1 text-gray-600">{(p.features || []).join(", ") || "No features listed."}</p>
              </div>
            </div>

            <button
              onClick={() => void handleSubscribe(p.id)}
              disabled={subscribingPlanId === p.id}
              className="mt-6 w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {subscribingPlanId === p.id ? "Subscribing..." : "Subscribe"}
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">
            No plans found
          </div>
        )}
      </div>
    ) : (
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
                <tr key={p.id || p.name} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-sm">{p.name}</td>
                  <td className="p-3 text-sm">₹{p.price}</td>
                  <td className="p-3 text-sm">{p.duration} days</td>
                  <td className="p-3 text-sm">{p.planType || "-"}</td>
                  <td className="p-3 text-sm">{(p.features || []).join(", ") || "-"}</td>
                  <td className="p-3">
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => {
                          setEditData(p);
                          setModalKey((key) => key + 1);
                          setIsOpen(true);
                        }}
                        className="text-blue-500 hover:scale-110 transition"
                      >
                        <Edit size={18} />
                      </button>

                      <button
                        onClick={() => void handleDelete(p.id)}
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
    )}

    {/* Modal */}
    <PlanModal
      key={modalKey}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSave={saveData}
      editData={editData}
    />
  </div>
);
}
