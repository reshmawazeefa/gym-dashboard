import { useCallback, useEffect, useRef, useState } from "react";
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
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { canAccess, normalizeRole } from "../utils/rbac";
import {
  bookClass,
  cancelBooking,
  createClass,
  deleteClass,
  getAllClasses,
  getApiError,
  getClassAttendance,
  getClassBookings,
  getClassById,
  getMyBookings,
  getTenantUsers,
  getTrainerClasses,
  getUserAttendance,
  markAttendance,
  scheduleClass,
  unwrapList,
  unwrapObject,
  updateClass,
} from "../services/api";
import ClassModal from "../components/ClassModal";
import ScheduleModal from "../components/ScheduleModal";
import MarkAttendanceModal from "../components/MarkAttendanceModal";

const emptyClassForm = {
  name: "",
  description: "",
  capacity: "",
  duration: "",
  level: "BEGINNER",
  trainerId: "",
};

const emptyScheduleForm = {
  classId: "",
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
  maxCapacity: "",
};

const dayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

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

function getUserId(user) {
  return user?.id || user?._id || user?.userId || user?.email || "";
}

function getUserName(user) {
  return user?.name || user?.fullName || user?.email || getUserId(user);
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

function toDateInputValue(value) {
  const parsedDate = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toBookingDateIso(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date();

  return date.toISOString();
}

function dayName(value) {
  const option = dayOptions.find((day) => String(day.value) === String(value));
  return option?.label || "-";
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
      item.trainer_id ||
      item.trainer?.id ||
      item.trainer?._id ||
      item.assignedTrainer?._id ||
      "",
    capacity: item.maxCapacity || item.capacity || item.memberCapacity || "",
    duration: item.duration || item.durationMinutes || "",
    level: item.level || "",
    bookedCount: item.bookedCount || item.totalBookings || item.bookingsCount || 0,
    schedules: Array.isArray(schedules) ? schedules.map(normalizeSchedule) : [],
    raw: item,
  };
}

function normalizeSchedule(item = {}) {
  return {
    id: getId(item),
    classId: item.classId || item.gymClassId || item.class?._id || item.class?.id || "",
    date: item.classDate || item.date || item.scheduledDate || item.startDate || item.start,
    dayOfWeek: item.dayOfWeek ?? item.weekDay ?? item.day ?? "",
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
    classId: item.classId || item.gymClassId || classItem.id || classItem._id || "",
    classTitle: item.className || item.title || classItem.title || classItem.name || "Class booking",
    trainer:
      item.trainerName ||
      item.trainer?.name ||
      classItem.trainer?.name ||
      schedule.trainer?.name ||
      "",
    date: item.bookingDate || item.classDate || item.date || schedule.bookingDate || schedule.classDate || schedule.date || schedule.start,
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

function isAttendancePending(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "" || normalized === "pending" || normalized === "not marked" || normalized === "unmarked" || normalized === "none";
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
  const [editingClassId, setEditingClassId] = useState("");
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [attendanceForm, setAttendanceForm] = useState({ bookingId: "", status: "PRESENT" });
  const [bookingDates, setBookingDates] = useState({});
  const [trainers, setTrainers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedClassIdRef = useRef("");
  const canCreateClass = canAccess(user, "classes", "create");
  const canEditClass = canAccess(user, "classes", "edit");
  const canDeleteClass = canAccess(user, "classes", "delete");
  const canManageClasses = canCreateClass || canEditClass || canDeleteClass;
  const isMember = normalizeRole(user?.role, user?.loginType) === "member";
  const authToken = user?.accessToken || user?.token;

  const getLocalTrainers = useCallback(
    () =>
      readLocalList("staff")
        .filter((staff) => String(staff.role || staff.userRole || staff.type || "").toLowerCase().includes("trainer"))
        .concat(readLocalList("trainers"))
        .filter((trainer, index, list) => {
          const key = getUserId(trainer) || trainer.name;
          return key && list.findIndex((item) => (getUserId(item) || item.name) === key) === index;
        }),
    []
  );

  const loadClassDetails = useCallback(async (classId) => {
    if (!classId) return;

    try {
      const [detailResponse, bookingsResponse, attendanceResponse] = await Promise.allSettled([
        getClassById(classId, authToken),
        canManageClasses ? getClassBookings(classId, authToken) : Promise.resolve([]),
        canManageClasses ? getClassAttendance(classId, authToken) : Promise.resolve([]),
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
  }, [authToken, canManageClasses]);

  const loadModuleData = useCallback(async () => {
    try {
      setLoading(true);
      const [classesResponse, bookingsResponse, trainerResponse, attendanceResponse] = await Promise.allSettled([
        getAllClasses(authToken),
        isMember ? getMyBookings(authToken) : Promise.resolve([]),
        canManageClasses ? getTrainerClasses(authToken) : Promise.resolve([]),
        isMember ? getUserAttendance(user?.id || user?.userId, authToken) : Promise.resolve([]),
      ]);

      const nextClasses =
        classesResponse.status === "fulfilled"
          ? unwrapMaybeList(classesResponse.value, ["classes", "gymClasses"]).map(normalizeClass)
          : readLocalList("classes").map(normalizeClass);
      let nextBookings =
        bookingsResponse.status === "fulfilled"
          ? unwrapMaybeList(bookingsResponse.value, ["bookings", "myBookings"]).map(normalizeBooking)
          : [];
      const nextTrainerClasses =
        trainerResponse.status === "fulfilled"
          ? unwrapMaybeList(trainerResponse.value, ["classes", "trainerClasses"]).map(normalizeClass)
          : [];

      // For members, match attendance records with bookings
      if (isMember && attendanceResponse.status === "fulfilled") {
        const attendanceRecords = unwrapList(attendanceResponse.value);
        nextBookings = nextBookings.map((booking) => {
          const attendanceRecord = attendanceRecords.find(
            (record) => record.bookingId === booking.id || record.booking?.id === booking.id
          );
          if (attendanceRecord) {
            return {
              ...booking,
              attendanceStatus: attendanceRecord.status || attendanceRecord.attendance || "Present",
            };
          }
          return booking;
        });
      }

      setClasses(nextClasses);
      setMyBookings(nextBookings);
      setTrainerClasses(nextTrainerClasses);
      localStorage.setItem("classes", JSON.stringify(nextClasses));

      const currentSelectedClassId = selectedClassIdRef.current;

      if (!currentSelectedClassId && nextClasses[0]) {
        selectedClassIdRef.current = nextClasses[0].id;
        setSelectedClass(nextClasses[0]);
        setScheduleForm((current) => ({ ...current, classId: nextClasses[0].id }));
        await loadClassDetails(nextClasses[0].id);
      } else if (currentSelectedClassId) {
        await loadClassDetails(currentSelectedClassId);
      }
    } catch (error) {
      toast.error(getApiError(error, "Could not load class schedule module"));
    } finally {
      setLoading(false);
    }
  }, [authToken, canManageClasses, isMember, loadClassDetails, user?.id]);

  useEffect(() => {
    let isCurrent = true;

    const loadTrainers = async () => {
      try {
        const response = await getTenantUsers("trainer", authToken);
        const apiTrainers = unwrapMaybeList(response, ["users", "trainers"]).filter((trainer) => getUserId(trainer));
        if (isCurrent) setTrainers(apiTrainers.length ? apiTrainers : getLocalTrainers());
      } catch (error) {
        console.warn("Unable to load trainers:", getApiError(error));
        if (isCurrent) setTrainers(getLocalTrainers());
      }
    };

    void loadTrainers();

    return () => {
      isCurrent = false;
    };
  }, [authToken, getLocalTrainers]);

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
    if ((editingClassId && !canEditClass) || (!editingClassId && !canCreateClass)) {
      toast.error("You do not have permission to save gym classes");
      return;
    }
    if (!classForm.name.trim()) {
      toast.error("Class name is required");
      return;
    }
    if (!classForm.capacity || !classForm.duration) {
      toast.error("Capacity and duration are required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: classForm.name.trim(),
        description: classForm.description.trim(),
        capacity: Number(classForm.capacity),
        duration: Number(classForm.duration),
        level: classForm.level,
      };
      if (classForm.trainerId) payload.trainerId = classForm.trainerId;

      const response = editingClassId
        ? await updateClass(editingClassId, payload, authToken)
        : await createClass(payload, authToken);
      const savedClass = normalizeClass(unwrapObject(response));
      setClassForm(emptyClassForm);
      setEditingClassId("");
      toast.success(editingClassId ? "Class updated" : "Class created");
      await loadModuleData();
      if (savedClass.id) await loadClassDetails(savedClass.id);
    } catch (error) {
      toast.error(getApiError(error, "Could not save class"));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSchedule = async (event) => {
    event.preventDefault();
    if (!canCreateClass) {
      toast.error("You do not have permission to schedule gym classes");
      return;
    }
    if (!scheduleForm.classId || scheduleForm.dayOfWeek === "" || !scheduleForm.startTime || !scheduleForm.endTime || !scheduleForm.maxCapacity) {
      toast.error("Class, day, start time, end time, and capacity are required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        dayOfWeek: Number(scheduleForm.dayOfWeek),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        maxCapacity: Number(scheduleForm.maxCapacity),
      };
      await scheduleClass(scheduleForm.classId, payload, authToken);
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
    await loadClassDetails(classItem.id);
  };

  const handleEditClass = (classItem) => {
    setClassModalEdit(classItem);
    setClassModalOpen(true);
  };

  const handleCancelEditClass = () => {
    setEditingClassId("");
    setClassForm(emptyClassForm);
  };

  const handleDeleteClass = async (classId) => {
    if (!canDeleteClass) {
      toast.error("You do not have permission to delete gym classes");
      return;
    }

    if (!window.confirm("Delete this class?")) return;

    try {
      setSaving(true);
      await deleteClass(classId, authToken);
      toast.success("Class deleted");
      if (selectedClassIdRef.current === classId) {
        selectedClassIdRef.current = "";
        setSelectedClass(null);
        setClassBookings([]);
        setClassAttendance([]);
      }
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not delete class"));
    } finally {
      setSaving(false);
    }
  };

  const [isClassModalOpen, setClassModalOpen] = useState(false);
  const [classModalEdit, setClassModalEdit] = useState(null);

  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleModalEdit, setScheduleModalEdit] = useState(null);

  const [isAttendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceModalEdit, setAttendanceModalEdit] = useState(null);

  const handleClassModalSave = async (payload) => {
    // Only trainer/owner/admin can create/edit classes
    const userRole = normalizeRole(user?.role, user?.loginType);
    const allowedRoles = ["gym_owner", "staff", "trainer"];
    
    if ((classModalEdit && !canEditClass) || (!classModalEdit && !canCreateClass) || !allowedRoles.includes(userRole)) {
      toast.error("You do not have permission to save gym classes");
      return;
    }

    try {
      setSaving(true);
      const response = classModalEdit
        ? await updateClass(classModalEdit.id || classModalEdit._id, payload, authToken)
        : await createClass(payload, authToken);
      const savedClass = normalizeClass(unwrapObject(response));
      toast.success(classModalEdit ? "Class updated" : "Class created");
      setClassModalEdit(null);
      setClassModalOpen(false);
      await loadModuleData();
      if (savedClass.id) await loadClassDetails(savedClass.id);
    } catch (error) {
      toast.error(getApiError(error, "Could not save class"));
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleModalSave = async (payload) => {
    // Only trainer/owner/admin can schedule classes
    const userRole = normalizeRole(user?.role, user?.loginType);
    const allowedRoles = ["gym_owner", "staff", "trainer"];
    
    if (!canCreateClass || !allowedRoles.includes(userRole)) {
      toast.error("Only trainers, admins, and owners can schedule classes");
      return;
    }

    try {
      setSaving(true);
      const body = {
        dayOfWeek: Number(payload.dayOfWeek),
        startTime: payload.startTime,
        endTime: payload.endTime,
        maxCapacity: Number(payload.maxCapacity),
      };
      await scheduleClass(payload.classId, body, authToken);
      toast.success("Class schedule created");
      setScheduleModalEdit(null);
      setScheduleModalOpen(false);
      await loadModuleData();
      await loadClassDetails(payload.classId);
    } catch (error) {
      toast.error(getApiError(error, "Could not create schedule"));
    } finally {
      setSaving(false);
    }
  };

  const handleAttendanceModalSave = async (payload) => {
    if (!isMember) {
      toast.error("Only members can mark class attendance");
      return;
    }

    if (!payload.bookingId) {
      toast.error("Select a booking before marking attendance");
      return;
    }

    try {
      setSaving(true);
      await markAttendance({ bookingId: payload.bookingId, status: payload.status }, authToken);
      toast.success("Attendance marked");
      setAttendanceModalEdit(null);
      setAttendanceModalOpen(false);
      if (selectedClassIdRef.current) await loadClassDetails(selectedClassIdRef.current);
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not mark attendance"));
    } finally {
      setSaving(false);
    }
  };

  const handleBookClass = async (classId) => {
    if (!isMember) {
      toast.error("Only members can book gym classes");
      return;
    }

    try {
      const bookingDate = toBookingDateIso(bookingDates[classId] || toDateInputValue());
      await bookClass(classId, { bookingDate }, authToken);
      toast.success("Class booked");
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not book class. Check active membership status."));
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!isMember) {
      toast.error("Only members can cancel booked gym classes");
      return;
    }

    try {
      await cancelBooking(bookingId, authToken);
      toast.success("Booking cancelled");
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not cancel booking"));
    }
  };

  const handleMarkAttendance = async (event) => {
    event.preventDefault();
    if (!isMember) {
      toast.error("Only members can mark class attendance");
      return;
    }

    if (!attendanceForm.bookingId) {
      toast.error("Select a booking before marking attendance");
      return;
    }

    try {
      setSaving(true);
      await markAttendance(
        {
          bookingId: attendanceForm.bookingId,
          status: attendanceForm.status,
        },
        authToken
      );
      toast.success("Attendance marked");
      if (selectedClassIdRef.current) await loadClassDetails(selectedClassIdRef.current);
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
          <h1 className="text-2xl font-bold text-gray-950">Classes</h1>
          <p className="mt-1 text-sm text-gray-500">Browse classes, manage schedules, and keep booking records tidy.</p>
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

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
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

      <section className="space-y-6">
        <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="p-4 pb-3">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-950">Class Catalog</h2>
                <p className="text-sm text-gray-500">{filteredClasses.length} class{filteredClasses.length === 1 ? "" : "es"} available</p>
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

            {filteredClasses.length === 0 ? (
              <p className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">
                {loading ? "Loading classes..." : "No classes found"}
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <div className="inline-flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
                  {filteredClasses.map((classItem) => {
                    const isSelected = selectedClass?.id === classItem.id;
                    return (
                      <button
                        type="button"
                        key={classItem.id || classItem.title}
                        onClick={() => handleSelectClass(classItem)}
                        className={`flex-shrink-0 w-40 rounded-lg border p-3 text-center transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
                            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="font-semibold text-gray-950 truncate">{classItem.title}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-500">Selected class</p>
                <h2 className="mt-1 truncate text-xl font-bold text-gray-950">{selectedClass?.title || "Choose a class"}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedClass?.description || "Select a class from the catalog to see schedules and actions."}
                </p>
              </div>
              {selectedClass?.id && (
                <button
                  type="button"
                  onClick={() => loadClassDetails(selectedClass.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw size={15} />
                  Reload
                </button>
              )}
            </div>

            {selectedClass?.id && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase text-gray-500">Trainer</p>
                  <p className="mt-1 text-sm font-semibold text-gray-950">{selectedClass.trainer || "Not assigned"}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase text-gray-500">Capacity</p>
                  <p className="mt-1 text-sm font-semibold text-gray-950">
                    {selectedClass.bookedCount || 0}
                    {selectedClass.capacity ? ` / ${selectedClass.capacity}` : ""}
                  </p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase text-gray-500">Level</p>
                  <p className="mt-1 text-sm font-semibold text-gray-950">{selectedClass.level || "-"}</p>
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-950">Schedules</h3>
                <span className="text-sm text-gray-500">{(selectedClass?.schedules || []).length} listed</span>
              </div>
              {(selectedClass?.schedules || []).length === 0 ? (
                <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">No schedules found for this class.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="inline-flex gap-3" style={{ minWidth: 'max-content' }}>
                    {(selectedClass?.schedules || []).slice(0, 6).map((schedule) => (
                      <div key={schedule.id || `${schedule.date}-${schedule.startTime}`} className="flex-shrink-0 w-40 rounded-md border border-gray-200 p-3">
                        <p className="font-medium text-gray-950 truncate">{schedule.dayOfWeek !== "" ? dayName(schedule.dayOfWeek) : formatDate(schedule.date)}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          <Clock3 size={14} className="mr-1 inline" />
                          {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedClass?.id && (
              <div className="mt-5 flex flex-wrap gap-2">
                {isMember && (
                  <>
                    <input
                      type="date"
                      value={bookingDates[selectedClass.id] || toDateInputValue()}
                      onChange={(event) =>
                        setBookingDates((current) => ({ ...current, [selectedClass.id]: event.target.value }))
                      }
                      className="h-10 rounded-md border border-gray-300 px-3 text-sm"
                      aria-label={`Booking date for ${selectedClass.title}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleBookClass(selectedClass.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <CalendarCheck size={16} />
                      Book Class
                    </button>
                  </>
                )}
                {canEditClass && !isMember && (
                  <button
                    type="button"
                    onClick={() => handleEditClass(selectedClass)}
                    className="rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Edit Class
                  </button>
                )}
                {canDeleteClass && !isMember && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClass(selectedClass.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}
              </div>
            )}
          </section>

          {canManageClasses && !isMember && (
            <section className="grid gap-6 lg:grid-cols-2">
              {canCreateClass && (
                <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-gray-950">Create Class</h2>
                      <p className="text-sm text-gray-500">Add a new class to the catalog</p>
                    </div>
                    <Plus size={20} className="text-gray-400" />
                  </div>
                  <div>
                    <button onClick={() => { setClassModalEdit(null); setClassModalOpen(true); }} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                      Create Class
                    </button>
                  </div>
                </div>
              )}

              {canCreateClass && (
                <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
                  <div className="mb-4">
                    <h2 className="font-semibold text-gray-950">Schedule Class</h2>
                    <p className="text-sm text-gray-500">Choose the class, day, time, and capacity.</p>
                  </div>
                  <div>
                    <button onClick={() => { setScheduleModalEdit(null); setScheduleModalOpen(true); }} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                      Schedule Class
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      {!isMember && (
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-950">Trainer Classes</h2>
            <p className="text-sm text-gray-500">
              {`${trainerClasses.length} assigned class${trainerClasses.length === 1 ? "" : "es"}`}
            </p>
          </div>
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
        </section>
      )}

      {(isMember || canManageClasses) && (
        <section className={`grid gap-6 ${isMember ? "lg:grid-cols-1" : "lg:grid-cols-3"}`}>
          {isMember && (
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-950">My Bookings</h2>
                <span className="text-sm text-gray-500">{myBookings.length} records</span>
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {myBookings.map((booking) => (
                  <div key={booking.id || `${booking.classTitle}-${booking.date}`} className="rounded-md border border-gray-200 p-3">
                    <p className="font-medium text-gray-950 truncate">{booking.classTitle}</p>
                    <p className="mt-1 truncate text-sm text-gray-500">
                      {formatDate(booking.date)} | {formatTime(booking.startTime)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.bookingStatus)}`}>
                        {titleCase(booking.bookingStatus)}
                      </span>
                      {booking.attendanceStatus && (
                        <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.attendanceStatus)}`}>
                          {titleCase(booking.attendanceStatus)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {booking.id && !["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(booking.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <XCircle size={14} />
                          Cancel
                        </button>
                      )}
                      {isAttendancePending(booking.attendanceStatus) && (
                        <button
                          type="button"
                          onClick={() => { setAttendanceModalEdit(null); setAttendanceModalOpen(true); }}
                          className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                        >
                          <CheckCircle2 size={14} />
                          Mark Attendance
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!myBookings.length && (
                  <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">No bookings found.</p>
                )}
              </div>
            </div>
          )}

          {canManageClasses && (
            <>
              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-950">Class Bookings</h2>
                  <span className="text-sm text-gray-500">{classBookings.length} records</span>
                </div>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {classBookings.map((booking) => (
                    <div key={booking.id || booking.memberName || booking.classTitle} className="rounded-md border border-gray-200 p-3">
                      <p className="font-medium text-gray-950 truncate">{booking.memberName || booking.classTitle}</p>
                      <p className="mt-1 truncate text-sm text-gray-500">{formatDate(booking.date)} | {formatTime(booking.startTime)}</p>
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

              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-950">Attendance</h2>
                  <span className="text-sm text-gray-500">{classAttendance.length} records</span>
                </div>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {classAttendance.map((record) => (
                    <div key={record.id || `${record.memberName}-${record.timestamp}`} className="rounded-md border border-gray-200 p-3">
                      <p className="font-medium text-gray-950 truncate">{record.memberName}</p>
                      <p className="mt-1 truncate text-sm text-gray-500">{record.timestamp ? formatTime(record.timestamp) : record.trainerName || "-"}</p>
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
            </>
          )}
        </section>
      )}
      <ClassModal
        isOpen={isClassModalOpen}
        onClose={() => { setClassModalOpen(false); setClassModalEdit(null); }}
        onSave={handleClassModalSave}
        editData={classModalEdit}
        trainers={trainers}
      />

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => { setScheduleModalOpen(false); setScheduleModalEdit(null); }}
        onSave={handleScheduleModalSave}
        editData={scheduleModalEdit}
        classes={classes}
      />

      <MarkAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => { setAttendanceModalOpen(false); setAttendanceModalEdit(null); }}
        onSave={handleAttendanceModalSave}
        editData={attendanceModalEdit}
        bookings={myBookings}
      />
    </div>
  );
}
