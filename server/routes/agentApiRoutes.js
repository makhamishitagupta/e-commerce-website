import { Router } from 'express';
import { requireAgentAuth, requireAgentScope } from '../middleware/agentAuth.js';
import {
  searchCatalog,
  getProductDetails,
  checkAvailability,
  getActiveOffers,
  createCart,
  getCart,
  addItemToCart,
  applyBundleToCart,
  initiateCheckout,
  verifyCheckoutPayment,
  getOpenApiSpec,
  getToolsDefinition,
} from '../controllers/agentApiController.js';

const router = Router();

// Machine-readable tool specifications (publicly discoverable by agents)
router.get('/openapi.json', getOpenApiSpec);
router.get('/tools', getToolsDefinition);

// Customer payment verification endpoint for completing agentic checkout
router.post('/checkout/verify', verifyCheckoutPayment);

// Authenticated Agent commerce actions
router.use(requireAgentAuth);

router.get('/catalog', requireAgentScope('catalog:read'), searchCatalog);
router.get('/products', requireAgentScope('catalog:read'), searchCatalog);
router.get('/products/:idOrSlug', requireAgentScope('catalog:read'), getProductDetails);
router.post('/check-availability', requireAgentScope('catalog:read'), checkAvailability);
router.get('/offers', requireAgentScope('catalog:read'), getActiveOffers);

router.post('/cart', requireAgentScope('cart:write'), createCart);
router.get('/cart/:cartId', requireAgentScope('cart:write'), getCart);
router.post('/cart/:cartId/items', requireAgentScope('cart:write'), addItemToCart);
router.post('/cart/:cartId/apply-bundle', requireAgentScope('cart:write'), applyBundleToCart);

router.post('/checkout/initiate', requireAgentScope('checkout:write'), initiateCheckout);

export default router;
