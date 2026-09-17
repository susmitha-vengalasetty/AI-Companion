import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import spaceRoutes from './routes/spaceRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import homeRoutes from './routes/homeRoutes.js';
import materialRoutes from './routes/materialRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import tutorRoutes from './routes/tutorRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import growthRoutes from './routes/growthRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'AI Study Companion API',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/tutor', tutorRoutes);
app.use('/api/projects/:projectId/quiz', quizRoutes);
app.use('/api/projects/:projectId/growth', growthRoutes);
app.use('/api/home', homeRoutes);
app.use('/api', materialRoutes);
app.use('/api', searchRoutes);

// 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect Database & Start Server
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`[Express] AI Study Companion Server running on port ${PORT} (${process.env.NODE_ENV || 'development'} mode)`);
      console.log('[Startup] No background jobs, embedding pipelines, or reindex operations run automatically.');
      console.log('[Startup] Embedding only runs when a material is uploaded (POST /materials) or retried (POST /materials/:id/retry).');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[Port Error] Port ${PORT} is already in use by another running Node process.`);
        console.error(`[Port Error] Stop the existing backend server on port ${PORT} or configure PORT in backend/.env.\n`);
        process.exit(1);
      } else {
        console.error(`[Server Error] ${err.message}`);
        process.exit(1);
      }
    });
  } catch (dbError) {
    console.error(`[Server Startup Aborted] Express server stopped because MongoDB Atlas connection failed.`);
    process.exit(1);
  }
};

startServer();
