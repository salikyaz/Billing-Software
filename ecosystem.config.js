// PM2 process configuration for the Hostinger VPS (or any always-on host).
//   pm2 start ecosystem.config.js
//
// IMPORTANT: the web app is intentionally pinned to a SINGLE instance
// (`instances: 1`, fork mode). The in-app rate limiter (src/lib/rate-limit.ts)
// keeps its counters in process memory; running multiple workers would give
// each its own counters and multiply the effective brute-force limits. If you
// need to scale to multiple workers/servers, move the limiter to Redis first.
module.exports = {
  apps: [
    {
      name: "aitek-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "aitek-cron",
      script: "npm",
      args: "run cron",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env: { NODE_ENV: "production" },
    },
  ],
};
