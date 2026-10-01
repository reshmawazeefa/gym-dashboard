const DAY_NAME_TO_NUMBER = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

const REPEAT_TYPES = new Set(["NONE", "DAILY", "WEEKLY", "CUSTOM"]);
const MAX_HORIZON_DAYS = 366;

function dateParts(value) {
  if (value instanceof Date) {
    return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  }
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function parseLocalDate(value) {
  const parts = dateParts(value);
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (date.getFullYear() !== parts.year || date.getMonth() !== parts.month - 1 || date.getDate() !== parts.day) return null;
  return date;
}

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function dayDifference(start, end) {
  return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
}

export function normalizeRepeatType(value) {
  const repeatType = String(value || "NONE").toUpperCase();
  return REPEAT_TYPES.has(repeatType) ? (repeatType === "CUSTOM" ? "WEEKLY" : repeatType) : "NONE";
}

export function normalizeRepeatDays(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map((value) => {
    if (typeof value === "string" && DAY_NAME_TO_NUMBER[value.toUpperCase()]) return DAY_NAME_TO_NUMBER[value.toUpperCase()];
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 7 ? number : null;
  }).filter(Boolean))].sort((first, second) => first - second);
}

export function validateWorkoutAssignment({ startDate, endDate, repeatEndDate, repeatType = "NONE", repeatDays = [] } = {}) {
  const errors = [];
  const requestedType = String(repeatType || "NONE").toUpperCase();
  const normalizedType = normalizeRepeatType(requestedType);
  const days = normalizeRepeatDays(repeatDays);
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const repeatEnd = parseLocalDate(repeatEndDate);

  if (!start) errors.push("Start date is required and must use YYYY-MM-DD.");
  if (!REPEAT_TYPES.has(requestedType)) errors.push("Repeat type is invalid.");
  if ((normalizedType === "NONE" || normalizedType === "DAILY") && days.length) errors.push(`repeatDays must be empty for ${requestedType}.`);
  if ((normalizedType === "WEEKLY" || normalizedType === "CUSTOM") && !days.length) errors.push("repeatDays is required for WEEKLY and CUSTOM.");
  if (normalizedType !== "NONE" && !endDate && !repeatEndDate) errors.push("endDate or repeatEndDate is required for repeating assignments.");

  const horizon = repeatEnd || end;
  if (start && horizon && horizon < start) errors.push("The repeat end date cannot be before the start date.");
  if (normalizedType !== "NONE" && endDate && !end && !repeatEnd) errors.push("endDate must use YYYY-MM-DD.");
  if (normalizedType !== "NONE" && repeatEndDate && !repeatEnd) errors.push("repeatEndDate must use YYYY-MM-DD.");

  return { errors, normalizedType, repeatDays: days, startDate: start, horizonEnd: horizon };
}

function workoutDayId(day, index) {
  return day?.id || day?._id || day?.uuid || `workout-day-${index + 1}`;
}

function dayWeekday(day) {
  const value = Number(day?.weekday);
  return Number.isInteger(value) && value >= 1 && value <= 7 ? value : null;
}

function buildDayIndexes(workoutDays) {
  const pinned = new Map();
  const wildcard = [];
  workoutDays.forEach((day, index) => {
    const weekday = dayWeekday(day);
    if (weekday == null) wildcard.push(index);
    else pinned.set(weekday, [...(pinned.get(weekday) || []), index]);
  });
  return { pinned, wildcard };
}

function createScheduleEntry(day, index, date) {
  return {
    date: formatLocalDate(date),
    workoutDayId: workoutDayId(day, index),
    dayNumber: day?.dayNumber ?? null,
    title: day?.title || day?.name || `Day ${day?.dayNumber ?? index + 1}`,
    weekday: date.getDay() === 0 ? 7 : date.getDay(),
  };
}

export function generateWorkoutSchedule({ workoutDays = [], startDate, endDate, repeatEndDate, repeatType = "NONE", repeatDays = [] } = {}) {
  const validation = validateWorkoutAssignment({ startDate, endDate, repeatEndDate, repeatType, repeatDays });
  const warnings = [];
  const schedules = [];
  const usedCounts = new Map();
  const { pinned, wildcard } = buildDayIndexes(Array.isArray(workoutDays) ? workoutDays : []);

  if (validation.errors.length || !validation.startDate || !workoutDays.length) {
    if (!workoutDays.length) warnings.push("No workout days are available for scheduling.");
    return { schedules, warnings, validation, horizonEnd: validation.horizonEnd ? formatLocalDate(validation.horizonEnd) : "" };
  }

  const markUsed = (index) => usedCounts.set(index, (usedCounts.get(index) || 0) + 1);
  const chooseRotating = (indexes, counters) => {
    if (!indexes.length) return null;
    const key = indexes.join(",");
    const cursor = counters.get(key) || 0;
    counters.set(key, cursor + 1);
    return indexes[cursor % indexes.length];
  };

  if (validation.normalizedType === "NONE") {
    workoutDays.forEach((day, index) => {
      const date = addDays(validation.startDate, index);
      schedules.push(createScheduleEntry(day, index, date));
      markUsed(index);
    });
  } else {
    const selectedWeekdays = validation.normalizedType === "DAILY" ? null : validation.repeatDays;
    const horizonEnd = validation.horizonEnd && validation.horizonEnd < addDays(validation.startDate, MAX_HORIZON_DAYS - 1)
      ? validation.horizonEnd
      : addDays(validation.startDate, MAX_HORIZON_DAYS - 1);
    const pinnedCursors = new Map();
    const wildcardCursors = new Map();
    const totalDays = Math.max(0, dayDifference(validation.startDate, horizonEnd));

    for (let offset = 0; offset <= totalDays; offset += 1) {
      const date = addDays(validation.startDate, offset);
      const weekday = date.getDay() === 0 ? 7 : date.getDay();
      if (selectedWeekdays && !selectedWeekdays.includes(weekday)) continue;

      const pinnedIndexes = pinned.get(weekday) || [];
      const selectedIndex = pinnedIndexes.length
        ? chooseRotating(pinnedIndexes, pinnedCursors)
        : chooseRotating(wildcard, wildcardCursors);
      if (selectedIndex == null) continue;
      schedules.push(createScheduleEntry(workoutDays[selectedIndex], selectedIndex, date));
      markUsed(selectedIndex);
    }
  }

  workoutDays.forEach((day, index) => {
    if (!usedCounts.has(index)) {
      const weekday = dayWeekday(day);
      warnings.push({
        code: "STRANDED_WORKOUT_DAY",
        workoutDayId: workoutDayId(day, index),
        dayNumber: day?.dayNumber ?? null,
        title: day?.title || day?.name || `Day ${day?.dayNumber ?? index + 1}`,
        weekday,
        message: weekday == null ? "This wildcard workout day was not reachable by the selected repeat rules." : `Pinned workout day ${weekday} was not reachable by the selected repeat rules.`,
      });
    }
  });

  return {
    schedules,
    warnings,
    validation,
    horizonEnd: validation.normalizedType === "NONE" ? "" : (validation.horizonEnd ? formatLocalDate(validation.horizonEnd < addDays(validation.startDate, MAX_HORIZON_DAYS - 1) ? validation.horizonEnd : addDays(validation.startDate, MAX_HORIZON_DAYS - 1)) : ""),
  };
}

export const WORKOUT_REPEAT_MAX_HORIZON_DAYS = MAX_HORIZON_DAYS;
