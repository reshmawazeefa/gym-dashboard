import { TriangleAlert, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SubscriptionAlertModal({ onClose }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Subscription payment required"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close subscription alert"
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-50/60">
            <TriangleAlert size={24} />
          </div>
          <p className="mt-6 max-w-sm text-sm leading-6 text-slate-600">
            Your subscription payment has not been completed. Please complete your subscription payment to access the dashboard and use all gym management features.
          </p>
          <button
            type="button"
            onClick={() => navigate("/modules/subscriptions")}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800 sm:w-auto"
          >
            Complete Payment
          </button>
        </div>
      </section>
    </div>
  );
}
