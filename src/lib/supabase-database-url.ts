const SUPABASE_POOLER_HOST_SUFFIX = ".pooler.supabase.com";

export function normalizeSupabaseDatabaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);

  if (url.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX)) {
    if (url.port === "5432") {
      url.port = "6543";
    }

    url.searchParams.set("pgbouncer", "true");
    url.searchParams.set("connection_limit", "1");
    url.searchParams.set("connect_timeout", "30");
  }

  return url.toString();
}
