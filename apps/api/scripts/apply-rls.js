// apps/api/scripts/apply-rls.js
// Applies prisma/sql/rls.sql after migrations. Idempotent.
// Uses the same DATABASE_URL that Prisma uses.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'sql', 'rls.sql'),
    'utf8',
  );

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✅ RLS applied successfully');
    const { rows } = await client.query('SELECT * FROM rls_status ORDER BY tablename');
    console.table(rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Failed to apply RLS:', err);
  process.exit(1);
});
