import dotenv from "dotenv";
import { expand } from "dotenv-expand";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

expand(dotenv.config());

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
