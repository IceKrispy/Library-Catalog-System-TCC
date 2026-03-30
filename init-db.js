#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const schemaPath = path.join(__dirname, 'DATABASE_SCHEMA.sql');
const dbPath = path.join(__dirname, 'catalog.db');

console.log('🛠️  Initializing database...');

try {
  // Read schema file
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Create database connection
  const db = new Database(dbPath);
  console.log(`✓ Database file created: ${dbPath}`);

  // Split schema by statement and execute each one
  // This is more robust than trying to execute the entire script
  const statements = schema
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

  for (const statement of statements) {
    try {
      db.exec(statement);
    } catch (err) {
      // Some statements might fail (like IF NOT EXISTS), so we log but continue
      if (!err.message.includes('already exists')) {
        console.warn(`Warning: ${err.message}`);
      }
    }
  }

  // Verify structure
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all();

  console.log(`✓ Database initialized with ${tables.length} tables:`);
  tables.forEach(t => console.log(`  - ${t.name}`));

  // Verify sample data
  const bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get();
  console.log(`✓ Sample data loaded: ${bookCount.count} books in catalog`);

  db.close();
  console.log('✅ Database initialization complete!\n');
  process.exit(0);
} catch (error) {
  console.error('❌ Error initializing database:');
  console.error(error.message);
  process.exit(1);
}
