import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
            /**
             * Derived from `User.onboardingCompletedAt` in the session
             * callback. A boolean, not the timestamp: the session is
             * JSON-serialized to client components, so a `Date` field would
             * arrive as a string and the type would be a lie. The timestamp
             * stays in the database, where the analytics read uses it.
             */
            onboardingCompleted: boolean
        } & DefaultSession["user"]
    }

    interface User extends DefaultUser {
        role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
        onboardingCompletedAt: Date | null
    }
}
