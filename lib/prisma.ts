import { PrismaClient } from "@prisma/client"
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL!

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const globalForPrisma = global as unknown as { prisma_new: PrismaClient }

export const prisma =
    globalForPrisma.prisma_new ||
    new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma_new = prisma
