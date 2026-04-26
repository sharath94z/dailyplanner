import { z } from "zod";

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

export const createRoutineSchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),
    startTime: z
      .string()
      .regex(timeRegex, "startTime must be in HH:MM format")
      .refine((value) => parseTimeToMinutes(value) !== null, {
        message: "startTime must be a valid 24-hour time"
      }),
    endTime: z
      .string()
      .regex(timeRegex, "endTime must be in HH:MM format")
      .refine((value) => parseTimeToMinutes(value) !== null, {
        message: "endTime must be a valid 24-hour time"
      }),
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(1, "daysOfWeek must contain at least one day"),
    isActive: z.boolean().optional()
  })
  .strict()
  .superRefine((value, context) => {
    const startMinutes = parseTimeToMinutes(value.startTime);
    const endMinutes = parseTimeToMinutes(value.endTime);

    if (startMinutes === null || endMinutes === null) {
      return;
    }

    if (endMinutes <= startMinutes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "endTime must be later than startTime"
      });
    }
  });

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
