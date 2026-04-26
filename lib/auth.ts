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
        /**
         * SECURITY: account-linking guard.
         *
         * `allowDangerousEmailAccountLinking: true` on Google means that if
         * a `User` row exists with email X, anyone who later signs in via
         * Google with that same X gets auto-linked into the existing row —
         * inheriting whatever role that row has.
         *
         * That's safe when the existing row has Account(s) attached (the
         * row was created by a real sign-in), but **dangerous when the row
         * was pre-seeded** (e.g. `prisma.user.create({ email, role: "ADMIN" })`).
         * If the pre-seeded email later becomes available to an attacker
         * (lapsed domain, deprovisioned account, typo'd alias), they can
         * auto-link in and take over the elevated role.
         *
         * Rule: refuse to auto-link onto an existing User with elevated role
         * AND zero Accounts. The legitimate fix is to seed users at role=USER
         * and promote them via the role-grant API or psql AFTER first sign-in.
         */
        async signIn({ user }) {
            if (!user?.email) return true
            const existing = await prisma.user.findUnique({
                where: { email: user.email },
                select: {
                    role: true,
                    accounts: { select: { id: true }, take: 1 },
                },
            })
            if (!existing) return true // brand-new user, will be created
            if (existing.accounts.length > 0) return true // already linked
            if (existing.role !== "USER") {
                console.warn(
                    `[security] Refused auto-link onto elevated-role user ${user.email} (role=${existing.role}, no Accounts).`
                )
                return false
            }
            return true
        },
        async session({ session, user }) {
            if (session.user) {
                session.user.role = (user as any).role
                session.user.id = user.id
            }
            return session
        },
    },
})
