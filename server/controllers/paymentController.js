import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Merchant from '../models/Merchant.js';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyRazorpayWebhookSignature,
} from '../config/razorpay.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const FREE_SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 99;

export const getPaymentConfig = (req, res) => {
  res.json(
    new ApiResponse(200, {
      keyId: getRazorpayKeyId(),
      isConfigured: isRazorpayConfigured(),
      currency: 'INR',
    })
  );
};

export const createOrderPayment = asyncHandler(async (req, res) => {
  const { items, shippingAddress } = req.body;
  if (!items?.length) throw new ApiError(400, 'Cart is empty');

  const products = await Product.find({
    _id: { $in: items.map((i) => i.productId) },
    isActive: true,
  });

  const merchantIds = [...new Set(products.map((product) => product.merchant?.toString()).filter(Boolean))];
  if (merchantIds.length !== 1 || products.length !== items.length) {
    throw new ApiError(400, 'All order items must belong to one active merchant');
  }
  const merchant = await Merchant.findOne({ _id: merchantIds[0], status: 'active' });
  if (!merchant) throw new ApiError(400, 'Merchant store is inactive or missing');

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
  const totalAmount = itemsPrice + shippingPrice;

  // Create Razorpay order
  const razorpayOrder = await createRazorpayOrder({
    amount: totalAmount,
    currency: 'INR',
    receipt: `rcpt_web_${Date.now()}`,
  });

  res.status(201).json(
    new ApiResponse(201, {
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: getRazorpayKeyId(),
      isConfigured: isRazorpayConfigured(),
      itemsPrice,
      shippingPrice,
      totalAmount,
    })
  );
});

export const verifyPaymentAndCreateOrder = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    items,
    shippingAddress,
  } = req.body;

  if (!items?.length) throw new ApiError(400, 'Cart is empty');
  if (!shippingAddress) throw new ApiError(400, 'shippingAddress is required');

  // Verify HMAC-SHA256 signature
  const isValid = verifyRazorpaySignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    throw new ApiError(400, 'Payment verification failed. Invalid signature.');
  }

  const existingOrder = await Order.findOne({ razorpayOrderId: razorpay_order_id });
  if (existingOrder) {
    return res.json(new ApiResponse(200, existingOrder, 'Payment already verified and order already exists'));
  }

  const products = await Product.find({
    _id: { $in: items.map((i) => i.productId) },
    isActive: true,
  });

  const merchantIds = [...new Set(products.map((product) => product.merchant?.toString()).filter(Boolean))];
  if (merchantIds.length !== 1 || products.length !== items.length) {
    throw new ApiError(400, 'All order items must belong to one active merchant');
  }
  const merchant = await Merchant.findOne({ _id: merchantIds[0], status: 'active' });
  if (!merchant) throw new ApiError(400, 'Merchant store is inactive or missing');

  const orderItems = items.map(({ productId, quantity }) => {
    const product = products.find((p) => p._id.toString() === productId);
    if (!product) throw new ApiError(404, `Product ${productId} not found`);
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || product.stock < Number(quantity)) {
      throw new ApiError(400, `${product.name} is no longer available in the requested quantity`);
    }

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
  const totalAmount = itemsPrice + shippingPrice;

  // Find merchant from product
  const primaryMerchant = merchant._id;

  let order;
  try {
    order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      orderStatus: 'processing',
      statusHistory: [{ status: 'processing', changedAt: new Date() }],
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      isAgentOrder: false,
      agentOrigin: 'direct_web',
      merchant: primaryMerchant,
      itemsPrice,
      shippingPrice,
      totalAmount,
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.razorpayOrderId) {
      const duplicate = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      return res.json(new ApiResponse(200, duplicate, 'Payment already verified and order already exists'));
    }
    throw error;
  }

  // Deduct stock and increment sold count
  await Promise.all(
    orderItems.map((i) =>
      Product.findByIdAndUpdate(i.product, {
        $inc: { stock: -i.quantity, soldCount: i.quantity },
      })
    )
  );

  // Update merchant analytics
  if (primaryMerchant) {
    const incObj = {
      'metrics.totalRevenue': totalAmount,
      'metrics.totalOrders': 1,
    };
    await Merchant.findByIdAndUpdate(primaryMerchant, { $inc: incObj });
  }

  res.status(201).json(new ApiResponse(201, order, 'Payment verified and order placed successfully'));
});

export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const signature = req.headers['x-razorpay-signature'];
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    throw new ApiError(400, 'Invalid Razorpay webhook signature');
  }

  const payload = JSON.parse(rawBody.toString('utf8'));
  const payment = payload.payload?.payment?.entity;
  const orderId = payment?.order_id;
  if (orderId) {
    const paymentStatus = payload.event === 'payment.failed' ? 'failed' : 'paid';
    await Order.findOneAndUpdate(
      { razorpayOrderId: orderId },
      { $set: { paymentStatus, razorpayPaymentId: payment.id } }
    );
  }

  res.json({ status: 'ok', processed: Boolean(orderId) });
});
