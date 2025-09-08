#!/usr/bin/env tsx

import { Database } from './db/database';
import { IngestionScheduler } from './scheduler';

async function main() {
  const command = process.argv[2];
  
  if (!command || !['once', 'watch'].includes(command)) {
    console.log('Usage:');
    console.log('  npm run ingest:once   - Run ingestion once');
    console.log('  npm run ingest:watch  - Run ingestion on schedule');
    process.exit(1);
  }

  // Initialize database connection
  const db = new Database(process.env.DATABASE_URL?.replace('file:', ''));
  const scheduler = new IngestionScheduler(db);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    try {
      await scheduler.stop();
      await db.close();
      console.log('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    switch (command) {
      case 'once':
        console.log('🚀 Running ingestion once...');
        const results = await scheduler.runIngestion();
        
        console.log('\n📊 Ingestion Results:');
        results.forEach(result => {
          console.log(`  ${result.source_id}: ${result.events_found} found, ${result.events_created} created, ${result.events_updated} updated`);
          if (result.errors.length > 0) {
            console.log(`    Errors: ${result.errors.length}`);
            result.errors.forEach(error => console.log(`      - ${error}`));
          }
        });
        
        await scheduler.stop();
        await db.close();
        break;

      case 'watch':
        console.log('🕐 Starting ingestion scheduler...');
        scheduler.start();
        
        // Keep the process running
        console.log('✅ Scheduler running. Press Ctrl+C to stop.');
        
        // Prevent the process from exiting
        setInterval(() => {
          const status = scheduler.getStatus();
          if (status.isRunning) {
            console.log('⏳ Ingestion in progress...');
          }
        }, 60000); // Log status every minute
        
        break;
    }

  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    await scheduler.stop();
    await db.close();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
