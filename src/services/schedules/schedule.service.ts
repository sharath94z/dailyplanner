import "server-only";

import {
  CompletionStatus,
  EffortLevel,
  Prisma,
  Priority,
  SuggestionStatus,
  TaskStatus,
  TaskType
} from "@prisma/client";

import { AppError } from "../../lib/api-errors";
import { prisma } from "../../lib/db";
import {
  getDateStringForInstantInTimeZone,
  getUtcInstantForLocalTime,
  getWeekdayFromDateString
} from "../../lib/planner-time";
import { getUserTimeZone } from "../../lib/user-timezone";
import type { CreateTaskScheduleInput } from "../../lib/validators/task-schedule";

const MISSED_GRACE_WINDOW_MINUTES = 10;

export type CompleteScheduleResult = {
  success: true;
  task: {
    id: string;
    status: "COMPLETED";
  };
  schedule: {
    id: string;
    completionStatus: "COMPLETED";
  };
};

export type MarkScheduleMissedResult = {
  task: {
    id: string;
    status: "MISSED";
  };
  schedule: {
    id: string;
    completionStatus: "MISSED";
  };
  suggestion: null;
};

export type CreateTaskScheduleResult = {
  task: {
    id: string;
    status: "SCHEDULED";
    title: string;
  };
  schedule: {
    id: string;
    taskId: string;
    startAt: string;
    endAt: string;
    date: string;
    completionStatus: "PENDING";
  };
};

function getMissedCutoff(now: Date): Date {
  return new Date(now.getTime() - MISSED_GRACE_WINDOW_MINUTES * 60_000);
}

function serializeCompletedSchedule(taskId: string, scheduleId: string): CompleteScheduleResult {
  return {
    success: true,
    task: {
      id: taskId,
      status: "COMPLETED"
    },
    schedule: {
      id: scheduleId,
      completionStatus: "COMPLETED"
    }
  };
}

function serializeMissedSchedule(taskId: string, scheduleId: string): MarkScheduleMissedResult {
  return {
    task: {
      id: taskId,
      status: "MISSED"
    },
    schedule: {
      id: scheduleId,
      completionStatus: "MISSED"
    },
    suggestion: null
  };
}

function serializeCreatedTaskSchedule(input: {
  taskId: string;
  taskTitle: string;
  scheduleId: string;
  startAt: Date;
  endAt: Date;
  date: Date;
}): CreateTaskScheduleResult {
  return {
    task: {
      id: input.taskId,
      status: "SCHEDULED",
      title: input.taskTitle
    },
    schedule: {
      id: input.scheduleId,
      taskId: input.taskId,
      startAt: input.startAt.toISOString(),
      endAt: input.endAt.toISOString(),
      date: input.date.toISOString(),
      completionStatus: "PENDING"
    }
  };
}

async function ensureNoCreateScheduleConflicts(
  db: Prisma.TransactionClient,
  userId: string,
  date: string,
  startAt: Date,
  endAt: Date,
  timeZone: string
) {
  const weekday = getWeekdayFromDateString(date);

  const [conflictingSchedule, conflictingSuggestion, conflictingCalendarEvent, routines] = await Promise.all([
    db.taskSchedule.findFirst({
      where: {
        userId,
        startAt: {
          lt: endAt
        },
        endAt: {
          gt: startAt
        }
      },
      select: {
        id: true
      }
    }),
    db.taskSuggestion.findFirst({
      where: {
        userId,
        status: SuggestionStatus.ACTIVE,
        startAt: {
          lt: endAt
        },
        endAt: {
          gt: startAt
        }
      },
      select: {
        id: true
      }
    }),
    db.calendarEvent.findFirst({
      where: {
        userId,
        startAt: {
          lt: endAt
        },
        endAt: {
          gt: startAt
        }
      },
      select: {
        id: true
      }
    }),
    db.routine.findMany({
      where: {
        userId,
        isActive: true,
        daysOfWeek: {
          has: weekday
        }
      },
      select: {
        id: true,
        startTime: true,
        endTime: true
      },
      orderBy: [{ startTime: "asc" }, { id: "asc" }]
    })
  ]);

  const conflictingRoutine = routines.find((routine) => {
    const routineStartAt = getUtcInstantForLocalTime(date, routine.startTime, timeZone);
    const routineEndAt = getUtcInstantForLocalTime(date, routine.endTime, timeZone);

    return routineStartAt.getTime() < endAt.getTime() && routineEndAt.getTime() > startAt.getTime();
  });

  if (conflictingSchedule || conflictingSuggestion || conflictingCalendarEvent || conflictingRoutine) {
    throw new AppError(409, "CONFLICT", "Schedule conflicts with an occupied block");
  }
}

export async function createTaskSchedule(
  userId: string,
  input: CreateTaskScheduleInput
): Promise<CreateTaskScheduleResult> {
  const timeZone = await getUserTimeZone(userId);
  const startAt = getUtcInstantForLocalTime(input.date, input.startTime, timeZone);
  const endAt = new Date(startAt.getTime() + input.durationMinutes * 60_000);
  const selectedDateStart = getUtcInstantForLocalTime(input.date, "00:00", timeZone);

  if (endAt.getTime() <= startAt.getTime()) {
    throw new AppError(400, "VALIDATION_ERROR", "endAt must be after startAt", {
      field: "durationMinutes"
    });
  }

  if (getDateStringForInstantInTimeZone(endAt, timeZone) !== input.date) {
    throw new AppError(400, "VALIDATION_ERROR", "Scheduled items must end on the selected date", {
      field: "durationMinutes"
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    await ensureNoCreateScheduleConflicts(tx, userId, input.date, startAt, endAt, timeZone);

    const task = await tx.task.create({
      data: {
        userId,
        title: input.title,
        status: TaskStatus.SCHEDULED,
        durationMinutes: input.durationMinutes,
        priority: Priority.MEDIUM,
        effortLevel: EffortLevel.MEDIUM,
        taskType: TaskType.GENERIC,
        splittable: false
      }
    });

    const schedule = await tx.taskSchedule.create({
      data: {
        taskId: task.id,
        userId,
        startAt,
        endAt,
        date: selectedDateStart,
        isLocked: false,
        completionStatus: CompletionStatus.PENDING
      }
    });

    return {
      task,
      schedule
    };
  });

  return serializeCreatedTaskSchedule({
    taskId: result.task.id,
    taskTitle: result.task.title,
    scheduleId: result.schedule.id,
    startAt: result.schedule.startAt,
    endAt: result.schedule.endAt,
    date: result.schedule.date
  });
}

export async function completeSchedule(
  userId: string,
  scheduleId: string
): Promise<CompleteScheduleResult> {
  const schedule = await prisma.taskSchedule.findFirst({
    where: {
      id: scheduleId,
      userId
    },
    include: {
      task: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!schedule) {
    throw new AppError(404, "NOT_FOUND", "Schedule not found");
  }

  if (schedule.completionStatus !== CompletionStatus.PENDING) {
    throw new AppError(409, "INVALID_STATE", "Schedule is not pending");
  }

  if (schedule.task.status !== TaskStatus.SCHEDULED) {
    throw new AppError(409, "INVALID_STATE", "Task is not scheduled");
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskSchedule.update({
      where: {
        id: schedule.id
      },
      data: {
        completionStatus: CompletionStatus.COMPLETED
      }
    });

    await tx.task.update({
      where: {
        id: schedule.task.id
      },
      data: {
        status: TaskStatus.COMPLETED
      }
    });

    await tx.taskSuggestion.updateMany({
      where: {
        taskId: schedule.task.id,
        userId,
        status: SuggestionStatus.ACTIVE
      },
      data: {
        status: SuggestionStatus.EXPIRED
      }
    });
  });

  return serializeCompletedSchedule(schedule.task.id, schedule.id);
}

export async function markScheduleMissed(
  userId: string,
  scheduleId: string
): Promise<MarkScheduleMissedResult> {
  const schedule = await prisma.taskSchedule.findFirst({
    where: {
      id: scheduleId,
      userId
    },
    include: {
      task: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!schedule) {
    throw new AppError(404, "NOT_FOUND", "Schedule not found");
  }

  if (schedule.completionStatus !== CompletionStatus.PENDING) {
    throw new AppError(409, "INVALID_STATE", "Schedule is not pending");
  }

  if (
    schedule.task.status === TaskStatus.COMPLETED ||
    schedule.task.status === TaskStatus.ARCHIVED
  ) {
    throw new AppError(409, "INVALID_STATE", "Task cannot be marked missed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskSchedule.update({
      where: {
        id: schedule.id
      },
      data: {
        completionStatus: CompletionStatus.MISSED
      }
    });

    await tx.task.update({
      where: {
        id: schedule.task.id
      },
      data: {
        status: TaskStatus.MISSED
      }
    });

    await tx.taskSuggestion.updateMany({
      where: {
        taskId: schedule.task.id,
        userId,
        status: SuggestionStatus.ACTIVE
      },
      data: {
        status: SuggestionStatus.EXPIRED
      }
    });
  });

  return serializeMissedSchedule(schedule.task.id, schedule.id);
}

export async function reconcileMissedSchedulesForDay(
  userId: string,
  dayStart: Date,
  dayEnd: Date,
  now: Date
) {
  const missedCutoff = getMissedCutoff(now);

  const schedules = await prisma.taskSchedule.findMany({
    where: {
      userId,
      date: {
        gte: dayStart,
        lt: dayEnd
      },
      completionStatus: CompletionStatus.PENDING,
      endAt: {
        lt: missedCutoff
      }
    },
    select: {
      id: true,
      taskId: true
    }
  });

  for (const schedule of schedules) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.taskSchedule.updateMany({
        where: {
          id: schedule.id,
          userId,
          completionStatus: CompletionStatus.PENDING
        },
        data: {
          completionStatus: CompletionStatus.MISSED
        }
      });

      if (updated.count === 0) {
        return;
      }

      await tx.task.updateMany({
        where: {
          id: schedule.taskId,
          userId,
          status: {
            not: TaskStatus.ARCHIVED
          }
        },
        data: {
          status: TaskStatus.MISSED
        }
      });

      await tx.taskSuggestion.updateMany({
        where: {
          taskId: schedule.taskId,
          userId,
          status: SuggestionStatus.ACTIVE
        },
        data: {
          status: SuggestionStatus.EXPIRED
        }
      });
    });
  }
}

export async function reconcileStaleSuggestionsForDay(
  userId: string,
  dayStart: Date,
  _dayEnd: Date
) {
  const staleSuggestions = await prisma.taskSuggestion.findMany({
    where: {
      userId,
      status: SuggestionStatus.ACTIVE,
      date: {
        lt: dayStart
      }
    },
    select: {
      taskId: true
    }
  });

  if (staleSuggestions.length === 0) {
    return;
  }

  const affectedTaskIds = [...new Set(staleSuggestions.map((suggestion) => suggestion.taskId))];

  await prisma.$transaction(async (tx) => {
    await tx.taskSuggestion.updateMany({
      where: {
        userId,
        status: SuggestionStatus.ACTIVE,
        date: {
          lt: dayStart
        }
      },
      data: {
        status: SuggestionStatus.EXPIRED
      }
    });

    const remainingActiveSuggestions = await tx.taskSuggestion.findMany({
      where: {
        userId,
        taskId: {
          in: affectedTaskIds
        },
        status: SuggestionStatus.ACTIVE
      },
      select: {
        taskId: true
      }
    });

    const remainingActiveTaskIds = new Set(
      remainingActiveSuggestions.map((suggestion) => suggestion.taskId)
    );
    const recoverableTaskIds = affectedTaskIds.filter(
      (taskId) => !remainingActiveTaskIds.has(taskId)
    );

    if (recoverableTaskIds.length === 0) {
      return;
    }

    await tx.task.updateMany({
      where: {
        userId,
        id: {
          in: recoverableTaskIds
        },
        status: TaskStatus.SUGGESTED
      },
      data: {
        status: TaskStatus.UNSCHEDULED
      }
    });
  });
}
