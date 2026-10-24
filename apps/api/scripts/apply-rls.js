// Applies prisma/sql/rls.sql after migrations.
// Uses MIGRATE_DATABASE_URL (migrator role that owns the schema).

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('MIGRATE_DATABASE_URL is required');

  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'sql', 'rls.sql'),
    'utf8',
  );

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✅ RLS applied');
    const { rows } = await client.query('SELECT * FROM rls_status ORDER BY tablename');
    console.table(rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error('❌ RLS failed:', err); process.exit(1); });