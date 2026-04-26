import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompletionStatus, SuggestionStatus, TaskStatus } from "@prisma/client";

import { AppError } from "../../lib/api-errors";
import { prismaMock, resetPrismaMock } from "../../test/prisma-mock";

vi.mock("../../lib/db", () => ({
  prisma: prismaMock
}));

import { completeSchedule, markScheduleMissed } from "./schedule.service";

describe("schedule.service", () => {
  beforeEach(() => {
    resetPrismaMock();
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
});
