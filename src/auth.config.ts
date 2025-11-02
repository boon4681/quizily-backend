import { prisma } from "$database";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { openAPI } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [
        openAPI(),
    ],
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false
    },
    database: prismaAdapter(prisma, {
        provider: "mongodb",
    }),
    trustedOrigins: ["*"],
    advanced: {
        cookiePrefix: "quizily.app",
        database: {
            generateId: false
        }
    }
});

export type AuthUserData = typeof auth.$Infer.Session.user
export type AuthUserSession = typeof auth.$Infer.Session.session