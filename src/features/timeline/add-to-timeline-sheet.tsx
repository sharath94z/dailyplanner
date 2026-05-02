"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createRoutine } from "../../lib/client-api/routines";
import { createTaskSchedule } from "../../lib/client-api/task-schedules";

type AddToTimelineSheetProps = {
  mockUserId: string;
  selectedDate: string;
};

type RepeatMode = "NONE" | "DAILY" | "WEEKDAYS" | "CUSTOM";

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
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 }
] as const;

function addDurationToTime(startTime: string, durationMinutes: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const totalMinutes = hours * 60 + minutes + durationMinutes;

  if (durationMinutes <= 0 || totalMinutes > 24 * 60) {
    return null;
  }

  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;

  if (endHours > 23 || (endHours === 24 && endMinutes > 0)) {
    return null;
  }

  if (endHours === 24 && endMinutes === 0) {
    return null;
  }

  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function getRepeatDays(mode: RepeatMode, selectedDays: number[]) {
  if (mode === "DAILY") {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  if (mode === "WEEKDAYS") {
    return [1, 2, 3, 4, 5];
  }

  if (mode === "CUSTOM") {
    return [...selectedDays].sort((left, right) => left - right);
  }

  return [];
}

export function AddToTimelineSheet({ mockUserId, selectedDate }: AddToTimelineSheetProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("NONE");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  const durationValue = Number(durationMinutes);
  const repeatsDays = useMemo(
    () => getRepeatDays(repeatMode, selectedDays),
    [repeatMode, selectedDays]
  );

  function closeSheet() {
    setIsOpen(false);
    setError(null);
  }

  function toggleSelectedDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()
    );
  }

  async function handleSubmit() {
    setError(null);

    if (!title.trim()) {
      setError("title is required");
      return;
    }

    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      setError("durationMinutes must be positive");
      return;
    }

    const computedEndTime = addDurationToTime(startTime, durationValue);

    if (!computedEndTime) {
      setError("Duration must keep the item on the selected day");
      return;
    }

    if (repeatMode === "CUSTOM" && repeatsDays.length === 0) {
      setError("Choose at least one day for custom repeats");
      return;
    }

    setIsSubmitting(true);

    try {
      if (repeatMode === "NONE") {
        await createTaskSchedule({
          mockUserId,
          title: title.trim(),
          date: selectedDate,
          startTime,
          durationMinutes: durationValue
        });
      } else {
        await createRoutine({
          mockUserId,
          title: title.trim(),
          startTime,
          endTime: computedEndTime,
          daysOfWeek: repeatsDays
        });
      }

      setTitle("");
      setStartTime("09:00");
      setDurationMinutes("60");
      setRepeatMode("NONE");
      setSelectedDays([1, 2, 3, 4, 5]);
      closeSheet();
      startTransition(() => {
        router.refresh();
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Add to Timeline"
        style={{
          position: "fixed",
          right: "1rem",
          bottom: "5.9rem",
          width: "3.75rem",
          height: "3.75rem",
          borderRadius: "999px",
          border: "1px solid rgba(251, 113, 133, 0.65)",
          backgroundColor: "#fb7185",
          color: "#ffffff",
          fontSize: "2rem",
          lineHeight: 1,
          boxShadow: "0 18px 30px rgba(244, 114, 182, 0.28)",
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
            backgroundColor: "rgba(15, 23, 42, 0.28)",
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
              borderTopLeftRadius: "1.5rem",
              borderTopRightRadius: "1.5rem",
              backgroundColor: "#fffefc",
              borderTop: "1px solid #fbcfe8",
              boxShadow: "0 -18px 40px rgba(15, 23, 42, 0.12)",
              padding: "1rem 1rem 6.5rem"
            }}
          >
            <div
              style={{
                width: "3rem",
                height: "0.3rem",
                borderRadius: "999px",
                backgroundColor: "#fbcfe8",
                margin: "0 auto 0.9rem"
              }}
            />
            <div style={{ display: "grid", gap: "0.85rem" }}>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#e11d48"
                  }}
                >
                  Timeline
                </p>
                <h2 style={{ margin: "0.3rem 0 0", fontSize: "1.2rem" }}>Add to Timeline</h2>
                <p style={{ margin: "0.3rem 0 0", fontSize: "0.88rem", color: "#6b7280" }}>
                  Place a one-off item or a repeating block directly on your day.
                </p>
              </div>

              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Doctor appointment"
                  style={FIELD_STYLE}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.7rem" }}>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Start time</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    style={FIELD_STYLE}
                  />
                </label>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Duration</span>
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
              </div>

              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Repeat</span>
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
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Repeats on</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {WEEKDAY_OPTIONS.map((option) => {
                      const selected = selectedDays.includes(option.value);

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleSelectedDay(option.value)}
                          style={{
                            borderRadius: "999px",
                            border: selected ? "1px solid #f472b6" : "1px solid #d6d3d1",
                            backgroundColor: selected ? "#fff1f2" : "#ffffff",
                            color: selected ? "#be185d" : "#57534e",
                            padding: "0.48rem 0.72rem",
                            fontSize: "0.875rem",
                            fontWeight: 600
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {error ? (
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#b91c1c" }}>{error}</p>
              ) : null}

              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    borderRadius: "999px",
                    border: "1px solid #fb7185",
                    backgroundColor: "#fb7185",
                    color: "#ffffff",
                    padding: "0.72rem 1rem",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    opacity: isSubmitting ? 0.7 : 1,
                    boxShadow: "0 12px 24px rgba(244, 114, 182, 0.22)"
                  }}
                >
                  {isSubmitting ? "Saving..." : "Save to Timeline"}
                </button>
                <button
                  type="button"
                  onClick={closeSheet}
                  disabled={isSubmitting}
                  style={{
                    borderRadius: "999px",
                    border: "1px solid #e7e5e4",
                    backgroundColor: "#ffffff",
                    color: "#57534e",
                    padding: "0.72rem 1rem",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
