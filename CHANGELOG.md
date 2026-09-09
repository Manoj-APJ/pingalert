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

### Notable fixes prior to this changelog
- Fixed a TOCTOU DNS-rebinding SSRF vulnerability in the ping service by
  replacing `fetch` with `http`/`https.request`, a custom safe DNS lookup,
  and redirect destruction on 3xx responses.
- Fixed a `crypto.randomUUID()` import bug affecting four production files.
- Fixed a duplicate-email bug in the alert worker.