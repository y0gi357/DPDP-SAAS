# Control library and dependency maintenance

`npm run db:seed` now selects `data/controls-v1.1.json` by default (override with `CONTROLS_FILE`). A successful seed run activates `v1.1-draft`. The first activation creates fresh controls/assessments for that version; earlier versions and their assessments remain stored. Re-running the seed for an already loaded label reactivates that existing version without duplicating controls. Upgrades that need assessment continuity must carry assessments forward by control code.



## Dependency compatibility


The app uses the Auth.js v5 API. `next-auth@1.x` cannot provide `next-auth/providers/credentials`, `auth`, `handlers` or the server-side sign-in API. `next-auth` is pinned to `5.0.0-beta.32` to retain the existing implementation, and Zod is pinned to `4.6.7`.

SMTP emails use the official Nodemailer `10.4.0` package under the npm alias `smtp-mailer`. This isolates the app's SMTP dependency from Auth.js v5's optional Nodemailer peer range (v7/v8). Auth.js is configured only with Credentials and does not use its optional email provider. Do not add its Nodemailer provider without checking compatibility with the supported patched mailer. Nodemailer 10 supplies its own types, so the older `@types/nodemailer` dependency is removed. File and URL attachment access are disabled in the SMTP transport defaults.

When deliberately changing dependencies, stop the development server and run `npm install` to reconcile `package-lock.json`. The committed lockfile has been regenerated; use `npm ci` for a fresh checkout. Then run `npm run typecheck`, `npm run test:consent`, `npm run test:email`, `npm run build` and `npm audit`, and restart the development server. The email regression check uses a JSON transport and sends no real email; invitation, reset and consent-link delivery should also be exercised with your configured SMTP service. Commit the regenerated lockfile along with `package.json` and the source changes.
