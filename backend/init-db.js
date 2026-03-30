#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const schemaPath = path.join(__dirname, '../DATABASE_SCHEMA.sql');
const dbPath = path.join(__dirname, '../catalog.db');

console.log('🛠️  Initializing database...\n');

try {
  // Read schema file
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  console.log(`✓ Read schema from: ${schemaPath}`);

  // Create database connection
  const db = new Database(dbPath);
  console.log(`✓ Database file created: ${dbPath}`);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Parse SQL statements - handle multi-line statements
  const statements = [];
  let currentStatement = '';
  
  for (const line of schema.split('\n')) {
    const trimmedLine = line.trim();
    
    // Skip comments and empty lines
    if (trimmedLine.startsWith('--') || trimmedLine === '') {
      continue;
    }
    
    currentStatement += ' ' + trimmedLine;
    
    // If line ends with semicolon, we have a complete statement
    if (trimmedLine.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }
  
  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  console.log(`\n✓ Executing ${statements.length} SQL statements...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].replace(/;$/, ''); // Remove trailing semicolon
    try {
      db.exec(statement);
    } catch (err) {
      // Log but continue on errors - some constraints might fail
      console.warn(`⚠ Statement ${i + 1}: ${err.message}`);
    }
  }

  // Verify structure
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all();

  console.log(`\n✓ Database initialized with ${tables.length} tables:`);
  tables.forEach(t => console.log(`  • ${t.name}`));

  // Verify sample data
  try {
    const bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get();
    const authCount = db.prepare('SELECT COUNT(*) as count FROM authors').get();
    const copyCount = db.prepare('SELECT COUNT(*) as count FROM copies').get();

    console.log(`\n✓ Sample data loaded:`);
    console.log(`  • ${bookCount.count} books`);
    console.log(`  • ${authCount.count} authors`);
    console.log(`  • ${copyCount.count} physical copies`);
  } catch (e) {
    console.warn('⚠ Could not verify sample data:', e.message);
  }

  db.close();
  console.log('\n✅ Database initialization complete!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error initializing database:');
  console.error(error.message);
  process.exit(1);
}
