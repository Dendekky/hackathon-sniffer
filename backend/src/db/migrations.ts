import { Database } from './connection';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_hackathons_table',
    up: async (db: Database) => {
      await db.run(`
        CREATE TABLE hackathons (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          registration_deadline TEXT,
          location TEXT NOT NULL,
          is_online INTEGER NOT NULL DEFAULT 0,
          website_url TEXT,
          registration_url TEXT,
          source TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for common queries
      await db.run('CREATE INDEX idx_hackathons_start_date ON hackathons(start_date)');
      await db.run('CREATE INDEX idx_hackathons_is_online ON hackathons(is_online)');
      await db.run('CREATE INDEX idx_hackathons_source ON hackathons(source)');
      await db.run('CREATE INDEX idx_hackathons_location ON hackathons(location)');
    },
    down: async (db: Database) => {
      await db.run('DROP INDEX IF EXISTS idx_hackathons_location');
      await db.run('DROP INDEX IF EXISTS idx_hackathons_source');
      await db.run('DROP INDEX IF EXISTS idx_hackathons_is_online');
      await db.run('DROP INDEX IF EXISTS idx_hackathons_start_date');
      await db.run('DROP TABLE IF EXISTS hackathons');
    },
  },
  {
    version: 2,
    name: 'create_sources_table',
    up: async (db: Database) => {
      await db.run(`
        CREATE TABLE sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          base_url TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          last_scraped_at TEXT,
          scrape_interval_hours INTEGER NOT NULL DEFAULT 24,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert initial sources
      const sources = [
        { id: 'devpost', name: 'Devpost', base_url: 'https://devpost.com', scrape_interval_hours: 24 },
        { id: 'mlh', name: 'Major League Hacking', base_url: 'https://mlh.io', scrape_interval_hours: 24 },
        { id: 'eventbrite', name: 'Eventbrite', base_url: 'https://www.eventbrite.com', scrape_interval_hours: 12 },
      ];

      for (const source of sources) {
        await db.run(
          'INSERT INTO sources (id, name, base_url, scrape_interval_hours) VALUES (?, ?, ?, ?)',
          [source.id, source.name, source.base_url, source.scrape_interval_hours]
        );
      }
    },
    down: async (db: Database) => {
      await db.run('DROP TABLE IF EXISTS sources');
    },
  },
  {
    version: 3,
    name: 'create_raw_events_table',
    up: async (db: Database) => {
      await db.run(`
        CREATE TABLE raw_events (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          raw_data TEXT NOT NULL,
          url TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          processed INTEGER NOT NULL DEFAULT 0,
          hackathon_id TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (source_id) REFERENCES sources (id),
          FOREIGN KEY (hackathon_id) REFERENCES hackathons (id)
        )
      `);

      // Create indexes
      await db.run('CREATE INDEX idx_raw_events_source_id ON raw_events(source_id)');
      await db.run('CREATE INDEX idx_raw_events_processed ON raw_events(processed)');
      await db.run('CREATE INDEX idx_raw_events_content_hash ON raw_events(content_hash)');
      await db.run('CREATE UNIQUE INDEX idx_raw_events_url_source ON raw_events(url, source_id)');
    },
    down: async (db: Database) => {
      await db.run('DROP INDEX IF EXISTS idx_raw_events_url_source');
      await db.run('DROP INDEX IF EXISTS idx_raw_events_content_hash');
      await db.run('DROP INDEX IF EXISTS idx_raw_events_processed');
      await db.run('DROP INDEX IF EXISTS idx_raw_events_source_id');
      await db.run('DROP TABLE IF EXISTS raw_events');
    },
  },
  {
    version: 4,
    name: 'create_migrations_table',
    up: async (db: Database) => {
      await db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
    down: async (db: Database) => {
      await db.run('DROP TABLE IF EXISTS migrations');
    },
  },
];

export async function runMigrations(db: Database): Promise<void> {
  console.log('Running database migrations...');

  // Ensure migrations table exists first
  await migrations.find(m => m.name === 'create_migrations_table')!.up(db);

  // Get current migration version
  const currentVersion = await getCurrentMigrationVersion(db);
  console.log(`Current migration version: ${currentVersion}`);

  // Run pending migrations
  const pendingMigrations = migrations.filter(m => m.version > currentVersion && m.name !== 'create_migrations_table');
  
  for (const migration of pendingMigrations) {
    console.log(`Running migration ${migration.version}: ${migration.name}`);
    
    try {
      await db.beginTransaction();
      await migration.up(db);
      await db.run(
        'INSERT INTO migrations (version, name) VALUES (?, ?)',
        [migration.version, migration.name]
      );
      await db.commitTransaction();
      console.log(`✓ Migration ${migration.version} completed`);
    } catch (error) {
      await db.rollbackTransaction();
      console.error(`✗ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  console.log('All migrations completed successfully');
}

export async function rollbackMigration(db: Database, targetVersion: number): Promise<void> {
  const currentVersion = await getCurrentMigrationVersion(db);
  
  if (targetVersion >= currentVersion) {
    console.log('Target version is not lower than current version');
    return;
  }

  const migrationsToRollback = migrations
    .filter(m => m.version > targetVersion && m.version <= currentVersion)
    .sort((a, b) => b.version - a.version); // Rollback in reverse order

  for (const migration of migrationsToRollback) {
    console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
    
    try {
      await db.beginTransaction();
      await migration.down(db);
      await db.run('DELETE FROM migrations WHERE version = ?', [migration.version]);
      await db.commitTransaction();
      console.log(`✓ Migration ${migration.version} rolled back`);
    } catch (error) {
      await db.rollbackTransaction();
      console.error(`✗ Rollback of migration ${migration.version} failed:`, error);
      throw error;
    }
  }
}

async function getCurrentMigrationVersion(db: Database): Promise<number> {
  try {
    const result = await db.get<{ version: number }>('SELECT MAX(version) as version FROM migrations');
    return result?.version || 0;
  } catch (error) {
    // Migrations table doesn't exist yet
    return 0;
  }
}
