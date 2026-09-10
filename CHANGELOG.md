# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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

### Notable fixes prior to this changelog
- Fixed a TOCTOU DNS-rebinding SSRF vulnerability in the ping service by
  replacing `fetch` with `http`/`https.request`, a custom safe DNS lookup,
  and redirect destruction on 3xx responses.
- Fixed a `crypto.randomUUID()` import bug affecting four production files.
- Fixed a duplicate-email bug in the alert worker.