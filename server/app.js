const express = require('express');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const rejectNullBytes = require('./middleware/rejectNullBytes');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const projectsRoutes = require('./routes/projects.routes');
const tasksRoutes = require('./routes/tasks.routes');
const commentsRoutes = require('./routes/comments.routes');

const app = express();

// The app runs behind one reverse proxy (Render or nginx): trust its
// X-Forwarded-* headers so req.ip and req.protocol describe the real client.
app.set('trust proxy', 1);
// Do not advertise the framework in response headers.
app.disable('x-powered-by');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api', rejectNullBytes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/comments', commentsRoutes);

// 404 for unhandled API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    details: [],
  });
});

// Serve frontend static files from public/
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir, { extensions: ['html'] }));

// Fallback to index.html for root or SPA non-file routes if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Global error handler
app.use(errorHandler);

module.exports = app;
