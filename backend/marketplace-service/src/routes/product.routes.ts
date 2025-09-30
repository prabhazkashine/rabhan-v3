import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.middleware';
import { upload } from '../utils/upload';
import { parseFormData } from '../middleware/form-data.middleware';

const router = Router();

router.get('/public', productController.getProductsPublic);
router.get('/public/slug/:slug', productController.getProductBySlug);

// Stats endpoints - MUST come before /:id routes
router.get('/stats',
  productController.getProductStats
);

router.get('/stats/pending',
  productController.getPendingProductStats
);

// Admin-only endpoints
router.get('/admin/all',
  productController.getAllProductsForAdmin
);

router.get('/admin/pending',
  productController.getPendingProducts
);

router.post('/admin/restore/:id',
  productController.restoreDeletedProduct
);

// Specific slug route - MUST come before /:id route
router.get('/slug/:slug',
  productController.getProductBySlug
);

router.get('/',
  productController.getProducts
);

// Generic ID route - MUST come after specific routes
router.get('/:id',
  productController.getProductById
);

router.post('/',
  upload.array('images', 10),
  parseFormData,
  productController.createProduct
);

router.put('/:id',
  upload.array('images', 10),
  parseFormData,
  productController.updateProduct
);

router.delete('/:id',
  productController.deleteProduct
);

router.post('/:id/approve',
  productController.approveProduct
);

router.delete('/admin/delete/:id',
  authenticateToken,
  requireRole('admin', 'super_admin'),
  productController.hardDeleteProduct
);

router.post('/admin/bulk-action',
  authenticateToken,
  requireRole('admin', 'super_admin'),
  async (req, res, next) => {
    try {
      res.status(501).json({
        success: false,
        message: 'Bulk operations not yet implemented',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as productRoutes };