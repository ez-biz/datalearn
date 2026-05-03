import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { ApiKeysClient } from "@/components/admin/ApiKeysClient"

export const metadata = {
    title: "API keys",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function ApiKeysPage() {
    await requireAdminPage()

    const keys = await prisma.apiKey.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            prefix: true,
            lastUsedAt: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
        },
    })

    return (
        <Container width="lg" className="py-10">
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    API keys
                </h1>
                <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                    Used by external automation hitting{" "}
                    <code className="font-mono text-xs">/api/admin/*</code>. Send the
                    plaintext as{" "}
                    <code className="font-mono text-xs">
                        Authorization: Bearer &lt;key&gt;
                    </code>
                    . Plaintext is shown only once at creation.
                </p>
            </header>

            <Card>
                <CardContent className="p-5">
                    <ApiKeysClient initialKeys={keys} />
                </CardContent>
            </Card>
        </Container>
    )
}
