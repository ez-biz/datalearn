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
    const [error, setError] = useState<string | null>(null)

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
        setError(null)
        try {
            const result = await recordSqlLevel(level)
            if (!result.ok) {
                setError("Couldn't save that — try again.")
                return
            }
            setStep(2)
        } catch {
            setError("Couldn't save that — try again.")
        } finally {
            setBusy(false)
        }
    }

    // The one exit from onboarding: stamp completion, then leave. Skipping is
    // the same path with no level recorded, so both share this body — a second
    // copy would be a second place to forget the hard navigation below.
    async function completeAndLeave(
        levelToSave: SqlLevel | null,
        destination: string
    ) {
        setBusy(true)
        setError(null)
        try {
            const result = await completeOnboarding(levelToSave)
            if (!result.ok) {
                setError("Couldn't save that — try again.")
                setBusy(false)
                return
            }
            // Not router.push: the session's onboardingCompleted flag is
            // stale in this client's cache, and "/" redirects on the stale
            // value. A hard navigation re-reads the session server-side.
            // busy is intentionally left true here: we are navigating away.
            window.location.assign(destination)
        } catch {
            setError("Couldn't save that — try again.")
            setBusy(false)
        }
    }

    function finish(destination: string) {
        return completeAndLeave(level, destination)
    }

    function handleSkip() {
        return completeAndLeave(null, "/")
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
                error={error}
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
            onBack={() => {
                setError(null)
                setStep(1)
            }}
            busy={busy}
            error={error}
        />
    )
}
