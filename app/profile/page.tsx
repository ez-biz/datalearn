import type { Metadata } from "next"
import Image from "next/image"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"

export const metadata: Metadata = {
    title: "Profile",
}

export default async function ProfilePage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/profile")
    }

    const initials = (session.user.name ?? session.user.email ?? "?")
        .charAt(0)
        .toUpperCase()

    return (
        <Container width="md" className="py-10 sm:py-14">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
                Profile
            </h1>
            <Card>
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-5">
                        {session.user.image ? (
                            <Image
                                src={session.user.image}
                                alt={session.user.name ?? "User"}
                                width={72}
                                height={72}
                                className="h-18 w-18 rounded-full object-cover ring-2 ring-border"
                            />
                        ) : (
                            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/15 text-2xl font-semibold text-primary">
                                {initials}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-semibold truncate">
                                    {session.user.name ?? "Unnamed user"}
                                </h2>
                                {session.user.role === "ADMIN" && (
                                    <Badge variant="accent">Admin</Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                {session.user.email}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Container>
    )
}
