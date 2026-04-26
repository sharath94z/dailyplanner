import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

export const createRoutineSchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),
    startTime: z.string().regex(timeRegex, "startTime must be in HH:MM format"),
    endTime: z.string().regex(timeRegex, "endTime must be in HH:MM format"),
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(1, "daysOfWeek must contain at least one day"),
    isActive: z.boolean().optional()
  })
  .strict();

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
