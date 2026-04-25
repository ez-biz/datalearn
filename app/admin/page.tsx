import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { createPage } from "@/actions/admin"

export default async function AdminPage() {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect("/")
    }

    const pages = await prisma.page.findMany()
    const topics = await prisma.topic.findMany({ include: { _count: { select: { articles: true } } } })
    const sqlProblems = await prisma.sQLProblem.findMany()

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Statistics Cards */}
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-900">Total Topics</h3>
                    <p className="text-3xl font-bold text-blue-700">{topics.length}</p>
                </div>
                <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
                    <h3 className="text-lg font-semibold text-purple-900">SQL Problems</h3>
                    <p className="text-3xl font-bold text-purple-700">{sqlProblems.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg border shadow-sm">
                    <h2 className="text-xl font-semibold mb-4">Create New Page</h2>
                    <form action={createPage} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Title</label>
                            <input name="title" required className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Slug</label>
                            <input name="slug" required className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Content (Markdown)</label>
                            <textarea name="content" required className="w-full border p-2 rounded h-32" />
                        </div>
                        <button type="submit" className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800">
                            Create Page
                        </button>
                    </form>
                </div>

                <div className="space-y-8">
                    <div className="bg-white p-6 rounded-lg border shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Existing Pages</h2>
                        <ul className="space-y-2">
                            {pages.map((page: any) => (
                                <li key={page.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                    <span>{page.title}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${page.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {page.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </li>
                            ))}
                            {pages.length === 0 && <p className="text-gray-500 italic">No pages created yet.</p>}
                        </ul>
                    </div>

                    <div className="bg-white p-6 rounded-lg border shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Content Overview</h2>
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium mb-2">Topics & Articles</h3>
                                <ul className="space-y-1 text-sm text-gray-600">
                                    {topics.map((t: any) => (
                                        <li key={t.id}>• {t.name} ({t._count.articles} articles)</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
