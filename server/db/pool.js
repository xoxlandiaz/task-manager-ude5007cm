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

module.exports = pool;
