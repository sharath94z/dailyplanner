"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

type AppNavProps = {
  selectedDate?: string
}

const ITEMS = [
  { href: "/timeline", label: "Timeline" },
  { href: "/todos", label: "Todo" }
] as const

function buildHref(pathname: string, selectedDate?: string) {
  if (!selectedDate) {
    return pathname
  }

  return `${pathname}?date=${encodeURIComponent(selectedDate)}`
}

export function AppNav({ selectedDate }: AppNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const preservedDate = selectedDate ?? searchParams.get("date") ?? undefined

  return (
    <nav
      aria-label="Primary"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "1rem",
        transform: "translateX(-50%)",
        width: "min(28rem, calc(100vw - 1.5rem))",
        borderRadius: "999px",
        border: "1px solid rgba(226, 232, 240, 0.95)",
        backgroundColor: "rgba(255,255,255,0.96)",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.14)",
        backdropFilter: "blur(18px)",
        zIndex: 30
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.4rem",
          padding: "0.45rem"
        }}
      >
        {ITEMS.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={buildHref(item.href, preservedDate)}
              style={{
                borderRadius: "999px",
                padding: "0.75rem 0.9rem",
                textAlign: "center",
                textDecoration: "none",
                fontSize: "0.92rem",
                fontWeight: 700,
                color: isActive ? "#0f172a" : "#64748b",
                backgroundColor: isActive ? "#f1f5f9" : "transparent",
                border: isActive ? "1px solid #cbd5e1" : "1px solid transparent",
                boxShadow: isActive ? "inset 0 1px 0 rgba(255,255,255,0.8)" : "none"
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
