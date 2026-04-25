import Link from "next/link"

export default function NotFound() {
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
            <div className="mb-6 text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                404
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Page Not Found
            </h1>
            <p className="text-gray-500 mb-8 max-w-md">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link
                href="/"
                className="px-6 py-3 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
            >
                ← Back to Home
            </Link>
        </div>
    )
}
