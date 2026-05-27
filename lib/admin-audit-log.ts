import type { Prisma, PrismaClient } from "@prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

export async function recordAdminAction(
    db: Db,
    args: {
        actorId: string
        action: string
        targetType: string
        targetId: string
        metadata?: Record<string, unknown>
    }
): Promise<void> {
    await db.adminAuditLog.create({
        data: {
            actorId: args.actorId,
            action: args.action,
            targetType: args.targetType,
            targetId: args.targetId,
            metadata: (args.metadata ?? null) as Prisma.InputJsonValue,
        },
    })
}
