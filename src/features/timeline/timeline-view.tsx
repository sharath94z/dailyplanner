"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { completeSchedule } from "../../lib/client-api/schedules";
import {
  acceptSuggestion,
  dismissSuggestion,
  retrySuggestion
} from "../../lib/client-api/suggestions";
import { getUtcInstantForLocalTime } from "../../lib/planner-time";
import type { TimelineItem, TimelineResult } from "./types";

const PAGE_CONTAINER_STYLE = {
  margin: "0 auto",
  maxWidth: "40rem",
  padding: "1.5rem 1rem 3rem",
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#111827"
} as const;

const CARD_STYLE = {
  border: "1px solid #e5e7eb",
  borderRadius: "1rem",
  backgroundColor: "#ffffff"
} as const;

type TimelineViewProps = {
  timeline: TimelineResult;
  mockUserId: string;
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

function getItemAccent(item: TimelineItem) {
  if (item.type === "calendar_event") {
    return {
      border: "1px solid #d1d5db",
      backgroundColor: "#f3f4f6",
      color: "#111827"
    };
  }

  if (item.type === "task_schedule") {
    if (item.state === "COMPLETED") {
      return {
        border: "1px solid #9ca3af",
        backgroundColor: "#e5e7eb",
        color: "#374151"
      };
    }

    if (item.state === "MISSED") {
      return {
        border: "1px solid #fca5a5",
        backgroundColor: "#fef2f2",
        color: "#7f1d1d"
      };
    }

    return {
      border: "1px solid #111827",
      backgroundColor: "#111827",
      color: "#ffffff"
    };
  }

  return {
    border: "1px dashed #2563eb",
    backgroundColor: "#eff6ff",
    color: "#111827"
  };
}

function getItemLabel(item: TimelineItem): string {
  if (item.type === "calendar_event") {
    return `Calendar • ${item.state}`;
  }

  if (item.type === "task_schedule") {
    if (item.state === "COMPLETED") {
      return "Scheduled • Completed";
    }

    if (item.state === "MISSED") {
      return "Scheduled • Missed";
    }

    return `Scheduled • ${item.state}`;
  }

  return `Suggested • ${item.state}`;
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

export function TimelineView({ timeline, mockUserId, timeZone }: TimelineViewProps) {
  const router = useRouter();
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ItemAction>(null);
  const [errorByItemKey, setErrorByItemKey] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

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

  return (
    <main style={PAGE_CONTAINER_STYLE}>
      <section style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#6b7280"
          }}
        >
          Day timeline
        </p>
        <h1 style={{ margin: "0.4rem 0 0", fontSize: "2rem", lineHeight: 1.1 }}>Timeline</h1>
        <p style={{ margin: "0.6rem 0 0", color: "#4b5563" }}>
          {formatDateLabel(timeline.date, timeZone)}
        </p>
      </section>

      <section
        style={{
          ...CARD_STYLE,
          padding: "1rem",
          marginBottom: "1rem"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "0.75rem"
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Busy</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {timeline.summary.busyMinutes}m
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Scheduled</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {timeline.summary.scheduledMinutes}m
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Suggested</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {timeline.summary.suggestedMinutes}m
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Free</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {timeline.summary.freeMinutes}m
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          ...CARD_STYLE,
          padding: "1rem"
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
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Timeline</h2>
          <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            {timeline.items.length} items
          </span>
        </div>

        {timeline.items.length === 0 ? (
          <div
            style={{
              border: "1px dashed #d1d5db",
              borderRadius: "0.9rem",
              padding: "1rem",
              color: "#6b7280",
              backgroundColor: "#f9fafb"
            }}
          >
            No timeline items for this day yet.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem"
            }}
          >
            {timeline.items.map((item) => {
              const accent = getItemAccent(item);
              const itemKey = item.type === "task_suggestion" ? item.suggestionId ?? item.id : item.scheduleId ?? item.id;
              const isPendingItem = pendingItemKey === itemKey && pendingAction !== null;
              const hasActions = item.type === "task_suggestion" && Boolean(item.suggestionId);
              const canComplete = item.type === "task_schedule" && item.state === "PENDING" && Boolean(item.scheduleId);
              const itemError = errorByItemKey[itemKey];

              return (
                <article
                  key={`${item.type}-${item.id}`}
                  style={{
                    border: accent.border,
                    backgroundColor: accent.backgroundColor,
                    color: accent.color,
                    borderRadius: "0.9rem",
                    padding: "0.9rem"
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
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          opacity: item.type === "task_schedule" ? 0.75 : 0.7
                        }}
                      >
                        {getItemLabel(item)}
                      </div>
                      <div
                        style={{
                          marginTop: "0.25rem",
                          fontSize: "1rem",
                          fontWeight: 700,
                          wordBreak: "break-word"
                        }}
                      >
                        {item.title}
                      </div>
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        opacity: item.type === "task_schedule" && item.state === "PENDING" ? 0.9 : 0.8
                      }}
                    >
                      {formatTimeRange(item.startAt, item.endAt, timeZone)}
                    </div>
                  </div>

                  {item.type === "task_schedule" && item.state === "COMPLETED" ? (
                    <p
                      style={{
                        margin: "0.75rem 0 0",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        opacity: 0.85
                      }}
                    >
                      Completed
                    </p>
                  ) : null}

                  {item.type === "task_schedule" && item.state === "MISSED" ? (
                    <p
                      style={{
                        margin: "0.75rem 0 0",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#b91c1c"
                      }}
                    >
                      Missed
                    </p>
                  ) : null}

                  {hasActions ? (
                    <div style={{ marginTop: "0.9rem" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap"
                        }}
                      >
                        <button
                          type="button"
                          disabled={isPendingItem}
                          onClick={() => handleSuggestionAction(item, "accept")}
                          style={{
                            borderRadius: "999px",
                            border: "1px solid #2563eb",
                            backgroundColor: "#2563eb",
                            color: "#ffffff",
                            padding: "0.55rem 0.9rem",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            opacity: isPendingItem ? 0.7 : 1
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
                            backgroundColor: "#ffffff",
                            color: "#1d4ed8",
                            padding: "0.55rem 0.9rem",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            opacity: isPendingItem ? 0.7 : 1
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
                            border: "1px solid #d1d5db",
                            backgroundColor: "#f9fafb",
                            color: "#374151",
                            padding: "0.55rem 0.9rem",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            opacity: isPendingItem ? 0.7 : 1
                          }}
                        >
                          {isPendingItem && pendingAction === "dismiss"
                            ? getPendingLabel("dismiss")
                            : "Dismiss"}
                        </button>
                      </div>

                      {itemError ? (
                        <p
                          style={{
                            margin: "0.65rem 0 0",
                            fontSize: "0.875rem",
                            color: "#b91c1c"
                          }}
                        >
                          {itemError}
                        </p>
                      ) : null}
                    </div>
                  ) : canComplete ? (
                    <div style={{ marginTop: "0.9rem" }}>
                      <button
                        type="button"
                        disabled={isPendingItem}
                        onClick={() => handleCompleteSchedule(item)}
                        style={{
                          borderRadius: "999px",
                          border: "1px solid #10b981",
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          padding: "0.55rem 0.9rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          opacity: isPendingItem ? 0.7 : 1
                        }}
                      >
                        {isPendingItem && pendingAction === "complete"
                          ? getPendingLabel("complete")
                          : "Complete"}
                      </button>

                      {itemError ? (
                        <p
                          style={{
                            margin: "0.65rem 0 0",
                            fontSize: "0.875rem",
                            color: "#b91c1c"
                          }}
                        >
                          {itemError}
                        </p>
                      ) : null}
                    </div>
                  ) : item.type === "task_suggestion" ? (
                    <p
                      style={{
                        margin: "0.75rem 0 0",
                        fontSize: "0.875rem",
                        color: "#6b7280"
                      }}
                    >
                      Suggestion unavailable
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
