"use client";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type SuggestionActionArgs = {
  suggestionId: string;
  mockUserId: string;
};

async function postSuggestionAction(path: string, mockUserId: string) {
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

export async function acceptSuggestion({ suggestionId, mockUserId }: SuggestionActionArgs) {
  return postSuggestionAction(`/api/suggestions/${suggestionId}/accept`, mockUserId);
}

export async function retrySuggestion({ suggestionId, mockUserId }: SuggestionActionArgs) {
  return postSuggestionAction(`/api/suggestions/${suggestionId}/retry`, mockUserId);
}

export async function dismissSuggestion({ suggestionId, mockUserId }: SuggestionActionArgs) {
  return postSuggestionAction(`/api/suggestions/${suggestionId}/dismiss`, mockUserId);
}
