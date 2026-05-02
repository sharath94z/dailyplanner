import { redirect } from "next/navigation"

type HomePageProps = {
  searchParams?: Promise<{
    date?: string | string[]
  }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const selectedDate =
    typeof resolvedSearchParams?.date === "string" ? resolvedSearchParams.date : undefined

  redirect(
    selectedDate
      ? `/timeline?date=${encodeURIComponent(selectedDate)}`
      : "/timeline"
  )
}
