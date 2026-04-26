import { z } from "zod";

const isoDateTime = z.string().datetime().transform((value) => new Date(value));
const nullableIsoDateTime = z.union([isoDateTime, z.null()]).optional();

const enumTaskStatus = z.enum([
  "UNSCHEDULED",
  "SUGGESTED",
  "SCHEDULED",
  "COMPLETED",
  "MISSED",
  "ARCHIVED"
]);

const enumPriority = z.enum(["LOW", "MEDIUM", "HIGH"]);
const enumEffortLevel = z.enum(["LOW", "MEDIUM", "HIGH"]);
const enumTaskType = z.enum(["DEEP_WORK", "ADMIN", "ROUTINE", "ERRAND", "GENERIC"]);

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

const queryInt = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().int().positive());

export const taskCreateSchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),
    notes: z.string().optional(),
    priority: enumPriority.optional().default("MEDIUM"),
    deadline: nullableIsoDateTime,
    durationMinutes: z.number().int().positive().nullable().optional(),
    effortLevel: enumEffortLevel.nullable().optional(),
    taskType: enumTaskType.nullable().optional(),
    splittable: z.boolean().nullable().optional()
  })
  .strict();

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    notes: z.string().optional().nullable(),
    priority: enumPriority.optional(),
    deadline: nullableIsoDateTime,
    durationMinutes: z.number().int().positive().nullable().optional(),
    effortLevel: enumEffortLevel.optional(),
    taskType: enumTaskType.optional(),
    splittable: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export const taskListQuerySchema = z
  .object({
    status: enumTaskStatus.optional(),
    priority: enumPriority.optional(),
    limit: queryInt.optional().default(20),
    cursor: z.string().trim().min(1).optional(),
    includeArchived: queryBoolean.default(false)
  })
  .strict();

export const taskGetQuerySchema = z
  .object({
    includeSchedules: queryBoolean.default(false),
    includeSuggestions: queryBoolean.default(false),
    includeHistory: queryBoolean.default(false)
  })
  .strict();

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
export type TaskGetQuery = z.infer<typeof taskGetQuerySchema>;
