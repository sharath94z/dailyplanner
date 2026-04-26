export type TimelineItemType = "task_schedule" | "task_suggestion" | "calendar_event";

export type TimelineItem = {
  id: string;
  type: TimelineItemType;
  title: string;
  startAt: string;
  endAt: string;
  state: string;
  taskId?: string;
  scheduleId?: string;
  suggestionId?: string;
  calendarEventId?: string;
  metadata?: Record<string, unknown> | null;
};

export type TimelineSummary = {
  busyMinutes: number;
  scheduledMinutes: number;
  suggestedMinutes: number;
  freeMinutes: number;
};

export type TimelineData = {
  date: string;
  items: TimelineItem[];
  summary: TimelineSummary;
};

export type TimelineResult = TimelineData;
