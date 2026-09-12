import Product from '../models/Product.js';
import Merchant from '../models/Merchant.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { slugify } from '../utils/slugify.js';

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  popular: { soldCount: -1 },
  rating: { 'ratings.average': -1 },
};

export const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    brand,
    minPrice,
    maxPrice,
    search,
    featured,
    trending,
    merchant,
    includeInactive,
    sort = 'newest',
  } = req.query;

  const filter = {};
  const canViewInactive =
    includeInactive === 'true' && (req.user?.role === 'admin' || req.user?.role === 'merchant');
  if (!canViewInactive) filter.isActive = true;

  if (req.user?.role === 'merchant') {
    const owned = await Merchant.findOne({ owner: req.user._id }).select('_id');
    if (owned) filter.merchant = owned._id;
  } else if (merchant) {
    filter.merchant = merchant;
  }
  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  if (featured) filter.featured = featured === 'true';
  if (trending) filter.trending = trending === 'true';
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (search && String(search).trim()) {
    const term = String(search).trim();
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escapedTerm, $options: 'i' } },
      { description: { $regex: escapedTerm, $options: 'i' } },
      { sku: { $regex: escapedTerm, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .sort(SORT_OPTIONS[sort] || SORT_OPTIONS.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.json(
    new ApiResponse(200, {
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  );
});

export const searchProducts = asyncHandler(async (req, res) => {
  const { q = '' } = req.query;
  const term = String(q).trim();
  if (!term) return res.json(new ApiResponse(200, []));

  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const products = await Product.find({
    isActive: true,
    $or: [
      { name: { $regex: escapedTerm, $options: 'i' } },
      { description: { $regex: escapedTerm, $options: 'i' } },
    ],
  })
    .select('name slug images price discountPrice')
    .limit(8);

  res.json(new ApiResponse(200, products));
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('category', 'name slug')
    .populate('brand', 'name slug')
    .populate({ path: 'reviews', populate: { path: 'user', select: 'name avatar' } });

  if (!product) throw new ApiError(404, 'Product not found');

  res.json(new ApiResponse(200, product));
});

export const createProduct = asyncHandler(async (req, res) => {
  const { name, sku, ...rest } = req.body;
  if (!name) throw new ApiError(400, 'name is required');
  if (!sku) throw new ApiError(400, 'sku is required');

  let merchantId = req.body.merchant;
  if (req.user?.role === 'merchant') {
    const m = await Merchant.findOne({ owner: req.user._id });
    if (!m) throw new ApiError(403, 'Merchant store is not configured');
    merchantId = m._id;
  } else if (req.user?.role === 'admin') {
    if (!merchantId) throw new ApiError(400, 'merchant is required for admin-created products');
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new ApiError(404, 'Merchant not found');
  } else {
    throw new ApiError(403, 'Merchant or Admin access required');
  }

  let categoryId = rest.category;
  if (!categoryId) {
    const defaultCat = await Category.findOne();
    if (defaultCat) categoryId = defaultCat._id;
  }

  let brandId = rest.brand;
  if (!brandId) {
    const defaultBrand = await Brand.findOne();
    if (defaultBrand) brandId = defaultBrand._id;
  }

  let images = rest.images;
  if (!images || !Array.isArray(images) || images.length === 0) {
    images = [
      {
        url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&h=1000&fit=crop',
        publicId: 'default_product_img',
      },
    ];
  }

  const product = await Product.create({
    ...rest,
    category: categoryId,
    brand: brandId,
    images,
    name,
    sku,
    slug: slugify(name),
    merchant: merchantId,
  });

  res.status(201).json(new ApiResponse(201, product, 'Product created'));
});

export const updateProduct = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  if (update.name) update.slug = slugify(update.name);

  if (req.user?.role === 'merchant') {
    const m = await Merchant.findOne({ owner: req.user._id });
    const existing = await Product.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'Product not found');
    if (!m || !existing.merchant || existing.merchant.toString() !== m._id.toString()) {
      throw new ApiError(403, 'You can only update your own products');
    }
  }

  const product = await Product.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new ApiError(404, 'Product not found');

  res.json(new ApiResponse(200, product, 'Product updated'));
});

export const deleteProduct = asyncHandler(async (req, res) => {
  if (req.user?.role === 'merchant') {
    const m = await Merchant.findOne({ owner: req.user._id });
    const existing = await Product.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'Product not found');
    if (!m || !existing.merchant || existing.merchant.toString() !== m._id.toString()) {
      throw new ApiError(403, 'You can only delete your own products');
    }
  }

  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json(new ApiResponse(200, null, 'Product deleted'));
});
