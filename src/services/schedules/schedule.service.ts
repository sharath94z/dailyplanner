import "server-only";

import {
  CompletionStatus,
  SuggestionStatus,
  TaskStatus
} from "@prisma/client";

import { AppError } from "../../lib/api-errors";
import { prisma } from "../../lib/db";

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
