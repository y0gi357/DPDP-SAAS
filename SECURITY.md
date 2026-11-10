# Security policy

## Release status

This community edition is for evaluation. There is no supported production release or guaranteed response SLA yet. Use the latest commit for evaluation and review changes before upgrades.

## Report privately

Do not post exploitable details, tokens, customer records or database dumps in public issues. Use GitHub's “Report a vulnerability” facility in the repository Security tab if available. If private reporting is unavailable, open an issue titled “Private security contact requested” containing no vulnerability details, and wait for a maintainer to provide a private route.

Include the affected commit, a minimal fictional reproduction, impact and suggested mitigation through the private route. Maintainers must enable private vulnerability reporting before public launch.

## Deployment boundaries

Use a restricted app database role and a separate migration owner. Keep secrets outside Git; replace all sample database passwords. Require HTTPS, configure SMTP, protect bearer-link URLs from access logs, restrict sign-up and review proxy/IP handling. Back up and test restoration. Do not expose the development server or sample database to the internet.

MFA, SSO, guardian verification, external consent APIs, automatic processor dispatch and production erasure/retention execution are not implemented. An append-only app log is not a claim of protection against a database owner. See README for details.
