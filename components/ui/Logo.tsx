import { cn } from "@/lib/utils"

interface LogoProps {
    className?: string
    iconOnly?: boolean
}

export function Logo({ className, iconOnly }: LogoProps) {
    return (
        <span className={cn("inline-flex items-center gap-2", className)}>
            <LogoMark className="h-7 w-7" />
            {!iconOnly && (
                <span className="font-semibold tracking-tight text-[15px]">
                    Data<span className="text-primary">Learn</span>
                </span>
            )}
        </span>
    )
}

export function LogoMark({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("text-primary", className)}
            aria-hidden
        >
            <rect
                x="2"
                y="2"
                width="28"
                height="28"
                rx="7"
                className="fill-primary/10 stroke-primary/30"
                strokeWidth="1.25"
            />
            <path
                d="M9 11h5.5c2.485 0 4.5 1.567 4.5 5s-2.015 5-4.5 5H9V11Z"
                className="fill-primary"
            />
            <rect x="20.5" y="11" width="2.5" height="10" rx="1.25" className="fill-primary" />
        </svg>
    )
}
