import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/public', productController.getProductsPublic);
router.get('/public/slug/:slug', productController.getProductBySlug);


router.get('/',
  productController.getProducts
);

router.get('/:id',
  productController.getProductById
);

router.get('/slug/:slug',
  productController.getProductBySlug
);

router.post('/',
  productController.createProduct
);

router.put('/:id',
  productController.updateProduct
);

router.delete('/:id',
  productController.deleteProduct
);

// Admin-only endpoints

router.get('/admin/pending',
  productController.getPendingProducts
);

router.post('/:id/approve',
  productController.approveProduct
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