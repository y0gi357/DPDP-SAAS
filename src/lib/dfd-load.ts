import { withTenant } from "./tenant";
import type { FlowRopa } from "./dfd";

export async function loadFlowInput(s: { orgId: string; userId: string }, departmentId?: string) {
  const [ropa, departments] = await withTenant(s, (tx) =>
    Promise.all([
      tx.ropaRecord.findMany({
        where: departmentId ? { departmentId } : undefined,
        include: { department: true, assets: { include: { asset: true } }, vendors: { include: { vendor: true } } },
      }),
      tx.department.findMany({ orderBy: { name: "asc" } }),
    ]),
  );
  const input: FlowRopa[] = ropa.map((r) => ({
    id: r.id, activity: r.activity, departmentId: r.departmentId, departmentName: r.department?.name ?? null,
    principalCategory: r.principalCategory, dataCategories: r.dataCategories, crossBorder: r.crossBorder, crossBorderCountry: r.crossBorderCountry,
    assets: r.assets.map((x) => ({ id: x.asset.id, name: x.asset.name, hostingLocation: x.asset.hostingLocation, hostedInIndia: x.asset.hostedInIndia })),
    vendors: r.vendors.map((x) => ({ id: x.vendor.id, name: x.vendor.name, country: x.vendor.country, hasContract: x.vendor.hasContract })),
  }));
  return { input, departments };
}
