import { Database } from '../db/database';
import { NormalizedHackathon } from '../types/ingestion';
import { randomUUID } from 'crypto';

// Simplified hackathon model for ingestion worker
export class HackathonModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async create(data: NormalizedHackathon): Promise<string> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    await this.db.run(`
      INSERT INTO hackathons (
        id, title, description, start_date, end_date, registration_deadline,
        location, is_online, website_url, registration_url, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.title,
      data.description || null,
      data.start_date,
      data.end_date,
      data.registration_deadline || null,
      data.location,
      data.is_online ? 1 : 0,
      data.website_url || null,
      data.registration_url || null,
      data.source,
      now,
      now
    ]);

    return id;
  }

  async findByUrl(url: string): Promise<any | null> {
    const row = await this.db.get(
      'SELECT * FROM hackathons WHERE website_url = ? OR registration_url = ?',
      [url, url]
    );

    return row || null;
  }

  async update(id: string, data: Partial<NormalizedHackathon>): Promise<boolean> {
    const fields: string[] = [];
    const params: any[] = [];

    // Build dynamic UPDATE query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'is_online') {
          params.push(value ? 1 : 0);
        } else {
          params.push(value);
        }
      }
    });

    if (fields.length === 0) {
      return true; // No changes to make
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const result = await this.db.run(
      `UPDATE hackathons SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    return (result.changes || 0) > 0;
  }

  async findUpcoming(limit: number = 50): Promise<any[]> {
    const now = new Date().toISOString();
    const rows = await this.db.all(
      'SELECT * FROM hackathons WHERE start_date > ? ORDER BY start_date ASC LIMIT ?',
      [now, limit]
    );

    return rows;
  }
}
