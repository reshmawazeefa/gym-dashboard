import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Edit,
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
import StatusBadge from "../components/StatusBadge";
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
  updateClassSchedule,
  updateClass,
  updateClassSlot,
} from "../services/api";
import ClassModal from "../components/ClassModal";
import ScheduleModal from "../components/ScheduleModal";
import MarkAttendanceModal from "../components/MarkAttendanceModal";
import AssignMemberModal from "../components/AssignMemberModal";
import ChangeSlotModal from "../components/ChangeSlotModal";
import SlotChangesModal from "../components/SlotChangesModal";

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

function getId(item) {
  return item?.id || item?._id || item?.classId || item?.bookingId || item?.scheduleId || "";
}

function getUserId(user) {
  return user?.id || user?._id || user?.userId || user?.email || "";
}

const legacyBookingModalMarkupEnabled = false;

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
    isActive: item.isActive ?? item.active ?? String(item.status || "").toUpperCase() !== "INACTIVE",
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

function normalizeAttendanceStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "present" || normalized === "attended") return "PRESENT";
  if (normalized === "late") return "LATE";
  if (normalized === "absent") return "ABSENT";
  return "PENDING";
}

function normalizeAttendance(item = {}) {
  const booking = item.booking || {};
  const user = booking.user || item.user || {};
  
  return {
    id: getId(item) || `${item.userId || item.memberId || booking.userId || ""}-${item.createdAt || item.timestamp || item.markedAt || ""}`,
    memberName: item.memberName || item.member?.name || user.name || user.fullName || "Member",
    trainerName: item.trainerName || item.trainer?.name || item.markedByUser?.name || "",
    status: normalizeAttendanceStatus(item.status || item.attendanceStatus),
    attendanceDate: item.attendanceDate || item.markedAt || item.timestamp || "",
    timestamp: item.timestamp || item.createdAt || item.markedAt || "",
    bookingId: item.bookingId || booking.id || "",
    raw: item,
  };
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
  const [scheduleSlotStates, setScheduleSlotStates] = useState({});
  const [classSlotState, setClassSlotState] = useState({ loading: false, error: "" });
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

  const fetchScheduleSlots = useCallback(async (scheduleId) => {
    if (!scheduleId) return [];

    setScheduleSlotStates((current) => ({ ...current, [scheduleId]: { loading: true, error: "" } }));
    try {
      const response = await getSlotsBySchedule(scheduleId, authToken);
      const slots = unwrapMaybeList(response, ["slots", "classSlots"]).map((item) => {
        const slot = normalizeSlot(item);
        return { ...slot, scheduleId: slot.scheduleId || scheduleId };
      });
      setScheduleSlotStates((current) => ({ ...current, [scheduleId]: { loading: false, error: "" } }));
      return slots;
    } catch (error) {
      const message = getApiError(error, "Unable to load slots for this schedule");
      setScheduleSlotStates((current) => ({
        ...current,
        [scheduleId]: { loading: false, error: message },
      }));
      toast.error(message);
      throw error;
    }
  }, [authToken]);

  const refreshScheduleSlots = useCallback(async (schedule) => {
    if (!schedule?.id) return;
    try {
      const slots = await fetchScheduleSlots(schedule.id);
      setSelectedClass((current) => current?.id === selectedClassIdRef.current
        ? { ...current, schedules: current.schedules.map((item) => item.id === schedule.id ? { ...item, slots } : item) }
        : current);
      setSelectedSchedule((current) => current?.id === schedule.id ? { ...current, slots } : current);
    } catch {
      setSelectedClass((current) => current?.id === selectedClassIdRef.current
        ? { ...current, schedules: current.schedules.map((item) => item.id === schedule.id ? { ...item, slots: [] } : item) }
        : current);
      setSelectedSchedule((current) => current?.id === schedule.id ? { ...current, slots: [] } : current);
    }
  }, [fetchScheduleSlots]);

  const loadClassDetails = useCallback(async (classId, date) => {
    if (!classId) return;
    const queryDate = date || selectedDate;
    setClassSlotState({ loading: true, error: "" });

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
      setClassSlotState(slotsResponse.status === "fulfilled"
        ? { loading: false, error: "" }
        : { loading: false, error: getApiError(slotsResponse.reason, "Unable to load class slots") });
      if (slotsResponse.status === "rejected") {
        toast.error(getApiError(slotsResponse.reason, "Unable to load class slots"));
      }

      if (detailResponse.status === "fulfilled") {
        const detail = normalizeClass(unwrapObject(detailResponse.value));
        // Prefer detail.schedules from getClassById which already has slots with bookedCount
        const baseSchedules = detail.schedules.length ? detail.schedules : apiSchedules.length ? apiSchedules : [];
        let schedulesWithSlots = await Promise.all(
          baseSchedules.map(async (schedule) => {
            if (!schedule.id) return schedule;

            try {
              return { ...schedule, slots: await fetchScheduleSlots(schedule.id) };
            } catch {
              return { ...schedule, slots: [] };
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

        const standaloneSlots = slotsResponse.status === "fulfilled"
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
          const allSlots = slotsResponse.status === "fulfilled"
            ? apiSlots
            : [
                ...(fullDetail.schedules || []).flatMap((schedule) => schedule.slots || []),
                ...(fullDetail.slots || []),
              ];
          const totalCap = allSlots.reduce((total, slot) => total + (Number(slot.capacity) || 0), 0);
          const totalBooked = allSlots.reduce((total, slot) => total + (slotBookings[slot.id] ?? (Number(slot.bookedCount) || 0)), 0);
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
  }, [authToken, canManageClasses, fetchScheduleSlots, selectedDate]);

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
    setScheduleSlotStates({});
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

  const handleEditScheduleDay = (schedule) => {
    setScheduleModalEdit({ ...schedule, classId: selectedClass?.id || schedule.classId });
    setScheduleModalPurpose("schedule");
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
      const classId = selectedClassIdRef.current || selectedClass?.id;
      if (classId) await loadClassDetails(classId);
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
  const [slotMembersLoading, setSlotMembersLoading] = useState(false);
  const [slotMembersError, setSlotMembersError] = useState("");
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
    setSlotMembersLoading(true);
    setSlotMembersError("");
    setSlotMembers([]);
    setSlotMembersSlotId(slotId);
    try {
      const response = await getSlotMembers(slotId, authToken);
      setSlotMembers(unwrapMaybeList(response, ["members", "bookings"]));
      setSlotMembersSlotId(slotId);
    } catch (error) {
      const message = getApiError(error, "Could not load slot members");
      setSlotMembersError(message);
      toast.error(message);
    } finally {
      setSlotMembersLoading(false);
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
    if (!canDeleteClass) {
      toast.error("You do not have permission to delete class schedules");
      return;
    }

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
    const isScheduleEdit = scheduleModalPurpose === "schedule" && Boolean(scheduleModalEdit?.id);
    const hasSchedulePermission = isScheduleEdit ? canEditClass : canCreateClass;
    
    if (!hasSchedulePermission || !allowedRoles.includes(userRole)) {
      toast.error("Only trainers, admins, and owners can schedule classes");
      return false;
    }

    try {
      setSaving(true);
      if (scheduleModalPurpose === "schedule") {
        if (scheduleModalEdit?.id) {
          await updateClassSchedule(
            scheduleModalEdit.id,
            { dayOfWeek: payload.dayOfWeek },
            authToken
          );
          toast.success("Schedule updated");
        } else {
          await createClassSchedule(
            payload.classId,
            { dayOfWeek: payload.dayOfWeek },
            authToken
          );
          toast.success("Schedule created");
        }
      } else {
        if (scheduleModalEdit?.id && (scheduleModalEdit.startTime || scheduleModalEdit.raw?.startTime)) {
          const existingSlot = [
            ...(selectedClass?.schedules || []).flatMap((schedule) => schedule.slots || []),
            ...(selectedClass?.slots || []),
          ].find((slot) => slot.id === scheduleModalEdit.id) || scheduleModalEdit;
          const changes = {};
          if (payload.startTime !== existingSlot.startTime) changes.startTime = payload.startTime;
          if (payload.endTime !== existingSlot.endTime) changes.endTime = payload.endTime;
          if (Number(payload.maxCapacity) !== Number(existingSlot.capacity ?? existingSlot.maxCapacity)) {
            changes.capacity = Number(payload.maxCapacity);
          }
          if (Object.keys(changes).length) {
            await updateClassSlot(scheduleModalEdit.id, changes, authToken);
          }
          toast.success(Object.keys(changes).length ? "Slot updated" : "No slot changes to save");
        } else {
          const body = {
            startTime: payload.startTime,
            endTime: payload.endTime,
            capacity: Number(payload.maxCapacity),
            ...(payload.scheduleId && { scheduleId: payload.scheduleId }),
          };
          await createClassSlot(payload.classId, body, authToken);
          toast.success(payload.scheduleId ? "Schedule slot created" : "Class slot created");
        }
      }
      setScheduleModalEdit(null);
      setScheduleModalOpen(false);
      await loadClassDetails(payload.classId || selectedClassIdRef.current);
      return true;
    } catch (error) {
      toast.error(getApiError(error, "Could not save slot"));
      return false;
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
  const activeSlotSchedule = selectedDaySchedules.find((schedule) => schedule.id === selectedSchedule?.id) || selectedDaySchedules[0] || null;
  const selectedDaySlots = isRecurringClass
    ? (activeSlotSchedule?.slots || []).map((slot) => ({ ...slot, schedule: activeSlotSchedule }))
    : oneTimeSlots.map((slot) => ({ ...slot, schedule: null }));
  const selectedDaySlotLoading = isRecurringClass
    ? Boolean(activeSlotSchedule && scheduleSlotStates[activeSlotSchedule.id]?.loading)
    : classSlotState.loading;
  const selectedDaySlotError = isRecurringClass
    ? activeSlotSchedule ? scheduleSlotStates[activeSlotSchedule.id]?.error : ""
    : classSlotState.error;
  const canAddSchedule = isRecurringClass || selectedSchedules.length === 0;
  const activeSchedules = selectedSchedules.filter((schedule) => schedule.isActive !== false);
  const canAddSlot = !isRecurringClass || activeSchedules.length > 0;
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
  const attendanceSummary = classAttendance.reduce((summary, record) => {
    const status = normalizeAttendanceStatus(record.status);
    summary[status] += 1;
    return summary;
  }, { PRESENT: 0, LATE: 0, ABSENT: 0, PENDING: 0 });

  if (hasOwnerWorkspace) {
    return (
      <div className="min-h-full bg-[#F7F8FA] p-3 text-[#1E293B] sm:p-4">
        <div className="mx-auto w-full max-w-7xl space-y-3">
          <header className="flex items-start justify-between gap-3 px-0.5">
            <div>
              <h1 className="text-2xl font-extrabold leading-6 tracking-tight text-[#020617]">Class Management</h1>
              <p className="mt-1 text-xs text-[#64748B]">Browse scheduled classes, manage syllabus &amp; trainers, and monitor member enrollments.</p>
            </div>
          </header>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(250px,0.295fr)_minmax(0,0.705fr)]">
        <aside className="rounded-xl border border-[#E5EAF0] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
          <div className="px-3 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold leading-5 text-[#0F172A]">Classes</h2>
              </div>
              <p className="mt-0.5 text-[10px] text-[#64748B]">
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0D8252] px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#086B43]"
                >
                  <Plus size={12} />
                  Create Class
                </button>
              )}
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 focus-within:border-[#0D8252] focus-within:bg-white">
            <Search size={14} className="text-[#94A3B8]" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search classes..."
              className="h-7 w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-[#94A3B8]"
            />
          </div>

          <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-0.5">
            {filteredClasses.map((classItem, index) => {
              const isSelected = selectedClass?.id === classItem.id;
              const tone = ["bg-[#EEF4FF] text-[#477BFF]", "bg-rose-50 text-rose-500", "bg-emerald-50 text-[#0D8252]", "bg-amber-50 text-amber-600"][index % 4];
              return (
                <button
                  type="button"
                  key={classItem.id || classItem.title}
                  onClick={() => handleSelectClass(classItem)}
                  className={`flex min-h-14 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                    isSelected ? "border-[#0D8252] bg-emerald-50/30 shadow-[0_1px_4px_rgba(13,130,82,0.08)]" : "border-[#E4EAF1] bg-white hover:border-emerald-200 hover:bg-emerald-50/20"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                    <ListChecks size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[#0F172A]">{classItem.title}</span>
                    <span className="mt-0.5 block text-[10px] text-[#94A3B8]">
                      {classItem.bookedCount || 0} Bookings
                    </span>
                  </span>
                </button>
              );
            })}
            {!filteredClasses.length && (
              <p className="rounded-xl border border-dashed border-[#DDE5EF] bg-[#FBFCFD] p-4 text-center text-xs text-[#64748B]">
                {loading ? "Loading classes..." : "No classes found"}
              </p>
            )}
          </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-3">
          {/* <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950">Classes Management</h2>
              <p className="mt-1 text-sm text-gray-500">Manage classes, schedules, slots, bookings and attendance.</p>
            </div>
          </div> */}

          {!selectedClass?.id ? (
            <div className="rounded-2xl border border-dashed border-[#DDE5EF] bg-white p-8 text-center text-sm text-[#64748B]">
              Select a class to manage schedules and bookings.
            </div>
          ) : (
            <>
              <section className="mb-0 rounded-tl-xl rounded-tr-xl border border-b-0 border-[#E5EAF0] bg-white p-3 shadow-[0_1px_4px_rgba(15,23,42,0.06)] sm:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                      {/* <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-lg shadow-blue-200">
                        {classInitial}
                      </div> */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-bold tracking-tight text-[#0F172A]">{selectedClass.title}</h3>
                          <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#477BFF]">
                            {titleCase(selectedClassType)}
                          </span>
                        </div>
                        <p className="mt-1 max-w-3xl text-[10px] leading-4 text-[#64748B]">{selectedClass.description || "No class description added."}</p>
                      </div>
                    </div>
                  {!isMember && (
                    <div className="flex flex-wrap gap-2">
                      {canEditClass && (
                        <button
                          type="button"
                          onClick={() => handleEditClass(selectedClass)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] transition hover:border-[#0D8252] hover:bg-emerald-50 hover:text-[#0D8252]"
                          aria-label="Edit class"
                        >
                          <Edit size={15} />
                        </button>
                      )}
                      {canDeleteClass && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClass(selectedClass.id)}
                          disabled={saving}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 text-rose-500 transition hover:bg-rose-50 disabled:opacity-60"
                          aria-label="Delete class"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>


              </section>

              <section className="overflow-hidden rounded-bl-xl rounded-br-xl border border-[#E5EAF0] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
                <div className="grid grid-cols-2 gap-1 border-b border-[#EEF2F4] p-1 sm:grid-cols-5">
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
                        onClick={() => {
                          setActiveTab(tab.key);
                          if (tab.key === "schedules" && isRecurringClass && activeSlotSchedule) {
                            void refreshScheduleSlots(activeSlotSchedule);
                          }
                        }}
                        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition ${
                          activeTab === tab.key
                            ? "bg-[#0D8252] text-white shadow-sm"
                            : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                        }`}
                      >
                        <TabIcon size={13} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {activeTab === "classDetails" && (
                  <div className="space-y-3 p-3 sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["Trainer", selectedClass.trainerName || selectedClass.trainer || "Not assigned"],
                        ["Level", selectedClass.level || "ALL"],
                        ["Duration", selectedClass.duration ? `${selectedClass.duration} mins` : "-"],
                        ["Status", selectedClass.isActive === false ? "Inactive" : "Active"],
                        ["Date Range", `${formatDate(selectedClass.startDate)} - ${formatDate(selectedClass.endDate)}`],
                        ["Bookings", classBookings.length || 0],
                      ].map(([label, value]) => (
                        <div key={label} className="min-h-[68px] rounded-xl border border-[#E8EDF2] bg-[#FBFCFD] px-3 py-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</p>
                          <p className={`mt-1 truncate text-[12px] font-semibold ${label === "Status" ? (value === "Active" ? "text-[#0D8252]" : "text-rose-600") : "text-[#0F172A]"}`}>
                            {label === "Status" && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />}
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 rounded-xl border border-[#E8EDF2] bg-[#FBFCFD] p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_10rem] lg:gap-4">
                      <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Class overview</p>
                          <p className="mt-1 text-[11px] leading-4 text-[#475569]">{selectedClass.description || "No class description added."}</p>
                      </div>
                      <div className="grid gap-2 border-t border-[#E8EDF2] pt-3 text-[10px] text-[#64748B] sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        {selectedClass.trainerEmail ? (
                          <div className="flex items-center justify-between gap-2 lg:block">
                            <p className="text-[10px] uppercase text-[#94A3B8]">Trainer email:</p>
                            <p className="truncate text-xs font-semibold text-[#0F172A]">{selectedClass.trainerEmail}</p>
                          </div>
                        ) : null}
                        <div className="flex flex-row items-center justify-between gap-2">
                          <p className="text-[10px] uppercase text-[#94A3B8]">Schedules:</p>
                          <p className="font-semibold text-xs text-[#0F172A]">{selectedSchedules.length}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] uppercase text-[#94A3B8]">Slots:</p>
                          <p className="font-semibold text-xs text-[#0F172A]">{visibleSlots.length}</p>
                        </div>
                      </div>
                    </div>
                    {/* {isRecurringClass && (
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-medium text-gray-500">View availability for date:</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => {
                            setSelectedDate(e.target.value);
                            if (selectedClassIdRef.current) {
                              loadClassDetails(selectedClassIdRef.current, e.target.value);
                            }
                          }}
                          className="h-7 rounded-lg border border-[#E2E8F0] px-2 text-[10px] text-[#475569]"
                        />
                      </div>
                    )} */}
                  </div>
                )}

                {activeTab === "schedules" && (
                  <div className="grid min-h-[24rem] lg:grid-cols-[16rem_minmax(0,1fr)]">
                    <div className="border-b border-[#EEF2F4] p-3 lg:border-b-0 lg:border-r lg:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-[#0F172A]">{isRecurringClass ? "Schedules" : "Class Slots"}</h3>
                        {canCreateClass && !isMember && (
                          <button
                            type="button"
                            disabled={!canAddSchedule}
                            onClick={() => {
                              setScheduleModalEdit(null);
                              setScheduleModalPurpose("schedule");
                              setScheduleModalOpen(true);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0D8252] px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:bg-[#CBD5E1] disabled:text-white disabled:shadow-none"
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
                          const scheduleToDelete = isRecurringClass ? daySchedules[0] : selectedSchedules[0];
                          const isActive = isRecurringClass ? activeScheduleDay === day.value : true;
                          const isScheduleActive = scheduleToDelete?.isActive !== false;
                          return (
                            <div
                              key={day.value}
                              className={`flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${
                                isActive && isScheduleActive
                                  ? "border-[#0D8252] bg-emerald-50/70 text-[#0F172A]"
                                  : "border-[#E2E8F0] bg-white hover:border-emerald-200 hover:bg-emerald-50/30"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isRecurringClass) return;
                                  setSelectedScheduleDay(day.value);
                                  setSelectedSchedule(daySchedules[0] || null);
                                  if (daySchedules[0]) void refreshScheduleSlots(daySchedules[0]);
                                }}
                                className="rounded-lg flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <CalendarClock size={16} className={isActive && isScheduleActive ? "text-[#0D8252]" : "text-[#94A3B8]"} />
                                <span>
                                  <span className="block text-xs font-semibold text-[#0F172A]">{day.label}</span>
                                  <span className="text-[10px] text-[#64748B]">{slotCount} Slot{slotCount === 1 ? "" : "s"}</span>
                                </span>
                              </button>
                              {scheduleToDelete?.id && canEditClass && (
                                <button
                                  type="button"
                                  onClick={() => handleEditScheduleDay(scheduleToDelete)}
                                  disabled={saving}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] transition hover:border-[#0D8252] hover:bg-white hover:text-[#0D8252] disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Edit ${day.label} schedule`}
                                >
                                  <Edit size={15} />
                                </button>
                              )}
                              {scheduleToDelete?.id && canDeleteClass && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteScheduleDay(scheduleToDelete)}
                                  disabled={saving}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-100 text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Delete ${day.label} schedule`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-3 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-[#0F172A]">
                          {isRecurringClass ? `${dayName(activeScheduleDay)} Slots` : "Class Slots"}
                        </h3>
                        {canCreateClass && !isMember && (
                          <button
                            type="button"
                            disabled={!canAddSlot}
                            onClick={() => {
                              setScheduleModalEdit(null);
                              setScheduleModalPurpose("slot");
                              setScheduleModalOpen(true);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0D8252] px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:bg-[#CBD5E1] disabled:text-white disabled:shadow-none"
                          >
                            <Plus size={14} />
                            Add Slot
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {selectedDaySlotLoading && <p className="text-xs text-[#64748B]">Loading slots...</p>}
                        {selectedDaySlotError && <p role="alert" className="text-xs text-rose-600">{selectedDaySlotError}</p>}
                        {selectedDaySlots.map((slot) => {
                          const isSelectedSlot = selectedSlot?.id === slot.id;
                          return (
                            <div
                              key={slot.id || `${slot.startTime}-${slot.endTime}`}
                              onClick={() => {
                                setSelectedSchedule(slot.schedule || null);
                                setSelectedSlot(slot);
                                if (slot.schedule) void refreshScheduleSlots(slot.schedule);
                                if (slot?.id) setAssignSlotId(slot.id);
                              }}
                              className={`cursor-pointer rounded-lg border p-3 transition hover:bg-[#FBFCFD] ${
                                isSelectedSlot ? "border-[#0D8252] bg-emerald-50/30" : "border-[#E2E8F0] bg-white"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <Clock3 size={13} className="mt-0.5 shrink-0 text-[#94A3B8]" />
                                <p className="text-xs font-bold text-[#0F172A]">
                                  {dayName(slot.dayOfWeek || slot.schedule?.dayOfWeek || activeScheduleDay || slot.raw?.dayOfWeek || "") !== "-"
                                    ? `${dayName(slot.dayOfWeek || slot.schedule?.dayOfWeek || activeScheduleDay || slot.raw?.dayOfWeek || "")} • `
                                    : ""}
                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </p>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-semibold ring-1 ${slot.isFull ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
                                  {slot.isFull ? "Full" : "Active"}
                                </span>
                                {isMember && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleBookClass(selectedClass.id, slot);
                                    }}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#0D8252] px-2.5 text-[10px] font-bold text-white transition hover:bg-[#086B43]"
                                  >
                                    <CalendarCheck size={13} />
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
                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 text-[10px] font-bold text-[#475569] hover:bg-[#F8FAFC]"
                                  >
                                    <Users size={13} />
                                    Members
                                  </button>
                                )}
                              </div>

                              <div className="mt-3 border-t border-[#EEF2F4] pt-2">
                                <p className="text-[10px] text-[#64748B]">
                                  Capacity: <span className="font-semibold text-[#0F172A]">{slot.capacity || "-"}</span>
                                  <span className="mx-2 text-[#CBD5E1]">|</span>
                                  Booked: <span className="font-semibold text-[#0F172A]">{slot.bookedCount}</span>
                                  {slot.remainingSpots !== "" ? <><span className="mx-2 text-[#CBD5E1]">|</span> Remaining: <span className="font-semibold text-[#0D8252]">{slot.remainingSpots}</span></> : ""}
                                </p>
                              </div>

                              {!isMember && (
                                <div className="mt-2 flex items-center gap-2">
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
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] hover:border-[#0D8252] hover:bg-emerald-50 hover:text-[#0D8252]"
                                    aria-label="Edit slot"
                                  >
                                    <Edit size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteSchedule(slot);
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50"
                                    aria-label="Delete slot"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!selectedDaySlots.length && !selectedDaySlotLoading && !selectedDaySlotError && (
                          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                            No slots found for this selection.
                          </p>
                        )}
                      </div>

                      {slotMembersSlotId && (
                        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-950">Booked Members</h4>
                            <button
                              type="button"
                              onClick={() => { setSlotMembers([]); setSlotMembersSlotId(null); setSlotMembersError(""); }}
                              className="rounded-lg text-xs text-gray-500 hover:text-gray-700"
                            >
                              Close
                            </button>
                          </div>
                          <div className="space-y-2">
                            {slotMembersLoading && <p className="py-3 text-center text-sm text-gray-500">Loading booked members...</p>}
                            {slotMembersError && <p role="alert" className="py-3 text-center text-sm text-rose-600">{slotMembersError}</p>}
                            {!slotMembersLoading && !slotMembersError && !slotMembers.length && <p className="py-3 text-center text-sm text-gray-500">No booked members found for this slot.</p>}
                            {!slotMembersLoading && !slotMembersError && slotMembers.map((member) => (
                              <div key={member.id || member.userId} className="grid gap-2 rounded-md bg-white p-2 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                                <div>
                                  <p className="font-medium text-gray-950">{member.user?.name || member.name || member.memberName || "Member"}</p>
                                  {(member.user?.email || member.memberEmail) && <p className="text-xs text-gray-500">{member.user?.email || member.memberEmail}</p>}
                                </div>
                                <span className="text-xs text-gray-500">
                                  Booking date: {formatDate(getBookingDateValue(member))}
                                </span>
                                <StatusBadge status={member.status || member.attendanceStatus || "BOOKED"} label={titleCase(member.status || member.attendanceStatus || "BOOKED")} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === "details" && (
                  <div className="space-y-3 p-3 sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Total Bookings", value: classBookings.length || 0, icon: Users, tone: "bg-blue-50 text-blue-700" },
                        { label: "Schedules", value: selectedSchedules.length, icon: CalendarClock, tone: "bg-emerald-50 text-emerald-700" },
                        { label: "Total Slots", value: visibleSlots.length, icon: Clock3, tone: "bg-orange-50 text-orange-700" },
                        { label: "Total Capacity", value: `${totalBookedSlots}/${totalCapacity || selectedClass.capacity || 0}`, icon: Users, tone: "bg-violet-50 text-violet-700" },
                      ].map((metric) => {
                        const MetricIcon = metric.icon;
                        return (
                          <div key={metric.label} className={`min-h-[108px] rounded-xl border border-[#E2E8F0] p-3 ${metric.tone}`}>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80">
                              <MetricIcon size={15} />
                            </span>
                            <p className="mt-3 text-2xl font-extrabold leading-none text-[#0F172A]">{metric.value}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#64748B]">{metric.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-[0_1px_4px_rgba(15,23,42,0.04)] sm:p-4">
                      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F4] pb-2">
                        <h4 className="text-sm font-bold text-[#0F172A]">Schedule summary</h4>
                        <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-semibold text-[#475569]">
                          {selectedSchedules.length} day{selectedSchedules.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {selectedSchedules.length ? (
                          selectedSchedules.map((schedule) => {
                            const scheduleSlots = schedule.slots || [];
                            return (
                              <div key={schedule.id} className="flex flex-col gap-3 rounded-xl border border-[#EEF2F4] bg-[#FBFCFD] p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[#0F172A]">{dayName(schedule.dayOfWeek || schedule.raw?.dayOfWeek || "")}</p>
                                  <p className="mt-0.5 text-[10px] text-[#64748B]">{scheduleSlots.length} slot{scheduleSlots.length === 1 ? "" : "s"}</p>
                                </div>
                                <div className="w-fit rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#475569]">
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
                          <p className="rounded-lg border border-dashed border-[#DDE5EF] bg-[#FBFCFD] p-4 text-center text-xs text-[#64748B]">
                            No schedule details available for this class yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "bookings" && (
                  <div className="space-y-3 p-3 sm:p-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#0F172A]">Bookings</h3>
                      <p className="mt-0.5 text-[10px] text-[#64748B]">Manage members enrolled in this class</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Total Bookings", bookingSummary.total, Users, "border-blue-100 bg-blue-50/40 text-blue-700"],
                        ["Booked", bookingSummary.booked, CheckCircle2, "border-emerald-100 bg-emerald-50/40 text-emerald-700"],
                        ["Pending Attendance", bookingSummary.pending, Clock3, "border-amber-100 bg-amber-50/40 text-amber-700"],
                        ["Cancelled", bookingSummary.cancelled, XCircle, "border-red-100 bg-red-50/40 text-red-700"],
                      ].map(([label, value, metricIcon, tone]) => {
                        const MetricIcon = metricIcon;
                        return <div key={label} className={`min-h-[108px] rounded-xl border p-3 ${tone}`}>
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80"><MetricIcon size={15} /></span>
                          <p className="mt-3 text-2xl font-extrabold leading-none text-[#0F172A]">{value}</p>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
                        </div>;
                      })}
                    </div>

                    <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:flex-row sm:items-center">
                      <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs text-[#64748B]">
                        <Search size={13} />
                        <input value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="Search member..." className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#94A3B8]" />
                      </label>
                      {!isMember && <button type="button" onClick={() => {
                        const defaultSlot = visibleSlots.find((slot) => slot.id === (bookingSlotFilter || selectedSlot?.id)) || visibleSlots[0];
                        const nextDate = bookingDateFilter || selectedDate || toDateInputValue();
                        setAssignSlotId(defaultSlot?.id || ""); setAssignBookingDate(nextDate); setAvailableMembers([]); setShowAssignPanel(true);
                        if (defaultSlot?.id) void loadAvailableMembers(defaultSlot.id, nextDate);
                      }} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#086B43] sm:w-auto"><Plus size={13} />Assign Member</button>}
                    </div>

                    <div className="overflow-visible rounded-xl border border-[#E5EAF0] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
                      <div className="flex flex-col gap-3 border-b border-[#EEF2F4] px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-[#0F172A]">Booked Members ({filteredBookingRows.length})</h4>
                          <span className="text-[10px] text-[#64748B]">{isRecurringClass ? formatDate(bookingDateFilter) : "Class bookings"}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <label className="grid min-w-0 gap-1 text-[9px] font-bold uppercase tracking-wide text-[#64748B]">Date
                            <select value={bookingDateFilter} onChange={(event) => setBookingDateFilter(event.target.value)} className="h-8 min-w-28 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[10px] font-semibold normal-case text-[#475569] outline-none">
                              <option value="">All dates</option>
                              {bookingDatesForFilter.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
                            </select>
                          </label>
                          <label className="grid min-w-0 gap-1 text-[9px] font-bold uppercase tracking-wide text-[#64748B]">Slot
                            <select value={bookingSlotFilter} onChange={(event) => setBookingSlotFilter(event.target.value)} className="h-8 min-w-32 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[10px] font-semibold normal-case text-[#475569] outline-none">
                              <option value="">All slots</option>
                              {visibleSlots.map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}
                            </select>
                          </label>
                          <label className="grid min-w-0 gap-1 text-[9px] font-bold uppercase tracking-wide text-[#64748B]">Status
                            <select value={bookingStatusFilter} onChange={(event) => setBookingStatusFilter(event.target.value)} className="h-8 min-w-28 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[10px] font-semibold normal-case text-[#475569] outline-none">
                              <option value="">All status</option><option value="booked">Booked</option><option value="pending">Pending</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="cancelled">Cancelled</option>
                            </select>
                          </label>
                        </div>
                      </div>
                      <div className="hidden overflow-hidden md:block">
                        <table className="w-full table-fixed text-left text-[10px]">
                          <thead className="bg-[#FBFCFD] text-[9px] font-bold uppercase tracking-wide text-[#64748B] shadow-sm">
                            <tr>
  <th class="w-[25%] px-3 py-4">Member</th>
  <th class="w-[15%] px-2 py-3">Slot</th>
  <th class="w-[15%] px-2 py-3">Date</th>
  <th class="w-[15%] px-2 py-3">Booking</th>
  <th class="w-[20%] px-2 py-3">Attendance</th>
  <th class="w-[10%] px-2 py-3">Actions</th>
</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredBookingRows.map((booking) => {
                              const bookingKey = booking.id || booking._id || booking.bookingId || `${booking.memberName}-${booking.date}`;
                              const memberEmail = booking.memberEmail || booking.raw?.member?.email || booking.raw?.user?.email || "";
                              const isCancelled = ["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase());
                              return <Fragment key={bookingKey}>
                                <tr className="border-t border-[#EEF2F4] text-[10px] text-[#475569] transition hover:bg-[#FBFCFD]">
                                <td className="px-2.5 py-2.5"><div className="flex min-w-0 items-center gap-2">
                                  {/* <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-bold text-blue-700">
                                    {(booking.memberName || "M").charAt(0).toUpperCase()}</span> */}
                                    <div className="min-w-0"><p className="truncate text-xs font-bold text-[#0F172A]">{booking.memberName || booking.classTitle || "Member"}</p>{memberEmail && <p className="truncate text-[9px] text-[#94A3B8] font-regular">{memberEmail}</p>}</div></div></td>
                                <td className="truncate whitespace-nowrap px-2 py-2.5 text-[#475569]">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</td>
                                <td className="truncate whitespace-nowrap px-2 py-2.5 text-[#475569]">{formatDate(booking.date)}</td>
                                <td className="px-2 py-2.5"><StatusBadge status={booking.bookingStatus || "BOOKED"} label={titleCase(booking.bookingStatus || "BOOKED")} /></td>
                                <td className="px-2 py-2.5"><StatusBadge status={booking.attendanceStatus || "PENDING"} label={titleCase(booking.attendanceStatus || "PENDING")} /></td>
                                <td className="px-2 py-2.5 text-left">
                                  <button type="button" onClick={() => setOpenBookingActions(openBookingActions === bookingKey ? null : bookingKey)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]" aria-label={`Actions for ${booking.memberName || "booking"}`}><MoreVertical size={16} /></button>
                                </td>
                              </tr>
                              {openBookingActions === bookingKey && (
                                <tr className="bg-[#FBFCFD]">
                                  <td colSpan={6} className="border-t border-[#EEF2F4] px-2 py-2.5">
                                    <div className="flex flex-wrap items-center justify-start gap-2 rounded-lg border border-[#E2E8F0] bg-white p-2">
                                      {!isMember && canManageClasses && (
                                        <button type="button" onClick={() => { setAttendanceModalEdit({ bookingId: bookingKey, status: booking.attendanceStatus || "PRESENT" }); setAttendanceModalOpen(true); }} className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#071225] px-2.5 text-[10px] font-bold text-white hover:bg-[#0F172A]"><ClipboardCheck size={12} />Attendance</button>
                                      )}
                                      {!isMember && booking.slotId && (
                                        <button type="button" onClick={() => { setChangeSlotBooking(booking); setChangeSlotTarget(""); setChangeSlotType("temporary"); }} className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50"><RefreshCw size={12} />Change Slot</button>
                                      )}
                                      {!isMember && booking.slotId && (
                                        <button type="button" onClick={async () => { setSlotHistoryBooking(booking); setSlotChanges([]); await loadBookingSlotChanges(bookingKey); }} className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[10px] font-bold text-[#475569] hover:bg-[#F8FAFC]"><CalendarClock size={12} />Slot Changes History</button>
                                      )}
                                      {!isCancelled && (
                                        <button type="button" onClick={() => void handleCancelBooking(booking)} className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-100 bg-white px-2.5 text-[10px] font-bold text-rose-500 hover:bg-rose-50"><XCircle size={12} />Cancel</button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                              </Fragment>;
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
                              <button type="button" onClick={() => setOpenBookingActions(openBookingActions === bookingKey ? null : bookingKey)} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label={`Actions for ${booking.memberName || "booking"}`}><MoreVertical size={17} /></button>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              <div><p className="text-gray-500">Slot</p><p className="mt-1 font-medium text-gray-800">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</p></div>
                              <div><p className="text-gray-500">Date</p><p className="mt-1 font-medium text-gray-800">{formatDate(booking.date)}</p></div>
                              <div><p className="text-gray-500">Booking</p><StatusBadge status={booking.bookingStatus || "BOOKED"} label={titleCase(booking.bookingStatus || "BOOKED")} /></div>
                              <div><p className="text-gray-500">Attendance</p><StatusBadge status={booking.attendanceStatus || "PENDING"} label={titleCase(booking.attendanceStatus || "PENDING")} /></div>
                            </div>
                            {openBookingActions === bookingKey && <div className="absolute right-3 top-12 z-20 w-48 rounded-lg border border-gray-200 bg-white p-1 text-left shadow-xl">
                              {!isMember && canManageClasses && <button type="button" onClick={() => { setAttendanceModalEdit({ bookingId: bookingKey, status: booking.attendanceStatus || "PRESENT" }); setAttendanceModalOpen(true); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><ClipboardCheck size={14} />Mark Attendance</button>}
                              {!isMember && booking.slotId && <button type="button" onClick={() => { setChangeSlotBooking(booking); setChangeSlotTarget(""); setChangeSlotType("temporary"); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><RefreshCw size={14} />Change Slot</button>}
                              {!isMember && booking.slotId && <button type="button" onClick={async () => { setSlotHistoryBooking(booking); setSlotChanges([]); setOpenBookingActions(null); await loadBookingSlotChanges(bookingKey); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><CalendarClock size={14} />View Slot History</button>}
                              {!isCancelled && <button type="button" onClick={() => { void handleCancelBooking(booking); setOpenBookingActions(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50"><XCircle size={14} />Cancel Booking</button>}
                            </div>}
                          </div>;
                        })}
                      </div>
                      {!filteredBookingRows.length && <p className="border-t border-dashed border-gray-200 p-8 text-center text-xs text-gray-500">No bookings match these filters.</p>}
                    </div>

                    {legacyBookingModalMarkupEnabled && <>
                    {showAssignPanel && <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setShowAssignPanel(false)}><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-gray-950">Assign Member</h3><p className="mt-1 text-xs text-gray-500">Only members available for this slot and date are shown.</p></div><button type="button" onClick={() => setShowAssignPanel(false)} className="rounded-lg text-gray-400 hover:text-gray-700" aria-label="Close"><XCircle size={18} /></button></div><div className="mt-5 grid gap-3"><label className="grid gap-1 text-xs font-semibold text-gray-600">Date<input type="date" value={assignBookingDate} onChange={(event) => setAssignBookingDate(event.target.value)} className="h-10 rounded-md border border-gray-300 px-3 text-sm font-normal" /></label><label className="grid gap-1 text-xs font-semibold text-gray-600">Time Slot<select value={assignSlotId} onChange={(event) => { setAssignSlotId(event.target.value); setAvailableMembers([]); }} className="h-10 rounded-md border border-gray-300 px-3 text-sm font-normal"><option value="">Select slot</option>{visibleSlots.map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}</select></label><button type="button" onClick={() => void loadAvailableMembers(assignSlotId, assignBookingDate)} disabled={!assignSlotId || saving} className="h-10 rounded-lg border border-blue-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">Find Available Members</button></div><div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{availableMembers.map((member) => <div key={member.id || member.userId} className="flex items-center justify-between rounded-md border border-gray-200 p-3"><div><p className="text-sm font-semibold text-gray-900">{member.name || member.fullName}</p><p className="text-xs text-gray-500">{member.email}</p></div><button type="button" onClick={() => void handleAssignMember(member.id || member.userId)} disabled={saving} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Assign</button></div>)}{assignSlotId && !availableMembers.length && <p className="py-5 text-center text-xs text-gray-500">Find available members for this slot.</p>}</div></div></div>}

                    {changeSlotBooking && <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-gray-950">Change Slot</h3><p className="mt-1 text-xs text-gray-500">{changeSlotBooking.memberName || "Member"}</p></div><button type="button" onClick={() => setChangeSlotBooking(null)} className="rounded-lg text-gray-400 hover:text-gray-700" aria-label="Close"><XCircle size={18} /></button></div><div className="mt-5 space-y-4"><div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">Current slot: <span className="font-semibold text-gray-900">{formatTime(changeSlotBooking.startTime)} - {formatTime(changeSlotBooking.endTime)}</span></div><label className="grid gap-1 text-xs font-semibold text-gray-600">Change to<select value={changeSlotTarget} onChange={(event) => setChangeSlotTarget(event.target.value)} className="h-10 rounded-md border border-gray-300 px-3 text-sm font-normal"><option value="">Select new slot</option>{visibleSlots.filter((slot) => slot.id && slot.id !== changeSlotBooking.slotId).map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}</select></label><div className="space-y-2"><p className="text-xs font-semibold text-gray-600">Change type</p><label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-xs"><input type="radio" checked={changeSlotType === "temporary"} onChange={() => setChangeSlotType("temporary")} /> <span><strong>This date only</strong><span className="block text-gray-500">Temporary change</span></span></label><label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-xs"><input type="radio" checked={changeSlotType === "permanent"} onChange={() => setChangeSlotType("permanent")} /> <span><strong>Permanently change slot</strong><span className="block text-gray-500">Future booking slot</span></span></label></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setChangeSlotBooking(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700">Cancel</button><button type="button" disabled={!changeSlotTarget || saving} onClick={async () => { await handleSlotChange(changeSlotBooking.id || changeSlotBooking.bookingId, changeSlotTarget, changeSlotType === "permanent"); setChangeSlotBooking(null); }} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirm Change</button></div></div></div>}
                    {changeSlotBooking && <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-gray-950">Change Slot</h3><p className="mt-1 text-xs text-gray-500">{changeSlotBooking.memberName || "Member"}</p></div><button type="button" onClick={() => setChangeSlotBooking(null)} className="rounded-lg text-gray-400 hover:text-gray-700" aria-label="Close"><XCircle size={18} /></button></div><div className="mt-5 space-y-4"><div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">Current slot: <span className="font-semibold text-gray-900">{formatTime(changeSlotBooking.startTime)} - {formatTime(changeSlotBooking.endTime)}</span></div><label className="grid gap-1 text-xs font-semibold text-gray-600">Change to<select value={changeSlotTarget} onChange={(event) => setChangeSlotTarget(event.target.value)} className="h-10 rounded-md border border-gray-300 px-3 text-sm font-normal"><option value="">Select new slot</option>{visibleSlots.filter((slot) => slot.id && slot.id !== changeSlotBooking.slotId).map((slot) => <option key={slot.id} value={slot.id}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</option>)}</select></label><div className="space-y-2"><p className="text-xs font-semibold text-gray-600">Change type</p><label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-xs"><input type="radio" checked={changeSlotType === "temporary"} onChange={() => setChangeSlotType("temporary")} /> <span><strong>This date only</strong><span className="block text-gray-500">Temporary change</span></span></label><label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-xs"><input type="radio" checked={changeSlotType === "permanent"} onChange={() => setChangeSlotType("permanent")} /> <span><strong>Permanently change slot</strong><span className="block text-gray-500">Future booking slot</span></span></label></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setChangeSlotBooking(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700">Cancel</button><button type="button" disabled={!changeSlotTarget || saving} onClick={async () => { await handleSlotChange(changeSlotBooking.id || changeSlotBooking.bookingId, changeSlotTarget, changeSlotType === "permanent"); setChangeSlotBooking(null); }} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirm Change</button></div></div></div>}
                    {slotHistoryBooking && <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-base font-bold text-gray-950">Slot Change History</h3><p className="mt-1 text-xs text-gray-500">{slotHistoryBooking.memberName || "Member"} · {formatDate(slotHistoryBooking.date)}</p></div><button type="button" onClick={() => { setSlotHistoryBooking(null); setSlotChanges([]); }} className="rounded-lg text-gray-400 hover:text-gray-700" aria-label="Close"><XCircle size={18} /></button></div><div className="mt-5 max-h-80 space-y-2 overflow-y-auto">{slotChanges.length ? slotChanges.map((change) => <div key={change.id || `${change.bookingId}-${change.createdAt}`} className="rounded-md border border-gray-200 p-3 text-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-gray-900">{change.isPermanent ? "Permanent" : "Temporary"} slot change</p>{change.createdAt && <span className="text-xs text-gray-500">{formatDate(change.createdAt)}</span>}</div><p className="mt-2 text-xs text-gray-600">{formatSlotRange(change.oldSlot || change.previousSlot)} <span className="mx-1">→</span> {formatSlotRange(change.newSlot || change.nextSlot)}</p>{change.date && <p className="mt-1 text-xs text-gray-500">Booking date: {formatDate(change.date)}</p>}</div>) : <p className="py-8 text-center text-sm text-gray-500">No slot changes found for this booking.</p>}</div><div className="mt-5 flex justify-end"><button type="button" onClick={() => { setSlotHistoryBooking(null); setSlotChanges([]); }} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700">Close</button></div></div></div>}
                    </>}
                    <AssignMemberModal
                      isOpen={showAssignPanel}
                      onClose={() => setShowAssignPanel(false)}
                      assignBookingDate={assignBookingDate}
                      setAssignBookingDate={setAssignBookingDate}
                      assignSlotId={assignSlotId}
                      setAssignSlotId={setAssignSlotId}
                      setAvailableMembers={setAvailableMembers}
                      visibleSlots={visibleSlots}
                      formatTime={formatTime}
                      loadAvailableMembers={loadAvailableMembers}
                      availableMembers={availableMembers}
                      handleAssignMember={handleAssignMember}
                      saving={saving}
                    />
                    <ChangeSlotModal
                      isOpen={Boolean(changeSlotBooking)}
                      onClose={() => setChangeSlotBooking(null)}
                      booking={changeSlotBooking}
                      changeSlotTarget={changeSlotTarget}
                      setChangeSlotTarget={setChangeSlotTarget}
                      changeSlotType={changeSlotType}
                      setChangeSlotType={setChangeSlotType}
                      visibleSlots={visibleSlots}
                      formatTime={formatTime}
                      handleSlotChange={handleSlotChange}
                      saving={saving}
                    />
                    <SlotChangesModal
                      isOpen={Boolean(slotHistoryBooking)}
                      onClose={() => { setSlotHistoryBooking(null); setSlotChanges([]); }}
                      booking={slotHistoryBooking}
                      slotChanges={slotChanges}
                      formatDate={formatDate}
                      formatSlotRange={formatSlotRange}
                    />
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
                            className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
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
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
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
                              <StatusBadge status={member.status || member.attendanceStatus || "BOOKED"} label={titleCase(member.status || member.attendanceStatus || "BOOKED")} />
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
                            className="rounded-lg text-xs text-gray-500 hover:text-gray-700"
                          >
                            Close
                          </button>
                        </div>
                        <div className="space-y-2">
                          {slotAttendanceRecords.map((record) => (
                            <div key={record.id || record.bookingId} className="grid gap-2 rounded-md bg-white p-2 text-sm md:grid-cols-[1fr_auto] md:items-center">
                              <span className="font-medium text-gray-950">{record.booking?.user?.name || record.user?.name || record.memberName || "Member"}</span>
                              <StatusBadge status={record.status} label={titleCase(record.status)} />
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
                                <StatusBadge status={booking.bookingStatus} label={titleCase(booking.bookingStatus)} />
                                {booking.attendanceStatus && (
                                  <StatusBadge status={booking.attendanceStatus} label={titleCase(booking.attendanceStatus)} />
                                )}
                              </div>
                            </div>
                            {bookingKey && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {!['cancelled', 'canceled'].includes(String(booking.bookingStatus).toLowerCase()) && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelBooking(booking)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
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
                                    className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
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
                                      className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                                    >
                                      Temporary
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleSlotChange(bookingKey, selectedSlotChangeTarget, true)}
                                      disabled={saving || !selectedSlotChangeTarget}
                                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                    >
                                      Permanent
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void loadBookingSlotChanges(bookingKey)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
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
                            className="rounded-lg text-xs text-gray-500 hover:text-gray-700"
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
                  <div className="p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-0.5 pb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <h3 className="font-semibold text-[#0F172A]">Attendance Log</h3>
                        <span className="text-[#CBD5E1]">•</span>
                        <span className="text-[#64748B]">{classAttendance.length} Sessions tracked</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 text-[10px] font-semibold">
                        {attendanceSummary.PRESENT > 0 && <span className="rounded border border-[#A7E6C1] bg-[#F0FDF4] px-2 py-1 text-[#0D8252]">{attendanceSummary.PRESENT} Present</span>}
                        {attendanceSummary.LATE > 0 && <span className="rounded border border-[#F8D98A] bg-[#FFF9E8] px-2 py-1 text-[#B45309]">{attendanceSummary.LATE} Late</span>}
                        {attendanceSummary.ABSENT > 0 && <span className="rounded border border-[#F2B8B5] bg-[#FFF5F5] px-2 py-1 text-[#C2413B]">{attendanceSummary.ABSENT} Absent</span>}
                        {attendanceSummary.PENDING > 0 && <span className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-1 text-[#64748B]">{attendanceSummary.PENDING} Pending</span>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {classAttendance.map((record) => {
                        const status = normalizeAttendanceStatus(record.status);
                        return (
                          <div key={record.id || `${record.memberName}-${record.timestamp}`} className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-3 sm:px-4">
                            <span className="min-w-0 truncate text-xs font-bold text-[#0F172A]">{record.memberName || record.user?.name || "Member"}</span>
                            <div className="flex shrink-0 items-center gap-3 sm:gap-5">
                              <span className="text-right text-[10px] text-[#64748B]">
                                {record.attendanceDate ? `${formatDate(record.attendanceDate)} ${formatTime(record.attendanceDate)}` : record.trainerName || "-"}
                              </span>
                              <span className={`min-w-[74px] rounded-md border px-2.5 py-1 text-center text-[10px] font-bold ${status === "PRESENT" ? "border-[#B7E8CC] bg-[#F0FDF4] text-[#0D6B43]" : status === "LATE" ? "border-[#F8D98A] bg-[#FFF9E8] text-[#B45309]" : status === "ABSENT" ? "border-[#F2B8B5] bg-[#FFF5F5] text-[#C2413B]" : "border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]"}`}>
                                {status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {!classAttendance.length && <p className="rounded-xl border border-dashed border-[#DDE5EF] bg-[#FBFCFD] p-6 text-center text-xs text-[#64748B]">No attendance returned for this class.</p>}
                    </div>
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
            selectedClassId={selectedClass?.id || ""}
            selectedScheduleId={isRecurringClass ? activeSlotSchedule?.id || "" : ""}
            initialDayOfWeek={activeScheduleDay || ""}
            classes={classes}
            purpose={scheduleModalPurpose}
            saving={saving}
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
      </div>
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
          className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
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
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
                                  aria-label="Edit slot"
                                >
                                  <Edit size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteSchedule(slot);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
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
                        onClick={() => {
                          setSelectedScheduleDay(dayKey);
                          const schedule = scheduleGroups[dayKey][0] || null;
                          setSelectedSchedule(schedule);
                          if (schedule) void refreshScheduleSlots(schedule);
                        }}
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
                          const slotState = scheduleSlotStates[schedule.id] || {};
                          return (
                            <div
                              key={schedule.id || `${schedule.date}-${schedule.startTime}`}
                              className={`rounded-md border p-3 ${
                                isSelectedSchedule ? "border-blue-500 bg-blue-50" : "border-gray-200"
                              }`}
                            >
                              <p className="text-sm font-semibold text-gray-950">{getScheduleDayLabel(schedule)}</p>
                              {slotState.loading ? (
                                <p className="mt-2 rounded-md bg-white p-3 text-sm text-gray-500">Loading slots...</p>
                              ) : slotState.error ? (
                                <p role="alert" className="mt-2 rounded-md bg-white p-3 text-sm text-rose-600">{slotState.error}</p>
                              ) : slots.length === 0 ? (
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
                                          void refreshScheduleSlots(schedule);
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
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
                                                aria-label="Edit slot"
                                              >
                                                <Edit size={15} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleDeleteSchedule(slot);
                                                }}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
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
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
                    className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Edit Class
                  </button>
                )}
                {canDeleteClass && !isMember && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClass(selectedClass.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
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
                      <StatusBadge status={booking.bookingStatus || "BOOKED"} label={titleCase(booking.bookingStatus)} />
                      {booking.attendanceStatus && (
                        <StatusBadge status={booking.attendanceStatus} label={titleCase(booking.attendanceStatus)} />
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {booking.id && !["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(booking)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
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
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
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
                    <button onClick={() => { setClassModalEdit(null); setClassModalOpen(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
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
                    <button onClick={() => { setScheduleModalEdit(null); setScheduleModalPurpose("slot"); setScheduleModalOpen(true); }} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
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
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
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
                    <StatusBadge status={booking.bookingStatus || "BOOKED"} label={titleCase(booking.bookingStatus)} />
                    {booking.id && !["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(booking)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
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
                  <StatusBadge className="mt-2" status={record.status} label={titleCase(record.status)} />
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
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
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
                        <StatusBadge status={booking.bookingStatus || "BOOKED"} label={titleCase(booking.bookingStatus)} />
                        {booking.id && !["cancelled", "canceled"].includes(String(booking.bookingStatus).toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(booking)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
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
                      <StatusBadge className="mt-2" status={record.status} label={titleCase(record.status)} />
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
        selectedClassId={selectedClass?.id || ""}
        selectedScheduleId={isRecurringClass ? activeSlotSchedule?.id || "" : ""}
        initialDayOfWeek={activeScheduleDay || ""}
        classes={classes}
        purpose={scheduleModalPurpose}
        saving={saving}
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
