import type { Prisma } from "@prisma/client";

export async function audit(
  tx: Prisma.TransactionClient,
  e: {
    orgId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    meta?: Prisma.InputJsonValue;
  },
) {
  await tx.auditLog.create({ data: e });
}
