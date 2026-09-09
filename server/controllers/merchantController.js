import Merchant from '../models/Merchant.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import BundleOffer from '../models/BundleOffer.js';
import AgentApiKey from '../models/AgentApiKey.js';
import { generateApiKey } from '../middleware/agentAuth.js';
import { analyzeTransactions } from '../services/transactionIntelligenceService.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { slugify } from '../utils/slugify.js';

/**
 * Helper to resolve the active merchant context.
 * - If user is Admin: can specify `?merchantId=...` to view a specific merchant,
 *   or falls back to their owned store / first active merchant.
 * - If user is Merchant: strictly scoped to their own store (`owner: req.user._id`).
 * - Otherwise: throws 403 Forbidden.
 */
const resolveMerchantForReq = async (req) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const isAdmin = req.user.role === 'admin';
  const isMerchant = req.user.role === 'merchant';

  if (!isAdmin && !isMerchant) {
    throw new ApiError(403, 'Merchant or Admin access required');
  }

  // Admin targeting a specific merchant
  const targetId = req.query?.merchantId || req.body?.merchantId;
  if (isAdmin && targetId) {
    const specific = await Merchant.findById(targetId);
    if (specific) return specific;
  }

  // If user owns a merchant store
  let merchant = await Merchant.findOne({ owner: req.user._id });
  if (merchant) return merchant;

  // Admin fallback: default to first active merchant if no owned store
  if (isAdmin) {
    merchant = await Merchant.findOne({ status: 'active' });
    if (merchant) return merchant;
  }

  return null;
};

/**
 * Admin only: list all registered merchants with basic stats for dropdown selection.
 */
export const getAllMerchants = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only administrators can list all merchants');
  }

  const merchants = await Merchant.find()
    .select('storeName slug description businessCategory status createdAt logo')
    .sort({ storeName: 1 });

  res.json(new ApiResponse(200, merchants));
});

export const onboardMerchant = asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') {
    throw new ApiError(403, 'Administrators cannot use customer merchant onboarding');
  }

  const { storeName, description, contactEmail, contactPhone, businessCategory } = req.body;

  if (!storeName?.trim()) {
    throw new ApiError(400, 'Store name is required');
  }

  const existingMerchant = await Merchant.findOne({ owner: req.user._id }).select('_id storeName');
  if (existingMerchant) {
    throw new ApiError(409, 'You already have a shop. Each account can own only one shop.');
  }

  let slug = slugify(storeName);
  const existingSlug = await Merchant.findOne({ slug });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  let merchant;
  try {
    merchant = await Merchant.create({
      owner: req.user._id,
      storeName,
      slug,
      description,
      contactEmail: contactEmail || req.user.email,
      contactPhone: contactPhone || req.user.phone,
      businessCategory: businessCategory || 'Fashion & Luxury',
      status: 'active',
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.owner) {
      throw new ApiError(409, 'You already have a shop. Each account can own only one shop.');
    }
    throw error;
  }

  // Update user role to merchant
  req.user.role = 'merchant';
  req.user.merchantId = merchant._id;
  await req.user.save();

  // Ensure products are linked to this merchant if none were assigned
  const unassignedCount = await Product.countDocuments({ merchant: { $exists: false } });
  if (unassignedCount > 0) {
    await Product.updateMany({ merchant: { $exists: false } }, { $set: { merchant: merchant._id } });
  }

  // Auto-generate initial Agent API key if none exists
  const existingKey = await AgentApiKey.findOne({ merchant: merchant._id, isActive: true });
  let initialKey = null;

  if (!existingKey) {
    const { rawKey, keyPrefix, keyHash } = generateApiKey();
    await AgentApiKey.create({
      merchant: merchant._id,
      name: 'Default Agent Key',
      keyPrefix,
      keyHash,
      permissions: ['catalog:read', 'cart:write', 'checkout:write', 'analytics:read'],
      createdByUser: req.user._id,
    });
    initialKey = rawKey;
  }

  res.status(201).json(
    new ApiResponse(
      201,
      {
        merchant,
        apiKey: initialKey,
      },
      'Merchant onboarded successfully'
    )
  );
});

export const getMerchantProfile = asyncHandler(async (req, res) => {
  const merchant = await resolveMerchantForReq(req);
  if (!merchant) {
    throw new ApiError(404, 'No merchant profile found for this account');
  }

  res.json(new ApiResponse(200, merchant));
});

export const getMerchantDashboard = asyncHandler(async (req, res) => {
  const merchant = await resolveMerchantForReq(req);
  if (!merchant) {
    throw new ApiError(404, 'Merchant not found');
  }

  const merchantId = merchant._id;

  // Aggregate metrics for this specific merchant
  const [
    totalOrders,
    agentOrders,
    revenueAgg,
    agentRevenueAgg,
    totalProducts,
    activeBundles,
    recentOrders,
    lowStockProducts,
  ] = await Promise.all([
    Order.countDocuments({ merchant: merchantId }),
    Order.countDocuments({ merchant: merchantId, isAgentOrder: true }),
    Order.aggregate([
      { $match: { merchant: merchantId, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.aggregate([
      { $match: { merchant: merchantId, paymentStatus: 'paid', isAgentOrder: true } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Product.countDocuments({ merchant: merchantId, isActive: true }),
    BundleOffer.countDocuments({ merchant: merchantId, status: 'approved' }),
    Order.find({ merchant: merchantId })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('user', 'name email'),
    Product.find({ merchant: merchantId, stock: { $lte: 5 }, isActive: true })
      .select('name stock sku price')
      .limit(5),
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const agentRevenue = agentRevenueAgg[0]?.total || 0;

  res.json(
    new ApiResponse(200, {
      merchant,
      metrics: {
        totalRevenue,
        totalOrders,
        agentRevenue,
        agentOrders,
        agentOrderShare: totalOrders > 0 ? Math.round((agentOrders / totalOrders) * 100) : 0,
        totalProducts,
        activeBundles,
      },
      recentOrders,
      lowStockProducts,
    })
  );
});

export const runIntelligenceAnalysis = asyncHandler(async (req, res) => {
  const merchant = await resolveMerchantForReq(req);
  if (!merchant) {
    throw new ApiError(404, 'Merchant not found');
  }

  const analysis = await analyzeTransactions(merchant._id);
  res.json(new ApiResponse(200, analysis, 'Transaction intelligence analysis complete'));
});

export const getMerchantBundles = asyncHandler(async (req, res) => {
  const merchant = await resolveMerchantForReq(req);
  if (!merchant) {
    throw new ApiError(404, 'Merchant not found');
  }

  const bundles = await BundleOffer.find({ merchant: merchant._id })
    .populate({
      path: 'products.product',
      select: 'name price discountPrice images stock sku',
    })
    .sort({ createdAt: -1 });

  res.json(new ApiResponse(200, bundles));
});

export const updateBundleStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, discountPercentage, bundlePrice } = req.body;

  const bundle = await BundleOffer.findById(id);
  if (!bundle) throw new ApiError(404, 'Bundle offer not found');

  // Verify ownership unless user is Admin
  if (req.user.role !== 'admin') {
    const merchant = await Merchant.findOne({ owner: req.user._id });
    if (!merchant || bundle.merchant.toString() !== merchant._id.toString()) {
      throw new ApiError(403, 'Not authorized to modify this bundle');
    }
  }

  if (status) bundle.status = status;
  if (status === 'approved') bundle.approvedAt = new Date();
  if (discountPercentage) bundle.discountPercentage = discountPercentage;
  if (bundlePrice) bundle.bundlePrice = bundlePrice;

  await bundle.save();
  res.json(new ApiResponse(200, bundle, `Bundle offer marked as ${bundle.status}`));
});

export const getMerchantApiKeys = asyncHandler(async (req, res) => {
  const merchant = await resolveMerchantForReq(req);
  if (!merchant) throw new ApiError(404, 'Merchant not found');

  const keys = await AgentApiKey.find({ merchant: merchant._id }).sort({ createdAt: -1 });
  res.json(new ApiResponse(200, keys));
});

export const createMerchantApiKey = asyncHandler(async (req, res) => {
  const { name = 'External AI Agent', permissions } = req.body;

  const merchant = await resolveMerchantForReq(req);
  if (!merchant) throw new ApiError(404, 'Merchant not found');

  const { rawKey, keyPrefix, keyHash } = generateApiKey();

  const keyDoc = await AgentApiKey.create({
    merchant: merchant._id,
    name,
    keyPrefix,
    keyHash,
    permissions: permissions || ['catalog:read', 'cart:write', 'checkout:write', 'analytics:read'],
    createdByUser: req.user._id,
  });

  res.status(201).json(
    new ApiResponse(
      201,
      {
        _id: keyDoc._id,
        name: keyDoc.name,
        keyPrefix: keyDoc.keyPrefix,
        permissions: keyDoc.permissions,
        apiKey: rawKey,
      },
      'Agent API key created successfully'
    )
  );
});

export const revokeMerchantApiKey = asyncHandler(async (req, res) => {
  const merchant = await resolveMerchantForReq(req);
  if (!merchant) throw new ApiError(404, 'Merchant not found');

  const key = await AgentApiKey.findOne({ _id: req.params.id, merchant: merchant._id });
  if (!key) throw new ApiError(404, 'API key not found for this merchant');

  key.isActive = false;
  await key.save();

  res.json(new ApiResponse(200, key, 'API key revoked'));
});

export const getMerchantOrders = asyncHandler(async (req, res) => {
  const merchant = await resolveMerchantForReq(req);
  if (!merchant) throw new ApiError(404, 'Merchant not found');

  const { source } = req.query;
  const filter = { merchant: merchant._id };
  if (source === 'agent') filter.isAgentOrder = true;
  if (source === 'web') filter.isAgentOrder = false;

  const orders = await Order.find(filter)
    .populate('user', 'name email')
    .sort({ createdAt: -1 });

  res.json(new ApiResponse(200, orders));
});
