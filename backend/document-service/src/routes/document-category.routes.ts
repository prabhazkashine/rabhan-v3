import { Router } from 'express';
import { DocumentCategoryController } from '../controllers/document-category.controller';

const router = Router();
const categoryController = new DocumentCategoryController();

router.post('/seed', categoryController.seedCategories.bind(categoryController));

router.post('/', categoryController.createMultipleCategories.bind(categoryController));

router.get('/', categoryController.getAllCategories.bind(categoryController));

router.get('/:id', categoryController.getCategoryById.bind(categoryController));

export default router;