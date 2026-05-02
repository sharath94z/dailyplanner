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
        border: "1px solid #dbeafe",
        borderRadius: "1.35rem",
        background:
          "linear-gradient(180deg, rgba(239,246,255,0.95) 0%, rgba(255,255,255,0.98) 100%)",
        padding: "0.9rem 1rem",
        boxShadow: "0 18px 40px rgba(37, 99, 235, 0.08)"
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "0.85rem"
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
              color: "#1d4ed8"
            }}
          >
            Quick action
          </p>
          <h2 style={{ margin: "0.3rem 0 0", fontSize: "1.05rem" }}>Plan My Day</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.84rem", color: "#475569" }}>
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
            padding: "0.68rem 1rem",
            fontSize: "0.88rem",
            fontWeight: 600,
            opacity: isSubmitting ? 0.7 : 1,
            boxShadow: "0 12px 22px rgba(37, 99, 235, 0.2)",
            justifySelf: "start"
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
