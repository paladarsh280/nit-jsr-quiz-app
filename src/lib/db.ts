import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
    var prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
// @ts-ignore
const adapter = new PrismaPg(pool);

const prisma = globalThis.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export default prisma;