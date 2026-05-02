"use client"

import type { FormEvent } from "react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { createRoutine } from "../../lib/client-api/routines"
import { createTaskSchedule } from "../../lib/client-api/task-schedules"

type AddToTimelineSheetProps = {
  mockUserId: string
  selectedDate: string
}

type RepeatMode = "NONE" | "DAILY" | "WEEKDAYS" | "CUSTOM"

const FIELD_STYLE = {
  border: "1px solid #ece7e1",
  borderRadius: "1rem",
  padding: "0.82rem 0.95rem",
  fontSize: "0.95rem",
  backgroundColor: "#ffffff",
  color: "#111827",
  width: "100%"
} as const

const WEEKDAY_OPTIONS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 }
] as const

function addDurationToTime(startTime: string, durationMinutes: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime)

  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const totalMinutes = hours * 60 + minutes + durationMinutes

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || totalMinutes > 24 * 60) {
    return null
  }

  const endHours = Math.floor(totalMinutes / 60)
  const endMinutes = totalMinutes % 60

  if (endHours > 23 || (endHours === 24 && endMinutes > 0)) {
    return null
  }

  if (endHours === 24 && endMinutes === 0) {
    return null
  }

  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`
}

function getRepeatDays(mode: RepeatMode, selectedDays: number[]) {
  if (mode === "DAILY") {
    return [0, 1, 2, 3, 4, 5, 6]
  }

  if (mode === "WEEKDAYS") {
    return [1, 2, 3, 4, 5]
  }

  if (mode === "CUSTOM") {
    return [...selectedDays].sort((left, right) => left - right)
  }

  return []
}

export function AddToTimelineSheet({ mockUserId, selectedDate }: AddToTimelineSheetProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(selectedDate)
  const [startTime, setStartTime] = useState("09:00")
  const [durationMinutes, setDurationMinutes] = useState("60")
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("NONE")
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  const durationValue = Number(durationMinutes)
  const repeatsDays = useMemo(
    () => getRepeatDays(repeatMode, selectedDays),
    [repeatMode, selectedDays]
  )
  const computedEndTime = addDurationToTime(startTime, durationValue)

  function openSheet() {
    setDate(selectedDate)
    setIsOpen(true)
    setError(null)
  }

  function closeSheet() {
    setIsOpen(false)
    setError(null)
  }

  function toggleSelectedDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError("title is required")
      return
    }

    if (!Number.isFinite(durationValue) || !Number.isInteger(durationValue) || durationValue <= 0) {
      setError("durationMinutes must be a positive whole number")
      return
    }

    if (!computedEndTime) {
      setError("Duration must keep the item on the selected day")
      return
    }

    if (repeatMode === "CUSTOM" && repeatsDays.length === 0) {
      setError("Choose at least one day for custom repeats")
      return
    }

    setIsSubmitting(true)

    try {
      if (repeatMode === "NONE") {
        await createTaskSchedule({
          mockUserId,
          title: title.trim(),
          date,
          startTime,
          durationMinutes: durationValue
        })
      } else {
        await createRoutine({
          mockUserId,
          title: title.trim(),
          startTime,
          endTime: computedEndTime,
          daysOfWeek: repeatsDays
        })
      }

      setTitle("")
      setDate(selectedDate)
      setStartTime("09:00")
      setDurationMinutes("60")
      setRepeatMode("NONE")
      setSelectedDays([1, 2, 3, 4, 5])
      closeSheet()
      startTransition(() => {
        router.refresh()
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label="Add to Timeline"
        style={{
          position: "fixed",
          right: "1rem",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.6rem)",
          width: "4rem",
          height: "4rem",
          borderRadius: "999px",
          border: "1px solid rgba(251, 113, 133, 0.58)",
          backgroundColor: "#fb7185",
          color: "#ffffff",
          fontSize: "2rem",
          lineHeight: 1,
          boxShadow: "0 16px 30px rgba(251, 113, 133, 0.3)",
          zIndex: 35
        }}
      >
        +
      </button>

      {isOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.22)",
            zIndex: 40
          }}
          onClick={closeSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add to Timeline"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              borderTopLeftRadius: "1.7rem",
              borderTopRightRadius: "1.7rem",
              backgroundColor: "#fffaf6",
              borderTop: "1px solid #fecdd3",
              boxShadow: "0 -16px 36px rgba(15, 23, 42, 0.12)",
              padding: "1rem 1rem calc(env(safe-area-inset-bottom, 0px) + 1.5rem)"
            }}
          >
            <div
              style={{
                width: "3rem",
                height: "0.32rem",
                borderRadius: "999px",
                backgroundColor: "#fecdd3",
                margin: "0 auto 0.85rem"
              }}
            />

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.9rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.8rem"
                }}
              >
                <button
                  type="button"
                  onClick={closeSheet}
                  aria-label="Close add to timeline"
                  style={{
                    width: "2.6rem",
                    height: "2.6rem",
                    borderRadius: "999px",
                    border: "1px solid #f3e8e2",
                    backgroundColor: "#ffffff",
                    color: "#78716c",
                    fontSize: "1.2rem",
                    lineHeight: 1
                  }}
                >
                  x
                </button>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#d9485f"
                    }}
                  >
                    Timeline
                  </p>
                  <h2 style={{ margin: "0.3rem 0 0", fontSize: "1.2rem", color: "#111827" }}>
                    Add to Timeline
                  </h2>
                </div>
              </div>

              <div
                style={{
                  borderRadius: "1.2rem",
                  backgroundColor: "#ffffff",
                  border: "1px solid #f3e8e2",
                  padding: "0.95rem"
                }}
              >
                <div style={{ fontSize: "0.78rem", color: "#a8a29e", marginBottom: "0.35rem" }}>
                  Preview
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
                  {title.trim() || "New timeline item"}
                </div>
                <div style={{ marginTop: "0.25rem", fontSize: "0.88rem", color: "#78716c" }}>
                  {startTime}
                  {computedEndTime ? ` - ${computedEndTime}` : ""} · {durationValue || 0} min
                </div>
              </div>

              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Workout"
                  style={FIELD_STYLE}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.7rem" }}>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    style={FIELD_STYLE}
                  />
                </label>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>Start time</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    style={FIELD_STYLE}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>Duration</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  placeholder="60"
                  style={FIELD_STYLE}
                />
              </label>

              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>Repeat</span>
                <select
                  value={repeatMode}
                  onChange={(event) => setRepeatMode(event.target.value as RepeatMode)}
                  style={FIELD_STYLE}
                >
                  <option value="NONE">None</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKDAYS">Weekdays</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>

              {repeatMode === "CUSTOM" ? (
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>
                    Repeats on
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                    {WEEKDAY_OPTIONS.map((option) => {
                      const selected = selectedDays.includes(option.value)

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleSelectedDay(option.value)}
                          style={{
                            borderRadius: "999px",
                            border: selected ? "1px solid #fb7185" : "1px solid #e7e5e4",
                            backgroundColor: selected ? "#fff1f2" : "#ffffff",
                            color: selected ? "#d9485f" : "#57534e",
                            padding: "0.48rem 0.74rem",
                            fontSize: "0.84rem",
                            fontWeight: 600
                          }}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {error ? (
                <p style={{ margin: 0, fontSize: "0.84rem", color: "#b91c1c" }}>{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  borderRadius: "999px",
                  border: "1px solid #fb7185",
                  backgroundColor: "#fb7185",
                  color: "#ffffff",
                  padding: "0.9rem 1rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  opacity: isSubmitting ? 0.7 : 1,
                  boxShadow: "0 12px 24px rgba(251, 113, 133, 0.22)"
                }}
              >
                {isSubmitting ? "Saving..." : "Save to Timeline"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
