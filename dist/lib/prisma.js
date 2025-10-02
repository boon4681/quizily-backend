import { PrismaClient } from '@prisma/client';
// Reuse Prisma client across hot-reloads in dev
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
export default prisma;
