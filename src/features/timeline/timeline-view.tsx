"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AddToTimelineSheet } from "./add-to-timeline-sheet";
import { AppNav } from "../navigation/app-nav";
import { PlanDayButton } from "../planning/plan-day-button";
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
  padding: "1rem 0.9rem 6rem",
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

function formatMinutesCompact(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
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
    return "Repeats";
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
  const [, startTransition] = useTransition();
  const openTasks = tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "ARCHIVED");
  const unscheduledDurationMinutes = tasks
    .filter((task) => task.status === "UNSCHEDULED" || task.status === "MISSED")
    .reduce((total, task) => total + (task.durationMinutes ?? 0), 0);
  const timelineWindow = getTimelineWindow(timeline.items, timeZone);
  const railHours = Array.from(
    { length: timelineWindow.endHour - timelineWindow.startHour + 1 },
    (_, index) => timelineWindow.startHour + index
  );
  const windowStartMinutes = timelineWindow.startHour * MINUTES_PER_HOUR;
  const timelineHeight = (timelineWindow.endHour - timelineWindow.startHour) * PIXELS_PER_HOUR;

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

  function handleDateChange(nextDate: string) {
    if (!nextDate) {
      return;
    }

    router.replace(`/timeline?date=${encodeURIComponent(nextDate)}`, { scroll: false });
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
          <div style={{ display: "grid", gap: "0.45rem" }}>
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
              Timeline
            </p>
            <h1 style={{ margin: "0.3rem 0 0", fontSize: "1.75rem", lineHeight: 1.05 }}>
              {formatDateLabel(timeline.date, timeZone)}
            </h1>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem", color: "#475569" }}>
              What does your day look like?
            </p>
            <div
              style={{
                display: "inline-flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.45rem",
                fontSize: "0.85rem",
                color: "#475569"
              }}
            >
              <span>
                {openTasks.length} open task{openTasks.length === 1 ? "" : "s"} ·{" "}
                {formatMinutesCompact(unscheduledDurationMinutes)} unscheduled
              </span>
              <Link
                href={`/todos?date=${encodeURIComponent(selectedDate)}`}
                style={{
                  textDecoration: "none",
                  color: "#1d4ed8",
                  fontWeight: 700
                }}
              >
                View Todo
              </Link>
            </div>
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

        <PlanDayButton mockUserId={mockUserId} selectedDate={selectedDate} />
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
              Scheduled tasks, suggestions, repeating blocks, and calendar time.
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
            <div style={{ fontWeight: 700, color: "#334155" }}>Nothing scheduled yet</div>
            <div style={{ marginTop: "0.3rem" }}>Add tasks in Todo or Plan My Day.</div>
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

      </section>
      <AddToTimelineSheet mockUserId={mockUserId} selectedDate={selectedDate} />
      <AppNav selectedDate={selectedDate} />
    </main>
  );
}
