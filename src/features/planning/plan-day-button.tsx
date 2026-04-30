"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { planDay } from "../../lib/client-api/planning";

type PlanDayButtonProps = {
  mockUserId: string;
  selectedDate: string;
};

export function PlanDayButton({ mockUserId, selectedDate }: PlanDayButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function handlePlanDay() {
    setError(null);
    setIsSubmitting(true);

    try {
      await planDay({
        mockUserId,
        date: selectedDate
      });

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Plan my day</h2>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "#4b5563" }}>
            Generate suggestions for {selectedDate}.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePlanDay}
          disabled={isSubmitting}
          style={{
            borderRadius: "999px",
            border: "1px solid #2563eb",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            padding: "0.6rem 1rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            opacity: isSubmitting ? 0.7 : 1,
            flexShrink: 0
          }}
        >
          {isSubmitting ? "Planning..." : "Plan My Day"}
        </button>
      </div>
      {error ? (
        <p style={{ margin: "0.65rem 0 0", fontSize: "0.875rem", color: "#b91c1c" }}>{error}</p>
      ) : null}
    </section>
  );
}
