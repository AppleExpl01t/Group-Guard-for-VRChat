import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

// ---------------------------------------------------------------------------
// Fail-fast: importing the auth service triggers key loading at module scope.
// If the keys are missing or empty the import itself will throw, preventing
// the server from starting in a state where JWT signing/verification is broken.
// ---------------------------------------------------------------------------
import './modules/auth/service';

// Import module routes
import authRoutes from './modules/auth/routes';
import backupRoutes from './modules/backup/routes';

const app = express();

// Security middleware
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
if (allowedOrigins.length === 0 && config.nodeEnv === 'production') {
  console.warn(
    '⚠️  ALLOWED_ORIGINS is not set. All cross-origin requests will be rejected. ' +
    'Set ALLOWED_ORIGINS to a comma-separated list of allowed origins.',
  );
}
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
}));

// Rate limiting
app.use(rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (v1)
app.use('/api/v1', authRoutes);
app.use('/api/v1', backupRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`🚀 GroupGuard Backend running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
});

export default app;
