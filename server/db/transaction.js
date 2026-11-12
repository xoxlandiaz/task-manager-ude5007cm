// Runs fn(client) inside one database transaction: COMMIT if it returns,
// ROLLBACK if it throws. The client always goes back to the pool.
async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // The original error matters more than a failed ROLLBACK.
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
