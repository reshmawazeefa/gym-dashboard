import { useEffect, useRef, useState } from "react";
import { Clock, LogIn, LogOut, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  getApiError,
  getUserAttendance,
  memberCheckIn,
  trainerCheckIn,
  selfCheckOut,
} from "../services/api";

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function AttendanceStatus() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  const isMemberOrTrainer = user?.loginType === "member" || user?.loginType === "trainer";
  const userType = user?.loginType === "trainer" ? "TRAINER" : "MEMBER";
  const userId = user?.id || user?._id || user?.userId;

  useEffect(() => {
    if (!userId || !user?.token) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await getUserAttendance(userId, user.token);
        if (!cancelled) {
          const records = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
          setActiveSession(records.find((r) => r.status === "ACTIVE" && !r.checkOut) || null);
        }
      } catch {
        if (!cancelled) setActiveSession(null);
      }
    };
    void check();
    return () => { cancelled = true; };
  }, [userId, user?.token]);

  useEffect(() => {
    let interval = null;
    if (activeSession) {
      const checkInTime = new Date(activeSession.checkIn || activeSession.checkInTime).getTime();
      const tick = () => {
        elapsedRef.current = Date.now() - checkInTime;
        setElapsed(elapsedRef.current);
      };
      tick();
      interval = setInterval(tick, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      if (!userId || !user?.token) return;
      try {
        const response = await getUserAttendance(userId, user.token);
        const records = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
        setActiveSession(records.find((r) => r.status === "ACTIVE" && !r.checkOut) || null);
      } catch {
        // silently poll
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeSession, userId, user?.token]);

  if (!isMemberOrTrainer) return null;

  const handleCheckIn = async () => {
    try {
      setLoading(true);
      if (userType === "TRAINER") {
        await trainerCheckIn(user?.token);
      } else {
        await memberCheckIn(user?.token);
      }
      toast.success("Check-in successful");
      const response = await getUserAttendance(userId, user.token);
      const records = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
      setActiveSession(records.find((r) => r.status === "ACTIVE" && !r.checkOut) || null);
    } catch (error) {
      const message = getApiError(error, "Check-in failed");
      if (message.toLowerCase().includes("expired") || message.toLowerCase().includes("membership")) {
        toast.error(
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <span>Your membership has expired. Please renew to check in.</span>
          </div>,
          { duration: 6000 }
        );
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setLoading(true);
      await selfCheckOut(user?.token);
      toast.success("Checked out successfully");
      setActiveSession(null);
    } catch (error) {
      toast.error(getApiError(error, "Check-out failed"));
    } finally {
      setLoading(false);
    }
  };

  if (activeSession) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <LogIn size={24} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">Checked In</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-emerald-700">
                <Clock size={14} />
                Session duration: {formatDuration(elapsed)}
              </p>
              <p className="text-xs text-emerald-600">
                {userType === "TRAINER" ? "Trainer" : "Member"} &middot; {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleCheckOut}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <LogOut size={16} />
            {loading ? "Checking out..." : "Check Out"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Clock size={24} className="mt-0.5 shrink-0 text-gray-400" />
          <div>
            <p className="font-semibold text-gray-950">Not Checked In</p>
            <p className="mt-1 text-sm text-gray-500">
              Tap below to record your check-in for today.
            </p>
          </div>
        </div>
        <button
          onClick={handleCheckIn}
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          <LogIn size={16} />
          {loading ? "Checking in..." : "Check In"}
        </button>
      </div>
    </div>
  );
}
