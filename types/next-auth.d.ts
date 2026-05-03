import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
        } & DefaultSession["user"]
    }

    interface User extends DefaultUser {
        role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
    }
}
