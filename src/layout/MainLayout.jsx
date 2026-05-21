import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { Menu } from "lucide-react";

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">
        <div className="mb-5 flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-md border border-gray-200 p-2 text-gray-700 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-500">Welcome back</p>
              <h2 className="truncate text-xl font-bold text-gray-950">
                {user?.role || "Admin"} Portal
              </h2>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 sm:w-auto"
          >
            Logout
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
