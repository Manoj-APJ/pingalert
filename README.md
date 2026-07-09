# Pingalert 🚨

Welcome to **Pingalert**! 👋 

Have you ever worried that your servers or APIs might go down in the middle of the night without you knowing? That's exactly why Pingalert exists. We built it to provide a robust, reliable, and real-time uptime monitoring and alerting system. It continuously checks your endpoints, logs their response times, and immediately notifies you if things go south—saving you from those dreaded "is the site down?" messages from your users.

## 🏗️ Architecture Under the Hood

We wanted Pingalert to be lightning fast but also durable enough to handle thousands of concurrent monitoring checks without dropping the ball. Here's a look at the engine powering it:

### The Frontend (React + Vite + TypeScript)
The client interface is a snappy Single Page Application built with React. It uses Vite for blazing-fast Hot Module Replacement during development and optimized builds for production. TypeScript ensures our UI components are strictly typed and less prone to runtime errors.

### The Backend API (Node.js + Express)
The core REST API handles user authentication (via JWT), rate limiting, and CRUD operations for managing your monitors. It's built with strict payload size limits and optimized configurations to prevent abuse and ensure stability.

### The Database (PostgreSQL)
We use PostgreSQL as our source of truth. It stores all user profiles, monitor configurations, and historical ping logs. To prevent bottlenecks, our database connection pool is precisely tuned to handle high concurrency from our background workers. 

### The Engine Room (BullMQ + Redis)
This is where the magic happens. Instead of relying on a fragile `setInterval` loop within the main API server, we decoupled the actual "pinging" logic into dedicated background workers using **BullMQ**. 
- **Redis** acts as the high-speed message broker.
- **Workers** concurrently pick up jobs, execute HTTP/HTTPS pings, and record the results.
- **Resilience:** The workers are equipped with smart retry strategies. If a server takes a brief hiccup, the worker will retry a few times before officially declaring it "down," drastically reducing false-positive alerts.
- **Alerting:** Once a monitor is confirmed down, another worker handles dispatching the alert emails asynchronously (via NodeMailer).

---

## 🚀 Running Pingalert Locally

We'd love for you to take Pingalert for a spin on your own machine. Getting it up and running is super straightforward.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) (for running PostgreSQL and Redis easily)

### Setup Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Manoj-APJ/pingalert.git
   cd pingalert
   ```

2. **Set up your environment variables:**
   Copy the example file and fill in your details (especially if you want to test email alerts).
   ```bash
   cp .env.example .env
   ```

3. **Spin up the database and message broker:**
   We've included a Docker Compose file to get PostgreSQL and Redis running instantly.
   ```bash
   docker-compose up -d
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Start the application!**
   This single command uses `concurrently` to boot up the React client, the Express backend, and the background workers all at once.
   ```bash
   npm run dev
   ```
   
Your frontend should now be accessible at `http://localhost:5173` (or whichever port Vite chooses), and the API will run on `http://localhost:3001`.

---

## 🤝 Let's Build Together

Pingalert is growing, and there's always room for improvement! Whether you want to add SMS alerting, build a beautiful new dashboard widget, or optimize our worker queries, we warmly welcome your contributions.

**How to contribute:**
1. Fork the repository.
2. Create a new branch for your feature or bug fix (`git checkout -b feature/awesome-new-thing`).
3. Make your changes and test them locally.
4. Commit your changes and push to your fork.
5. Open a **Pull Request** to our main branch.

Let's make downtime a thing of the past. Happy coding! 💻
