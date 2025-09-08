#!/usr/bin/env tsx

import { getDatabase, closeDatabase } from './connection';
import { runMigrations, rollbackMigration } from './migrations';

async function main() {
  const command = process.argv[2];
  const targetVersion = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

  try {
    const db = getDatabase();

    switch (command) {
      case 'up':
        await runMigrations(db);
        break;
      case 'down':
        if (targetVersion === undefined) {
          console.error('Target version required for rollback');
          process.exit(1);
        }
        await rollbackMigration(db, targetVersion);
        break;
      default:
        console.log('Usage:');
        console.log('  npm run db:migrate up              - Run all pending migrations');
        console.log('  npm run db:migrate down <version>  - Rollback to specific version');
        process.exit(1);
    }

    console.log('Migration operation completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

if (require.main === module) {
  main();
}
