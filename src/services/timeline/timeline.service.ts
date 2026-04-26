import "server-only";

import {
  CompletionStatus,
  SuggestionStatus,
  type CalendarEvent,
  type TaskSchedule,
  type TaskSuggestion
} from "@prisma/client";

import type {
  TimelineItem,
  TimelineResult,
  TimelineSummary
} from "../../features/timeline/types";
import { prisma } from "../../lib/db";
import { getDayWindowForDate } from "../../lib/planner-time";
import { getUserTimeZone } from "../../lib/user-timezone";
import type { TimelineQuery } from "../../lib/validators/timeline";
import { reconcileMissedSchedulesForDay } from "../schedules/schedule.service";

const DEFAULT_DAILY_FREE_MINUTES = 360;
const ITEM_TYPE_PRIORITY = {
  calendar_event: 0,
  task_schedule: 1,
  task_suggestion: 2
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

function getDurationMinutes(startAt: Date, endAt: Date): number {
  return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
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

  await reconcileMissedSchedulesForDay(
    userId,
    dayWindow.dayStartUtc,
    dayWindow.dayEndUtc,
    new Date()
  );

  const [preferences, schedules, suggestions, calendarEvents] = await Promise.all([
    prisma.userPreferences.findUnique({
      where: {
        userId
      },
      select: {
        maxDailyPlannedMinutes: true
      }
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
    ...schedules.map(serializeSchedule),
    ...suggestions.map(serializeSuggestion)
  ]);

  const busyMinutes = calendarEvents.reduce(
    (total, event) => total + getDurationMinutes(event.startAt, event.endAt),
    0
  );
  const scheduledMinutes = schedules.reduce(
    (total, schedule) => total + getDurationMinutes(schedule.startAt, schedule.endAt),
    0
  );
  const suggestedMinutes = suggestions.reduce(
    (total, suggestion) => total + getDurationMinutes(suggestion.startAt, suggestion.endAt),
    0
  );
  const dailyCapacity = preferences?.maxDailyPlannedMinutes ?? DEFAULT_DAILY_FREE_MINUTES;

  return {
    date: input.date,
    items,
    summary: {
      busyMinutes,
      scheduledMinutes,
      suggestedMinutes,
      freeMinutes: Math.max(0, dailyCapacity - scheduledMinutes)
    }
  };
}
