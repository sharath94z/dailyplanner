"use client"

import type { FormEvent } from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { createTask } from "../../lib/client-api/tasks"

type TaskCreateFormProps = {
  mockUserId: string
}

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"] as const

const INPUT_STYLE = {
  border: "1px solid #e7e5e4",
  borderRadius: "1rem",
  padding: "0.82rem 0.95rem",
  fontSize: "0.95rem",
  width: "100%",
  backgroundColor: "#ffffff",
  color: "#111827"
} as const

export function TaskCreateForm({ mockUserId }: TaskCreateFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("")
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>("MEDIUM")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await createTask({
        mockUserId,
        title,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        priority
      })

      setTitle("")
      setDurationMinutes("")
      setPriority("MEDIUM")

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
    <section
      style={{
        borderRadius: "1.4rem",
        backgroundColor: "#fffdfb",
        border: "1px solid #ece7e1",
        padding: "1rem",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)"
      }}
    >
      <div style={{ marginBottom: "0.85rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", color: "#111827" }}>Add task</h2>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.84rem", color: "#78716c" }}>
          Capture tasks here, then schedule them on your timeline.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.7rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Write weekly update"
            required
            style={INPUT_STYLE}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.7rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>Duration</span>
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
            <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#57534e" }}>Priority</span>
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

        <div style={{ display: "grid", gap: "0.55rem" }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              borderRadius: "999px",
              border: "1px solid #fb7185",
              backgroundColor: "#fb7185",
              color: "#ffffff",
              padding: "0.82rem 1rem",
              fontSize: "0.9rem",
              fontWeight: 700,
              opacity: isSubmitting ? 0.7 : 1,
              boxShadow: "0 10px 22px rgba(251, 113, 133, 0.2)"
            }}
          >
            {isSubmitting ? "Adding..." : "Add Task"}
          </button>
          {error ? (
            <p style={{ margin: 0, fontSize: "0.84rem", color: "#b91c1c" }}>{error}</p>
          ) : null}
        </div>
      </form>
    </section>
  )
}
