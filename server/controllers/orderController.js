import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Merchant from '../models/Merchant.js';
import { resolveSingleActiveMerchant } from '../utils/resolveMerchantForOrder.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const FREE_SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 99;

export const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress } = req.body;
  if (!items?.length) throw new ApiError(400, 'Cart is empty');
  if (!shippingAddress) throw new ApiError(400, 'shippingAddress is required');

  const products = await Product.find({
    _id: { $in: items.map((i) => i.productId) },
    isActive: true,
  });

  if (products.length !== items.length) {
    throw new ApiError(400, 'One or more items are no longer available');
  }

  const merchant = await resolveSingleActiveMerchant(products);

  const orderItems = items.map(({ productId, quantity }) => {
    const product = products.find((p) => p._id.toString() === productId);
    if (!product) throw new ApiError(404, `Product ${productId} not found`);
    if (product.stock < quantity) throw new ApiError(400, `${product.name} is out of stock`);

    return {
      product: product._id,
      name: product.name,
      image: product.images?.[0]?.url,
      price: product.discountPrice || product.price,
      quantity,
    };
  });

  const itemsPrice = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shippingPrice = itemsPrice >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  const order = await Order.create({
    user: req.user._id,
    merchant: merchant._id,
    items: orderItems,
    shippingAddress,
    itemsPrice,
    shippingPrice,
    totalAmount: itemsPrice + shippingPrice,
    statusHistory: [{ status: 'pending' }],
  });

  await Promise.all(
    orderItems.map((i) =>
      Product.findByIdAndUpdate(i.product, {
        $inc: { stock: -i.quantity, soldCount: i.quantity },
      })
    )
  );

  await Merchant.findByIdAndUpdate(merchant._id, { $inc: { 'metrics.totalOrders': 1 } });

  res.status(201).json(new ApiResponse(201, order, 'Order placed'));
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(new ApiResponse(200, orders));
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) throw new ApiError(404, 'Order not found');
  const isOwner = order.user?._id?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  const isStoreMerchant = req.user.role === 'merchant' && order.merchant && req.user.merchantId && order.merchant.toString() === req.user.merchantId.toString();

  if (!isOwner && !isAdmin && !isStoreMerchant) {
    throw new ApiError(403, 'Not authorized to view this order');
  }
  res.json(new ApiResponse(200, order));
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).populate('user', 'name email');
  res.json(new ApiResponse(200, orders));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  if (req.user.role === 'merchant' && (!req.user.merchantId || !order.merchant || order.merchant.toString() !== req.user.merchantId.toString())) {
    throw new ApiError(403, 'You can only update orders for your own store');
  }

  const previousStatus = order.orderStatus;
  const wasPaid = order.paymentStatus === 'paid';

  order.orderStatus = status;
  order.statusHistory.push({ status });
  if (status === 'delivered') {
    order.deliveredAt = new Date();
    order.paymentStatus = 'paid';
    if (!wasPaid && order.merchant) {
      await Merchant.findByIdAndUpdate(order.merchant, {
        $inc: { 'metrics.totalRevenue': order.totalAmount },
      });
    }
  }
  if (status === 'cancelled' && previousStatus !== 'cancelled') {
    order.cancelledAt = new Date();
    await Promise.all(
      order.items.map((i) =>
        Product.findByIdAndUpdate(i.product, {
          $inc: { stock: i.quantity, soldCount: -i.quantity },
        })
      )
    );
  }

  await order.save();
  res.json(new ApiResponse(200, order, 'Order status updated'));
});
