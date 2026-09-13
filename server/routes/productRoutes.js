import { Router } from 'express';
import { attachUserIfPresent, requireAuth, requireAdminOrMerchant } from '../middleware/auth.js';
import {
  getProducts,
  searchProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustProductStock,
} from '../controllers/productController.js';

const router = Router();

router.get('/', attachUserIfPresent, getProducts); // list with pagination/filter/sort
router.get('/search', searchProducts); // live search suggestions
router.get('/:slug', getProductBySlug); // product details
router.post('/', requireAuth, requireAdminOrMerchant, createProduct);
router.put('/:id', requireAuth, requireAdminOrMerchant, updateProduct);
router.patch('/:id/stock', requireAuth, requireAdminOrMerchant, adjustProductStock);
router.delete('/:id', requireAuth, requireAdminOrMerchant, deleteProduct);

export default router;
