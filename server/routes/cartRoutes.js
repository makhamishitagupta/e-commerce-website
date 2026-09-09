import { Router } from 'express';
import { requireAuth, requireCustomer } from '../middleware/auth.js';
import {
	getMyCart,
	addToCart,
	updateCartItem,
	removeCartItem,
} from '../controllers/cartController.js';

const router = Router();
router.use(requireAuth, requireCustomer);
router.get('/', getMyCart);
router.post('/', addToCart);
router.put('/:itemId', updateCartItem);
router.delete('/:itemId', removeCartItem);

export default router;
