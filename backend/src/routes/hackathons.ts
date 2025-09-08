import { Router } from 'express';
import { z } from 'zod';
import { HackathonModel } from '../models/hackathon';
import { 
  CreateHackathonSchema, 
  UpdateHackathonSchema, 
  HackathonFiltersSchema 
} from '../types/hackathon';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import { createError } from '../middleware/error';

const router = Router();
const hackathonModel = new HackathonModel();

// Parameter validation schema
const IdParamsSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/hackathons - List hackathons with filters and pagination
router.get('/', validateQuery(HackathonFiltersSchema), async (req, res, next) => {
  try {
    const filters = req.query as any; // Already validated by middleware
    const result = await hackathonModel.findAll(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/hackathons/upcoming - Get upcoming hackathons
router.get('/upcoming', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const hackathons = await hackathonModel.findUpcoming(limit);
    res.json({ data: hackathons });
  } catch (error) {
    next(error);
  }
});

// GET /api/hackathons/stats - Get statistics
router.get('/stats', async (_req, res, next) => {
  try {
    const countBySource = await hackathonModel.countBySource();
    res.json({
      countBySource,
      totalSources: Object.keys(countBySource).length,
      totalHackathons: Object.values(countBySource).reduce((sum, count) => sum + count, 0),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/hackathons/:id - Get hackathon by ID
router.get('/:id', validateParams(IdParamsSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const hackathon = await hackathonModel.findById(id);
    
    if (!hackathon) {
      throw createError('Hackathon not found', 404);
    }
    
    res.json(hackathon);
  } catch (error) {
    next(error);
  }
});

// POST /api/hackathons - Create new hackathon
router.post('/', validateBody(CreateHackathonSchema), async (req, res, next) => {
  try {
    const hackathon = await hackathonModel.create(req.body);
    res.status(201).json(hackathon);
  } catch (error) {
    next(error);
  }
});

// PUT /api/hackathons/:id - Update hackathon
router.put('/:id', 
  validateParams(IdParamsSchema),
  validateBody(UpdateHackathonSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const hackathon = await hackathonModel.update(id, req.body);
      
      if (!hackathon) {
        throw createError('Hackathon not found', 404);
      }
      
      res.json(hackathon);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/hackathons/:id - Delete hackathon
router.delete('/:id', validateParams(IdParamsSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await hackathonModel.delete(id);
    
    if (!deleted) {
      throw createError('Hackathon not found', 404);
    }
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
