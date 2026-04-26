export interface TocEntry {
    level: 2 | 3
    text: string
    slug: string
}

/**
 * Extract h2 and h3 headings from a Markdown body. Slugs are derived
 * with the same rules react-markdown's default behavior produces, so
 * the anchor links resolve. Naive — ignores headings inside fenced
 * code blocks but otherwise greedy.
 */
export function extractToc(markdown: string): TocEntry[] {
    if (!markdown) return []
    const lines = markdown.split("\n")
    const entries: TocEntry[] = []
    let inCode = false
    const seen = new Map<string, number>()

    for (const raw of lines) {
        const line = raw.trimEnd()
        if (line.startsWith("```")) {
            inCode = !inCode
            continue
        }
        if (inCode) continue
        const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
        if (!m) continue
        const level = m[1].length === 2 ? 2 : 3
        const text = m[2].trim()
        if (!text) continue
        const base = text
            .toLowerCase()
            .replace(/[`*_~]/g, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-")
        const count = (seen.get(base) ?? 0) + 1
        seen.set(base, count)
        const slug = count === 1 ? base : `${base}-${count - 1}`
        entries.push({ level: level as 2 | 3, text, slug })
    }

    return entries
}
