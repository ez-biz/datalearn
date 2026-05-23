"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface ScrollableTableProps {
    children: React.ReactNode
    className?: string
}

export function ScrollableTable({ children, className }: ScrollableTableProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [atEnd, setAtEnd] = useState(true)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const check = () => {
            const overflows = el.scrollWidth > el.clientWidth + 1
            const reachedEnd =
                Math.abs(el.scrollLeft + el.clientWidth - el.scrollWidth) < 4
            setAtEnd(!overflows || reachedEnd)
        }
        check()
        el.addEventListener("scroll", check, { passive: true })
        const observer = new ResizeObserver(check)
        observer.observe(el)
        return () => {
            el.removeEventListener("scroll", check)
            observer.disconnect()
        }
    }, [])

    return (
        <div
            ref={ref}
            className={cn(
                "scroll-fade overflow-x-auto scrollbar-thin",
                atEnd && "at-end",
                className
            )}
        >
            {children}
        </div>
    )
}
