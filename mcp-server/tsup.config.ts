import { execSync } from "node:child_process"
import { defineConfig } from "tsup"

// Capture build metadata at bundle time so the running MCP server can
// log it on startup. Helps catch the "stale bundle" footgun where
// Claude Desktop / Claude Code loaded an old dist before new tools
// were added to the source. Two such failures in one day (companies
// kind=COMPANY missing, then track item-management missing) both
// traced to this — once the build line shows up on stderr the staleness
// is obvious without having to grep the dist.
function readGitSha(): string {
    try {
        return execSync("git rev-parse --short=12 HEAD", {
            cwd: import.meta.dirname,
            encoding: "utf8",
        }).trim()
    } catch {
        return "unknown"
    }
}

function readGitDirty(): string {
    try {
        const out = execSync("git status --porcelain", {
            cwd: import.meta.dirname,
            encoding: "utf8",
        })
        return out.trim().length > 0 ? "-dirty" : ""
    } catch {
        return ""
    }
}

const BUILD_TIME = new Date().toISOString()
const GIT_SHA = `${readGitSha()}${readGitDirty()}`

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node20",
    platform: "node",
    bundle: true,
    clean: true,
    sourcemap: true,
    dts: false,
    noExternal: [/.*/],
    banner: { js: "#!/usr/bin/env node" },
    define: {
        __DATALEARN_MCP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
        __DATALEARN_MCP_GIT_SHA__: JSON.stringify(GIT_SHA),
    },
})
