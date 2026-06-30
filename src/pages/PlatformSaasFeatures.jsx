import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Search, Edit3, Trash2, X } from "lucide-react";
import {
  createSaasFeature,
  bulkCreateSaasFeatures,
  getSaasFeatures,
  updateSaasFeature,
  deleteSaasFeature,
  getApiError,
  unwrapList,
} from "../services/api";

export default function PlatformSaasFeatures() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editFeature, setEditFeature] = useState(null);
  const [formName, setFormName] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkNames, setBulkNames] = useState([""]);

  const loadFeatures = async (p = 1) => {
    try {
      setLoading(true);
      const params = { page: p, limit: 10 };
      if (search.trim()) params.search = search.trim();
      const response = await getSaasFeatures(params);
      const data = response?.data || response;
      const list = Array.isArray(data) ? data : unwrapList(data);
      setFeatures(list);
      const meta = response?.meta || data?.meta || {};
      setTotalPages(meta.totalPages || 1);
    } catch (error) {
      toast.error(getApiError(error, "Failed to load features"));
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeatures(page);
  }, [page, search]);

  const handleSave = async () => {
    const name = formName.trim();
    if (!name || name.length < 2) {
      toast.error("Feature name must be at least 2 characters");
      return;
    }

    try {
      if (editFeature) {
        await updateSaasFeature(editFeature.id, { name });
        toast.success("Feature updated");
      } else {
        await createSaasFeature({ name });
        toast.success("Feature created");
      }
      setShowModal(false);
      setEditFeature(null);
      setFormName("");
      loadFeatures(1);
    } catch (error) {
      toast.error(getApiError(error, editFeature ? "Update failed" : "Creation failed"));
    }
  };

  const handleBulkCreate = async () => {
    const names = bulkNames
      .map((n) => n.trim())
      .filter((n) => n.length >= 2);

    if (names.length === 0) {
      toast.error("Enter at least one valid feature name");
      return;
    }

    try {
      const response = await bulkCreateSaasFeatures(names);
      toast.success(response?.message || "Features created");
      setShowBulkModal(false);
      setBulkNames([""]);
      loadFeatures(1);
    } catch (error) {
      toast.error(getApiError(error, "Bulk create failed"));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this feature?")) return;

    try {
      await deleteSaasFeature(id);
      toast.success("Feature deleted");
      loadFeatures(page);
    } catch (error) {
      const msg = getApiError(error, "Unable to delete feature");
      toast.error(msg);
    }
  };

  const openModal = (feature = null) => {
    setEditFeature(feature);
    setFormName(feature ? feature.name : "");
    setShowModal(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
        <h1 className="text-xl font-bold">SaaS Features</h1>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded bg-white p-3 shadow">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search feature..."
              className="min-w-0 text-sm outline-none"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm rounded"
          >
            <Plus size={18} /> Add Feature
          </button>
          <button
            onClick={() => {
              setBulkNames([""]);
              setShowBulkModal(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 text-sm rounded"
          >
            <Plus size={18} /> Bulk Create
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left font-semibold">Name</th>
                <th className="p-3 text-left font-semibold">Created At</th>
                <th className="p-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="3" className="text-center p-6 text-gray-500">Loading features...</td>
                </tr>
              ) : (
                features.map((feature) => (
                  <tr key={feature.id || feature._id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{feature.name}</td>
                    <td className="p-3 text-gray-500">
                      {feature.createdAt
                        ? new Date(feature.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => openModal(feature)}
                          className="text-blue-500 hover:scale-110 transition"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(feature.id)}
                          className="text-red-500 hover:scale-110 transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!loading && features.length === 0 && (
                <tr>
                  <td colSpan="3" className="text-center p-6 text-gray-500">
                    No features found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center gap-3 p-4 border-t">
          <p className="text-sm text-gray-600">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">
              {editFeature ? "Edit Feature" : "Add Feature"}
            </h2>
            <input
              type="text"
              placeholder="Feature name"
              className="w-full border p-2 mb-4"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowModal(false); setEditFeature(null); }}
                className="px-4 py-2 text-sm border rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-blue-500 text-white px-4 py-2 text-sm rounded"
              >
                {editFeature ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Bulk Create Features</h2>
            <p className="text-sm text-gray-500 mb-3">
              Add feature names below. Each name must be 2-100 characters.
            </p>
            <div className="space-y-2">
              {bulkNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Feature ${i + 1}`}
                    className="flex-1 border p-2 text-sm"
                    value={name}
                    onChange={(e) => {
                      const next = [...bulkNames];
                      next[i] = e.target.value;
                      setBulkNames(next);
                    }}
                  />
                  {bulkNames.length > 1 && (
                    <button
                      onClick={() => setBulkNames((prev) => prev.filter((_, j) => j !== i))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setBulkNames((prev) => [...prev, ""])}
              className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus size={16} /> Add row
            </button>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowBulkModal(false); setBulkNames([""]); }}
                className="px-4 py-2 text-sm border rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCreate}
                className="bg-emerald-600 text-white px-4 py-2 text-sm rounded"
              >
                Create All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
