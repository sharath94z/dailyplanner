"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PlanDayButton } from "../planning/plan-day-button";
import { TaskCreateForm } from "../tasks/task-create-form";
import { createRoutine } from "../../lib/client-api/routines";
import { completeSchedule } from "../../lib/client-api/schedules";
import {
  acceptSuggestion,
  dismissSuggestion,
  retrySuggestion
} from "../../lib/client-api/suggestions";
import { getUtcInstantForLocalTime } from "../../lib/planner-time";
import type { SerializedTask } from "../../services/tasks/task.service";
import type { TimelineItem, TimelineResult } from "./types";

const PAGE_CONTAINER_STYLE = {
  margin: "0 auto",
  maxWidth: "42rem",
  padding: "1rem 0.9rem 3rem",
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#111827"
} as const;

const SURFACE_STYLE = {
  border: "1px solid #e7e5e4",
  borderRadius: "1.4rem",
  backgroundColor: "#ffffff",
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.06)"
} as const;

const FIELD_STYLE = {
  border: "1px solid #d6d3d1",
  borderRadius: "0.9rem",
  padding: "0.75rem 0.9rem",
  fontSize: "0.95rem",
  backgroundColor: "#fffdf8",
  color: "#111827",
  width: "100%"
} as const;

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 }
] as const;

const DEFAULT_DAY_START_HOUR = 8;
const DEFAULT_DAY_END_HOUR = 20;
const MINUTES_PER_HOUR = 60;
const PIXELS_PER_HOUR = 76;

type TimelineViewProps = {
  timeline: TimelineResult;
  tasks: SerializedTask[];
  mockUserId: string;
  selectedDate: string;
  timeZone: string;
};

type ItemAction = "accept" | "retry" | "dismiss" | "complete" | null;

function formatDateLabel(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone
  }).format(getUtcInstantForLocalTime(date, "00:00", timeZone));
}

function formatTimeRange(startAt: string, endAt: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone
  });

  return `${formatter.format(new Date(startAt))} - ${formatter.format(new Date(endAt))}`;
}

function getMinutesIntoDay(instant: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone
  }).formatToParts(new Date(instant));

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return hour * MINUTES_PER_HOUR + minute;
}

function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour} ${suffix}`;
}

function getTimelineWindow(items: TimelineItem[], timeZone: string) {
  if (items.length === 0) {
    return {
      startHour: DEFAULT_DAY_START_HOUR,
      endHour: DEFAULT_DAY_END_HOUR
    };
  }

  const itemStarts = items.map((item) =>
    Math.floor(getMinutesIntoDay(item.startAt, timeZone) / MINUTES_PER_HOUR)
  );
  const itemEnds = items.map((item) =>
    Math.ceil(getMinutesIntoDay(item.endAt, timeZone) / MINUTES_PER_HOUR)
  );

  const startHour = Math.max(0, Math.min(DEFAULT_DAY_START_HOUR, ...itemStarts));
  const endHour = Math.min(24, Math.max(DEFAULT_DAY_END_HOUR, ...itemEnds));

  return {
    startHour,
    endHour: Math.max(startHour + 1, endHour)
  };
}

function hasInteractiveControls(item: TimelineItem) {
  return item.type === "task_suggestion" || (item.type === "task_schedule" && item.state === "PENDING");
}

function getRenderedBlockMetrics(item: TimelineItem, timeZone: string, windowStartMinutes: number) {
  const startMinutes = getMinutesIntoDay(item.startAt, timeZone);
  const endMinutes = getMinutesIntoDay(item.endAt, timeZone);
  const durationMinutes = Math.max(15, endMinutes - startMinutes);
  const top = ((startMinutes - windowStartMinutes) / MINUTES_PER_HOUR) * PIXELS_PER_HOUR;
  const visualHeight = Math.max(
    hasInteractiveControls(item) ? 122 : item.type === "calendar_event" ? 76 : 88,
    (durationMinutes / MINUTES_PER_HOUR) * PIXELS_PER_HOUR
  );

  return {
    top,
    visualHeight
  };
}

function getItemAccent(item: TimelineItem) {
  if (item.type === "calendar_event") {
    return {
      border: "1px solid #d6d3d1",
      backgroundColor: "#f5f5f4",
      color: "#292524",
      badgeBackground: "#e7e5e4",
      badgeColor: "#57534e",
      timeColor: "#57534e"
    };
  }

  if (item.type === "task_schedule") {
    if (item.state === "COMPLETED") {
      return {
        border: "1px solid #d1d5db",
        backgroundColor: "#f3f4f6",
        color: "#374151",
        badgeBackground: "#e5e7eb",
        badgeColor: "#4b5563",
        timeColor: "#4b5563"
      };
    }

    if (item.state === "MISSED") {
      return {
        border: "1px solid #fecaca",
        backgroundColor: "#fff1f2",
        color: "#7f1d1d",
        badgeBackground: "#fee2e2",
        badgeColor: "#b91c1c",
        timeColor: "#b91c1c"
      };
    }

    return {
      border: "1px solid #111827",
      backgroundColor: "#111827",
      color: "#ffffff",
      badgeBackground: "rgba(255,255,255,0.14)",
      badgeColor: "#e5e7eb",
      timeColor: "#d1d5db"
    };
  }

  if (item.type === "routine") {
    return {
      border: "1px solid #99f6e4",
      backgroundColor: "#ecfeff",
      color: "#134e4a",
      badgeBackground: "#ccfbf1",
      badgeColor: "#0f766e",
      timeColor: "#0f766e"
    };
  }

  return {
    border: "1px dashed #93c5fd",
    backgroundColor: "#eff6ff",
    color: "#1e3a8a",
    badgeBackground: "#dbeafe",
    badgeColor: "#2563eb",
    timeColor: "#1d4ed8"
  };
}

function getItemLabel(item: TimelineItem): string {
  if (item.type === "calendar_event") {
    return "Calendar";
  }

  if (item.type === "routine") {
    return "Routine";
  }

  if (item.type === "task_schedule") {
    if (item.state === "COMPLETED") {
      return "Completed";
    }

    if (item.state === "MISSED") {
      return "Missed";
    }

    return "Scheduled";
  }

  return "Suggestion";
}

function getPendingLabel(action: Exclude<ItemAction, null>) {
  if (action === "accept") {
    return "Accepting...";
  }

  if (action === "retry") {
    return "Retrying...";
  }

  if (action === "complete") {
    return "Completing...";
  }

  return "Dismissing...";
}

export function TimelineView({
  timeline,
  tasks,
  mockUserId,
  selectedDate,
  timeZone
}: TimelineViewProps) {
  const router = useRouter();
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ItemAction>(null);
  const [errorByItemKey, setErrorByItemKey] = useState<Record<string, string>>({});
  const [routineTitle, setRoutineTitle] = useState("");
  const [routineStartTime, setRoutineStartTime] = useState("09:00");
  const [routineEndTime, setRoutineEndTime] = useState("10:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [routineError, setRoutineError] = useState<string | null>(null);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [, startTransition] = useTransition();
  const hasPlanningItems = timeline.items.some(
    (item) => item.type === "task_schedule" || item.type === "task_suggestion"
  );
  const openTasks = tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "ARCHIVED");
  const timelineWindow = getTimelineWindow(timeline.items, timeZone);
  const railHours = Array.from(
    { length: timelineWindow.endHour - timelineWindow.startHour + 1 },
    (_, index) => timelineWindow.startHour + index
  );
  const windowStartMinutes = timelineWindow.startHour * MINUTES_PER_HOUR;
  const timelineHeight = (timelineWindow.endHour - timelineWindow.startHour) * PIXELS_PER_HOUR;

  function toggleSelectedDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()
    );
  }

  async function handleSuggestionAction(
    item: TimelineItem,
    action: "accept" | "retry" | "dismiss"
  ) {
    const suggestionId = item.suggestionId;
    const itemKey = item.suggestionId ?? item.id;

    if (!suggestionId) {
      setErrorByItemKey((current) => ({
        ...current,
        [itemKey]: "Suggestion unavailable"
      }));
      return;
    }

    setPendingItemKey(itemKey);
    setPendingAction(action);
    setErrorByItemKey((current) => {
      const next = { ...current };
      delete next[itemKey];
      return next;
    });

    try {
      if (action === "accept") {
        await acceptSuggestion({ suggestionId, mockUserId });
      } else if (action === "retry") {
        await retrySuggestion({ suggestionId, mockUserId });
      } else {
        await dismissSuggestion({ suggestionId, mockUserId });
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorByItemKey((current) => ({
        ...current,
        [itemKey]: error instanceof Error ? error.message : "Request failed"
      }));
      setPendingItemKey(null);
      setPendingAction(null);
    }
  }

  async function handleCompleteSchedule(item: TimelineItem) {
    const scheduleId = item.scheduleId;
    const itemKey = item.scheduleId ?? item.id;

    if (!scheduleId) {
      setErrorByItemKey((current) => ({
        ...current,
        [itemKey]: "Schedule unavailable"
      }));
      return;
    }

    setPendingItemKey(itemKey);
    setPendingAction("complete");
    setErrorByItemKey((current) => {
      const next = { ...current };
      delete next[itemKey];
      return next;
    });

    try {
      await completeSchedule({ scheduleId, mockUserId });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorByItemKey((current) => ({
        ...current,
        [itemKey]: error instanceof Error ? error.message : "Request failed"
      }));
      setPendingItemKey(null);
      setPendingAction(null);
    }
  }

  async function handleCreateRoutine() {
    setRoutineError(null);
    setIsCreatingRoutine(true);

    try {
      await createRoutine({
        mockUserId,
        title: routineTitle,
        startTime: routineStartTime,
        endTime: routineEndTime,
        daysOfWeek: selectedDays
      });

      setRoutineTitle("");
      setRoutineStartTime("09:00");
      setRoutineEndTime("10:00");
      setSelectedDays([]);

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setRoutineError(error instanceof Error ? error.message : "Request failed");
      setIsCreatingRoutine(false);
      return;
    }

    setIsCreatingRoutine(false);
  }

  function handleDateChange(nextDate: string) {
    if (!nextDate) {
      return;
    }

    router.replace(`/?date=${encodeURIComponent(nextDate)}`, { scroll: false });
  }

  return (
    <main style={PAGE_CONTAINER_STYLE}>
      <section
        style={{
          ...SURFACE_STYLE,
          padding: "1rem",
          marginBottom: "1rem",
          background:
            "radial-gradient(circle at top left, rgba(191,219,254,0.4), transparent 40%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
        }}
      >
        <div style={{ display: "grid", gap: "0.8rem", marginBottom: "0.8rem" }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#2563eb"
              }}
            >
              Daily planner
            </p>
            <h1 style={{ margin: "0.3rem 0 0", fontSize: "1.75rem", lineHeight: 1.05 }}>
              {formatDateLabel(timeline.date, timeZone)}
            </h1>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem", color: "#475569" }}>
              Plan the day, review fixed blocks, and keep suggestions moving.
            </p>
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: "12rem",
              padding: "0.2rem",
              borderRadius: "1rem",
              backgroundColor: "rgba(255,255,255,0.8)",
              border: "1px solid #dbeafe"
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#475569",
                  padding: "0 0.35rem"
                }}
              >
                Selected date
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => handleDateChange(event.target.value)}
                style={FIELD_STYLE}
              />
            </label>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <PlanDayButton mockUserId={mockUserId} selectedDate={selectedDate} />
          <TaskCreateForm mockUserId={mockUserId} />
        </div>
      </section>

      <section
        style={{
          ...SURFACE_STYLE,
          padding: "1rem",
          marginBottom: "1rem"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem"
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Timeline</h2>
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: "#6b7280" }}>
              Your day at a glance, with fixed blocks, scheduled work, suggestions, and calendar time.
            </p>
          </div>
          <span
            style={{
              borderRadius: "999px",
              backgroundColor: "#f5f5f4",
              border: "1px solid #e7e5e4",
              padding: "0.35rem 0.65rem",
              fontSize: "0.82rem",
              color: "#57534e"
            }}
          >
            {timeline.items.length} items
          </span>
        </div>

        {timeline.items.length === 0 ? (
          <div
            style={{
              border: "1px dashed #d6d3d1",
              borderRadius: "1rem",
              padding: "1.1rem",
              color: "#57534e",
              backgroundColor: "#fafaf9",
              fontSize: "0.95rem"
            }}
          >
            Nothing planned yet. Add a task, then tap Plan My Day.
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "3.1rem 1fr",
              gap: "0.75rem"
            }}
          >
            <div
              style={{
                position: "relative",
                height: `${timelineHeight}px`
              }}
            >
              {railHours.map((hour) => (
                <div
                  key={hour}
                  style={{
                    position: "absolute",
                    top: `${(hour - timelineWindow.startHour) * PIXELS_PER_HOUR}px`,
                    left: 0,
                    right: 0,
                    transform: "translateY(-0.55rem)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em"
                  }}
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>

            <div
              style={{
                position: "relative",
                minHeight: `${timelineHeight}px`,
                borderRadius: "1.15rem",
                background:
                  "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,0.98) 100%)",
                border: "1px solid #e7e5e4",
                overflow: "hidden"
              }}
            >
              {railHours.map((hour) => (
                <div
                  key={`guide-${hour}`}
                  style={{
                    position: "absolute",
                    top: `${(hour - timelineWindow.startHour) * PIXELS_PER_HOUR}px`,
                    left: 0,
                    right: 0,
                    height: 0,
                    borderTop: "1px solid rgba(148, 163, 184, 0.16)"
                  }}
                />
              ))}

              <div style={{ position: "relative", height: `${timelineHeight}px`, padding: "0.65rem" }}>
                {timeline.items.map((item) => {
                  const accent = getItemAccent(item);
                  const itemKey =
                    item.type === "task_suggestion" ? item.suggestionId ?? item.id : item.scheduleId ?? item.id;
                  const isPendingItem = pendingItemKey === itemKey && pendingAction !== null;
                  const hasActions = item.type === "task_suggestion" && Boolean(item.suggestionId);
                  const canComplete =
                    item.type === "task_schedule" &&
                    item.state === "PENDING" &&
                    Boolean(item.scheduleId);
                  const itemError = errorByItemKey[itemKey];
                  const metrics = getRenderedBlockMetrics(item, timeZone, windowStartMinutes);

                  return (
                    <article
                      key={`${item.type}-${item.id}`}
                      style={{
                        position: "absolute",
                        top: `${metrics.top}px`,
                        left: "0.65rem",
                        right: "0.65rem",
                        minHeight: `${metrics.visualHeight}px`,
                        border: accent.border,
                        backgroundColor: accent.backgroundColor,
                        color: accent.color,
                        borderRadius: "1rem",
                        padding: "0.85rem 0.9rem",
                        boxShadow:
                          item.type === "task_schedule" && item.state === "PENDING"
                            ? "0 16px 30px rgba(15, 23, 42, 0.16)"
                            : item.type === "task_suggestion"
                              ? "0 14px 24px rgba(37, 99, 235, 0.1)"
                              : "0 10px 20px rgba(15, 23, 42, 0.05)"
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "0.6rem"
                          }}
                        >
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              borderRadius: "999px",
                              backgroundColor: accent.badgeBackground,
                              color: accent.badgeColor,
                              padding: "0.22rem 0.55rem",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              flexShrink: 0
                            }}
                          >
                            {item.type === "task_schedule" && item.state === "COMPLETED" ? "✓" : null}
                            {getItemLabel(item)}
                          </div>
                          <div
                            style={{
                              flexShrink: 0,
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              color: accent.timeColor,
                              textAlign: "right"
                            }}
                          >
                            {formatTimeRange(item.startAt, item.endAt, timeZone)}
                          </div>
                        </div>
                        <div
                          style={{
                            marginTop: "0.5rem",
                            fontSize: "0.98rem",
                            fontWeight: 700,
                            wordBreak: "break-word",
                            lineHeight: 1.2,
                            maxWidth: "100%"
                          }}
                        >
                          {item.title}
                        </div>
                      </div>

                      {item.type === "task_schedule" && item.state === "COMPLETED" ? (
                        <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", opacity: 0.85 }}>
                          Marked complete
                        </p>
                      ) : null}

                      {item.type === "task_schedule" && item.state === "MISSED" ? (
                        <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "#b91c1c" }}>
                          This block was missed
                        </p>
                      ) : null}

                      {hasActions ? (
                        <div style={{ marginTop: "0.95rem" }}>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              disabled={isPendingItem}
                              onClick={() => handleSuggestionAction(item, "accept")}
                              style={{
                                borderRadius: "999px",
                                border: "1px solid #2563eb",
                                backgroundColor: "#2563eb",
                                color: "#ffffff",
                                padding: "0.58rem 0.95rem",
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                opacity: isPendingItem ? 0.7 : 1,
                                boxShadow: "0 10px 18px rgba(37, 99, 235, 0.18)",
                                minWidth: "5.5rem"
                              }}
                            >
                              {isPendingItem && pendingAction === "accept"
                                ? getPendingLabel("accept")
                                : "Accept"}
                            </button>
                            <button
                              type="button"
                              disabled={isPendingItem}
                              onClick={() => handleSuggestionAction(item, "retry")}
                              style={{
                                borderRadius: "999px",
                                border: "1px solid #93c5fd",
                                backgroundColor: "rgba(255,255,255,0.8)",
                                color: "#1d4ed8",
                                padding: "0.58rem 0.95rem",
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                opacity: isPendingItem ? 0.7 : 1,
                                minWidth: "5rem"
                              }}
                            >
                              {isPendingItem && pendingAction === "retry"
                                ? getPendingLabel("retry")
                                : "Retry"}
                            </button>
                            <button
                              type="button"
                              disabled={isPendingItem}
                              onClick={() => handleSuggestionAction(item, "dismiss")}
                              style={{
                                borderRadius: "999px",
                                border: "1px solid transparent",
                                backgroundColor: "rgba(255,255,255,0.55)",
                                color: "#475569",
                                padding: "0.58rem 0.9rem",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                opacity: isPendingItem ? 0.7 : 1,
                                minWidth: "5rem"
                              }}
                            >
                              {isPendingItem && pendingAction === "dismiss"
                                ? getPendingLabel("dismiss")
                                : "Dismiss"}
                            </button>
                          </div>

                          {itemError ? (
                            <p style={{ margin: "0.65rem 0 0", fontSize: "0.875rem", color: "#b91c1c" }}>
                              {itemError}
                            </p>
                          ) : null}
                        </div>
                      ) : canComplete ? (
                        <div style={{ marginTop: "0.95rem" }}>
                          <button
                            type="button"
                            disabled={isPendingItem}
                            onClick={() => handleCompleteSchedule(item)}
                            style={{
                              borderRadius: "999px",
                              border: "1px solid #10b981",
                              backgroundColor: "#10b981",
                              color: "#ffffff",
                              padding: "0.58rem 0.95rem",
                              fontSize: "0.875rem",
                              fontWeight: 700,
                              opacity: isPendingItem ? 0.7 : 1
                            }}
                          >
                            {isPendingItem && pendingAction === "complete"
                              ? getPendingLabel("complete")
                              : "Complete"}
                          </button>

                          {itemError ? (
                            <p style={{ margin: "0.65rem 0 0", fontSize: "0.875rem", color: "#b91c1c" }}>
                              {itemError}
                            </p>
                          ) : null}
                        </div>
                      ) : item.type === "task_suggestion" ? (
                        <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                          Suggestion unavailable
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!hasPlanningItems && timeline.items.length > 0 ? (
          <div
            style={{
              marginTop: "1rem",
              border: "1px dashed #d6d3d1",
              borderRadius: "1rem",
              padding: "0.95rem",
              color: "#57534e",
              backgroundColor: "#fafaf9",
              fontSize: "0.875rem"
            }}
          >
            No tasks or suggestions are on the timeline for this day yet. Add a task, then run Plan
            My Day when you want suggestions.
          </div>
        ) : null}
      </section>

      <section
        style={{
          ...SURFACE_STYLE,
          padding: "1rem",
          marginBottom: "1rem"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "0.7rem"
          }}
        >
          {[
            { label: "Busy", value: timeline.summary.busyMinutes, tint: "#f5f5f4" },
            { label: "Routine", value: timeline.summary.routineMinutes, tint: "#ecfeff" },
            { label: "Scheduled", value: timeline.summary.scheduledMinutes, tint: "#f3f4f6" },
            { label: "Suggested", value: timeline.summary.suggestedMinutes, tint: "#eff6ff" },
            { label: "Free", value: timeline.summary.freeMinutes, tint: "#fef3c7" }
          ].map((summary) => (
            <div
              key={summary.label}
              style={{
                borderRadius: "1rem",
                border: "1px solid #ece7e1",
                backgroundColor: summary.tint,
                padding: "0.75rem 0.8rem"
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                {summary.label}
              </div>
              <div style={{ marginTop: "0.22rem", fontSize: "1.2rem", fontWeight: 800 }}>
                {summary.value}m
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          ...SURFACE_STYLE,
          padding: "1rem",
          marginBottom: "1rem"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem"
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Open tasks</h2>
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: "#6b7280" }}>
              Tasks waiting to be planned or finished.
            </p>
          </div>
          <span
            style={{
              borderRadius: "999px",
              backgroundColor: "#f5f5f4",
              border: "1px solid #e7e5e4",
              padding: "0.35rem 0.65rem",
              fontSize: "0.82rem",
              color: "#57534e"
            }}
          >
            {openTasks.length}
          </span>
        </div>

        {openTasks.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>
            No open tasks yet. Add a task to get started.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {openTasks.map((task) => (
              <article
                key={task.id}
                style={{
                  border: "1px solid #ece7e1",
                  borderRadius: "1rem",
                  padding: "0.85rem",
                  backgroundColor: "#fcfcfb"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "0.75rem"
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: "999px",
                        backgroundColor: "#f5f5f4",
                        border: "1px solid #e7e5e4",
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.72rem",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#57534e"
                      }}
                    >
                      {task.status}
                    </div>
                    <div
                      style={{
                        marginTop: "0.45rem",
                        fontSize: "0.98rem",
                        fontWeight: 700,
                        wordBreak: "break-word"
                      }}
                    >
                      {task.title}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: "0.8rem", color: "#57534e", textAlign: "right" }}>
                    <div>{task.priority}</div>
                    {task.durationMinutes ? <div>{task.durationMinutes}m</div> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <details
        style={{
          ...SURFACE_STYLE,
          padding: "1rem",
          marginBottom: "1rem"
        }}
      >
        <summary
          style={{
            listStyle: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem"
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Routines</h2>
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: "#6b7280" }}>
              Add recurring blocks that stay fixed on the timeline.
            </p>
          </div>
          <span
            style={{
              borderRadius: "999px",
              border: "1px solid #99f6e4",
              backgroundColor: "#ecfeff",
              color: "#0f766e",
              padding: "0.35rem 0.7rem",
              fontSize: "0.82rem",
              fontWeight: 600
            }}
          >
            Add routine
          </span>
        </summary>

        <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Title</span>
            <input
              type="text"
              value={routineTitle}
              onChange={(event) => setRoutineTitle(event.target.value)}
              placeholder="Lunch"
              style={FIELD_STYLE}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Start</span>
              <input
                type="time"
                value={routineStartTime}
                onChange={(event) => setRoutineStartTime(event.target.value)}
                style={FIELD_STYLE}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>End</span>
              <input
                type="time"
                value={routineEndTime}
                onChange={(event) => setRoutineEndTime(event.target.value)}
                style={FIELD_STYLE}
              />
            </label>
          </div>

          <div style={{ display: "grid", gap: "0.45rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Days</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {WEEKDAY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    border: "1px solid #d6d3d1",
                    borderRadius: "999px",
                    padding: "0.5rem 0.7rem",
                    fontSize: "0.875rem",
                    backgroundColor: selectedDays.includes(option.value) ? "#f0fdfa" : "#ffffff"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(option.value)}
                    onChange={() => toggleSelectedDay(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleCreateRoutine}
              disabled={isCreatingRoutine}
              style={{
                borderRadius: "999px",
                border: "1px solid #0f766e",
                backgroundColor: "#0f766e",
                color: "#ffffff",
                padding: "0.7rem 1rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                opacity: isCreatingRoutine ? 0.7 : 1
              }}
            >
              {isCreatingRoutine ? "Creating..." : "Create routine"}
            </button>
            {routineError ? (
              <p
                style={{
                  margin: "0.65rem 0 0",
                  fontSize: "0.875rem",
                  color: "#b91c1c"
                }}
              >
                {routineError}
              </p>
            ) : null}
          </div>
        </div>
      </details>
    </main>
  );
}
