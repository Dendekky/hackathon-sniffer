import { Database, getDatabase } from '../db/connection';
import { 
  Hackathon, 
  CreateHackathon, 
  UpdateHackathon, 
  HackathonFilters, 
  HackathonRow,
  PaginatedResponse 
} from '../types/hackathon';
import { randomUUID } from 'crypto';

export class HackathonModel {
  private db: Database;

  constructor(db?: Database) {
    this.db = db || getDatabase();
  }

  async create(data: CreateHackathon): Promise<Hackathon> {
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

    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create hackathon');
    }

    return created;
  }

  async findById(id: string): Promise<Hackathon | null> {
    const row = await this.db.get<HackathonRow>(
      'SELECT * FROM hackathons WHERE id = ?',
      [id]
    );

    return row ? this.mapRowToHackathon(row) : null;
  }

  async findAll(filters: Partial<HackathonFilters> = {}): Promise<PaginatedResponse<Hackathon>> {
    const {
      page = 1,
      limit = 20,
      is_online,
      search,
      start_date_from,
      start_date_to,
      location,
      source
    } = filters;

    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    // Build WHERE conditions
    if (is_online !== undefined) {
      conditions.push('is_online = ?');
      params.push(is_online ? 1 : 0);
    }

    if (search) {
      conditions.push('(title LIKE ? OR description LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (start_date_from) {
      conditions.push('start_date >= ?');
      params.push(start_date_from);
    }

    if (start_date_to) {
      conditions.push('start_date <= ?');
      params.push(start_date_to);
    }

    if (location) {
      conditions.push('location LIKE ?');
      params.push(`%${location}%`);
    }

    if (source) {
      conditions.push('source = ?');
      params.push(source);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM hackathons ${whereClause}`;
    const countResult = await this.db.get<{ total: number }>(countQuery, params);
    const total = countResult?.total || 0;

    // Get paginated results
    const dataQuery = `
      SELECT * FROM hackathons 
      ${whereClause}
      ORDER BY start_date ASC, created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await this.db.all<HackathonRow>(dataQuery, [...params, limit, offset]);

    const data = rows.map(row => this.mapRowToHackathon(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  async update(id: string, data: UpdateHackathon): Promise<Hackathon | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

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
      return existing; // No changes to make
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await this.db.run(
      `UPDATE hackathons SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM hackathons WHERE id = ?', [id]);
    return (result.changes || 0) > 0;
  }

  async findByUrl(url: string): Promise<Hackathon | null> {
    const row = await this.db.get<HackathonRow>(
      'SELECT * FROM hackathons WHERE website_url = ? OR registration_url = ?',
      [url, url]
    );

    return row ? this.mapRowToHackathon(row) : null;
  }

  async findUpcoming(limit: number = 50): Promise<Hackathon[]> {
    const now = new Date().toISOString();
    const rows = await this.db.all<HackathonRow>(
      'SELECT * FROM hackathons WHERE start_date > ? ORDER BY start_date ASC LIMIT ?',
      [now, limit]
    );

    return rows.map(row => this.mapRowToHackathon(row));
  }

  async countBySource(): Promise<Record<string, number>> {
    const rows = await this.db.all<{ source: string; count: number }>(
      'SELECT source, COUNT(*) as count FROM hackathons GROUP BY source'
    );

    return rows.reduce((acc, row) => {
      acc[row.source] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }

  private mapRowToHackathon(row: HackathonRow): Hackathon {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      start_date: row.start_date,
      end_date: row.end_date,
      registration_deadline: row.registration_deadline || undefined,
      location: row.location,
      is_online: Boolean(row.is_online),
      website_url: row.website_url || undefined,
      registration_url: row.registration_url || undefined,
      source: row.source as 'devpost' | 'mlh' | 'eventbrite',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
