"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createTask } from "../../lib/client-api/tasks";

type TaskCreateFormProps = {
  mockUserId: string;
};

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"] as const;

const INPUT_STYLE = {
  border: "1px solid #d6d3d1",
  borderRadius: "0.9rem",
  padding: "0.75rem 0.9rem",
  fontSize: "0.95rem",
  width: "100%",
  backgroundColor: "#fffdf8",
  color: "#1f2937"
} as const;

export function TaskCreateForm({ mockUserId }: TaskCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        border: "1px solid #eadfce",
        borderRadius: "1.35rem",
        background:
          "linear-gradient(180deg, rgba(255,251,235,0.95) 0%, rgba(255,255,255,0.98) 100%)",
        padding: "1rem",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem"
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#9a3412"
            }}
          >
            Quick add
          </p>
          <h2 style={{ margin: "0.3rem 0 0", fontSize: "1.05rem" }}>Add task</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.84rem", color: "#57534e" }}>Capture a task fast.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.65rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Write weekly update"
            required
            style={INPUT_STYLE}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.65rem" }}>
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
            type="submit"
            disabled={isSubmitting}
            style={{
              borderRadius: "999px",
              border: "1px solid #111827",
              backgroundColor: "#111827",
              color: "#ffffff",
              padding: "0.68rem 1rem",
              fontSize: "0.88rem",
              fontWeight: 600,
              opacity: isSubmitting ? 0.7 : 1,
              boxShadow: "0 10px 20px rgba(17, 24, 39, 0.18)"
            }}
          >
            {isSubmitting ? "Adding..." : "Add Task"}
          </button>
          {error ? (
            <p style={{ margin: "0.65rem 0 0", fontSize: "0.875rem", color: "#b91c1c" }}>{error}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
