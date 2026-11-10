import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Loads a controls library as a new ACTIVE version. Uses the OWNER connection:
// the app role has read-only access to legal content by design.
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

type Lib = {
  label: string;
  description?: string;
  sections: { key: string; title: string; order: number }[];
  controls: { code: string; section: string; title: string; actRefs: string[]; ruleRefs: string[]; audience?: string[] }[];
};

async function main() {
  const file = process.env.CONTROLS_FILE ?? "data/controls-v1.1.json";
  const lib: Lib = JSON.parse(readFileSync(file, "utf8"));

  const existing = await prisma.controlLibraryVersion.findUnique({ where: { label: lib.label } });
  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.controlLibraryVersion.updateMany({ where: { id: { not: existing.id } }, data: { isActive: false } });
      await tx.controlLibraryVersion.update({ where: { id: existing.id }, data: { isActive: true } });
    });
    console.log(`Library "${lib.label}" is active (existing controls and assessments preserved).`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.controlLibraryVersion.updateMany({ data: { isActive: false } });
    const version = await tx.controlLibraryVersion.create({
      data: { label: lib.label, description: lib.description, isActive: true },
    });
    const sectionIds = new Map<string, string>();
    for (const s of lib.sections) {
      const row = await tx.controlSection.create({ data: { ...s, libraryVersionId: version.id } });
      sectionIds.set(s.key, row.id);
    }
    for (const c of lib.controls) {
      const sectionId = sectionIds.get(c.section);
      if (!sectionId) throw new Error(`Control ${c.code} references unknown section ${c.section}`);
      await tx.control.create({
        data: {
          libraryVersionId: version.id,
          sectionId,
          code: c.code,
          title: c.title,
          actRefs: c.actRefs,
          ruleRefs: c.ruleRefs,
          audience: c.audience ?? ["FIDUCIARY"],
        },
      });
    }
    console.log(`Loaded ${lib.controls.length} controls as "${lib.label}" (active).`);
  });
}
main().finally(() => prisma.$disconnect());
