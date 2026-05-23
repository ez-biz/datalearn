import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type Width = "sm" | "md" | "lg" | "xl" | "2xl" | "full"

const widths: Record<Width, string> = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    "2xl": "max-w-screen-2xl",
    full: "max-w-none",
}

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
    width?: Width
}

export function Container({ className, width = "lg", ...props }: ContainerProps) {
    return (
        <div
            className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[width], className)}
            {...props}
        />
    )
}
