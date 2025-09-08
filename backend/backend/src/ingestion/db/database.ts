import sqlite3 from 'sqlite3';
import path from 'path';

// Simplified database interface for ingestion worker
export class Database {
  private db: sqlite3.Database;
  
  constructor(dbPath?: string) {
    const databasePath = dbPath || process.env.DATABASE_URL?.replace('file:', '') || '../backend/sqlite.db';
    const resolvedPath = path.resolve(databasePath);
    
    this.db = new sqlite3.Database(resolvedPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        throw err;
      }
      console.log(`Connected to SQLite database at ${resolvedPath}`);
    });
    
    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
  }

  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
