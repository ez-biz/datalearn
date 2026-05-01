import { notFound, redirect } from "next/navigation"
import { getOrCreateDailyProblem } from "@/actions/daily"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Daily Problem",
}

export default async function DailyPage() {
    const daily = await getOrCreateDailyProblem()
    if (!daily) notFound()
    redirect(`/practice/${daily.problem.slug}`)
}
