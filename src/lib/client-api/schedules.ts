"use client";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type ScheduleActionArgs = {
  scheduleId: string;
  mockUserId: string;
};

async function postScheduleAction(path: string, mockUserId: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "x-mock-user-id": mockUserId
    }
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

export async function completeSchedule({ scheduleId, mockUserId }: ScheduleActionArgs) {
  return postScheduleAction(`/api/schedules/${scheduleId}/complete`, mockUserId);
}
