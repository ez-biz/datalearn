import type { Prisma, PrismaClient } from "@prisma/client"

type PrismaExecutor = PrismaClient | Prisma.TransactionClient

export const QUOTA_BYTES = 100 * 1024 * 1024

/**
 * Idempotently creates the per-user quota row. Kept as raw SQL so callers can
 * use the same primitive inside upload transactions without a read-before-write.
 */
export async function ensureQuotaRow(
    prisma: PrismaExecutor,
    userId: string
): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO "UserAssetQuota" ("userId", "reservedBytes", "updatedAt")
        VALUES (${userId}, 0::bigint, now())
        ON CONFLICT ("userId") DO NOTHING
    `
}

/**
 * Returns true if the reservation landed. The quota cap is in the UPDATE
 * predicate so Postgres row-locking serializes concurrent reservations.
 */
export async function reserveBytes(
    prisma: PrismaExecutor,
    userId: string,
    bytes: number
): Promise<boolean> {
    await ensureQuotaRow(prisma, userId)
    const affected = await prisma.$executeRaw`
        UPDATE "UserAssetQuota"
        SET "reservedBytes" = "reservedBytes" + ${bytes}::bigint,
            "updatedAt" = now()
        WHERE "userId" = ${userId}
          AND "reservedBytes" + ${bytes}::bigint <= ${QUOTA_BYTES}::bigint
    `
    return affected === 1
}

export async function releaseBytes(
    prisma: PrismaExecutor,
    userId: string,
    bytes: number
): Promise<void> {
    await prisma.$executeRaw`
        UPDATE "UserAssetQuota"
        SET "reservedBytes" = GREATEST(0::bigint, "reservedBytes" - ${bytes}::bigint),
            "updatedAt" = now()
        WHERE "userId" = ${userId}
    `
}
