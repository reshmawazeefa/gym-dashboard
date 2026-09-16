import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { clearTokens, getApiError, resetPassword } from "../services/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [resetToken, setResetToken] = useState(localStorage.getItem("resetToken") || searchParams.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    const tokenFromStorage = localStorage.getItem("resetToken");

    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      localStorage.setItem("resetToken", tokenFromUrl);
      return;
    }

    if (tokenFromStorage) setResetToken(tokenFromStorage);
  }, [searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!resetToken.trim()) {
      toast.error("Reset token is missing. Please use the link from your email.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await resetPassword({
        token: resetToken.trim(),
        newPassword,
      });

      clearTokens();
      localStorage.removeItem("authSession");
      localStorage.removeItem("resetToken");
      toast.success("Password reset successful. Please log in again.");
      navigate("/login");
    } catch (error) {
      toast.error(getApiError(error, "Unable to reset password"));
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
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Reset Password</h1>
        {/* <p className="mt-2 text-sm text-gray-500">
          Enter the reset token from your email and choose a new password.
        </p> */}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div style={{ display: "none" }}>
            <label className="block text-sm font-medium text-gray-700">Reset Token</label>
            <input
              type="text"
              value={resetToken}
              onChange={(event) => setResetToken(event.target.value)}
              placeholder="Paste the reset token"
              className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter new password"
              className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm">
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
