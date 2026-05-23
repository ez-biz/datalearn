import { notFound, redirect } from "next/navigation"
import { getOrCreateDailyProblem } from "@/actions/daily"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Daily Problem",
}

export default async function DailyPage() {
    const daily = await getOrCreateDailyProblem()
    if (!daily) notFound()
    // UI v2: this route renders no surface; the practice workspace owns chrome.
    redirect(`/practice/${daily.problem.slug}`)
}
