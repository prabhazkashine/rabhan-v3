import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';

const router = Router();

router.get('/public', categoryController.getCategoriesPublic);
router.get('/public/slug/:slug', categoryController.getCategoryBySlug);

router.get('/', categoryController.getCategories);

router.get('/:id', categoryController.getCategoryById);

router.get('/slug/:slug', categoryController.getCategoryBySlug);

router.post('/',
  categoryController.createCategory
);

router.put('/:id',
  categoryController.updateCategory
);

router.delete('/:id',
  categoryController.deleteCategory
);

export { router as categoryRoutes };