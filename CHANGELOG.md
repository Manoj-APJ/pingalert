# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Framer Motion for route transitions, staggered list/card reveals, and micro-interactions (hover/press scale) across monitors, incidents, status pages, and email logs.
- Non-blocking toast notification system (`ToastProvider` / `useToast`) for create, pause/resume, delete, and copy-URL actions.
- Skeleton loading states and shimmer placeholders to replace blank screens during data fetches.
- Animated `NumberCounter` for uptime percentages and stat figures; `PulseDot` for real-time status indication.
- Warm editorial visual design system: serif display typography (Fraunces/Newsreader) for headings and hero numbers, Inter for body/data/chrome, pastel pill status badges, and pill-shaped buttons/segmented controls.
- Hero treatment (ambient gradient backdrop, serif headline, trust badges) on `AuthView` and `PublicStatusView`.
- `lucide-react` icon set, replacing emoji-based icons throughout.
- `rollup-plugin-visualizer` (dev) for bundle size analysis.

### Changed
- Refactored the monolithic `App.tsx` (1,371 lines) into modular, strictly-typed feature components under `src/components/`, `src/types/`, `src/lib/`, and `src/context/`.
- Route-based code splitting via `React.lazy`/`Suspense` for `MonitorDetail`, `PublicStatusView`, `StatusPageList`, `IncidentList`, `EmailLogsList`, and `SettingsView`.
- Vite/Rollup output now chunks vendor React, Framer Motion, and Lucide Icons separately for better caching.
- All motion respects `prefers-reduced-motion` via `useReducedMotion()`.

### Performance
- Initial entry bundle reduced from 446.88 kB to 63.34 kB (gzip: 127.87 kB → 13.53 kB) — an 86% reduction.
- Six views moved to on-demand lazy chunks (5.4–19.8 kB each) instead of shipping in the main bundle.

### Fixed
- **Double `client.release()` in `handleCheckResult`** — the "monitor not found"
  early-return path manually released the pg client, then the `finally` block
  released it again (a `return` inside a `try` does not skip `finally`). This
  could surface as an uncaught error inside the BullMQ job handler. Fixed by
  moving `pool.connect()` inside the `try`, guarding the sole release in
  `finally` with `if (client)`, and removing the manual release from the
  early-return branch.
- **Crash on `pool.connect()` failure in `handleCheckResult`** — found while
  fixing the above: if the initial connection itself failed, the `catch` block
  called `client.query('ROLLBACK')` on a `null` client, crashing before the
  original error could even be logged. Fixed by guarding the rollback call.
- **Unpropagated SMTP send failures and false success logging in alert worker (BUG-007)** — when
  an email alert dispatch via nodemailer failed, the error was swallowed in a try/catch block
  and execution fell through to an unconditional insert into `email_logs`. Because `email_logs`
  lacked status and error tracking, failed dispatches appeared as successful in the database and UI,
  and BullMQ completed the job without triggering failure handlers. Fixed by adding `status`
  (`'sent'`, `'failed'`, `'mocked'`) and `error` columns to `email_logs`, recording failures with
  error details, re-throwing errors to trigger BullMQ retries, configuring `alertQueue` retry
  defaults matching ping retry conventions (3 attempts, 5s delay), only recording the final outcome
  to `email_logs` (preventing premature failure spam during active retries), and surfacing delivery statuses in the UI.
- **JobId namespace collisions and dropped ping checks in `pingQueue` (B2)** — transient failure
  retries in `monitor-service.js` and immediate checks in `monitor-controller.js` used the same static
  `jobId: ping-${id}` as the scheduler. Because BullMQ deduplicates active jobs by ID, retry jobs scheduled
  while the original check was active were silently dropped, preventing 5-second retries from executing.
  Fixed by giving retries a distinct namespace (`ping-retry-${monitorId}-${consecutiveFailures}`), omitting
  static job IDs on one-off immediate checks (letting BullMQ assign unique IDs), and adding defensive null-check
  warnings across all queue call sites.
- **Premature hourly uptime degradation from transient retry attempts (B3)** — every ping failure
  in a retry sequence unconditionally wrote a failure to `hourly_stats`, degrading hourly uptime even
  when a retry succeeded (e.g. 33% uptime for a site that quickly recovered). Fixed by deferring `hourly_stats`
  failure writes until the retry sequence resolves: recording exactly one `up` increment on success, and
  exactly one failure entry only when all configured retries are exhausted.
- **Latency timer inflated by DNS pre-resolution (B1)** — `performPing` recorded start time using `Date.now()`
  before executing SSRF DNS pre-resolution via `dns.lookup()`, polluting reported HTTP response times with
  DNS resolution round-trip latency. Fixed by starting the latency timer after DNS pre-resolution completes
  and switching to `performance.now()` for monotonic precision.
- **Unverified 'unknown' status monitors displayed as operational on public status pages (B4)** — when
  status page monitors were in 'unknown' status (freshly created or unverified), `downCount` was 0 and
  the page defaulted to 'operational' with a green banner. Fixed by introducing a distinct `'pending'` overall
  status when unverified monitors are present with zero down monitors (preserving outage precedence),
  and updating the frontend banner and badges to display pending status distinctly.

### Notable fixes prior to this changelog
- Fixed a TOCTOU DNS-rebinding SSRF vulnerability in the ping service by
  replacing `fetch` with `http`/`https.request`, a custom safe DNS lookup,
  and redirect destruction on 3xx responses.
- Fixed a `crypto.randomUUID()` import bug affecting four production files.
- Fixed a duplicate-email bug in the alert worker.