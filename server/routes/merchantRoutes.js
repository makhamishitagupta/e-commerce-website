import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  onboardMerchant,
  getMerchantProfile,
  getMerchantDashboard,
  runIntelligenceAnalysis,
  getMerchantBundles,
  updateBundleStatus,
  getMerchantApiKeys,
  createMerchantApiKey,
  revokeMerchantApiKey,
  getMerchantOrders,
  getAllMerchants,
} from '../controllers/merchantController.js';

const router = Router();

router.use(requireAuth);

router.get('/all', getAllMerchants);
router.post('/onboard', onboardMerchant);
router.get('/me', getMerchantProfile);
router.get('/dashboard', getMerchantDashboard);
router.post('/intelligence/analyze', runIntelligenceAnalysis);
router.get('/bundles', getMerchantBundles);
router.put('/bundles/:id', updateBundleStatus);
router.get('/keys', getMerchantApiKeys);
router.post('/keys', createMerchantApiKey);
router.delete('/keys/:id', revokeMerchantApiKey);
router.get('/orders', getMerchantOrders);

export default router;
