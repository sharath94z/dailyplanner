"use client";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type CreateTaskArgs = {
  mockUserId: string;
  title: string;
  durationMinutes?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH";
};

export async function createTask(input: CreateTaskArgs) {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-user-id": input.mockUserId
    },
    body: JSON.stringify({
      title: input.title,
      durationMinutes: input.durationMinutes,
      priority: input.priority
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
