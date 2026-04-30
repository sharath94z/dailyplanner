"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createTask } from "../../lib/client-api/tasks";

type TaskCreateFormProps = {
  mockUserId: string;
};

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"] as const;

const INPUT_STYLE = {
  border: "1px solid #d1d5db",
  borderRadius: "0.75rem",
  padding: "0.65rem 0.8rem",
  fontSize: "0.95rem",
  width: "100%",
  backgroundColor: "#ffffff"
} as const;

export function TaskCreateForm({ mockUserId }: TaskCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    try {
      await createTask({
        mockUserId,
        title,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        priority
      });

      setTitle("");
      setDurationMinutes("");
      setPriority("MEDIUM");

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
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "1rem",
        backgroundColor: "#ffffff",
        padding: "1rem",
        marginBottom: "1rem"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Add task</h2>
      </div>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Write weekly update"
            style={INPUT_STYLE}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Duration</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              placeholder="30"
              style={INPUT_STYLE}
            />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Priority</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as (typeof PRIORITY_OPTIONS)[number])
              }
              style={INPUT_STYLE}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              borderRadius: "999px",
              border: "1px solid #111827",
              backgroundColor: "#111827",
              color: "#ffffff",
              padding: "0.6rem 1rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? "Adding..." : "Add Task"}
          </button>
          {error ? (
            <p style={{ margin: "0.65rem 0 0", fontSize: "0.875rem", color: "#b91c1c" }}>{error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
