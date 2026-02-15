import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/profile")
    }

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">User Profile</h1>
            <div className="bg-white shadow rounded-lg p-6 border">
                <div className="flex items-center space-x-4">
                    {session.user.image && (
                        <img
                            src={session.user.image}
                            alt={session.user.name || "User"}
                            className="w-16 h-16 rounded-full"
                        />
                    )}
                    <div>
                        <h2 className="text-xl font-semibold">{session.user.name}</h2>
                        <p className="text-gray-600">{session.user.email}</p>
                    </div>
                </div>
                <div className="mt-6">
                    <h3 className="text-lg font-medium">Session Data</h3>
                    <pre className="mt-2 bg-gray-100 p-4 rounded overflow-auto text-sm">
                        {JSON.stringify(session, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    )
}
