# PingAlert

Self-hosted HTTP/S uptime monitor with BullMQ worker queues, email alerting, incident tracking, and public status pages.

[![CI](https://github.com/Manoj-APJ/pingalert/actions/workflows/ci.yml/badge.svg)](https://github.com/Manoj-APJ/pingalert/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%5E22.12%20%7C%7C%20%3E%3D24-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io)

---

## Preview

### Dashboard & Fleet Status
![Monitor Dashboard](docs/screenshots/dashboard.png)

### Monitor Analytics & Uptime History
![Monitor Detail](docs/screenshots/monitor_detail.png)

### Public Status Page
![Public Status Page](docs/screenshots/status_page.png)

---

## Architecture

PingAlert uses three decoupled runtimes: the **React SPA**, the **Express API**, and a **Background Worker Daemon**. Network probing and alert dispatches run independently of the API process.

```mermaid
flowchart TB
    subgraph Client ["Frontend (React 19 SPA)"]
        UI["Web Dashboard & Status Pages"]
    end

    subgraph Server ["API Server (Express :3001)"]
        Endpoints["REST API & Auth Handlers"]
    end

    subgraph Broker ["Message Broker (Redis 7)"]
        QPing["Queue: monitor-pings"]
        QAlert["Queue: alerts"]
    end

    subgraph Database ["Database (PostgreSQL 15)"]
        DB[("PostgreSQL Store<br/>monitors, stats, incidents, logs")]
    end

    subgraph Workers ["Worker Daemon (worker-entry.js)"]
        Scheduler["Scheduler<br/>10s Poller & Cleanup"]
        PingWorker["Ping Worker (Concurrency: 50)<br/>SSRF Check & Latency Probe"]
        AlertWorker["Alert Worker (Concurrency: 10)<br/>SMTP Dispatch & Logger"]
    end

    subgraph External ["External Services"]
        Targets["Monitored HTTP/S Targets"]
        SMTP["SMTP Mail Server"]
    end

    UI <-->|"REST API / JWT"| Endpoints
    Endpoints <-->|"Read / Write"| DB

    Scheduler -->|"1. Fetch due monitors"| DB
    Scheduler -->|"2. Enqueue check"| QPing

    QPing -->|"Pull job"| PingWorker
    PingWorker -->|"3. Probe target"| Targets
    PingWorker -->|"4. Update state & metrics"| DB
    PingWorker -.->|"5. Enqueue alert (DOWN / UP)"| QAlert
    PingWorker -.->|"Retry on failure"| QPing

    QAlert -->|"Pull job"| AlertWorker
    AlertWorker -->|"6. Send notification"| SMTP
    AlertWorker -->|"7. Write audit log"| DB
```

### Execution Flow

```
Scheduler (every 10s)
  │
  ├─► Queries active monitors where next_check_at <= NOW()
  │
  └─► Enqueues job into BullMQ "monitor-pings"
        │
        ▼
Ping Worker (concurrency: 50)
  │
  ├─► 1. DNS Pre-Resolution: Validates target IP against private/loopback CIDRs (SSRF safe)
  ├─► 2. HTTP Request: Executes request with redirect: manual, records latency (performance.now())
  │
  ├───► SUCCESS (2xx/3xx):
  │       • Sets status = 'up'
  │       • Writes hourly latency and up_count to hourly_stats
  │       • Closes open incident (if recovering from outage)
  │       • Enqueues UP notification to "alerts" queue
  │
  └───► FAILURE (timeout / network error / 4xx / 5xx):
          • Increments consecutive_failures
          • If failures < retry threshold (default: 3):
          │   └─► Schedules immediate retry check after 5s
          • If failures >= retry threshold:
              • Sets status = 'down'
              • Opens new incident record
              • Enqueues DOWN notification to "alerts" queue
                    │
                    ▼
              Alert Worker (concurrency: 10)
                • Dispatches HTML + text email via Nodemailer
                • Writes delivery audit log to email_logs (sent / failed / mocked)
```

---

## Core Features

- **Decoupled Job Queues**: Pings and email deliveries run in separate BullMQ worker processes, isolating API performance from network traffic.
- **SSRF Safe**: DNS is pre-resolved before connection. Rejects private, loopback, link-local, and IPv4-mapped IPv6 ranges. Redirects are not followed automatically.
- **Flap & Spike Resistance**: Configurable retry counts before marking an endpoint `DOWN` prevent false alarms on single transient hiccups.
- **Incident Lifecycle**: Outages automatically open an incident with cause and timestamp, and resolve with calculated downtime when checks recover.
- **Public Status Pages**: Shareable dashboards (`/status/:slug`) showing live health, 30-day uptime bars, and active/resolved incidents without login.
- **Email Alert Auditing**: Tracks all UP/DOWN notification attempts (`sent`, `failed`, or `mocked`) with automatic 50-day retention cleanup.

---

## Quick Start

### Prerequisites

- **Node.js** `>= 22.12.0` or `>= 24.0.0`
- **Docker** & **Docker Compose**

### 1. Setup

```bash
git clone https://github.com/Manoj-APJ/pingalert.git
cd pingalert
npm install
cp .env.example .env
```

### 2. Start PostgreSQL & Redis

```bash
docker-compose up -d
```

### 3. Run Development Services

```bash
npm run dev
```

Starts the Vite frontend (`:5173`), Express API (`:3001`), and background worker daemon concurrently. Database tables migrate automatically on boot.

---

## Configuration

Key variables in `.env`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | API server port |
| `JWT_SECRET` | *(required in prod)* | Secret key for JWT signing |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/pingalert` | PostgreSQL connection URL |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `PING_RETRY_COUNT` | `3` | Consecutive failures before marking DOWN |
| `PING_RETRY_DELAY_SEC` | `5` | Delay in seconds between retries |
| `PING_CONCURRENCY` | `50` | Maximum parallel ping checks |
| `ALERT_CONCURRENCY` | `10` | Maximum parallel email jobs |
| `SMTP_HOST` | *(empty)* | SMTP hostname (logs mock alert to console if empty) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` / `SMTP_PASS` | *(empty)* | SMTP credentials |
| `SMTP_FROM` | `alerts@pingalert.com` | Alert sender email address |

---

## Production

```bash
# Build frontend
npm run build

# Start API server
npm start

# Start background workers (separate process)
npm run start:worker
```

---

## Testing

```bash
npm test              # Run unit tests (Vitest)
npm run lint          # Run ESLint
npm run build         # Typecheck & production build
```

Tests run with mocked database and queue adapters — no running database or Redis required.

---

## License

[MIT](LICENSE)

