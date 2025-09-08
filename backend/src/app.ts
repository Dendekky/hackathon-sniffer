import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Routes
import healthRouter from './routes/health';
import hackathonsRouter from './routes/hackathons';

// Middleware
import { errorHandler, notFoundHandler } from './middleware/error';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Replace with actual frontend domain
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/health', healthRouter);
app.use('/api/hackathons', hackathonsRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Hackathon Sniffer API',
    version: '0.1.0',
    status: 'running',
    endpoints: {
      health: '/health',
      hackathons: '/api/hackathons',
    },
    documentation: 'See README.md for API documentation',
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
