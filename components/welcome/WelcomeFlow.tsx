"use client"

import { useEffect, useState } from "react"
import {
    completeOnboarding,
    recordOnboardingStart,
    recordSqlLevel,
} from "@/actions/onboarding"
import {
    resolveEntryPoint,
    type ModuleLike,
    type SqlLevel,
} from "@/lib/onboarding/entry-point"
import { LevelStep } from "@/components/welcome/LevelStep"
import { StartHereStep } from "@/components/welcome/StartHereStep"

export function WelcomeFlow({
    firstName,
    initialLevel,
    trackSlug,
    trackName,
    modules,
}: {
    firstName: string | null
    initialLevel: SqlLevel | null
    trackSlug: string | null
    trackName: string | null
    modules: ModuleLike[]
}) {
    // Resume: a learner who answered and left comes back to screen 2 with
    // their answer intact rather than re-answering.
    const [level, setLevel] = useState<SqlLevel | null>(initialLevel)
    const [step, setStep] = useState<1 | 2>(initialLevel ? 2 : 1)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        // Write-on-view, fired from the client rather than during server
        // render: a GET that renders a page must stay side-effect-free, and a
        // prefetch would otherwise record a start the learner never saw. The
        // action is first-write-wins, so a refresh keeps the original stamp.
        void recordOnboardingStart()
    }, [])

    const entry = level ? resolveEntryPoint(level, modules) : null

    async function handleContinue() {
        if (!level) return
        setBusy(true)
        await recordSqlLevel(level)
        setBusy(false)
        setStep(2)
    }

    async function finish(destination: string) {
        setBusy(true)
        await completeOnboarding(level)
        // Not router.push: the session's onboardingCompleted flag is stale in
        // this client's cache, and "/" redirects on the stale value. A hard
        // navigation re-reads the session server-side.
        window.location.assign(destination)
    }

    async function handleSkip() {
        setBusy(true)
        await completeOnboarding(null)
        window.location.assign("/")
    }

    if (step === 1) {
        return (
            <LevelStep
                firstName={firstName}
                selected={level}
                onSelect={setLevel}
                onContinue={handleContinue}
                onSkip={handleSkip}
                busy={busy}
            />
        )
    }

    return (
        <StartHereStep
            entry={entry}
            trackSlug={trackSlug}
            trackName={trackName}
            moduleCount={modules.length}
            onLaunch={(href) => void finish(href)}
            onBrowse={() => void finish("/practice")}
            onBack={() => setStep(1)}
            busy={busy}
        />
    )
}
