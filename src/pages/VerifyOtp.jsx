import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getApiError, verifyOtp } from "../services/api";

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();

  const initialValues = useMemo(
    () => ({
      email: location.state?.email || "",
      gymSlug: location.state?.gymSlug || "",
    }),
    [location.state]
  );

  const [email, setEmail] = useState(initialValues.email);
  const [gymSlug, setGymSlug] = useState(initialValues.gymSlug);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = email.trim();
    const normalizedGymSlug = gymSlug.trim();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || !normalizedGymSlug) {
      toast.error("Please enter your email and gym code.");
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      toast.error("OTP must be a 6-digit number.");
      return;
    }

    try {
      setLoading(true);
      const result = await verifyOtp({
        email: normalizedEmail,
        gymSlug: normalizedGymSlug,
        otp: normalizedOtp,
      });

      const resetToken = result?.data?.resetToken || result?.resetToken || result?.token;
      if (!resetToken) {
        throw new Error("Reset token not received from server.");
      }

      localStorage.setItem("resetToken", resetToken);
      toast.success("OTP verified successfully.");
      navigate("/reset-password");
    } catch (error) {
      toast.error(getApiError(error, "Invalid or expired OTP"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          Account Recovery
        </p>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Verify OTP</h1>
        <p className="mt-2 text-sm text-gray-500">
          Enter the 6-digit code sent to your email for this gym.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@example.com"
              className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Gym Code</label>
            <input
              type="text"
              value={gymSlug}
              onChange={(event) => setGymSlug(event.target.value)}
              placeholder="Enter gym code"
              className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">OTP</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate("/reset-password")}
            className="font-medium text-gray-600 hover:text-gray-800"
          >
            Reset with token
          </button>
        </div>
      </div>
    </div>
  );
}
