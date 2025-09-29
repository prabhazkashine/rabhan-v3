import { Router } from 'express';
import { categoryRoutes } from './category.routes';

const router = Router();

const API_VERSION = '/api';

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Marketplace Service API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'marketplace-service'
  });
});

router.use(`${API_VERSION}/product-categories`, categoryRoutes);

router.get('/api-info', (req, res) => {
  res.json({
    success: true,
    message: 'Marketplace Service API Information',
    version: '1.0.0',
    service: 'marketplace-service',
    endpoints: {
      categories: {
        public: [
          'GET /api/v1/categories/public - List active categories (public)',
          'GET /api/v1/categories/public/slug/:slug - Get category by slug (public)'
        ],
        authenticated: [
          'GET /api/v1/categories - List categories (paginated)',
          'GET /api/v1/categories/:id - Get category by ID',
          'GET /api/v1/categories/slug/:slug - Get category by slug',
          'POST /api/v1/categories - Create category (admin/contractor)',
          'PUT /api/v1/categories/:id - Update category (admin/contractor)',
          'DELETE /api/v1/categories/:id - Delete category (admin only)'
        ]
      },
      system: [
        'GET /health - Health check',
        'GET /api-info - API information'
      ]
    },
    authentication: {
      type: 'Bearer Token (JWT)',
      header: 'Authorization: Bearer <token>',
      userTypes: ['user', 'contractor', 'admin', 'super_admin']
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

export { router as routes };