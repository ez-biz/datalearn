import { getProblem } from "@/actions/problems"
import { notFound } from "next/navigation"
import { ProblemWorkspace } from "@/components/sql/ProblemWorkspace"

type Props = {
    params: Promise<{ slug: string }>
}

export default async function ProblemPage({ params }: Props) {
    const { slug } = await params
    const { data: problem } = await getProblem(slug)

    if (!problem) {
        notFound()
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left Panel: Problem Description */}
                <div className="w-full lg:w-1/3 border-r overflow-y-auto bg-white p-6">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold mb-2">{problem.title}</h1>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold
                             ${problem.difficulty === 'EASY' ? 'bg-green-100 text-green-800' :
                                problem.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'}`}>
                            {problem.difficulty}
                        </span>
                    </div>

                    <div className="prose prose-sm max-w-none text-gray-700">
                        <h3 className="text-base font-semibold">Description</h3>
                        <p>{problem.description}</p>

                        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                            <h4 className="text-sm font-semibold mb-2">Schema</h4>
                            <p className="font-mono text-xs">{problem.schemaDescription}</p>
                        </div>
                    </div>
                </div>

                {/* Right Panel: SQL Editor */}
                <div className="w-full lg:w-2/3 bg-gray-50 p-4">
                    <ProblemWorkspace
                        initialSql=""
                        schemaSql={problem.schema.sql}
                        problemSlug={problem.slug}
                    />
                </div>
            </div>
        </div>
    )
}
