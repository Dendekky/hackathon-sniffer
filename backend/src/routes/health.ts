import { Router } from 'express';
import { getDatabase } from '../db/connection';

const router = Router();

// GET /health - Health check endpoint
router.get('/', async (_req, res) => {
  try {
    const db = getDatabase();
    
    // Test database connection
    await db.get('SELECT 1 as test');
    
    // Get basic stats
    const hackathonCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM hackathons'
    );
    
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime)}s`,
      database: 'connected',
      stats: {
        hackathons: hackathonCount?.count || 0,
      },
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

export default router;
