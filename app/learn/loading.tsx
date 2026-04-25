export default function LearnLoading() {
    return (
        <div className="container mx-auto p-8">
            <div className="h-10 w-48 bg-gray-200 rounded animate-pulse mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="p-6 bg-white rounded-lg border space-y-3"
                    >
                        <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                        <div className="h-4 w-1/3 bg-gray-100 rounded animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    )
}
