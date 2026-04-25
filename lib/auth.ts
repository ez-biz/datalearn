import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"

/**
 * SECURITY: account-linking policy.
 *
 * - **Google** strictly verifies email ownership before issuing tokens
 *   (`email_verified` is gated upstream). We trust it and let NextAuth
 *   auto-link a new provider to an existing User row when the email matches.
 *
 * - **GitHub does NOT** require a verified primary email for OAuth. The email
 *   claim returned to NextAuth is whatever the user has set as primary —
 *   which may be unverified. Auto-linking on this would let an attacker take
 *   over an existing User (worst case: ADMIN) just by adding the target
 *   email as a secondary unverified email on a throwaway GitHub account.
 *   We therefore do NOT enable allowDangerousEmailAccountLinking on GitHub.
 *
 * For users who already had a User row created without an Account (e.g. via
 * a seed script), sign in with Google — auto-link works there. Then add
 * GitHub from a settings flow later (TODO).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma) as any,
    providers: [
        GitHub,
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
