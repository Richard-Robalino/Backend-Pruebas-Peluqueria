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

// Seguridad & parsing
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(hpp());
app.use(mongoSanitize());

// CORS — compatible con Render
const allowedOrigins = [
  ...env.CLIENT_ORIGINS.split(',').map(o => o.trim()),
  'https://lina-salon-frontend.onrender.com', // poner tu URL real
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Postman, móviles, etc.
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS not allowed: ' + origin));
  },
  credentials: true
}));

// Logs
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting
app.use('/api', rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false
}));

// Routes
app.use('/api/v1', routerV1);

// 404 & manejador errores
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
