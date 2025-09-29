import { Router } from 'express';
import { categoryRoutes } from './category.routes';
import { productRoutes } from './product.routes';

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
router.use(`${API_VERSION}/products`, productRoutes);

router.get('/api-info', (req, res) => {
  res.json({
    success: true,
    message: 'Marketplace Service API Information',
    version: '1.0.0',
    service: 'marketplace-service',
    endpoints: {
      categories: {
        public: [
          'GET /api/product-categories/public - List active categories (public)',
          'GET /api/product-categories/public/slug/:slug - Get category by slug (public)'
        ],
        authenticated: [
          'GET /api/product-categories - List categories (paginated)',
          'GET /api/product-categories/:id - Get category by ID',
          'GET /api/product-categories/slug/:slug - Get category by slug',
          'POST /api/product-categories - Create category (admin/contractor)',
          'PUT /api/product-categories/:id - Update category (admin/contractor)',
          'DELETE /api/product-categories/:id - Delete category (admin only)'
        ]
      },
      products: {
        public: [
          'GET /api/products/public - List active products (public)',
          'GET /api/products/public/slug/:slug - Get product by slug (public)'
        ],
        authenticated: [
          'GET /api/products - List products (paginated)',
          'GET /api/products/:id - Get product by ID',
          'GET /api/products/slug/:slug - Get product by slug',
          'POST /api/products - Create product (contractor/admin)',
          'PUT /api/products/:id - Update product (contractor/admin)',
          'DELETE /api/products/:id - Delete product (contractor/admin)'
        ],
        admin: [
          'GET /api/products/admin/pending - List pending products (admin only)',
          'POST /api/products/:id/approve - Approve/reject product (admin only)',
          'POST /api/products/admin/bulk-action - Bulk operations (admin only)'
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