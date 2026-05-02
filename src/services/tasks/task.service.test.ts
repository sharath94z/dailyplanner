import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock, resetPrismaMock } from "../../test/prisma-mock";

vi.mock("../../lib/db", () => ({
  prisma: prismaMock
}));

import { getTaskAggregates } from "./task.service";

describe("task.service", () => {
  beforeEach(() => {
    resetPrismaMock();
    prismaMock.task.count.mockResolvedValue(4);
    prismaMock.task.aggregate.mockResolvedValue({
      _sum: {
        durationMinutes: 150
      }
    });
  });

  it("returns timeline header aggregates from the full task set", async () => {
    const result = await getTaskAggregates("mock-user");

    expect(prismaMock.task.count).toHaveBeenCalledWith({
      where: {
        userId: "mock-user",
        status: {
          notIn: ["COMPLETED", "ARCHIVED"]
        }
      }
    });
    expect(prismaMock.task.aggregate).toHaveBeenCalledWith({
      where: {
        userId: "mock-user",
        status: {
          in: ["UNSCHEDULED", "MISSED"]
        }
      },
      _sum: {
        durationMinutes: true
      }
    });
    expect(result).toEqual({
      openTaskCount: 4,
      unscheduledDurationMinutes: 150
    });
  });
});
