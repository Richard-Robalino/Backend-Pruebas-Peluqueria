import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import routerV1 from './routes.js';

const app = express();

// Security & parsing
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(hpp());
app.use(mongoSanitize());

// CORS
const origins = env.CLIENT_ORIGINS.split(',').map(o => o.trim());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (origins.indexOf(origin) !== -1) callback(null, true);
    else callback(new Error('CORS not allowed'));
  },
  credentials: true
}));

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// Versioned routes
app.use('/api/v1', routerV1);

// 404 & error
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
