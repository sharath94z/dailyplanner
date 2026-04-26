import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const queryBoolean = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean().optional());

export const timelineQuerySchema = z
  .object({
    date: z.string().regex(dateOnlyRegex, "date must be in YYYY-MM-DD format"),
    includeSuggestions: queryBoolean.default(true),
    includeCalendar: queryBoolean.default(true)
  })
  .strict();

export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
