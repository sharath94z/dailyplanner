"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { AddToTimelineSheet } from "./add-to-timeline-sheet"
import { AppNav } from "../navigation/app-nav"
import { PlanDayButton } from "../planning/plan-day-button"
import { completeSchedule } from "../../lib/client-api/schedules"
import {
  acceptSuggestion,
  dismissSuggestion,
  retrySuggestion
} from "../../lib/client-api/suggestions"
import {
  getDayWindowForDate,
  getUtcInstantForLocalTime,
  getWeekdayFromDateString,
  shiftDateString
} from "../../lib/planner-time"
import type { TimelineItem, TimelineResult } from "./types"

const PAGE_CONTAINER_STYLE = {
  margin: "0 auto",
  maxWidth: "28rem",
  minHeight: "100vh",
  padding: "0 1rem 9.6rem",
  fontFamily:
    '"Manrope", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#0f172a",
  backgroundColor: "#faf6f3"
} as const

const SURFACE_STYLE = {
  border: "1px solid #e8dfda",
  borderRadius: "1.5rem",
  backgroundColor: "#ffffff",
  boxShadow: "0 15px 24px rgba(17, 24, 39, 0.05)"
} as const

const DEFAULT_DAY_START_HOUR = 8
const DEFAULT_DAY_END_HOUR = 20
const MINUTES_PER_HOUR = 60
const PIXELS_PER_HOUR = 72
const TIME_LABEL_WIDTH_PX = 44
const SPINE_OFFSET_PX = 55
const BLOCK_START_PX = 74
const BLOCK_SIDE_PADDING_PX = 4

type TimelineViewProps = {
  timeline: TimelineResult
  mockUserId: string
  openTaskCount: number
  selectedDate: string
  timeZone: string
  unscheduledDurationMinutes: number
}

type ItemAction = "accept" | "retry" | "dismiss" | "complete" | null

type TimelineItemLayout = {
  item: TimelineItem
  laneCount: number
  laneIndex: number
}

function formatHeaderDate(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone
  }).format(getUtcInstantForLocalTime(date, "00:00", timeZone))
}

function formatWeekdayLabel(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone
  }).format(getUtcInstantForLocalTime(date, "00:00", timeZone))
}

function formatDayNumber(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone
  }).format(getUtcInstantForLocalTime(date, "00:00", timeZone))
}

function formatAccessibleDate(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone
  }).format(getUtcInstantForLocalTime(date, "00:00", timeZone))
}

function formatTimeRange(startAt: string, endAt: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone
  })

  return `${formatter.format(new Date(startAt))} - ${formatter.format(new Date(endAt))}`
}

function formatTimeLabel(startAt: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone
  }).format(new Date(startAt))
}

function getWeekDates(selectedDate: string) {
  const startOfWeek = shiftDateString(selectedDate, -getWeekdayFromDateString(selectedDate))
  return Array.from({ length: 7 }, (_, index) => shiftDateString(startOfWeek, index))
}

function getMinutesIntoDay(instant: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone
  }).formatToParts(new Date(instant))

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")

  return hour * MINUTES_PER_HOUR + minute
}

function getClampedItemBounds(
  item: TimelineItem,
  dayStartUtc: Date,
  dayEndUtc: Date,
  timeZone: string
) {
  const rawStartAt = new Date(item.startAt)
  const rawEndAt = new Date(item.endAt)
  const startAt =
    rawStartAt.getTime() < dayStartUtc.getTime() ? dayStartUtc : rawStartAt
  const endAt =
    rawEndAt.getTime() > dayEndUtc.getTime() ? dayEndUtc : rawEndAt

  return {
    startAt,
    endAt,
    startMinutes: getMinutesIntoDay(startAt.toISOString(), timeZone),
    endMinutes: getMinutesIntoDay(endAt.toISOString(), timeZone)
  }
}

function formatMinutesCompact(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return "0m"
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

function getTimelineWindow(
  items: TimelineItem[],
  dayStartUtc: Date,
  dayEndUtc: Date,
  timeZone: string
) {
  if (items.length === 0) {
    return {
      startHour: DEFAULT_DAY_START_HOUR,
      endHour: DEFAULT_DAY_END_HOUR
    }
  }

  const itemBounds = items.map((item) =>
    getClampedItemBounds(item, dayStartUtc, dayEndUtc, timeZone)
  )
  const itemStarts = itemBounds.map((bounds) =>
    Math.floor(bounds.startMinutes / MINUTES_PER_HOUR)
  )
  const itemEnds = itemBounds.map((bounds) =>
    Math.ceil(bounds.endMinutes / MINUTES_PER_HOUR)
  )

  const startHour = Math.max(0, Math.min(DEFAULT_DAY_START_HOUR, ...itemStarts))
  const endHour = Math.min(24, Math.max(DEFAULT_DAY_END_HOUR, ...itemEnds))

  return {
    startHour,
    endHour: Math.max(startHour + 1, endHour)
  }
}

function hasInteractiveControls(item: TimelineItem) {
  return item.type === "task_suggestion" || (item.type === "task_schedule" && item.state === "PENDING")
}

function getRenderedBlockMetrics(
  item: TimelineItem,
  dayStartUtc: Date,
  dayEndUtc: Date,
  timeZone: string,
  windowStartMinutes: number
) {
  const { startMinutes, endMinutes } = getClampedItemBounds(
    item,
    dayStartUtc,
    dayEndUtc,
    timeZone
  )
  const durationMinutes = Math.max(12, endMinutes - startMinutes)
  const top = ((startMinutes - windowStartMinutes) / MINUTES_PER_HOUR) * PIXELS_PER_HOUR
  const visualHeight = Math.max(
    hasInteractiveControls(item) ? 106 : item.type === "calendar_event" ? 66 : 78,
    (durationMinutes / MINUTES_PER_HOUR) * PIXELS_PER_HOUR
  )

  return {
    top,
    visualHeight,
    visualBottom: top + visualHeight
  }
}

function getTimelineItemLayouts(
  items: TimelineItem[],
  dayStartUtc: Date,
  dayEndUtc: Date,
  timeZone: string,
  windowStartMinutes: number
) {
  const sortedItems = [...items].sort((left, right) => {
    const leftBounds = getClampedItemBounds(left, dayStartUtc, dayEndUtc, timeZone)
    const rightBounds = getClampedItemBounds(right, dayStartUtc, dayEndUtc, timeZone)
    const startDiff = leftBounds.startAt.getTime() - rightBounds.startAt.getTime()

    if (startDiff !== 0) {
      return startDiff
    }

    return leftBounds.endAt.getTime() - rightBounds.endAt.getTime()
  })

  const layouts: TimelineItemLayout[] = []
  let group: TimelineItem[] = []
  let groupEnd = 0

  function flushGroup() {
    if (group.length === 0) {
      return
    }

    const laneEnds: number[] = []
    const groupedLayouts: TimelineItemLayout[] = []

    for (const item of group) {
      const metrics = getRenderedBlockMetrics(
        item,
        dayStartUtc,
        dayEndUtc,
        timeZone,
        windowStartMinutes
      )
      let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= metrics.top)

      if (laneIndex === -1) {
        laneIndex = laneEnds.length
        laneEnds.push(metrics.visualBottom)
      } else {
        laneEnds[laneIndex] = metrics.visualBottom
      }

      groupedLayouts.push({
        item,
        laneIndex,
        laneCount: 0
      })
    }

    const laneCount = Math.max(1, laneEnds.length)

    for (const layout of groupedLayouts) {
      layouts.push({
        ...layout,
        laneCount
      })
    }

    group = []
    groupEnd = 0
  }

  for (const item of sortedItems) {
    const metrics = getRenderedBlockMetrics(
      item,
      dayStartUtc,
      dayEndUtc,
      timeZone,
      windowStartMinutes
    )

    if (group.length === 0) {
      group = [item]
      groupEnd = metrics.visualBottom
      continue
    }

    if (metrics.top < groupEnd) {
      group.push(item)
      groupEnd = Math.max(groupEnd, metrics.visualBottom)
      continue
    }

    flushGroup()
    group = [item]
    groupEnd = metrics.visualBottom
  }

  flushGroup()

  const layoutMap = new Map(layouts.map((layout) => [`${layout.item.type}-${layout.item.id}`, layout]))

  return items.map((item) => {
    const layout = layoutMap.get(`${item.type}-${item.id}`)

    if (!layout) {
      return {
        item,
        laneCount: 1,
        laneIndex: 0
      }
    }

    return layout
  })
}

function getItemAccent(item: TimelineItem) {
  if (item.type === "calendar_event") {
    return {
      border: "1px solid #e7e5e4",
      backgroundColor: "#fcfcfb",
      color: "#292524",
      badgeBackground: "#f5f5f4",
      badgeColor: "#78716c",
      timeColor: "#78716c",
      markerBackground: "#ffffff",
      markerColor: "#d6d3d1"
    }
  }

  if (item.type === "task_schedule") {
    if (item.state === "COMPLETED") {
      return {
        border: "1px solid #d6d3d1",
        backgroundColor: "#fbfbfb",
        color: "#475569",
        badgeBackground: "#f1f5f9",
        badgeColor: "#64748b",
        timeColor: "#64748b",
        markerBackground: "#ffffff",
        markerColor: "#cbd5e1"
      }
    }

    if (item.state === "MISSED") {
      return {
        border: "1px solid #fecaca",
        backgroundColor: "#fff7f7",
        color: "#7f1d1d",
        badgeBackground: "#fee2e2",
        badgeColor: "#b91c1c",
        timeColor: "#b91c1c",
        markerBackground: "#fecaca",
        markerColor: "#991b1b"
      }
    }

    return {
      border: "1px solid #ece3dc",
      backgroundColor: "#ffffff",
      color: "#1f2937",
      badgeBackground: "#fef3c7",
      badgeColor: "#b45309",
      timeColor: "#78716c",
      markerBackground: "#ffffff",
      markerColor: "#e7e5e4"
    }
  }

  if (item.type === "routine") {
    return {
      border: "1px solid #e7e2df",
      backgroundColor: "#ffffff",
      color: "#1f2937",
      badgeBackground: "rgba(217, 223, 245, 0.35)",
      badgeColor: "#5c6274",
      timeColor: "#564242",
      markerBackground: "#ffffff",
      markerColor: "#e7e5e4"
    }
  }

  return {
    border: "1px dashed #f8b4bd",
    backgroundColor: "#fffafb",
    color: "#1f2937",
    badgeBackground: "#ffe4e6",
    badgeColor: "#d9485f",
    timeColor: "#78716c",
    markerBackground: "#ffffff",
    markerColor: "#fecdd3"
  }
}

function getItemLabel(item: TimelineItem): string {
  if (item.type === "calendar_event") {
    return "Calendar"
  }

  if (item.type === "routine") {
    return "Repeats"
  }

  if (item.type === "task_schedule") {
    if (item.state === "COMPLETED") {
      return "Completed"
    }

    if (item.state === "MISSED") {
      return "Missed"
    }

    return "Scheduled"
  }

  return "Suggestion"
}

function shouldRenderMarker(item: TimelineItem) {
  return !(item.type === "task_schedule" && item.state === "COMPLETED")
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12" fill="none">
      <path d="M1 1H17M1 6H17M1 11H17" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" width="18" height="20" viewBox="0 0 18 20" fill="none">
      <path
        d="M5 1V4M13 1V4M2 7H16M4.2 3H13.8C14.9201 3 15.4802 3 15.908 3.21799C16.2843 3.40973 16.5903 3.71569 16.782 4.09202C17 4.51984 17 5.07989 17 6.2V13.8C17 14.9201 17 15.4802 16.782 15.908C16.5903 16.2843 16.2843 16.5903 15.908 16.782C15.4802 17 14.9201 17 13.8 17H4.2C3.07989 17 2.51984 17 2.09202 16.782C1.71569 16.5903 1.40973 16.2843 1.21799 15.908C1 15.4802 1 14.9201 1 13.8V6.2C1 5.07989 1 4.51984 1.21799 4.09202C1.40973 3.71569 1.71569 3.40973 2.09202 3.21799C2.51984 3 3.07989 3 4.2 3Z"
        stroke="#94A3B8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getPendingLabel(action: Exclude<ItemAction, null>) {
  if (action === "accept") {
    return "Accepting..."
  }

  if (action === "retry") {
    return "Retrying..."
  }

  if (action === "complete") {
    return "Completing..."
  }

  return "Dismissing..."
}

export function TimelineView({
  timeline,
  mockUserId,
  openTaskCount,
  selectedDate,
  timeZone,
  unscheduledDurationMinutes
}: TimelineViewProps) {
  const router = useRouter()
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<ItemAction>(null)
  const [errorByItemKey, setErrorByItemKey] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()
  const selectedDayWindow = getDayWindowForDate(timeline.date, timeZone)
  const timelineWindow = getTimelineWindow(
    timeline.items,
    selectedDayWindow.dayStartUtc,
    selectedDayWindow.dayEndUtc,
    timeZone
  )
  const weekDates = getWeekDates(selectedDate)
  const windowStartMinutes = timelineWindow.startHour * MINUTES_PER_HOUR
  const timelineHeight = (timelineWindow.endHour - timelineWindow.startHour) * PIXELS_PER_HOUR
  const timelineLayouts = getTimelineItemLayouts(
    timeline.items,
    selectedDayWindow.dayStartUtc,
    selectedDayWindow.dayEndUtc,
    timeZone,
    windowStartMinutes
  )

  async function handleSuggestionAction(
    item: TimelineItem,
    action: "accept" | "retry" | "dismiss"
  ) {
    const suggestionId = item.suggestionId
    const itemKey = item.suggestionId ?? item.id

    if (!suggestionId) {
      setErrorByItemKey((current) => ({
        ...current,
        [itemKey]: "Suggestion unavailable"
      }))
      return
    }

    setPendingItemKey(itemKey)
    setPendingAction(action)
    setErrorByItemKey((current) => {
      const next = { ...current }
      delete next[itemKey]
      return next
    })

    try {
      if (action === "accept") {
        await acceptSuggestion({ suggestionId, mockUserId })
      } else if (action === "retry") {
        await retrySuggestion({ suggestionId, mockUserId })
      } else {
        await dismissSuggestion({ suggestionId, mockUserId })
      }

      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setErrorByItemKey((current) => ({
        ...current,
        [itemKey]: error instanceof Error ? error.message : "Request failed"
      }))
      setPendingItemKey(null)
      setPendingAction(null)
    }
  }

  async function handleCompleteSchedule(item: TimelineItem) {
    const scheduleId = item.scheduleId
    const itemKey = item.scheduleId ?? item.id

    if (!scheduleId) {
      setErrorByItemKey((current) => ({
        ...current,
        [itemKey]: "Schedule unavailable"
      }))
      return
    }

    setPendingItemKey(itemKey)
    setPendingAction("complete")
    setErrorByItemKey((current) => {
      const next = { ...current }
      delete next[itemKey]
      return next
    })

    try {
      await completeSchedule({ scheduleId, mockUserId })
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setErrorByItemKey((current) => ({
        ...current,
        [itemKey]: error instanceof Error ? error.message : "Request failed"
      }))
      setPendingItemKey(null)
      setPendingAction(null)
    }
  }

  function handleDateChange(nextDate: string) {
    if (!nextDate) {
      return
    }

    router.replace(`/timeline?date=${encodeURIComponent(nextDate)}`, { scroll: false })
  }

  return (
    <main style={PAGE_CONTAINER_STYLE}>
      <section style={{ paddingTop: "0.7rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gap: "1.1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.5rem 1fr 2.5rem",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.35rem 0 0.1rem"
            }}
          >
            <button
              type="button"
              aria-label="Menu"
              style={{
                width: "2.5rem",
                height: "2.5rem",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0
              }}
            >
              <MenuIcon />
            </button>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#94a3b8"
                }}
              >
                Timeline
              </p>
              <h1
                style={{
                  margin: "0.3rem 0 0",
                  fontSize: "1.95rem",
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  color: "#0f172a"
                }}
              >
                {formatHeaderDate(selectedDate, timeZone)}
              </h1>
            </div>
            <div style={{ position: "relative", justifySelf: "end" }}>
              <div
                style={{
                  position: "relative",
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden"
                }}
              >
                <CalendarIcon />
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => handleDateChange(event.target.value)}
                aria-label="Choose date"
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  cursor: "pointer"
                }}
              />
            </div>
          </div>
          <div
            style={{
              ...SURFACE_STYLE,
              overflowX: "auto",
              scrollbarWidth: "none",
              padding: "0.95rem 1rem"
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "1rem",
                minWidth: "max-content",
                alignItems: "center"
              }}
            >
              {weekDates.map((date) => {
                const isSelected = date === selectedDate

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => handleDateChange(date)}
                    aria-label={`Go to ${formatAccessibleDate(date, timeZone)}`}
                    style={{
                      display: "grid",
                      justifyItems: "center",
                      gap: "0.25rem",
                      minWidth: "2.5rem",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      color: isSelected ? "#751626" : "#564242"
                    }}
                  >
                    <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                      {formatWeekdayLabel(date, timeZone)}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "2.5rem",
                        height: "2.5rem",
                        borderRadius: "999px",
                        backgroundColor: isSelected ? "#ff7f8a" : "transparent",
                        color: isSelected ? "#751626" : "#1c1b1a",
                        fontSize: "1.05rem",
                        fontWeight: isSelected ? 800 : 500
                      }}
                    >
                      {formatDayNumber(date, timeZone)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.9rem",
              flexWrap: "wrap"
            }}
          >
            <div style={{ display: "grid", gap: "0.15rem" }}>
              <div
                style={{
                  fontSize: "0.95rem",
                  lineHeight: 1.4,
                  color: "#1c1b1a",
                  fontWeight: 800
                }}
              >
                {openTaskCount} open task{openTaskCount === 1 ? "" : "s"} ·{" "}
                {formatMinutesCompact(unscheduledDurationMinutes)}
              </div>
              <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.95rem", color: "#564242" }}>unscheduled</span>
                <Link
                  href={`/todos?date=${encodeURIComponent(selectedDate)}`}
                  style={{
                    textDecoration: "none",
                    color: "#94a3b8",
                    fontSize: "0.86rem",
                    fontWeight: 700
                  }}
                >
                  View Todo
                </Link>
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <PlanDayButton mockUserId={mockUserId} selectedDate={selectedDate} />
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          position: "relative",
          marginBottom: "1rem"
        }}
      >
        {timeline.items.length === 0 ? (
          <div
            style={{
              ...SURFACE_STYLE,
              borderStyle: "dashed",
              padding: "1.15rem",
              color: "#57534e",
              fontSize: "0.95rem"
            }}
          >
            <div style={{ fontWeight: 700, color: "#111827" }}>Nothing scheduled yet</div>
            <div style={{ marginTop: "0.3rem" }}>Tap + to add a timeline item or plan your day.</div>
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              minHeight: `${timelineHeight}px`
            }}
          >
            <div
              style={{
                position: "relative",
                minHeight: `${timelineHeight}px`
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "1rem",
                  bottom: "1rem",
                  left: `${SPINE_OFFSET_PX}px`,
                  width: "1px",
                  backgroundColor: "#e5e2df"
                }}
              />

              <div style={{ position: "relative", height: `${timelineHeight}px` }}>
                {timelineLayouts.map(({ item, laneCount, laneIndex }) => {
                  const accent = getItemAccent(item)
                  const itemKey =
                    item.type === "task_suggestion" ? item.suggestionId ?? item.id : item.scheduleId ?? item.id
                  const isPendingItem = pendingItemKey === itemKey && pendingAction !== null
                  const hasActions = item.type === "task_suggestion" && Boolean(item.suggestionId)
                  const canComplete =
                    item.type === "task_schedule" &&
                    item.state === "PENDING" &&
                    Boolean(item.scheduleId)
                  const itemError = errorByItemKey[itemKey]
                  const metrics = getRenderedBlockMetrics(
                    item,
                    selectedDayWindow.dayStartUtc,
                    selectedDayWindow.dayEndUtc,
                    timeZone,
                    windowStartMinutes
                  )
                  const laneGapPx = laneCount > 1 ? 6 : 0
                  const laneWidthCss =
                    laneCount > 1
                      ? `calc((100% - ${BLOCK_START_PX + BLOCK_SIDE_PADDING_PX}px) / ${laneCount} - ${laneGapPx}px)`
                      : `calc(100% - ${BLOCK_START_PX + BLOCK_SIDE_PADDING_PX}px)`
                  const laneLeftCss =
                    laneCount > 1
                      ? `calc(${BLOCK_START_PX}px + (${laneIndex} * ((100% - ${BLOCK_START_PX + BLOCK_SIDE_PADDING_PX}px) / ${laneCount})) + ${laneGapPx / 2}px)`
                      : `${BLOCK_START_PX}px`
                  const showMarker = shouldRenderMarker(item)

                  return (
                    <div key={`${item.type}-${item.id}`}>
                      <div
                        style={{
                          position: "absolute",
                          top: `${metrics.top + 0.9}px`,
                          left: 0,
                          width: `${TIME_LABEL_WIDTH_PX}px`,
                          textAlign: "left",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          color: "#564242"
                        }}
                      >
                        {formatTimeLabel(item.startAt, timeZone)}
                      </div>
                      {showMarker ? (
                        <div
                          style={{
                            position: "absolute",
                            top: `${metrics.top + 2}px`,
                            left: `${SPINE_OFFSET_PX - 8}px`,
                            width: "16px",
                            height: "16px",
                            borderRadius: "999px",
                            backgroundColor: accent.markerBackground,
                            border: "2px solid #e5e2df",
                            boxSizing: "border-box",
                            zIndex: 1
                          }}
                        />
                      ) : null}
                      <article
                        style={{
                          position: "absolute",
                          top: `${metrics.top}px`,
                          left: laneLeftCss,
                          width: laneWidthCss,
                          minHeight: `${metrics.visualHeight}px`,
                          border: accent.border,
                          backgroundColor: accent.backgroundColor,
                          color: accent.color,
                          borderRadius: "1.6rem",
                          padding: "1.1rem 1.1rem 1rem",
                          zIndex: laneIndex + 1,
                          boxShadow: "0 15px 15px rgba(17, 24, 39, 0.04)"
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: "0.75rem"
                            }}
                          >
                            <div
                              style={{
                                marginTop: "0.08rem",
                                fontSize: "1.05rem",
                                fontWeight: 800,
                                lineHeight: 1.25,
                                color: item.state === "COMPLETED" ? "#64748b" : "#1c1b1a",
                                wordBreak: "break-word",
                                textDecoration:
                                  item.type === "task_schedule" && item.state === "COMPLETED"
                                    ? "line-through"
                                    : "none"
                              }}
                            >
                              {item.title}
                            </div>
                            {item.type === "routine" || item.type === "calendar_event" || item.type === "task_suggestion" ? (
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  borderRadius: "999px",
                                  backgroundColor: accent.badgeBackground,
                                  color: accent.badgeColor,
                                  padding: "0.28rem 0.7rem",
                                  fontSize: "0.78rem",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                  flexShrink: 0
                                }}
                              >
                                {item.type === "routine" ? "Daily" : getItemLabel(item)}
                              </div>
                            ) : null}
                          </div>
                          <div
                            style={{
                              marginTop: "0.55rem",
                              fontSize: "0.94rem",
                              lineHeight: 1.4,
                              color: accent.timeColor
                            }}
                          >
                            {formatTimeRange(item.startAt, item.endAt, timeZone)}
                          </div>
                        </div>

                        {item.type === "task_schedule" && item.state === "COMPLETED" ? (
                          <p style={{ margin: "0.7rem 0 0", fontSize: "0.84rem", color: "#64748b" }}>
                            Marked complete
                          </p>
                        ) : null}

                        {item.type === "task_schedule" && item.state === "MISSED" ? (
                          <p style={{ margin: "0.7rem 0 0", fontSize: "0.84rem", color: "#b91c1c" }}>
                            This block was missed
                          </p>
                        ) : null}

                        {hasActions ? (
                          <div style={{ marginTop: "0.8rem" }}>
                            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={isPendingItem}
                                onClick={() => handleSuggestionAction(item, "accept")}
                                style={{
                                  borderRadius: "999px",
                                  border: "1px solid #fb7185",
                                  backgroundColor: "#fb7185",
                                  color: "#ffffff",
                                  padding: "0.55rem 0.88rem",
                                  fontSize: "0.84rem",
                                  fontWeight: 700,
                                  opacity: isPendingItem ? 0.7 : 1,
                                  minWidth: "5.1rem"
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
                                  border: "1px solid #dbeafe",
                                  backgroundColor: "#ffffff",
                                  color: "#2563eb",
                                  padding: "0.55rem 0.88rem",
                                  fontSize: "0.84rem",
                                  fontWeight: 700,
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
                                  border: "1px solid transparent",
                                  backgroundColor: "rgba(255,255,255,0.72)",
                                  color: "#6b7280",
                                  padding: "0.55rem 0.82rem",
                                  fontSize: "0.84rem",
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
                              <p style={{ margin: "0.55rem 0 0", fontSize: "0.83rem", color: "#b91c1c" }}>
                                {itemError}
                              </p>
                            ) : null}
                          </div>
                        ) : canComplete ? (
                          <div style={{ marginTop: "0.8rem" }}>
                            <button
                              type="button"
                              disabled={isPendingItem}
                              onClick={() => handleCompleteSchedule(item)}
                              style={{
                                borderRadius: "999px",
                                border: "1px solid #bbf7d0",
                                backgroundColor: "#10b981",
                                color: "#ffffff",
                                padding: "0.55rem 0.88rem",
                                fontSize: "0.84rem",
                                fontWeight: 700,
                                opacity: isPendingItem ? 0.7 : 1
                              }}
                            >
                              {isPendingItem && pendingAction === "complete"
                                ? getPendingLabel("complete")
                                : "Complete"}
                            </button>

                            {itemError ? (
                              <p style={{ margin: "0.55rem 0 0", fontSize: "0.83rem", color: "#b91c1c" }}>
                                {itemError}
                              </p>
                            ) : null}
                          </div>
                        ) : item.type === "task_suggestion" ? (
                          <p style={{ margin: "0.65rem 0 0", fontSize: "0.83rem", color: "#78716c" }}>
                            Suggestion unavailable
                          </p>
                        ) : null}
                      </article>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <AddToTimelineSheet mockUserId={mockUserId} selectedDate={selectedDate} />
      <AppNav selectedDate={selectedDate} />
    </main>
  )
}
