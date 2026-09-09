import crypto from 'crypto';
import Product from '../models/Product.js';
import BundleOffer from '../models/BundleOffer.js';
import AgentCart from '../models/AgentCart.js';
import AgentCheckoutSession from '../models/AgentCheckoutSession.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import { createRazorpayOrder, verifyRazorpaySignature, getRazorpayKeyId } from '../config/razorpay.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Machine-readable product catalog for AI agents
 */
export const searchCatalog = asyncHandler(async (req, res) => {
  const { query, category, minPrice, maxPrice, inStockOnly = 'true', limit = 10, page = 1 } = req.query;

  const filter = { isActive: true };
  if (req.merchantId) filter.merchant = req.merchantId;

  if (query) {
    filter.$or = [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
    ];
  }

  if (category) filter.category = category;
  if (inStockOnly === 'true') filter.stock = { $gt: 0 };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));

  const [products, total] = await Promise.all([
    Product.find(filter)
      .select('name slug description price discountPrice stock sizes colors images category brand')
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    apiVersion: '1.0.0',
    data: {
      items: products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        effectivePrice: p.discountPrice || p.price,
        discountPrice: p.discountPrice || null,
        inStock: p.stock > 0,
        stockCount: p.stock,
        sizes: p.sizes,
        colors: p.colors,
        category: p.category?.name || 'Uncategorized',
        brand: p.brand?.name || 'LuxeStyle',
        imageUrl: p.images?.[0]?.url,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

/**
 * Get single product details + active bundle offers
 */
export const getProductDetails = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;

  const isObjectId = idOrSlug.match(/^[0-9a-fA-F]{24}$/);
  const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };

  const product = await Product.findOne({ ...query, isActive: true, merchant: req.merchantId })
    .populate('category', 'name slug')
    .populate('brand', 'name slug');

  if (!product) throw new ApiError(404, 'Product not found in merchant catalog');

  // Find any active approved bundle offers featuring this product
  const relatedBundles = await BundleOffer.find({
    status: 'approved',
    merchant: req.merchantId,
    'products.product': product._id,
  }).populate('products.product', 'name price discountPrice images');

  res.json({
    status: 'success',
    data: {
      product: {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        effectivePrice: product.discountPrice || product.price,
        discountPrice: product.discountPrice,
        inStock: product.stock > 0,
        stockCount: product.stock,
        sizes: product.sizes,
        colors: product.colors,
        images: product.images.map((i) => i.url),
        category: product.category?.name,
        brand: product.brand?.name,
      },
      recommendedBundles: relatedBundles.map((b) => ({
        id: b._id,
        title: b.title,
        description: b.description,
        originalPrice: b.originalPrice,
        bundlePrice: b.bundlePrice,
        discountPercentage: b.discountPercentage,
        items: b.products.map((item) => ({
          id: item.product?._id,
          name: item.product?.name,
          price: item.product?.discountPrice || item.product?.price,
        })),
      })),
    },
  });
});

/**
 * Check availability for items
 */
export const checkAvailability = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'items array is required');
  }

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true, merchant: req.merchantId });

  const results = items.map((requested) => {
    const prod = products.find((p) => p._id.toString() === requested.productId);
    if (!prod) {
      return {
        productId: requested.productId,
        found: false,
        inStock: false,
        availableQuantity: 0,
      };
    }
    const available = prod.stock >= requested.quantity;
    return {
      productId: prod._id,
      name: prod.name,
      requestedQuantity: requested.quantity,
      availableQuantity: prod.stock,
      inStock: available,
      price: prod.discountPrice || prod.price,
    };
  });

  const allAvailable = results.every((r) => r.inStock);

  res.json({
    status: 'success',
    data: {
      allAvailable,
      items: results,
    },
  });
});

/**
 * Get active merchant-approved bundles & combos
 */
export const getActiveOffers = asyncHandler(async (req, res) => {
  const filter = { status: 'approved' };
  if (req.merchantId) filter.merchant = req.merchantId;

  const bundles = await BundleOffer.find(filter)
    .populate('products.product', 'name price discountPrice images stock')
    .sort({ discountPercentage: -1 });

  res.json({
    status: 'success',
    data: {
      offers: bundles.map((b) => ({
        bundleId: b._id,
        title: b.title,
        description: b.description,
        bundleType: b.bundleType,
        originalPrice: b.originalPrice,
        bundlePrice: b.bundlePrice,
        discountPercentage: b.discountPercentage,
        savings: b.originalPrice - b.bundlePrice,
        items: b.products.map((p) => ({
          productId: p.product?._id,
          name: p.product?.name,
          image: p.product?.images?.[0]?.url,
          inStock: (p.product?.stock || 0) > 0,
        })),
      })),
    },
  });
});

/**
 * Initialize / Create Agent Cart
 */
export const createCart = asyncHandler(async (req, res) => {
  const cartId = `cart_${crypto.randomBytes(12).toString('hex')}`;
  const cart = await AgentCart.create({
    cartId,
    merchant: req.merchantId,
    agentKey: req.agent?._id,
    items: [],
  });

  res.status(201).json({
    status: 'success',
    data: {
      cartId: cart.cartId,
      items: cart.items,
      subtotal: cart.subtotal,
      totalAmount: cart.totalAmount,
    },
  });
});

/**
 * Get Agent Cart details
 */
export const getCart = asyncHandler(async (req, res) => {
  const cart = await AgentCart.findOne({ cartId: req.params.cartId, merchant: req.merchantId, agentKey: req.agent._id });
  if (!cart) throw new ApiError(404, 'Agent cart not found');

  cart.recalculate();
  await cart.save();

  res.json({
    status: 'success',
    data: cart,
  });
});

/**
 * Add items to Agent Cart
 */
export const addItemToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const cart = await AgentCart.findOne({ cartId: req.params.cartId, merchant: req.merchantId, agentKey: req.agent._id });
  if (!cart) throw new ApiError(404, 'Agent cart not found');

  const product = await Product.findOne({ _id: productId, isActive: true, merchant: req.merchantId });
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.stock < quantity) throw new ApiError(400, `${product.name} has insufficient stock`);

  const existing = cart.items.find((i) => i.product.toString() === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({
      product: product._id,
      name: product.name,
      price: product.discountPrice || product.price,
      quantity,
      image: product.images?.[0]?.url,
      sku: product.sku,
    });
  }

  cart.recalculate();
  await cart.save();

  res.json({
    status: 'success',
    message: 'Item added to cart',
    data: cart,
  });
});

/**
 * Apply approved Bundle to Agent Cart
 */
export const applyBundleToCart = asyncHandler(async (req, res) => {
  const { bundleId } = req.body;
  const cart = await AgentCart.findOne({ cartId: req.params.cartId, merchant: req.merchantId, agentKey: req.agent._id });
  if (!cart) throw new ApiError(404, 'Agent cart not found');

  const bundle = await BundleOffer.findOne({ _id: bundleId, merchant: req.merchantId, status: 'approved' })
    .populate('products.product');

  if (!bundle) throw new ApiError(404, 'Approved bundle offer not found');

  // Add each product in the bundle
  for (const item of bundle.products) {
    const prod = item.product;
    if (prod && prod.stock > 0) {
      const existing = cart.items.find((i) => i.product.toString() === prod._id.toString());
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.items.push({
          product: prod._id,
          name: prod.name,
          price: prod.discountPrice || prod.price,
          quantity: 1,
          image: prod.images?.[0]?.url,
          sku: prod.sku,
        });
      }
    }
  }

  cart.appliedBundle = bundle._id;
  cart.bundleDiscount = bundle.originalPrice - bundle.bundlePrice;
  cart.recalculate();
  await cart.save();

  res.json({
    status: 'success',
    message: `Bundle '${bundle.title}' applied to cart`,
    data: cart,
  });
});

/**
 * Initiate Agentic Checkout Session
 * External AI agent submits customer details; system pauses for EXPLICIT customer payment authorization.
 */
export const initiateCheckout = asyncHandler(async (req, res) => {
  const { cartId, customerInfo, shippingAddress } = req.body;

  if (!cartId) throw new ApiError(400, 'cartId is required');
  if (!customerInfo?.fullName || !customerInfo?.email || !customerInfo?.phone) {
    throw new ApiError(400, 'customerInfo (fullName, email, phone) is required');
  }
  if (!shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.postalCode) {
    throw new ApiError(400, 'shippingAddress (line1, city, postalCode) is required');
  }

  const cart = await AgentCart.findOne({ cartId, merchant: req.merchantId, agentKey: req.agent._id });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Cart is empty or not found');
  }

  cart.recalculate();

  // Create Razorpay TEST order
  const razorpayOrder = await createRazorpayOrder({
    amount: cart.totalAmount,
    currency: 'INR',
    receipt: `rcpt_agent_${Date.now()}`,
    notes: {
      origin: 'ai_agent',
      cartId: cart.cartId,
      merchantId: req.merchantId?.toString() || '',
    },
  });

  const sessionId = `acs_${crypto.randomBytes(12).toString('hex')}`;

  const fullShippingAddress = {
    ...shippingAddress,
    fullName: shippingAddress.fullName || customerInfo.fullName,
    phone: shippingAddress.phone || customerInfo.phone,
    country: shippingAddress.country || 'India',
  };

  const session = await AgentCheckoutSession.create({
    sessionId,
    cartId: cart.cartId,
    merchant: req.merchantId,
    agentKey: req.agent?._id,
    customerInfo,
    shippingAddress: fullShippingAddress,
    items: cart.items.map((i) => ({
      product: i.product,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image,
    })),
    itemsPrice: cart.subtotal,
    shippingPrice: cart.shippingFee,
    discountAmount: cart.bundleDiscount,
    totalAmount: cart.totalAmount,
    razorpayOrderId: razorpayOrder.id,
    status: 'awaiting_customer_authorization',
  });

  res.status(201).json({
    status: 'success',
    message: 'Checkout initiated. Explicit customer payment authorization required.',
    data: {
      sessionId: session.sessionId,
      status: session.status,
      authorizationUrl: `/checkout?agentSession=${session.sessionId}`,
      razorpay: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount, // in paise
        currency: razorpayOrder.currency,
        keyId: getRazorpayKeyId(),
      },
      summary: {
        itemCount: session.items.length,
        subtotal: session.itemsPrice,
        shipping: session.shippingPrice,
        discount: session.discountAmount,
        totalAmount: session.totalAmount,
      },
      instruction:
        'The customer must review the order and complete authorization via Razorpay TEST to finalize payment.',
    },
  });
});

/**
 * Verify Razorpay payment and commit order creation
 */
export const verifyCheckoutPayment = asyncHandler(async (req, res) => {
  const { sessionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!sessionId) throw new ApiError(400, 'sessionId is required');

  const session = await AgentCheckoutSession.findOne({ sessionId });
  if (!session) throw new ApiError(404, 'Checkout session not found');

  if (session.status === 'completed') {
    return res.json(new ApiResponse(200, { orderId: session.createdOrder }, 'Payment already verified'));
  }

  if (session.razorpayOrderId !== razorpay_order_id) {
    throw new ApiError(400, 'Payment order does not match checkout session');
  }

  const sessionProducts = await Product.find({
    _id: { $in: session.items.map((item) => item.product) },
    merchant: session.merchant,
    isActive: true,
  });
  if (sessionProducts.length !== session.items.length) {
    throw new ApiError(400, 'Checkout contains a product outside the merchant catalog');
  }
  for (const item of session.items) {
    const product = sessionProducts.find((candidate) => candidate._id.toString() === item.product.toString());
    if (!product || product.stock < item.quantity) {
      throw new ApiError(400, `${item.name} is no longer available in the requested quantity`);
    }
  }

  // Verify HMAC signature
  const isValid = verifyRazorpaySignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    session.status = 'failed';
    await session.save();
    throw new ApiError(400, 'Invalid payment signature. Cryptographic verification failed.');
  }

  // Find or create customer user record in MongoDB
  let customer = await User.findOne({ email: session.customerInfo.email.toLowerCase() });
  if (!customer) {
    customer = await User.create({
      clerkId: `guest_${Date.now()}`,
      name: session.customerInfo.fullName,
      email: session.customerInfo.email.toLowerCase(),
      phone: session.customerInfo.phone,
    });
  }

  // Create real Order in MongoDB
  const order = await Order.create({
    user: customer._id,
    items: session.items,
    shippingAddress: session.shippingAddress,
    paymentMethod: 'razorpay',
    paymentStatus: 'paid',
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    isAgentOrder: true,
    agentOrigin: 'external_agent',
    agentKey: session.agentKey,
    merchant: session.merchant,
    orderStatus: 'processing',
    statusHistory: [{ status: 'processing', changedAt: new Date() }],
    itemsPrice: session.itemsPrice,
    shippingPrice: session.shippingPrice,
    discountAmount: session.discountAmount,
    totalAmount: session.totalAmount,
  });

  // Deduct inventory
  await Promise.all(
    session.items.map((i) =>
      Product.findOneAndUpdate({ _id: i.product, merchant: session.merchant }, {
        $inc: { stock: -i.quantity, soldCount: i.quantity },
      })
    )
  );

  // Update Merchant Analytics
  if (session.merchant) {
    await Merchant.findByIdAndUpdate(session.merchant, {
      $inc: {
        'metrics.totalRevenue': session.totalAmount,
        'metrics.totalOrders': 1,
        'metrics.agentRevenue': session.totalAmount,
        'metrics.agentOrders': 1,
      },
    });
  }

  session.status = 'completed';
  session.razorpayPaymentId = razorpay_payment_id;
  session.createdOrder = order._id;
  await session.save();

  // Clear agent cart
  if (session.cartId) {
    await AgentCart.deleteOne({ cartId: session.cartId });
  }

  res.json(
    new ApiResponse(
      200,
      {
        orderId: order._id,
        orderNumber: order._id.toString().slice(-8).toUpperCase(),
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
      },
      'Payment verified and order created successfully'
    )
  );
});

/**
 * Return OpenAPI 3.0 specification for AI tools and external agent integrations
 */
export const getOpenApiSpec = (req, res) => {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'LuxeStyle Agent-Ready Commerce API',
      version: '1.0.0',
      description:
        'Machine-readable commerce API for external AI agents to search catalog, check stock, manage carts, apply bundles, and initiate agentic checkout with Razorpay TEST authorization.',
    },
    servers: [{ url: '/api/agent/v1' }],
    components: {
      securitySchemes: {
        AgentKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Agent-Key',
          description: 'Merchant-issued Agent API Key (e.g. lx_live_...)',
        },
      },
    },
    security: [{ AgentKeyAuth: [] }],
    paths: {
      '/catalog': {
        get: {
          summary: 'Search products in catalog',
          operationId: 'searchCatalog',
          parameters: [
            { name: 'query', in: 'query', schema: { type: 'string' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
            { name: 'inStockOnly', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { 200: { description: 'Catalog items' } },
        },
      },
      '/check-availability': {
        post: {
          summary: 'Check stock availability for items',
          operationId: 'checkAvailability',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          productId: { type: 'string' },
                          quantity: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Stock verification result' } },
        },
      },
      '/offers': {
        get: {
          summary: 'Get active approved AI bundles and combos',
          operationId: 'getOffers',
          responses: { 200: { description: 'Active bundle offers' } },
        },
      },
      '/cart': {
        post: {
          summary: 'Create an autonomous agent cart',
          operationId: 'createCart',
          responses: { 201: { description: 'Cart created' } },
        },
      },
      '/cart/{cartId}/items': {
        post: {
          summary: 'Add item to cart',
          operationId: 'addItemToCart',
          parameters: [{ name: 'cartId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    quantity: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Updated cart' } },
        },
      },
      '/checkout/initiate': {
        post: {
          summary: 'Initiate agentic checkout requiring customer payment authorization',
          operationId: 'initiateCheckout',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cartId: { type: 'string' },
                    customerInfo: {
                      type: 'object',
                      properties: {
                        fullName: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' },
                      },
                    },
                    shippingAddress: {
                      type: 'object',
                      properties: {
                        line1: { type: 'string' },
                        city: { type: 'string' },
                        postalCode: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Checkout session and Razorpay test order created' } },
        },
      },
    },
  };

  res.json(spec);
};

/**
 * Return Function Calling / Tool Definitions for LLMs (OpenAI/Gemini/Claude format)
 */
export const getToolsDefinition = (req, res) => {
  const tools = [
    {
      name: 'search_catalog',
      description: 'Search products in the luxury e-commerce catalog with filters for price, category, and availability.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term or product style' },
          category: { type: 'string', description: 'Category name' },
          maxPrice: { type: 'number', description: 'Maximum price in INR' },
          inStockOnly: { type: 'boolean', description: 'Only return items currently in stock' },
        },
      },
    },
    {
      name: 'get_product_details',
      description: 'Retrieve full specifications, stock count, and bundle deals for a product.',
      parameters: {
        type: 'object',
        required: ['idOrSlug'],
        properties: {
          idOrSlug: { type: 'string', description: 'Product ID or URL slug' },
        },
      },
    },
    {
      name: 'check_availability',
      description: 'Verify real-time stock levels for one or multiple products before purchase.',
      parameters: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'number' },
              },
            },
          },
        },
      },
    },
    {
      name: 'get_approved_bundles',
      description: 'Get merchant-approved AI bundles and cross-sell combos with special discount pricing.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'create_cart',
      description: 'Initialize a new agent shopping session cart.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'add_to_cart',
      description: 'Add a selected product or variant to the shopping cart.',
      parameters: {
        type: 'object',
        required: ['cartId', 'productId'],
        properties: {
          cartId: { type: 'string' },
          productId: { type: 'string' },
          quantity: { type: 'number', default: 1 },
        },
      },
    },
    {
      name: 'apply_bundle',
      description: 'Apply an approved AI bundle offer directly to an agent cart.',
      parameters: {
        type: 'object',
        required: ['cartId', 'bundleId'],
        properties: {
          cartId: { type: 'string' },
          bundleId: { type: 'string' },
        },
      },
    },
    {
      name: 'initiate_checkout',
      description: 'Initiate checkout and prepare Razorpay TEST order. Returns authorization link for the customer to finalize payment.',
      parameters: {
        type: 'object',
        required: ['cartId', 'customerInfo', 'shippingAddress'],
        properties: {
          cartId: { type: 'string' },
          customerInfo: {
            type: 'object',
            properties: {
              fullName: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
            },
          },
          shippingAddress: {
            type: 'object',
            properties: {
              line1: { type: 'string' },
              city: { type: 'string' },
              postalCode: { type: 'string' },
            },
          },
        },
      },
    },
  ];

  res.json({ status: 'success', tools });
};
