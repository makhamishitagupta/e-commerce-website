import { Router } from 'express';
import { requireAuth, requireCustomer, requireAdmin, requireAdminOrMerchant } from '../middleware/auth.js';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireCustomer, getMyOrders); // my orders
router.get('/admin/all', requireAdmin, getAllOrders);
router.get('/:id', getOrderById); // order details
router.post('/', requireCustomer, createOrder); // place order (COD)
router.put('/:id/status', requireAdminOrMerchant, updateOrderStatus);

export default router;
