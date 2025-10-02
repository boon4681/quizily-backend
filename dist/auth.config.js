import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { openAPI } from "better-auth/plugins";
const prisma = new PrismaClient();
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
