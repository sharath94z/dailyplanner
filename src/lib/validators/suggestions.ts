import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const planDaySchema = z
  .object({
    date: z.string().regex(dateOnlyRegex, "date must be in YYYY-MM-DD format").optional()
  })
  .strict();

export type PlanDayInput = z.infer<typeof planDaySchema>;
