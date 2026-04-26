import "server-only";

import {
  CompletionStatus,
  Prisma,
  SchedulingRunStatus,
  SchedulingTriggerType,
  SuggestionStatus,
  TaskStatus,
  type Task,
  type TaskSchedule,
  type TaskSuggestion
} from "@prisma/client";

import { AppError } from "../../lib/api-errors";
import { prisma } from "../../lib/db";
import type { PlanDayInput } from "../../lib/validators/suggestions";

const DEFAULT_WORKDAY_START = "09:00";
const DEFAULT_WORKDAY_END = "18:00";
const DEFAULT_TASK_DURATION_MINUTES = 30;
const DEFAULT_SUGGESTION_LIMIT = 5;
const MINIMUM_USEFUL_DURATION_MINUTES = 15;

type OccupiedBlock = {
  startAt: Date;
  endAt: Date;
};

export type PlannedSuggestion = {
  id: string;
  taskId: string;
  startAt: string;
  endAt: string;
  date: string;
  rank: number | null;
  score: number | null;
  status: SuggestionStatus;
  reasonSummary: Prisma.JsonValue | null;
  generatedAt: string;
  expiresAt: string | null;
};

export type PlanDayResult = {
  suggestions: PlannedSuggestion[];
  runSummary: {
    triggerType: "PLAN_DAY";
    eligibleTaskCount: number;
    suggestionCount: number;
    unscheduledTaskCount: number;
  };
};

export type AcceptSuggestionResult = {
  schedule: {
    id: string;
    taskId: string;
    startAt: string;
    endAt: string;
    completionStatus: CompletionStatus;
  };
  task: {
    id: string;
    status: "SCHEDULED";
  };
};

export type DismissSuggestionResult = {
  success: true;
  task: {
    id: string;
    status: "UNSCHEDULED";
  };
};

export type RetrySuggestionResult =
  | {
      suggestion: {
        id: string;
        taskId: string;
        startAt: string;
        endAt: string;
        status: "ACTIVE";
      };
    }
  | {
      suggestion: null;
      message: "No better time available today";
    };

type SchedulerPreferences = {
  workDayStart: string;
  workDayEnd: string;
  defaultTaskDuration: number;
  suggestionLimit: number;
};

type EligibleTask = {
  id: string;
  deadline: Date | null;
  durationMinutes: number;
};

type SchedulerDayData = {
  preferences: SchedulerPreferences;
  dayStart: Date;
  dayEnd: Date;
  availabilityStart: Date;
  availabilityEnd: Date;
  occupiedBlocks: OccupiedBlock[];
};

function getTodayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function parseDateStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseTimeParts(value: string, fallback: string): { hours: number; minutes: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const fallbackMatch = /^(\d{2}):(\d{2})$/.exec(fallback);

  if (!match || !fallbackMatch) {
    throw new Error("Invalid scheduler time configuration");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return {
      hours: Number(fallbackMatch[1]),
      minutes: Number(fallbackMatch[2])
    };
  }

  return { hours, minutes };
}

function setUtcTime(baseDate: Date, time: string, fallback: string): Date {
  const { hours, minutes } = parseTimeParts(time, fallback);
  const next = new Date(baseDate);
  next.setUTCHours(hours, minutes, 0, 0);
  return next;
}

function getDurationMinutes(startAt: Date, endAt: Date): number {
  return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
}

function normalizePreferences(preferences: {
  workDayStart: string;
  workDayEnd: string;
  defaultTaskDuration: number;
  suggestionLimit: number;
} | null): SchedulerPreferences {
  return {
    workDayStart: preferences?.workDayStart ?? DEFAULT_WORKDAY_START,
    workDayEnd: preferences?.workDayEnd ?? DEFAULT_WORKDAY_END,
    defaultTaskDuration: preferences?.defaultTaskDuration ?? DEFAULT_TASK_DURATION_MINUTES,
    suggestionLimit: preferences?.suggestionLimit ?? DEFAULT_SUGGESTION_LIMIT
  };
}

function mergeOccupiedBlocks(blocks: OccupiedBlock[]): OccupiedBlock[] {
  if (blocks.length === 0) {
    return [];
  }

  const sortedBlocks = [...blocks].sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
  const merged: OccupiedBlock[] = [sortedBlocks[0]];

  for (const block of sortedBlocks.slice(1)) {
    const current = merged[merged.length - 1];

    if (block.startAt.getTime() <= current.endAt.getTime()) {
      if (block.endAt.getTime() > current.endAt.getTime()) {
        current.endAt = block.endAt;
      }
      continue;
    }

    merged.push({ startAt: block.startAt, endAt: block.endAt });
  }

  return merged;
}

function buildFreeSlots(
  availabilityStart: Date,
  availabilityEnd: Date,
  occupiedBlocks: OccupiedBlock[]
): OccupiedBlock[] {
  if (availabilityStart.getTime() >= availabilityEnd.getTime()) {
    return [];
  }

  const clippedBlocks = occupiedBlocks
    .map((block) => ({
      startAt: new Date(Math.max(block.startAt.getTime(), availabilityStart.getTime())),
      endAt: new Date(Math.min(block.endAt.getTime(), availabilityEnd.getTime()))
    }))
    .filter((block) => block.startAt.getTime() < block.endAt.getTime());

  const mergedBlocks = mergeOccupiedBlocks(clippedBlocks);
  const freeSlots: OccupiedBlock[] = [];
  let cursor = availabilityStart;

  for (const block of mergedBlocks) {
    if (cursor.getTime() < block.startAt.getTime()) {
      const slot = {
        startAt: cursor,
        endAt: block.startAt
      };

      if (getDurationMinutes(slot.startAt, slot.endAt) >= MINIMUM_USEFUL_DURATION_MINUTES) {
        freeSlots.push(slot);
      }
    }

    if (cursor.getTime() < block.endAt.getTime()) {
      cursor = block.endAt;
    }
  }

  if (cursor.getTime() < availabilityEnd.getTime()) {
    const trailingSlot = {
      startAt: cursor,
      endAt: availabilityEnd
    };

    if (getDurationMinutes(trailingSlot.startAt, trailingSlot.endAt) >= MINIMUM_USEFUL_DURATION_MINUTES) {
      freeSlots.push(trailingSlot);
    }
  }

  return freeSlots;
}

function serializeSuggestion(suggestion: {
  id: string;
  taskId: string;
  startAt: Date;
  endAt: Date;
  date: Date;
  rank: number | null;
  score: number | null;
  status: SuggestionStatus;
  reasonSummary: Prisma.JsonValue | null;
  generatedAt: Date;
  expiresAt: Date | null;
}): PlannedSuggestion {
  return {
    id: suggestion.id,
    taskId: suggestion.taskId,
    startAt: suggestion.startAt.toISOString(),
    endAt: suggestion.endAt.toISOString(),
    date: suggestion.date.toISOString(),
    rank: suggestion.rank ?? null,
    score: suggestion.score ?? null,
    status: suggestion.status,
    reasonSummary: suggestion.reasonSummary ?? null,
    generatedAt: suggestion.generatedAt.toISOString(),
    expiresAt: suggestion.expiresAt?.toISOString() ?? null
  };
}

function serializeAcceptSchedule(schedule: TaskSchedule): AcceptSuggestionResult["schedule"] {
  return {
    id: schedule.id,
    taskId: schedule.taskId,
    startAt: schedule.startAt.toISOString(),
    endAt: schedule.endAt.toISOString(),
    completionStatus: schedule.completionStatus
  };
}

function serializeTaskStatus(task: Task): { id: string; status: TaskStatus } {
  return {
    id: task.id,
    status: task.status
  };
}

function serializeRetrySuggestion(suggestion: TaskSuggestion): {
  id: string;
  taskId: string;
  startAt: string;
  endAt: string;
  status: "ACTIVE";
} {
  return {
    id: suggestion.id,
    taskId: suggestion.taskId,
    startAt: suggestion.startAt.toISOString(),
    endAt: suggestion.endAt.toISOString(),
    status: "ACTIVE"
  };
}

async function getSuggestionForUser(userId: string, suggestionId: string) {
  const suggestion = await prisma.taskSuggestion.findFirst({
    where: {
      id: suggestionId,
      userId
    }
  });

  if (!suggestion) {
    throw new AppError(404, "NOT_FOUND", "Suggestion not found");
  }

  return suggestion;
}

async function ensureNoAcceptanceConflicts(userId: string, suggestion: TaskSuggestion) {
  const [conflictingSchedule, conflictingCalendarEvent] = await Promise.all([
    prisma.taskSchedule.findFirst({
      where: {
        userId,
        startAt: {
          lt: suggestion.endAt
        },
        endAt: {
          gt: suggestion.startAt
        },
        NOT: {
          taskId: suggestion.taskId,
          startAt: suggestion.startAt,
          endAt: suggestion.endAt,
          date: suggestion.date
        }
      },
      select: {
        id: true
      }
    }),
    prisma.calendarEvent.findFirst({
      where: {
        userId,
        startAt: {
          lt: suggestion.endAt
        },
        endAt: {
          gt: suggestion.startAt
        }
      },
      select: {
        id: true
      }
    })
  ]);

  if (conflictingSchedule || conflictingCalendarEvent) {
    throw new AppError(409, "CONFLICT", "Suggestion conflicts with an occupied block");
  }
}

async function getExactMatchingSchedule(userId: string, suggestion: TaskSuggestion) {
  return prisma.taskSchedule.findFirst({
    where: {
      userId,
      taskId: suggestion.taskId,
      startAt: suggestion.startAt,
      endAt: suggestion.endAt,
      date: suggestion.date
    }
  });
}

async function getTaskForUser(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId
    }
  });

  if (!task) {
    throw new AppError(404, "NOT_FOUND", "Task not found");
  }

  return task;
}

async function getLatestActiveSuggestionForTaskDate(
  userId: string,
  taskId: string,
  date: Date
) {
  return prisma.taskSuggestion.findFirst({
    where: {
      userId,
      taskId,
      status: SuggestionStatus.ACTIVE,
      date
    },
    orderBy: [{ generatedAt: "desc" }, { id: "desc" }]
  });
}

async function loadSchedulerDayData(
  userId: string,
  dayStart: Date,
  excludedSuggestionId?: string
): Promise<SchedulerDayData> {
  const dayEnd = addDays(dayStart, 1);

  const [preferencesRecord, taskSchedules, activeSuggestions, calendarEvents] = await Promise.all([
    prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        workDayStart: true,
        workDayEnd: true,
        defaultTaskDuration: true,
        suggestionLimit: true
      }
    }),
    prisma.taskSchedule.findMany({
      where: {
        userId,
        date: {
          gte: dayStart,
          lt: dayEnd
        }
      },
      select: {
        startAt: true,
        endAt: true
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }]
    }),
    prisma.taskSuggestion.findMany({
      where: {
        userId,
        status: SuggestionStatus.ACTIVE,
        date: {
          gte: dayStart,
          lt: dayEnd
        },
        ...(excludedSuggestionId
          ? {
              id: {
                not: excludedSuggestionId
              }
            }
          : {})
      },
      select: {
        startAt: true,
        endAt: true
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }]
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: {
          lt: dayEnd
        },
        endAt: {
          gt: dayStart
        }
      },
      select: {
        startAt: true,
        endAt: true
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }]
    })
  ]);

  const preferences = normalizePreferences(preferencesRecord);
  const availabilityStart = setUtcTime(dayStart, preferences.workDayStart, DEFAULT_WORKDAY_START);
  const availabilityEnd = setUtcTime(dayStart, preferences.workDayEnd, DEFAULT_WORKDAY_END);
  const occupiedBlocks: OccupiedBlock[] = [
    ...taskSchedules.map((schedule) => ({
      startAt: schedule.startAt,
      endAt: schedule.endAt
    })),
    ...activeSuggestions.map((suggestion) => ({
      startAt: suggestion.startAt,
      endAt: suggestion.endAt
    })),
    ...calendarEvents.map((event) => ({
      startAt: event.startAt,
      endAt: event.endAt
    }))
  ];

  return {
    preferences,
    dayStart,
    dayEnd,
    availabilityStart,
    availabilityEnd,
    occupiedBlocks
  };
}

async function persistSchedulingRun(input: {
  userId: string;
  dayStart: Date;
  dayEnd: Date;
  eligibleTaskCount: number;
  suggestionCount: number;
  unscheduledTaskCount: number;
}) {
  await prisma.schedulingRun.create({
    data: {
      userId: input.userId,
      triggerType: SchedulingTriggerType.PLAN_DAY,
      dateRangeStart: input.dayStart,
      dateRangeEnd: input.dayEnd,
      status: SchedulingRunStatus.SUCCESS,
      summary: {
        triggerType: "PLAN_DAY",
        eligibleTaskCount: input.eligibleTaskCount,
        suggestionCount: input.suggestionCount,
        unscheduledTaskCount: input.unscheduledTaskCount
      }
    }
  });
}

export async function planDay(userId: string, input: PlanDayInput): Promise<PlanDayResult> {
  const date = input.date ?? getTodayDateString();
  const dayStart = parseDateStart(date);
  const dayEnd = addDays(dayStart, 1);

  const [preferencesRecord, candidateTasks, activeSuggestions, taskSchedules, calendarEvents] =
    await Promise.all([
      prisma.userPreferences.findUnique({
        where: { userId },
        select: {
          workDayStart: true,
          workDayEnd: true,
          defaultTaskDuration: true,
          suggestionLimit: true
        }
      }),
      prisma.task.findMany({
        where: {
          userId,
          status: {
            in: [TaskStatus.UNSCHEDULED, TaskStatus.MISSED]
          }
        },
        select: {
          id: true,
          status: true,
          deadline: true,
          durationMinutes: true,
          createdAt: true
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      }),
      prisma.taskSuggestion.findMany({
        where: {
          userId,
          status: SuggestionStatus.ACTIVE,
          date: {
            gte: dayStart,
            lt: dayEnd
          }
        },
        select: {
          id: true,
          taskId: true,
          startAt: true,
          endAt: true
        },
        orderBy: [{ startAt: "asc" }, { id: "asc" }]
      }),
      prisma.taskSchedule.findMany({
        where: {
          userId,
          date: {
            gte: dayStart,
            lt: dayEnd
          }
        },
        select: {
          startAt: true,
          endAt: true
        },
        orderBy: [{ startAt: "asc" }, { id: "asc" }]
      }),
      prisma.calendarEvent.findMany({
        where: {
          userId,
          startAt: {
            lt: dayEnd
          },
          endAt: {
            gt: dayStart
          }
        },
        select: {
          startAt: true,
          endAt: true
        },
        orderBy: [{ startAt: "asc" }, { id: "asc" }]
        })
    ]);

  const preferences = normalizePreferences(preferencesRecord);
  const unscheduledTaskCount = candidateTasks.filter(
    (task) => task.status === TaskStatus.UNSCHEDULED
  ).length;

  if (preferences.suggestionLimit <= 0) {
    await persistSchedulingRun({
      userId,
      dayStart,
      dayEnd,
      eligibleTaskCount: 0,
      suggestionCount: 0,
      unscheduledTaskCount
    });

    return {
      suggestions: [],
      runSummary: {
        triggerType: "PLAN_DAY",
        eligibleTaskCount: 0,
        suggestionCount: 0,
        unscheduledTaskCount
      }
    };
  }

  const activeSuggestionTaskIds = new Set(activeSuggestions.map((suggestion) => suggestion.taskId));
  const eligibleTasks: EligibleTask[] = candidateTasks
    .filter((task) => !activeSuggestionTaskIds.has(task.id))
    .filter((task) => !task.deadline || task.deadline.getTime() >= dayStart.getTime())
    .map((task) => ({
      id: task.id,
      deadline: task.deadline,
      durationMinutes: task.durationMinutes ?? preferences.defaultTaskDuration
    }));

  const availabilityStart = setUtcTime(dayStart, preferences.workDayStart, DEFAULT_WORKDAY_START);
  const availabilityEnd = setUtcTime(dayStart, preferences.workDayEnd, DEFAULT_WORKDAY_END);
  const occupiedBlocks: OccupiedBlock[] = [
    ...taskSchedules.map((schedule) => ({
      startAt: schedule.startAt,
      endAt: schedule.endAt
    })),
    ...activeSuggestions.map((suggestion) => ({
      startAt: suggestion.startAt,
      endAt: suggestion.endAt
    })),
    ...calendarEvents.map((event) => ({
      startAt: event.startAt,
      endAt: event.endAt
    }))
  ];
  const freeSlots = buildFreeSlots(availabilityStart, availabilityEnd, occupiedBlocks);

  let createdSuggestion: PlannedSuggestion | null = null;

  if (freeSlots.length > 0 && eligibleTasks.length > 0) {
    outer: for (const task of eligibleTasks) {
      for (const slot of freeSlots) {
        if (getDurationMinutes(slot.startAt, slot.endAt) < task.durationMinutes) {
          continue;
        }

        const candidateStart = slot.startAt;
        const candidateEnd = new Date(candidateStart.getTime() + task.durationMinutes * 60000);

        if (candidateEnd.getTime() > slot.endAt.getTime()) {
          continue;
        }

        if (task.deadline && candidateEnd.getTime() > task.deadline.getTime()) {
          continue;
        }

        const created = await prisma.$transaction(async (tx) => {
          const suggestion = await tx.taskSuggestion.create({
            data: {
              userId,
              taskId: task.id,
              startAt: candidateStart,
              endAt: candidateEnd,
              date: dayStart,
              rank: 1,
              score: 1,
              status: SuggestionStatus.ACTIVE,
              reasonSummary: {
                strategy: "first_fit",
                source: "plan_day"
              }
            }
          });

          await tx.task.update({
            where: {
              id: task.id
            },
            data: {
              status: TaskStatus.SUGGESTED
            }
          });

          return suggestion;
        });

        createdSuggestion = serializeSuggestion(created);
        break outer;
      }
    }
  }

  const suggestionCount = createdSuggestion ? 1 : 0;

  await persistSchedulingRun({
    userId,
    dayStart,
    dayEnd,
    eligibleTaskCount: eligibleTasks.length,
    suggestionCount,
    unscheduledTaskCount
  });

  return {
    suggestions: createdSuggestion ? [createdSuggestion] : [],
    runSummary: {
      triggerType: "PLAN_DAY",
      eligibleTaskCount: eligibleTasks.length,
      suggestionCount,
      unscheduledTaskCount
    }
  };
}

export async function acceptSuggestion(
  userId: string,
  suggestionId: string
): Promise<AcceptSuggestionResult> {
  console.info("accept_suggestion", { userId, suggestionId });

  const suggestion = await getSuggestionForUser(userId, suggestionId);

  if (suggestion.status === SuggestionStatus.ACCEPTED) {
    const schedule = await getExactMatchingSchedule(userId, suggestion);

    if (!schedule) {
      throw new AppError(409, "CONFLICT", "Accepted suggestion is missing its schedule");
    }

    const task = await prisma.task.update({
      where: {
        id: suggestion.taskId
      },
      data: {
        status: TaskStatus.SCHEDULED
      }
    });

    return {
      schedule: serializeAcceptSchedule(schedule),
      task: {
        id: task.id,
        status: TaskStatus.SCHEDULED
      }
    };
  }

  if (suggestion.status !== SuggestionStatus.ACTIVE) {
    throw new AppError(409, "INVALID_STATE", "Suggestion is not active");
  }

  await ensureNoAcceptanceConflicts(userId, suggestion);

  const { schedule, task } = await prisma.$transaction(async (tx) => {
    let schedule = await tx.taskSchedule.findFirst({
      where: {
        userId,
        taskId: suggestion.taskId,
        startAt: suggestion.startAt,
        endAt: suggestion.endAt,
        date: suggestion.date
      }
    });

    if (!schedule) {
      schedule = await tx.taskSchedule.create({
        data: {
          taskId: suggestion.taskId,
          userId,
          startAt: suggestion.startAt,
          endAt: suggestion.endAt,
          date: suggestion.date,
          isLocked: false,
          completionStatus: CompletionStatus.PENDING
        }
      });
    }

    await tx.taskSuggestion.update({
      where: {
        id: suggestion.id
      },
      data: {
        status: SuggestionStatus.ACCEPTED
      }
    });

    await tx.taskSuggestion.updateMany({
      where: {
        userId,
        taskId: suggestion.taskId,
        status: SuggestionStatus.ACTIVE,
        id: {
          not: suggestion.id
        }
      },
      data: {
        status: SuggestionStatus.EXPIRED
      }
    });

    const task = await tx.task.update({
      where: {
        id: suggestion.taskId
      },
      data: {
        status: TaskStatus.SCHEDULED
      }
    });

    return { schedule, task };
  });

  return {
    schedule: serializeAcceptSchedule(schedule),
    task: {
      id: task.id,
      status: TaskStatus.SCHEDULED
    }
  };
}

export async function dismissSuggestion(
  userId: string,
  suggestionId: string
): Promise<DismissSuggestionResult> {
  console.info("dismiss_suggestion", { userId, suggestionId });

  const suggestion = await getSuggestionForUser(userId, suggestionId);

  if (suggestion.status !== SuggestionStatus.ACTIVE) {
    throw new AppError(409, "INVALID_STATE", "Suggestion is not active");
  }

  const task = await prisma.$transaction(async (tx) => {
    await tx.taskSuggestion.update({
      where: {
        id: suggestion.id
      },
      data: {
        status: SuggestionStatus.DISMISSED
      }
    });

    return tx.task.update({
      where: {
        id: suggestion.taskId
      },
      data: {
        status: TaskStatus.UNSCHEDULED
      }
    });
  });

  return {
    success: true,
    task: {
      id: serializeTaskStatus(task).id,
      status: TaskStatus.UNSCHEDULED
    }
  };
}

export async function retrySuggestion(
  userId: string,
  suggestionId: string
): Promise<RetrySuggestionResult> {
  const suggestion = await getSuggestionForUser(userId, suggestionId);

  if (suggestion.status === SuggestionStatus.REPLACED) {
    const latestActiveSuggestion = await getLatestActiveSuggestionForTaskDate(
      userId,
      suggestion.taskId,
      suggestion.date
    );

    if (!latestActiveSuggestion) {
      return {
        suggestion: null,
        message: "No better time available today"
      };
    }

    return {
      suggestion: serializeRetrySuggestion(latestActiveSuggestion)
    };
  }

  if (suggestion.status !== SuggestionStatus.ACTIVE) {
    throw new AppError(409, "INVALID_STATE", "Suggestion is not active");
  }

  const task = await getTaskForUser(userId, suggestion.taskId);
  const schedulerDayData = await loadSchedulerDayData(userId, suggestion.date, suggestion.id);
  const durationMinutes = task.durationMinutes ?? schedulerDayData.preferences.defaultTaskDuration;
  const freeSlots = buildFreeSlots(
    schedulerDayData.availabilityStart,
    schedulerDayData.availabilityEnd,
    [
      ...schedulerDayData.occupiedBlocks,
      {
        startAt: suggestion.startAt,
        endAt: suggestion.endAt
      }
    ]
  );

  let replacementWindow: { startAt: Date; endAt: Date } | null = null;

  for (const slot of freeSlots) {
    if (slot.endAt.getTime() <= suggestion.startAt.getTime()) {
      continue;
    }

    const candidateStart = slot.startAt;
    const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60000);

    if (candidateStart.getTime() <= suggestion.startAt.getTime()) {
      continue;
    }

    if (candidateEnd.getTime() > slot.endAt.getTime()) {
      continue;
    }

    if (task.deadline && candidateEnd.getTime() > task.deadline.getTime()) {
      continue;
    }

    replacementWindow = {
      startAt: candidateStart,
      endAt: candidateEnd
    };
    break;
  }

  if (!replacementWindow) {
    await prisma.$transaction(async (tx) => {
      await tx.taskSuggestion.update({
        where: {
          id: suggestion.id
        },
        data: {
          status: SuggestionStatus.REPLACED
        }
      });

      await tx.task.update({
        where: {
          id: task.id
        },
        data: {
          status: TaskStatus.UNSCHEDULED
        }
      });
    });

    return {
      suggestion: null,
      message: "No better time available today"
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingActiveSuggestion = await tx.taskSuggestion.findFirst({
      where: {
        userId,
        taskId: task.id,
        startAt: replacementWindow.startAt,
        endAt: replacementWindow.endAt,
        date: suggestion.date,
        status: SuggestionStatus.ACTIVE
      }
    });

    await tx.taskSuggestion.update({
      where: {
        id: suggestion.id
      },
      data: {
        status: SuggestionStatus.REPLACED
      }
    });

    if (existingActiveSuggestion) {
      await tx.task.update({
        where: {
          id: task.id
        },
        data: {
          status: TaskStatus.SUGGESTED
        }
      });

      return existingActiveSuggestion;
    }

    const createdSuggestion = await tx.taskSuggestion.create({
      data: {
        userId,
        taskId: task.id,
        startAt: replacementWindow.startAt,
        endAt: replacementWindow.endAt,
        date: suggestion.date,
        rank: 1,
        score: 1,
        status: SuggestionStatus.ACTIVE,
        reasonSummary: {
          strategy: "retry_first_fit",
          replacedSuggestionId: suggestion.id,
          previousStartAt: suggestion.startAt.toISOString()
        }
      }
    });

    await tx.task.update({
      where: {
        id: task.id
      },
      data: {
        status: TaskStatus.SUGGESTED
      }
    });

    return createdSuggestion;
  });

  return {
    suggestion: serializeRetrySuggestion(result)
  };
}
