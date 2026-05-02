"use client";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type CreateTaskScheduleArgs = {
  mockUserId: string;
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
};

export async function createTaskSchedule(input: CreateTaskScheduleArgs) {
  const response = await fetch("/api/task-schedules", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-user-id": input.mockUserId
    },
    body: JSON.stringify({
      title: input.title,
      date: input.date,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes
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
