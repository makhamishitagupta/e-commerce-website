import Product from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const getCart = (user) => user.populate({ path: 'cart.product', match: { isActive: true } });

export const getMyCart = asyncHandler(async (req, res) => {
  const user = await getCart(req.user);
  const validItems = user.cart.filter((item) => item.product);
  // Clean up any deleted/inactive product references from database if found
  if (validItems.length !== user.cart.length) {
    req.user.cart = validItems;
    await req.user.save();
  }
  res.json(new ApiResponse(200, validItems, 'Cart loaded'));
});

export const clearCart = asyncHandler(async (req, res) => {
  req.user.cart = [];
  await req.user.save();
  res.json(new ApiResponse(200, [], 'Cart cleared'));
});

export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
    throw new ApiError(400, 'productId and a positive integer quantity are required');
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.stock < Number(quantity)) throw new ApiError(400, `${product.name} has insufficient stock`);

  if (req.user.cart.length > 0 && product.merchant) {
    const existingProducts = await Product.find({
      _id: { $in: req.user.cart.map((item) => item.product) },
    }).select('merchant');
    const cartMerchants = [
      ...new Set(existingProducts.map((p) => p.merchant?.toString()).filter(Boolean)),
    ];
    if (cartMerchants.some((id) => id !== product.merchant.toString())) {
      throw new ApiError(400, 'Your bag can only contain items from one boutique. Remove other items first.');
    }
  }

  const existing = req.user.cart.find((item) => item.product.toString() === product._id.toString());
  if (existing) {
    if (product.stock < existing.quantity + Number(quantity)) {
      throw new ApiError(400, `${product.name} has insufficient stock for that quantity`);
    }
    existing.quantity += Number(quantity);
    existing.savedForLater = false;
  } else {
    req.user.cart.push({ product: product._id, quantity: Number(quantity), savedForLater: false });
  }

  await req.user.save();
  const user = await getCart(req.user);
  res.status(201).json(new ApiResponse(201, user.cart.filter((item) => item.product), 'Item added to cart'));
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const item = req.user.cart.id(req.params.itemId);
  if (!item) throw new ApiError(404, 'Cart item not found');

  if (req.body.quantity !== undefined) {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw new ApiError(400, 'Quantity must be a positive integer');
    const product = await Product.findOne({ _id: item.product, isActive: true });
    if (!product || product.stock < quantity) throw new ApiError(400, 'Requested quantity is unavailable');
    item.quantity = quantity;
  }
  if (req.body.savedForLater !== undefined) item.savedForLater = Boolean(req.body.savedForLater);

  await req.user.save();
  const user = await getCart(req.user);
  res.json(new ApiResponse(200, user.cart.filter((cartItem) => cartItem.product), 'Cart updated'));
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const item = req.user.cart.id(req.params.itemId);
  if (!item) throw new ApiError(404, 'Cart item not found');

  req.user.cart.pull(item._id);
  await req.user.save();
  const user = await getCart(req.user);
  res.json(new ApiResponse(200, user.cart.filter((cartItem) => cartItem.product), 'Item removed from cart'));
});