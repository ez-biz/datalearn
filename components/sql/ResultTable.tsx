"use client"

import { cn } from "@/lib/utils"

interface ResultTableProps {
    data: any[]
    error?: string | null
    loading?: boolean
}

export function ResultTable({ data, error, loading }: ResultTableProps) {
    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 bg-gray-50 border rounded-lg">
                Running query...
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-full p-4 text-red-500 bg-red-50 border border-red-200 rounded-lg font-mono text-sm overflow-auto">
                Error: {error}
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 bg-gray-50 border rounded-lg">
                No results to display
            </div>
        )
    }

    const columns = Object.keys(data[0])

    return (
        <div className="h-full overflow-auto border rounded-lg bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
                            >
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                            {columns.map((col) => (
                                <td key={`${i}-${col}`} className="px-4 py-2 whitespace-nowrap text-gray-700">
                                    {row[col] === null ? <span className="text-gray-400 italic">null</span> : String(row[col])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
