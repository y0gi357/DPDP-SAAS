import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type TenantCtx = { orgId?: string; userId?: string; inviteHash?: string };

/**
 * Run all tenant-data access inside this wrapper. It sets the Postgres session
 * variables that the RLS policies (prisma/rls.sql) read. Settings are
 * transaction-local (`true`), so they cannot leak between pooled connections.
 * Without a context, tenant tables return no rows.
 */
export async function withTenant<T>(
  ctx: TenantCtx,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.current_org', ${ctx.orgId ?? ""}, true), set_config('app.current_user', ${ctx.userId ?? ""}, true), set_config('app.invite_token', ${ctx.inviteHash ?? ""}, true)`;
    return fn(tx);
  });
}
