"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

type AppNavProps = {
  selectedDate?: string
}

const ITEMS = [
  { href: "/timeline", label: "Timeline", icon: "calendar", preserveDate: true },
  { href: "/todos", label: "Todo", icon: "list", preserveDate: false },
  { href: "/stats", label: "Stats", icon: "stats", preserveDate: false },
  { href: "/profile", label: "Profile", icon: "profile", preserveDate: false }
] as const

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M5 1.5V4M13 1.5V4M2 6.25H16M4.15 3H13.85C14.8301 3 15.3201 3 15.694 3.19077C16.0226 3.35824 16.2897 3.62535 16.4572 3.9539C16.648 4.32779 16.648 4.81784 16.648 5.79795V12.2021C16.648 13.1822 16.648 13.6722 16.4572 14.0461C16.2897 14.3747 16.0226 14.6418 15.694 14.8092C15.3201 15 14.8301 15 13.85 15H4.15C3.16991 15 2.67986 15 2.30596 14.8092C1.97741 14.6418 1.71029 14.3747 1.54283 14.0461C1.35205 13.6722 1.35205 13.1822 1.35205 12.2021V5.79795C1.35205 4.81784 1.35205 4.32779 1.54283 3.9539C1.71029 3.62535 1.97741 3.35824 2.30596 3.19077C2.67986 3 3.16991 3 4.15 3Z"
        stroke={active ? "#ff7f8a" : "#94a3b8"}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M6.5 4.5H15M6.5 9H15M6.5 13.5H15M3 4.5H3.01M3 9H3.01M3 13.5H3.01"
        stroke={active ? "#ff7f8a" : "#94a3b8"}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M3 14.5V7.5M9 14.5V3.5M15 14.5V10.5M1.75 16.25H16.25"
        stroke={active ? "#ff7f8a" : "#94a3b8"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="2" y="7.5" width="2" height="7" rx="0.5" fill={active ? "#ff7f8a" : "#94a3b8"} />
      <rect x="8" y="3.5" width="2" height="11" rx="0.5" fill={active ? "#ff7f8a" : "#94a3b8"} />
      <rect x="14" y="10.5" width="2" height="4" rx="0.5" fill={active ? "#ff7f8a" : "#94a3b8"} />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M14.25 15C14.25 12.9289 11.8995 11.25 9 11.25C6.1005 11.25 3.75 12.9289 3.75 15M9 9C10.6569 9 12 7.65685 12 6C12 4.34315 10.6569 3 9 3C7.34315 3 6 4.34315 6 6C6 7.65685 7.34315 9 9 9Z"
        stroke={active ? "#ff7f8a" : "#94a3b8"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NavIcon({ icon, active }: { icon: (typeof ITEMS)[number]["icon"]; active: boolean }) {
  if (icon === "calendar") {
    return <CalendarIcon active={active} />
  }

  if (icon === "list") {
    return <ListIcon active={active} />
  }

  if (icon === "stats") {
    return <StatsIcon active={active} />
  }

  return <ProfileIcon active={active} />
}

function buildHref(pathname: string, selectedDate?: string, preserveDate?: boolean) {
  if (!selectedDate || !preserveDate) {
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
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
        transform: "translateX(-50%)",
        width: "min(22rem, calc(100vw - 2.4rem))",
        height: "4rem",
        borderRadius: "999px",
        border: "1px solid rgba(238, 231, 226, 1)",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        boxShadow: "0 22px 30px rgba(17, 24, 39, 0.12)",
        backdropFilter: "blur(18px)",
        zIndex: 30
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 0,
          height: "100%",
          padding: "0 0.45rem"
        }}
      >
        {ITEMS.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={buildHref(item.href, preservedDate, item.preserveDate)}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              style={{
                borderRadius: "999px",
                textAlign: "center",
                textDecoration: "none",
                color: isActive ? "#ff7f8a" : "#94a3b8",
                backgroundColor: "transparent",
                border: "1px solid transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%"
              }}
            >
              <NavIcon icon={item.icon} active={isActive} />
              <span
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                  whiteSpace: "nowrap",
                  border: 0
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
