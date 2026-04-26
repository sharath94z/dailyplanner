import "server-only";

import {
  CompletionStatus,
  Prisma,
  Priority,
  SuggestionStatus,
  TaskStatus,
  TaskType,
  EffortLevel,
  type Task,
  type TaskHistory,
  type TaskSchedule,
  type TaskSuggestion
} from "@prisma/client";

import { prisma } from "../../lib/db";
import { AppError } from "../../lib/api-errors";
import type {
  TaskCreateInput,
  TaskGetQuery,
  TaskListQuery,
  TaskUpdateInput
} from "../../lib/validators/task";

export type SerializedTask = {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: Priority;
  deadline: string | null;
  durationMinutes: number | null;
  estimatedByAI: boolean;
  effortLevel: EffortLevel;
  taskType: TaskType;
  splittable: boolean;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedSchedule = {
  id: string;
  taskId: string;
  startAt: string;
  endAt: string;
  date: string;
  isLocked: boolean;
  completionStatus: CompletionStatus;
  createdAt: string;
  updatedAt: string;
};

export type SerializedSuggestion = {
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

export type SerializedHistory = {
  id: string;
  taskId: string;
  eventType: TaskHistory["eventType"];
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

export type TaskDetailResult = {
  task: SerializedTask;
  schedules?: SerializedSchedule[];
  suggestions?: SerializedSuggestion[];
  history?: SerializedHistory[];
};

export type TaskListResult = {
  tasks: SerializedTask[];
  nextCursor: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serializeTask(task: Task): SerializedTask {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes ?? null,
    status: task.status,
    priority: task.priority,
    deadline: toIso(task.deadline),
    durationMinutes: task.durationMinutes ?? null,
    estimatedByAI: task.estimatedByAI,
    effortLevel: task.effortLevel,
    taskType: task.taskType,
    splittable: task.splittable,
    source: task.source ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

function serializeSchedule(schedule: TaskSchedule): SerializedSchedule {
  return {
    id: schedule.id,
    taskId: schedule.taskId,
    startAt: schedule.startAt.toISOString(),
    endAt: schedule.endAt.toISOString(),
    date: schedule.date.toISOString(),
    isLocked: schedule.isLocked,
    completionStatus: schedule.completionStatus,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString()
  };
}

function serializeSuggestion(suggestion: TaskSuggestion): SerializedSuggestion {
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

function serializeHistoryItem(history: TaskHistory): SerializedHistory {
  return {
    id: history.id,
    taskId: history.taskId,
    eventType: history.eventType,
    metadata: history.metadata ?? null,
    createdAt: history.createdAt.toISOString()
  };
}

function buildListWhere(userId: string, input: TaskListQuery): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { userId };

  if (input.status) {
    where.status = input.status;
  }

  if (input.priority) {
    where.priority = input.priority;
  }

  if (!input.includeArchived && input.status !== TaskStatus.ARCHIVED) {
    where.status = input.status
      ? input.status
      : {
          not: TaskStatus.ARCHIVED
        };
  }

  return where;
}

export async function createTask(userId: string, input: TaskCreateInput) {
  const task = await prisma.task.create({
    data: {
      userId,
      title: input.title,
      notes: input.notes ?? null,
      priority: input.priority ?? Priority.MEDIUM,
      deadline: input.deadline ?? null,
      durationMinutes: input.durationMinutes ?? null,
      effortLevel: input.effortLevel ?? EffortLevel.MEDIUM,
      taskType: input.taskType ?? TaskType.GENERIC,
      splittable: input.splittable ?? false
    }
  });

  return {
    task: serializeTask(task)
  };
}

export async function listTasks(userId: string, input: TaskListQuery): Promise<TaskListResult> {
  const where = buildListWhere(userId, input);
  const limit = input.limit ?? 20;
  const take = limit + 1;

  if (!input.cursor) {
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take
    });

    const hasNextPage = tasks.length > limit;
    return {
      tasks: tasks.slice(0, limit).map(serializeTask),
      nextCursor: hasNextPage ? tasks[limit - 1]?.id ?? null : null
    };
  }

  const cursorTask = await prisma.task.findFirst({
    where: {
      id: input.cursor,
      userId
    },
    select: {
      id: true
    }
  });

  if (!cursorTask) {
    throw new AppError(400, "VALIDATION_ERROR", "cursor must reference an existing task", {
      field: "cursor"
    });
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    cursor: {
      id: input.cursor
    },
    skip: 1,
    take
  });

  const hasNextPage = tasks.length > limit;
  return {
    tasks: tasks.slice(0, limit).map(serializeTask),
    nextCursor: hasNextPage ? tasks[limit - 1]?.id ?? null : null
  };
}

export async function getTask(userId: string, taskId: string, input: TaskGetQuery): Promise<TaskDetailResult> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId
    }
  });

  if (!task) {
    throw new AppError(404, "NOT_FOUND", "Task not found");
  }

  const result: TaskDetailResult = {
    task: serializeTask(task)
  };

  if (input.includeSchedules) {
    const schedules = await prisma.taskSchedule.findMany({
      where: {
        taskId,
        userId
      },
      orderBy: [{ startAt: "desc" }, { createdAt: "desc" }]
    });

    result.schedules = schedules.map(serializeSchedule);
  }

  if (input.includeSuggestions) {
    const suggestions = await prisma.taskSuggestion.findMany({
      where: {
        taskId,
        userId
      },
      orderBy: [{ generatedAt: "desc" }, { id: "desc" }]
    });

    result.suggestions = suggestions.map(serializeSuggestion);
  }

  if (input.includeHistory) {
    const history = await prisma.taskHistory.findMany({
      where: {
        taskId,
        userId
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    result.history = history.map(serializeHistoryItem);
  }

  return result;
}

export async function updateTask(userId: string, taskId: string, input: TaskUpdateInput) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId
    }
  });

  if (!task) {
    throw new AppError(404, "NOT_FOUND", "Task not found");
  }

  const updatedTask = await prisma.task.update({
    where: {
      id: task.id
    },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.deadline !== undefined ? { deadline: input.deadline ?? null } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.effortLevel !== undefined ? { effortLevel: input.effortLevel } : {}),
      ...(input.taskType !== undefined ? { taskType: input.taskType } : {}),
      ...(input.splittable !== undefined ? { splittable: input.splittable } : {})
    }
  });

  return {
    task: serializeTask(updatedTask),
    planStatus: {
      isStale: true,
      message: "Plan may need updating"
    }
  };
}

export async function archiveTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId
    }
  });

  if (!task) {
    throw new AppError(404, "NOT_FOUND", "Task not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: {
        id: task.id
      },
      data: {
        status: TaskStatus.ARCHIVED
      }
    });

    await tx.taskSuggestion.updateMany({
      where: {
        taskId,
        userId,
        status: SuggestionStatus.ACTIVE
      },
      data: {
        status: SuggestionStatus.EXPIRED
      }
    });

    await tx.taskSchedule.deleteMany({
      where: {
        taskId,
        userId,
        completionStatus: CompletionStatus.PENDING,
        startAt: {
          gt: new Date()
        }
      }
    });
  });

  return {
    success: true as const
  };
}
