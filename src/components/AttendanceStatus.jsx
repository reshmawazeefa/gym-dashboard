import { useState } from "react";
import { LogOut, Clock, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { memberCheckOut, trainerCheckOut, getApiError } from "../services/api";

export default function AttendanceStatus() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [checkInTime, setCheckInTime] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("checkInTime")) || null;
    } catch {
      return null;
    }
  });

  // Only show for members and trainers who are checked in
  const isMemberOrTrainer = user?.loginType === "member" || user?.loginType === "trainer";
  const isCheckedIn = checkInTime !== null;

  if (!isMemberOrTrainer || !isCheckedIn) return null;

  const handleCheckOut = async () => {
    // Use id, or fallback to email
    const userId = user?.id || user?.email;
    
    if (!userId) {
      toast.error("Unable to identify user for checkout");
      return;
    }

    try {
      setIsLoading(true);
      const userType = user.loginType === "trainer" ? "TRAINER" : "MEMBER";
      const payload = { userId, type: userType };
      
      // Use role-specific checkout endpoint
      if (user.loginType === "trainer") {
        await trainerCheckOut(payload, user.token);
      } else {
        await memberCheckOut(payload, user.token);
      }

      localStorage.removeItem("checkInTime");
      setCheckInTime(null);
      toast.success("Checked out successfully");
    } catch (error) {
      toast.error(getApiError(error, "Checkout failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <CheckCircle size={24} className="mt-0.5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-900">Checked In</p>
            {checkInTime && (
              <p className="mt-1 flex items-center gap-1 text-sm text-emerald-700">
                <Clock size={14} />
                Check-in time: {new Date(checkInTime).toLocaleTimeString()}
              </p>
            )}
            <p className="text-xs text-emerald-600">
              {user.loginType === "trainer" ? "Trainer" : "Member"} • {user.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleCheckOut}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:flex-shrink-0"
        >
          <LogOut size={16} />
          {isLoading ? "Checking out..." : "Check Out"}
        </button>
      </div>
    </div>
  );
}
