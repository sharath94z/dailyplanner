import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../lib/api-errors";
import { createRoutineSchema } from "../../lib/validators/routine";
import { prismaMock, resetPrismaMock } from "../../test/prisma-mock";

vi.mock("../../lib/db", () => ({
  prisma: prismaMock
}));

import { createRoutine } from "./routine.service";

describe("routine.service", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("rejects invalid HH:MM values at the schema layer", () => {
    const result = createRoutineSchema.safeParse({
      title: "Bad routine",
      startTime: "24:60",
      endTime: "25:00",
      daysOfWeek: [1]
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid HH:MM values at the service layer", async () => {
    await expect(
      createRoutine("mock-user", {
        title: "Bad routine",
        startTime: "99:00",
        endTime: "99:30",
        daysOfWeek: [1]
      })
    ).rejects.toMatchObject<AppError>({
      status: 400,
      code: "VALIDATION_ERROR"
    });
  });

  it("rejects endTime that is not later than startTime", async () => {
    await expect(
      createRoutine("mock-user", {
        title: "Backwards",
        startTime: "10:00",
        endTime: "09:00",
        daysOfWeek: [1]
      })
    ).rejects.toMatchObject<AppError>({
      status: 400,
      code: "VALIDATION_ERROR"
    });
  });

  it("creates a routine with normalized weekday ordering", async () => {
    prismaMock.routine.create.mockImplementation(async ({ data }) => ({
      id: "routine-1",
      ...data,
      createdAt: new Date("2026-04-27T00:00:00.000Z"),
      updatedAt: new Date("2026-04-27T00:00:00.000Z")
    }));

    const result = await createRoutine("mock-user", {
      title: "Lunch",
      startTime: "12:00",
      endTime: "13:00",
      daysOfWeek: [5, 1, 1, 3]
    });

    expect(prismaMock.routine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          daysOfWeek: [1, 3, 5]
        })
      })
    );
    expect(result.routine.daysOfWeek).toEqual([1, 3, 5]);
  });
});
