// apps/api/scripts/create-test-db.js
// Ensures the TEST_DATABASE_URL database exists before running e2e tests.

const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const urlStr = process.env.TEST_DATABASE_URL;
  if (!urlStr) throw new Error('TEST_DATABASE_URL is missing');

  const url = new URL(urlStr);
  const dbName = url.pathname.replace('/', '');

  // Connect to default 'postgres' database to check/create target DB
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });

  await client.connect();
  try {
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );
    if (res.rowCount === 0) {
      console.log(`Creating test database "${dbName}"...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Test database "${dbName}" created.`);
    }
  } catch (err) {
    console.error('Error ensuring test database exists:', err.message);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
