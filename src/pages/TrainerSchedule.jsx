import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Edit3,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { canAccess, getStaffCategory, normalizeRole } from "../utils/rbac";
import {
  bookClass,
  cancelBooking,
  createClass,
  createClassSchedule,
  createClassSlot,
  deleteClassSlot,
  deleteClass,
  getAllClasses,
  getApiError,
  getClassAttendance,
  getClassBookings,
  getClassById,
  getClassSchedules,
  getMyBookings,
  getSlotsBySchedule,
  getTenantUsers,
  getTrainerClasses,
  getUserAttendance,
  markAttendance,
  unwrapList,
  unwrapObject,
  updateClass,
  updateClassSlot,
} from "../services/api";
import ClassModal from "../components/ClassModal";
import ScheduleModal from "../components/ScheduleModal";
import MarkAttendanceModal from "../components/MarkAttendanceModal";

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

  const convertTo12Hour = (timeString) => {
    const [hours, minutes] = String(timeString).split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return String(timeString);
    const period = hours >= 12 ? "PM" : "AM";
    const hour = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
  };

  if (/^\d{2}:\d{2}/.test(String(value))) return convertTo12Hour(String(value).slice(0, 5));

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return String(value);

  return parsedDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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

function toBookingDateIso(value, time = "") {
  const [year, month, day] = String(value || "").split("-").map(Number);
  const [hours, minutes] = String(time || "").split(":").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date();

  if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
    date.setHours(hours, minutes, 0, 0);
  }

  return date.toISOString();
}

function dayName(value) {
  const option = dayOptions.find((day) => String(day.value) === String(value));
  return option?.label || "-";
}

function getScheduleDayKey(schedule = {}) {
  if (schedule.dayOfWeek !== undefined && schedule.dayOfWeek !== null && String(schedule.dayOfWeek).trim() !== "") {
    return String(schedule.dayOfWeek);
  }
  if (schedule.date) {
    return `date:${String(schedule.date)}`;
  }
  return "unknown";
}

function getScheduleDayLabel(schedule = {}) {
  if (schedule.dayOfWeek !== undefined && schedule.dayOfWeek !== null && String(schedule.dayOfWeek).trim() !== "") {
    return dayName(schedule.dayOfWeek);
  }
  if (schedule.date) {
    return formatDate(schedule.date);
  }
  return "Unscheduled";
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
  const slots = item.slots || item.classSlots || item.availableSlots || [];

  return {
    id: getId(item),
    title: item.title || item.name || item.className || "Untitled class",
    description: item.description || item.details || item.sessionDetails || "",
    type: item.type || item.classType || "ONE_TIME",
    startDate: item.startDate || item.date || "",
    endDate: item.endDate || "",
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
    bookedCount:
      item.bookedCount ||
      item.totalBookings ||
      item.bookingsCount ||
      (Array.isArray(item.bookings) ? item.bookings.length : 0) ||
      0,
    schedules: Array.isArray(schedules) ? schedules.map(normalizeSchedule) : [],
    slots: Array.isArray(slots) ? slots.map(normalizeSlot) : [],
    raw: item,
  };
}

function normalizeSchedule(item = {}) {
  const slots = item.slots || item.classSlots || item.availableSlots || [];

  return {
    id: getId(item) || item.id || item._id,
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
    slots: Array.isArray(slots) ? slots.map(normalizeSlot) : [],
    raw: item,
  };
}

function normalizeSlot(item = {}) {
  return {
    id: item.id || item._id || item.slotId || "",
    scheduleId: item.scheduleId || item.classScheduleId || item.schedule?.id || item.schedule?._id || "",
    classId: item.classId || item.gymClassId || item.class?.id || item.class?._id || "",
    startTime: item.startTime || item.start || item.time || "",
    endTime: item.endTime || item.end || "",
    capacity: item.capacity || item.maxCapacity || "",
    bookedCount: item.bookedCount || item.totalBookings || item.bookingsCount || 0,
    raw: item,
  };
}

function normalizeBooking(item = {}) {
  const classItem = item.class || item.gymClass || item.classDetails || {};
  const schedule = item.schedule || item.classSchedule || item.session || {};
  const attendance = item.attendance || item.attendanceRecord || {};

  const attendanceStatus = String(
    item.attendanceStatus ||
      attendance.status ||
      attendance.attendance ||
      "Pending"
  );
  const attendanceMarked = Boolean(
    attendance.status ||
      attendance.attendance ||
      (item.attendanceStatus && !isAttendancePending(item.attendanceStatus)) ||
      (item.attendanceRecord?.status && !isAttendancePending(item.attendanceRecord?.status)) ||
      (attendanceStatus && !isAttendancePending(attendanceStatus))
  );

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
    attendanceStatus,
    attendanceMarked,
    memberName: item.memberName || item.member?.name || item.user?.name || "",
    raw: item,
  };
}

function normalizeAttendance(item = {}) {
  const booking = item.booking || {};
  const user = booking.user || item.user || {};
  
  return {
    id: getId(item) || `${item.userId || item.memberId || booking.userId || ""}-${item.createdAt || item.timestamp || item.markedAt || ""}`,
    memberName: item.memberName || item.member?.name || user.name || user.fullName || "Member",
    trainerName: item.trainerName || item.trainer?.name || item.markedByUser?.name || "",
    status: item.status || item.attendanceStatus || "Attended",
    timestamp: item.timestamp || item.createdAt || item.markedAt || "",
    bookingId: item.bookingId || booking.id || "",
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
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingDates, setBookingDates] = useState({});
  const [trainers, setTrainers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScheduleDay, setSelectedScheduleDay] = useState("");
  const [activeTab, setActiveTab] = useState("schedules");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedClassIdRef = useRef("");
  const canCreateClass = canAccess(user, "classes", "create");
  const canEditClass = canAccess(user, "classes", "edit");
  const canDeleteClass = canAccess(user, "classes", "delete");
  const canManageClasses = canCreateClass || canEditClass || canDeleteClass;
  const userRole = normalizeRole(user?.role, user?.loginType);
  const isMember = userRole === "member";
  const isTrainer = userRole === "staff" && getStaffCategory(user) === "trainer";
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
      const [detailResponse, bookingsResponse, attendanceResponse, schedulesResponse] = await Promise.allSettled([
        getClassById(classId, authToken),
        canManageClasses ? getClassBookings(classId, authToken) : Promise.resolve([]),
        canManageClasses ? getClassAttendance(classId, authToken) : Promise.resolve([]),
        getClassSchedules(classId, authToken),
      ]);

      const normalizedBookings =
        bookingsResponse.status === "fulfilled"
          ? unwrapMaybeList(bookingsResponse.value, ["bookings", "classBookings"]).map(normalizeBooking)
          : [];

      const apiSchedules =
        schedulesResponse.status === "fulfilled"
          ? unwrapMaybeList(schedulesResponse.value, ["schedules", "classSchedules"]).map(normalizeSchedule)
          : [];

      if (detailResponse.status === "fulfilled") {
        const detail = normalizeClass(unwrapObject(detailResponse.value));
        const baseSchedules = apiSchedules.length ? apiSchedules : detail.schedules;
        const schedulesWithSlots = await Promise.all(
          baseSchedules.map(async (schedule) => {
            if (!schedule.id) return schedule;
            if (schedule.slots?.length) return schedule;

            try {
              const slotsResponse = await getSlotsBySchedule(schedule.id, authToken);
              return {
                ...schedule,
                slots: unwrapMaybeList(slotsResponse, ["slots", "classSlots"]).map(normalizeSlot),
              };
            } catch {
              return schedule;
            }
          })
        );
        detail.bookedCount = detail.bookedCount || normalizedBookings.length;
        detail.schedules = schedulesWithSlots;
        selectedClassIdRef.current = detail.id || classId;
        setSelectedClass(detail);
        const nextSelectedSchedule =
          selectedSchedule && detail.schedules.some((schedule) => schedule.id === selectedSchedule.id)
            ? selectedSchedule
            : detail.schedules[0] || null;
        setSelectedSchedule(nextSelectedSchedule);
        const classSlots = detail.type === "RECURRING" ? nextSelectedSchedule?.slots || [] : detail.slots;
        setSelectedSlot((current) =>
          current && classSlots.some((slot) => slot.id === current.id) ? current : classSlots[0] || null
        );
      }

      setClassBookings(normalizedBookings);
      setClassAttendance(
        attendanceResponse.status === "fulfilled"
          ? unwrapMaybeList(attendanceResponse.value, ["attendance", "records", "participants"]).map(normalizeAttendance)
          : []
      );
    } catch (error) {
      toast.error(getApiError(error, "Could not load class details"));
    }
  }, [authToken, canManageClasses, selectedSchedule]);

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
        const attendanceRecords = unwrapList(attendanceResponse.value).map(normalizeAttendance);
        nextBookings = nextBookings.map((booking) => {
          const attendanceRecord = attendanceRecords.find(
            (record) => record.bookingId === booking.id || record.booking?.id === booking.id
          );
          if (attendanceRecord && attendanceRecord.status) {
            const attendanceStatus = attendanceRecord.status;
            return {
              ...booking,
              attendanceStatus,
              attendanceMarked: !isAttendancePending(attendanceStatus),
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
      const trainerSelectedClass = isTrainer ? nextTrainerClasses[0] : null;
      const defaultClass = trainerSelectedClass || nextClasses[0];

      if (!currentSelectedClassId && defaultClass) {
        selectedClassIdRef.current = defaultClass.id;
        setSelectedClass(defaultClass);
        setSelectedSlot(defaultClass.slots?.[0] || null);
        await loadClassDetails(defaultClass.id);
      } else if (currentSelectedClassId) {
        const selectedIsTrainerClass = isTrainer
          ? nextTrainerClasses.some((item) => item.id === currentSelectedClassId) || nextClasses.some((item) => item.id === currentSelectedClassId)
          : true;

        if (selectedIsTrainerClass) {
          await loadClassDetails(currentSelectedClassId);
        } else if (defaultClass) {
          selectedClassIdRef.current = defaultClass.id;
          setSelectedClass(defaultClass);
          setSelectedSlot(defaultClass.slots?.[0] || null);
          await loadClassDetails(defaultClass.id);
        }
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

  const visibleClasses = isTrainer && trainerClasses.length ? trainerClasses : classes;
  const filteredClasses = visibleClasses.filter((classItem) =>
    [classItem.title, classItem.description, classItem.trainer]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const scheduleGroups = (selectedClass?.schedules || []).reduce((groups, schedule) => {
    const key = getScheduleDayKey(schedule);
    if (!groups[key]) groups[key] = [];
    groups[key].push(schedule);
    return groups;
  }, {});

  const scheduleDayKeys = Object.keys(scheduleGroups);
  const activeScheduleDay = selectedScheduleDay && scheduleGroups[selectedScheduleDay] ? selectedScheduleDay : scheduleDayKeys[0] || "";
  const selectedDaySchedules = activeScheduleDay ? scheduleGroups[activeScheduleDay] : [];
  const selectedClassType = selectedClass?.type || selectedClass?.raw?.type || "ONE_TIME";
  const isRecurringClass = selectedClassType === "RECURRING";
  const oneTimeSlots = selectedClass?.slots || [];

  const handleSelectClass = async (classItem) => {
    selectedClassIdRef.current = classItem.id;
    setSelectedClass(classItem);
    setSelectedSchedule(null);
    setSelectedSlot(classItem.slots?.[0] || null);
    await loadClassDetails(classItem.id);
  };

  const handleEditSchedule = (schedule) => {
    setScheduleModalEdit(schedule);
    setScheduleModalPurpose("edit");
    setScheduleModalOpen(true);
  };

  const handleDeleteSchedule = async (slot) => {
    if (!slot?.id) {
      toast.error("Slot id is missing");
      return;
    }
    if (!window.confirm("Delete this slot?")) return;

    try {
      setSaving(true);
      await deleteClassSlot(slot.id, authToken);
      toast.success("Slot deleted");
      await loadModuleData();
      if (selectedClassIdRef.current) await loadClassDetails(selectedClassIdRef.current);
    } catch (error) {
      toast.error(getApiError(error, "Could not delete slot"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const keys = Object.keys((selectedClass?.schedules || []).reduce((groups, schedule) => {
      const key = getScheduleDayKey(schedule);
      groups[key] = true;
      return groups;
    }, {}));

    if (!keys.length) {
      setSelectedScheduleDay("");
      return;
    }

    if (!keys.includes(selectedScheduleDay)) {
      setSelectedScheduleDay(keys[0]);
    }
  }, [selectedClass?.schedules?.length, selectedScheduleDay]);

  const handleEditClass = (classItem) => {
    setClassModalEdit(classItem);
    setClassModalOpen(true);
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
  const [scheduleModalPurpose, setScheduleModalPurpose] = useState("slot");

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
        startTime: payload.startTime,
        endTime: payload.endTime,
        capacity: Number(payload.maxCapacity),
      };
      if (scheduleModalEdit?.id && (scheduleModalEdit.startTime || scheduleModalEdit.raw?.startTime)) {
        await updateClassSlot(scheduleModalEdit.id, body, authToken);
        toast.success("Slot updated");
      } else if (payload.classType === "RECURRING") {
        // If only dayOfWeek was provided, create the schedule only (per API).
        if (!payload.startTime && !payload.endTime && !payload.maxCapacity) {
          const scheduleResponse = await createClassSchedule(
            payload.classId,
            { dayOfWeek: Number(payload.dayOfWeek) },
            authToken
          );
          const schedule = normalizeSchedule(unwrapObject(scheduleResponse));
          toast.success("Schedule created");
        } else {
          // If slot details are also provided, create schedule then slot.
          const scheduleResponse = await createClassSchedule(
            payload.classId,
            { dayOfWeek: Number(payload.dayOfWeek) },
            authToken
          );
          const schedule = normalizeSchedule(unwrapObject(scheduleResponse));
          await createClassSlot(payload.classId, { ...body, scheduleId: schedule.id }, authToken);
          toast.success("Recurring class slot created");
        }
      } else {
        await createClassSlot(payload.classId, body, authToken);
        toast.success("One-time class slot created");
      }
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
      await markAttendance({
        bookingId: payload.bookingId,
        status: payload.status,
        attendanceStatus: payload.status,
      }, authToken);
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
      const bookingDate = toBookingDateIso(
        bookingDates[classId] || toDateInputValue(),
        selectedSlot?.startTime || ""
      );
      if (!selectedSlot?.id) {
        toast.error("Select a slot before booking this class");
        return;
      }
      const bookingPayload = {
        slotId: selectedSlot.id,
        bookingDate,
      };
      if (selectedClass?.type === "ONE_TIME") {
        bookingPayload.isPermanent = false;
      }
      await bookClass(classId, bookingPayload, authToken);
      toast.success("Class booked");
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not book class. Check active membership status."));
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!isMember) {
      toast.error("Only members can cancel booked gym classes");
      return;
    }

    try {
      const classId = booking?.classId || booking?.raw?.classId || booking?.raw?.gymClassId;
      if (!classId) {
        toast.error("Class id is missing for this booking");
        return;
      }
      await cancelBooking(classId, authToken);
      toast.success("Booking cancelled");
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not cancel booking"));
    }
  };

  const selectedSchedules = selectedClass?.schedules || [];
  const allRecurringSlots = selectedSchedules.flatMap((schedule) => schedule.slots || []);
  const visibleSlots = isRecurringClass ? allRecurringSlots : oneTimeSlots;
  const selectedDaySlots = isRecurringClass
    ? selectedDaySchedules.flatMap((schedule) =>
        (schedule.slots || []).map((slot) => ({ ...slot, schedule }))
      )
    : oneTimeSlots.map((slot) => ({ ...slot, schedule: null }));
  const totalCapacity = visibleSlots.reduce((total, slot) => total + (Number(slot.capacity) || 0), 0);
  const totalBookedSlots = visibleSlots.reduce((total, slot) => total + (Number(slot.bookedCount) || 0), 0);
  const classInitial = (selectedClass?.title || "C").trim().charAt(0).toUpperCase();
  const recentBookings = classBookings.slice(0, 4);
  const hasOwnerWorkspace = true; // Use the owner-style class UI for all portals, with member-specific actions hidden by permissions.

  if (hasOwnerWorkspace) {
    return (
      <div className="grid min-h-[calc(100vh-7rem)] gap-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 bg-gray-50/70 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-950">Classes</h1>
              <p className="mt-1 text-[11px] text-gray-500">
                {filteredClasses.length} of {visibleClasses.length} shown
              </p>
            </div>
            <div className="inline-flex items-center gap-2">
              {canCreateClass && !isMember && (
                <button
                  type="button"
                  onClick={() => {
                    setClassModalEdit(null);
                    setClassModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus size={14} />
                  Create Class
                </button>
              )}
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search classes..."
              className="w-full min-w-0 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-15rem)]">
            {filteredClasses.map((classItem, index) => {
              const isSelected = selectedClass?.id === classItem.id;
              const tone = ["bg-blue-100 text-blue-700", "bg-red-100 text-red-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"][index % 4];
              return (
                <button
                  type="button"
                  key={classItem.id || classItem.title}
                  onClick={() => handleSelectClass(classItem)}
                  className={`flex w-full items-center gap-3 rounded-md border bg-white p-3 text-left transition ${
                    isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
                    <ListChecks size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-gray-950">{classItem.title}</span>
                    <span className="mt-1 block text-[11px] text-gray-500">
                      {titleCase(classItem.type)} | {classItem.bookedCount || 0} Bookings
                    </span>
                  </span>
                </button>
              );
            })}
            {!filteredClasses.length && (
              <p className="rounded-md border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">
                {loading ? "Loading classes..." : "No classes found"}
              </p>
            )}
          </div>
        </aside>

        <main className="min-w-0 overflow-y-auto bg-gray-50/30 p-4 md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950">Classes Management</h2>
              <p className="mt-1 text-sm text-gray-500">Manage classes, schedules, slots, bookings and attendance.</p>
            </div>
          </div>

          {!selectedClass?.id ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              Select a class to manage schedules and bookings.
            </div>
          ) : (
            <>
              <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                      {/* <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-lg shadow-blue-200">
                        {classInitial}
                      </div> */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-xl font-bold text-gray-950">{selectedClass.title}</h3>
                          <span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-bold uppercase text-blue-700">
                            {titleCase(selectedClassType)}
                          </span>
                        </div>
                        <p className="mt-2 max-w-3xl text-xs text-gray-500">{selectedClass.description || "No class description added."}</p>
                      </div>
                    </div>
                  <div className="flex flex-wrap gap-2">
                    {canEditClass && (
                      <button
                        type="button"
                        onClick={() => handleEditClass(selectedClass)}
                        className="rounded-md border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pen-line" aria-hidden="true"><path d="M13 21h8"></path><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path></svg>
                      </button>
                    )}
                    {canDeleteClass && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(selectedClass.id)}
                        disabled={saving}
                        className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2 lucide-trash-2" aria-hidden="true"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-5">
                  {[
                    ["Trainer", selectedClass.trainer || "Not assigned"],
                    ["Level", selectedClass.level || "ALL"],
                    ["Duration", selectedClass.duration ? `${selectedClass.duration} mins` : "-"],
                    ["Date Range", `${formatDate(selectedClass.startDate)} - ${formatDate(selectedClass.endDate)}`],
                    ["Bookings", selectedClass.bookedCount || classBookings.length || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="border-gray-200 md:border-l md:pl-4 first:md:border-l-0 first:md:pl-0">
                      <p className="text-[11px] font-medium text-gray-500">{label}</p>
                      <p className="mt-2 truncate text-xs font-semibold text-gray-950">{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex overflow-x-auto border-b border-gray-200 px-4">
                  {[
                    
                    { key: "schedules", label: "Schedules", icon: CalendarClock },
                    { key: "details", label: "Class Overview", icon: ClipboardCheck },
                    { key: "bookings", label: "Bookings", icon: Users },
                    { key: "attendance", label: "Attendance", icon: ClipboardCheck },
                  ].map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`inline-flex min-w-32 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
                          activeTab === tab.key
                            ? "border-blue-600 text-blue-700"
                            : "border-transparent text-gray-600 hover:text-gray-950"
                        }`}
                      >
                        <TabIcon size={16} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* <div className="border-b border-gray-200 bg-gray-50 p-4">
                  <div className="grid gap-4 md:grid-cols-5">
                    {[
                      ["Trainer", selectedClass.trainer || "Not assigned"],
                      ["Level", selectedClass.level || "ALL"],
                      ["Duration", selectedClass.duration ? `${selectedClass.duration} mins` : "-"],
                      ["Date Range", `${formatDate(selectedClass.startDate)} - ${formatDate(selectedClass.endDate)}`],
                      ["Bookings", selectedClass.bookedCount || classBookings.length || 0],
                    ].map(([label, value]) => (
                      <div key={label} className="border-gray-200 md:border-l md:pl-4 first:md:border-l-0 first:md:pl-0">
                        <p className="text-[11px] font-medium text-gray-500">{label}</p>
                        <p className="mt-2 truncate text-xs font-semibold text-gray-950">{value}</p>
                      </div>
                    ))}
                  </div>
                </div> */}

                {activeTab === "schedules" && (
                  <div className="grid min-h-[24rem] lg:grid-cols-[16rem_minmax(0,1fr)]">
                    <div className="border-b border-gray-200 p-4 lg:border-b-0 lg:border-r">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-gray-950">{isRecurringClass ? "Schedules" : "Class Slots"}</h3>
                        {canCreateClass && !isMember && (
                          <button
                            type="button"
                            onClick={() => {
                              setScheduleModalEdit({
                                classId: selectedClass.id,
                                dayOfWeek: activeScheduleDay || "1",
                              });
                              setScheduleModalPurpose("schedule");
                              setScheduleModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <Plus size={14} />
                            Add Schedule
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {(isRecurringClass
                          ? scheduleDayKeys.map((key) => ({ value: key, label: getScheduleDayLabel(scheduleGroups[key][0]) }))
                          : [{ value: "one-time", label: "One-time" }]
                        ).map((day) => {
                          const daySchedules = scheduleGroups[day.value] || [];
                          const slotCount = isRecurringClass
                            ? daySchedules.reduce((count, schedule) => count + (schedule.slots?.length || 0), 0)
                            : oneTimeSlots.length;
                          const isActive = isRecurringClass ? activeScheduleDay === day.value : true;
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => isRecurringClass && setSelectedScheduleDay(day.value)}
                              className={`flex w-full items-center gap-3 rounded-md border p-3 text-left ${
                                isActive
                                  ? "border-blue-500 bg-blue-50 text-blue-900"
                                  : "border-gray-200 bg-white hover:border-blue-300"
                              }`}
                            >
                              <CalendarClock size={20} className={isActive ? "text-blue-600" : "text-gray-500"} />
                              <span>
                                <span className="block text-sm font-semibold">{day.label}</span>
                                <span className="text-xs text-gray-500">{slotCount} Slot{slotCount === 1 ? "" : "s"}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-gray-950">
                          {isRecurringClass ? `${dayName(activeScheduleDay)} Slots` : "Class Slots"}
                        </h3>
                        {canCreateClass && !isMember && (
                          <button
                            type="button"
                            onClick={() => {
                              setScheduleModalEdit({
                                classId: selectedClass.id,
                                dayOfWeek: activeScheduleDay || "1",
                              });
                              setScheduleModalPurpose("slot");
                              setScheduleModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <Plus size={14} />
                            Add Slot
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {selectedDaySlots.map((slot) => {
                          const isSelectedSlot = selectedSlot?.id === slot.id;
                          return (
                            <div
                              key={slot.id || `${slot.startTime}-${slot.endTime}`}
                              onClick={() => {
                                setSelectedSchedule(slot.schedule || null);
                                setSelectedSlot(slot);
                              }}
                              className={`cursor-pointer rounded-lg border p-4 transition hover:bg-gray-50 ${
                                isSelectedSlot ? "border-blue-300 bg-blue-50/40" : "border-gray-200 bg-white"
                              }`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                  <Clock3 size={22} className="mt-0.5 text-gray-600" />
                                  <div>
                                    <p className="font-semibold text-gray-950">
                                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                    </p>
                                    <p className="mt-2 text-sm text-gray-500">
                                      Capacity: {slot.capacity || "-"} <span className="mx-2">|</span> Booked: {slot.bookedCount || 0}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Active</span>
                                  { !isMember && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleEditSchedule({ ...slot, classId: selectedClass.id, dayOfWeek: slot.schedule?.dayOfWeek });
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50"
                                        aria-label="Edit slot"
                                      >
                                        <Edit3 size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleDeleteSchedule(slot);
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 text-red-600 hover:bg-red-50"
                                        aria-label="Delete slot"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {!selectedDaySlots.length && (
                          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                            No slots found for this selection.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
 {activeTab === "details" && (
                 <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "Total Bookings", value: classBookings.length || selectedClass.bookedCount || 0, icon: Users, tone: "bg-blue-50 text-blue-700" },
                      { label: "Schedules", value: selectedSchedules.length, icon: CalendarClock, tone: "bg-emerald-50 text-emerald-700" },
                      { label: "Total Slots", value: visibleSlots.length, icon: Clock3, tone: "bg-orange-50 text-orange-700" },
                      { label: "Total Capacity", value: `${totalBookedSlots}/${totalCapacity || selectedClass.capacity || 0}`, icon: Users, tone: "bg-violet-50 text-violet-700" },
                    ].map((metric) => {
                      const MetricIcon = metric.icon;
                      return (
                        <div key={metric.label} className={`rounded-md p-4 text-center ${metric.tone}`}>
                          <MetricIcon size={22} className="mx-auto mb-2" />
                          <p className="text-2xl font-bold text-gray-950">{metric.value}</p>
                          <p className="mt-1 text-xs text-gray-500">{metric.label}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "bookings" && (
                  <div className="space-y-2 p-4">
                    {classBookings.map((booking) => (
                      <div key={booking.id || booking.memberName || booking.classTitle} className="grid gap-3 rounded-lg border border-gray-200 p-3 text-sm md:grid-cols-[1fr_10rem_10rem_auto] md:items-center">
                        <span className="font-semibold text-gray-950">{booking.memberName || booking.classTitle}</span>
                        <span className="text-gray-500">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                        <span className="text-gray-500">{formatDate(booking.date)}</span>
                        <span className={`w-fit rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.bookingStatus)}`}>{titleCase(booking.bookingStatus)}</span>
                      </div>
                    ))}
                    {!classBookings.length && <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No bookings returned for this class.</p>}
                  </div>
                )}

                {activeTab === "attendance" && (
                  <div className="space-y-2 p-4">
                    {classAttendance.map((record) => (
                      <div key={record.id || `${record.memberName}-${record.timestamp}`} className="grid gap-3 rounded-lg border border-gray-200 p-3 text-sm md:grid-cols-[1fr_10rem_auto] md:items-center">
                        <span className="font-semibold text-gray-950">{record.memberName}</span>
                        <span className="text-gray-500">{record.timestamp ? formatTime(record.timestamp) : record.trainerName || "-"}</span>
                        <span className={`w-fit rounded px-2 py-1 text-xs font-semibold ${getStatusClass(record.status)}`}>{titleCase(record.status)}</span>
                      </div>
                    ))}
                    {!classAttendance.length && <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No attendance returned for this class.</p>}
                  </div>
                )}
              </section>


            </>
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
            purpose={scheduleModalPurpose}
          />

          <MarkAttendanceModal
            isOpen={isAttendanceModalOpen}
            onClose={() => { setAttendanceModalOpen(false); setAttendanceModalEdit(null); }}
            onSave={handleAttendanceModalSave}
            editData={attendanceModalEdit}
            bookings={myBookings}
          />
        </main>
      </div>
    );
  }

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
              <div className={isMember ? "w-full" : "w-full overflow-x-auto"}>
                <div
                  className={isMember ? "flex flex-wrap gap-3 pb-2" : "inline-flex gap-3 pb-2"}
                  style={isMember ? undefined : { minWidth: 'max-content' }}
                >
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
                        <p className="mt-1 text-xs font-medium text-gray-500">{titleCase(classItem.type)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
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
                  <p className="text-xs font-semibold uppercase text-gray-500">Bookings</p>
                  <p className="mt-1 text-sm font-semibold text-gray-950">
                    {selectedClass.bookedCount || 0}
                  </p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase text-gray-500">Type & Level</p>
                  <p className="mt-1 text-sm font-semibold text-gray-950">{titleCase(selectedClassType)} | {selectedClass.level || "ALL"}</p>
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-950">{isRecurringClass ? "Recurring schedules" : "Class slots"}</h3>
                <span className="text-sm text-gray-500">
                  {isRecurringClass ? (selectedClass?.schedules || []).length : oneTimeSlots.length} records
                </span>
              </div>
              {!isRecurringClass ? (
                oneTimeSlots.length === 0 ? (
                  <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">No slots found for this class.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {oneTimeSlots.map((slot) => {
                      const isSelectedSlot = selectedSlot?.id === slot.id;
                      return (
                        <div
                          key={slot.id || `${slot.startTime}-${slot.endTime}`}
                          onClick={() => setSelectedSlot(slot)}
                          className={`cursor-pointer rounded-md border p-3 transition hover:bg-gray-50 ${
                            isSelectedSlot ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-950">
                            <Clock3 size={14} className="mr-1 inline" />
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </p>
                          <p className="mt-2 text-sm text-gray-700">Capacity: {slot.capacity || "-"}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {canManageClasses && !isMember && (
                              <>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setScheduleModalEdit({ ...slot, classId: selectedClass.id });
                                    setScheduleModalOpen(true);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                                  aria-label="Edit slot"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteSchedule(slot);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                                  aria-label="Delete slot"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (selectedClass?.schedules || []).length === 0 ? (
                <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">No schedules found for this class.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {scheduleDayKeys.map((dayKey) => (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => setSelectedScheduleDay(dayKey)}
                        className={`rounded-lg border p-3 text-left text-sm transition ${
                          activeScheduleDay === dayKey
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-gray-200 bg-white text-gray-900 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="font-medium">{getScheduleDayLabel(scheduleGroups[dayKey][0])}</p>
                        <p className="mt-1 text-xs text-gray-500">{scheduleGroups[dayKey].length} time{scheduleGroups[dayKey].length === 1 ? "" : "s"}</p>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    {selectedDaySchedules.length === 0 ? (
                      <p className="text-sm text-gray-500">No timing details available for this day.</p>
                    ) : (
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                        {selectedDaySchedules.map((schedule) => {
                          const isSelectedSchedule = selectedSchedule?.id === schedule.id;
                          const slots = schedule.slots || [];
                          return (
                            <div
                              key={schedule.id || `${schedule.date}-${schedule.startTime}`}
                              className={`rounded-md border p-3 ${
                                isSelectedSchedule ? "border-blue-500 bg-blue-50" : "border-gray-200"
                              }`}
                            >
                              <p className="text-sm font-semibold text-gray-950">{getScheduleDayLabel(schedule)}</p>
                              {slots.length === 0 ? (
                                <p className="mt-2 rounded-md bg-white p-3 text-sm text-gray-500">No slots for this schedule.</p>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  {slots.map((slot) => {
                                    const isSelectedSlot = selectedSlot?.id === slot.id;
                                    return (
                                      <div
                                        key={slot.id || `${slot.startTime}-${slot.endTime}`}
                                        onClick={() => {
                                          setSelectedSchedule(schedule);
                                          setSelectedSlot(slot);
                                        }}
                                        className="cursor-pointer rounded-md bg-white p-3 ring-1 ring-gray-200 transition hover:bg-gray-50"
                                      >
                                        <p className="text-sm text-gray-700">
                                          <Clock3 size={14} className="mr-1 inline" />
                                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                        </p>
                                        <p className="mt-2 text-sm text-gray-700">Capacity: {slot.capacity || "-"}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {canManageClasses && !isMember && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleEditSchedule({ ...slot, classId: selectedClass.id, dayOfWeek: schedule.dayOfWeek });
                                                }}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                                                aria-label="Edit slot"
                                              >
                                                <Edit3 size={16} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleDeleteSchedule(slot);
                                                }}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                                                aria-label="Delete slot"
                                              >
                                                <Trash2 size={16} />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
          </div>
        </div>

        <div className={isMember ? "grid gap-6 lg:grid-cols-2" : "space-y-6"}>
          {isMember && (
            <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
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
                          onClick={() => handleCancelBooking(booking)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <XCircle size={14} />
                          Cancel
                        </button>
                      )}
                      {booking.id && !["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase()) && !booking.attendanceMarked && toDateInputValue(booking.date) === toDateInputValue(new Date()) && (
                        <button
                          type="button"
                          onClick={() => {
                            setAttendanceModalEdit({
                              bookingId: booking.id || booking._id || booking.bookingId || "",
                              status: booking.attendanceStatus || "PRESENT",
                            });
                            setAttendanceModalOpen(true);
                          }}
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
            </section>
          )}

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

      {canManageClasses && !isMember ? (
        <section className={`grid grid-cols-1 gap-6 ${isTrainer ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {isTrainer && (
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

          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
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
          </section>

          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
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
          </section>
        </section>
      ) : (
        <>
          {isTrainer && (
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

          {canManageClasses && !isMember && (
            <section className="grid gap-6 lg:grid-cols-2">
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
            </section>
          )}
        </>
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
        purpose={scheduleModalPurpose}
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
