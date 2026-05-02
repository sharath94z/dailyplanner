"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { planDay } from "../../lib/client-api/planning"

type PlanDayButtonProps = {
  mockUserId: string
  selectedDate: string
}

export function PlanDayButton({ mockUserId, selectedDate }: PlanDayButtonProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  async function handlePlanDay() {
    setError(null)
    setIsSubmitting(true)

    try {
      await planDay({
        mockUserId,
        date: selectedDate
      })

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
    <div style={{ display: "grid", gap: "0.45rem" }}>
      <button
        type="button"
        onClick={handlePlanDay}
        disabled={isSubmitting}
        style={{
          justifySelf: "start",
          borderRadius: "999px",
          border: "1px solid #ff7f8a",
          backgroundColor: "#fffaf8",
          color: "#ff7f8a",
          padding: "0.72rem 1.55rem",
          fontSize: "0.98rem",
          fontWeight: 700,
          opacity: isSubmitting ? 0.7 : 1,
          boxShadow: "0 10px 18px rgba(17, 24, 39, 0.04)",
          lineHeight: 1.2,
          minWidth: "8.4rem"
        }}
      >
        {isSubmitting ? (
          "Planning..."
        ) : (
          <span style={{ display: "inline-grid", lineHeight: 1.2 }}>
            <span>Plan My</span>
            <span>Day</span>
          </span>
        )}
      </button>
      {error ? (
        <p style={{ margin: 0, fontSize: "0.84rem", color: "#b91c1c" }}>{error}</p>
      ) : null}
    </div>
  )
}
