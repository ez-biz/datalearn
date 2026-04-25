import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"

// Both GitHub and Google strictly verify email ownership before issuing tokens,
// so we auto-link a new provider to an existing User when the email matches.
// Without this, signing in with one provider after the other yields
// OAuthAccountNotLinked.
export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma) as any,
    providers: [
        GitHub({ allowDangerousEmailAccountLinking: true }),
        Google({ allowDangerousEmailAccountLinking: true }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                session.user.role = (user as any).role
                session.user.id = user.id
            }
            return session
        },
    },
})
