import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}$/;

function parseTimeToMinutes(value: string) {
  if (!timeRegex.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export const createTaskScheduleSchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),
    date: z.string().regex(dateOnlyRegex, "date must be in YYYY-MM-DD format"),
    startTime: z
      .string()
      .regex(timeRegex, "startTime must be in HH:mm format")
      .refine((value) => parseTimeToMinutes(value) !== null, {
        message: "startTime must be a valid 24-hour time"
      }),
    durationMinutes: z.number().int().positive("durationMinutes must be positive")
  })
  .strict();

export type CreateTaskScheduleInput = z.infer<typeof createTaskScheduleSchema>;
