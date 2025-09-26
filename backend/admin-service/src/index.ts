import 'dotenv/config';
import express from 'express';
import { authRoutes } from './routes/auth.routes';
import { adminRoutes } from './routes/admin.routes';
import { roleRoutes } from './routes/role.routes';
import { permissionRoutes } from './routes/permission.routes';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT || 3003;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Admin Service API is running',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);

app.listen(port, () => {
  logger.info(`Admin service is running on http://localhost:${port}`);
});