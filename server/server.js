const app = require('./app');
const config = require('./config');
const pool = require('./db/pool');

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`TaskFlow server running on http://localhost:${PORT} in ${config.nodeEnv} mode`);
});

// Graceful shutdown: on a redeploy or `docker compose stop` the platform sends
// SIGTERM. Finish the requests in flight, close the database pool, then exit.
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  // If connections refuse to close, exit anyway before the platform kills us.
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(() => {
    pool.end().then(() => process.exit(0), () => process.exit(1));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
