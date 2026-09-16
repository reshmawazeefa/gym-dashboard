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
  MoreVertical,
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
  changeSlot,
  changeSlotPermanent,
  createClass,
  createClassSchedule,
  createClassSlot,
  deleteClassSchedule,
  deleteClassSlot,
  deleteClass,
  getAllClasses,
  getApiError,
  getAvailableMembers,
  getClassAttendance,
  getClassBookings,
  getClassById,
  getClassSchedules,
  getClassSlots,
  getMyBookings,
  getSlotAttendance,
  getSlotMembers,
  getSlotsBySchedule,
  getTenantUsers,
  getTrainerClasses,
  getUserAttendance,
  markAttendance,
  getBookingSlotChanges,
  unwrapList,
  unwrapObject,
  updateClass,
  updateClassSlot,
} from "../services/api";
import ClassModal from "../components/ClassModal";
import ScheduleModal from "../components/ScheduleModal";
import MarkAttendanceModal from "../components/MarkAttendanceModal";

const dayNameToNumber = {
  sunday: "0",
  monday: "1",
  tuesday: "2",
  wednesday: "3",
  thursday: "4",
  friday: "5",
  saturday: "6",
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

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getTrainerDisplayName(item = {}) {
  const trainer = item.trainer || item.assignedTrainer || item.trainerDetails || {};
  if (typeof trainer === "string") return trainer;
  return trainer?.name || trainer?.fullName || trainer?.trainerName || item.trainerName || item.assignedTrainer?.name || "";
}

function getTrainerPayload(item = {}) {
  const trainer = item.trainer || item.assignedTrainer || item.trainerDetails || {};
  return trainer && typeof trainer === "object" ? trainer : null;
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

function formatSlotRange(slot = {}) {
  const start = slot.startTime || slot.start || slot.time || "";
  const end = slot.endTime || slot.end || "";

  if (!start && !end) return "Slot details unavailable";
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function getBookingDateValue(item = {}) {
  return item.bookingDate || item.booking?.bookingDate || item.raw?.bookingDate || item.date || "";
}

function toDateInputValue(value) {
  const dateString = String(value || "");
  const dateOnlyMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) return dateOnlyMatch[1];

  const parsedDate = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sameBookingDate(firstValue, secondValue) {
  return toDateInputValue(firstValue) === toDateInputValue(secondValue);
}

function readBookingSlotOverrides() {
  try {
    const stored = JSON.parse(localStorage.getItem("classBookingSlotOverrides") || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
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

function toCurrentBookingDateIso() {
  return new Date().toISOString();
}

function dayName(value) {
  const normalized = dayNameToNumber[String(value).toLowerCase()] ?? value;
  const option = dayOptions.find((day) => String(day.value) === String(normalized));
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
  const trainerPayload = getTrainerPayload(item);
  const trainerName = getTrainerDisplayName(item);

  return {
    id: getId(item),
    name: item.name || item.title || item.className || "Untitled class",
    title: item.name || item.title || item.className || "Untitled class",
    description: item.description || item.details || item.sessionDetails || "",
    type: item.type || item.classType || "ONE_TIME",
    startDate: item.startDate || item.date || "",
    endDate: item.endDate || "",
    trainer: trainerName,
    trainerName,
    trainerEmail: trainerPayload?.email || "",
    trainerPhone: trainerPayload?.phoneNumber || "",
    trainerDetails: trainerPayload || null,
    trainerId:
      item.trainerId ||
      item.trainer_id ||
      trainerPayload?.id ||
      trainerPayload?._id ||
      item.assignedTrainer?._id ||
      "",
    capacity: item.capacity ?? item.maxCapacity ?? item.memberCapacity ?? "",
    duration: item.duration || item.durationMinutes || "",
    level: item.level || "",
    isActive: item.isActive ?? item.active ?? true,
    bookedCount:
      item.bookedCount ??
      item.totalBookings ??
      item.bookingsCount ??
      (Array.isArray(item.bookings) ? item.bookings.length : 0) ??
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
    dayOfWeek: dayNameToNumber[String(item.dayOfWeek ?? "").toLowerCase()] ?? item.dayOfWeek ?? item.weekDay ?? item.day ?? "",
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
    date: item.startDate || item.classDate || item.date || "",
    startTime: item.startTime || item.start || item.time || "",
    endTime: item.endTime || item.end || "",
    dayOfWeek: item.dayOfWeek || item.schedule?.dayOfWeek || item.schedule?.weekDay || item.weekDay || item.day || "",
    capacity: item.capacity ?? item.maxCapacity ?? "",
    bookedCount: item.bookedCount ?? item.totalBookings ?? item.bookingsCount ?? 0,
    remainingSpots: item.remainingSpots ?? item.availableSpots ?? "",
    isFull: item.isFull ?? false,
    raw: item,
  };
}

function normalizeBooking(item = {}) {
  const classItem = item.class || item.gymClass || item.classDetails || {};
  const schedule = item.schedule || item.classSchedule || item.session || {};
  const slot = item.slot || item.classSlot || {};
  const user = item.user || item.member || {};
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
    slotId: item.slotId || item.bookingSlotId || slot.id || "",
    date: item.bookingDate || item.classDate || item.date || schedule.bookingDate || schedule.classDate || schedule.date || schedule.start,
    startTime: item.startTime || schedule.startTime || slot.startTime || schedule.start,
    endTime: item.endTime || schedule.endTime || slot.endTime || schedule.end,
    bookingStatus: item.bookingStatus || item.status || "Booked",
    attendanceStatus,
    attendanceMarked,
    memberName: item.memberName || user.name || user.fullName || "",
    memberEmail: item.memberEmail || user.email || "",
    dayOfWeek: schedule.dayOfWeek || slot.dayOfWeek || "",
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
    attendanceDate: item.attendanceDate || item.markedAt || item.timestamp || "",
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
  const [totalCapacityData, setTotalCapacityData] = useState(null);
  const [bookingDates, setBookingDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(toDateInputValue());
  const [trainers, setTrainers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScheduleDay, setSelectedScheduleDay] = useState("");
  const [activeTab, setActiveTab] = useState("classDetails");
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

  const loadClassDetails = useCallback(async (classId, date) => {
    if (!classId) return;
    const queryDate = date || selectedDate;

    try {
      const [detailResponse, bookingsResponse, attendanceResponse, schedulesResponse, slotsResponse, fullClassResponse] = await Promise.allSettled([
        getClassById(classId, authToken, queryDate),
        canManageClasses ? getClassBookings(classId, authToken) : Promise.resolve([]),
        canManageClasses ? getClassAttendance(classId, authToken) : Promise.resolve([]),
        getClassSchedules(classId, authToken),
        getClassSlots(classId, authToken),
        getClassById(classId, authToken), // Get full class without date filter for total capacity
      ]);

      const allBookings =
        bookingsResponse.status === "fulfilled"
          ? unwrapMaybeList(bookingsResponse.value, ["bookings", "classBookings"]).map(normalizeBooking)
          : [];
      let bookingsForDisplay = allBookings;
      let slotsById = {};
      const storedSlotOverrides = readBookingSlotOverrides();
      const availabilityBookings = queryDate
        ? allBookings.filter((booking) => {
            const bookingDate = String(
              booking.date || booking.bookingDate || booking.raw?.bookingDate || booking.raw?.classDate || booking.raw?.date || ""
            );
            return bookingDate && bookingDate.startsWith(queryDate);
          })
        : allBookings;

      const apiSchedules =
        schedulesResponse.status === "fulfilled"
          ? unwrapMaybeList(schedulesResponse.value, ["schedules", "classSchedules"]).map(normalizeSchedule)
          : [];
      const apiSlots =
        slotsResponse.status === "fulfilled"
          ? unwrapMaybeList(slotsResponse.value, ["slots", "classSlots"]).map(normalizeSlot)
          : [];

      if (detailResponse.status === "fulfilled") {
        const detail = normalizeClass(unwrapObject(detailResponse.value));
        // Prefer detail.schedules from getClassById which already has slots with bookedCount
        const baseSchedules = detail.schedules.length ? detail.schedules : apiSchedules.length ? apiSchedules : [];
        let schedulesWithSlots = await Promise.all(
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
        detail.bookedCount = detail.bookedCount || allBookings.length;

        // Group bookings by slotId for accurate per-slot counts using ALL bookings (unfiltered by date)
        const slotBookings = {};
        allBookings.forEach((booking) => {
          const slotId = booking.slotId || booking.raw?.slotId;
          if (slotId) {
            if (!slotBookings[slotId]) slotBookings[slotId] = 0;
            const status = String(booking.bookingStatus || booking.raw?.status || "").toLowerCase();
            if (status === "booked" || !status) {
              slotBookings[slotId]++;
            }
          }
        });

        // Enrich schedule slots with real booking counts from the bookings list
        schedulesWithSlots = schedulesWithSlots.map((schedule) => ({
          ...schedule,
          slots: (schedule.slots || []).map((slot) => {
            // Always use calculated bookedCount from allBookings for accuracy
            const bookedCount = slotBookings[slot.id] ?? 0;
            const capacity = Number(slot.capacity) || 0;
            return { ...slot, bookedCount, remainingSpots: capacity - bookedCount, isFull: bookedCount >= capacity && capacity > 0 };
          }),
        }));

        const standaloneSlots = apiSlots.length
          ? apiSlots.filter((slot) => !slot.scheduleId)
          : detail.slots || [];

        // Also enrich standalone slots
        detail.slots = standaloneSlots.map((slot) => {
          const bookedCount = slotBookings[slot.id] ?? slot.bookedCount ?? 0;
          const capacity = Number(slot.capacity) || 0;
          return { ...slot, bookedCount, remainingSpots: capacity - bookedCount, isFull: bookedCount >= capacity && capacity > 0 };
        });

        detail.schedules = schedulesWithSlots;
        const currentSlots = [
          ...detail.schedules.flatMap((schedule) => schedule.slots || []),
          ...detail.slots,
        ];
        slotsById = currentSlots.reduce((slots, slot) => {
          if (slot.id) slots[slot.id] = slot;
          return slots;
        }, {});
        bookingsForDisplay = allBookings.map((booking) => {
          const currentSlot = slotsById[booking.slotId];
          return currentSlot
            ? {
                ...booking,
                startTime: currentSlot.startTime,
                endTime: currentSlot.endTime,
                dayOfWeek: currentSlot.dayOfWeek || booking.dayOfWeek,
              }
            : booking;
        });
        selectedClassIdRef.current = detail.id || classId;
        setSelectedClass(detail);
        const nextSelectedSchedule =
          detail.schedules.find((schedule) => schedule.id === selectedSchedule?.id) || detail.schedules[0] || null;
        setSelectedSchedule(nextSelectedSchedule);
        const classSlots = detail.type === "RECURRING" ? nextSelectedSchedule?.slots || [] : detail.slots;
        setSelectedSlot((current) =>
          current && classSlots.some((slot) => slot.id === current.id) ? current : classSlots[0] || null
        );

        // Extract total capacity data from full class response (without date filtering)
        if (fullClassResponse.status === "fulfilled") {
          const fullDetail = normalizeClass(unwrapObject(fullClassResponse.value));
          const fullSchedules = fullDetail.schedules || [];
          const allSlots = fullSchedules.flatMap((schedule) => schedule.slots || []);
          const totalCap = allSlots.reduce((total, slot) => total + (Number(slot.capacity) || 0), 0);
          const totalBooked = allSlots.reduce((total, slot) => total + (Number(slot.bookedCount) || 0), 0);
          setTotalCapacityData({ totalCapacity: totalCap, totalBooked });
        }
      }

      const slotChangeResults = await Promise.allSettled(
        allBookings.map((booking) => {
          const bookingId = booking.id || booking._id || booking.bookingId;
          return bookingId ? getBookingSlotChanges(bookingId, authToken) : Promise.resolve([]);
        })
      );
      const effectiveSlotChanges = {};
      allBookings.forEach((booking, index) => {
        const response = slotChangeResults[index];
        if (!booking.id || response?.status !== "fulfilled") return;
        const changes = unwrapMaybeList(response.value, ["slotChanges", "changes"]);
        const applicableChanges = changes
          .filter((change) => change.isPermanent || sameBookingDate(change.date || change.bookingDate, booking.date))
          .sort((first, second) => new Date(second.createdAt || second.updatedAt || 0) - new Date(first.createdAt || first.updatedAt || 0));
        const latestChange = applicableChanges[0];
        const effectiveSlot = latestChange && slotsById[latestChange.newSlotId];
        if (effectiveSlot) effectiveSlotChanges[booking.id] = effectiveSlot;
      });
      bookingsForDisplay = bookingsForDisplay.map((booking) => {
        const bookingId = booking.id || booking._id || booking.bookingId;
        const overrideKey = `${classId}:${bookingId}:${toDateInputValue(booking.date)}`;
        const effectiveSlot = bookingSlotOverridesRef.current[overrideKey] || storedSlotOverrides[overrideKey] || effectiveSlotChanges[bookingId];
        return effectiveSlot
          ? { ...booking, slotId: effectiveSlot.id, startTime: effectiveSlot.startTime, endTime: effectiveSlot.endTime, dayOfWeek: effectiveSlot.dayOfWeek || booking.dayOfWeek }
          : booking;
      });

      const attendanceRecords = attendanceResponse.status === "fulfilled"
        ? unwrapMaybeList(attendanceResponse.value, ["attendance", "records", "participants"]).map(normalizeAttendance)
        : [];
      const latestAttendanceByBooking = attendanceRecords.reduce((records, attendance) => {
        if (!attendance.bookingId) return records;
        const current = records[attendance.bookingId];
        const currentTime = current ? new Date(current.attendanceDate || current.timestamp || 0).getTime() : -1;
        const nextTime = new Date(attendance.attendanceDate || attendance.timestamp || 0).getTime();
        if (!current || nextTime >= currentTime) records[attendance.bookingId] = attendance;
        return records;
      }, {});
      setClassBookings(bookingsForDisplay.map((booking) => {
        const bookingId = booking.id || booking._id || booking.bookingId;
        const latestAttendance = latestAttendanceByBooking[bookingId];
        return latestAttendance
          ? { ...booking, attendanceStatus: latestAttendance.status, attendanceMarked: !isAttendancePending(latestAttendance.status) }
          : booking;
      }));
      setClassAttendance(attendanceRecords);
    } catch (error) {
      toast.error(getApiError(error, "Could not load class details"));
    }
  }, [authToken, canManageClasses, selectedDate]);

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

      // Enrich each class with actual booking count
      const enrichedClasses = await Promise.all(
        nextClasses.map(async (classItem) => {
          try {
            const bookingsResponse = await getClassBookings(classItem.id, authToken);
            const bookings = unwrapMaybeList(bookingsResponse, ["bookings", "classBookings"]);
            return { ...classItem, bookedCount: bookings.length };
          } catch {
            return classItem;
          }
        })
      );

      setClasses(enrichedClasses);
      setMyBookings(nextBookings);
      setTrainerClasses(nextTrainerClasses);
      localStorage.setItem("classes", JSON.stringify(enrichedClasses));

      const currentSelectedClassId = selectedClassIdRef.current;
      const trainerSelectedClass = isTrainer ? nextTrainerClasses[0] : null;
      const defaultClass = trainerSelectedClass || enrichedClasses[0];

      if (!currentSelectedClassId && defaultClass) {
        selectedClassIdRef.current = defaultClass.id;
        setSelectedSlot(defaultClass.slots?.[0] || null);
        await loadClassDetails(defaultClass.id);
      } else if (currentSelectedClassId) {
        const selectedIsTrainerClass = isTrainer
          ? nextTrainerClasses.some((item) => item.id === currentSelectedClassId) || enrichedClasses.some((item) => item.id === currentSelectedClassId)
          : true;

        if (selectedIsTrainerClass) {
          await loadClassDetails(currentSelectedClassId);
        } else if (defaultClass) {
          selectedClassIdRef.current = defaultClass.id;
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
    setSelectedSchedule(null);
    setSelectedSlot(classItem.slots?.[0] || null);
    setSlotMembers([]);
    setSlotMembersSlotId(null);
    setSlotChanges([]);
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

        if (!selectedScheduleDay && keys.length) {
        setSelectedScheduleDay(keys[0]);
      }
    }, [selectedClass?.id]);

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
  const [slotMembers, setSlotMembers] = useState([]);
  const [slotMembersSlotId, setSlotMembersSlotId] = useState(null);
  const [slotChanges, setSlotChanges] = useState([]);
  const [slotChangeTargets, setSlotChangeTargets] = useState({});
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [assignSlotId, setAssignSlotId] = useState("");
  const [assignBookingDate, setAssignBookingDate] = useState(toDateInputValue());
  const [slotAttendanceRecords, setSlotAttendanceRecords] = useState([]);
  const [slotAttendanceSlotId, setSlotAttendanceSlotId] = useState(null);
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [bookingSlotFilter, setBookingSlotFilter] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [openBookingActions, setOpenBookingActions] = useState(null);
  const [changeSlotBooking, setChangeSlotBooking] = useState(null);
  const [changeSlotTarget, setChangeSlotTarget] = useState("");
  const [changeSlotType, setChangeSlotType] = useState("temporary");
  const [slotHistoryBooking, setSlotHistoryBooking] = useState(null);
  const bookingSlotOverridesRef = useRef({});

  const loadSlotMembers = async (slotId) => {
    if (!slotId) return;
    try {
      const response = await getSlotMembers(slotId, authToken);
      setSlotMembers(unwrapMaybeList(response, ["members", "bookings"]));
      setSlotMembersSlotId(slotId);
    } catch (error) {
      toast.error(getApiError(error, "Could not load slot members"));
    }
  };

  const loadBookingSlotChanges = async (bookingId) => {
    if (!bookingId) return;
    try {
      const response = await getBookingSlotChanges(bookingId, authToken);
      setSlotChanges(unwrapMaybeList(response, ["slotChanges", "changes"]));
    } catch (error) {
      toast.error(getApiError(error, "Could not load slot changes"));
    }
  };

  const loadAvailableMembers = async (slotId, date) => {
    if (!selectedClass?.id || !slotId) return;
    try {
      const response = await getAvailableMembers(selectedClass.id, slotId, date, authToken);
      setAvailableMembers(unwrapList(response));
    } catch (error) {
      toast.error(getApiError(error, "Could not load available members"));
    }
  };

  const loadSlotAttendance = async (slotId) => {
    if (!slotId) return;
    try {
      const response = await getSlotAttendance(slotId, authToken);
      setSlotAttendanceRecords(unwrapList(response));
      setSlotAttendanceSlotId(slotId);
    } catch (error) {
      toast.error(getApiError(error, "Could not load slot attendance"));
    }
  };

  const handleAssignMember = async (memberId) => {
    if (!selectedClass?.id || !assignSlotId) return;
    try {
      setSaving(true);
      const payload = { slotId: assignSlotId, memberId };
      if (selectedClass.type === "RECURRING") {
        payload.bookingDate = toBookingDateIso(assignBookingDate || selectedDate || toDateInputValue(), "00:00");
      }
      await bookClass(selectedClass.id, payload, authToken);
      toast.success("Member assigned to class");
      setShowAssignPanel(false);
      setAvailableMembers([]);
      await loadClassDetails(selectedClassIdRef.current);
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not assign member"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScheduleDay = async (schedule) => {
    const scheduleId = schedule?.id || schedule?.scheduleId;
    if (!scheduleId) {
      toast.error("Schedule id is missing");
      return;
    }
    if (!window.confirm("Delete this schedule and its slots?")) return;
    try {
      setSaving(true);
      await deleteClassSchedule(scheduleId, authToken);
      toast.success("Schedule deleted");
      await loadModuleData();
      if (selectedClassIdRef.current) await loadClassDetails(selectedClassIdRef.current);
    } catch (error) {
      toast.error(getApiError(error, "Could not delete schedule"));
    } finally {
      setSaving(false);
    }
  };

  const handleSlotChange = async (bookingId, newSlotId, isPermanent = false, bookingDate) => {
    if (!bookingId || !newSlotId) {
      toast.error("Please select a slot to change to");
      return;
    }

    try {
      setSaving(true);
      const requestedSlot = [...allRecurringSlots, ...oneTimeSlots].find((slot) => slot.id === newSlotId);
      const sourceBooking = classBookings.find((booking) => (booking.id || booking._id || booking.bookingId) === bookingId);
      const normalizedBookingDate = toDateInputValue(bookingDate || sourceBooking?.date || changeSlotBooking?.date || selectedDate);
      let changeResponse = null;
      if (isPermanent) {
        changeResponse = await changeSlotPermanent(bookingId, { newSlotId }, authToken);
        toast.success("Permanent slot change applied");
      } else {
        changeResponse = await changeSlot(bookingId, { newSlotId, date: toBookingDateIso(normalizedBookingDate, "00:00") }, authToken);
        toast.success("Temporary slot change applied");
      }
      const changeData = unwrapObject(changeResponse);
      const responseSlotId = changeData.newSlotId || changeData.newSlot?.id || newSlotId;
      const changedSlot = requestedSlot || [...allRecurringSlots, ...oneTimeSlots].find((slot) => slot.id === responseSlotId);
      if (changedSlot) {
        const overrideKey = `${selectedClassIdRef.current || selectedClass?.id}:${bookingId}:${normalizedBookingDate}`;
        bookingSlotOverridesRef.current[overrideKey] = changedSlot;
        localStorage.setItem("classBookingSlotOverrides", JSON.stringify({
          ...readBookingSlotOverrides(),
          [overrideKey]: changedSlot,
        }));
        setClassBookings((currentBookings) => currentBookings.map((booking) => {
          const currentBookingId = booking.id || booking._id || booking.bookingId;
          return currentBookingId === bookingId
            ? {
                ...booking,
                slotId: changedSlot.id,
                startTime: changedSlot.startTime,
                endTime: changedSlot.endTime,
                dayOfWeek: changedSlot.dayOfWeek || booking.dayOfWeek,
              }
            : booking;
        }));
      }
      if (selectedClassIdRef.current) await loadClassDetails(selectedClassIdRef.current);
    } catch (error) {
      toast.error(getApiError(error, "Could not change slot"));
    } finally {
      setSaving(false);
    }
  };

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
      if (scheduleModalPurpose === "schedule") {
        await createClassSchedule(
          payload.classId,
          { dayOfWeek: payload.dayOfWeek },
          authToken
        );
        toast.success("Schedule created");
      } else {
        const body = {
          startTime: payload.startTime,
          endTime: payload.endTime,
          capacity: Number(payload.maxCapacity),
        };

        if (payload.scheduleId) {
          body.scheduleId = payload.scheduleId;
        }

        if (scheduleModalEdit?.id && (scheduleModalEdit.startTime || scheduleModalEdit.raw?.startTime)) {
          await updateClassSlot(scheduleModalEdit.id, {
            startTime: body.startTime,
            endTime: body.endTime,
            capacity: body.capacity,
          }, authToken);
          toast.success("Slot updated");
        } else {
          await createClassSlot(payload.classId, body, authToken);
          toast.success(payload.scheduleId ? "Schedule slot created" : "Class slot created");
        }
      }
      setScheduleModalEdit(null);
      setScheduleModalOpen(false);
      await loadModuleData();
      await loadClassDetails(payload.classId);
    } catch (error) {
      toast.error(getApiError(error, "Could not save slot"));
    } finally {
      setSaving(false);
    }
  };

  const handleAttendanceModalSave = async (payload) => {
    if (!canManageClasses) {
      toast.error("Only staff can mark class attendance");
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
      }, authToken);
      toast.success("Attendance marked");
      setAttendanceModalEdit(null);
      setAttendanceModalOpen(false);
      if (selectedClassIdRef.current) await loadClassDetails(selectedClassIdRef.current);
      setClassBookings((currentBookings) => currentBookings.map((booking) => {
        const bookingId = booking.id || booking._id || booking.bookingId;
        return bookingId === payload.bookingId
          ? { ...booking, attendanceStatus: payload.status, attendanceMarked: payload.status !== "PENDING" }
          : booking;
      }));
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not mark attendance"));
    } finally {
      setSaving(false);
    }
  };

  const handleBookClass = async (classId, slot) => {
    if (!isMember) {
      toast.error("Only members can book gym classes");
      return;
    }

    const targetSlot = slot || selectedSlot;
    if (!targetSlot?.id) {
      toast.error("Select a slot before booking this class");
      return;
    }

    try {
      const selectedClassItem = classes.find((item) => item.id === classId) || selectedClass;
      const bookingDateValue = bookingDates[classId] || selectedDate || toDateInputValue();
      const payload = { slotId: targetSlot.id };

      if (selectedClassItem?.type === "RECURRING") {
        payload.bookingDate = toBookingDateIso(bookingDateValue, "00:00");
      }

      await bookClass(classId, payload, authToken);
      toast.success("Class booked");
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not book class. Check active membership status."));
    }
  };

  const handleCancelBooking = async (booking) => {
    try {
      const bookingId = booking?.id || booking?.bookingId;
      if (!bookingId) {
        toast.error("Booking id is missing for this booking");
        return;
      }
      await cancelBooking(bookingId, authToken);
      toast.success("Booking cancelled");
      await loadModuleData();
    } catch (error) {
      toast.error(getApiError(error, "Could not cancel booking"));
    }
  };

  const selectedSchedules = selectedClass?.schedules || [];
  const slotDayOfWeek = {};
  selectedSchedules.forEach((schedule) =>
    (schedule.slots || []).forEach((slot) => {
      if (slot.id) slotDayOfWeek[slot.id] = schedule.dayOfWeek;
    })
  );
  const allRecurringSlots = selectedSchedules.flatMap((schedule) =>
    (schedule.slots || []).map((slot) => ({ ...slot, dayOfWeek: schedule.dayOfWeek }))
  );
  const visibleSlots = isRecurringClass ? allRecurringSlots : oneTimeSlots;
  const selectedDaySlots = isRecurringClass
    ? selectedDaySchedules.flatMap((schedule) =>
        (schedule.slots || []).map((slot) => ({ ...slot, schedule }))
      )
    : oneTimeSlots.map((slot) => ({ ...slot, schedule: null }));
  const activeSlotSchedule = selectedDaySchedules.find((schedule) => schedule.id === selectedSchedule?.id) || selectedDaySchedules[0] || null;
  const totalCapacity = totalCapacityData?.totalCapacity ?? visibleSlots.reduce((total, slot) => total + (Number(slot.capacity) || 0), 0);
  const totalBookedSlots = totalCapacityData?.totalBooked ?? visibleSlots.reduce((total, slot) => total + (Number(slot.bookedCount) || 0), 0);
  const classInitial = (selectedClass?.title || "C").trim().charAt(0).toUpperCase();
  const recentBookings = classBookings.slice(0, 4);
  const hasOwnerWorkspace = true; // Use the owner-style class UI for all portals, with member-specific actions hidden by permissions.
  const managedBookings = isMember ? myBookings.filter((booking) => booking.classId === selectedClass?.id) : classBookings;
  const bookingDatesForFilter = [...new Set(managedBookings.map((booking) => toDateInputValue(getBookingDateValue(booking))).filter(Boolean))];
  const filteredBookingRows = managedBookings.filter((booking) => {
    const bookingStatus = String(booking.bookingStatus || "BOOKED").toLowerCase();
    const attendanceStatus = String(booking.attendanceStatus || "PENDING").toLowerCase();
    const memberName = String(booking.memberName || booking.user?.name || booking.classTitle || "").toLowerCase();
    const email = String(booking.memberEmail || booking.user?.email || "").toLowerCase();
    const dateMatches = !bookingDateFilter || toDateInputValue(getBookingDateValue(booking)) === bookingDateFilter;
    const slotMatches = !bookingSlotFilter || booking.slotId === bookingSlotFilter;
    const statusMatches = !bookingStatusFilter || bookingStatus === bookingStatusFilter || attendanceStatus === bookingStatusFilter;
    const searchMatches = !bookingSearch || `${memberName} ${email}`.includes(bookingSearch.toLowerCase());
    return dateMatches && slotMatches && statusMatches && searchMatches;
  });
  const bookingSummary = {
    total: managedBookings.length,
    booked: managedBookings.filter((booking) => !["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase())).length,
    pending: managedBookings.filter((booking) => !booking.attendanceStatus || String(booking.attendanceStatus).toLowerCase() === "pending").length,
    cancelled: managedBookings.filter((booking) => ["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase())).length,
  };

  if (hasOwnerWorkspace) {
    return (
      <div className="grid min-h-[calc(100vh-7rem)] gap-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 bg-gray-50/70 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-gray-950">Classes</h1>
              </div>
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
          {/* <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950">Classes Management</h2>
              <p className="mt-1 text-sm text-gray-500">Manage classes, schedules, slots, bookings and attendance.</p>
            </div>
          </div> */}

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
                  {!isMember && (
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
                  )}
                </div>


              </section>

              <section className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex overflow-x-auto border-b border-gray-200 px-4">
                  {[
                    { key: "classDetails", label: "Class Details", icon: ClipboardCheck },
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

                {activeTab === "classDetails" && (
                  <div className="space-y-4 p-4">
                    <div className="grid gap-4 md:grid-cols-5">
                      {[
                        ["Trainer", selectedClass.trainerName || selectedClass.trainer || "Not assigned"],
                        ["Level", selectedClass.level || "ALL"],
                        ["Duration", selectedClass.duration ? `${selectedClass.duration} mins` : "-"],
                        ["Status", selectedClass.isActive === false ? "Inactive" : "Active"],
                        ["Date Range", `${formatDate(selectedClass.startDate)} - ${formatDate(selectedClass.endDate)}`],
                        ["Bookings", classBookings.length || 0],
                      ].map(([label, value]) => (
                        <div key={label} className="border-gray-200 md:border-l md:pl-4 first:md:border-l-0 first:md:pl-0">
                          <p className="text-[11px] font-medium text-gray-500">{label}</p>
                          <p className="mt-2 truncate text-xs font-semibold text-gray-950">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Class overview</p>
                          <p className="mt-1 text-sm text-gray-700">{selectedClass.description || "No class description added."}</p>
                        </div>
                        <div className="text-sm text-gray-600">
                          {selectedClass.trainerEmail ? <p>Trainer email: {selectedClass.trainerEmail}</p> : null}
                          <p className="mt-1">Schedules: {selectedSchedules.length} • Slots: {visibleSlots.length}</p>
                        </div>
                      </div>
                    </div>
                    {isRecurringClass && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-medium text-gray-500">View availability for date:</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => {
                            setSelectedDate(e.target.value);
                            if (selectedClassIdRef.current) {
                              loadClassDetails(selectedClassIdRef.current, e.target.value);
                            }
                          }}
                          className="h-8 rounded border border-gray-300 px-2 text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}

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
                            <div key={day.value} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => isRecurringClass && setSelectedScheduleDay(day.value)}
                                className={`flex flex-1 items-center gap-3 rounded-md border p-3 text-left ${
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

                            </div>
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
                                scheduleId: isRecurringClass ? activeSlotSchedule?.id || "" : "",
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
                                if (slot?.id) setAssignSlotId(slot.id);
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
                                    {dayName(slot.dayOfWeek || slot.schedule?.dayOfWeek || activeScheduleDay || slot.raw?.dayOfWeek || "") !== "-"
                                      ? `${dayName(slot.dayOfWeek || slot.schedule?.dayOfWeek || activeScheduleDay || slot.raw?.dayOfWeek || "")} • `
                                      : ""}
                                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                  </p>
                                    <p className="mt-2 text-sm text-gray-500">
                                      Capacity: {slot.capacity || "-"} <span className="mx-2">|</span> Booked: {slot.bookedCount} {slot.remainingSpots !== "" ? <><span className="mx-2">|</span> Remaining: {slot.remainingSpots}</> : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded px-3 py-1 text-xs font-semibold ${slot.isFull ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{slot.isFull ? "Full" : "Active"}</span>
                                  {isMember && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleBookClass(selectedClass.id, slot);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                    >
                                      <CalendarCheck size={14} />
                                      Book
                                    </button>
                                  )}
                                  {canManageClasses && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        loadSlotMembers(slot.id);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                      <Users size={14} />
                                      Members
                                    </button>
                                  )}
                                  { !isMember && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleEditSchedule({
                                            ...slot,
                                            classId: selectedClass.id,
                                            scheduleId: slot.scheduleId || slot.schedule?.id || "",
                                            dayOfWeek: slot.schedule?.dayOfWeek,
                                          });
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

                      {slotMembersSlotId && slotMembers.length > 0 && (
                        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-950">Booked Members</h4>
                            <button
                              type="button"
                              onClick={() => { setSlotMembers([]); setSlotMembersSlotId(null); }}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Close
                            </button>
                          </div>
                          <div className="space-y-2">
                            {slotMembers.map((member) => (
                              <div key={member.id || member.userId} className="grid gap-2 rounded-md bg-white p-2 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                                <div>
                                  <p className="font-medium text-gray-950">{member.user?.name || member.name || "Member"}</p>
                                  {member.user?.email && <p className="text-xs text-gray-500">{member.user.email}</p>}
                                </div>
                                <span className="text-xs text-gray-500">
                                  Booking date: {formatDate(getBookingDateValue(member))}
                                </span>
                                <span className={`w-fit rounded px-2 py-0.5 text-xs font-semibold ${getStatusClass(member.status || member.attendanceStatus || "BOOKED")}`}>
                                  {titleCase(member.status || member.attendanceStatus || "BOOKED")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === "details" && (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      {[
                        { label: "Total Bookings", value: classBookings.length || 0, icon: Users, tone: "bg-blue-50 text-blue-700" },
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
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-gray-950">Schedule summary</h4>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200">
                          {selectedSchedules.length} day{selectedSchedules.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {selectedSchedules.length ? (
                          selectedSchedules.map((schedule) => {
                            const scheduleSlots = schedule.slots || [];
                            return (
                              <div key={schedule.id} className="flex flex-col gap-1 rounded-md bg-white p-3 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-semibold text-gray-950">{dayName(schedule.dayOfWeek || schedule.raw?.dayOfWeek || "")}</p>
                                  <p className="text-xs text-gray-500">{scheduleSlots.length} slot{scheduleSlots.length === 1 ? "" : "s"}</p>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {scheduleSlots.length
                                    ? scheduleSlots
                                        .slice(0, 3)
                                        .map((slot) => `${formatTime(slot.startTime)}-${formatTime(slot.endTime)}`)
                                        .join(" • ")
                                    : "No slots"}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-center text-sm text-gray-500">
                            No schedule details available for this class yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "bookings" && (
                  <div className="space-y-4 p-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-950">Bookings</h3>
                      <p className="mt-1 text-xs text-gray-500">Manage members enrolled in this class</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Total Bookings", bookingSummary.total, Users, "border-blue-100 bg-blue-50/40 text-blue-700"],
                        ["Booked", bookingSummary.booked, CheckCircle2, "border-emerald-100 bg-emerald-50/40 text-emerald-700"],
                        ["Pending Attendance", bookingSummary.pending, Clock3, "border-amber-100 bg-amber-50/40 text-amber-700"],
                        ["Cancelled", bookingSummary.cancelled, XCircle, "border-red-100 bg-red-50/40 text-red-700"],
                      ].map(([label, value, metricIcon, tone]) => {
                        const MetricIcon = metricIcon;
                        return <div key={label} className={`flex items-center gap-3 rounded-lg border p-4 ${tone}`}>
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white"><MetricIcon size={18} /></span>
                          <div><p className="text-xl font-bold text-gray-950">{value}</p><p className="text-[11px] text-gray-500">{label}</p></div>
                        </div>;
                      })}
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-[10rem_12rem_10rem_minmax(12rem,1fr)_auto] 2xl:items-end">
                        <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-gray-500">Date
                          <select value={bookingDateFilter} onChange={(event) => setBookingDateFilter(event.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900">
                            <option value="">All dates</option>
                            {bookingDatesForFilter.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
                          </select>
                        </label>
                        <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-gray-500">Slot
                          <select value={bookingSlotFilter} onChange={(event) => setBookingSlotFilter(event.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900">
                            <option value="">All slots</option>
                            {visibleSlots.map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}
                          </select>
                        </label>
                        <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-gray-500">Status
                          <select value={bookingStatusFilter} onChange={(event) => setBookingStatusFilter(event.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900">
                            <option value="">All status</option><option value="booked">Booked</option><option value="pending">Pending</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="cancelled">Cancelled</option>
                          </select>
                        </label>
                        <label className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-500">
                          <Search size={16} /><input value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="Search member..." className="min-w-0 flex-1 bg-transparent outline-none" />
                        </label>
                        {!isMember && <button type="button" onClick={() => {
                          const defaultSlot = visibleSlots.find((slot) => slot.id === (bookingSlotFilter || selectedSlot?.id)) || visibleSlots[0];
                          const nextDate = bookingDateFilter || selectedDate || toDateInputValue();
                          setAssignSlotId(defaultSlot?.id || ""); setAssignBookingDate(nextDate); setAvailableMembers([]); setShowAssignPanel(true);
                          if (defaultSlot?.id) void loadAvailableMembers(defaultSlot.id, nextDate);
                        }} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 xl:w-auto"><Plus size={16} />Assign Member</button>}
                      </div>
                    </div>

                    <div className="overflow-visible rounded-lg border border-gray-200 bg-white">
                      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3"><h4 className="text-sm font-semibold text-gray-950">Booked Members ({filteredBookingRows.length})</h4><span className="text-xs text-gray-500">{isRecurringClass ? formatDate(bookingDateFilter) : "Class bookings"}</span></div>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[760px] text-left text-xs">
                          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Slot</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Booking Status</th><th className="px-4 py-3 font-semibold">Attendance</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredBookingRows.map((booking) => {
                              const bookingKey = booking.id || booking._id || booking.bookingId || `${booking.memberName}-${booking.date}`;
                              const memberEmail = booking.memberEmail || booking.raw?.member?.email || booking.raw?.user?.email || "";
                              const isCancelled = ["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase());
                              return <tr key={bookingKey} className="hover:bg-blue-50/30">
                                <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">{(booking.memberName || "M").charAt(0).toUpperCase()}</span><div><p className="font-semibold text-gray-900">{booking.memberName || booking.classTitle || "Member"}</p>{memberEmail && <p className="mt-0.5 text-[11px] text-gray-500">{memberEmail}</p>}</div></div></td>
                                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(booking.date)}</td>
                                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusClass(booking.bookingStatus)}`}>{titleCase(booking.bookingStatus || "BOOKED")}</span></td>
                                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusClass(booking.attendanceStatus || "PENDING")}`}>{titleCase(booking.attendanceStatus || "PENDING")}</span></td>
                                <td className="relative px-4 py-3 text-right"><button type="button" onClick={() => setOpenBookingActions(openBookingActions === bookingKey ? null : bookingKey)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label={`Actions for ${booking.memberName || "booking"}`}><MoreVertical size={17} /></button>
                                  {openBookingActions === bookingKey && <div className="absolute right-4 top-11 z-20 w-48 rounded-lg border border-gray-200 bg-white p-1 text-left shadow-xl">
                                    {!isMember && canManageClasses && <button type="button" onClick={() => { setAttendanceModalEdit({ bookingId: bookingKey, status: booking.attendanceStatus || "PRESENT" }); setAttendanceModalOpen(true); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><ClipboardCheck size={14} />Mark Attendance</button>}
                                    {!isMember && booking.slotId && <button type="button" onClick={() => { setChangeSlotBooking(booking); setChangeSlotTarget(""); setChangeSlotType("temporary"); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><RefreshCw size={14} />Change Slot</button>}
                                    {!isMember && booking.slotId && <button type="button" onClick={async () => { setSlotHistoryBooking(booking); setSlotChanges([]); setOpenBookingActions(null); await loadBookingSlotChanges(bookingKey); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><CalendarClock size={14} />View Slot History</button>}
                                    {!isCancelled && <button type="button" onClick={() => { void handleCancelBooking(booking); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-red-600 hover:bg-red-50"><XCircle size={14} />Cancel Booking</button>}
                                  </div>}
                                </td>
                              </tr>;
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="divide-y divide-gray-100 md:hidden">
                        {filteredBookingRows.map((booking) => {
                          const bookingKey = booking.id || booking._id || booking.bookingId || `${booking.memberName}-${booking.date}`;
                          const memberEmail = booking.memberEmail || booking.raw?.member?.email || booking.raw?.user?.email || "";
                          const isCancelled = ["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase());
                          return <div key={bookingKey} className="relative p-4">
                            <div className="flex items-start gap-3 pr-8">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{(booking.memberName || "M").charAt(0).toUpperCase()}</span>
                              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{booking.memberName || booking.classTitle || "Member"}</p>{memberEmail && <p className="mt-0.5 truncate text-xs text-gray-500">{memberEmail}</p>}</div>
                              <button type="button" onClick={() => setOpenBookingActions(openBookingActions === bookingKey ? null : bookingKey)} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={`Actions for ${booking.memberName || "booking"}`}><MoreVertical size={17} /></button>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              <div><p className="text-gray-500">Slot</p><p className="mt-1 font-medium text-gray-800">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</p></div>
                              <div><p className="text-gray-500">Date</p><p className="mt-1 font-medium text-gray-800">{formatDate(booking.date)}</p></div>
                              <div><p className="text-gray-500">Booking</p><span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusClass(booking.bookingStatus)}`}>{titleCase(booking.bookingStatus || "BOOKED")}</span></div>
                              <div><p className="text-gray-500">Attendance</p><span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusClass(booking.attendanceStatus || "PENDING")}`}>{titleCase(booking.attendanceStatus || "PENDING")}</span></div>
                            </div>
                            {openBookingActions === bookingKey && <div className="absolute right-3 top-12 z-20 w-48 rounded-lg border border-gray-200 bg-white p-1 text-left shadow-xl">
                              {!isMember && canManageClasses && <button type="button" onClick={() => { setAttendanceModalEdit({ bookingId: bookingKey, status: booking.attendanceStatus || "PRESENT" }); setAttendanceModalOpen(true); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><ClipboardCheck size={14} />Mark Attendance</button>}
                              {!isMember && booking.slotId && <button type="button" onClick={() => { setChangeSlotBooking(booking); setChangeSlotTarget(""); setChangeSlotType("temporary"); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><RefreshCw size={14} />Change Slot</button>}
                              {!isMember && booking.slotId && <button type="button" onClick={async () => { setSlotHistoryBooking(booking); setSlotChanges([]); setOpenBookingActions(null); await loadBookingSlotChanges(bookingKey); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><CalendarClock size={14} />View Slot History</button>}
                              {!isCancelled && <button type="button" onClick={() => { void handleCancelBooking(booking); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-red-600 hover:bg-red-50"><XCircle size={14} />Cancel Booking</button>}
                            </div>}
                          </div>;
                        })}
                      </div>
                      {!filteredBookingRows.length && <p className="border-t border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">No bookings match these filters.</p>}
                    </div>

                    {showAssignPanel && <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setShowAssignPanel(false)}><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-gray-950">Assign Member</h3><p className="mt-1 text-xs text-gray-500">Only members available for this slot and date are shown.</p></div><button type="button" onClick={() => setShowAssignPanel(false)} className="text-gray-400 hover:text-gray-700" aria-label="Close"><XCircle size={18} /></button></div><div className="mt-5 grid gap-3"><label className="grid gap-1 text-xs font-semibold text-gray-600">Date<input type="date" value={assignBookingDate} onChange={(event) => setAssignBookingDate(event.target.value)} className="h-10 rounded-md border border-gray-300 px-3 text-sm font-normal" /></label><label className="grid gap-1 text-xs font-semibold text-gray-600">Time Slot<select value={assignSlotId} onChange={(event) => { setAssignSlotId(event.target.value); setAvailableMembers([]); }} className="h-10 rounded-md border border-gray-300 px-3 text-sm font-normal"><option value="">Select slot</option>{visibleSlots.map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}</select></label><button type="button" onClick={() => void loadAvailableMembers(assignSlotId, assignBookingDate)} disabled={!assignSlotId || saving} className="h-10 rounded-md border border-blue-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">Find Available Members</button></div><div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{availableMembers.map((member) => <div key={member.id || member.userId} className="flex items-center justify-between rounded-md border border-gray-200 p-3"><div><p className="text-sm font-semibold text-gray-900">{member.name || member.fullName}</p><p className="text-xs text-gray-500">{member.email}</p></div><button type="button" onClick={() => void handleAssignMember(member.id || member.userId)} disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Assign</button></div>)}{assignSlotId && !availableMembers.length && <p className="py-5 text-center text-xs text-gray-500">Find available members for this slot.</p>}</div></div></div>}

                    {changeSlotBooking && <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-gray-950">Change Slot</h3><p className="mt-1 text-xs text-gray-500">{changeSlotBooking.memberName || "Member"}</p></div><button type="button" onClick={() => setChangeSlotBooking(null)} className="text-gray-400 hover:text-gray-700" aria-label="Close"><XCircle size={18} /></button></div><div className="mt-5 space-y-4"><div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">Current slot: <span className="font-semibold text-gray-900">{formatTime(changeSlotBooking.startTime)} - {formatTime(changeSlotBooking.endTime)}</span></div><label className="grid gap-1 text-xs font-semibold text-gray-600">Change to<select value={changeSlotTarget} onChange={(event) => setChangeSlotTarget(event.target.value)} className="h-10 rounded-md border border-gray-300 px-3 text-sm font-normal"><option value="">Select new slot</option>{visibleSlots.filter((slot) => slot.id && slot.id !== changeSlotBooking.slotId).map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}</select></label><div className="space-y-2"><p className="text-xs font-semibold text-gray-600">Change type</p><label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-xs"><input type="radio" checked={changeSlotType === "temporary"} onChange={() => setChangeSlotType("temporary")} /> <span><strong>This date only</strong><span className="block text-gray-500">Temporary change</span></span></label><label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-xs"><input type="radio" checked={changeSlotType === "permanent"} onChange={() => setChangeSlotType("permanent")} /> <span><strong>Permanently change slot</strong><span className="block text-gray-500">Future booking slot</span></span></label></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setChangeSlotBooking(null)} className="rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700">Cancel</button><button type="button" disabled={!changeSlotTarget || saving} onClick={async () => { await handleSlotChange(changeSlotBooking.id || changeSlotBooking.bookingId, changeSlotTarget, changeSlotType === "permanent"); setChangeSlotBooking(null); }} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirm Change</button></div></div></div>}
                    {changeSlotBooking && <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-gray-950">Change Slot</h3><p className="mt-1 text-xs text-gray-500">{changeSlotBooking.memberName || "Member"}</p></div><button type="button" onClick={() => setChangeSlotBooking(null)} className="text-gray-400 hover:text-gray-700" aria-label="Close"><XCircle size={18} /></button></div><div className="mt-5 space-y-4"><div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">Current slot: <span className="font-semibold text-gray-900">{formatTime(changeSlotBooking.startTime)} - {formatTime(changeSlotBooking.endTime)}</span></div><label className="grid gap-1 text-xs font-semibold text-gray-600">Change to<select value={changeSlotTarget} onChange={(event) => setChangeSlotTarget(event.target.value)} className="h-10 rounded-md border border-gray-300 px-3 text-sm font-normal"><option value="">Select new slot</option>{visibleSlots.filter((slot) => slot.id && slot.id !== changeSlotBooking.slotId).map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}</select></label><div className="space-y-2"><p className="text-xs font-semibold text-gray-600">Change type</p><label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-xs"><input type="radio" checked={changeSlotType === "temporary"} onChange={() => setChangeSlotType("temporary")} /> <span><strong>This date only</strong><span className="block text-gray-500">Temporary change</span></span></label><label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-xs"><input type="radio" checked={changeSlotType === "permanent"} onChange={() => setChangeSlotType("permanent")} /> <span><strong>Permanently change slot</strong><span className="block text-gray-500">Future booking slot</span></span></label></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setChangeSlotBooking(null)} className="rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700">Cancel</button><button type="button" disabled={!changeSlotTarget || saving} onClick={async () => { await handleSlotChange(changeSlotBooking.id || changeSlotBooking.bookingId, changeSlotTarget, changeSlotType === "permanent"); setChangeSlotBooking(null); }} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirm Change</button></div></div></div>}
                    {slotHistoryBooking && <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-gray-950">Slot Change History</h3><p className="mt-1 text-xs text-gray-500">{slotHistoryBooking.memberName || "Member"} · {formatDate(slotHistoryBooking.date)}</p></div><button type="button" onClick={() => { setSlotHistoryBooking(null); setSlotChanges([]); }} className="text-gray-400 hover:text-gray-700" aria-label="Close"><XCircle size={18} /></button></div><div className="mt-5 max-h-80 space-y-2 overflow-y-auto">{slotChanges.length ? slotChanges.map((change) => <div key={change.id || `${change.bookingId}-${change.createdAt}`} className="rounded-md border border-gray-200 p-3 text-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-gray-900">{change.isPermanent ? "Permanent" : "Temporary"} slot change</p>{change.createdAt && <span className="text-xs text-gray-500">{formatDate(change.createdAt)}</span>}</div><p className="mt-2 text-xs text-gray-600">{formatSlotRange(change.oldSlot || change.previousSlot)} <span className="mx-1">→</span> {formatSlotRange(change.newSlot || change.nextSlot)}</p>{change.date && <p className="mt-1 text-xs text-gray-500">Booking date: {formatDate(change.date)}</p>}</div>) : <p className="py-8 text-center text-sm text-gray-500">No slot changes found for this booking.</p>}</div><div className="mt-5 flex justify-end"><button type="button" onClick={() => { setSlotHistoryBooking(null); setSlotChanges([]); }} className="rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700">Close</button></div></div></div>}
                  </div>
                )}

                {activeTab === "__legacy_bookings__" && (
                  <div className="space-y-4 p-4">
                    {!isMember && (
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                          <div className="grid flex-1 gap-2">
                            <label className="text-xs font-semibold uppercase text-gray-500">Booked members by slot</label>
                            <select
                              value={slotMembersSlotId || ""}
                              onChange={(e) => {
                                const slotId = e.target.value;
                                if (slotId) {
                                  loadSlotMembers(slotId);
                                  setAssignSlotId(slotId);
                                } else {
                                  setSlotMembers([]);
                                  setAssignSlotId("");
                                }
                              }}
                              className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                              <option value="">Select a slot to view members</option>
                              {visibleSlots.map((slot) => (
                                <option key={slot.id} value={slot.id}>
                                  {isRecurringClass ? dayName(slot.dayOfWeek) + " - " : ""}{formatTime(slot.startTime)} - {formatTime(slot.endTime)} ({slot.bookedCount || 0} booked)
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !showAssignPanel;
                              setShowAssignPanel(next);
                              if (next) {
                                // initialize defaults when opening the panel
                                const defaultSlot = slotMembersSlotId
                                  ? visibleSlots.find((s) => s.id === slotMembersSlotId)
                                  : selectedSlot || visibleSlots[0];
                                setAssignSlotId((current) => current || (defaultSlot ? defaultSlot.id : ""));
                                if (isRecurringClass) {
                                  setAssignBookingDate((current) => current || selectedDate || toDateInputValue());
                                } else {
                                  const slotDate = defaultSlot?.date || selectedClass?.startDate;
                                  setAssignBookingDate((current) => current || toDateInputValue(slotDate));
                                }
                              }
                            }}
                            className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition ${
                              showAssignPanel
                                ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                          >
                            {showAssignPanel ? <XCircle size={16} /> : <Plus size={16} />}
                            {showAssignPanel ? "Close Assign" : "Assign member"}
                          </button>
                        </div>
                      </div>
                    )}

                    {!isMember && showAssignPanel && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-base font-semibold text-gray-950">Assign member</h4>
                            <p className="mt-1 text-sm text-gray-500">Add an available member to this class slot.</p>
                          </div>
                          <span className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            {selectedClass?.name || "Selected class"}
                          </span>
                        </div>
                        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_12rem_auto] lg:items-end">
                          <div className="grid gap-2">
                            <label className="text-xs font-semibold uppercase text-gray-500">Class slot</label>
                            <select
                              value={assignSlotId}
                              onChange={(e) => {
                                const slotId = e.target.value;
                                setAssignSlotId(slotId);
                                if (!isRecurringClass && slotId) {
                                  const slot = visibleSlots.find(s => s.id === slotId);
                                  const slotDate = slot?.date || selectedClass?.startDate;
                                  if (slotDate) setAssignBookingDate(toDateInputValue(slotDate));
                                }
                              }}
                              className="h-11 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            >
                              <option value="">Select slot</option>
                              {visibleSlots.map((slot) => (
                                <option key={slot.id} value={slot.id}>
                                  {isRecurringClass ? dayName(slot.dayOfWeek) + " - " : ""}{formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {isRecurringClass && (
                            <div className="grid gap-2">
                              <label className="text-xs font-semibold uppercase text-gray-500">Booking date</label>
                              <input
                                type="date"
                                value={assignBookingDate}
                                onChange={(e) => setAssignBookingDate(e.target.value)}
                                className="h-11 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => loadAvailableMembers(assignSlotId, assignBookingDate)}
                            disabled={!assignSlotId || saving}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Users size={16} />
                            Load Available Members
                          </button>
                        </div>
                        {availableMembers.length > 0 && (
                          <div className="space-y-2">
                            {availableMembers.map((member) => (
                              <div key={member.id || member.userId} className="flex flex-col gap-3 rounded-md bg-white p-3 text-sm ring-1 ring-emerald-100 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-medium text-gray-950">{member.name || member.fullName}</p>
                                  <p className="text-xs text-gray-500">{member.email}{member.phoneNumber ? ` • ${member.phoneNumber}` : ""}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAssignMember(member.id || member.userId)}
                                  disabled={saving}
                                  className="inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  <Plus size={14} />
                                  Assign to class
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {!assignSlotId && (
                          <p className="rounded-md border border-dashed border-emerald-200 bg-white/70 p-4 text-center text-sm text-gray-500">Choose a slot to find members who can be assigned.</p>
                        )}
                        {assignSlotId && availableMembers.length === 0 && (
                          <p className="rounded-md border border-dashed border-emerald-200 bg-white/70 p-4 text-center text-sm text-gray-500">No available members are loaded for this slot yet.</p>
                        )}
                      </div>
                    )}

                    {!isMember && slotMembersSlotId && slotMembers.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-950">Booked Members</h4>
                          <button
                            type="button"
                            onClick={() => loadSlotAttendance(slotMembersSlotId)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            <ClipboardCheck size={14} />
                            View Attendance
                          </button>
                        </div>
                        <div className="space-y-2">
                          {slotMembers.map((member) => (
                            <div key={member.id || member.userId} className="grid gap-2 rounded-md bg-white p-2 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                              <span className="font-medium text-gray-950">{member.user?.name || member.name || "Member"}</span>
                              <span className="text-xs text-gray-500">
                                Booking date: {formatDate(getBookingDateValue(member))}
                              </span>
                              <span className={`w-fit rounded px-2 py-0.5 text-xs font-semibold ${getStatusClass(member.status || member.attendanceStatus || "BOOKED")}`}>
                                {titleCase(member.status || member.attendanceStatus || "BOOKED")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isMember && slotAttendanceSlotId === slotMembersSlotId && slotAttendanceRecords.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-950">Slot Attendance</h4>
                          <button
                            type="button"
                            onClick={() => { setSlotAttendanceRecords([]); setSlotAttendanceSlotId(null); }}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Close
                          </button>
                        </div>
                        <div className="space-y-2">
                          {slotAttendanceRecords.map((record) => (
                            <div key={record.id || record.bookingId} className="grid gap-2 rounded-md bg-white p-2 text-sm md:grid-cols-[1fr_auto] md:items-center">
                              <span className="font-medium text-gray-950">{record.booking?.user?.name || record.user?.name || record.memberName || "Member"}</span>
                              <span className={`w-fit rounded px-2 py-0.5 text-xs font-semibold ${getStatusClass(record.status)}`}>
                                {titleCase(record.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {(isMember ? myBookings.filter((b) => b.classId === selectedClass?.id) : classBookings).map((booking) => {
                        const bookingKey = booking.id || booking._id || booking.bookingId || "";
                        const selectedSlotChangeTarget = slotChangeTargets[bookingKey] || "";

                        return (
                          <div key={bookingKey || booking.memberName || booking.classTitle} className="rounded-lg border border-gray-200 p-3 text-sm">
                            <div className="grid gap-2 md:grid-cols-[1fr_16rem_10rem_auto] md:items-center">
                              <span className="font-semibold text-gray-950">{booking.memberName || booking.classTitle}</span>
                              <span className="text-gray-500">{(booking.dayOfWeek || slotDayOfWeek[booking.slotId]) ? dayName(booking.dayOfWeek || slotDayOfWeek[booking.slotId]) + " - " : ""}{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                              <span className="text-gray-500">{formatDate(booking.date)}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`w-fit rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.bookingStatus)}`}>{titleCase(booking.bookingStatus)}</span>
                                {booking.attendanceStatus && (
                                  <span className={`w-fit rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.attendanceStatus)}`}>
                                    {titleCase(booking.attendanceStatus)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {bookingKey && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {!['cancelled', 'canceled'].includes(String(booking.bookingStatus).toLowerCase()) && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelBooking(booking)}
                                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    <XCircle size={14} />
                                    Cancel
                                  </button>
                                )}
                                {!isMember && canManageClasses && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAttendanceModalEdit({
                                        bookingId: bookingKey,
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
                                {!isMember && booking.slotId && (
                                  <>
                                    <select
                                      value={selectedSlotChangeTarget}
                                      onChange={(event) => setSlotChangeTargets((current) => ({ ...current, [bookingKey]: event.target.value }))}
                                      className="h-8 rounded border border-gray-300 px-2 text-xs outline-none"
                                    >
                                      <option value="">Select new slot</option>
                                      {visibleSlots
                                        .filter((slot) => slot.id && slot.id !== booking.slotId)
                                        .map((slot) => (
                                          <option key={slot.id} value={slot.id}>
                                            {isRecurringClass ? dayName(slot.dayOfWeek) + " - " : ""}{formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                          </option>
                                        ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => void handleSlotChange(bookingKey, selectedSlotChangeTarget, false)}
                                      disabled={saving || !selectedSlotChangeTarget}
                                      className="inline-flex items-center gap-1 rounded-md border border-blue-300 px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                                    >
                                      Temporary
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleSlotChange(bookingKey, selectedSlotChangeTarget, true)}
                                      disabled={saving || !selectedSlotChangeTarget}
                                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                    >
                                      Permanent
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void loadBookingSlotChanges(bookingKey)}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                      <RefreshCw size={14} />
                                      Slot Changes
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {(!isMember ? !classBookings.length : !myBookings.filter((b) => b.classId === selectedClass?.id).length) && (
                        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No bookings found.</p>
                      )}
                    </div>

                    {slotChanges.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-950">Slot Change History</h4>
                          <button
                            type="button"
                            onClick={() => setSlotChanges([])}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Close
                          </button>
                        </div>
                        <div className="space-y-2">
                          {slotChanges.map((change) => (
                            <div key={change.id || `${change.bookingId}-${change.createdAt}`} className="rounded-md bg-white p-3 text-sm">
                              <p className="hidden">
                                {change.isPermanent ? "Permanent" : "Temporary"} change: {formatTime(change.oldSlotId)} → {formatTime(change.newSlotId)}
                              </p>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold text-gray-950">
                                  {change.isPermanent ? "Permanent" : "Temporary"} slot change
                                </p>
                                {change.createdAt && (
                                  <span className="text-xs text-gray-500">
                                    {formatDate(change.createdAt)} {formatTime(change.createdAt)}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <div className="rounded-md border border-gray-200 p-2">
                                  <p className="text-xs font-semibold uppercase text-gray-500">Old slot</p>
                                  <p className="mt-1 text-gray-900">{formatSlotRange(change.oldSlot || change.previousSlot)}</p>
                                  {(change.oldSlot || change.previousSlot)?.capacity !== undefined && (
                                    <p className="mt-1 text-xs text-gray-500">Capacity: {(change.oldSlot || change.previousSlot).capacity}</p>
                                  )}
                                </div>
                                <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-2">
                                  <p className="text-xs font-semibold uppercase text-emerald-700">New slot</p>
                                  <p className="mt-1 text-gray-900">{formatSlotRange(change.newSlot || change.nextSlot)}</p>
                                  {(change.newSlot || change.nextSlot)?.capacity !== undefined && (
                                    <p className="mt-1 text-xs text-gray-500">Capacity: {(change.newSlot || change.nextSlot).capacity}</p>
                                  )}
                                </div>
                              </div>
                              {change.date && <p className="mt-2 text-xs text-gray-500">Booking date: {formatDate(change.date)}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "attendance" && (
                  <div className="space-y-2 p-4">
                    {classAttendance.map((record) => (
                      <div key={record.id || `${record.memberName}-${record.timestamp}`} className="grid gap-3 rounded-lg border border-gray-200 p-3 text-sm md:grid-cols-[1fr_10rem_auto] md:items-center">
                        <span className="font-semibold text-gray-950">{record.memberName}</span>
                        <span className="text-gray-500">{record.attendanceDate ? formatDate(record.attendanceDate) + " " + formatTime(record.attendanceDate) : record.trainerName || "-"}</span>
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
          Reload
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
                          onClick={() => { setSelectedSlot(slot); if (slot?.id) setAssignSlotId(slot.id); }}
                          className={`cursor-pointer rounded-md border p-3 transition hover:bg-gray-50 ${
                            isSelectedSlot ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-950">
                            <Clock3 size={14} className="mr-1 inline" />
                            {slot.date ? `${formatDate(slot.date)} | ` : ""}{formatTime(slot.startTime)} - {formatTime(slot.endTime)}
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
                                    setScheduleModalPurpose("edit");
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
                                            {slot.date ? `${formatDate(slot.date)} | ` : ""}{formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                          </p>
                                          <p className="mt-2 text-sm text-gray-700">Capacity: {slot.capacity || "-"}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {canManageClasses && !isMember && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleEditSchedule({
                                                    ...slot,
                                                    classId: selectedClass.id,
                                                    scheduleId: slot.scheduleId || schedule.id || "",
                                                    dayOfWeek: schedule.dayOfWeek,
                                                  });
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
                    <button onClick={() => { setScheduleModalEdit(null); setScheduleModalPurpose("slot"); setScheduleModalOpen(true); }} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.bookingStatus)}`}>
                      {titleCase(booking.bookingStatus)}
                    </span>
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
                  </div>
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
                  <p className="mt-1 truncate text-sm text-gray-500">{record.attendanceDate ? formatDate(record.attendanceDate) + " " + formatTime(record.attendanceDate) : record.trainerName || "-"}</p>
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
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusClass(booking.bookingStatus)}`}>
                          {titleCase(booking.bookingStatus)}
                        </span>
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
                      </div>
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
                      <p className="mt-1 truncate text-sm text-gray-500">{record.attendanceDate ? formatDate(record.attendanceDate) + " " + formatTime(record.attendanceDate) : record.trainerName || "-"}</p>
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
