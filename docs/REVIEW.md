# CashBook engineering review and change log

## Overall assessment

The original repository was a promising full-stack prototype, not a release-ready financial application. The strongest work was the breadth of end-to-end functionality and the atomic paired-transfer design. The weakest areas were security boundaries, reproducible setup, tests, misleading feature claims, and state consistency.

Subjective assessment of the **original** code, not a benchmark:

| Area | Score | Reason |
|---|---|---|
| Idea/differentiation | 5/10 | Expense CRUD, receipt OCR and charts are common; explainable, evaluated assistance can differentiate it |
| Stack choice | 8/10 | TypeScript, React Native, Fastify, PostgreSQL and Prisma are a coherent fit |
| Architecture | 6/10 | Sensible route/service split, but duplicated server state and fat route handlers |
| Execution/correctness | 5/10 | Useful flows exist, but transfer edits, receipt parsing, reports and stale UI had defects |
| Security/release readiness | 3/10 | SQL injection, missing ownership checks, token-purpose confusion and public attachments |
| Portfolio evidence | 4/10 | No test suite, inaccurate offline claim, no measured AI evaluation |

These changes strengthen the prototype but do not establish production readiness. Do not replace engineering evidence with a higher self-assigned score.

## Architecture judgment

Keep a **modular monolith**. Microservices, Kafka or Kubernetes would add complexity without addressing this application's current needs. PostgreSQL transactions are appropriate for paired ledger writes. The API/app split and one main language are useful for an individual developer.

Recommended boundaries:

1. **HTTP layer:** authentication, Zod validation, ownership checks, status codes.
2. **Ledger service:** create/edit/delete invariants and database transactions; move remaining business logic out of routes incrementally.
3. **Analytics service:** verified facts and bounded statistical calculations, independent of any LLM.
4. **Provider adapters:** OCR, AI ranking, object storage and reports with timeouts/failure behavior.
5. **Mobile:** TanStack Query for server state, Zustand for UI-only selections; typed contracts shared without leaking server dependencies into Expo.

Paired transfers do not equal full double-entry accounting: there is no chart of accounts, journal balancing or full debit/credit posting model. Decimal database columns are good, but some report/UI aggregate arithmetic still uses JavaScript numbers. An eventual shared money type should keep decimal strings or bounded integer minor units across contracts.

## Changes made

### API security and correctness

- Replaced all interpolated unsafe analytics SQL with parameterized Prisma SQL or ORM queries.
- Added validated UUIDs, month/year/limit bounds and calendar date windows; trends now respect selected periods and include missing months as zero.
- Added same-currency guards for analytics and reports; blocked cross-currency transfers and moving entries between currencies without conversion.
- Checked ownership and archive state for entry books and transfer destinations; checked category ownership on edits.
- Prevented changing transfer structure or converting a normal entry into a transfer through a partial update. Amount/date/time/note edits continue to synchronize paired legs.
- Preserved soft-deleted transfer records as audit links rather than incorrectly deleting a referenced parent.
- Repaired the entry type filter being overwritten by the default transfer exclusion; bounded pagination.
- Added strict money precision, real calendar-date and clock-time validation, UTC serialization for database TIME values.
- Enforced access-token purpose; refresh tokens can no longer authorize resource requests. Newly issued access tokens include `type: access`. Existing untyped access tokens must refresh or log in again.
- Normalized emails and added a bcrypt byte-length limit on registration. Existing mixed-case email records may require normalization/deduplication before rollout.
- Added structured 400 validation responses, generic 500 responses, startup JWT validation, explicit browser CORS origins and graceful shutdown.
- Split app construction from server listening to enable HTTP injection tests without opening a port.
- Loaded local API environment configuration at startup; removed unused refresh-secret template variables.
- Added ledger query/transfer indexes with a migration. **The migration was not applied during this review.**

### Receipt pipeline

- Switched to document OCR over image bytes; no public URL is required for Vision to read the receipt.
- Validates MIME type and decodes/resizes images with a pixel limit; removes image metadata during JPEG conversion.
- Added a lower scan request limit and explicit provider status (`extracted`, `no_text`, `unavailable`). Provider failure retains manual entry and does not log receipt text.
- Extracts labeled totals instead of the first currency amount; preserves cents; handles grouped amounts and Japanese date/total labels.
- Declines ambiguous dates, unsupported comma-decimal totals, invalid dates/times and negative/refund totals rather than guessing.
- Category suggestions remain **keyword heuristics**, explicitly labeled as such. Merchant extraction is still a first-line heuristic.
- Mobile reports draft/review status instead of always claiming autofill success, supports web FormData, and ignores stale scan results after removing/replacing a receipt.
- Added cloud-upload disclosure before scanning. This is basic notice, not a complete legal privacy/retention implementation.

### Explainable analytics and actual AI

- New local insights: matched-period spending changes, month-end run-rate estimates, prior-category median/MAD outliers and possible recurring payments.
- Uses minimum evidence thresholds; excludes future records, transfers and deleted records at the relevant layers; caps loaded data at 5,000 entries and refuses partial-data analysis.
- Returns explanations, sample evidence and explicit limitations. A run-rate estimate is not a trained forecasting model; an outlier is not fraud detection.
- New optional consent-gated AI ranking endpoint and mobile action. Sends numeric evidence only; validates output indices against server facts; fixed server-owned actions prevent fabricated financial instructions.
- Timeouts, schema validation and clearly labeled local fallback; no extra paid provider is needed for basic use.
- AI ranking has per-IP route limiting, not a comprehensive per-user/daily cost budget. No production scaling or cost claim is made.
- Corrected trend charts to use a common amount scale rather than making every month's bars the same total width; displayed the year and currency.

### Mobile and reports

- Coordinated concurrent token refresh, excluded login/register from refresh retries, retained sessions on transient provider/network errors, and rejected stale cross-session responses.
- Added session-expiry handling, protected-route redirection and clearing of query/store data on logout.
- Refreshed active-book objects from fresh data; removed automatic book creation as a side effect of GET/fetch. New users create a book explicitly.
- Guarded entries/categories fetch races; normalized serialized decimal entry amounts; fixed removal of both transfer legs in local state.
- Corrected local-calendar defaults and seven-day filters; preserved an edited entry's original book.
- Invalidated analytics after entry saves/deletes and refreshed affected stores. The larger dual-state architecture remains to be consolidated.
- Fixed XLSX files being named JPEGs and passed into Sharp; migrated R2 client to AWS SDK v3.
- Replaced the vulnerable SheetJS npm package with write-excel-file. Strings remain text cells, not executable formulas.
- Fixed PDF font loading from actual bundled font bytes instead of treating JavaScript as a font; corrected transfer treatment in totals and currency labels.
- Protected categories referenced by soft-deleted records from hard deletion.

### Project quality

- Removed stray root Expo 46 and `f` dependencies; added root orchestration scripts while keeping separate app lockfiles.
- Replaced a nonfunctional ESLint command with actual test/typecheck scripts; no claim of lint coverage.
- Updated API to Fastify 5 and compatible plugins, Google Vision 6 and Sharp 0.35 after dependency audit findings.
- Added tests for parsing, validation, insight calculations, AI data minimization/fallback, HTTP authentication/input/ownership behavior, SQL parameter binding, trend rollover and report generation.
- Added GitHub Actions and expanded ignores for local credentials/build outputs.
- Rewrote the README to remove unsupported offline, full-accounting and chart claims and explain setup/AI limitations.

## Validation performed

- API TypeScript build: **passed**.
- Mobile TypeScript check: **passed**.
- Node test runner: **23 passed, 0 failed**, including nested HTTP tests.
- Android Expo/Hermes export: **passed**, 1,274 bundled modules. This proves JS bundling, not camera, native permissions, signing or device behavior.
- Backend production dependency audit: **0 known vulnerabilities at review time**; not a security certification.
- Mobile production dependency audit: **44 findings: 1 critical, 14 high, 28 moderate, 1 low**. These include tooling/transitive packages; audit severity alone does not establish exploitability in the shipped native app. The native stack upgrade remains a release blocker.

Node/npm were initially absent from PATH. A checksum-verified portable Node 22 runtime was downloaded to the Windows temporary directory for validation; there was no system-wide installation. Dependencies and generated build artifacts were installed/generated locally. No real database was migrated, no cloud receipt was uploaded, no paid AI request was made, and no app was deployed.

Tests mock Prisma methods; **PostgreSQL query execution, database concurrency and migrations are not integration-tested here**. AI tests mock provider responses, not provider availability or model usefulness. Git metadata/tools were unavailable in this downloaded copy, so there is no verified git diff/commit report.

## Remaining work, in priority order

### P0 — before using real financial data

1. **Private receipts and reports.** Existing public R2 URLs remain bearer-accessible. Move to a private bucket, persist object keys/owner metadata, authorize every download, return short-lived signed URLs, validate attached object ownership, and implement object deletion/retention. Migrate existing URLs and disable public access; simply changing upload paths is insufficient.
2. **Upgrade the native stack deliberately.** Move Expo/React Native and matching plugins to a maintained compatible release, regenerate/reconcile native projects, verify custom Gradle changes, and run Android/iOS camera/auth/storage tests. Do not apply `npm audit fix --force` blindly to Expo.
3. **Refresh-token lifecycle.** Store hashed refresh-token sessions, rotate single-use tokens transactionally, detect replay and support logout/revocation across devices. Current stateless refresh tokens remain valid until expiry even after client logout.
4. **Real database integration/security tests.** Use isolated PostgreSQL fixtures for two users; cover transfer create/edit/delete atomicity, unauthorized destinations, archive/currency races, concurrent category deletion, indexes and SQL execution. Current guards do not eliminate every concurrent TOCTOU race; transaction-level invariants or constraints are the next step.

### P1 — reliability and a stronger portfolio

- Consolidate server state into TanStack Query; scope query keys to user ID and add error/retry/empty states across every screen. Some original fire-and-forget fetch call sites still need explicit error handling. Entry lists currently show a bounded page rather than infinite scrolling.
- Make account creation/default categories and book creation/transfer-category generation atomic. Generating two transfer categories per book pair grows quadratically; an explicit transfer form will scale and explain better.
- Store money as decimal strings or minor units in shared API types; add currency-aware formatting to all remaining non-analytics screens. Prevent unsupported currency codes, handle zero/three-decimal currencies, and avoid suggesting that a currency field implements FX.
- Define book/archive/deletion semantics and database ownership invariants consistently; a mutable ledger plus soft deletes is not an immutable audit log.
- Add attachment idempotency/cleanup, per-user AI quotas, cost monitoring, bounded provider retries, circuit breakers, request tracing and user-safe error telemetry.
- Web localStorage tokens remain exposed to XSS. Treat web as a separate deployment with an HttpOnly-cookie/CSRF design rather than assuming native SecureStore protection carries over.
- PDF CJK glyph coverage is still limited by bundled Roboto; add a properly licensed CJK font. Report `includeBills` is not yet a complete embedded-receipt implementation.
- Add an OpenAPI contract, shared domain types, accessibility labels, empty onboarding, pagination, backup/restore and deletion/export policies.

### P2 — differentiation, not buzzwords

The strongest next feature is a **receipt-review learning loop**: retain structured extraction provenance and user corrections with consent; measure which fields require correction; suggest categories using personal history; expose why each suggestion was made. Add duplicate-receipt detection and a review queue before auto-posting. Do not auto-save AI predictions as ledger truth.

Offline sync should be a separate designed feature: local SQLite outbox, client-generated operation IDs, idempotent server mutations, conflict resolution and retries. Installing SQLite alone does not implement it.

Avoid adding RAG unless there is a retrieval problem (for example, permission-scoped semantic search over personal receipt text). SQL is better for exact financial totals. An LLM should not calculate balances.

## AI evaluation plan

1. Assemble consented or synthetic receipts across languages, lighting conditions, fonts, currencies and ambiguous dates. Keep a held-out set; do not publish private receipts.
2. Measure exact-match/normalized accuracy separately for total, merchant, date and time; measure category precision and coverage; track user correction rate.
3. Add no-total, multiple-total, rotated, empty, refund, comma-decimal and provider-timeout fixtures. The current parser intentionally abstains on unsupported formats.
4. Measure scan latency (p50/p95), cost per successful draft and failure rate. Do not invent numbers before running the experiment.
5. Evaluate anomaly precision from user confirmations and false positives for infrequent large purchases. Backtest forecasts chronologically without leaking future data.
6. Compare AI ranking with deterministic ordering in a blinded preference evaluation. If the model is not more useful, keep the simpler local ordering.
7. Test invalid schema output, repeated/out-of-range IDs, prompt injection attempts in merchant names, rate limits and data minimization. The current ranker does not transmit merchant text, so that text cannot inject its prompt.

## Honest resume bullets

Use only after understanding and demonstrating the implementation; provider-dependent claims require an actual configured demo.

- Built a TypeScript expense tracker using React Native, Expo, Fastify, PostgreSQL and Prisma, with atomic paired transfers and tenant-scoped financial APIs.
- Integrated Google Cloud Vision receipt OCR with image normalization, conservative field extraction, manual-review safeguards and provider-failure fallback.
- Implemented explainable spending insights using robust median/MAD outlier detection, recurring-payment heuristics and calendar-aware spending projections.
- Added optional structured-output AI prioritization over numeric evidence, with explicit consent, server-validated recommendations and no merchant/receipt text sent to the ranking model.
- Added 23 regression checks, CI TypeScript validation and Android bundle verification; remediated SQL injection, token-purpose confusion and backend dependency advisories.

Do not claim: trained a proprietary OCR model, predictive ML forecasting, production-ready security, full double-entry accounting, offline-first sync, 99% accuracy, thousands of users or quantified performance improvements without supporting evidence.

## Suggested demonstration

Use synthetic data. Register two users, show isolation, create same-currency books, record a transfer and prove totals exclude it. Scan a synthetic receipt and correct an ambiguous field. Seed enough historical expenses to trigger an explained anomaly/recurring candidate, inspect its evidence, then demonstrate both configured AI ranking and local fallback. Show the test run and CI beside the app. This tells a stronger engineering story than listing technologies alone.