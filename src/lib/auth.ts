import "server-only";

import type { NextRequest } from "next/server";
import { createHash } from "crypto";

import { prisma } from "./db";

const DEFAULT_USER_ID = process.env.MOCK_USER_ID?.trim() || "mock-user";

function buildMockEmail(userId: string): string {
  const digest = createHash("sha256").update(userId).digest("hex");
  return `mock-${digest}@planner.local`;
}

async function ensureMockUser(userId: string): Promise<string> {
  const normalizedUserId = userId.trim() || DEFAULT_USER_ID;

  await prisma.user.upsert({
    where: {
      id: normalizedUserId
    },
    create: {
      id: normalizedUserId,
      email: buildMockEmail(normalizedUserId)
    },
    update: {}
  });

  return normalizedUserId;
}

export async function resolveMockUserId(userId?: string | null): Promise<string> {
  return ensureMockUser(userId ?? DEFAULT_USER_ID);
}

export async function getCurrentUserId(request: NextRequest): Promise<string> {
  return ensureMockUser(request.headers.get("x-mock-user-id") ?? DEFAULT_USER_ID);
}
