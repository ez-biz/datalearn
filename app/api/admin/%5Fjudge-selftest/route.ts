import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { submitToJudge } from "@/lib/contest-judge"

export const POST = withAdmin(async () => {
    const result = await submitToJudge({
        dialect: "DUCKDB",
        hiddenSchemaSql: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1);",
        hiddenExpected: [{ x: 1 }],
        ordered: false,
        userSql: "SELECT x FROM t",
        timeoutMs: 5_000,
    })

    return NextResponse.json({ data: result })
})
