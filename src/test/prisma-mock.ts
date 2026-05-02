import { vi } from "vitest";

function mockFn() {
  return vi.fn();
}

export const prismaMock = {
  $transaction: mockFn(),
  user: {
    findUnique: mockFn()
  },
  userPreferences: {
    findUnique: mockFn()
  },
  routine: {
    findMany: mockFn(),
    create: mockFn()
  },
  task: {
    aggregate: mockFn(),
    count: mockFn(),
    create: mockFn(),
    findMany: mockFn(),
    findFirst: mockFn(),
    update: mockFn(),
    updateMany: mockFn()
  },
  taskSchedule: {
    findFirst: mockFn(),
    findMany: mockFn(),
    create: mockFn(),
    update: mockFn(),
    updateMany: mockFn()
  },
  taskSuggestion: {
    findFirst: mockFn(),
    findMany: mockFn(),
    create: mockFn(),
    update: mockFn(),
    updateMany: mockFn()
  },
  calendarEvent: {
    findFirst: mockFn(),
    findMany: mockFn()
  },
  schedulingRun: {
    create: mockFn()
  }
};

function resetObjectMocks(value: unknown) {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const nested of Object.values(value)) {
    if (typeof nested === "function" && "mockReset" in nested) {
      (nested as ReturnType<typeof vi.fn>).mockReset();
      continue;
    }

    resetObjectMocks(nested);
  }
}

export function resetPrismaMock() {
  resetObjectMocks(prismaMock);
  prismaMock.$transaction.mockImplementation(async (input: unknown) => {
    if (typeof input === "function") {
      return input(prismaMock);
    }

    return input;
  });
}
