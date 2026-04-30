import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompletionStatus, SuggestionStatus, TaskStatus } from "@prisma/client";

import { AppError } from "../../lib/api-errors";
import { prismaMock, resetPrismaMock } from "../../test/prisma-mock";

vi.mock("../../lib/db", () => ({
  prisma: prismaMock
}));

import {
  completeSchedule,
  markScheduleMissed,
  reconcileStaleSuggestionsForDay
} from "./schedule.service";

describe("schedule.service", () => {
  beforeEach(() => {
    resetPrismaMock();
    prismaMock.taskSuggestion.findMany.mockResolvedValue([]);
    prismaMock.taskSuggestion.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 });
  });

  it("completeSchedule marks the schedule COMPLETED and task COMPLETED", async () => {
    prismaMock.taskSchedule.findFirst.mockResolvedValue({
      id: "schedule-1",
      userId: "mock-user",
      completionStatus: CompletionStatus.PENDING,
      task: {
        id: "task-1",
        status: TaskStatus.SCHEDULED
      }
    });

    const result = await completeSchedule("mock-user", "schedule-1");

    expect(prismaMock.taskSchedule.update).toHaveBeenCalledWith({
      where: { id: "schedule-1" },
      data: { completionStatus: CompletionStatus.COMPLETED }
    });
    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: TaskStatus.COMPLETED }
    });
    expect(prismaMock.taskSuggestion.updateMany).toHaveBeenCalledWith({
      where: {
        taskId: "task-1",
        userId: "mock-user",
        status: SuggestionStatus.ACTIVE
      },
      data: {
        status: SuggestionStatus.EXPIRED
      }
    });
    expect(result).toEqual({
      success: true,
      task: { id: "task-1", status: "COMPLETED" },
      schedule: { id: "schedule-1", completionStatus: "COMPLETED" }
    });
  });

  it("markScheduleMissed marks the schedule MISSED and task MISSED", async () => {
    prismaMock.taskSchedule.findFirst.mockResolvedValue({
      id: "schedule-1",
      userId: "mock-user",
      completionStatus: CompletionStatus.PENDING,
      task: {
        id: "task-1",
        status: TaskStatus.SCHEDULED
      }
    });

    const result = await markScheduleMissed("mock-user", "schedule-1");

    expect(prismaMock.taskSchedule.update).toHaveBeenCalledWith({
      where: { id: "schedule-1" },
      data: { completionStatus: CompletionStatus.MISSED }
    });
    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: TaskStatus.MISSED }
    });
    expect(result).toEqual({
      task: { id: "task-1", status: "MISSED" },
      schedule: { id: "schedule-1", completionStatus: "MISSED" },
      suggestion: null
    });
  });

  it("rejects completion when the task is not scheduled", async () => {
    prismaMock.taskSchedule.findFirst.mockResolvedValue({
      id: "schedule-1",
      userId: "mock-user",
      completionStatus: CompletionStatus.PENDING,
      task: {
        id: "task-1",
        status: TaskStatus.UNSCHEDULED
      }
    });

    await expect(completeSchedule("mock-user", "schedule-1")).rejects.toMatchObject<AppError>({
      status: 409,
      code: "INVALID_STATE"
    });
  });

  it("expires stale prior-day ACTIVE suggestions and restores the task to UNSCHEDULED", async () => {
    prismaMock.taskSuggestion.findMany
      .mockResolvedValueOnce([
        {
          taskId: "task-1"
        }
      ])
      .mockResolvedValueOnce([]);

    await reconcileStaleSuggestionsForDay(
      "mock-user",
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );

    expect(prismaMock.taskSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "mock-user",
          status: SuggestionStatus.ACTIVE,
          date: {
            lt: new Date("2026-04-30T00:00:00.000Z")
          }
        }),
        data: {
          status: SuggestionStatus.EXPIRED
        }
      })
    );
    expect(prismaMock.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "mock-user",
          id: {
            in: ["task-1"]
          },
          status: TaskStatus.SUGGESTED
        }),
        data: {
          status: TaskStatus.UNSCHEDULED
        }
      })
    );
  });

  it("preserves a task when another ACTIVE suggestion remains", async () => {
    prismaMock.taskSuggestion.findMany
      .mockResolvedValueOnce([
        {
          taskId: "task-1"
        }
      ])
      .mockResolvedValueOnce([
        {
          taskId: "task-1"
        }
      ]);

    await reconcileStaleSuggestionsForDay(
      "mock-user",
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );

    expect(prismaMock.taskSuggestion.updateMany).toHaveBeenCalled();
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled();
  });
});
