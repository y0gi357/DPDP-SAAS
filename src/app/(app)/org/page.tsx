import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { flag, firstError, opt, optInt, req } from "@/lib/form";
import { Check, ErrorNote, Field, PageHead } from "@/components/ui";

const schema = z.object({
  name: req(120),
  legalName: opt(200),
  registrationNo: opt(60),
  industry: opt(80),
  address: opt(400),
  website: opt(200),
  employeeCount: optInt(10_000_000),
  dpoName: opt(120),
  dpoEmail: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
  dpoPhone: opt(40),
  grievanceEmail: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
});

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_org");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/org?error=${encodeURIComponent(firstError(parsed.error))}`);
  const actsAsFiduciary = flag(fd, "actsAsFiduciary");
  const actsAsProcessor = flag(fd, "actsAsProcessor");
  if (!actsAsFiduciary && !actsAsProcessor) {
    redirect(`/org?error=${encodeURIComponent("Select at least one role: Data Fiduciary and/or Data Processor.")}`);
  }
  const data = {
    ...parsed.data,
    actsAsFiduciary,
    actsAsProcessor,
    // SDF is a status of a Data Fiduciary; it cannot apply to a pure processor.
    isSDF: actsAsFiduciary && flag(fd, "isSDF"),
    handlesChildrenData: flag(fd, "handlesChildrenData"),
    transfersAbroad: flag(fd, "transfersAbroad"),
  };
  await withTenant(s, async (tx) => {
    await tx.organisation.update({ where: { id: s.orgId }, data });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "org.updated", entity: "Organisation", entityId: s.orgId });
  });
  revalidatePath("/org");
  redirect("/org?saved=1");
}

export default async function OrgPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const s = await requireSession("view");
  const { error, saved } = await searchParams;
  const editable = can(s.role, "edit_org");
  const o = await withTenant(s, (tx) => tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } }));
  const dis = !editable;

  return (
    <>
      <PageHead title="Organisation Setup" sub="Profile of your organisation as a Data Fiduciary." />
      {!o.dpoEmail && (
        <div className="notice">
          No DPO / contact person recorded yet. Data Fiduciaries must publish the business contact
          details of a person who can answer Data Principals' questions (Sec 8(9)).
        </div>
      )}
      <ErrorNote msg={error} />
      {saved && <div style={{ color: "var(--ok)", marginBottom: 10 }}>Saved.</div>}
      <form action={save} className="card">
        <fieldset disabled={dis} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="fields">
            <Field label="Display name"><input name="name" defaultValue={o.name} required /></Field>
            <Field label="Legal name"><input name="legalName" defaultValue={o.legalName ?? ""} /></Field>
            <Field label="Registration no. (CIN / other)"><input name="registrationNo" defaultValue={o.registrationNo ?? ""} /></Field>
            <Field label="Industry"><input name="industry" defaultValue={o.industry ?? ""} /></Field>
            <Field label="Website"><input name="website" defaultValue={o.website ?? ""} /></Field>
            <Field label="Employees"><input name="employeeCount" inputMode="numeric" defaultValue={o.employeeCount ?? ""} /></Field>
            <Field label="Registered address" wide><textarea name="address" defaultValue={o.address ?? ""} /></Field>
            <Field label="DPO / contact person"><input name="dpoName" defaultValue={o.dpoName ?? ""} /></Field>
            <Field label="Contact email"><input name="dpoEmail" type="email" defaultValue={o.dpoEmail ?? ""} /></Field>
            <Field label="Contact phone"><input name="dpoPhone" defaultValue={o.dpoPhone ?? ""} /></Field>
            <Field label="Grievance email"><input name="grievanceEmail" type="email" defaultValue={o.grievanceEmail ?? ""} /></Field>
          </div>
          <h2 style={{ marginTop: 16 }}>Role under the DPDPA</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Tick both if you decide the purposes of some processing (e.g. your own employee data) and
            process other data on behalf of customers.
          </p>
          <div className="checks" style={{ margin: "8px 0 14px", display: "grid" }}>
            <Check name="actsAsFiduciary" checked={o.actsAsFiduciary} text="Data Fiduciary: we determine the purpose and means of processing" />
            <Check name="actsAsProcessor" checked={o.actsAsProcessor} text="Data Processor: we process personal data on behalf of another Data Fiduciary" />
            <Check name="isSDF" checked={o.isSDF} text="Notified as a Significant Data Fiduciary by the Central Government (Sec 10; fiduciaries only)" />
            <Check name="handlesChildrenData" checked={o.handlesChildrenData} text="We process personal data of children" />
            <Check name="transfersAbroad" checked={o.transfersAbroad} text="We transfer personal data outside India" />
          </div>
          {editable && <button type="submit">Save</button>}
        </fieldset>
      </form>
    </>
  );
}
