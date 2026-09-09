import { Router } from 'express';
import { requireAuth, requireCustomer } from '../middleware/auth.js';
import { getMyWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlistController.js';

const router = Router();
router.use(requireAuth, requireCustomer);
router.get('/', getMyWishlist);
router.post('/:productId', addToWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;
