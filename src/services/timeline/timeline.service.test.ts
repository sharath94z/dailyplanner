import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock, resetPrismaMock } from "../../test/prisma-mock";

vi.mock("../../lib/db", () => ({
  prisma: prismaMock
}));

const {
  reconcileMissedSchedulesForDay,
  reconcileStaleSuggestionsForDay
} = vi.hoisted(() => ({
  reconcileMissedSchedulesForDay: vi.fn(),
  reconcileStaleSuggestionsForDay: vi.fn()
}));

vi.mock("../schedules/schedule.service", () => ({
  reconcileMissedSchedulesForDay,
  reconcileStaleSuggestionsForDay
}));

import { getTimelineForDate } from "./timeline.service";

describe("timeline.service", () => {
  beforeEach(() => {
    resetPrismaMock();
    reconcileMissedSchedulesForDay.mockReset();
    reconcileStaleSuggestionsForDay.mockReset();
    prismaMock.user.findUnique.mockResolvedValue({
      timezone: "Asia/Tokyo"
    });
    prismaMock.userPreferences.findUnique.mockResolvedValue({
      maxDailyPlannedMinutes: 360
    });
    prismaMock.routine.findMany.mockResolvedValue([]);
    prismaMock.taskSchedule.findMany.mockResolvedValue([]);
    prismaMock.taskSuggestion.findMany.mockResolvedValue([]);
    prismaMock.calendarEvent.findMany.mockResolvedValue([]);
  });

  it("queries routines only for the matching weekday", async () => {
    prismaMock.routine.findMany.mockResolvedValue([
      {
        id: "routine-1",
        userId: "mock-user",
        title: "Work",
        startTime: "09:00",
        endTime: "10:00",
        daysOfWeek: [1],
        isActive: true,
        createdAt: new Date("2026-04-26T00:00:00.000Z"),
        updatedAt: new Date("2026-04-26T00:00:00.000Z")
      }
    ]);

    const timeline = await getTimelineForDate("mock-user", {
      date: "2026-04-27",
      includeSuggestions: true,
      includeCalendar: true
    });

    expect(prismaMock.routine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          daysOfWeek: {
            has: 1
          }
        })
      })
    );
    expect(timeline.items.some((item) => item.type === "routine")).toBe(true);
  });

  it("merges overlapping routines when computing routineMinutes", async () => {
    prismaMock.routine.findMany.mockResolvedValue([
      {
        id: "routine-1",
        userId: "mock-user",
        title: "Routine A",
        startTime: "09:00",
        endTime: "10:00",
        daysOfWeek: [1],
        isActive: true,
        createdAt: new Date("2026-04-26T00:00:00.000Z"),
        updatedAt: new Date("2026-04-26T00:00:00.000Z")
      },
      {
        id: "routine-2",
        userId: "mock-user",
        title: "Routine B",
        startTime: "09:30",
        endTime: "10:30",
        daysOfWeek: [1],
        isActive: true,
        createdAt: new Date("2026-04-26T00:00:00.000Z"),
        updatedAt: new Date("2026-04-26T00:00:00.000Z")
      }
    ]);

    const timeline = await getTimelineForDate("mock-user", {
      date: "2026-04-27",
      includeSuggestions: true,
      includeCalendar: true
    });

    expect(timeline.items.filter((item) => item.type === "routine")).toHaveLength(2);
    expect(timeline.summary.routineMinutes).toBe(90);
    expect(timeline.summary.freeMinutes).toBe(270);
  });

  it("reconciles stale suggestions before loading a later-day timeline", async () => {
    await getTimelineForDate("mock-user", {
      date: "2026-04-30",
      includeSuggestions: true,
      includeCalendar: true
    });

    expect(reconcileStaleSuggestionsForDay).toHaveBeenCalledWith(
      "mock-user",
      expect.any(Date),
      expect.any(Date)
    );
    expect(reconcileMissedSchedulesForDay).toHaveBeenCalledWith(
      "mock-user",
      expect.any(Date),
      expect.any(Date),
      expect.any(Date)
    );
    expect(reconcileStaleSuggestionsForDay.mock.invocationCallOrder[0]).toBeLessThan(
      reconcileMissedSchedulesForDay.mock.invocationCallOrder[0]
    );
  });
});
