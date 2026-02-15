import Link from "next/link"
import { getNavLinks } from "@/actions/nav"
import { auth } from "@/lib/auth"

export async function Navbar() {
    const { data: pages } = await getNavLinks()
    const session = await auth()

    return (
        <nav className="border-b bg-white dark:bg-zinc-900 sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="font-bold text-xl flex items-center gap-2">
                    <span>🚀</span> Antigravity
                </Link>

                <div className="hidden md:flex items-center gap-6">
                    <Link href="/learn" className="text-sm font-medium hover:text-blue-600">
                        Learn
                    </Link>
                    <Link href="/practice" className="text-sm font-medium hover:text-blue-600">
                        Practice
                    </Link>
                    {pages?.map((page: any) => (
                        <Link
                            key={page.slug}
                            href={`/${page.slug}`}
                            className="text-sm font-medium hover:text-blue-600"
                        >
                            {page.title}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    {session?.user ? (
                        <>
                            {session.user.role === 'ADMIN' && (
                                <Link href="/admin" className="text-sm font-medium text-purple-600">
                                    Admin
                                </Link>
                            )}
                            <Link href="/profile">
                                <img
                                    src={session.user.image || "https://github.com/shadcn.png"}
                                    className="w-8 h-8 rounded-full border"
                                    alt="Profile"
                                />
                            </Link>
                        </>
                    ) : (
                        <Link
                            href="/api/auth/signin"
                            className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
                        >
                            Sign In
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    )
}
