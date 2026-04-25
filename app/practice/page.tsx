

import Link from "next/link"
import { getProblems } from "@/actions/problems"

export default async function PracticePage() {
    const { data: problems } = await getProblems()

    return (
        <div className="container mx-auto p-8 max-w-5xl">
            <h1 className="text-3xl font-bold mb-6">SQL Practice Problems</h1>
            <p className="mb-8 text-gray-600">
                Master your SQL skills by solving real-world data engineering problems.
            </p>

            <div className="grid gap-4">
                {problems?.map((problem: any) => (
                    <Link key={problem.id} href={`/practice/${problem.slug}`} className="block">
                        <div className="bg-white p-6 rounded-lg border shadow-sm hover:border-blue-500 hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-semibold mb-2">{problem.title}</h2>
                                    <p className="text-gray-500 text-sm line-clamp-2">{problem.description}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium 
                                    ${problem.difficulty === 'EASY' ? 'bg-green-100 text-green-800' :
                                        problem.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'}`}>
                                    {problem.difficulty}
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
