import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CompletionStatus,
  SuggestionStatus,
  TaskStatus
} from "@prisma/client";

import { AppError } from "../../lib/api-errors";
import { prismaMock, resetPrismaMock } from "../../test/prisma-mock";

vi.mock("../../lib/db", () => ({
  prisma: prismaMock
}));

import {
  acceptSuggestion,
  dismissSuggestion,
  planDay,
  retrySuggestion
} from "./scheduler.service";

function createdSuggestionFromData(id: string) {
  return ({ data }: { data: Record<string, unknown> }) => ({
    id,
    ...data,
    generatedAt: new Date("2026-04-26T00:00:00.000Z"),
    expiresAt: null
  });
}

describe("scheduler.service", () => {
  beforeEach(() => {
    resetPrismaMock();
    prismaMock.user.findUnique.mockResolvedValue({
      timezone: "Asia/Tokyo"
    });
    prismaMock.userPreferences.findUnique.mockResolvedValue({
      workDayStart: "09:00",
      workDayEnd: "12:00",
      defaultTaskDuration: 30,
      suggestionLimit: 5
    });
    prismaMock.routine.findMany.mockResolvedValue([]);
    prismaMock.taskSchedule.findMany.mockResolvedValue([]);
    prismaMock.calendarEvent.findMany.mockResolvedValue([]);
    prismaMock.taskSuggestion.findMany.mockResolvedValue([]);
    prismaMock.schedulingRun.create.mockResolvedValue({});
    prismaMock.task.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data
    }));
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.taskSuggestion.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.taskSuggestion.update.mockResolvedValue({});
    prismaMock.taskSchedule.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the user timezone for planning day and working hours", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:00:00.000Z")
      }
    ]);
    prismaMock.taskSuggestion.create.mockImplementation(createdSuggestionFromData("suggestion-1"));

    const result = await planDay("mock-user", {
      date: "2026-04-27"
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.startAt).toBe("2026-04-27T00:00:00.000Z");
    expect(result.suggestions[0]?.endAt).toBe("2026-04-27T00:30:00.000Z");
  });

  it("creates multiple suggestions up to suggestionLimit", async () => {
    prismaMock.userPreferences.findUnique.mockResolvedValue({
      workDayStart: "09:00",
      workDayEnd: "12:00",
      defaultTaskDuration: 30,
      suggestionLimit: 2
    });
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:00:00.000Z")
      },
      {
        id: "task-2",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:01:00.000Z")
      },
      {
        id: "task-3",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:02:00.000Z")
      }
    ]);
    prismaMock.taskSuggestion.create
      .mockImplementationOnce(createdSuggestionFromData("suggestion-1"))
      .mockImplementationOnce(createdSuggestionFromData("suggestion-2"));

    const result = await planDay("mock-user", {
      date: "2026-04-27"
    });

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.map((suggestion) => suggestion.taskId)).toEqual(["task-1", "task-2"]);
    expect(result.suggestions[0]?.endAt).toBe(result.suggestions[1]?.startAt);
  });

  it("does not schedule a task into the past for today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T01:45:00.000Z"));
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:00:00.000Z")
      }
    ]);
    prismaMock.taskSuggestion.create.mockImplementation(createdSuggestionFromData("suggestion-1"));

    const result = await planDay("mock-user", {
      date: "2026-04-27"
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.startAt).toBe("2026-04-27T01:45:00.000Z");
    expect(result.suggestions[0]?.endAt).toBe("2026-04-27T02:15:00.000Z");
  });

  it("returns no suggestions when today is already past work hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T03:30:00.000Z"));
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:00:00.000Z")
      }
    ]);

    const result = await planDay("mock-user", {
      date: "2026-04-27"
    });

    expect(result.suggestions).toEqual([]);
    expect(prismaMock.taskSuggestion.create).not.toHaveBeenCalled();
  });

  it("expires stale active suggestions on repeated planDay runs", async () => {
    prismaMock.taskSuggestion.findMany
      .mockResolvedValueOnce([
        {
          id: "stale-suggestion",
          taskId: "task-1"
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.taskSchedule.findMany.mockResolvedValueOnce([]);
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:00:00.000Z")
      }
    ]);
    prismaMock.taskSuggestion.create.mockImplementation(createdSuggestionFromData("fresh-suggestion"));

    const result = await planDay("mock-user", {
      date: "2026-04-27"
    });

    expect(prismaMock.taskSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "mock-user",
          status: SuggestionStatus.ACTIVE
        }),
        data: {
          status: SuggestionStatus.EXPIRED
        }
      })
    );
    expect(result.suggestions[0]?.id).toBe("fresh-suggestion");
  });

  it("re-suggests a task recovered from a stale prior-day suggestion", async () => {
    prismaMock.taskSuggestion.findMany
      .mockResolvedValueOnce([
        {
          taskId: "task-1"
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:00:00.000Z")
      }
    ]);
    prismaMock.taskSuggestion.create.mockImplementation(createdSuggestionFromData("suggestion-1"));

    const result = await planDay("mock-user", {
      date: "2026-04-30"
    });

    expect(prismaMock.taskSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "mock-user",
          status: SuggestionStatus.ACTIVE,
          date: {
            lt: new Date("2026-04-29T15:00:00.000Z")
          }
        }),
        data: {
          status: SuggestionStatus.EXPIRED
        }
      })
    );
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.taskId).toBe("task-1");
  });

  it("does not place suggestions on top of routines", async () => {
    prismaMock.routine.findMany.mockResolvedValue([
      {
        id: "routine-1",
        userId: "mock-user",
        title: "Routine",
        startTime: "09:00",
        endTime: "10:00",
        daysOfWeek: [1],
        isActive: true,
        createdAt: new Date("2026-04-26T00:00:00.000Z"),
        updatedAt: new Date("2026-04-26T00:00:00.000Z")
      }
    ]);
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: TaskStatus.UNSCHEDULED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:00:00.000Z")
      }
    ]);
    prismaMock.taskSuggestion.create.mockImplementation(createdSuggestionFromData("suggestion-1"));

    const result = await planDay("mock-user", {
      date: "2026-04-27"
    });

    expect(result.suggestions[0]?.startAt).toBe("2026-04-27T01:00:00.000Z");
  });

  it("treats MISSED tasks as eligible and moves them to SUGGESTED", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: TaskStatus.MISSED,
        deadline: null,
        durationMinutes: 30,
        createdAt: new Date("2026-04-20T00:00:00.000Z")
      }
    ]);
    prismaMock.taskSuggestion.create.mockImplementation(createdSuggestionFromData("suggestion-1"));

    const result = await planDay("mock-user", {
      date: "2026-04-27"
    });

    expect(result.suggestions).toHaveLength(1);
    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: TaskStatus.SUGGESTED }
    });
  });

  it("acceptSuggestion creates a schedule and marks the task SCHEDULED", async () => {
    prismaMock.taskSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      taskId: "task-1",
      userId: "mock-user",
      startAt: new Date("2026-04-27T00:00:00.000Z"),
      endAt: new Date("2026-04-27T00:30:00.000Z"),
      date: new Date("2026-04-26T15:00:00.000Z"),
      status: SuggestionStatus.ACTIVE
    });
    prismaMock.taskSchedule.findFirst.mockResolvedValue(null);
    prismaMock.calendarEvent.findFirst.mockResolvedValue(null);
    prismaMock.routine.findMany.mockResolvedValue([]);
    prismaMock.taskSchedule.create.mockImplementation(async ({ data }) => ({
      id: "schedule-1",
      ...data
    }));

    const result = await acceptSuggestion("mock-user", "suggestion-1");

    expect(prismaMock.taskSchedule.create).toHaveBeenCalled();
    expect(prismaMock.taskSuggestion.update).toHaveBeenCalledWith({
      where: { id: "suggestion-1" },
      data: { status: SuggestionStatus.ACCEPTED }
    });
    expect(result.task.status).toBe("SCHEDULED");
    expect(result.schedule.id).toBe("schedule-1");
  });

  it("accepting the same suggestion twice does not create duplicate schedules", async () => {
    prismaMock.taskSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      taskId: "task-1",
      userId: "mock-user",
      startAt: new Date("2026-04-27T00:00:00.000Z"),
      endAt: new Date("2026-04-27T00:30:00.000Z"),
      date: new Date("2026-04-26T15:00:00.000Z"),
      status: SuggestionStatus.ACCEPTED
    });
    prismaMock.taskSchedule.findFirst.mockResolvedValue({
      id: "schedule-1",
      taskId: "task-1",
      startAt: new Date("2026-04-27T00:00:00.000Z"),
      endAt: new Date("2026-04-27T00:30:00.000Z"),
      completionStatus: CompletionStatus.PENDING
    });

    const result = await acceptSuggestion("mock-user", "suggestion-1");

    expect(prismaMock.taskSchedule.create).not.toHaveBeenCalled();
    expect(result.schedule.id).toBe("schedule-1");
  });

  it("dismissSuggestion marks the suggestion DISMISSED and task UNSCHEDULED", async () => {
    prismaMock.taskSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      taskId: "task-1",
      userId: "mock-user",
      status: SuggestionStatus.ACTIVE
    });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      status: TaskStatus.UNSCHEDULED
    });

    const result = await dismissSuggestion("mock-user", "suggestion-1");

    expect(prismaMock.taskSuggestion.update).toHaveBeenCalledWith({
      where: { id: "suggestion-1" },
      data: { status: SuggestionStatus.DISMISSED }
    });
    expect(result).toEqual({
      success: true,
      task: {
        id: "task-1",
        status: "UNSCHEDULED"
      }
    });
  });

  it("retrySuggestion marks the old suggestion REPLACED and creates a new ACTIVE suggestion", async () => {
    prismaMock.taskSuggestion.findFirst
      .mockResolvedValueOnce({
        id: "suggestion-1",
        taskId: "task-1",
        userId: "mock-user",
        startAt: new Date("2026-04-27T00:00:00.000Z"),
        endAt: new Date("2026-04-27T00:30:00.000Z"),
        date: new Date("2026-04-26T15:00:00.000Z"),
        status: SuggestionStatus.ACTIVE
      })
      .mockResolvedValueOnce(null);
    prismaMock.task.findFirst.mockResolvedValue({
      id: "task-1",
      userId: "mock-user",
      durationMinutes: 30,
      deadline: null
    });
    prismaMock.taskSuggestion.findMany.mockResolvedValue([]);
    prismaMock.taskSchedule.findMany.mockResolvedValue([]);
    prismaMock.calendarEvent.findMany.mockResolvedValue([]);
    prismaMock.taskSuggestion.create.mockImplementation(async ({ data }) => ({
      id: "suggestion-2",
      ...data,
      generatedAt: new Date("2026-04-26T00:00:00.000Z"),
      expiresAt: null
    }));

    const result = await retrySuggestion("mock-user", "suggestion-1");

    expect(prismaMock.taskSuggestion.update).toHaveBeenCalledWith({
      where: { id: "suggestion-1" },
      data: { status: SuggestionStatus.REPLACED }
    });
    expect(prismaMock.taskSuggestion.create).toHaveBeenCalled();
    expect(result).toEqual({
      suggestion: {
        id: "suggestion-2",
        taskId: "task-1",
        startAt: "2026-04-27T00:30:00.000Z",
        endAt: "2026-04-27T01:00:00.000Z",
        status: "ACTIVE"
      }
    });
  });

  it("retrySuggestion does not create a replacement in the past for today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T01:45:00.000Z"));
    prismaMock.taskSuggestion.findFirst
      .mockResolvedValueOnce({
        id: "suggestion-1",
        taskId: "task-1",
        userId: "mock-user",
        startAt: new Date("2026-04-27T00:00:00.000Z"),
        endAt: new Date("2026-04-27T00:30:00.000Z"),
        date: new Date("2026-04-26T15:00:00.000Z"),
        status: SuggestionStatus.ACTIVE
      })
      .mockResolvedValueOnce(null);
    prismaMock.task.findFirst.mockResolvedValue({
      id: "task-1",
      userId: "mock-user",
      durationMinutes: 30,
      deadline: null
    });
    prismaMock.taskSuggestion.findMany.mockResolvedValue([]);
    prismaMock.taskSchedule.findMany.mockResolvedValue([]);
    prismaMock.calendarEvent.findMany.mockResolvedValue([]);
    prismaMock.taskSuggestion.create.mockImplementation(async ({ data }) => ({
      id: "suggestion-2",
      ...data,
      generatedAt: new Date("2026-04-26T00:00:00.000Z"),
      expiresAt: null
    }));

    const result = await retrySuggestion("mock-user", "suggestion-1");

    expect(result).toEqual({
      suggestion: {
        id: "suggestion-2",
        taskId: "task-1",
        startAt: "2026-04-27T01:45:00.000Z",
        endAt: "2026-04-27T02:15:00.000Z",
        status: "ACTIVE"
      }
    });
  });

  it("acceptSuggestion rejects routine conflicts", async () => {
    prismaMock.taskSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      taskId: "task-1",
      userId: "mock-user",
      startAt: new Date("2026-04-27T00:00:00.000Z"),
      endAt: new Date("2026-04-27T00:30:00.000Z"),
      date: new Date("2026-04-26T15:00:00.000Z"),
      status: SuggestionStatus.ACTIVE
    });
    prismaMock.taskSchedule.findFirst.mockResolvedValue(null);
    prismaMock.calendarEvent.findFirst.mockResolvedValue(null);
    prismaMock.routine.findMany.mockResolvedValue([
      {
        startTime: "09:00",
        endTime: "10:00"
      }
    ]);

    await expect(acceptSuggestion("mock-user", "suggestion-1")).rejects.toMatchObject<AppError>({
      status: 409,
      code: "CONFLICT"
    });
  });
});
