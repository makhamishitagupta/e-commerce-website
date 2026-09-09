import Product from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const populateWishlist = (user) => user.populate({ path: 'wishlist', match: { isActive: true } });

export const getMyWishlist = asyncHandler(async (req, res) => {
  const user = await populateWishlist(req.user);
  res.json(new ApiResponse(200, user.wishlist.filter(Boolean), 'Wishlist loaded'));
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.productId, isActive: true });
  if (!product) throw new ApiError(404, 'Product not found');

  if (!req.user.wishlist.some((id) => id.toString() === product._id.toString())) {
    req.user.wishlist.push(product._id);
    await req.user.save();
  }

  const user = await populateWishlist(req.user);
  res.status(201).json(new ApiResponse(201, user.wishlist.filter(Boolean), 'Product added to wishlist'));
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const productId = req.params.productId;
  req.user.wishlist = req.user.wishlist.filter((id) => id.toString() !== productId);
  await req.user.save();

  const user = await populateWishlist(req.user);
  res.json(new ApiResponse(200, user.wishlist.filter(Boolean), 'Product removed from wishlist'));
});