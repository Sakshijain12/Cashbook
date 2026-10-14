# CashBook — Explainable Expense Tracking

A mobile-first expense tracker combining multi-book ledgers, AI receipt reading, explainable spending insights, and optional evidence-constrained AI prioritization.

**Status: portfolio prototype, not production-ready.** Use synthetic receipts for demos until private attachment delivery and the mobile dependency upgrade are complete. See [the review and change log](docs/REVIEW.md).

## Stack

| Layer | Implementation |
|---|---|
| Mobile | TypeScript, React Native 0.74, Expo SDK 51, Expo Router |
| State | Zustand stores and TanStack Query; consolidation still planned |
| API | Node.js 22+, Fastify 5, Zod validation |
| Database | PostgreSQL, Prisma 5, decimal ledger amounts, indexed date-range queries |
| Authentication | Purpose-checked JWT access/refresh tokens; native Expo SecureStore |
| Receipt AI | Google Cloud Vision document OCR, Sharp image normalization, conservative field parsing |
| Analytics | SQL aggregates, median/MAD outliers, recurring-payment heuristics, spending run-rate projection |
| Optional AI | OpenAI structured-output ranking over numeric evidence; explicit per-request consent |
| Storage and reports | Cloudflare R2 via AWS SDK v3; pdfmake and write-excel-file |
| Quality | Node test runner, Fastify injection tests, TypeScript checks, GitHub Actions |

## What is implemented

- Multiple books, categorized income/expenses, search and date filters.
- Atomic paired transfers, with source/destination ownership and currency checks. This is **not a complete double-entry accounting system**.
- Receipt image upload, OCR-assisted drafts, ambiguous-field warnings, manual review and provider-failure fallback.
- Category charts, six-month trends ending at the selected month, and top expenses.
- Explainable spending changes, unusual category expenses, possible monthly payments, and run-rate forecasts with sample-size gates.
- Optional AI ranking that cannot create new transaction facts or free-form financial advice.
- PDF/XLSX export with bounded result sizes and same-currency checks.

**Not implemented:** offline write queue/sync, exchange-rate conversion, trained categorization/forecasting models, refresh-token rotation/revocation, private attachment access, or full native end-to-end test coverage. Installed SQLite is not evidence of offline support.

## Setup

Use the directory containing this README as the project root. This downloaded archive may contain an extra parent directory.

1. Install Node.js 22+ and provide a development PostgreSQL database.
2. Run `npm run setup` from the root. API and mobile deliberately retain separate dependency installations/lockfiles to avoid introducing Expo monorepo resolution changes.
3. Copy the [API environment template](apps/api/.env.example) to a local environment file in that directory. Set `DATABASE_URL`, a randomly generated `JWT_SECRET` of at least 32 characters, and the exact browser origins if testing on web. Do not use the example secret.
4. Run `npm run db:generate --prefix apps/api`, then `npm run db:deploy --prefix apps/api` against your **development** database. The latter applies checked-in migrations, including the new ledger indexes. Review migrations before applying them to any shared database.
5. Run `npm run dev:api` from the root. The server loads its local environment configuration.
6. Copy the [mobile environment template](apps/mobile/.env.example) to a local environment file. Set `EXPO_PUBLIC_API_URL` to the API base URL ending in `/api/v1`. Android emulator: use `10.0.2.2` instead of `localhost`. A physical phone needs the development machine's reachable LAN address. Use HTTPS outside local development.
7. Run `npm run dev:mobile`. Use a development build compatible with SDK 51; current Expo Go may not support this SDK. Create a book in the Books tab before recording expenses.

No global legacy Expo CLI is required. Local Expo commands use `npx expo` from the mobile directory.

### Receipt AI

Configure the R2 variables and Google Application Default Credentials via `GOOGLE_APPLICATION_CREDENTIALS`; enable Cloud Vision and billing in your cloud project. This is a service-account/ADC integration, not a client-side API key. Never commit credentials or put them in `EXPO_PUBLIC_*` variables.

Scanning sends a normalized image to Google Vision and stores the attachment in R2. JPEG/PNG/WebP uploads are supported, up to 10 MB and 20 megapixels before resizing. Cloud failures leave a manual-entry path. Review the total, date, time and category before saving; no confidence score is invented.

**Privacy limitation:** the current storage contract still returns public URLs. Random object names are not authorization. Do not use real financial documents in a public demo until private-bucket signed downloads are implemented.

### Optional analytics AI

Set `OPENAI_API_KEY` and `OPENAI_MODEL` only on the API. Choose a model supporting Chat Completions strict JSON-schema outputs. Leaving either empty disables provider calls.

The Analytics screen shows local insights automatically. **Prioritize with AI** explicitly consents to sending numeric evidence (including amounts) for that request. The API removes merchant names, notes, category names, transaction IDs and receipt contents. Structured model output may contain only validated indices into existing insights. Facts and review actions are rendered by the server. Missing configuration, timeouts, refusals, invalid JSON, duplicate/out-of-range indices and provider failures use a labeled local fallback. Provider retention policies still apply; `store: false` is not a zero-retention guarantee.

## Checks

- `npm test` — local regression tests; no real database or paid AI calls.
- `npm run build:api` — API TypeScript build.
- `npm run typecheck:mobile` — mobile TypeScript validation.
- From the mobile directory, `npx expo export --platform android --output-dir dist` — Android JS/Hermes bundle validation, **not** an APK/device test.

GitHub Actions runs tests and both TypeScript checks. A real PostgreSQL integration suite and Android/iOS UI tests are still needed.

## Portfolio positioning

Position this as **an explainable expense assistant**, not just another CRUD tracker or an ungrounded financial chatbot. The useful engineering story is: receipt → editable draft → validated ledger → traceable evidence → optional bounded AI ranking.

See [the review](docs/REVIEW.md) for honest resume bullets, remaining risks, architecture guidance and an evaluation plan. Do not claim measured accuracy, user scale, production deployment or offline sync without evidence.
