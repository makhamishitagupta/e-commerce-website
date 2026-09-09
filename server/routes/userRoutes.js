import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getMe,
  updateMe,
  addAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/userController.js';

const router = Router();

router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, updateMe);
router.post('/me/addresses', requireAuth, addAddress);
router.put('/me/addresses/:addressId', requireAuth, updateAddress);
router.delete('/me/addresses/:addressId', requireAuth, deleteAddress);

export default router;
