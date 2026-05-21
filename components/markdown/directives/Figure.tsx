import Image from "next/image"
import type { ReactNode } from "react"

interface FigureProps {
    src?: string
    alt?: string
    caption?: string
    children?: ReactNode
}

const RASTER_TYPES = /\.(png|jpe?g|webp|gif)(?:\?|$)/i

function isAllowedSrc(src?: string): boolean {
    if (!src) return false
    if (src.startsWith("/learn/")) return true
    try {
        const url = new URL(src)
        return (
            url.protocol === "https:" &&
            url.hostname.endsWith(".vercel-storage.com")
        )
    } catch {
        return false
    }
}

export function Figure({ src, alt, caption, children }: FigureProps) {
    if (!src || !isAllowedSrc(src) || !alt) {
        return (
            <figure className="my-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                figure rejected: missing src or alt
            </figure>
        )
    }

    const safeSrc = src
    const isRaster = RASTER_TYPES.test(safeSrc)
    return (
        <figure className="my-6 overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-center bg-surface-muted p-6">
                {isRaster ? (
                    <Image
                        src={safeSrc}
                        alt={alt}
                        width={1200}
                        height={600}
                        className="h-auto max-w-full"
                        sizes="(min-width: 1024px) 720px, 100vw"
                    />
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={safeSrc} alt={alt} className="h-auto max-w-full" />
                )}
            </div>
            <figcaption className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground">
                {caption ?? children}
            </figcaption>
        </figure>
    )
}
