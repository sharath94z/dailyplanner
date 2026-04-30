import { describe, expect, it } from "vitest";

import { normalizeSupabaseDatabaseUrl } from "./supabase-database-url";

describe("normalizeSupabaseDatabaseUrl", () => {
  it("upgrades Supabase pooler URLs to transaction mode with low connection count", () => {
    const url = normalizeSupabaseDatabaseUrl(
      "postgresql://postgres.prlbigurpbryeubkyswv:secret@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
    );

    expect(url).toContain("aws-1-ap-northeast-1.pooler.supabase.com:6543");
    expect(url).toContain("pgbouncer=true");
    expect(url).toContain("connection_limit=1");
    expect(url).toContain("connect_timeout=30");
  });

  it("leaves non-pooler URLs unchanged apart from normalization semantics", () => {
    const url = normalizeSupabaseDatabaseUrl(
      "postgresql://user:secret@db.example.com:5432/postgres"
    );

    expect(url).toBe("postgresql://user:secret@db.example.com:5432/postgres");
  });
});
