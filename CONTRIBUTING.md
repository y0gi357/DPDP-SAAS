# Contributing

Use issues for reproducible bugs and scoped feature proposals. For suspected vulnerabilities, follow SECURITY.md instead.

Before opening a pull request, explain the problem, intended behaviour and relevant checks. Keep changes focused. Use fictional data and never commit environment files, tokens, private evidence or customer records.

## Development checks

Use Node.js 22 and follow the README setup. Run `npm run typecheck`, `npm run test:consent`, `npm run test:email` and `npm run build`. For tenant/database changes, also run `npm run test:consent-isolation` on a disposable test database. The general isolation test creates persistent fixtures; never run it on customer data.

New tenant tables require an orgId index, forced RLS, organisation-scoped foreign keys where applicable, withTenant queries and cross-tenant tests. Keep published notices and consent decisions immutable. Include migrations and reapply prisma/rls.sql.

Explain the source and applicability of legal-content changes; they require qualified review. Do not mark generated text as reviewed law.

Contributions are made under Apache-2.0. Submit only work you have the right to contribute, and preserve third-party notices. There is no contributor copyright assignment or CLA in this repository.
