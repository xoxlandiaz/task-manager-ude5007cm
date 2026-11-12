const { Pool, types } = require('pg');
const config = require('../config');

// Return DATE (1082) as YYYY-MM-DD string instead of JS Date object
types.setTypeParser(1082, (val) => val);

const poolConfig = {
  connectionString: config.databaseUrl,
};

if (config.databaseSsl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

// An idle connection can be closed by the server (database restart, idle
// timeout). Without a listener this 'error' event would crash the process;
// the pool drops the dead connection by itself.
pool.on('error', (err) => {
  console.error('Idle PostgreSQL client error:', err.message);
});

module.exports = pool;
