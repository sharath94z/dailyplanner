import "server-only";

import { prisma } from "../../lib/db";
import type { CreateRoutineInput } from "../../lib/validators/routine";
import { AppError } from "../../lib/api-errors";

export type SerializedRoutine = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function parseMinutes(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new AppError(400, "VALIDATION_ERROR", "time must be in HH:MM format");
  }

  const [hours, minutes] = time.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new AppError(400, "VALIDATION_ERROR", "time must be a valid 24-hour time");
  }

  return hours * 60 + minutes;
}

function serializeRoutine(routine: {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SerializedRoutine {
  return {
    id: routine.id,
    title: routine.title,
    startTime: routine.startTime,
    endTime: routine.endTime,
    daysOfWeek: routine.daysOfWeek,
    isActive: routine.isActive,
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString()
  };
}

export async function createRoutine(userId: string, input: CreateRoutineInput) {
  const startMinutes = parseMinutes(input.startTime);
  const endMinutes = parseMinutes(input.endTime);

  if (startMinutes >= endMinutes) {
    throw new AppError(400, "VALIDATION_ERROR", "startTime must be earlier than endTime", {
      field: "startTime"
    });
  }

  const routine = await prisma.routine.create({
    data: {
      userId,
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      daysOfWeek: [...new Set(input.daysOfWeek)].sort((left, right) => left - right),
      isActive: input.isActive ?? true
    }
  });

  return {
    routine: serializeRoutine(routine)
  };
}
