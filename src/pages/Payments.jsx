import React, { useState, useEffect } from "react";
import { Plus, Trash, Search } from "lucide-react";
import PaymentModal from "../components/PaymentModal";
import toast from "react-hot-toast";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 5;

  useEffect(() => {
    setPayments(JSON.parse(localStorage.getItem("payments")) || []);
     const data = JSON.parse(localStorage.getItem("members")) || [];
    setMembers(data);
    setPlans(JSON.parse(localStorage.getItem("plans")) || []);
  }, []);

  const handleSave = (data) => {
    const updated = [...payments, { id: Date.now(), ...data }];
    setPayments(updated);
    localStorage.setItem("payments", JSON.stringify(updated));
    toast.success("Payment added");
  };

  const handleDelete = (id) => {
    const updated = payments.filter((p) => p.id !== id);
    setPayments(updated);
    localStorage.setItem("payments", JSON.stringify(updated));
    toast.error("Deleted");
  };

  // Search
  const filtered = payments.filter((p) =>
    p.member.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);

  return (
    <div className="p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Payments</h1>

        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:flex-1">
          <div className="min-w-0 flex-1">
            <div className="flex w-full items-center gap-2 rounded bg-white p-3 shadow sm:max-w-xxl">
              <Search size={18} />
              <input
                placeholder="Search member..."
                className="w-full min-w-0 text-sm outline-none"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm rounded w-full md:w-auto"
          >
            <Plus size={18} /> Add Payment
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left text-sm font-semibold">Member</th>
              <th className="p-3 text-left text-sm font-semibold">Plan</th>
              <th className="p-3 text-left text-sm font-semibold">Amount</th>
              <th className="p-3 text-left text-sm font-semibold">Date</th>
              <th className="p-3 text-left text-sm font-semibold">Status</th>
              <th className="p-3 text-center text-sm font-semibold">Action</th>
            </tr>
          </thead>

          <tbody>
            {paginated.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 text-sm">{p.member}</td>
                <td className="p-3 text-sm">{p.plan}</td>
                <td className="p-3 text-sm">₹{p.amount}</td>
                <td className="p-3 text-sm">{p.date}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded text-white text-sm ${
                      p.status === "Paid"
                        ? "bg-green-500"
                        : "bg-yellow-500"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-500"
                  >
                    <Trash size={18} />
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center p-4">
                  No payments found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex justify-between p-4">
          <p>Page {currentPage} of {totalPages || 1}</p>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              Prev
            </button>

            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <PaymentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
        members={members}
        plans={plans}
      />
    </div>
  );
}