import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Runs prisma/rls.sql with the OWNER connection (DIRECT_URL).
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

async function main() {
  const sql = readFileSync("prisma/rls.sql", "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  const statements = sql.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const s of statements) await prisma.$executeRawUnsafe(s);
  console.log(`Applied ${statements.length} RLS/grant statements.`);
}
main().finally(() => prisma.$disconnect());
