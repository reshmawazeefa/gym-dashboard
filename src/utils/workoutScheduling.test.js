import test from "node:test";
import assert from "node:assert/strict";
import { generateWorkoutSchedule, normalizeRepeatDays, validateWorkoutAssignment } from "./workoutScheduling.js";

const day = (dayNumber, weekday = null) => ({ id: `day-${dayNumber}`, dayNumber, title: `Day ${dayNumber}`, weekday });

 test("NONE schedules each workout day once on consecutive local dates", () => {
  const result = generateWorkoutSchedule({ workoutDays: [day(1), day(2), day(3)], startDate: "2026-01-01", endDate: "2026-01-02", repeatType: "NONE" });
  assert.deepEqual(result.schedules.map((item) => item.date), ["2026-01-01", "2026-01-02", "2026-01-03"]);
  assert.equal(result.schedules.length, 3);
});

test("DAILY schedules wildcard days on every calendar date", () => {
  const result = generateWorkoutSchedule({ workoutDays: [day(1)], startDate: "2026-01-01", endDate: "2026-01-03", repeatType: "DAILY" });
  assert.deepEqual(result.schedules.map((item) => item.date), ["2026-01-01", "2026-01-02", "2026-01-03"]);
});

test("DAILY omits dates without a pinned match and reports unreachable days", () => {
  const result = generateWorkoutSchedule({ workoutDays: [day(1, 1)], startDate: "2026-01-05", endDate: "2026-01-11", repeatType: "DAILY" });
  assert.deepEqual(result.schedules.map((item) => item.date), ["2026-01-05"]);
  assert.equal(result.warnings.length, 0);
});

test("WEEKLY applies selected weekdays and pinned priority", () => {
  const result = generateWorkoutSchedule({ workoutDays: [day(1, 1), day(2)], startDate: "2026-01-05", repeatEndDate: "2026-01-11", repeatType: "WEEKLY", repeatDays: [3, 1] });
  assert.deepEqual(result.schedules.map((item) => [item.date, item.workoutDayId]), [["2026-01-05", "day-1"], ["2026-01-07", "day-2"]]);
  assert.deepEqual(result.validation.repeatDays, [1, 3]);
});

test("CUSTOM is an alias of WEEKLY", () => {
  const result = generateWorkoutSchedule({ workoutDays: [day(1)], startDate: "2026-01-05", endDate: "2026-01-11", repeatType: "CUSTOM", repeatDays: [1] });
  assert.equal(result.validation.normalizedType, "WEEKLY");
  assert.equal(result.schedules.length, 1);
});

test("multiple pinned days on one weekday rotate independently", () => {
  const result = generateWorkoutSchedule({ workoutDays: [day(1, 1), day(2, 1)], startDate: "2026-01-05", repeatEndDate: "2026-01-19", repeatType: "WEEKLY", repeatDays: [1] });
  assert.deepEqual(result.schedules.map((item) => item.workoutDayId), ["day-1", "day-2", "day-1"]);
});

test("stranded pinned days are warnings, not validation errors", () => {
  const result = generateWorkoutSchedule({ workoutDays: [day(1, 5)], startDate: "2026-01-05", repeatEndDate: "2026-01-11", repeatType: "WEEKLY", repeatDays: [1] });
  assert.equal(result.validation.errors.length, 0);
  assert.equal(result.schedules.length, 0);
  assert.equal(result.warnings[0].code, "STRANDED_WORKOUT_DAY");
});

test("repeat validation rejects invalid combinations and normalizes days", () => {
  assert.deepEqual(normalizeRepeatDays(["WEDNESDAY", 1, "1", 8]), [1, 3]);
  assert.ok(validateWorkoutAssignment({ startDate: "2026-01-01", repeatType: "DAILY", repeatDays: [1] }).errors.length);
  assert.ok(validateWorkoutAssignment({ startDate: "2026-01-01", repeatType: "WEEKLY", repeatDays: [] }).errors.length);
  assert.ok(validateWorkoutAssignment({ startDate: "2026-01-01", repeatType: "WEEKLY", repeatDays: [1] }).errors.length);
});
