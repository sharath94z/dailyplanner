import { AppNav } from "../../features/navigation/app-nav"

export const dynamic = "force-dynamic"

const PAGE_STYLE = {
  margin: "0 auto",
  maxWidth: "28rem",
  minHeight: "100vh",
  padding: "2rem 1rem 9rem",
  fontFamily:
    '"Manrope", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#0f172a",
  backgroundColor: "#faf6f3"
} as const

const CARD_STYLE = {
  border: "1px solid #e8dfda",
  borderRadius: "1.5rem",
  backgroundColor: "#ffffff",
  boxShadow: "0 15px 24px rgba(17, 24, 39, 0.05)",
  padding: "1.4rem"
} as const

export default function ProfilePage() {
  return (
    <main style={PAGE_STYLE}>
      <section style={{ display: "grid", gap: "1rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#94a3b8"
          }}
        >
          Profile
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#0f172a"
          }}
        >
          Profile coming soon
        </h1>
        <section style={CARD_STYLE}>
          <p style={{ margin: 0, fontSize: "0.98rem", lineHeight: 1.5, color: "#564242" }}>
            This tab is reserved for account and personalization settings. No auth or profile
            behavior changes are introduced in this phase.
          </p>
        </section>
      </section>
      <AppNav />
    </main>
  )
}
