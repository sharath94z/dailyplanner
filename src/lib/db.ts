import "server-only";

import { PrismaClient } from "@prisma/client";
import { normalizeSupabaseDatabaseUrl } from "./supabase-database-url";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
      ? normalizeSupabaseDatabaseUrl(process.env.DATABASE_URL)
      : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
