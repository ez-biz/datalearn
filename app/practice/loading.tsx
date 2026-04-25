export default function PracticeLoading() {
    return (
        <div className="container mx-auto p-8 max-w-5xl">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-6" />
            <div className="h-5 w-96 bg-gray-100 rounded animate-pulse mb-8" />
            <div className="grid gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div
                        key={i}
                        className="bg-white p-6 rounded-lg border shadow-sm space-y-3"
                    >
                        <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                                <div className="h-6 w-2/3 bg-gray-200 rounded animate-pulse" />
                                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                            </div>
                            <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse ml-4" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
