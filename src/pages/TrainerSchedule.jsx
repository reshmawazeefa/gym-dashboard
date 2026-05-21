import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  bookClass,
  cancelBooking,
  createClass,
  getAllClasses,
  getApiError,
  getClassAttendance,
  getClassBookings,
  getClassById,
  getMyBookings,
  getTrainerClasses,
  markAttendance,
  scheduleClass,
  unwrapList,
  unwrapObject,
} from "../services/api";

const emptyClassForm = {
  title: "",
  description: "",
  trainerId: "",
  maxCapacity: "",
};

const emptyScheduleForm = {
  classId: "",
  classDate: "",
  startTime: "",
  endTime: "",
  trainerId: "",
  maxCapacity: "",
  sessionDetails: "",
};

const statusTone = {
  booked: "bg-blue-50 text-blue-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  attended: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
  canceled: "bg-red-50 text-red-700",
  absent: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
};

function getId(item) {
  return item?.id || item?._id || item?.classId || item?.bookingId || item?.scheduleId || "";
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readLocalList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  if (!value) return "-";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return String(value);
  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "-";
  if (/^\d{2}:\d{2}/.test(String(value))) return String(value).slice(0, 5);

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return String(value);

  return parsedDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function unwrapMaybeList(payload, keys = []) {
  const baseList = unwrapList(payload);
  if (baseList.length) return baseList;

  const objectPayload = unwrapObject(payload);
  for (const key of keys) {
    if (Array.isArray(objectPayload?.[key])) return objectPayload[key];
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }

  return [];
}

function normalizeClass(item = {}) {
  const schedules =
    item.schedules ||
    item.schedule ||
    item.classSchedules ||
    item.sessions ||
    [];

  return {
    id: getId(item),
    title: item.title || item.name || item.className || "Untitled class",
    description: item.description || item.details || item.sessionDetails || "",
    trainer:
      item.trainerName ||
      item.trainer?.name ||
      item.assignedTrainer?.name ||
      item.trainer ||
      "",
    trainerId:
      item.trainerId ||
      item.trainer?.id ||
      item.trainer?._id ||
      item.assignedTrainer?._id ||
      "",
    capacity: item.maxCapacity || item.capacity || item.memberCapacity || "",
    bookedCount: item.bookedCount || item.totalBookings || item.bookingsCount || 0,
    schedules: Array.isArray(schedules) ? schedules.map(normalizeSchedule) : [],
    raw: item,
  };
}

function normalizeSchedule(item = {}) {
  return {
    id: getId(item),
    classId: item.classId || item.class?._id || item.class?.id || "",
    date: item.classDate || item.date || item.scheduledDate || item.startDate || item.start,
    startTime: item.startTime || item.start || item.time || "",
    endTime: item.endTime || item.end || "",
    trainer:
      item.trainerName ||
      item.trainer?.name ||
      item.trainer ||
      item.assignedTrainer?.name ||
      "",
    trainerId: item.trainerId || item.trainer?._id || item.trainer?.id || "",
    capacity: item.maxCapacity || item.capacity || "",
    details: item.sessionDetails || item.details || item.description || "",
    raw: item,
  };
}

function normalizeBooking(item = {}) {
  const classItem = item.class || item.gymClass || item.classDetails || {};
  const schedule = item.schedule || item.classSchedule || item.session || {};

  return {
    id: getId(item),
    classId: item.classId || classItem.id || classItem._id || "",
    classTitle: item.className || item.title || classItem.title || classItem.name || "Class booking",
    trainer:
      item.trainerName ||
      item.trainer?.name ||
      classItem.trainer?.name ||
      schedule.trainer?.name ||
      "",
    date: item.classDate || item.date || schedule.classDate || schedule.date || schedule.start,
    startTime: item.startTime || schedule.startTime || schedule.start,
    endTime: item.endTime || schedule.endTime || schedule.end,
    bookingStatus: item.bookingStatus || item.status || "Booked",
    attendanceStatus: item.attendanceStatus || item.attendance || item.attendanceRecord?.status || "Pending",
    memberName: item.memberName || item.member?.name || item.user?.name || "",
    raw: item,
  };
}

function normalizeAttendance(item = {}) {
  return {
    id: getId(item) || `${item.userId || item.memberId || ""}-${item.createdAt || item.timestamp || ""}`,
    memberName: item.memberName || item.member?.name || item.user?.name || "Member",
    trainerName: item.trainerName || item.trainer?.name || "",
    status: item.status || item.attendanceStatus || "Attended",
    timestamp: item.timestamp || item.createdAt || item.markedAt || "",
    raw: item,
  };
}

function getStatusClass(status) {
  return statusTone[String(status || "").toLowerCase()] || "bg-gray-100 text-gray-700";
}

export default function TrainerSchedule() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [trainerClasses, setTrainerClasses] = useState([]);
  const [classBookings, setClassBookings] = useState([]);
  const [classAttendance, setClassAttendance] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [attendanceForm, setAttendanceForm] = useState({ classId: "", scheduleId: "", status: "Attended" });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedClassIdRef = useRef("");

  const trainers = useMemo(
    () =>
      readLocalList("staff")
        .filter((staff) => String(staff.role || "").toLowerCase().includes("trainer"))
        .concat(readLocalList("trainers"))
        .filter((trainer, index, list) => {
          const key = trainer.id || trainer._id || trainer.email || trainer.name;
          return key && list.findIndex((item) => (item.id || item._id || item.email || item.name) === key) === index;
        }),
    []
  );

  const loadClassDetails = useCallback(async (classId) => {
    if (!classId) return;

    try {
      const [detailResponse, bookingsResponse, attendanceResponse] = await Promise.allSettled([
        getClassById(classId),
        getClassBookings(classId),
        getClassAttendance(classId),
      ]);

      if (detailResponse.status === "fulfilled") {
        const detail = normalizeClass(unwrapObject(detailResponse.value));
        selectedClassIdRef.current = detail.id || classId;
        setSelectedClass(detail);
      }

      setClassBookings(
        bookingsResponse.status === "fulfilled"
          ? unwrapMaybeList(bookingsResponse.value, ["bookings", "classBookings"]).map(normalizeBooking)
          : []
      );
      setClassAttendance(
        attendanceResponse.status === "fulfilled"
          ? unwrapMaybeList(attendanceResponse.value, ["attendance", "records", "participants"]).map(normalizeAttendance)
          : []
      );
    } catch (error) {
      toast.error(getApiError(error, "Could not load class details"));
    }
  }, []);

  const loadModuleData = useCallback(async () => {
    try {
      setLoading(true);
      const [classesResponse, bookingsResponse, trainerResponse] = await Promise.allSettled([
        getAllClasses(),
        getMyBookings(),
        getTrainerClasses(),
      ]);

      const nextClasses =
        classesResponse.status === "fulfilled"
          ? unwrapMaybeList(classesResponse.value, ["classes", "gymClasses"]).map(normalizeClass)
          : readLocalList("classes").map(normalizeClass);
      const nextBookings =
        bookingsResponse.status === "fulfilled"
          ? unwrapMaybeList(bookingsResponse.value, ["bookings", "myBookings"]).map(normalizeBooking)
          : [];
      const nextTrainerClasses =
        trainerResponse.status === "fulfilled"
          ? unwrapMaybeList(trainerResponse.value, ["classes", "trainerClasses"]).map(normalizeClass)
          : [];

      setClasses(nextClasses);
      setMyBookings(nextBookings);
      setTrainerClasses(nextTrainerClasses);
      localStorage.setItem("classes", JSON.stringify(nextClasses));

      const currentSelectedClassId = selectedClassIdRef.current;

      if (!currentSelectedClassId && nextClasses[0]) {
        selectedClassIdRef.current = nextClasses[0].id;
        setSelectedClass(nextClasses[0]);
        setScheduleForm((current) => ({ ...current, classId: nextClasses[0].id }));
        setAttendanceForm((current) => ({ ...current, classId: nextClasses[0].id }));
        await loadClassDetails(nextClasses[0].id);
      } else if (currentSelectedClassId) {
        await loadClassDetails(currentSelectedClassId);
      }
    } catch (error) {
      toast.error(getApiError(error, "Could not load class schedule module"));
    } finally {
      setLoading(false);
    }
  }, [loadClassDetails]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadModuleData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadModuleData]);

  const filteredClasses = classes.filter((classItem) =>
    [classItem.title, classItem.description, classItem.trainer]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: "Classes", value: classes.length, icon: CalendarClock },
    { label: "My bookings", value: myBookings.length, icon: CalendarCheck },
    { label: "Trainer classes", value: trainerClasses.length, icon: ClipboardCheck },
    { label: "Attendance records", value: classAttendance.length, icon: ListChecks },
  ];

  const handleCreateClass = async (event) => {
    event.preventDefault();
    if (!classForm.title.trim()) {
      toast.error("Class title is required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: classForm.title.trim(),
        description: classForm.description.trim(),
        trainerId: classForm.trainerId || undefined,
        maxCapacity: classForm.maxCapacity ? Number(classForm.maxCapacity) : undefined,
      };
      const response = await createClass(payload);
      const createdClass = normalizeClass(unwrapObject(response));
      setClassForm(emptyClassForm);
      toast.success("Class created");
      await loadModuleData();
      if (createdClass.id) await loadClassDetails(createdClass.id);
    } catch (error) {
      toast.error(getApiError(error, "Could not create class"));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSchedule = async (event) => {
    event.preventDefault();
    if (!scheduleForm.classId || !scheduleForm.classDate || !scheduleForm.startTime || !scheduleForm.endTime) {
      toast.error("Class, date, start time, and end time are required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        classDate: scheduleForm.classDate,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        trainerId: scheduleForm.trainerId || undefined,
        maxCapacity: scheduleForm.maxCapacity ? Number(scheduleForm.maxCapacity) : undefined,
        sessionDetails: scheduleForm.sessionDetails.trim(),
      };
      await scheduleClass(scheduleForm.classId, payload);
      toast.success("Class schedule created");
      setScheduleForm({ ...emptyScheduleForm, classId: scheduleForm.classId });
      await loadModuleData();
      await loadClassDetails(scheduleForm.classId);
    } catch (error) {
      toast.error(getApiError(error, "Could not create schedule"));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectClass = async (classItem) => {
    selectedClassIdRef.current = classItem.id;
    setSelectedClass(classItem);
    setScheduleForm((current) => ({ ...current, classId: classItem.id }));
    setAttendanceForm((current) => ({ ...current, classId: classItem.id }));
    await loadClassDetails(classItem.id);
  };

  const handleBookClass = async (classId) => {
    try {
      await bookClass(classId);
      toast.success("Class booked");
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not book class. Check active membership status."));
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await cancelBooking(bookingId);
      toast.success("Booking cancelled");
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not cancel booking"));
    }
  };

  const handleMarkAttendance = async (event) => {
    event.preventDefault();
    if (!attendanceForm.classId) {
      toast.error("Select a class before marking attendance");
      return;
    }

    try {
      setSaving(true);
      await markAttendance({
        classId: attendanceForm.classId,
        scheduleId: attendanceForm.scheduleId || undefined,
        status: attendanceForm.status,
      });
      toast.success("Attendance marked");
      await loadClassDetails(attendanceForm.classId);
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not mark attendance"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Class Schedule & Booking</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage schedules, trainer sessions, member bookings, and attendance.
          </p>
        </div>
        <button
          type="button"
          onClick={loadModuleData}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-950">{stat.value}</p>
                </div>
                <div className="rounded-md bg-blue-50 p-2 text-blue-700">
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-950">Class Catalog</h2>
              <p className="text-sm text-gray-500">Open a class to view bookings and attendance.</p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
              <Search size={17} className="text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search classes"
                className="w-full min-w-0 text-sm outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-sm font-semibold">Class</th>
                  <th className="p-3 text-sm font-semibold">Trainer</th>
                  <th className="p-3 text-sm font-semibold">Capacity</th>
                  <th className="p-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((classItem) => (
                  <tr key={classItem.id || classItem.title} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-semibold text-gray-950">{classItem.title}</p>
                      <p className="mt-1 max-w-md truncate text-sm text-gray-500">{classItem.description || "No description"}</p>
                    </td>
                    <td className="p-3 text-sm">{classItem.trainer || "-"}</td>
                    <td className="p-3 text-sm">
                      {classItem.bookedCount || 0}
                      {classItem.capacity ? ` / ${classItem.capacity}` : ""}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectClass(classItem)}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBookClass(classItem.id)}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Book
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredClasses.length && (
                  <tr>
                    <td colSpan="4" className="p-5 text-center text-sm text-gray-500">
                      {loading ? "Loading classes..." : "No classes found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleCreateClass} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-950">Create Class</h2>
                <p className="text-sm text-gray-500">Add the class before creating sessions.</p>
              </div>
              <Plus size={20} className="text-gray-400" />
            </div>
            <div className="grid gap-3">
              <input
                value={classForm.title}
                onChange={(event) => setClassForm({ ...classForm, title: event.target.value })}
                placeholder="Class title"
                className="rounded-md border border-gray-300 p-2 text-sm"
              />
              <textarea
                value={classForm.description}
                onChange={(event) => setClassForm({ ...classForm, description: event.target.value })}
                placeholder="Description"
                rows="3"
                className="rounded-md border border-gray-300 p-2 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={classForm.trainerId}
                  onChange={(event) => setClassForm({ ...classForm, trainerId: event.target.value })}
                  className="rounded-md border border-gray-300 p-2 text-sm"
                >
                  <option value="">Assign trainer</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id || trainer._id || trainer.email} value={trainer.id || trainer._id || trainer.email}>
                      {trainer.name || trainer.email}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={classForm.maxCapacity}
                  onChange={(event) => setClassForm({ ...classForm, maxCapacity: event.target.value })}
                  placeholder="Capacity"
                  className="rounded-md border border-gray-300 p-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Create Class
              </button>
            </div>
          </form>

          <form onSubmit={handleCreateSchedule} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-950">Create Schedule</h2>
              <p className="text-sm text-gray-500">POST /api/class/:id/schedules</p>
            </div>
            <div className="grid gap-3">
              <select
                value={scheduleForm.classId}
                onChange={(event) => setScheduleForm({ ...scheduleForm, classId: event.target.value })}
                className="rounded-md border border-gray-300 p-2 text-sm"
              >
                <option value="">Select class</option>
                {classes.map((classItem) => (
                  <option key={classItem.id || classItem.title} value={classItem.id}>
                    {classItem.title}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="date"
                  value={scheduleForm.classDate}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, classDate: event.target.value })}
                  className="rounded-md border border-gray-300 p-2 text-sm"
                />
                <input
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })}
                  className="rounded-md border border-gray-300 p-2 text-sm"
                />
                <input
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })}
                  className="rounded-md border border-gray-300 p-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={scheduleForm.trainerId}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, trainerId: event.target.value })}
                  className="rounded-md border border-gray-300 p-2 text-sm"
                >
                  <option value="">Trainer allocation</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id || trainer._id || trainer.email} value={trainer.id || trainer._id || trainer.email}>
                      {trainer.name || trainer.email}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={scheduleForm.maxCapacity}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, maxCapacity: event.target.value })}
                  placeholder="Session capacity"
                  className="rounded-md border border-gray-300 p-2 text-sm"
                />
              </div>
              <textarea
                value={scheduleForm.sessionDetails}
                onChange={(event) => setScheduleForm({ ...scheduleForm, sessionDetails: event.target.value })}
                placeholder="Session details"
                rows="3"
                className="rounded-md border border-gray-300 p-2 text-sm"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Add Schedule
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-950">My Bookings</h2>
              <p className="text-sm text-gray-500">GET /api/class/my-bookings</p>
            </div>
            <Users size={20} className="text-gray-400" />
          </div>
          <div className="space-y-3">
            {myBookings.map((booking) => (
              <div key={booking.id || `${booking.classTitle}-${booking.date}`} className="rounded-md border border-gray-200 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-gray-950">{booking.classTitle}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatDate(booking.date)} · {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{booking.trainer || "Trainer not assigned"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.bookingStatus)}`}>
                      {titleCase(booking.bookingStatus)}
                    </span>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.attendanceStatus)}`}>
                      {titleCase(booking.attendanceStatus)}
                    </span>
                  </div>
                </div>
                {booking.id && !["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => handleCancelBooking(booking.id)}
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <XCircle size={16} />
                    Cancel
                  </button>
                )}
              </div>
            ))}
            {!myBookings.length && (
              <p className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">
                No bookings found for this account.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-950">Mark Attendance</h2>
            <p className="text-sm text-gray-500">POST /api/class/attendance</p>
          </div>
          <form onSubmit={handleMarkAttendance} className="grid gap-3">
            <select
              value={attendanceForm.classId}
              onChange={(event) => setAttendanceForm({ ...attendanceForm, classId: event.target.value })}
              className="rounded-md border border-gray-300 p-2 text-sm"
            >
              <option value="">Select class</option>
              {classes.map((classItem) => (
                <option key={classItem.id || classItem.title} value={classItem.id}>
                  {classItem.title}
                </option>
              ))}
            </select>
            <select
              value={attendanceForm.scheduleId}
              onChange={(event) => setAttendanceForm({ ...attendanceForm, scheduleId: event.target.value })}
              className="rounded-md border border-gray-300 p-2 text-sm"
            >
              <option value="">Schedule/session (optional)</option>
              {(selectedClass?.schedules || []).map((schedule) => (
                <option key={schedule.id || `${schedule.date}-${schedule.startTime}`} value={schedule.id}>
                  {formatDate(schedule.date)} · {formatTime(schedule.startTime)}
                </option>
              ))}
            </select>
            <select
              value={attendanceForm.status}
              onChange={(event) => setAttendanceForm({ ...attendanceForm, status: event.target.value })}
              className="rounded-md border border-gray-300 p-2 text-sm"
            >
              <option>Attended</option>
              <option>Present</option>
              <option>Late</option>
              <option>Absent</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <CheckCircle2 size={17} />
              Mark Attendance
            </button>
          </form>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-950">Trainer Classes</h3>
            <div className="space-y-2">
              {trainerClasses.slice(0, 5).map((classItem) => (
                <button
                  type="button"
                  key={classItem.id || classItem.title}
                  onClick={() => handleSelectClass(classItem)}
                  className="flex w-full items-center justify-between rounded-md border border-gray-200 p-3 text-left hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{classItem.title}</span>
                  <span className="text-sm text-gray-500">{classItem.bookedCount || 0} bookings</span>
                </button>
              ))}
              {!trainerClasses.length && (
                <p className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">
                  No trainer classes returned for {user?.name || "this user"}.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-950">
              {selectedClass?.title || "Class Details"}
            </h2>
            <p className="text-sm text-gray-500">Details, schedules, bookings, and attendance for the selected class.</p>
          </div>
          {selectedClass?.id && (
            <button
              type="button"
              onClick={() => loadClassDetails(selectedClass.id)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Reload Details
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-950">Schedules</h3>
            <div className="space-y-2">
              {(selectedClass?.schedules || []).map((schedule) => (
                <div key={schedule.id || `${schedule.date}-${schedule.startTime}`} className="rounded-md border border-gray-200 p-3">
                  <p className="font-medium text-gray-950">{formatDate(schedule.date)}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    <Clock3 size={14} className="mr-1 inline" />
                    {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{schedule.trainer || selectedClass?.trainer || "Trainer not assigned"}</p>
                </div>
              ))}
              {!(selectedClass?.schedules || []).length && (
                <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">No schedules returned for this class.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-950">Class Bookings</h3>
            <div className="space-y-2">
              {classBookings.map((booking) => (
                <div key={booking.id || booking.memberName || booking.classTitle} className="rounded-md border border-gray-200 p-3">
                  <p className="font-medium text-gray-950">{booking.memberName || booking.classTitle}</p>
                  <p className="mt-1 text-sm text-gray-500">{formatDate(booking.date)} · {formatTime(booking.startTime)}</p>
                  <span className={`mt-2 inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.bookingStatus)}`}>
                    {titleCase(booking.bookingStatus)}
                  </span>
                </div>
              ))}
              {!classBookings.length && (
                <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">No bookings returned for this class.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-950">Attendance</h3>
            <div className="space-y-2">
              {classAttendance.map((record) => (
                <div key={record.id || `${record.memberName}-${record.timestamp}`} className="rounded-md border border-gray-200 p-3">
                  <p className="font-medium text-gray-950">{record.memberName}</p>
                  <p className="mt-1 text-sm text-gray-500">{record.timestamp ? formatTime(record.timestamp) : record.trainerName || "-"}</p>
                  <span className={`mt-2 inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusClass(record.status)}`}>
                    {titleCase(record.status)}
                  </span>
                </div>
              ))}
              {!classAttendance.length && (
                <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">No attendance returned for this class.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
