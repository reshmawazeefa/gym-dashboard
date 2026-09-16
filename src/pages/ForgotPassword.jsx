import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { forgotPassword, getApiError } from "../services/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim() || !gymSlug.trim()) {
      toast.error("Please enter your email and gym code");
      return;
    }

    try {
      setLoading(true);
      await forgotPassword({
        email: email.trim(),
        gymSlug: gymSlug.trim(),
      });

      toast.success("OTP sent to your email. Please verify it to continue.");
      navigate("/verify-otp", {
        state: {
          email: email.trim(),
          gymSlug: gymSlug.trim(),
        },
      });
    } catch (error) {
      toast.error(getApiError(error, "Unable to send reset link"));
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
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Forgot Password</h1>
        <p className="mt-2 text-sm text-gray-500">
          Enter the email address and gym code linked to your account.
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending link..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Back to Login
          </Link>
          <Link to="/reset-password" className="font-medium text-gray-600 hover:text-gray-800">
            Reset with token
          </Link>
        </div>
      </div>
    </div>
  );
}
