import "server-only";

import {
  CompletionStatus,
  SuggestionStatus,
  type Routine,
  type CalendarEvent,
  type TaskSchedule,
  type TaskSuggestion
} from "@prisma/client";

import type {
  TimelineItem,
  TimelineResult
} from "../../features/timeline/types";
import { prisma } from "../../lib/db";
import { getDayWindowForDate, getUtcInstantForLocalTime, getWeekdayFromDateString } from "../../lib/planner-time";
import {
  getBlockDurationMinutes,
  getMergedBlockDurationMinutes,
  type TimeBlock
} from "../../lib/time-blocks";
import { getUserTimeZone } from "../../lib/user-timezone";
import type { TimelineQuery } from "../../lib/validators/timeline";
import {
  reconcileMissedSchedulesForDay,
  reconcileStaleSuggestionsForDay
} from "../schedules/schedule.service";

const DEFAULT_DAILY_FREE_MINUTES = 360;
const ITEM_TYPE_PRIORITY = {
  calendar_event: 0,
  routine: 1,
  task_schedule: 2,
  task_suggestion: 3
} as const;

type ScheduleWithTask = TaskSchedule & {
  task: {
    title: string;
  };
};

type SuggestionWithTask = TaskSuggestion & {
  task: {
    title: string;
  };
};

function toIso(value: Date): string {
  return value.toISOString();
}

function serializeCalendarEvent(event: CalendarEvent): TimelineItem {
  return {
    id: event.id,
    type: "calendar_event",
    title: event.title,
    startAt: toIso(event.startAt),
    endAt: toIso(event.endAt),
    state: "BUSY",
    calendarEventId: event.id
  };
}

function serializeSchedule(schedule: ScheduleWithTask): TimelineItem {
  return {
    id: schedule.id,
    type: "task_schedule",
    taskId: schedule.taskId,
    scheduleId: schedule.id,
    title: schedule.task.title,
    startAt: toIso(schedule.startAt),
    endAt: toIso(schedule.endAt),
    state: schedule.completionStatus
  };
}

function serializeRoutine(
  routine: Routine,
  date: string,
  timeZone: string
): TimelineItem {
  return {
    id: routine.id,
    type: "routine",
    title: routine.title,
    startAt: toIso(getUtcInstantForLocalTime(date, routine.startTime, timeZone)),
    endAt: toIso(getUtcInstantForLocalTime(date, routine.endTime, timeZone)),
    state: "FIXED"
  };
}

function serializeSuggestion(suggestion: SuggestionWithTask): TimelineItem {
  return {
    id: suggestion.id,
    type: "task_suggestion",
    taskId: suggestion.taskId,
    suggestionId: suggestion.id,
    title: suggestion.task.title,
    startAt: toIso(suggestion.startAt),
    endAt: toIso(suggestion.endAt),
    state: suggestion.status
  };
}

function getRoutineBlocks(
  routines: Array<{ startTime: string; endTime: string }>,
  date: string,
  timeZone: string
): TimeBlock[] {
  return routines.map((routine) => ({
    startAt: getUtcInstantForLocalTime(date, routine.startTime, timeZone),
    endAt: getUtcInstantForLocalTime(date, routine.endTime, timeZone)
  }));
}

function sortTimelineItems(items: TimelineItem[]): TimelineItem[] {
  return items.sort((left, right) => {
    const startDiff = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();

    if (startDiff !== 0) {
      return startDiff;
    }

    const typeDiff = ITEM_TYPE_PRIORITY[left.type] - ITEM_TYPE_PRIORITY[right.type];
    if (typeDiff !== 0) {
      return typeDiff;
    }

    const endDiff = new Date(left.endAt).getTime() - new Date(right.endAt).getTime();
    if (endDiff !== 0) {
      return endDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

export async function getTimelineForDate(
  userId: string,
  input: TimelineQuery
): Promise<TimelineResult> {
  const timeZone = await getUserTimeZone(userId);
  const dayWindow = getDayWindowForDate(input.date, timeZone);
  const weekday = getWeekdayFromDateString(input.date);

  await reconcileStaleSuggestionsForDay(userId, dayWindow.dayStartUtc, dayWindow.dayEndUtc);
  await reconcileMissedSchedulesForDay(
    userId,
    dayWindow.dayStartUtc,
    dayWindow.dayEndUtc,
    new Date()
  );

  const [preferences, routines, schedules, suggestions, calendarEvents] = await Promise.all([
    prisma.userPreferences.findUnique({
      where: {
        userId
      },
      select: {
        maxDailyPlannedMinutes: true
      }
    }),
    prisma.routine.findMany({
      where: {
        userId,
        isActive: true,
        daysOfWeek: {
          has: weekday
        }
      },
      orderBy: [{ startTime: "asc" }, { id: "asc" }]
    }),
    prisma.taskSchedule.findMany({
      where: {
        userId,
        date: {
          gte: dayWindow.dayStartUtc,
          lt: dayWindow.dayEndUtc
        }
      },
      include: {
        task: {
          select: {
            title: true
          }
        }
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }]
    }),
    input.includeSuggestions
      ? prisma.taskSuggestion.findMany({
          where: {
            userId,
            status: SuggestionStatus.ACTIVE,
            date: {
              gte: dayWindow.dayStartUtc,
              lt: dayWindow.dayEndUtc
            }
          },
          include: {
            task: {
              select: {
                title: true
              }
            }
          },
          orderBy: [{ startAt: "asc" }, { id: "asc" }]
        })
      : Promise.resolve([]),
    input.includeCalendar
      ? prisma.calendarEvent.findMany({
          where: {
            userId,
            startAt: {
              lt: dayWindow.dayEndUtc
            },
            endAt: {
              gt: dayWindow.dayStartUtc
            }
          },
          orderBy: [{ startAt: "asc" }, { id: "asc" }]
        })
      : Promise.resolve([])
  ]);

  const items = sortTimelineItems([
    ...calendarEvents.map(serializeCalendarEvent),
    ...routines.map((routine) => serializeRoutine(routine, input.date, timeZone)),
    ...schedules.map(serializeSchedule),
    ...suggestions.map(serializeSuggestion)
  ]);
  const routineBlocks = getRoutineBlocks(routines, input.date, timeZone);

  const busyMinutes = calendarEvents.reduce(
    (total, event) => total + getBlockDurationMinutes(event.startAt, event.endAt),
    0
  );
  const routineMinutes = getMergedBlockDurationMinutes(routineBlocks);
  const scheduledMinutes = schedules.reduce(
    (total, schedule) => total + getBlockDurationMinutes(schedule.startAt, schedule.endAt),
    0
  );
  const suggestedMinutes = suggestions.reduce(
    (total, suggestion) => total + getBlockDurationMinutes(suggestion.startAt, suggestion.endAt),
    0
  );
  const dailyCapacity = preferences?.maxDailyPlannedMinutes ?? DEFAULT_DAILY_FREE_MINUTES;

  return {
    date: input.date,
    items,
    summary: {
      busyMinutes,
      routineMinutes,
      scheduledMinutes,
      suggestedMinutes,
      freeMinutes: Math.max(0, dailyCapacity - scheduledMinutes - routineMinutes)
    }
  };
}
