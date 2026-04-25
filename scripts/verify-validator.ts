import { compareResults } from '../lib/sql-validator'

type Case = {
    name: string
    user: unknown
    expected: unknown
    ordered: boolean
    expectOk: boolean
}

const cases: Case[] = [
    {
        name: 'identical rows, unordered',
        user: [{ a: 1 }, { a: 2 }],
        expected: [{ a: 2 }, { a: 1 }],
        ordered: false,
        expectOk: true,
    },
    {
        name: 'ordered mismatch fails when ordered=true',
        user: [{ a: 2 }, { a: 1 }],
        expected: [{ a: 1 }, { a: 2 }],
        ordered: true,
        expectOk: false,
    },
    {
        name: 'column set mismatch fails',
        user: [{ a: 1, b: 2 }],
        expected: [{ a: 1 }],
        ordered: false,
        expectOk: false,
    },
    {
        name: 'numeric string matches number',
        user: [{ x: '42' }],
        expected: [{ x: 42 }],
        ordered: false,
        expectOk: true,
    },
    {
        name: 'trimmed string matches',
        user: [{ s: '  hello ' }],
        expected: [{ s: 'hello' }],
        ordered: false,
        expectOk: true,
    },
    {
        name: 'float within epsilon',
        user: [{ avg: 0.1 + 0.2 }],
        expected: [{ avg: 0.3 }],
        ordered: false,
        expectOk: true,
    },
    {
        name: 'duplicate rows counted (fails when counts differ)',
        user: [{ a: 1 }, { a: 1 }],
        expected: [{ a: 1 }],
        ordered: false,
        expectOk: false,
    },
    {
        name: 'duplicate rows counted (passes when counts match)',
        user: [{ a: 1 }, { a: 1 }],
        expected: [{ a: 1 }, { a: 1 }],
        ordered: false,
        expectOk: true,
    },
    {
        name: 'both empty passes',
        user: [],
        expected: [],
        ordered: false,
        expectOk: true,
    },
    {
        name: 'user not an array fails',
        user: { foo: 'bar' },
        expected: [],
        ordered: false,
        expectOk: false,
    },
    {
        name: 'null matches null',
        user: [{ x: null }],
        expected: [{ x: null }],
        ordered: false,
        expectOk: true,
    },
    {
        name: 'null does not match 0',
        user: [{ x: null }],
        expected: [{ x: 0 }],
        ordered: false,
        expectOk: false,
    },
    {
        name: 'BigInt matches number',
        user: [{ c: BigInt(5) }],
        expected: [{ c: 5 }],
        ordered: false,
        expectOk: true,
    },
    {
        name: 'row count mismatch fails',
        user: [{ a: 1 }],
        expected: [{ a: 1 }, { a: 2 }],
        ordered: false,
        expectOk: false,
    },
]

let failed = 0
for (const c of cases) {
    const result = compareResults(c.user, c.expected, { ordered: c.ordered })
    const pass = result.ok === c.expectOk
    const mark = pass ? 'OK ' : 'FAIL'
    const detail = pass ? '' : `  got=${JSON.stringify(result)}`
    console.log(`[${mark}] ${c.name}${detail}`)
    if (!pass) failed++
}

if (failed > 0) {
    console.error(`\n${failed} case(s) failed.`)
    process.exit(1)
}
console.log(`\nAll ${cases.length} cases passed.`)
