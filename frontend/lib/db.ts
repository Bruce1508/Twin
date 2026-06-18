import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

const g = globalThis as unknown as { __prisma?: PrismaClient };
export const db = g.__prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.__prisma = db;
