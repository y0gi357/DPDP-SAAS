# Local preparation checks — 10 November 2026

Environment: Node.js 22.22.0, npm 9.2.0. These observations cover release preparation, not a clean-install or production certification.

| Check | Result |
|---|---|
| npm run typecheck | Passed before documentation/licence changes |
| node --import tsx tests/consent.test.ts | Passed |
| node --import tsx tests/cm-readiness.test.ts | Passed |
| node --import tsx tests/email.test.ts | Passed; JSON transport, no email sent |
| Consent-service regression | Failed: existing mock assigns to read-only withTenant import |
| Standard npm test scripts | Blocked by sandbox EPERM creating tsx IPC socket |
| npm run build | Compilation succeeded; build failed parsing TypeScript --showConfig output |
| git diff --check | Passed |
| Tracked sensitive/generated paths | No .env, dependency/build directories, private-key or dump paths found |
| All reachable history blobs | 120 checked; no matches for selected private-key/GitHub-token/AWS-access-key patterns |
| npm audit --offline | Reported zero findings; offline result is not a current online advisory check |
| GitHub access | Blocked: cannot resolve github.com |

The history scan is heuristic and does not prove absence of secrets or private data. A complete third-party licence/notice review, clean installation, database isolation tests, runtime/browser walkthrough, backup/restore and current online dependency audit remain outstanding. No real customer database was modified or tested during preparation. Do not publish this as a fully validated production release.
