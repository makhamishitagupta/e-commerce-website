import { Router } from 'express';
import { requireAuth, requireCustomer } from '../middleware/auth.js';
import {
  getPaymentConfig,
  createOrderPayment,
  verifyPaymentAndCreateOrder,
  handleRazorpayWebhook,
} from '../controllers/paymentController.js';

const router = Router();

router.get('/config', getPaymentConfig);
router.post('/webhook', handleRazorpayWebhook);

// Protected payment endpoints
router.use(requireAuth, requireCustomer);
router.post('/create-order', createOrderPayment);
router.post('/verify', verifyPaymentAndCreateOrder);

export default router;
