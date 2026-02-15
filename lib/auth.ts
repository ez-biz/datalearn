import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma) as any,
    providers: [GitHub, Google],
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                session.user.role = (user as any).role
                session.user.id = user.id
            }
            return session
        }
    }
})
