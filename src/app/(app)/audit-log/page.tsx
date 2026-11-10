import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";

export default async function AuditLogPage() {
  const s = await requireSession("view_audit_log");
  const logs = await withTenant(s, (tx) =>
    tx.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  );
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">Append-only record of changes in your organisation (latest 200).</p>
      <div className="card">
        <table>
          <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>User</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td>{l.action}</td>
                <td>{l.entity}</td>
                <td className="code">{l.userId ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
