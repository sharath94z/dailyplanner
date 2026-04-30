"use client";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type PlanDayArgs = {
  mockUserId: string;
  date: string;
};

export async function planDay(input: PlanDayArgs) {
  const response = await fetch("/api/suggestions/plan-day", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-user-id": input.mockUserId
    },
    body: JSON.stringify({
      date: input.date
    })
  });

  const payload = (await response.json().catch(() => null)) as ApiErrorResponse | unknown;

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as ApiErrorResponse).error?.message === "string"
        ? (payload as ApiErrorResponse).error?.message
        : "Request failed";

    throw new Error(errorMessage);
  }

  return payload;
}
